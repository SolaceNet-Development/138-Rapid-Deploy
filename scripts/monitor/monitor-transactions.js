#!/usr/bin/env node

const { ethers } = require('ethers');
const fetch = require('node-fetch');

class TransactionMonitor {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {
      transactions: {
        pending: [],
        recent: [],
        failed: [],
        suspicious: []
      },
      stats: {
        hourly: {
          total: 0,
          failed: 0,
          avgGasUsed: 0,
          avgValue: 0
        },
        daily: {
          total: 0,
          failed: 0,
          avgGasUsed: 0,
          avgValue: 0
        }
      },
      patterns: {
        highValueTransfers: [],
        contractDeployments: [],
        repeatedCalls: new Map(),
        failedAttempts: new Map()
      },
      mempool: {
        size: 0,
        oldestTx: null,
        highestGasPrice: 0
      },
      lastUpdate: 0
    };

    this.thresholds = {
      highValue: ethers.utils.parseEther(process.env.HIGH_VALUE_THRESHOLD || '100'),
      suspiciousRepetition: parseInt(process.env.SUSPICIOUS_REPETITION_THRESHOLD || '5'),
      failureRate: parseFloat(process.env.FAILURE_RATE_THRESHOLD || '0.2'),
      pendingTxAge: parseInt(process.env.PENDING_TX_AGE_THRESHOLD || '3600'),
      mempoolSize: parseInt(process.env.MEMPOOL_SIZE_THRESHOLD || '10000')
    };

