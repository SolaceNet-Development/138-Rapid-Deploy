#!/usr/bin/env node

import { providers, Contract, BigNumber, utils } from 'ethers';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    bridgeAddress: string;
    tokenList: string[];
}

interface BridgeMetrics {
    totalTransfers: number;
    activeTransfers: number;
    completedTransfers: number;
    failedTransfers: number;
    averageCompletionTime: number;
    tvl: BigNumber;
    successRate: number;
    recentTransactions: {
        hash: string;
        status: 'pending' | 'completed' | 'failed';
        timestamp: number;
    }[];
}

interface CrossChainConfig {
    chains: ChainConfig[];
    thresholds: {
        maxPendingTransfers: number;
        maxFailedTransfers: number;
        minSuccessRate: number;
        maxCompletionTime: number;
        minTVL: string;
    };
}

class CrossChainMonitor {
    private providers: Map<number, providers.Provider>;
    private bridges: Map<number, Contract>;
    private metrics: Map<number, BridgeMetrics>;
    private config: CrossChainConfig;

    constructor(config: CrossChainConfig) {
        this.config = config;
        this.providers = new Map();
        this.bridges = new Map();
        this.metrics = new Map();
    }

    async initialize(): Promise<void> {
        // Initialize providers and contracts for each chain
        for (const chain of this.config.chains) {
            // Set up provider
            const provider = new providers.JsonRpcProvider(chain.rpcUrl);
            this.providers.set(chain.chainId, provider);

            // Set up bridge contract
            const bridge = new Contract(
                chain.bridgeAddress,
                [
                    'function getMessageFee() view returns (uint256)',
                    'function messageStatus(bytes32 messageId) view returns (uint8)',
                    'function getTotalBridged() view returns (uint256)',
                    'function getActiveTransfers() view returns (uint256)',
                    'function getSuccessRate() view returns (uint256)',
                    'event TokensBridged(address token, uint256 amount, address recipient, bytes32 messageId)',
                    'event TokensClaimed(bytes32 messageId, bool success)',
                    'event MessageFailed(bytes32 messageId, string reason)'
                ],
                provider
            );
            this.bridges.set(chain.chainId, bridge);

            // Initialize metrics
            this.metrics.set(chain.chainId, {
                totalTransfers: 0,
                activeTransfers: 0,
                completedTransfers: 0,
                failedTransfers: 0,
                averageCompletionTime: 0,
                tvl: BigNumber.from(0),
                successRate: 100,
                recentTransactions: []
            });

            // Set up event listeners
            this.setupEventListeners(chain.chainId);
        }
    }

    private setupEventListeners(chainId: number): void {
        const bridge = this.bridges.get(chainId);
        if (!bridge) return;

        // Listen for new bridge transfers
        bridge.on('TokensBridged', async (token: string, amount: BigNumber, recipient: string, messageId: string) => {
            const metrics = this.metrics.get(chainId);
            if (metrics) {
                metrics.totalTransfers++;
                metrics.activeTransfers++;
                metrics.recentTransactions.push({
                    hash: messageId,
                    status: 'pending',
                    timestamp: Date.now()
                });

                await this.updateMetrics(chainId);
                await this.checkLargeTransfer(chainId, amount, recipient);
            }
        });

        // Listen for completed transfers
        bridge.on('TokensClaimed', async (messageId: string, success: boolean) => {
            const metrics = this.metrics.get(chainId);
            if (metrics) {
                metrics.activeTransfers--;
                metrics.completedTransfers++;

                const tx = metrics.recentTransactions.find(t => t.hash === messageId);
                if (tx) {
                    tx.status = 'completed';
                    this.updateAverageCompletionTime(chainId, Date.now() - tx.timestamp);
                }

                await this.updateMetrics(chainId);
            }
        });

        // Listen for failed transfers
        bridge.on('MessageFailed', async (messageId: string, reason: string) => {
            const metrics = this.metrics.get(chainId);
            if (metrics) {
                metrics.activeTransfers--;
                metrics.failedTransfers++;

                const tx = metrics.recentTransactions.find(t => t.hash === messageId);
                if (tx) {
                    tx.status = 'failed';
                }

                await this.updateMetrics(chainId);
                await this.handleFailedTransfer(chainId, messageId, reason);
            }
        });
    }

