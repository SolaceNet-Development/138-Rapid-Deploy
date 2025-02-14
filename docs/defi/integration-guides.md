# Protocol Integration Guides

## Protocol Integration Overview

### Prerequisites
- Node.js 16+
- Hardhat development environment
- Chain 138 testnet access
- Protocol SDK packages

### Integration Process
1. Protocol Assessment
2. Smart Contract Development
3. Testing & Auditing
4. Deployment & Verification
5. Monitoring Setup

## Aave v3 Integration Guide

### Setup
1. Install dependencies:
   ```bash
   npm install @aave/core-v3 @aave/periphery-v3
   ```

2. Configure protocol parameters:
   ```typescript
   const AAVE_CONFIG = {
     LendingPool: {
       reserveFactor: 1000, // 10%
       maxExcessUsageRatio: 8000, // 80%
       optimalUsageRatio: 8000 // 80%
     },
     TokenDistributor: {
       emissionPerSecond: "100000000000000000", // 0.1 tokens per second
       distributionDuration: 7776000 // 90 days
     }
   };
   ```

3. Deploy core contracts:
   ```typescript
   async function deployAaveV3() {
     const LendingPool = await ethers.getContractFactory("LendingPool");
     const pool = await LendingPool.deploy(AAVE_CONFIG.LendingPool);
     
     const TokenDistributor = await ethers.getContractFactory("TokenDistributor");
     const distributor = await TokenDistributor.deploy(
       AAVE_CONFIG.TokenDistributor
     );
     
     return { pool, distributor };
   }
   ```

### Integration Steps
1. Initialize lending pool:
   ```typescript
   await pool.initialize(
     addressProvider.address,
     treasury.address,
     incentivesController.address
   );
   ```

2. Configure markets:
   ```typescript
   for (const market of markets) {
     await pool.initReserve(
       market.token,
       market.aToken,
       market.stableDebtToken,
       market.variableDebtToken,
       market.interestRateStrategy
     );
   }
   ```

3. Setup risk parameters:
   ```typescript
   await pool.configureReserveAsCollateral(
     token.address,
     ltv,
     liquidationThreshold,
     liquidationBonus
   );
   ```

### Monitoring Integration
1. Add Prometheus metrics:
   ```typescript
   // aave-metrics.ts
   export const aaveMetrics = {
     tvl: new Gauge({
       name: 'aave_tvl',
       help: 'Total Value Locked in Aave'
     }),
     utilizationRate: new Gauge({
       name: 'aave_utilization_rate',
       help: 'Utilization rate per asset'
     })
   };
   ```

2. Configure alerts:
   ```yaml
   - alert: AaveHighUtilization
     expr: aave_utilization_rate > 0.95
     for: 15m
     labels:
       severity: warning
     annotations:
       summary: "High utilization in Aave market"
   ```

## Dodoex Integration Guide

### Setup
1. Install dependencies:
   ```bash
   npm install @dodoex/contract-sdk @dodoex/dodo-v2-sdk
   ```

2. Configure protocol:
   ```typescript
   const DODO_CONFIG = {
     feeRate: 3000, // 0.3%
     i: 100000, // Initial price
     k: 0.1 // AMM parameter
   };
   ```

3. Deploy core contracts:
   ```typescript
   async function deployDodoex() {
     const DODOFactory = await ethers.getContractFactory("DODOFactory");
     const factory = await DODOFactory.deploy();
     
     const Router = await ethers.getContractFactory("DODORouter");
     const router = await Router.deploy(factory.address);
     
     return { factory, router };
   }
   ```

### Integration Steps
1. Create liquidity pool:
   ```typescript
   await factory.createDODOPool(
     baseToken.address,
     quoteToken.address,
     baseAmount,
     quoteAmount,
     lpFeeRate,
     i,
     k
   );
   ```

2. Configure trading parameters:
   ```typescript
   await pool.setParameters(
     newI,
     newK,
     newGasPriceLimit
   );
   ```

### Monitoring Integration
1. Add metrics:
   ```typescript
   export const dodoMetrics = {
     poolTVL: new Gauge({
       name: 'dodo_pool_tvl',
       help: 'TVL per pool'
     }),
     tradingVolume: new Counter({
       name: 'dodo_trading_volume',
       help: 'Trading volume'
     })
   };
   ```

## Lido Integration Guide

### Setup
1. Install dependencies:
   ```bash
   npm install @lido-sdk/contracts
   ```

2. Configure staking:
   ```typescript
   const LIDO_CONFIG = {
     withdrawalCredentials: "0x...",
     maxValidatorsPerOperator: 1000,
     minDepositAmount: ethers.utils.parseEther("0.1")
   };
   ```

3. Deploy core contracts:
   ```typescript
   async function deployLido() {
     const Lido = await ethers.getContractFactory("Lido");
     const lido = await Lido.deploy(
       treasury.address,
       oracle.address
     );
     
     return { lido };
   }
   ```

