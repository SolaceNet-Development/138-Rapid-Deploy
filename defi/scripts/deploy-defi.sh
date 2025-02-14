#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting DeFi Protocol Deployment${NC}"

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Deploy Aave v3
echo -e "${GREEN}Deploying Aave v3...${NC}"
cd contracts
npx hardhat run scripts/deploy-aave.ts --network chain138

# Deploy Dodoex
echo -e "${GREEN}Deploying Dodoex...${NC}"
npx hardhat run scripts/deploy-dodo.ts --network chain138

# Deploy Lido
echo -e "${GREEN}Deploying Lido...${NC}"
npx hardhat run scripts/deploy-lido.ts --network chain138

# Deploy MakerDAO
echo -e "${GREEN}Deploying MakerDAO...${NC}"
npx hardhat run scripts/deploy-maker.ts --network chain138

# Deploy mETH
echo -e "${GREEN}Deploying mETH...${NC}"
npx hardhat run scripts/deploy-meth.ts --network chain138

# Configure Tatum Integration
echo -e "${GREEN}Configuring Tatum Integration...${NC}"
npx hardhat run scripts/setup-tatum.ts --network chain138

# Deploy Governance
echo -e "${GREEN}Deploying Governance...${NC}"
npx hardhat run scripts/deploy-governance.ts --network chain138

# Initialize Protocol Parameters
echo -e "${GREEN}Initializing Protocol Parameters...${NC}"
npx hardhat run scripts/initialize-protocols.ts --network chain138

# Set up Protocol Permissions
echo -e "${GREEN}Setting up Protocol Permissions...${NC}"
npx hardhat run scripts/setup-protocol-permissions.ts --network chain138

# Start Protocol Monitoring
echo -e "${GREEN}Starting Protocol Monitoring...${NC}"
cd ../monitoring
npm run start-protocol-monitor &

# Start Price Feeds
echo -e "${GREEN}Starting Price Feeds...${NC}"
cd ../oracles
npm run start-price-feeds &

# Start Automation Services
echo -e "${GREEN}Starting Automation Services...${NC}"
cd ../automation
npm run start-keepers &

echo -e "${GREEN}DeFi protocol deployment completed successfully!${NC}"
echo -e "${YELLOW}Services running in background:${NC}"
echo -e "- Protocol Monitoring"
echo -e "- Price Feeds"
echo -e "- Automation Services"
echo -e "\n${YELLOW}Check logs in the respective directories for service status${NC}"

# Generate Protocol Documentation
echo -e "${GREEN}Generating Protocol Documentation...${NC}"
cd ../docs
npm run generate-docs

echo -e "${GREEN}All DeFi protocols have been deployed and configured!${NC}"
echo -e "${YELLOW}Please verify the deployment addresses in the generated documentation${NC}" 