    async monitorBridges(): Promise<void> {
        while (true) {
            try {
                await this.updateAllMetrics();
                await this.checkBridgeAlerts();
                await this.reportMetrics();
                await this.cleanupOldTransactions();
                
                // Wait before next update
                await sleep(parseInt(process.env.BRIDGE_MONITORING_INTERVAL || '30000'));
            } catch (error) {
                console.error('Error monitoring bridges:', error);
                await sleep(5000);
            }
        }
    }

    private async updateAllMetrics(): Promise<void> {
        for (const chainId of this.bridges.keys()) {
            await this.updateMetrics(chainId);
        }
    }

    private async updateMetrics(chainId: number): Promise<void> {
        const bridge = this.bridges.get(chainId);
        const metrics = this.metrics.get(chainId);
        if (!bridge || !metrics) return;

        try {
            // Update TVL
            metrics.tvl = await this.calculateTVL(chainId);

            // Update success rate
            metrics.successRate = metrics.totalTransfers > 0
                ? ((metrics.completedTransfers / metrics.totalTransfers) * 100)
                : 100;

            // Clean up old transactions
            this.cleanupOldTransactions();
        } catch (error) {
            console.error(`Error updating metrics for chain ${chainId}:`, error);
        }
    }

    private async calculateTVL(chainId: number): Promise<BigNumber> {
        const chain = this.config.chains.find(c => c.chainId === chainId);
        if (!chain) return BigNumber.from(0);

        let tvl = BigNumber.from(0);
        for (const token of chain.tokenList) {
            try {
                const provider = this.providers.get(chainId);
                if (!provider) continue;
                const tokenContract = new Contract(
                    token,
                    ['function balanceOf(address) view returns (uint256)'],
                    provider
                );
                const balance = await (tokenContract as any).balanceOf(chain.bridgeAddress);
                tvl = tvl.add(balance);
            } catch (error) {
                console.error(`Error getting balance for token ${token}:`, error);
            }
        }
        return tvl;
    }

    private updateAverageCompletionTime(chainId: number, completionTime: number): void {
        const metrics = this.metrics.get(chainId);
        if (!metrics) return;

        const oldAvg = metrics.averageCompletionTime;
        const count = metrics.completedTransfers;
        metrics.averageCompletionTime = (oldAvg * (count - 1) + completionTime) / count;
    }

    private async checkLargeTransfer(chainId: number, amount: BigNumber, recipient: string): Promise<void> {
        const chain = this.config.chains.find(c => c.chainId === chainId);
        if (!chain) return;

        // Alert for large transfers (e.g., > 1% of TVL)
        const metrics = this.metrics.get(chainId);
        if (metrics && amount.mul(BigNumber.from(100)).toString() >= metrics.tvl.toString()) {
            await this.sendAlert('Large Transfer Detected', {
                chain: chain.name,
                amount: utils.formatEther(amount),
                recipient,
                timestamp: new Date().toISOString()
            });
        }
    }

    private async handleFailedTransfer(chainId: number, messageId: string, reason: string): Promise<void> {
        const chain = this.config.chains.find(c => c.chainId === chainId);
        if (!chain) return;

        await this.sendAlert('Transfer Failed', {
            chain: chain.name,
            messageId,
            reason,
            timestamp: new Date().toISOString()
        });
    }

    private cleanupOldTransactions(): void {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours
        for (const metrics of this.metrics.values()) {
            metrics.recentTransactions = metrics.recentTransactions.filter(
                tx => tx.timestamp > cutoff
            );
        }
    }

