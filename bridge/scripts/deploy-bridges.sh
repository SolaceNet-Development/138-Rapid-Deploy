#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Bridge Deployment${NC}"

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Deploy CCIP contracts
echo -e "${GREEN}Deploying CCIP contracts...${NC}"
cd contracts
npx hardhat run scripts/deploy-ccip.ts --network chain138

# Deploy Lock and Mint contracts
echo -e "${GREEN}Deploying Lock and Mint contracts...${NC}"
npx hardhat run scripts/deploy-lock-mint.ts --network chain138

# Deploy AMB contracts
echo -e "${GREEN}Deploying AMB contracts...${NC}"
npx hardhat run scripts/deploy-amb.ts --network chain138

# Deploy Oracle contracts
echo -e "${GREEN}Deploying Oracle contracts...${NC}"
npx hardhat run scripts/deploy-oracles.ts --network chain138

# Initialize CCIP Router
echo -e "${GREEN}Initializing CCIP Router...${NC}"
npx hardhat run scripts/initialize-ccip.ts --network chain138

# Set up bridge permissions
echo -e "${GREEN}Setting up bridge permissions...${NC}"
npx hardhat run scripts/setup-permissions.ts --network chain138

# Start Oracle services
echo -e "${GREEN}Starting Oracle services...${NC}"
cd ../oracles
npm run start-oracles &

# Start AMB Relayer
echo -e "${GREEN}Starting AMB Relayer...${NC}"
cd ../amb
npm run start-relayer &

# Start monitoring services
echo -e "${GREEN}Starting monitoring services...${NC}"
cd ../monitoring
npm run start-monitor &

echo -e "${GREEN}Bridge deployment completed successfully!${NC}"
echo -e "${YELLOW}Services running in background:${NC}"
echo -e "- Oracle services"
echo -e "- AMB Relayer"
echo -e "- Monitoring services"
echo -e "\n${YELLOW}Check logs in the respective directories for service status${NC}" 