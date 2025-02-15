#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

class ProtocolMonitor {
  constructor(provider, config) {
    this.provider = provider;
    this.config = config;
    this.metrics = {
      aave: {
        tvl: ethers.BigNumber.from(0),
        totalBorrowed: ethers.BigNumber.from(0),
        utilizationRate: 0,
        healthFactor: 0,
        liquidationThreshold: 0,
        riskMetrics: {}
      },
      dodoex: {
        tvl: ethers.BigNumber.from(0),
        volume24h: ethers.BigNumber.from(0),
        fees24h: ethers.BigNumber.from(0),
        poolMetrics: {},
        liquidityUtilization: 0
      },
      lido: {
        totalStaked: ethers.BigNumber.from(0),
        validatorCount: 0,
        apr: 0,
        rewardEfficiency: 0,
        validatorPerformance: {}
      },
      maker: {
        tvl: ethers.BigNumber.from(0),
        daiSupply: ethers.BigNumber.from(0),
        collateralRatio: 0,
        vaultMetrics: {},
        stabilityFee: 0
      },
      meth: {
        totalStaked: ethers.BigNumber.from(0),
        validatorCount: 0,
        apr: 0,
        validatorPerformance: {},
        withdrawalQueue: 0
      }
    };
    this.alerts = new Set();
  }

  async initialize() {
    // Initialize protocol contracts
    await this.initializeAave();
    await this.initializeDodoex();
    await this.initializeLido();
    await this.initializeMaker();
    await this.initializeMETH();

    // Set up event listeners
    this.setupEventListeners();

    // Load initial metrics
    await this.updateMetrics();
  }

  async initializeAave() {
    this.aavePool = new ethers.Contract(
      this.config.aave.lendingPool,
      [
        'function getReserveData(address) view returns (tuple)',
        'function getUserAccountData(address) view returns (tuple)',
        'event LiquidationCall(address,address,address,uint256,uint256,address)',
        'event Borrow(address,address,uint256,uint256,uint256)',
        'event Repay(address,address,uint256,address)'
      ],
      this.provider
    );
  }

  async initializeDodoex() {
    this.dodoFactory = new ethers.Contract(
      this.config.dodoex.factory,
      [
        'function getAllPools() view returns (address[])',
        'function getPoolData(address) view returns (tuple)',
        'event NewPool(address,address,address)',
        'event Swap(address,address,uint256,uint256)'
      ],
      this.provider
    );
  }

  async initializeLido() {
    this.lidoStaking = new ethers.Contract(
      this.config.lido.stakingPool,
      [
        'function getTotalStaked() view returns (uint256)',
        'function getValidatorCount() view returns (uint256)',
        'function getAPR() view returns (uint256)',
        'event ValidatorActivated(bytes,uint256)',
        'event ValidatorExited(bytes,uint256)'
      ],
      this.provider
    );
  }

  async initializeMaker() {
    this.makerCdp = new ethers.Contract(
      this.config.maker.cdpManager,
      [
        'function getAllCdps() view returns (tuple[])',
        'function getCdpInfo(uint256) view returns (tuple)',
        'event NewCdp(address,uint256)',
        'event CdpLiquidated(uint256,uint256)'
      ],
      this.provider
    );
  }

  async initializeMETH() {
    this.methStaking = new ethers.Contract(
      this.config.meth.wrapper,
      [
        'function getTotalStaked() view returns (uint256)',
        'function getValidatorCount() view returns (uint256)',
        'function getAPR() view returns (uint256)',
        'event ValidatorRegistered(bytes,uint256)',
        'event ValidatorExited(bytes,uint256)'
      ],
      this.provider
    );
  }

  setupEventListeners() {
    // Aave events
    this.aavePool.on('LiquidationCall', async (...args) => {
      await this.handleAaveLiquidation(...args);
    });

    // DODO events
    this.dodoFactory.on('Swap', async (...args) => {
      await this.handleDodoSwap(...args);
    });

    // Lido events
    this.lidoStaking.on('ValidatorActivated', async (...args) => {
      await this.handleLidoValidatorChange(...args);
    });

    // Maker events
    this.makerCdp.on('CdpLiquidated', async (...args) => {
      await this.handleMakerLiquidation(...args);
    });

    // mETH events
    this.methStaking.on('ValidatorRegistered', async (...args) => {
      await this.handleMETHValidatorChange(...args);
    });
  }

  async monitorProtocols() {
    while (true) {
      try {
        await this.updateMetrics();
        await this.checkProtocolAlerts();
        await this.reportMetrics();

        // Wait before next update
        await sleep(parseInt(process.env.PROTOCOL_MONITORING_INTERVAL) * 1000 || 30000);
      } catch (error) {
        console.error('Error monitoring protocols:', error);
        await sleep(5000);
      }
    }
  }

  async updateMetrics() {
    await Promise.all([
      this.updateAaveMetrics(),
      this.updateDodoMetrics(),
      this.updateLidoMetrics(),
      this.updateMakerMetrics(),
      this.updateMETHMetrics()
    ]);
  }

