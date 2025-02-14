# Protocol Integration Cookbook

## Overview

### Integration Process
1. Protocol Assessment
2. Development & Testing
3. Security Review
4. Deployment
5. Monitoring & Maintenance

### Prerequisites
- Smart contract development experience
- Understanding of DeFi protocols
- Familiarity with Chain 138 architecture
- Testing and security tools

## Protocol Assessment

### Technical Assessment

#### Protocol Analysis
```typescript
// protocol-analysis.ts
interface ProtocolAssessment {
  name: string;
  version: string;
  components: Component[];
  dependencies: Dependency[];
  risks: Risk[];
  requirements: Requirement[];
}

interface Component {
  name: string;
  type: 'core' | 'peripheral' | 'oracle';
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
}

// Example assessment
const aaveAssessment: ProtocolAssessment = {
  name: 'Aave',
  version: 'v3',
  components: [
    {
      name: 'LendingPool',
      type: 'core',
      complexity: 'high',
      dependencies: ['Oracle', 'TokenVault']
    }
  ],
  dependencies: [
    { name: 'Chainlink', version: '2.0' }
  ],
  risks: [
    { type: 'economic', severity: 'high' }
  ],
  requirements: [
    { type: 'storage', value: '100GB' }
  ]
};
```

#### Integration Requirements
```yaml
# integration-requirements.yml
technical:
  contracts:
    - name: Core
      audit_required: true
      upgrade_mechanism: true
    - name: Periphery
      audit_required: false
      upgrade_mechanism: false
      
  infrastructure:
    compute:
      min_cpu: 4
      min_memory: 8GB
    storage:
      capacity: 100GB
      type: SSD
      
  monitoring:
    metrics_required: true
    alert_required: true
    dashboard_required: true
```

### Security Assessment

#### Risk Assessment
```typescript
// risk-assessment.ts
interface SecurityRisk {
  category: 'smart-contract' | 'economic' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  impact: string;
  mitigation: string;
}

const securityRisks: SecurityRisk[] = [
  {
    category: 'smart-contract',
    severity: 'critical',
    likelihood: 'medium',
    impact: 'Potential fund loss through reentrancy',
    mitigation: 'Implement reentrancy guards'
  },
  {
    category: 'economic',
    severity: 'high',
    likelihood: 'medium',
    impact: 'Market manipulation through flash loans',
    mitigation: 'Implement price impact limits'
  }
];
```

#### Security Controls
```solidity
// SecurityControls.sol
contract SecurityControls {
    // Access control
    mapping(address => bool) public authorized;
    
    // Circuit breaker
    bool public paused;
    
    // Value limits
    uint256 public maxTransactionValue;
    
    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Unauthorized");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier withinLimits(uint256 value) {
        require(value <= maxTransactionValue, "Exceeds limit");
        _;
    }
}
```

## Development Guide

### Smart Contract Development

#### Contract Templates
```solidity
// BaseProtocol.sol
contract BaseProtocol is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    
    // State variables
    mapping(address => uint256) private balances;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    
    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function deposit(uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        // Implementation
    }
}
```

#### Integration Patterns
```solidity
// IntegrationPatterns.sol
contract IntegrationPatterns {
    // Proxy pattern for upgrades
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    // Adapter pattern for compatibility
    contract ProtocolAdapter {
        IExternalProtocol public immutable protocol;
        
        function adapt(bytes calldata data) external {
            // Transform and forward call
            protocol.execute(transform(data));
        }
    }
    
    // Factory pattern for deployment
    contract ProtocolFactory {
        function createInstance(bytes calldata config)
            external
            returns (address)
        {
            // Deploy new instance
            return address(new Protocol(config));
        }
    }
}
```

### Testing Framework

#### Unit Tests
```typescript
// protocol.test.ts
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Protocol', () => {
  let protocol: Protocol;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  
  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    
    const Protocol = await ethers.getContractFactory('Protocol');
    protocol = await Protocol.deploy();
    await protocol.deployed();
    
    await protocol.initialize();
  });
  
  describe('Core functionality', () => {
    it('should deposit correctly', async () => {
      const amount = ethers.utils.parseEther('1.0');
      
      await expect(protocol.connect(user).deposit(amount))
        .to.emit(protocol, 'Deposit')
        .withArgs(user.address, amount);
        
      expect(await protocol.balanceOf(user.address))
        .to.equal(amount);
    });
  });
});
```

