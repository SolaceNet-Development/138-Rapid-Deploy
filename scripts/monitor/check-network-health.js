#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

class NetworkHealthMonitor {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {
      blockHeight: 0,
      blockTime: 0,
      peerCount: 0,
      syncStatus: false,
      lastBlockTimestamp: 0,
      networkLatency: 0,
      pendingTransactions: 0,
      chainReorgs: 0,
      missedBlocks: 0,
      lastChecked: 0
    };
    this.blockHistory = new Map(); // Store recent blocks for reorg detection
  }

  async initialize() {
    // Get initial metrics
    const [blockNumber, peerCount] = await Promise.all([
      this.provider.getBlockNumber(),
      this.provider.send('net_peerCount', []).then(hex => parseInt(hex, 16))
    ]);

    this.metrics.blockHeight = blockNumber;
    this.metrics.peerCount = peerCount;
    this.metrics.lastChecked = Date.now();

    // Subscribe to new blocks
    this.provider.on('block', (blockNumber) => {
      this.handleNewBlock(blockNumber);
    });
  }

  async monitorNetwork() {
    while (true) {
      try {
        await this.updateMetrics();
        await this.checkHealthAlerts();
        await this.reportMetrics();
        
        // Wait before next check
        await sleep(parseInt(process.env.NETWORK_MONITORING_INTERVAL) * 1000 || 30000);
      } catch (error) {
        console.error('Error monitoring network:', error);
        await sleep(5000);
      }
    }
  }

  async updateMetrics() {
    const startTime = Date.now();
    
    try {
      // Get current block and sync status
      const [
        block,
        syncStatus,
        peerCount,
        pendingTx
      ] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.send('eth_syncing', []),
        this.provider.send('net_peerCount', []).then(hex => parseInt(hex, 16)),
        this.provider.send('txpool_status', []).then(status => 
          parseInt(status.pending || '0x0', 16) + parseInt(status.queued || '0x0', 16)
        ).catch(() => 0)
      ]);

      // Update metrics
      this.metrics.blockHeight = block.number;
      this.metrics.lastBlockTimestamp = block.timestamp;
      this.metrics.blockTime = block.timestamp - (await this.provider.getBlock(block.number - 1)).timestamp;
      this.metrics.syncStatus = !syncStatus;
      this.metrics.peerCount = peerCount;
      this.metrics.pendingTransactions = pendingTx;
      this.metrics.networkLatency = Date.now() - startTime;
      this.metrics.lastChecked = Date.now();

      // Store block for reorg detection
      this.blockHistory.set(block.number, block.hash);
      
      // Keep only last 100 blocks
      const oldestBlock = block.number - 100;
      if (this.blockHistory.has(oldestBlock)) {
        this.blockHistory.delete(oldestBlock);
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
      throw error;
    }
  }

  async handleNewBlock(blockNumber) {
    try {
      const block = await this.provider.getBlock(blockNumber);
      const previousBlock = await this.provider.getBlock(blockNumber - 1);
      
      // Check for missed blocks
      if (blockNumber > previousBlock.number + 1) {
        this.metrics.missedBlocks += blockNumber - previousBlock.number - 1;
      }
      
      // Check for reorgs
      if (this.blockHistory.has(blockNumber) && 
          this.blockHistory.get(blockNumber) !== block.hash) {
        this.metrics.chainReorgs++;
        await this.sendAlert('Chain Reorganization', {
          blockNumber,
          oldHash: this.blockHistory.get(blockNumber),
          newHash: block.hash,
          timestamp: new Date().toISOString()
        });
      }
      
      // Update block history
      this.blockHistory.set(blockNumber, block.hash);
    } catch (error) {
      console.error('Error handling new block:', error);
    }
  }

  async checkHealthAlerts() {
    // Check block time
    const maxBlockTime = parseInt(process.env.MAX_BLOCK_TIME || '30');
    if (this.metrics.blockTime > maxBlockTime) {
      await this.sendAlert('High Block Time', {
        blockTime: this.metrics.blockTime,
        threshold: maxBlockTime,
        timestamp: new Date().toISOString()
      });
    }

    // Check peer count
    const minPeers = parseInt(process.env.MIN_PEER_COUNT || '3');
    if (this.metrics.peerCount < minPeers) {
      await this.sendAlert('Low Peer Count', {
        peerCount: this.metrics.peerCount,
        minimum: minPeers,
        timestamp: new Date().toISOString()
      });
    }

    // Check sync status
    if (!this.metrics.syncStatus) {
      await this.sendAlert('Node Not Synced', {
        blockHeight: this.metrics.blockHeight,
        timestamp: new Date().toISOString()
      });
    }

    // Check network latency
    const maxLatency = parseInt(process.env.MAX_NETWORK_LATENCY || '1000');
    if (this.metrics.networkLatency > maxLatency) {
      await this.sendAlert('High Network Latency', {
        latency: this.metrics.networkLatency,
        threshold: maxLatency,
        timestamp: new Date().toISOString()
      });
    }

    // Check pending transactions
    const maxPending = parseInt(process.env.MAX_PENDING_TRANSACTIONS || '5000');
    if (this.metrics.pendingTransactions > maxPending) {
      await this.sendAlert('High Pending Transactions', {
        pending: this.metrics.pendingTransactions,
        threshold: maxPending,
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
          text: `🔍 *${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🔍 **${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[NETWORK ALERT] ${type}:`, data);
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Network Metrics:', {
      blockHeight: this.metrics.blockHeight,
      blockTime: this.metrics.blockTime,
      peerCount: this.metrics.peerCount,
      syncStatus: this.metrics.syncStatus,
      networkLatency: this.metrics.networkLatency,
      pendingTransactions: this.metrics.pendingTransactions,
      chainReorgs: this.metrics.chainReorgs,
      missedBlocks: this.metrics.missedBlocks,
      lastChecked: new Date(this.metrics.lastChecked).toISOString()
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      'network_block_height': this.metrics.blockHeight,
      'network_block_time': this.metrics.blockTime,
      'network_peer_count': this.metrics.peerCount,
      'network_sync_status': this.metrics.syncStatus ? 1 : 0,
      'network_latency': this.metrics.networkLatency,
      'network_pending_transactions': this.metrics.pendingTransactions,
      'network_chain_reorgs': this.metrics.chainReorgs,
      'network_missed_blocks': this.metrics.missedBlocks
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
  const monitor = new NetworkHealthMonitor(provider);
  await monitor.initialize();
  
  // Start monitoring
  await monitor.monitorNetwork();
}

if (require.main === module) {
  main().catch(console.error);
} 