  async updateAaveMetrics() {
    // Update Aave metrics
    const reserves = await Promise.all(
      this.config.aave.supportedAssets.map(async (asset) => {
        const data = await this.aavePool.getReserveData(asset);
        return {
          asset,
          data
        };
      })
    );

    this.metrics.aave.tvl = reserves.reduce(
      (total, { data }) => total.add(data.totalStableDebt).add(data.totalVariableDebt),
      ethers.BigNumber.from(0)
    );

    this.metrics.aave.utilizationRate =
      reserves.reduce((total, { data }) => total + data.utilizationRate, 0) / reserves.length;

    // Calculate risk metrics
    this.metrics.aave.riskMetrics = this.calculateAaveRiskMetrics(reserves);
  }

  async updateDodoMetrics() {
    const pools = await this.dodoFactory.getAllPools();
    const poolData = await Promise.all(
      pools.map(async (pool) => {
        const data = await this.dodoFactory.getPoolData(pool);
        return {
          pool,
          data
        };
      })
    );

    this.metrics.dodoex.tvl = poolData.reduce(
      (total, { data }) => total.add(data.baseReserve).add(data.quoteReserve),
      ethers.BigNumber.from(0)
    );

    this.metrics.dodoex.liquidityUtilization =
      poolData.reduce((total, { data }) => total + data.utilization, 0) / poolData.length;

    // Update pool metrics
    this.metrics.dodoex.poolMetrics = this.calculateDodoPoolMetrics(poolData);
  }

  async updateLidoMetrics() {
    const [totalStaked, validatorCount, apr] = await Promise.all([
      this.lidoStaking.getTotalStaked(),
      this.lidoStaking.getValidatorCount(),
      this.lidoStaking.getAPR()
    ]);

    this.metrics.lido.totalStaked = totalStaked;
    this.metrics.lido.validatorCount = validatorCount.toNumber();
    this.metrics.lido.apr = apr.toNumber() / 10000; // Assuming 4 decimals

    // Update validator performance
    this.metrics.lido.validatorPerformance = await this.calculateLidoValidatorMetrics();
  }

  async updateMakerMetrics() {
    const cdps = await this.makerCdp.getAllCdps();
    const cdpData = await Promise.all(
      cdps.map(async (cdp) => {
        const info = await this.makerCdp.getCdpInfo(cdp.id);
        return {
          cdp,
          info
        };
      })
    );

    this.metrics.maker.tvl = cdpData.reduce(
      (total, { info }) => total.add(info.collateralValue),
      ethers.BigNumber.from(0)
    );

    this.metrics.maker.collateralRatio =
      cdpData.reduce((total, { info }) => total + info.collateralRatio, 0) / cdpData.length;

    // Update vault metrics
    this.metrics.maker.vaultMetrics = this.calculateMakerVaultMetrics(cdpData);
  }

  async updateMETHMetrics() {
    const [totalStaked, validatorCount, apr] = await Promise.all([
      this.methStaking.getTotalStaked(),
      this.methStaking.getValidatorCount(),
      this.methStaking.getAPR()
    ]);

    this.metrics.meth.totalStaked = totalStaked;
    this.metrics.meth.validatorCount = validatorCount.toNumber();
    this.metrics.meth.apr = apr.toNumber() / 10000; // Assuming 4 decimals

    // Update validator performance
    this.metrics.meth.validatorPerformance = await this.calculateMETHValidatorMetrics();
  }

  async checkProtocolAlerts() {
    await Promise.all([
      this.checkAaveAlerts(),
      this.checkDodoAlerts(),
      this.checkLidoAlerts(),
      this.checkMakerAlerts(),
      this.checkMETHAlerts()
    ]);
  }