#### Integration Tests
```typescript
// integration.test.ts
describe('Protocol Integration', () => {
  let protocol: Protocol;
  let external: ExternalProtocol;
  
  beforeEach(async () => {
    // Deploy protocols
    protocol = await deployProtocol();
    external = await deployExternalProtocol();
    
    // Setup integration
    await protocol.setExternalProtocol(external.address);
  });
  
  it('should integrate with external protocol', async () => {
    // Test cross-protocol interaction
    await protocol.interactWithExternal();
    
    // Verify state changes in both protocols
    expect(await protocol.getState()).to.equal(expectedState);
    expect(await external.getState()).to.equal(expectedState);
  });
});
```

### Deployment Process

#### Deployment Scripts
```typescript
// deploy.ts
async function deployProtocol() {
  // Deploy implementation
  const Protocol = await ethers.getContractFactory('Protocol');
  const implementation = await Protocol.deploy();
  await implementation.deployed();
  
  // Deploy proxy
  const Proxy = await ethers.getContractFactory('TransparentUpgradeableProxy');
  const proxy = await Proxy.deploy(
    implementation.address,
    proxyAdmin.address,
    initData
  );
  await proxy.deployed();
  
  // Initialize
  const protocol = Protocol.attach(proxy.address);
  await protocol.initialize();
  
  return protocol;
}
```

#### Configuration Management
```typescript
// config-management.ts
interface ProtocolConfig {
  parameters: {
    maxValue: BigNumber;
    minValue: BigNumber;
    fee: BigNumber;
  };
  integration: {
    externalProtocol: string;
    oracle: string;
  };
  security: {
    admin: string;
    guardian: string;
    timelock: number;
  };
}

async function configureProtocol(
  protocol: Contract,
  config: ProtocolConfig
): Promise<void> {
  // Set parameters
  await protocol.setParameters(
    config.parameters.maxValue,
    config.parameters.minValue,
    config.parameters.fee
  );
  
  // Configure integration
  await protocol.setExternalProtocol(
    config.integration.externalProtocol
  );
  await protocol.setOracle(config.integration.oracle);
  
  // Setup security
  await protocol.setAdmin(config.security.admin);
  await protocol.setGuardian(config.security.guardian);
  await protocol.setTimelock(config.security.timelock);
}
```

## Monitoring Setup

### Metrics Collection

#### Protocol Metrics
```typescript
// protocol-metrics.ts
const protocolMetrics = {
  tvl: new Gauge({
    name: 'protocol_tvl',
    help: 'Total Value Locked in protocol'
  }),
  
  transactions: new Counter({
    name: 'protocol_transactions_total',
    help: 'Total number of transactions'
  }),
  
  gasUsed: new Histogram({
    name: 'protocol_gas_used',
    help: 'Gas used by protocol operations',
    buckets: [50000, 100000, 200000, 500000]
  })
};

async function collectMetrics(): Promise<void> {
  // Collect TVL
  const tvl = await protocol.getTVL();
  protocolMetrics.tvl.set(tvl.toNumber());
  
  // Collect transaction count
  const txCount = await protocol.getTransactionCount();
  protocolMetrics.transactions.inc(txCount);
}
```

#### Alert Configuration
```yaml
# protocol-alerts.yml
groups:
  - name: protocol_alerts
    rules:
      - alert: HighTVLChange
        expr: abs(
          (protocol_tvl - protocol_tvl offset 1h)
          / protocol_tvl offset 1h
        ) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Large TVL change detected"
          
      - alert: HighGasUsage
        expr: protocol_gas_used > 500000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High gas usage detected"
```

### Performance Monitoring

#### Performance Metrics
```typescript
// performance-metrics.ts
const performanceMetrics = {
  operationLatency: new Histogram({
    name: 'protocol_operation_latency_seconds',
    help: 'Operation latency in seconds',
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  
  errorRate: new Counter({
    name: 'protocol_errors_total',
    help: 'Total number of errors'
  })
};

async function measurePerformance(
  operation: () => Promise<void>
): Promise<void> {
  const start = performance.now();
  
  try {
    await operation();
    const duration = (performance.now() - start) / 1000;
    performanceMetrics.operationLatency.observe(duration);
  } catch (error) {
    performanceMetrics.errorRate.inc();
    throw error;
  }
}
```

## Maintenance Guide

### Protocol Updates

#### Parameter Updates
```solidity
// ParameterManager.sol
contract ParameterManager {
    struct Parameters {
        uint256 maxValue;
        uint256 minValue;
        uint256 fee;
    }
    
    Parameters public parameters;
    
    event ParametersUpdated(
        uint256 maxValue,
        uint256 minValue,
        uint256 fee
    );
    
    function updateParameters(Parameters calldata newParams)
        external
        onlyAdmin
    {
        require(
            validateParameters(newParams),
            "Invalid parameters"
        );
        
        parameters = newParams;
        emit ParametersUpdated(
            newParams.maxValue,
            newParams.minValue,
            newParams.fee
        );
    }
}
```

