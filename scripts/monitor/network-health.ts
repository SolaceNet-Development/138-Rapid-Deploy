#!/usr/bin/env node

import { ethers } from 'ethers';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

interface NetworkMetrics {
  blockHeight: number;
  blockTime: number;
  gasPrice: ethers.BigNumber;
  peerCount: number;
  pendingTxCount: number;
  networkLatency: number;
  syncStatus: boolean;
  lastBlockTimestamp: number;
  uncleCount: number;
  tps: number;
  nodeVersion: string;
  chainId: number;
  consensusHealth: number;
}

interface NetworkConfig {
  rpcEndpoints: string[];
  healthThresholds: {
    maxBlockTime: number;
    minPeerCount: number;
    maxPendingTx: number;
    maxNetworkLatency: number;
    minTps: number;
    maxUncleRate: number;
  };
}

class NetworkHealthMonitor {
  private provider: ethers.providers.JsonRpcProvider;
  private config: NetworkConfig;
  private metrics: NetworkMetrics;
  private blockTimes: number[];
  private tpsHistory: number[];
  private uncleHistory: number[];

  constructor(provider: ethers.providers.JsonRpcProvider, config: NetworkConfig) {
    this.provider = provider;
    this.config = config;
    this.blockTimes = [];
    this.tpsHistory = [];
    this.uncleHistory = [];
    this.metrics = {
      blockHeight: 0,
      blockTime: 0,
      gasPrice: ethers.BigNumber.from(0),
      peerCount: 0,
      pendingTxCount: 0,
      networkLatency: 0,
      syncStatus: true,
      lastBlockTimestamp: 0,
      uncleCount: 0,
      tps: 0,
      nodeVersion: '',
      chainId: 0,
      consensusHealth: 100
    };
  }

  async initialize(): Promise<void> {
    // Get initial network state
    const [network, version] = await Promise.all([
      this.provider.getNetwork(),
      this.provider.send('web3_clientVersion', [])
    ]);

    this.metrics.chainId = network.chainId;
    this.metrics.nodeVersion = version;

    // Set up event listeners
    this.provider.on('block', async (blockNumber) => {
      await this.handleNewBlock(blockNumber);
    });
  }

  async monitorNetwork(): Promise<void> {
    while (true) {
      try {
        await this.updateMetrics();
        await this.checkHealthStatus();
        await this.reportMetrics();

        // Wait before next update
        await sleep(parseInt(process.env.NETWORK_MONITORING_INTERVAL || '30000'));
      } catch (error) {
        console.error('Error monitoring network:', error);
        await sleep(5000);
      }
    }
  }

  async updateMetrics(): Promise<void> {
    const [blockNumber, gasPrice, peerCount, pendingTxCount, syncStatus] = await Promise.all([
      this.provider.getBlockNumber(),
      this.provider.getGasPrice(),
      this.provider.send('net_peerCount', []),
      this.provider.send('txpool_status', []),
      this.provider.send('eth_syncing', [])
    ]);

    // Update metrics
    this.metrics.blockHeight = blockNumber;
    this.metrics.gasPrice = gasPrice;
    this.metrics.peerCount = parseInt(peerCount, 16);
    this.metrics.pendingTxCount = pendingTxCount.pending;
    this.metrics.syncStatus = syncStatus === false;

    // Measure network latency
    const start = Date.now();
    await this.provider.getBlockNumber();
    this.metrics.networkLatency = Date.now() - start;

    // Update derived metrics
    this.updateBlockMetrics();
    this.updateTpsMetrics();
    this.updateConsensusHealth();
  }

  async handleNewBlock(blockNumber: number): Promise<void> {
    const block = await this.provider.getBlock(blockNumber);

    // Update block times
    if (this.metrics.lastBlockTimestamp > 0) {
      const blockTime = block.timestamp - this.metrics.lastBlockTimestamp;
      this.blockTimes.push(blockTime);
      if (this.blockTimes.length > 100) this.blockTimes.shift();
    }
    this.metrics.lastBlockTimestamp = block.timestamp;

    // Update TPS
    this.tpsHistory.push(block.transactions.length);
    if (this.tpsHistory.length > 100) this.tpsHistory.shift();

    // Update uncle count
    if (block.uncles && block.uncles.length > 0) {
      this.uncleHistory.push(block.uncles.length);
      if (this.uncleHistory.length > 100) this.uncleHistory.shift();
    }

    // Trigger metrics update
    await this.updateMetrics();
  }

  private updateBlockMetrics(): void {
    if (this.blockTimes.length > 0) {
      this.metrics.blockTime = this.blockTimes.reduce((a, b) => a + b, 0) / this.blockTimes.length;
    }
  }

  private updateTpsMetrics(): void {
    if (this.tpsHistory.length > 0) {
      const totalTx = this.tpsHistory.reduce((a, b) => a + b, 0);
      const timespan = this.blockTimes.reduce((a, b) => a + b, 0);
      this.metrics.tps = timespan > 0 ? totalTx / timespan : 0;
    }
  }