### Integration Steps
1. Initialize staking:
   ```typescript
   await lido.initialize(
     depositContract.address,
     LIDO_CONFIG.withdrawalCredentials
   );
   ```

2. Configure operators:
   ```typescript
   for (const operator of operators) {
     await lido.addOperator(
       operator.address,
       operator.name,
       operator.rewardAddress
     );
   }
   ```

### Monitoring Integration
1. Add metrics:
   ```typescript
   export const lidoMetrics = {
     totalStaked: new Gauge({
       name: 'lido_total_staked',
       help: 'Total ETH staked'
     }),
     operatorPerformance: new Gauge({
       name: 'lido_operator_performance',
       help: 'Operator performance metrics'
     })
   };
   ```

## MakerDAO Integration Guide

### Setup
1. Install dependencies:
   ```bash
   npm install @makerdao/dai
   ```

2. Configure CDP parameters:
   ```typescript
   const MAKER_CONFIG = {
     debtCeiling: ethers.utils.parseEther("1000000"),
     minVaultDebt: ethers.utils.parseEther("100"),
     liquidationRatio: 15000, // 150%
     stabilityFee: 1000000000627937192491029810 // 2% APR
   };
   ```

3. Deploy core contracts:
   ```typescript
   async function deployMaker() {
     const Vat = await ethers.getContractFactory("Vat");
     const vat = await Vat.deploy();
     
     const Jug = await ethers.getContractFactory("Jug");
     const jug = await Jug.deploy(vat.address);
     
     return { vat, jug };
   }
   ```

### Integration Steps
1. Initialize core:
   ```typescript
   await vat.initialize();
   await jug.initialize();
   ```

2. Configure collateral:
   ```typescript
   await vat.initializeCollateralType(
     collateralType,
     MAKER_CONFIG.debtCeiling,
     MAKER_CONFIG.liquidationRatio
   );
   ```

### Monitoring Integration
1. Add metrics:
   ```typescript
   export const makerMetrics = {
     totalDebt: new Gauge({
       name: 'maker_total_debt',
       help: 'Total DAI debt'
     }),
     collateralRatio: new Gauge({
       name: 'maker_collateral_ratio',
       help: 'System collateral ratio'
     })
   };
   ```

## Testing & Verification

### Unit Tests
```typescript
describe("Protocol Integration", () => {
  it("should initialize correctly", async () => {
    // Test implementation
  });
  
  it("should handle operations correctly", async () => {
    // Test implementation
  });
  
  it("should enforce security parameters", async () => {
    // Test implementation
  });
});
```

### Integration Tests
```typescript
describe("Cross-Protocol Integration", () => {
  it("should handle protocol interactions", async () => {
    // Test implementation
  });
  
  it("should maintain system stability", async () => {
    // Test implementation
  });
});
```

### Security Considerations
1. Access Control
   ```solidity
   modifier onlyAuthorized() {
     require(hasRole(AUTHORIZED_ROLE, msg.sender), "Not authorized");
     _;
   }
   ```

2. Emergency Controls
   ```solidity
   function pause() external onlyGovernance {
     _pause();
     emit ProtocolPaused(msg.sender);
   }
   ```

3. Value Validation
   ```solidity
   function validateParameters(uint256 value) internal pure {
     require(value > MIN_VALUE && value < MAX_VALUE, "Invalid value");
   }
   ```

## Deployment Process

### Preparation
1. Verify contracts:
   ```bash
   npx hardhat verify --network chain138 CONTRACT_ADDRESS CONSTRUCTOR_ARGS
   ```

2. Setup monitoring:
   ```bash
   ./scripts/setup-protocol-monitoring.sh
   ```

### Post-Deployment
1. Verify integration:
   ```bash
   npx hardhat run scripts/verify-integration.ts --network chain138
   ```

2. Monitor metrics:
   ```bash
   curl localhost:9090/api/v1/query?query=protocol_health
   ```

## Troubleshooting Guide

### Common Issues
1. Initialization Failures
   - Check configuration parameters
   - Verify contract dependencies
   - Ensure proper access rights

2. Integration Errors
   - Validate contract interactions
   - Check event emissions
   - Verify state changes

### Recovery Procedures
1. Emergency Shutdown:
   ```typescript
   await protocol.pause();
   ```

2. State Recovery:
   ```typescript
   await protocol.recoverState();
   ```

## Maintenance Guide

### Regular Tasks
1. Parameter Updates
2. Security Checks
3. Performance Monitoring

### Upgrade Procedures
1. Prepare upgrade:
   ```typescript
   const newImplementation = await deployNewImplementation();
   await proxy.upgradeTo(newImplementation.address);
   ```

2. Verify upgrade:
   ```typescript
   await verifyUpgrade(proxy.address, newImplementation.address);
   ```
``` 