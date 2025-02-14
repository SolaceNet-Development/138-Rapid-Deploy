#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Event signatures to monitor
const EVENTS = {
  BRIDGE_TRANSFER: 'TokensBridged(bytes32,address,uint256,address)',
  BRIDGE_CLAIM: 'TokensClaimed(bytes32,address,uint256)',
  EMERGENCY_PAUSE: 'EmergencyPause(address)',
  VALIDATOR_CHANGE: 'ValidatorChanged(address,bool)',
  THRESHOLD_CHANGE: 'ThresholdChanged(uint256)',
  LARGE_TRANSFER: 'LargeTransfer(address,address,uint256)'
};

class ContractMonitor {
  constructor(provider, contractAddress) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    this.metrics = {
      totalTransfers: 0,
      totalValue: ethers.BigNumber.from(0),
      activeValidators: 0,
      failedTransactions: 0,
      averageGasUsed: 0,
      lastBlockProcessed: 0
    };
  }

  async initialize() {
    // Get current block
    this.currentBlock = await this.provider.getBlockNumber();
    this.lastBlockProcessed = this.currentBlock - 1000; // Start from 1000 blocks ago

    // Initialize contract interface
    this.contract = new ethers.Contract(
      this.contractAddress,
      [
        `event ${EVENTS.BRIDGE_TRANSFER}`,
        `event ${EVENTS.BRIDGE_CLAIM}`,
        `event ${EVENTS.EMERGENCY_PAUSE}`,
        `event ${EVENTS.VALIDATOR_CHANGE}`,
        `event ${EVENTS.THRESHOLD_CHANGE}`,
        `event ${EVENTS.LARGE_TRANSFER}`
      ],
      this.provider
    );

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Bridge transfer events
    this.contract.on(EVENTS.BRIDGE_TRANSFER, (messageId, token, amount, recipient) => {
      this.metrics.totalTransfers++;
      this.metrics.totalValue = this.metrics.totalValue.add(amount);
      this.checkLargeTransfer(amount, recipient);
    });

    // Bridge claim events
    this.contract.on(EVENTS.BRIDGE_CLAIM, (messageId, recipient, amount) => {
      this.checkClaimDelay(messageId);
    });

    // Emergency events
    this.contract.on(EVENTS.EMERGENCY_PAUSE, (admin) => {
      this.handleEmergencyEvent(admin);
    });

    // Validator changes
    this.contract.on(EVENTS.VALIDATOR_CHANGE, (validator, active) => {
      this.metrics.activeValidators += active ? 1 : -1;
      this.checkValidatorThreshold();
    });
  }

  async monitorBlocks() {
    while (true) {
      try {
        const latestBlock = await this.provider.getBlockNumber();
        
        // Process new blocks
        for (let i = this.lastBlockProcessed + 1; i <= latestBlock; i++) {
          await this.processBlock(i);
        }
        
        this.lastBlockProcessed = latestBlock;
        
        // Report metrics
        this.reportMetrics();
        
        // Wait before next iteration
        await sleep(parseInt(process.env.MONITORING_INTERVAL) * 1000 || 15000);
      } catch (error) {
        console.error('Error monitoring blocks:', error);
        await sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  async processBlock(blockNumber) {
    const block = await this.provider.getBlock(blockNumber, true);
    
    // Process transactions in block
    for (const tx of block.transactions) {
      if (tx.to === this.contractAddress) {
        await this.processTransaction(tx);
      }
    }
  }

  async processTransaction(tx) {
    try {
      const receipt = await tx.wait();
      
      // Update gas metrics
      this.metrics.averageGasUsed = (this.metrics.averageGasUsed * this.metrics.totalTransfers + receipt.gasUsed.toNumber()) / (this.metrics.totalTransfers + 1);
      
      // Check for failed transactions
      if (!receipt.status) {
        this.metrics.failedTransactions++;
        this.checkFailureRate();
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }

  async checkLargeTransfer(amount, recipient) {
    const threshold = ethers.utils.parseEther(process.env.LARGE_TRANSFER_THRESHOLD || '1000');
    if (amount.gt(threshold)) {
      await this.sendAlert('Large Transfer', {
        amount: ethers.utils.formatEther(amount),
        recipient,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkClaimDelay(messageId) {
    // Check time between bridge and claim
    const bridgeEvent = await this.findBridgeEvent(messageId);
    if (bridgeEvent) {
      const delay = Date.now() - bridgeEvent.timestamp;
      if (delay > parseInt(process.env.MAX_CLAIM_DELAY || '86400000')) {
        await this.sendAlert('Long Claim Delay', {
          messageId,
          delay: Math.floor(delay / 1000),
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async checkFailureRate() {
    const failureRate = this.metrics.failedTransactions / this.metrics.totalTransfers;
    if (failureRate > parseFloat(process.env.MAX_FAILURE_RATE || '0.1')) {
      await this.sendAlert('High Failure Rate', {
        rate: failureRate.toFixed(2),
        total: this.metrics.totalTransfers,
        failed: this.metrics.failedTransactions,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkValidatorThreshold() {
    const minValidators = parseInt(process.env.MIN_VALIDATORS || '3');
    if (this.metrics.activeValidators < minValidators) {
      await this.sendAlert('Low Validator Count', {
        active: this.metrics.activeValidators,
        minimum: minValidators,
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleEmergencyEvent(admin) {
    await this.sendAlert('Emergency Pause', {
      admin,
      timestamp: new Date().toISOString()
    });
  }

  async sendAlert(type, data) {
    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      // Send to Slack
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *${type} Alert*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      // Send to Discord
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **${type} Alert**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[ALERT] ${type}:`, data);
  }

  reportMetrics() {
    // Output current metrics
    console.log('Current Metrics:', {
      totalTransfers: this.metrics.totalTransfers,
      totalValue: ethers.utils.formatEther(this.metrics.totalValue),
      activeValidators: this.metrics.activeValidators,
      failedTransactions: this.metrics.failedTransactions,
      averageGasUsed: Math.floor(this.metrics.averageGasUsed),
      lastBlockProcessed: this.lastBlockProcessed
    });

    // Push metrics to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      'bridge_total_transfers': this.metrics.totalTransfers,
      'bridge_total_value': parseFloat(ethers.utils.formatEther(this.metrics.totalValue)),
      'bridge_active_validators': this.metrics.activeValidators,
      'bridge_failed_transactions': this.metrics.failedTransactions,
      'bridge_average_gas_used': this.metrics.averageGasUsed
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
}

async function main() {
  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  
  // Initialize monitor
  const monitor = new ContractMonitor(
    provider,
    process.env.CONTRACT_ADDRESS
  );
  
  await monitor.initialize();
  await monitor.monitorBlocks();
}

if (require.main === module) {
  main().catch(console.error);
}  