  async checkAaveAlerts() {
    // Check utilization rate
    if (this.metrics.aave.utilizationRate > 0.95) {
      await this.sendAlert('High Aave Utilization', {
        current: this.metrics.aave.utilizationRate,
        threshold: 0.95,
        timestamp: new Date().toISOString()
      });
    }

    // Check health factor
    if (this.metrics.aave.healthFactor < 1.1) {
      await this.sendAlert('Low Aave Health Factor', {
        current: this.metrics.aave.healthFactor,
        threshold: 1.1,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkDodoAlerts() {
    // Check pool imbalance
    for (const [pool, metrics] of Object.entries(this.metrics.dodoex.poolMetrics)) {
      if (metrics.imbalance > 0.2) {
        await this.sendAlert('High DODO Pool Imbalance', {
          pool,
          imbalance: metrics.imbalance,
          threshold: 0.2,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async checkLidoAlerts() {
    // Check validator performance
    const lowPerformers = Object.entries(this.metrics.lido.validatorPerformance).filter(
      ([_, performance]) => performance < 0.9
    );

    if (lowPerformers.length > 0) {
      await this.sendAlert('Low Lido Validator Performance', {
        validators: lowPerformers.map(([validator]) => validator),
        count: lowPerformers.length,
        threshold: 0.9,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkMakerAlerts() {
    // Check risky vaults
    const riskyVaults = Object.entries(this.metrics.maker.vaultMetrics).filter(
      ([_, metrics]) => metrics.collateralRatio < 1.5
    );

    if (riskyVaults.length > 0) {
      await this.sendAlert('Risky Maker Vaults Detected', {
        vaults: riskyVaults.map(([vault]) => vault),
        count: riskyVaults.length,
        threshold: 1.5,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkMETHAlerts() {
    // Check validator performance
    const lowPerformers = Object.entries(this.metrics.meth.validatorPerformance).filter(
      ([_, performance]) => performance < 0.9
    );

    if (lowPerformers.length > 0) {
      await this.sendAlert('Low mETH Validator Performance', {
        validators: lowPerformers.map(([validator]) => validator),
        count: lowPerformers.length,
        threshold: 0.9,
        timestamp: new Date().toISOString()
      });
    }
  }

  async sendAlert(type, data) {
    const alertId = `${type}-${JSON.stringify(data)}`;

    // Prevent duplicate alerts within cooldown period
    if (this.alerts.has(alertId)) {
      return;
    }

    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🏦 *Protocol Alert: ${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🏦 **Protocol Alert: ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Add to alert set with cooldown
    this.alerts.add(alertId);
    setTimeout(
      () => this.alerts.delete(alertId),
      parseInt(process.env.ALERT_COOLDOWN_PERIOD || '3600000')
    );

    // Log alert
    console.log(`[PROTOCOL ALERT] ${type}:`, data);
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Protocol Metrics:', {
      aave: {
        tvl: ethers.utils.formatEther(this.metrics.aave.tvl),
        utilizationRate: this.metrics.aave.utilizationRate,
        healthFactor: this.metrics.aave.healthFactor
      },
      dodoex: {
        tvl: ethers.utils.formatEther(this.metrics.dodoex.tvl),
        volume24h: ethers.utils.formatEther(this.metrics.dodoex.volume24h),
        liquidityUtilization: this.metrics.dodoex.liquidityUtilization
      },
      lido: {
        totalStaked: ethers.utils.formatEther(this.metrics.lido.totalStaked),
        validatorCount: this.metrics.lido.validatorCount,
        apr: this.metrics.lido.apr
      },
      maker: {
        tvl: ethers.utils.formatEther(this.metrics.maker.tvl),
        collateralRatio: this.metrics.maker.collateralRatio,
        daiSupply: ethers.utils.formatEther(this.metrics.maker.daiSupply)
      },
      meth: {
        totalStaked: ethers.utils.formatEther(this.metrics.meth.totalStaked),
        validatorCount: this.metrics.meth.validatorCount,
        apr: this.metrics.meth.apr
      }
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      // Aave metrics
      aave_tvl: parseFloat(ethers.utils.formatEther(this.metrics.aave.tvl)),
      aave_utilization_rate: this.metrics.aave.utilizationRate,
      aave_health_factor: this.metrics.aave.healthFactor,

      // DODO metrics
      dodo_tvl: parseFloat(ethers.utils.formatEther(this.metrics.dodoex.tvl)),
      dodo_volume_24h: parseFloat(ethers.utils.formatEther(this.metrics.dodoex.volume24h)),
      dodo_liquidity_utilization: this.metrics.dodoex.liquidityUtilization,

      // Lido metrics
      lido_total_staked: parseFloat(ethers.utils.formatEther(this.metrics.lido.totalStaked)),
      lido_validator_count: this.metrics.lido.validatorCount,
      lido_apr: this.metrics.lido.apr,

      // Maker metrics
      maker_tvl: parseFloat(ethers.utils.formatEther(this.metrics.maker.tvl)),
      maker_collateral_ratio: this.metrics.maker.collateralRatio,
      maker_dai_supply: parseFloat(ethers.utils.formatEther(this.metrics.maker.daiSupply)),

      // mETH metrics
      meth_total_staked: parseFloat(ethers.utils.formatEther(this.metrics.meth.totalStaked)),
      meth_validator_count: this.metrics.meth.validatorCount,
      meth_apr: this.metrics.meth.apr
    };

    try {
      await fetch(process.env.PROMETHEUS_PUSH_GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: Object.entries(metrics)
          .map(([key, value]) => `${key} ${value}`)
          .join('\n')
      });
    } catch (error) {
      console.error('Error pushing metrics to Prometheus:', error);
    }
  }

  // Helper methods for calculating protocol-specific metrics
  calculateAaveRiskMetrics(reserves) {
    // Implementation for Aave risk metrics calculation
  }

  calculateDodoPoolMetrics(poolData) {
    // Implementation for DODO pool metrics calculation
  }

  async calculateLidoValidatorMetrics() {
    // Implementation for Lido validator metrics calculation
  }

  calculateMakerVaultMetrics(cdpData) {
    // Implementation for Maker vault metrics calculation
  }

  async calculateMETHValidatorMetrics() {
    // Implementation for mETH validator metrics calculation
  }
}

async function main() {
  // Load protocol configuration
  const config = require('../../defi/config.json');

  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  // Initialize monitor
  const monitor = new ProtocolMonitor(provider, config);
  await monitor.initialize();

  // Start monitoring
  await monitor.monitorProtocols();
}

if (require.main === module) {
  main().catch(console.error);
}