    // Initialize contract signatures database
    this.knownSignatures = new Map([
      ['0x23b872dd', 'transferFrom(address,address,uint256)'],
      ['0xa9059cbb', 'transfer(address,uint256)'],
      ['0x095ea7b3', 'approve(address,uint256)'],
      ['0x70a08231', 'balanceOf(address)']
    ]);
  }

  async initialize() {
    // Load recent transactions
    await this.loadRecentTransactions();

    // Initialize transaction filters
    this.initializeFilters();

    console.log('Transaction monitor initialized');
  }

  async loadRecentTransactions() {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      const startBlock = latestBlock - 240; // Last hour of blocks

      for (let i = startBlock; i <= latestBlock; i++) {
        const block = await this.provider.getBlock(i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            await this.processPastTransaction(tx, block);
          }
        }
      }
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  }

  initializeFilters() {
    // Listen for pending transactions
    this.provider.on('pending', async (txHash) => {
      try {
        const tx = await this.provider.getTransaction(txHash);
        if (tx) {
          await this.processPendingTransaction(tx);
        }
      } catch (error) {
        console.warn('Error processing pending transaction:', error);
      }
    });

    // Listen for new blocks
    this.provider.on('block', async (blockNumber) => {
      try {
        const block = await this.provider.getBlock(blockNumber, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            await this.processNewTransaction(tx, block);
          }
        }
      } catch (error) {
        console.warn('Error processing block:', error);
      }
    });
  }

  async processPendingTransaction(tx) {
    // Add to pending transactions
    this.metrics.transactions.pending.push({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasPrice: tx.gasPrice.toString(),
      timestamp: Date.now()
    });

    // Update mempool metrics
    this.metrics.mempool.size = this.metrics.transactions.pending.length;
    this.metrics.mempool.highestGasPrice = Math.max(
      this.metrics.mempool.highestGasPrice,
      parseFloat(ethers.utils.formatUnits(tx.gasPrice, 'gwei'))
    );

    // Check for suspicious patterns
    await this.checkTransactionPatterns(tx);
  }

  async processNewTransaction(tx, block) {
    // Remove from pending if exists
    this.metrics.transactions.pending = this.metrics.transactions.pending.filter(
      (t) => t.hash !== tx.hash
    );

    // Add to recent transactions
    this.metrics.transactions.recent.unshift({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasUsed: tx.gasUsed?.toString(),
      status: null, // Will be updated when receipt is available
      blockNumber: block.number,
      timestamp: block.timestamp
    });

    // Keep only last 1000 transactions
    if (this.metrics.transactions.recent.length > 1000) {
      this.metrics.transactions.recent.pop();
    }

    // Get transaction receipt
    try {
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      if (receipt) {
        // Update transaction status
        const txIndex = this.metrics.transactions.recent.findIndex((t) => t.hash === tx.hash);
        if (txIndex !== -1) {
          this.metrics.transactions.recent[txIndex].status = receipt.status;
        }

        // Handle failed transactions
        if (!receipt.status) {
          await this.handleFailedTransaction(tx, receipt);
        }

        // Update statistics
        await this.updateTransactionStats();
      }
    } catch (error) {
      console.warn('Error getting transaction receipt:', error);
    }
  }

  async processPastTransaction(tx, block) {
    // Add to recent transactions
    this.metrics.transactions.recent.push({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasUsed: tx.gasUsed?.toString(),
      status: null,
      blockNumber: block.number,
      timestamp: block.timestamp
    });

    // Update statistics
    await this.updateTransactionStats();
  }

  async checkTransactionPatterns(tx) {
    // Check high value transfers
    if (tx.value.gt(this.thresholds.highValue)) {
      this.metrics.patterns.highValueTransfers.push({
        hash: tx.hash,
        value: tx.value.toString(),
        from: tx.from,
        to: tx.to,
        timestamp: Date.now()
      });

      await this.sendAlert('High Value Transfer', {
        hash: tx.hash,
        value: ethers.utils.formatEther(tx.value),
        from: tx.from,
        to: tx.to,
        severity: 'high'
      });
    }

    // Check contract deployments
    if (!tx.to) {
      this.metrics.patterns.contractDeployments.push({
        hash: tx.hash,
        from: tx.from,
        gasPrice: tx.gasPrice.toString(),
        timestamp: Date.now()
      });

      await this.sendAlert('Contract Deployment', {
        hash: tx.hash,
        from: tx.from,
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
        severity: 'medium'
      });
    }

    // Check repeated calls
    const callSignature = tx.data.slice(0, 10);
    if (callSignature !== '0x') {
      const key = `${tx.from}-${tx.to}-${callSignature}`;
      const count = (this.metrics.patterns.repeatedCalls.get(key) || 0) + 1;
      this.metrics.patterns.repeatedCalls.set(key, count);

      if (count >= this.thresholds.suspiciousRepetition) {
        const methodName = this.knownSignatures.get(callSignature) || 'unknown';
        await this.sendAlert('Suspicious Repeated Calls', {
          from: tx.from,
          to: tx.to,
          method: methodName,
          count,
          severity: 'medium'
        });
      }
    }
  }

  async handleFailedTransaction(tx, receipt) {
    // Add to failed transactions
    this.metrics.transactions.failed.push({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasUsed: receipt.gasUsed.toString(),
      error: await this.getTransactionError(tx.hash),
      timestamp: Date.now()
    });

    // Track failed attempts by address
    const key = tx.from;
    const failures = (this.metrics.patterns.failedAttempts.get(key) || 0) + 1;
    this.metrics.patterns.failedAttempts.set(key, failures);

    // Check failure rate
    const recentFromAddress = this.metrics.transactions.recent.filter((t) => t.from === tx.from);
    const failureRate = failures / recentFromAddress.length;

    if (failureRate > this.thresholds.failureRate) {
      await this.sendAlert('High Transaction Failure Rate', {
        address: tx.from,
        failures,
        total: recentFromAddress.length,
        rate: failureRate.toFixed(2),
        severity: 'high'
      });
    }
  }

  async getTransactionError(txHash) {
    try {
      await this.provider.call(await this.provider.getTransaction(txHash));
      return 'Unknown error';
    } catch (error) {
      // Extract revert reason from error message
      const match = error.message.match(/reverted with reason string '(.+)'/);
      return match ? match[1] : 'Unknown error';
    }
  }

  async updateTransactionStats() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Get transactions within time windows
    const hourlyTxs = this.metrics.transactions.recent.filter(
      (tx) => tx.timestamp * 1000 > oneHourAgo
    );
    const dailyTxs = this.metrics.transactions.recent.filter(
      (tx) => tx.timestamp * 1000 > oneDayAgo
    );

    // Update hourly stats
    this.metrics.stats.hourly = this.calculateStats(hourlyTxs);

    // Update daily stats
    this.metrics.stats.daily = this.calculateStats(dailyTxs);

    this.metrics.lastUpdate = now;
  }

  calculateStats(transactions) {
    const stats = {
      total: transactions.length,
      failed: transactions.filter((tx) => tx.status === false).length,
      avgGasUsed: 0,
      avgValue: 0
    };

    if (transactions.length > 0) {
      const totalGasUsed = transactions
        .filter((tx) => tx.gasUsed)
        .reduce((sum, tx) => sum.add(tx.gasUsed), ethers.BigNumber.from(0));
      const totalValue = transactions.reduce(
        (sum, tx) => sum.add(tx.value),
        ethers.BigNumber.from(0)
      );

      stats.avgGasUsed = totalGasUsed.div(transactions.length).toString();
      stats.avgValue = totalValue.div(transactions.length).toString();
    }

    return stats;
  }

  async monitorTransactions() {
    while (true) {
      try {
        // Clean up old pending transactions
        const now = Date.now();
        this.metrics.transactions.pending = this.metrics.transactions.pending.filter(
          (tx) => now - tx.timestamp < this.thresholds.pendingTxAge * 1000
        );

        // Check mempool size
        if (this.metrics.mempool.size > this.thresholds.mempoolSize) {
          await this.sendAlert('Large Mempool Size', {
            size: this.metrics.mempool.size,
            threshold: this.thresholds.mempoolSize,
            oldestTx: this.metrics.mempool.oldestTx,
            severity: 'medium'
          });
        }

        // Report metrics
        await this.reportMetrics();

        // Wait before next check
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.TRANSACTION_MONITORING_INTERVAL) * 1000 || 30000)
        );
      } catch (error) {
        console.error('Error monitoring transactions:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async sendAlert(type, data) {
    const timestamp = new Date().toISOString();
    const alert = {
      type,
      data,
      timestamp
    };

    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔍 *${type}*\nSeverity: ${data.severity}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🔍 **${type}**\nSeverity: ${data.severity}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[TRANSACTION ALERT] ${type} (${data.severity}):`, data);
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Transaction Metrics:', {
      stats: this.metrics.stats,
      mempool: {
        size: this.metrics.mempool.size,
        highestGasPrice: this.metrics.mempool.highestGasPrice
      },
      patterns: {
        highValueTransfers: this.metrics.patterns.highValueTransfers.length,
        contractDeployments: this.metrics.patterns.contractDeployments.length,
        repeatedCalls: this.metrics.patterns.repeatedCalls.size,
        failedAttempts: this.metrics.patterns.failedAttempts.size
      },
      lastUpdate: new Date(this.metrics.lastUpdate).toISOString()
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      transactions_pending_total: this.metrics.transactions.pending.length,
      transactions_failed_total: this.metrics.transactions.failed.length,
      transactions_hourly_total: this.metrics.stats.hourly.total,
      transactions_hourly_failed: this.metrics.stats.hourly.failed,
      transactions_hourly_avg_gas: this.metrics.stats.hourly.avgGasUsed,
      transactions_daily_total: this.metrics.stats.daily.total,
      transactions_daily_failed: this.metrics.stats.daily.failed,
      transactions_daily_avg_gas: this.metrics.stats.daily.avgGasUsed,
      mempool_size: this.metrics.mempool.size,
      mempool_highest_gas_price: this.metrics.mempool.highestGasPrice,
      high_value_transfers: this.metrics.patterns.highValueTransfers.length,
      contract_deployments: this.metrics.patterns.contractDeployments.length,
      repeated_calls: this.metrics.patterns.repeatedCalls.size,
      failed_attempts: this.metrics.patterns.failedAttempts.size
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
  const monitor = new TransactionMonitor(provider);
  await monitor.initialize();

  // Start monitoring
  await monitor.monitorTransactions();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TransactionMonitor;
