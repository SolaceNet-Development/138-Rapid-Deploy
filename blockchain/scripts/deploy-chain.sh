#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Chain 138 Deployment${NC}"

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Create directories
mkdir -p data/chain138/{database,logs}

# Initialize validators
echo -e "${GREEN}Initializing validators...${NC}"
for i in {1..4}; do
    besu public-key export --to=data/chain138/validator$i.pub
    besu public-key export-address --to=data/chain138/validator$i.addr
done

# Extract validator addresses
VALIDATORS=$(cat data/chain138/validator*.addr)

# Create genesis file
echo -e "${GREEN}Creating genesis configuration...${NC}"
cat > blockchain/config/genesis.json << EOF
{
  "config": {
    "chainId": 138,
    "constantinoplefixblock": 0,
    "ibft2": {
      "blockperiodseconds": 2,
      "epochlength": 30000,
      "requesttimeoutseconds": 4,
      "blockreward": "0",
      "validatorcontractaddress": ""
    },
    "contractSizeLimit": 2147483647,
    "ethash": {
      "fixeddifficulty": 1000
    }
  },
  "nonce": "0x0",
  "timestamp": "0x0",
  "gasLimit": "0x1fffffffffffff",
  "difficulty": "0x1",
  "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
  "coinbase": "0x0000000000000000000000000000000000000000",
  "alloc": {},
  "extraData": "0x0000000000000000000000000000000000000000000000000000000000000000$VALIDATORS0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "number": "0x0",
  "gasUsed": "0x0",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
}
EOF

# Create network configuration
echo -e "${GREEN}Creating network configuration...${NC}"
cat > blockchain/config/network/config.toml << EOF
data-path="data/chain138/database"
node-private-key-file="data/chain138/key"
rpc-http-enabled=true
rpc-http-api=["ETH","NET","IBFT","WEB3","ADMIN","TXPOOL","DEBUG","TRACE","PERM"]
host-allowlist=["*"]
rpc-http-cors-origins=["*"]
rpc-ws-enabled=true
rpc-ws-api=["ETH","NET","IBFT","WEB3","ADMIN","TXPOOL","DEBUG","TRACE","PERM"]
metrics-enabled=true
metrics-host="0.0.0.0"
metrics-port=9545
p2p-enabled=true
discovery-enabled=true
permissions-nodes-enabled=true
permissions-accounts-enabled=true
revert-reason-enabled=true

# Mainnet Fork Configuration
fork-block-number="latest"
fork-chain-id=1
fork-enabled=true
fork-sync-mode="fast"
remote-connections-limit-enabled=true
remote-connections-max-percentage=50
remote-connections-preferred-nodes=["https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"]
EOF

# Initialize the blockchain
echo -e "${GREEN}Initializing blockchain...${NC}"
besu operator generate-blockchain-config \
    --config-file=blockchain/config/network/config.toml \
    --genesis-file=blockchain/config/genesis.json \
    --output-dir=data/chain138/network \
    --private-key-file-name=key

# Start the network
echo -e "${GREEN}Starting Chain 138 network...${NC}"
besu --config-file=blockchain/config/network/config.toml \
     --genesis-file=blockchain/config/genesis.json \
     --data-path=data/chain138/database \
     --bootnodes="" \
     --min-gas-price=0 \
     2>> data/chain138/logs/besu.log &

echo -e "${GREEN}Chain 138 network started successfully!${NC}"
echo -e "${YELLOW}Check logs at data/chain138/logs/besu.log${NC}"

# Wait for network to be ready
echo -e "${GREEN}Waiting for network to be ready...${NC}"
sleep 30

# Deploy permissioning contracts
echo -e "${GREEN}Deploying permissioning contracts...${NC}"
cd contracts
npx hardhat run scripts/deploy-permissioning.ts --network chain138

# Deploy IBFT contracts
echo -e "${GREEN}Deploying IBFT contracts...${NC}"
npx hardhat run scripts/deploy-ibft.ts --network chain138

# Deploy essential contracts
echo -e "${GREEN}Deploying essential contracts...${NC}"
npx hardhat run scripts/deploy-essential.ts --network chain138

# Initialize mainnet forking
echo -e "${GREEN}Initializing mainnet fork...${NC}"
curl -X POST --data '{"jsonrpc":"2.0","method":"evm_snapshot","params":[],"id":1}' http://localhost:8545

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${YELLOW}Essential contracts deployed and mainnet fork initialized${NC}" 