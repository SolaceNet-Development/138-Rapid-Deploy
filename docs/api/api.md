# API Documentation

## JSON-RPC API

### Blockchain API

#### Node Information
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "eth_nodeInfo",
  "params": [],
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "enode": "...",
    "listenAddr": "...",
    "name": "besu/v1.0.0",
    "id": "...",
    "ports": {
      "discovery": 30303,
      "listener": 30303
    },
    "protocols": {
      "eth": {
        "network": 138,
        "difficulty": "0x1",
        "genesis": "0x...",
        "head": "0x..."
      }
    }
  }
}
```

#### Block Information
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "eth_getBlockByNumber",
  "params": ["latest", true],
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "number": "0x1",
    "hash": "0x...",
    "parentHash": "0x...",
    "timestamp": "0x..."
  }
}
```

### Privacy API

#### Create Privacy Group
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "priv_createPrivacyGroup",
  "params": [{
    "addresses": ["0x...", "0x..."],
    "name": "Group 1",
    "description": "Private group for..."
  }],
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x..." // Privacy Group ID
}
```

#### Send Private Transaction
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "eea_sendRawTransaction",
  "params": [{
    "from": "0x...",
    "privateFrom": "0x...",
    "privateFor": ["0x..."],
    "data": "0x..."
  }],
  "id": 1
}
```

### Bridge API

#### Lock Tokens
```json
// Request
POST /api/v1/bridge/lock
Content-Type: application/json

{
  "token": "0x...",
  "amount": "1000000000000000000",
  "recipient": "0x...",
  "destinationChain": 1
}

// Response
{
  "status": "success",
  "transactionHash": "0x...",
  "lockId": "123"
}
```

#### Check Transfer Status
```json
// Request
GET /api/v1/bridge/status/{lockId}

// Response
{
  "status": "completed",
  "sourceTransaction": "0x...",
  "destinationTransaction": "0x...",
  "completionTime": "2024-03-21T15:30:00Z"
}
```

### DeFi API

#### Aave Lending Pool
```json
// Deposit
POST /api/v1/aave/deposit
{
  "asset": "0x...",
  "amount": "1000000000000000000",
  "onBehalfOf": "0x...",
  "referralCode": 0
}

// Borrow
POST /api/v1/aave/borrow
{
  "asset": "0x...",
  "amount": "1000000000000000000",
  "interestRateMode": 2,
  "referralCode": 0
}
```

#### Dodoex Trading
```json
// Get Quote
GET /api/v1/dodo/quote?fromToken=0x...&toToken=0x...&amount=1000000000000000000

// Execute Trade
POST /api/v1/dodo/swap
{
  "fromToken": "0x...",
  "toToken": "0x...",
  "amount": "1000000000000000000",
  "minReturn": "990000000000000000",
  "deadline": 1679420400
}
```

### Monitoring API

#### Metrics
```json
// Get Node Metrics
GET /api/v1/metrics/node

// Response
{
  "blockHeight": 1234567,
  "peers": 10,
  "pendingTransactions": 5,
  "cpuUsage": 45.2,
  "memoryUsage": 3.1
}
```

#### Alerts
```json
// Get Active Alerts
GET /api/v1/alerts/active

// Response
{
  "alerts": [
    {
      "id": "high-cpu-usage",
      "severity": "warning",
      "description": "CPU usage above 80%",
      "startTime": "2024-03-21T15:00:00Z"
    }
  ]
}
```

## WebSocket API

### Subscribe to Events
```javascript
// Request
{
  "jsonrpc": "2.0",
  "method": "eth_subscribe",
  "params": ["newHeads"],
  "id": 1
}

// Response Stream
{
  "jsonrpc": "2.0",
  "method": "eth_subscription",
  "params": {
    "subscription": "0x...",
    "result": {
      "number": "0x...",
      "hash": "0x...",
      "timestamp": "0x..."
    }
  }
}
```

### Subscribe to Logs
```javascript
// Request
{
  "jsonrpc": "2.0",
  "method": "eth_subscribe",
  "params": [
    "logs",
    {
      "address": "0x...",
      "topics": ["0x..."]
    }
  ],
  "id": 1
}
```

## GraphQL API

### Query Schema
```graphql
type Block {
  number: Int!
  hash: String!
  timestamp: Int!
  transactions: [Transaction!]!
}

type Transaction {
  hash: String!
  from: String!
  to: String!
  value: String!
  status: Boolean!
}

type Query {
  block(number: Int): Block
  transaction(hash: String!): Transaction
  blocks(first: Int): [Block!]!
}
```

### Example Queries
```graphql
# Get Latest Block
query {
  block {
    number
    hash
    timestamp
    transactions {
      hash
      from
      to
      value
    }
  }
}

# Get Transaction Details
query {
  transaction(hash: "0x...") {
    from
    to
    value
    status
  }
}
```

## Rate Limits

| API Endpoint | Rate Limit | Time Window |
|--------------|------------|-------------|
| JSON-RPC     | 100 req/s  | Per IP      |
| REST API     | 50 req/s   | Per IP      |
| WebSocket    | 10 conn/s  | Per IP      |
| GraphQL      | 30 req/s   | Per IP      |

## Error Codes

| Code | Description                    | Solution                         |
|------|--------------------------------|----------------------------------|
| 1001 | Invalid parameters             | Check request parameters         |
| 1002 | Unauthorized                   | Verify API key or authentication |
| 1003 | Rate limit exceeded           | Reduce request frequency         |
| 1004 | Node not synced               | Wait for node to sync           |
| 1005 | Contract execution failed     | Check transaction parameters    |

## Authentication

### API Key Authentication
```http
Authorization: Bearer <api-key>
```

### JWT Authentication
```http
Authorization: Bearer <jwt-token>
```

## Webhook Integration

### Register Webhook
```json
POST /api/v1/webhooks/register
{
  "url": "https://your-server.com/webhook",
  "events": ["block", "transaction", "alert"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload
```json
{
  "event": "block",
  "data": {
    "number": 1234567,
    "hash": "0x...",
    "timestamp": 1679420400
  },
  "timestamp": "2024-03-21T15:30:00Z",
  "signature": "..."
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { Chain138Client } from '@chain138/sdk';

const client = new Chain138Client({
  rpcUrl: 'http://localhost:8545',
  apiKey: 'your-api-key'
});

// Get Block
const block = await client.getBlock('latest');

// Send Transaction
const tx = await client.sendTransaction({
  to: '0x...',
  value: '1000000000000000000'
});
```

### Python
```python
from chain138 import Chain138Client

client = Chain138Client(
    rpc_url='http://localhost:8545',
    api_key='your-api-key'
)

# Get Block
block = client.get_block('latest')

# Send Transaction
tx = client.send_transaction(
    to='0x...',
    value='1000000000000000000'
)
``` 