#### Contract Upgrades
```typescript
// upgrade-protocol.ts
async function upgradeProtocol(): Promise<void> {
  // Deploy new implementation
  const ProtocolV2 = await ethers.getContractFactory('ProtocolV2');
  const implementation = await ProtocolV2.deploy();
  await implementation.deployed();
  
  // Prepare upgrade
  const proxy = await ethers.getContract('ProtocolProxy');
  const proxyAdmin = await ethers.getContract('ProxyAdmin');
  
  // Execute upgrade
  await proxyAdmin.upgrade(proxy.address, implementation.address);
  
  // Verify upgrade
  const protocol = ProtocolV2.attach(proxy.address);
  await verifyUpgrade(protocol);
}
```

### Emergency Procedures

#### Emergency Actions
```solidity
// EmergencyActions.sol
contract EmergencyActions {
    // Circuit breaker
    function pause() external onlyGuardian {
        _pause();
        emit ProtocolPaused(msg.sender);
    }
    
    // Emergency withdrawal
    function emergencyWithdraw() external {
        require(paused(), "Not paused");
        uint256 balance = balances[msg.sender];
        require(balance > 0, "No balance");
        
        balances[msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, balance);
        
        emit EmergencyWithdrawal(msg.sender, balance);
    }
    
    // Parameter reset
    function resetParameters() external onlyAdmin {
        parameters = defaultParameters;
        emit ParametersReset();
    }
}
```

#### Recovery Procedures
```typescript
// recovery-procedures.ts
async function recoverProtocol(): Promise<void> {
  // Pause protocol
  await protocol.pause();
  
  try {
    // Export state
    const state = await protocol.exportState();
    
    // Deploy recovery contract
    const recovery = await deployRecoveryContract();
    
    // Import state
    await recovery.importState(state);
    
    // Verify recovery
    await verifyRecovery(recovery);
    
    // Transfer ownership
    await recovery.transferOwnership(admin);
  } catch (error) {
    console.error('Recovery failed:', error);
    // Implement fallback procedure
  }
}
```

## Best Practices

### Code Quality

#### Style Guide
```solidity
// StyleGuide.sol
contract StyleGuide {
    // Constants at top
    uint256 private constant MAX_VALUE = 1000;
    bytes32 private constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // State variables grouped by purpose
    mapping(address => uint256) private balances;
    mapping(address => bool) private whitelist;
    
    // Events with indexed parameters
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    
    // Modifiers before functions
    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }
    
    // Functions grouped by visibility/purpose
    function externalFunction()
        external
        onlyWhitelisted
        returns (uint256)
    {
        // Implementation
    }
    
    function internalFunction()
        internal
        pure
        returns (uint256)
    {
        // Implementation
    }
}
```

#### Documentation Standards
```solidity
/// @title Protocol Interface
/// @notice Provides interface for protocol interactions
/// @dev Implement this interface for protocol integration
interface IProtocol {
    /// @notice Deposits tokens into the protocol
    /// @param amount Amount of tokens to deposit
    /// @return shares Number of shares minted
    /// @dev Requires prior token approval
    function deposit(uint256 amount)
        external
        returns (uint256 shares);
        
    /// @notice Withdraws tokens from the protocol
    /// @param shares Number of shares to burn
    /// @return amount Amount of tokens withdrawn
    function withdraw(uint256 shares)
        external
        returns (uint256 amount);
}
```

### Security Practices

#### Access Control
```solidity
// AccessControl.sol
contract AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    
    EnumerableSet.AddressSet private admins;
    EnumerableSet.AddressSet private operators;
    
    modifier onlyAdmin() {
        require(admins.contains(msg.sender), "Not admin");
        _;
    }
    
    modifier onlyOperator() {
        require(operators.contains(msg.sender), "Not operator");
        _;
    }
    
    function addAdmin(address account) external onlyAdmin {
        admins.add(account);
    }
    
    function removeAdmin(address account) external onlyAdmin {
        admins.remove(account);
    }
}
```

#### Input Validation
```solidity
// InputValidation.sol
contract InputValidation {
    function validateAddress(address account)
        internal
        pure
        returns (bool)
    {
        return account != address(0);
    }
    
    function validateAmount(uint256 amount)
        internal
        view
        returns (bool)
    {
        return amount > 0 && amount <= maxAmount;
    }
    
    function validateParameters(Parameters memory params)
        internal
        pure
        returns (bool)
    {
        return
            params.minValue < params.maxValue &&
            params.fee <= MAX_FEE;
    }
}
``` 