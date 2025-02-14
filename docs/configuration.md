# Configuration Guide

## Environment Configuration

Example `.env` file:
```env
# Network Configuration
CHAIN_138_RPC=http://localhost:8545
CHAIN_ID=138
NETWORK_NAME=Chain138

# Node Keys
PRIVATE_KEY=<your-private-key>
NODE_KEY=<your-node-key>

# IBFT Configuration
VALIDATOR_COUNT=4
BLOCK_TIME=2
EPOCH_SIZE=30000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chain138
DB_USER=admin
DB_PASSWORD=<your-password>

# Monitoring
ALERT_WEBHOOK_URL=<slack-webhook-url>
MONITOR_INTERVAL=60
LOG_LEVEL=info

# API Keys
ALCHEMY_API_KEY=<your-key>
INFURA_API_KEY=<your-key>
CHAINLINK_NODE_API_KEY=<your-key>
```

## Blockchain Configuration

### Network Configuration (config.toml)
```toml
# Network Configuration
data-path="data/chain138/database"
node-private-key-file="data/chain138/key"

# JSON-RPC Configuration
rpc-http-enabled=true
rpc-http-host="0.0.0.0"
rpc-http-port=8545
rpc-http-api=["ETH","NET","IBFT"]

# P2P Configuration
p2p-enabled=true
discovery-enabled=true

# Metrics Configuration
metrics-enabled=true
metrics-host="0.0.0.0"
metrics-port=9545
```

### Genesis Configuration
```json
{
  "config": {
    "chainId": 138,
    "ibft2": {
      "blockperiodseconds": 2,
      "epochlength": 30000,
      "requesttimeoutseconds": 4
    }
  },
  "nonce": "0x0",
  "timestamp": "0x0",
  "gasLimit": "0x1fffffffffffff",
  "difficulty": "0x1",
  "alloc": {}
}
```

## Privacy Configuration

### Tessera Configuration
```json
{
  "useWhiteList": false,
  "jdbc": {
    "url": "jdbc:postgresql://postgres:5432/tessera",
    "username": "admin",
    "password": "${DB_PASSWORD}"
  },
  "serverConfigs": [
    {
      "app": "Q2T",
      "enabled": true,
      "serverAddress": "http://tessera:9102",
      "communicationType": "REST"
    }
  ],
  "keys": {
    "keyData": [
      {
        "privateKeyPath": "/data/tm.key",
        "publicKeyPath": "/data/tm.pub"
      }
    ]
  }
}
```

## Monitoring Configuration

### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'besu'
    static_configs:
      - targets: ['localhost:9545']
```

### Alert Rules
```yaml
groups:
  - name: chain138_alerts
    rules:
      - alert: NodeDown
        expr: up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Node {{ $labels.instance }} down"
```

### AlertManager Configuration
```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '${ALERT_WEBHOOK_URL}'

route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
```

## Bridge Configuration

### CCIP Configuration
```json
{
  "chain138": {
    "router": {
      "address": "",
      "confirmations": 3,
      "gasLimit": 2000000
    },
    "lockAndMint": {
      "enabled": true,
      "lockVault": "",
      "tokenFactory": ""
    }
  }
}
```

## DeFi Configuration

### Protocol Settings
```json
{
  "aave": {
    "enabled": true,
    "version": "v3",
    "config": {
      "lendingPool": "",
      "addressProvider": "",
      "dataProvider": ""
    }
  },
  "maker": {
    "enabled": true,
    "config": {
      "cdpManager": "",
      "vat": "",
      "jug": ""
    }
  }
}
```

## Docker Configuration

### Docker Compose
```yaml
version: '3.8'
services:
  besu-node:
    image: hyperledger/besu:latest
    volumes:
      - ./data/chain138:/opt/besu/data
    ports:
      - "8545:8545"
    environment:
      - BESU_OPTS=-Xmx4g

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/config/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./monitoring/data/grafana:/var/lib/grafana
    ports:
      - "3000:3000"
```

## Graph Node Configuration

### Configuration
```toml
[general]
query = "127.0.0.1:8000"
ethereum = "chain138:http://besu-node:8545"
ipfs = "ipfs:5001"

[store]
[store.primary]
connection = "postgresql://admin:${DB_PASSWORD}@postgres:5432/chain138"
pool_size = 10
```

## Security Configuration

### TLS Configuration
```toml
tls-keystore-file="/path/to/keystore.jks"
tls-keystore-password-file="/path/to/keystore.password"
tls-trust-store-file="/path/to/truststore.jks"
tls-trust-store-password-file="/path/to/truststore.password"
```

### Permissioning Configuration
```json
{
  "nodes": {
    "permissioningMode": "hybrid",
    "allowlist": [],
    "validators": []
  },
  "accounts": {
    "permissioningMode": "hybrid",
    "allowlist": [],
    "adminAccounts": []
  }
}
``` 