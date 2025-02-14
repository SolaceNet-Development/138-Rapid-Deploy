# API Reference Guide

## Overview

### API Types
1. JSON-RPC API
   - Blockchain interaction
   - Smart contract calls
   - Network status
2. REST API
   - Protocol integration
   - Data queries
   - Management operations
3. WebSocket API
   - Real-time updates
   - Event subscriptions
4. GraphQL API
   - Custom queries
   - Data aggregation

## Authentication

### API Keys
```typescript
// api-auth.ts
interface APIKey {
  key: string;
  permissions: string[];
  rateLimit: number;
  expiresAt: Date;
}

const apiKeyConfig = {
  algorithm: 'HS256',
  expiresIn: '30d',
  issuer: 'chain138'
};
```

### JWT Authentication
```typescript
// jwt-auth.ts
interface JWTConfig {
  secret: string;
  expiresIn: string;
  algorithm: string;
}

const jwtAuth = {
  generateToken(userId: string): string {
    return jwt.sign(
      { sub: userId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  verifyToken(token: string): any {
    return jwt.verify(token, JWT_SECRET);
  }
};
```

## JSON-RPC API

### Blockchain Methods
```typescript
// blockchain-methods.ts
interface RPCRequest {
  jsonrpc: '2.0';
  method: string;
  params: any[];
  id: number;
}

// Example methods
const methods = {
  // Get latest block
  eth_blockNumber: async () => {
    return await web3.eth.getBlockNumber();
  },
  
  // Get transaction
  eth_getTransactionByHash: async (
    txHash: string
  ) => {
    return await web3.eth.getTransaction(txHash);
  }
};
```

### Smart Contract Methods
```typescript
// contract-methods.ts
interface ContractMethod {
  name: string;
  inputs: ABIParameter[];
  outputs: ABIParameter[];
  stateMutability: string;
}

// Example contract call
const contractCall = {
  // Call view function
  async view(
    contract: string,
    method: string,
    params: any[]
  ): Promise<any> {
    return await web3.eth.call({
      to: contract,
      data: encodeMethod(method, params)
    });
  },
  
  // Send transaction
  async send(
    contract: string,
    method: string,
    params: any[]
  ): Promise<string> {
    return await web3.eth.sendTransaction({
      to: contract,
      data: encodeMethod(method, params)
    });
  }
};
```

## REST API

### Protocol Endpoints

#### Lending Protocol
```typescript
// lending-api.ts
interface LendingEndpoints {
  // Get market data
  'GET /v1/markets': {
    response: Market[];
  };
  
  // Get user positions
  'GET /v1/positions/:user': {
    response: Position[];
  };
  
  // Create deposit
  'POST /v1/deposit': {
    request: {
      asset: string;
      amount: string;
    };
    response: Transaction;
  };
}
```

#### DEX Protocol
```typescript
// dex-api.ts
interface DEXEndpoints {
  // Get pool data
  'GET /v1/pools': {
    response: Pool[];
  };
  
  // Get price quote
  'GET /v1/quote': {
    request: {
      tokenIn: string;
      tokenOut: string;
      amount: string;
    };
    response: Quote;
  };
  
  // Create swap
  'POST /v1/swap': {
    request: {
      tokenIn: string;
      tokenOut: string;
      amount: string;
      slippage: number;
    };
    response: Transaction;
  };
}
```

## WebSocket API

### Event Subscriptions

#### Block Updates
```typescript
// block-events.ts
interface BlockSubscription {
  // Subscribe to new blocks
  subscribe(): void;
  
  // Handle new block
  onBlock(block: Block): void;
  
  // Unsubscribe
  unsubscribe(): void;
}

const blockSubscription = {
  subscribe() {
    web3.eth.subscribe('newBlockHeaders')
      .on('data', this.onBlock)
      .on('error', console.error);
  }
};
```

#### Contract Events
```typescript
// contract-events.ts
interface EventSubscription {
  // Subscribe to contract events
  subscribe(
    contract: string,
    event: string
  ): void;
  
  // Handle event
  onEvent(event: Event): void;
  
  // Unsubscribe
  unsubscribe(): void;
}

const eventSubscription = {
  subscribe(contract: string, event: string) {
    const instance = new web3.eth.Contract(
      ABI,
      contract
    );
    
    instance.events[event]()
      .on('data', this.onEvent)
      .on('error', console.error);
  }
};
```

