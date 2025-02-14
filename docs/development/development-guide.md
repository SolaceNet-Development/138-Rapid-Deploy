# Development Guide

## Development Environment Setup

### Prerequisites
1. Install required tools:
   ```bash
   # Install Node.js 16+
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install Go 1.19+
   wget https://golang.org/dl/go1.19.linux-amd64.tar.gz
   sudo tar -C /usr/local -xzf go1.19.linux-amd64.tar.gz
   export PATH=$PATH:/usr/local/go/bin

   # Install Docker & Docker Compose
   curl -fsSL https://get.docker.com | sudo bash
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. Clone repository:
   ```bash
   git clone https://github.com/yourusername/chain-138-infrastructure.git
   cd chain-138-infrastructure
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Development Configuration
1. Create development environment:
   ```bash
   cp .env.example .env.development
   ```

2. Configure environment variables:
   ```bash
   # .env.development
   CHAIN_138_RPC=http://localhost:8545
   CHAIN_ID=138
   NETWORK_NAME=Chain138Dev
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=chain138_dev
   DB_USER=dev
   DB_PASSWORD=dev_password
   ```

### Local Development Stack
1. Start development services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. Initialize development chain:
   ```bash
   ./scripts/setup-dev-chain.sh
   ```

## Development Workflow

### Code Organization
```
.
├── contracts/           # Smart contracts
│   ├── core/           # Core protocol contracts
│   ├── defi/           # DeFi protocol contracts
│   └── test/           # Contract tests
├── src/                # Application source
│   ├── api/            # API implementations
│   ├── services/       # Business logic
│   └── utils/          # Utilities
├── scripts/            # Development scripts
└── test/               # Integration tests
```

### Coding Standards

#### TypeScript Style Guide
```typescript
// Use interfaces for object definitions
interface User {
  id: string;
  name: string;
  roles: string[];
}

// Use enums for fixed values
enum TransactionStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED'
}

// Use type guards
function isUser(obj: any): obj is User {
  return 'id' in obj && 'name' in obj && 'roles' in obj;
}

// Use async/await
async function getUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}
```

#### Solidity Style Guide
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Example Contract
/// @notice This is an example contract showing style guidelines
/// @dev Inherit from OpenZeppelin contracts for standard functionality
contract ExampleContract is Ownable, ReentrancyGuard {
    // State variables
    uint256 private constant MAX_VALUE = 1000;
    mapping(address => uint256) private balances;
    
    // Events
    event ValueUpdated(address indexed user, uint256 newValue);
    
    // Modifiers
    modifier validValue(uint256 value) {
        require(value <= MAX_VALUE, "Value exceeds maximum");
        _;
    }
    
    // Functions
    function updateValue(uint256 value) 
        external 
        validValue(value) 
        nonReentrant 
    {
        balances[msg.sender] = value;
        emit ValueUpdated(msg.sender, value);
    }
}
```

### Testing

#### Unit Tests
```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ExampleContract', () => {
  let contract;
  let owner;
  let user;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory('ExampleContract');
    contract = await Contract.deploy();
    await contract.deployed();
  });

  it('should update value', async () => {
    const value = 100;
    await contract.connect(user).updateValue(value);
    expect(await contract.balances(user.address)).to.equal(value);
  });

  it('should revert on invalid value', async () => {
    const value = 2000; // Exceeds MAX_VALUE
    await expect(
      contract.connect(user).updateValue(value)
    ).to.be.revertedWith('Value exceeds maximum');
  });
});
```

#### Integration Tests
```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { setupTestEnvironment } from '../test/helpers';

describe('Protocol Integration', () => {
  let env;
  
  before(async () => {
    env = await setupTestEnvironment();
  });

  it('should handle complete workflow', async () => {
    // Setup
    const { lending, dex, bridge } = env.protocols;
    const amount = ethers.utils.parseEther('1.0');
    
    // Execute workflow
    await lending.deposit(amount);
    await dex.swap(amount);
    await bridge.transfer(amount);
    
    // Verify state
    expect(await lending.getBalance()).to.equal(0);
    expect(await dex.getBalance()).to.equal(amount);
  });
});
```

### Debugging

#### Contract Debugging
1. Use Hardhat console:
   ```solidity
   import "hardhat/console.sol";

   contract Debuggable {
       function complexOperation() external {
           console.log("Starting operation");
           // ... code ...
           console.log("Operation completed");
       }
   }
   ```

2. Use events for state tracking:
   ```solidity
   event StateChanged(
       address indexed user,
       uint256 oldValue,
       uint256 newValue
   );

   function updateState(uint256 newValue) external {
       uint256 oldValue = state[msg.sender];
       state[msg.sender] = newValue;
       emit StateChanged(msg.sender, oldValue, newValue);
   }
   ```

#### Application Debugging
1. Use debug logging:
   ```typescript
   import debug from 'debug';

   const log = debug('app:service');

   async function processTransaction(tx: Transaction) {
     log('Processing transaction:', tx.hash);
     try {
       const result = await processTx(tx);
       log('Transaction processed:', result);
       return result;
     } catch (error) {
       log('Transaction failed:', error);
       throw error;
     }
   }
   ```

2. Use performance monitoring:
   ```typescript
   import { performance } from 'perf_hooks';

   async function monitoredOperation() {
     const start = performance.now();
     try {
       const result = await operation();
       const duration = performance.now() - start;
       console.log(`Operation took ${duration}ms`);
       return result;
     } catch (error) {
       const duration = performance.now() - start;
       console.error(`Operation failed after ${duration}ms:`, error);
       throw error;
     }
   }
   ```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Run tests
        run: npm test
        
      - name: Run coverage
        run: npm run coverage
        
  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: ./scripts/deploy-staging.sh
        
  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./scripts/deploy-production.sh
```