  private updateConsensusHealth(): void {
    let health = 100;

    // Penalize for high block times
    if (this.metrics.blockTime > this.config.healthThresholds.maxBlockTime) {
      health -= 20;
    }

    // Penalize for low peer count
    if (this.metrics.peerCount < this.config.healthThresholds.minPeerCount) {
      health -= 15;
    }

    // Penalize for high uncle rate
    const uncleRate = this.uncleHistory.reduce((a, b) => a + b, 0) / this.uncleHistory.length;
    if (uncleRate > this.config.healthThresholds.maxUncleRate) {
      health -= 15;
    }

    // Penalize for low TPS
    if (this.metrics.tps < this.config.healthThresholds.minTps) {
      health -= 10;
    }

    // Penalize for high network latency
    if (this.metrics.networkLatency > this.config.healthThresholds.maxNetworkLatency) {
      health -= 10;
    }

    // Penalize for sync issues
    if (!this.metrics.syncStatus) {
      health -= 30;
    }

    this.metrics.consensusHealth = Math.max(0, health);
  }

  async checkHealthStatus(): Promise<void> {
    // Check block time
    if (this.metrics.blockTime > this.config.healthThresholds.maxBlockTime) {
      await this.sendAlert('High Block Time', {
        current: this.metrics.blockTime,
        threshold: this.config.healthThresholds.maxBlockTime,
        timestamp: new Date().toISOString()
      });
    }

    // Check peer count
    if (this.metrics.peerCount < this.config.healthThresholds.minPeerCount) {
      await this.sendAlert('Low Peer Count', {
        current: this.metrics.peerCount,
        threshold: this.config.healthThresholds.minPeerCount,
        timestamp: new Date().toISOString()
      });
    }

    // Check pending transactions
    if (this.metrics.pendingTxCount > this.config.healthThresholds.maxPendingTx) {
      await this.sendAlert('High Pending Transaction Count', {
        current: this.metrics.pendingTxCount,
        threshold: this.config.healthThresholds.maxPendingTx,
        timestamp: new Date().toISOString()
      });
    }

    // Check network latency
    if (this.metrics.networkLatency > this.config.healthThresholds.maxNetworkLatency) {
      await this.sendAlert('High Network Latency', {
        current: this.metrics.networkLatency,
        threshold: this.config.healthThresholds.maxNetworkLatency,
        timestamp: new Date().toISOString()
      });
    }

    // Check consensus health
    if (this.metrics.consensusHealth < 70) {
      await this.sendAlert('Low Consensus Health', {
        current: this.metrics.consensusHealth,
        threshold: 70,
        timestamp: new Date().toISOString()
      });
    }
  }

  async sendAlert(type: string, data: unknown): Promise<void> {
    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🌐 *Network Alert: ${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🌐 **Network Alert: ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[NETWORK ALERT] ${type}:`, data);
  }

  async reportMetrics(): Promise<void> {
    // Output current metrics
    console.log('Network Metrics:', {
      blockHeight: this.metrics.blockHeight,
      blockTime: this.metrics.blockTime.toFixed(2),
      gasPrice: ethers.utils.formatUnits(this.metrics.gasPrice, 'gwei'),
      peerCount: this.metrics.peerCount,
      pendingTxCount: this.metrics.pendingTxCount,
      networkLatency: this.metrics.networkLatency.toFixed(2),
      syncStatus: this.metrics.syncStatus,
      tps: this.metrics.tps.toFixed(2),
      consensusHealth: this.metrics.consensusHealth
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus(): Promise<void> {
    const metrics = {
      network_block_height: this.metrics.blockHeight,
      network_block_time: this.metrics.blockTime,
      network_gas_price: parseFloat(ethers.utils.formatUnits(this.metrics.gasPrice, 'gwei')),
      network_peer_count: this.metrics.peerCount,
      network_pending_tx_count: this.metrics.pendingTxCount,
      network_latency: this.metrics.networkLatency,
      network_sync_status: this.metrics.syncStatus ? 1 : 0,
      network_tps: this.metrics.tps,
      network_uncle_count: this.metrics.uncleCount,
      network_consensus_health: this.metrics.consensusHealth
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
  // Load network configuration
  const config: NetworkConfig = {
    rpcEndpoints: [process.env.RPC_URL],
    healthThresholds: {
      maxBlockTime: parseInt(process.env.MAX_BLOCK_TIME || '30'),
      minPeerCount: parseInt(process.env.MIN_PEER_COUNT || '3'),
      maxPendingTx: parseInt(process.env.MAX_PENDING_TX || '5000'),
      maxNetworkLatency: parseInt(process.env.MAX_NETWORK_LATENCY || '1000'),
      minTps: parseInt(process.env.MIN_TPS || '10'),
      maxUncleRate: parseFloat(process.env.MAX_UNCLE_RATE || '0.1')
    }
  };

  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  // Initialize monitor
  const monitor = new NetworkHealthMonitor(provider, config);
  await monitor.initialize();

  // Start monitoring
  await monitor.monitorNetwork();
}

if (require.main === module) {
  main().catch(console.error);
}
