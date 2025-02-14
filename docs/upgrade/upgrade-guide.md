# Upgrade Guide

## Overview

### Types of Upgrades
1. Protocol Upgrades
   - Smart contract upgrades
   - Protocol parameter changes
   - Feature additions

2. Network Upgrades
   - Consensus changes
   - Network parameter updates
   - Hard forks

3. Infrastructure Upgrades
   - Node software updates
   - Monitoring stack updates
   - Database schema changes

## Protocol Upgrades

### Smart Contract Upgrades

#### Transparent Proxy Pattern
```solidity
// Implementation contract
contract LendingPoolV2 is Initializable {
    function initialize() public initializer {
        // Initialize new state
    }
    
    function newFeature() external {
        // New functionality
    }
}

// Upgrade script
async function upgradeLendingPool() {
    const proxyAdmin = await ethers.getContract("ProxyAdmin");
    const proxy = await ethers.getContract("LendingPoolProxy");
    
    const LendingPoolV2 = await ethers.getContractFactory("LendingPoolV2");
    const implementation = await LendingPoolV2.deploy();
    
    await proxyAdmin.upgrade(proxy.address, implementation.address);
}
```

#### UUPS Pattern
```solidity
contract LendingPoolV2 is UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    function initialize() public reinitializer(2) {
        // Initialize new state
    }
}

// Upgrade script
async function upgradeUUPS() {
    const proxy = await ethers.getContract("LendingPoolProxy");
    const LendingPoolV2 = await ethers.getContractFactory("LendingPoolV2");
    await proxy.upgradeTo(LendingPoolV2.address);
}
```

### Parameter Updates

#### Governance Proposal
```solidity
contract GovernorBravo {
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        // Create proposal
    }
}

// Update parameters
async function proposeParameterUpdate() {
    const governor = await ethers.getContract("GovernorBravo");
    const pool = await ethers.getContract("LendingPool");
    
    const targets = [pool.address];
    const values = [0];
    const signatures = ["updateParameter(uint256)"];
    const calldatas = [
        ethers.utils.defaultAbiCoder.encode(["uint256"], [newValue])
    ];
    
    await governor.propose(
        targets,
        values,
        signatures,
        calldatas,
        "Update lending parameters"
    );
}
```

### Feature Additions

#### Contract Extensions
```solidity
contract LendingPoolExtension {
    LendingPool public pool;
    
    function initialize(address _pool) external {
        pool = LendingPool(_pool);
    }
    
    function newFeature() external {
        // Implement new feature
        pool.someFunction();
    }
}

// Deployment script
async function deployExtension() {
    const LendingPoolExtension = await ethers.getContractFactory(
        "LendingPoolExtension"
    );
    const extension = await LendingPoolExtension.deploy();
    
    const pool = await ethers.getContract("LendingPool");
    await extension.initialize(pool.address);
}
```

## Network Upgrades

### Consensus Updates

#### IBFT 2.0 Parameter Changes
```bash
#!/bin/bash
# update-consensus.sh

# Backup current config
cp config.toml config.toml.backup

# Update consensus parameters
cat > config.toml << EOF
consensus-protocol="ibft2"
ibft2-block-period-seconds=2
ibft2-epoch-length=30000
ibft2-request-timeout-seconds=4
ibft2-validator-selection-mode="blockNumber"
EOF

# Restart nodes
docker-compose down
docker-compose up -d
```

#### Hard Fork Implementation
```solidity
contract HardForkManager {
    uint256 public forkBlock;
    
    function isForkActive() public view returns (bool) {
        return block.number >= forkBlock;
    }
    
    modifier afterFork() {
        require(isForkActive(), "Not active");
        _;
    }
}

// Network configuration
{
    "config": {
        "chainId": 138,
        "homesteadBlock": 0,
        "eip150Block": 0,
        "eip155Block": 0,
        "eip158Block": 0,
        "byzantiumBlock": 0,
        "constantinopleBlock": 0,
        "petersburgBlock": 0,
        "istanbulBlock": 0,
        "berlinBlock": 0,
        "londonBlock": 0,
        "customForkBlock": 1000000
    }
}
```

### Network Parameters

#### Update Block Gas Limit
```bash
#!/bin/bash
# update-gas-limit.sh

# Update genesis configuration
jq '.gasLimit = "0x1fffffffffffff"' genesis.json > genesis.new.json
mv genesis.new.json genesis.json

# Restart network
./scripts/restart-network.sh
```

#### Update Network ID
```bash
#!/bin/bash
# update-network-id.sh

# Update configuration
sed -i 's/network-id=.*/network-id=138/' config.toml

# Update all nodes
for node in $(docker ps -q --filter name=besu); do
    docker restart $node
done
```

## Infrastructure Upgrades

### Node Software Updates

#### Besu Update
```bash
#!/bin/bash
# update-besu.sh

# Stop services
docker-compose down

# Update image version
sed -i 's/hyperledger\/besu:.*/hyperledger\/besu:latest/' docker-compose.yml

# Pull new image
docker-compose pull

# Start services
docker-compose up -d

# Verify upgrade
docker-compose exec besu besu --version
```

#### Tessera Update
```bash
#!/bin/bash
# update-tessera.sh

# Backup configuration
cp tessera.conf tessera.conf.backup

# Stop services
docker-compose down

# Update image version
sed -i 's/quorumengineering\/tessera:.*/quorumengineering\/tessera:latest/' docker-compose.yml

# Start services
docker-compose up -d

# Verify upgrade
docker-compose exec tessera tessera --version
```