## GraphQL API

### Schema Definition
```graphql
# schema.graphql
type Query {
  # Get protocol data
  protocol(id: ID!): Protocol
  
  # Get market data
  markets(
    first: Int
    skip: Int
    orderBy: MarketOrderBy
  ): [Market!]!
  
  # Get user data
  user(
    id: ID!
    includeHistory: Boolean
  ): User
}

type Protocol {
  id: ID!
  name: String!
  tvl: BigInt!
  markets: [Market!]!
}

type Market {
  id: ID!
  asset: Token!
  tvl: BigInt!
  apy: Float!
}
```

### Query Examples
```graphql
# Example queries
query GetProtocolData {
  protocol(id: "aave") {
    name
    tvl
    markets {
      asset {
        symbol
        decimals
      }
      tvl
      apy
    }
  }
}

query GetUserPositions {
  user(id: $address) {
    positions {
      market {
        asset {
          symbol
        }
      }
      balance
      debt
    }
  }
}
```

## Rate Limiting

### Configuration
```typescript
// rate-limit.ts
interface RateLimit {
  window: number;  // Time window in seconds
  max: number;     // Maximum requests in window
  cost: number;    // Cost per request
}

const rateLimits: Record<string, RateLimit> = {
  public: {
    window: 60,
    max: 100,
    cost: 1
  },
  authenticated: {
    window: 60,
    max: 1000,
    cost: 1
  }
};
```

### Implementation
```typescript
// rate-limiter.ts
class RateLimiter {
  async checkLimit(
    key: string,
    cost: number
  ): Promise<boolean> {
    const current = await redis.get(key);
    if (!current) {
      await redis.setex(key, 60, cost);
      return true;
    }
    
    if (current + cost > MAX_REQUESTS) {
      return false;
    }
    
    await redis.incrby(key, cost);
    return true;
  }
}
```

## Error Handling

### Error Codes
```typescript
// error-codes.ts
enum ErrorCode {
  // Authentication errors
  INVALID_API_KEY = 'AUTH001',
  EXPIRED_TOKEN = 'AUTH002',
  
  // Validation errors
  INVALID_PARAMS = 'VAL001',
  MISSING_FIELDS = 'VAL002',
  
  // Business logic errors
  INSUFFICIENT_FUNDS = 'BUS001',
  MARKET_CLOSED = 'BUS002'
}
```

### Error Responses
```typescript
// error-responses.ts
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}

class APIError extends Error {
  constructor(
    code: ErrorCode,
    message: string,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
  
  toResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}
```

## API Versioning

### Version Control
```typescript
// api-versions.ts
interface APIVersion {
  version: string;
  deprecated: boolean;
  sunset?: Date;
}

const apiVersions: APIVersion[] = [
  {
    version: 'v1',
    deprecated: false
  },
  {
    version: 'v2',
    deprecated: false
  },
  {
    version: 'v0',
    deprecated: true,
    sunset: new Date('2024-12-31')
  }
];
```

### Version Routes
```typescript
// version-routes.ts
interface VersionedRoute {
  path: string;
  version: string;
  handler: RequestHandler;
}

const versionedRoutes: VersionedRoute[] = [
  {
    path: '/markets',
    version: 'v1',
    handler: getMarketsV1
  },
  {
    path: '/markets',
    version: 'v2',
    handler: getMarketsV2
  }
];
```

## Documentation

### OpenAPI Specification
```yaml
# openapi.yml
openapi: 3.0.0
info:
  title: Chain 138 API
  version: 1.0.0
  
paths:
  /v1/markets:
    get:
      summary: Get market data
      parameters:
        - name: asset
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Market data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Market'
```

### API Examples
```typescript
// api-examples.ts
const examples = {
  // Get market data
  getMarkets: {
    request: {
      method: 'GET',
      url: '/v1/markets',
      params: {
        asset: 'ETH'
      }
    },
    response: {
      markets: [
        {
          asset: 'ETH',
          price: '1800.00',
          volume: '1000000'
        }
      ]
    }
  }
};
``` 