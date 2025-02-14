# Security Audit Guide

## Overview

### Audit Scope
1. Smart Contracts
   - Core protocol contracts
   - DeFi protocol integrations
   - Bridge contracts
   - Governance contracts

2. Infrastructure
   - Node configuration
   - Network security
   - Access controls
   - Monitoring systems

3. APIs and Services
   - Authentication mechanisms
   - Rate limiting
   - Input validation
   - Error handling

## Smart Contract Security

### Automated Analysis

#### Static Analysis
```bash
# Run Slither
slither contracts/ \
  --detect reentrancy,uninitialized-state,unprotected-functions \
  --exclude naming-convention,solc-version

# Run Mythril
myth analyze contracts/Protocol.sol \
  --execution-timeout 300 \
  --max-depth 50

# Run Echidna
echidna-test contracts/Protocol.sol \
  --config echidna.config.yml \
  --corpus-dir corpus \
  --test-mode assertion
```

#### Continuous Security
```yaml
# .github/workflows/security.yml
name: Security Analysis

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run Slither
        uses: crytic/slither-action@v0.1.0
        
      - name: Run Mythril
        uses: consensys/mythril-action@v0.1.0
        
      - name: Run Solhint
        run: |
          npm install -g solhint
          solhint 'contracts/**/*.sol'
```

### Manual Review Checklist

#### Access Control
```solidity
// ✓ Use role-based access control
contract SecureProtocol is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "Unauthorized");
        _;
    }
    
    function adminFunction() external onlyRole(ADMIN_ROLE) {
        // Implementation
    }
}

// ✓ Implement timelock for sensitive operations
contract TimelockProtocol {
    mapping(bytes32 => uint256) public operationTimestamps;
    uint256 public constant TIMELOCK_DELAY = 2 days;
    
    function scheduleOperation(bytes32 operationId) external {
        operationTimestamps[operationId] = block.timestamp + TIMELOCK_DELAY;
    }
    
    function executeOperation(bytes32 operationId) external {
        require(
            block.timestamp >= operationTimestamps[operationId],
            "Timelock not expired"
        );
        // Execute operation
    }
}
```

#### State Management
```solidity
// ✓ Check state transitions
contract StateManagement {
    enum State { Inactive, Active, Paused }
    State public currentState;
    
    modifier inState(State requiredState) {
        require(currentState == requiredState, "Invalid state");
        _;
    }
    
    // ✓ Use reentrancy guards
    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
}

// ✓ Implement emergency stops
contract EmergencyProtocol is Pausable {
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
```

#### Value Handling
```solidity
// ✓ Safe math operations
contract SafeOperations {
    using SafeMath for uint256;
    
    // ✓ Check for integer overflow/underflow
    function deposit(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        require(
            totalSupply.add(amount) >= totalSupply,
            "Overflow check"
        );
        totalSupply = totalSupply.add(amount);
    }
    
    // ✓ Handle decimals correctly
    function calculateInterest(
        uint256 principal,
        uint256 rate
    ) internal pure returns (uint256) {
        return principal.mul(rate).div(PRECISION);
    }
}
```

## Infrastructure Security

### Node Security

#### Configuration Audit
```bash
#!/bin/bash
# audit-node-config.sh

# Check permissions
find /opt/chain138 -type f -exec ls -l {} \;

# Check open ports
netstat -tulpn

# Verify TLS configuration
openssl s_client -connect localhost:8545 -tls1_2

# Check process privileges
ps aux | grep besu
```

#### Network Security
```bash
#!/bin/bash
# audit-network.sh

# Check firewall rules
iptables -L

# Scan for open ports
nmap -sS -p- localhost

# Check SSL/TLS configuration
sslyze --regular localhost:8545

# Test rate limiting
ab -n 1000 -c 10 https://localhost:8545/
```

### Monitoring Security

#### Access Audit
```yaml
# prometheus-auth.yml
basic_auth_users:
  admin: $2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5yoK3HHHxZz2

tls_config:
  cert_file: /etc/prometheus/cert.pem
  key_file: /etc/prometheus/key.pem
  client_ca_file: /etc/prometheus/ca.pem
```

#### Metric Security
```yaml
# prometheus-security.yml
rule_files:
  - "security-rules.yml"

scrape_configs:
  - job_name: 'security-metrics'
    metrics_path: '/metrics'
    scheme: 'https'
    tls_config:
      cert_file: /etc/prometheus/cert.pem
      key_file: /etc/prometheus/key.pem
```

## API Security

### Authentication Audit

#### JWT Implementation
```typescript
// jwt-security.ts
import jwt from 'jsonwebtoken';

class JWTSecurity {
  // ✓ Use strong secret
  private readonly secret: string = process.env.JWT_SECRET!;
  
  // ✓ Short expiration time
  private readonly expiresIn: string = '1h';
  
  // ✓ Include necessary claims
  generateToken(userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        type: 'access'
      },
      this.secret,
      { expiresIn: this.expiresIn }
    );
  }
  
  // ✓ Validate token thoroughly
  verifyToken(token: string): any {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'string') {
        throw new Error('Invalid token');
      }
      return decoded;
    } catch (error) {
      throw new Error('Token verification failed');
    }
  }
}
```