### Monitoring Updates

#### Prometheus Update
```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
```

#### Grafana Update
```bash
#!/bin/bash
# update-monitoring.sh

# Backup dashboards
./scripts/backup-dashboards.sh

# Update monitoring stack
docker-compose -f docker-compose.monitoring.yml down
docker-compose -f docker-compose.monitoring.yml pull
docker-compose -f docker-compose.monitoring.yml up -d

# Restore dashboards
./scripts/restore-dashboards.sh
```

### Database Updates

#### Schema Migrations
```typescript
// migrations/20240321150000_add_new_fields.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('transactions', (table) => {
        table.string('new_field').nullable();
        table.index(['new_field']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('transactions', (table) => {
        table.dropColumn('new_field');
    });
}
```

#### Data Migration
```typescript
// migrations/20240321150001_migrate_data.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const records = await knex('old_table').select('*');
    
    for (const record of records) {
        await knex('new_table').insert({
            id: record.id,
            transformed_data: transform(record.data)
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex('new_table').truncate();
}
```

## Rollback Procedures

### Contract Rollbacks

#### Proxy Rollback
```solidity
// Rollback script
async function rollbackProxy() {
    const proxyAdmin = await ethers.getContract("ProxyAdmin");
    const proxy = await ethers.getContract("LendingPoolProxy");
    
    // Deploy previous version
    const LendingPoolV1 = await ethers.getContractFactory("LendingPoolV1");
    const implementation = await LendingPoolV1.deploy();
    
    // Rollback to previous version
    await proxyAdmin.upgrade(proxy.address, implementation.address);
}
```

#### State Recovery
```solidity
contract StateRecovery {
    function exportState() external returns (bytes memory) {
        // Export current state
    }
    
    function importState(bytes memory state) external {
        // Import previous state
    }
}

// Recovery script
async function recoverState() {
    const recovery = await ethers.getContract("StateRecovery");
    const state = await recovery.exportState();
    
    // Deploy new contract
    const newContract = await deploy();
    
    // Import state
    await newContract.importState(state);
}
```

### Network Rollbacks

#### Configuration Rollback
```bash
#!/bin/bash
# rollback-network.sh

# Restore configuration
cp config.toml.backup config.toml

# Restore genesis
cp genesis.json.backup genesis.json

# Restart network
docker-compose down
docker-compose up -d
```

#### Data Rollback
```bash
#!/bin/bash
# rollback-data.sh

# Stop services
docker-compose down

# Restore data from backup
tar -xzf chain-data-backup.tar.gz -C /data/chain138/

# Start services
docker-compose up -d

# Verify rollback
./scripts/verify-chain-state.sh
```

### Database Rollbacks

#### Schema Rollback
```bash
#!/bin/bash
# rollback-schema.sh

# Run down migrations
npx knex migrate:down

# Verify database state
npx knex migrate:status
```

#### Data Rollback
```bash
#!/bin/bash
# rollback-data.sh

# Stop application
docker-compose down

# Restore database
pg_restore -h localhost -U admin -d chain138 backup.dump

# Start application
docker-compose up -d
```

## Verification Procedures

### Contract Verification

#### Proxy Verification
```typescript
async function verifyProxy() {
    const proxy = await ethers.getContract("LendingPoolProxy");
    const proxyAdmin = await ethers.getContract("ProxyAdmin");
    
    // Verify implementation
    const implementation = await proxyAdmin.getProxyImplementation(
        proxy.address
    );
    
    // Verify state
    const state = await verifyState(proxy);
    console.log("State verification:", state);
    
    return implementation === expectedImplementation;
}
```

#### State Verification
```typescript
async function verifyState() {
    const contract = await ethers.getContract("LendingPool");
    
    // Verify critical state
    const totalSupply = await contract.totalSupply();
    const reserves = await contract.getReserves();
    
    // Verify user balances
    for (const user of users) {
        const balance = await contract.balanceOf(user);
        console.log(`User ${user} balance:`, balance.toString());
    }
}
```

### Network Verification

#### Node Verification
```bash
#!/bin/bash
# verify-nodes.sh

# Check sync status
for node in $(docker ps -q --filter name=besu); do
    curl -X POST --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' localhost:8545
done

# Verify peer connections
for node in $(docker ps -q --filter name=besu); do
    curl -X POST --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' localhost:8545
done
```

#### Consensus Verification
```bash
#!/bin/bash
# verify-consensus.sh

# Check validator set
curl -X POST --data '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"],"id":1}' localhost:8545

# Check block production
curl -X POST --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' localhost:8545
```

### Infrastructure Verification

#### Service Health Check
```bash
#!/bin/bash
# verify-services.sh

# Check container status
docker-compose ps

# Check service health
for service in $(docker-compose config --services); do
    curl -f localhost:${service_port}/health || exit 1
done
```

#### Monitoring Verification
```bash
#!/bin/bash
# verify-monitoring.sh

# Check Prometheus targets
curl localhost:9090/api/v1/targets

# Check Grafana dashboards
curl -u admin:admin localhost:3000/api/dashboards

# Check AlertManager
curl localhost:9093/api/v2/alerts
``` 