### Code Quality Checks

#### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': 'warn'
  }
};
```

#### Prettier Configuration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Deployment

#### Staging Deployment
```bash
#!/bin/bash
# scripts/deploy-staging.sh

set -e

# Load environment variables
source .env.staging

# Deploy contracts
npx hardhat run scripts/deploy-all.ts --network staging

# Deploy infrastructure
docker-compose -f docker-compose.staging.yml up -d

# Run migrations
npm run migrate:staging

# Verify deployment
./scripts/verify-deployment.sh staging
```

#### Production Deployment
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

# Load environment variables
source .env.production

# Deploy contracts with timelock
npx hardhat run scripts/deploy-timelock.ts --network production

# Deploy infrastructure with high availability
docker-compose -f docker-compose.production.yml up -d

# Run migrations with safety checks
npm run migrate:production

# Verify deployment and run security checks
./scripts/verify-deployment.sh production
./scripts/security-check.sh
```

## Best Practices

### Security

#### Contract Security
1. Use OpenZeppelin contracts
2. Implement access control
3. Add emergency stops
4. Validate inputs
5. Use SafeMath for math operations
6. Add events for important state changes

#### API Security
1. Implement rate limiting
2. Use input validation
3. Implement proper authentication
4. Use HTTPS
5. Implement request signing
6. Add audit logging

### Performance

#### Contract Optimization
1. Minimize storage usage
2. Batch operations
3. Use events instead of storage when possible
4. Optimize gas usage
5. Use view functions for reads

#### API Optimization
1. Implement caching
2. Use connection pooling
3. Implement request batching
4. Add response compression
5. Use proper indexing

### Error Handling

#### Contract Errors
```solidity
// Custom errors
error InvalidValue(uint256 value);
error Unauthorized(address caller);

function setValue(uint256 value) external {
    if (value > MAX_VALUE) {
        revert InvalidValue(value);
    }
    if (!hasRole(ADMIN_ROLE, msg.sender)) {
        revert Unauthorized(msg.sender);
    }
    // ... implementation ...
}
```

#### API Errors
```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

function handleError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new ApiError(500, 'INTERNAL_ERROR', error.message);
  }
  
  throw new ApiError(500, 'UNKNOWN_ERROR', 'An unknown error occurred');
}
```

## Documentation

### Code Documentation

#### Contract Documentation
```solidity
/// @title Lending Pool
/// @notice Manages lending and borrowing operations
/// @dev Implements EIP-4626 tokenized vault standard
contract LendingPool is ERC4626, Pausable {
    /// @notice Emitted when a user deposits assets
    /// @param user The address of the user
    /// @param assets The amount of assets deposited
    /// @param shares The amount of shares minted
    event Deposit(
        address indexed user,
        uint256 assets,
        uint256 shares
    );
    
    /// @notice Deposits assets into the lending pool
    /// @param assets The amount of assets to deposit
    /// @param receiver The receiver of the shares
    /// @return shares The amount of shares minted
    function deposit(
        uint256 assets,
        address receiver
    ) 
        public 
        override 
        returns (uint256 shares) 
    {
        // ... implementation ...
    }
}
```

#### API Documentation
```typescript
/**
 * Manages user transactions in the system
 * @class TransactionManager
 */
class TransactionManager {
  /**
   * Creates a new transaction
   * @param {CreateTransactionDto} data - Transaction data
   * @returns {Promise<Transaction>} Created transaction
   * @throws {ApiError} If validation fails
   */
  async createTransaction(
    data: CreateTransactionDto
  ): Promise<Transaction> {
    // ... implementation ...
  }
}
```

### API Documentation

#### OpenAPI Specification
```yaml
# api.yaml
openapi: 3.0.0
info:
  title: Chain 138 API
  version: 1.0.0
paths:
  /transactions:
    post:
      summary: Create transaction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTransaction'
      responses:
        '200':
          description: Transaction created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Transaction'
components:
  schemas:
    Transaction:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
          enum: [PENDING, COMPLETED, FAILED]
```

## Maintenance

### Database Migrations
```typescript
// migrations/20240321150000_create_transactions.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary();
    table.string('status').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('transactions');
}
```

### Monitoring
```typescript
// monitoring.ts
import { Gauge, Counter } from 'prom-client';

export const metrics = {
  transactionCount: new Counter({
    name: 'transactions_total',
    help: 'Total number of transactions'
  }),
  
  processingTime: new Gauge({
    name: 'transaction_processing_seconds',
    help: 'Transaction processing time'
  })
};

export async function monitorTransaction(
  fn: () => Promise<void>
): Promise<void> {
  const start = process.hrtime();
  
  try {
    await fn();
    metrics.transactionCount.inc();
  } finally {
    const [seconds, nanoseconds] = process.hrtime(start);
    metrics.processingTime.set(seconds + nanoseconds / 1e9);
  }
}
```

### Logging
```typescript
// logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```