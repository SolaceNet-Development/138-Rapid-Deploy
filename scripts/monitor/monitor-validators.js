#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// ABI for validator contract
const VALIDATOR_ABI = [
  'function getValidators() view returns (address[])',
  'function isValidator(address) view returns (bool)',
  'function getValidatorInfo(address) view returns (tuple(uint256 lastBlock, uint256 totalBlocks, uint256 missedBlocks, bool active))',
  'event ValidatorAdded(address indexed validator)',
  'event ValidatorRemoved(address indexed validator)',
  'event BlockProduced(address indexed validator, uint256 blockNumber)',
  'event BlockMissed(address indexed validator, uint256 blockNumber)'
];

class ValidatorMonitor {
  constructor(provider, validatorContractAddress) {
    this.provider = provider;
    this.validatorContract = new ethers.Contract(
      validatorContractAddress,
      VALIDATOR_ABI,
      provider
    );
    this.metrics = {
      totalValidators: 0,
      activeValidators: 0,
      validatorPerformance: new Map(),
      blockProduction: new Map(),
      missedBlocks: new Map(),
      lastUpdate: 0
    };
  }

  async initialize() {
    // Get initial validator set
    const validators = await this.validatorContract.getValidators();
    this.metrics.totalValidators = validators.length;
    
    // Initialize validator metrics
    for (const validator of validators) {
      const info = await this.validatorContract.getValidatorInfo(validator);
      this.metrics.validatorPerformance.set(validator, {
        lastBlock: info.lastBlock.toNumber(),
        totalBlocks: info.totalBlocks.toNumber(),
        missedBlocks: info.missedBlocks.toNumber(),
        active: info.active
      });
      if (info.active) this.metrics.activeValidators++;
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Monitor validator additions
    this.validatorContract.on('ValidatorAdded', async (validator) => {
      this.metrics.totalValidators++;
      this.metrics.activeValidators++;
      this.metrics.validatorPerformance.set(validator, {
        lastBlock: 0,
        totalBlocks: 0,
        missedBlocks: 0,
        active: true
      });
      await this.sendAlert('Validator Added', {
        validator,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor validator removals
    this.validatorContract.on('ValidatorRemoved', async (validator) => {
      this.metrics.activeValidators--;
      const performance = this.metrics.validatorPerformance.get(validator);
      if (performance) {
        performance.active = false;
      }
      await this.sendAlert('Validator Removed', {
        validator,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor block production
    this.validatorContract.on('BlockProduced', (validator, blockNumber) => {
      const blocks = this.blockProduction.get(validator) || 0;
      this.blockProduction.set(validator, blocks + 1);
      
      const performance = this.metrics.validatorPerformance.get(validator);
      if (performance) {
        performance.lastBlock = blockNumber.toNumber();
        performance.totalBlocks++;
      }
    });

    // Monitor missed blocks
    this.validatorContract.on('BlockMissed', async (validator, blockNumber) => {
      const missed = this.missedBlocks.get(validator) || 0;
      this.missedBlocks.set(validator, missed + 1);
      
      const performance = this.metrics.validatorPerformance.get(validator);
      if (performance) {
        performance.missedBlocks++;
      }

      // Alert if too many blocks are missed
      const missedThreshold = parseInt(process.env.VALIDATOR_MISSED_BLOCKS_THRESHOLD || '50');
      if (missed + 1 >= missedThreshold) {
        await this.sendAlert('High Missed Blocks', {
          validator,
          missed: missed + 1,
          threshold: missedThreshold,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  async monitorValidators() {
    while (true) {
      try {
        await this.updateMetrics();
        await this.checkValidatorAlerts();
        await this.reportMetrics();
        
        // Wait before next check
        await sleep(parseInt(process.env.VALIDATOR_MONITORING_INTERVAL) * 1000 || 60000);
      } catch (error) {
        console.error('Error monitoring validators:', error);
        await sleep(5000);
      }
    }
  }

  async updateMetrics() {
    // Get current validator set
    const validators = await this.validatorContract.getValidators();
    
    // Update metrics for each validator
    for (const validator of validators) {
      const info = await this.validatorContract.getValidatorInfo(validator);
      this.metrics.validatorPerformance.set(validator, {
        lastBlock: info.lastBlock.toNumber(),
        totalBlocks: info.totalBlocks.toNumber(),
        missedBlocks: info.missedBlocks.toNumber(),
        active: info.active
      });
    }

    this.metrics.lastUpdate = Date.now();
  }

  async checkValidatorAlerts() {
    const currentBlock = await this.provider.getBlockNumber();
    const inactivityThreshold = parseInt(process.env.VALIDATOR_INACTIVITY_THRESHOLD || '100');
    const performanceThreshold = parseFloat(process.env.VALIDATOR_PERFORMANCE_THRESHOLD || '0.95');

    for (const [validator, metrics] of this.metrics.validatorPerformance.entries()) {
      if (!metrics.active) continue;

      // Check for inactivity
      const blocksSinceLastProduction = currentBlock - metrics.lastBlock;
      if (blocksSinceLastProduction > inactivityThreshold) {
        await this.sendAlert('Validator Inactive', {
          validator,
          blocksSinceLastProduction,
          threshold: inactivityThreshold,
          timestamp: new Date().toISOString()
        });
      }

      // Check performance
      const performance = (metrics.totalBlocks - metrics.missedBlocks) / metrics.totalBlocks;
      if (performance < performanceThreshold) {
        await this.sendAlert('Low Validator Performance', {
          validator,
          performance: performance.toFixed(4),
          threshold: performanceThreshold,
          missedBlocks: metrics.missedBlocks,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check minimum validator count
    const minValidators = parseInt(process.env.MIN_ACTIVE_VALIDATORS || '4');
    if (this.metrics.activeValidators < minValidators) {
      await this.sendAlert('Low Validator Count', {
        active: this.metrics.activeValidators,
        minimum: minValidators,
        timestamp: new Date().toISOString()
      });
    }
  }

  async sendAlert(type, data) {
    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚡ *${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⚡ **${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[VALIDATOR ALERT] ${type}:`, data);
  }

  async reportMetrics() {
    // Calculate aggregate metrics
    const aggregateMetrics = {
      totalValidators: this.metrics.totalValidators,
      activeValidators: this.metrics.activeValidators,
      averagePerformance: 0,
      totalMissedBlocks: 0,
      inactiveValidators: 0
    };

    let totalPerformance = 0;
    for (const metrics of this.metrics.validatorPerformance.values()) {
      if (metrics.active) {
        const performance = (metrics.totalBlocks - metrics.missedBlocks) / metrics.totalBlocks;
        totalPerformance += performance;
        aggregateMetrics.totalMissedBlocks += metrics.missedBlocks;
      } else {
        aggregateMetrics.inactiveValidators++;
      }
    }
    aggregateMetrics.averagePerformance = totalPerformance / this.metrics.activeValidators;

    // Output metrics
    console.log('Validator Metrics:', aggregateMetrics);

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus(aggregateMetrics);
    }
  }

  async pushMetricsToPrometheus(aggregateMetrics) {
    const metrics = {
      'validator_total_count': aggregateMetrics.totalValidators,
      'validator_active_count': aggregateMetrics.activeValidators,
      'validator_inactive_count': aggregateMetrics.inactiveValidators,
      'validator_average_performance': aggregateMetrics.averagePerformance,
      'validator_total_missed_blocks': aggregateMetrics.totalMissedBlocks
    };

    // Add individual validator metrics
    for (const [validator, performance] of this.metrics.validatorPerformance.entries()) {
      const validatorLabel = `validator="${validator}"`;
      metrics[`validator_blocks_produced{${validatorLabel}}`] = performance.totalBlocks;
      metrics[`validator_blocks_missed{${validatorLabel}}`] = performance.missedBlocks;
      metrics[`validator_active{${validatorLabel}}`] = performance.active ? 1 : 0;
    }

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
}

async function main() {
  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  
  // Initialize monitor
  const monitor = new ValidatorMonitor(
    provider,
    process.env.VALIDATOR_CONTRACT_ADDRESS
  );
  await monitor.initialize();
  
  // Start monitoring
  await monitor.monitorValidators();
}

if (require.main === module) {
  main().catch(console.error);
} 