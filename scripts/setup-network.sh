#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Chain 138 Setup${NC}"

# Check for required tools
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: node is required but not installed${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}Error: npm is required but not installed${NC}" >&2; exit 1; }
command -v besu >/dev/null 2>&1 || { 
    echo -e "${RED}Error: Hyperledger Besu is required but not installed${NC}" >&2;
    echo -e "${YELLOW}Install Besu using these commands:${NC}"
    echo "brew tap hyperledger/besu"
    echo "brew install hyperledger/besu/besu"
    exit 1; 
}

# Create project structure
echo -e "${GREEN}Creating project structure...${NC}"
mkdir -p {blockchain,bridge,defi,contracts}/{config,scripts}
mkdir -p blockchain/config/{ibft,permissioning,network}
mkdir -p bridge/{ccip,amb,oracles}
mkdir -p defi/{aave,dodo,lido,maker,meth,tatum}
mkdir -p contracts/{core,bridges,protocols}
mkdir -p {monitoring,automation,docs}

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    git init
    echo "node_modules/" > .gitignore
    echo ".env" >> .gitignore
    echo "*.log" >> .gitignore
    echo "data/" >> .gitignore
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}Please configure your .env file${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Initialize TypeScript
echo -e "${GREEN}Initializing TypeScript...${NC}"
npx tsc --init

# Create data directories
echo -e "${GREEN}Creating data directories...${NC}"
mkdir -p data/chain138/{database,logs}

# Set up monitoring
echo -e "${GREEN}Setting up monitoring...${NC}"
mkdir -p monitoring/{logs,alerts}

# Set up documentation
echo -e "${GREEN}Setting up documentation...${NC}"
mkdir -p docs/{api,deployment,tutorials}

# Make scripts executable
chmod +x scripts/*.sh
chmod +x blockchain/scripts/*.sh
chmod +x bridge/scripts/*.sh
chmod +x defi/scripts/*.sh

echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure your .env file"
echo "2. Run './scripts/deploy-chain.sh' to deploy the blockchain"
echo "3. Run './scripts/deploy-bridges.sh' to deploy bridges"
echo "4. Run './scripts/deploy-defi.sh' to deploy DeFi protocols" 