    async checkBridgeAlerts(): Promise<void> {
        for (const [chainId, metrics] of this.metrics.entries()) {
            const chain = this.config.chains.find(c => c.chainId === chainId);
            if (!chain) continue;

            // Check pending transfers
            if (metrics.activeTransfers > this.config.thresholds.maxPendingTransfers) {
                await this.sendAlert('High Pending Transfers', {
                    chain: chain.name,
                    current: metrics.activeTransfers,
                    threshold: this.config.thresholds.maxPendingTransfers,
                    timestamp: new Date().toISOString()
                });
            }

            // Check failed transfers
            if (metrics.failedTransfers > this.config.thresholds.maxFailedTransfers) {
                await this.sendAlert('High Failed Transfers', {
                    chain: chain.name,
                    current: metrics.failedTransfers,
                    threshold: this.config.thresholds.maxFailedTransfers,
                    timestamp: new Date().toISOString()
                });
            }

            // Check success rate
            if (metrics.successRate < this.config.thresholds.minSuccessRate) {
                await this.sendAlert('Low Success Rate', {
                    chain: chain.name,
                    current: metrics.successRate,
                    threshold: this.config.thresholds.minSuccessRate,
                    timestamp: new Date().toISOString()
                });
            }

            // Check completion time
            if (metrics.averageCompletionTime > this.config.thresholds.maxCompletionTime) {
                await this.sendAlert('High Completion Time', {
                    chain: chain.name,
                    current: metrics.averageCompletionTime,
                    threshold: this.config.thresholds.maxCompletionTime,
                    timestamp: new Date().toISOString()
                });
            }

            // Check TVL
            const minTVL = utils.parseEther(this.config.thresholds.minTVL);
            if (metrics.tvl.toString() < minTVL.toString()) {
                await this.sendAlert('Low TVL', {
                    chain: chain.name,
                    current: utils.formatEther(metrics.tvl),
                    threshold: this.config.thresholds.minTVL,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    async sendAlert(type: string, data: unknown): Promise<void> {
        // Send to configured alert channels
        if (process.env.SLACK_WEBHOOK_URL) {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🌉 *Bridge Alert: ${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                })
            });
        }

        if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `🌉 **Bridge Alert: ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
                })
            });
        }

        // Log alert
        console.log(`[BRIDGE ALERT] ${type}:`, data);
    }

    async reportMetrics(): Promise<void> {
        // Output current metrics
        for (const [chainId, metrics] of this.metrics.entries()) {
            const chain = this.config.chains.find(c => c.chainId === chainId);
            if (!chain) continue;

            console.log(`Chain ${chain.name}:`, {
                totalTransfers: metrics.totalTransfers,
                activeTransfers: metrics.activeTransfers,
                completedTransfers: metrics.completedTransfers,
                failedTransfers: metrics.failedTransfers,
                averageCompletionTime: metrics.averageCompletionTime.toFixed(2),
                tvl: utils.formatEther(metrics.tvl),
                successRate: metrics.successRate.toFixed(2)
            });
        }

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    private async pushMetricsToPrometheus(): Promise<void> {
        const metrics: string[] = [];

        for (const [chainId, chainMetrics] of this.metrics.entries()) {
            const chain = this.config.chains.find(c => c.chainId === chainId);
            if (!chain) continue;

            metrics.push(
                `bridge_total_transfers{chain="${chain.name}"} ${chainMetrics.totalTransfers}`,
                `bridge_active_transfers{chain="${chain.name}"} ${chainMetrics.activeTransfers}`,
                `bridge_completed_transfers{chain="${chain.name}"} ${chainMetrics.completedTransfers}`,
                `bridge_failed_transfers{chain="${chain.name}"} ${chainMetrics.failedTransfers}`,
                `bridge_completion_time{chain="${chain.name}"} ${chainMetrics.averageCompletionTime}`,
                `bridge_tvl{chain="${chain.name}"} ${chainMetrics.tvl}`,
                `bridge_success_rate{chain="${chain.name}"} ${chainMetrics.successRate}`
            );
        }

        try {
            await fetch(process.env.PROMETHEUS_PUSH_GATEWAY || '', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: metrics.join('\n')
            });
        } catch (error) {
            console.error('Error pushing metrics to Prometheus:', error);
        }
    }
}

export { CrossChainMonitor, ChainConfig, BridgeMetrics, CrossChainConfig };                  