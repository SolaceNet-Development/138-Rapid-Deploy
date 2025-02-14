#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Monitoring Stack Deployment${NC}"

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Create monitoring directories
echo -e "${GREEN}Creating monitoring directories...${NC}"
mkdir -p monitoring/{data,logs}/{prometheus,grafana,alertmanager}
mkdir -p monitoring/config/{rules,templates}

# Deploy Prometheus
echo -e "${GREEN}Deploying Prometheus...${NC}"
docker-compose up -d prometheus

# Deploy Grafana
echo -e "${GREEN}Deploying Grafana...${NC}"
docker-compose up -d grafana

# Deploy AlertManager
echo -e "${GREEN}Deploying AlertManager...${NC}"
docker-compose up -d alertmanager

# Deploy Node Exporter
echo -e "${GREEN}Deploying Node Exporter...${NC}"
docker-compose up -d node-exporter

# Configure Grafana Datasources
echo -e "${GREEN}Configuring Grafana datasources...${NC}"
curl -X POST -H "Content-Type: application/json" -d '{
    "name":"Prometheus",
    "type":"prometheus",
    "url":"http://prometheus:9090",
    "access":"proxy",
    "isDefault":true
}' http://admin:admin@localhost:3000/api/datasources

# Import Grafana Dashboards
echo -e "${GREEN}Importing Grafana dashboards...${NC}"
for dashboard in monitoring/config/grafana/dashboards/*.json; do
    curl -X POST -H "Content-Type: application/json" -d @$dashboard http://admin:admin@localhost:3000/api/dashboards/db
done

# Configure AlertManager
echo -e "${GREEN}Configuring AlertManager...${NC}"
curl -X POST -H "Content-Type: application/json" --data-binary @monitoring/config/alertmanager/alertmanager.yml \
    http://localhost:9093/-/reload

# Start Bridge Monitor
echo -e "${GREEN}Starting Bridge Monitor...${NC}"
docker-compose up -d bridge-monitor

# Start DeFi Monitor
echo -e "${GREEN}Starting DeFi Monitor...${NC}"
docker-compose up -d defi-monitor

# Configure Graph Node
echo -e "${GREEN}Configuring Graph Node...${NC}"
docker-compose up -d graph-node

# Wait for services to be ready
echo -e "${GREEN}Waiting for services to be ready...${NC}"
sleep 30

# Verify deployments
echo -e "${GREEN}Verifying deployments...${NC}"
services=("prometheus" "grafana" "alertmanager" "node-exporter" "bridge-monitor" "defi-monitor" "graph-node")
for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo -e "${GREEN}✓ $service is running${NC}"
    else
        echo -e "${RED}✗ $service is not running${NC}"
    fi
done

# Print access information
echo -e "\n${YELLOW}Access Information:${NC}"
echo "Grafana: http://localhost:3000 (admin/admin)"
echo "Prometheus: http://localhost:9090"
echo "AlertManager: http://localhost:9093"
echo "Graph Node: http://localhost:8000"

echo -e "\n${GREEN}Monitoring stack deployed successfully!${NC}"
echo -e "${YELLOW}Please configure your alert channels in AlertManager${NC}" 