#### API Key Security
```typescript
// api-key-security.ts
class APIKeySecurity {
  // ✓ Use strong hashing
  private hashKey(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key)
      .digest('hex');
  }
  
  // ✓ Rate limit by key
  private async checkRateLimit(
    key: string
  ): Promise<boolean> {
    const count = await redis.incr(`ratelimit:${key}`);
    await redis.expire(`ratelimit:${key}`, 60);
    return count <= RATE_LIMIT;
  }
  
  // ✓ Validate API key
  async validateKey(key: string): Promise<boolean> {
    const hashedKey = this.hashKey(key);
    const valid = await db.apiKeys.findOne({ hashedKey });
    if (!valid) return false;
    return this.checkRateLimit(hashedKey);
  }
}
```

### Input Validation

#### Request Validation
```typescript
// validation.ts
import { validate } from 'class-validator';

// ✓ Define strict types
class TransactionRequest {
  @IsEthereumAddress()
  to!: string;
  
  @IsNumberString()
  @Min(0)
  value!: string;
  
  @IsHexadecimal()
  @Length(0, 10000)
  data!: string;
}

// ✓ Validate all inputs
async function validateRequest(
  req: TransactionRequest
): Promise<boolean> {
  const errors = await validate(req);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return true;
}
```

#### SQL Injection Prevention
```typescript
// database.ts
import { QueryBuilder } from 'knex';

class SecureDatabase {
  // ✓ Use parameterized queries
  async findUser(id: string): Promise<User> {
    return this.db
      .select('*')
      .from('users')
      .where({ id })
      .first();
  }
  
  // ✓ Escape dynamic queries
  async searchUsers(
    field: string,
    value: string
  ): Promise<User[]> {
    const validFields = ['username', 'email'];
    if (!validFields.includes(field)) {
      throw new Error('Invalid field');
    }
    
    return this.db
      .select('*')
      .from('users')
      .where(field, value);
  }
}
```

## Security Testing

### Penetration Testing

#### Smart Contract Testing
```typescript
// pentest.ts
describe('Security Tests', () => {
  it('should prevent reentrancy', async () => {
    const attacker = await deployAttacker();
    await expect(
      attacker.attack()
    ).to.be.revertedWith('ReentrancyGuard');
  });
  
  it('should enforce access control', async () => {
    await expect(
      contract.connect(user).adminFunction()
    ).to.be.revertedWith('Unauthorized');
  });
  
  it('should handle edge cases', async () => {
    await expect(
      contract.deposit(MAX_UINT256)
    ).to.be.revertedWith('Overflow check');
  });
});
```

#### API Testing
```typescript
// api-security.test.ts
describe('API Security', () => {
  it('should reject invalid tokens', async () => {
    const response = await request(app)
      .get('/api/v1/secure')
      .set('Authorization', 'Bearer invalid');
      
    expect(response.status).to.equal(401);
  });
  
  it('should prevent SQL injection', async () => {
    const response = await request(app)
      .get('/api/v1/users')
      .query({ username: "' OR '1'='1" });
      
    expect(response.status).to.equal(400);
  });
  
  it('should rate limit requests', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/v1/users');
    }
    
    const response = await request(app)
      .get('/api/v1/users');
      
    expect(response.status).to.equal(429);
  });
});
```

## Audit Reports

### Report Template
```markdown
# Security Audit Report

## Executive Summary
- Audit Date: YYYY-MM-DD
- Scope: [Contract/System Name]
- Version: X.Y.Z

## Findings Summary
| Severity | Count |
|----------|-------|
| Critical  | 0     |
| High     | 0     |
| Medium   | 0     |
| Low      | 0     |

## Detailed Findings

### [Finding Title]
- Severity: [Critical/High/Medium/Low]
- Location: [File:Line]
- Description: [Details]
- Impact: [Impact Analysis]
- Recommendation: [Fix Suggestion]
- Status: [Open/Fixed]

## Recommendations
1. Short-term fixes
2. Long-term improvements
3. Best practices to implement

## Appendix
- Tools used
- Methodology
- Test coverage
```

### Continuous Monitoring

#### Security Metrics
```typescript
// security-metrics.ts
const securityMetrics = {
  failedLogins: new Counter({
    name: 'failed_login_attempts',
    help: 'Number of failed login attempts'
  }),
  
  authErrors: new Counter({
    name: 'authentication_errors',
    help: 'Number of authentication errors'
  }),
  
  securityIncidents: new Counter({
    name: 'security_incidents',
    help: 'Number of security incidents'
  })
};

// Monitor security events
async function monitorSecurity(): Promise<void> {
  // Monitor authentication
  app.use((req, res, next) => {
    if (req.authError) {
      securityMetrics.authErrors.inc();
    }
    next();
  });
  
  // Monitor API usage
  app.use((req, res, next) => {
    if (res.statusCode === 401 || res.statusCode === 403) {
      securityMetrics.failedLogins.inc();
    }
    next();
  });
}
```

#### Alert Rules
```yaml
# security-alerts.yml
groups:
  - name: security_alerts
    rules:
      - alert: HighFailedLogins
        expr: rate(failed_login_attempts[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High rate of failed logins
          
      - alert: AuthenticationSpike
        expr: rate(authentication_errors[5m]) > 20
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Spike in authentication errors
          
      - alert: SecurityIncident
        expr: security_incidents > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Security incident detected
``` 