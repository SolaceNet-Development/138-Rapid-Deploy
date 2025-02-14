#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

class BridgeMonitor {
    constructor(provider, bridgeConfig) {
        this.provider = provider;
        this.bridgeConfig = bridgeConfig;
        this.metrics = {
            totalTransfers: 0,
            activeTransfers: 0,
            completedTransfers: 0,
            failedTransfers: 0,
            averageCompletionTime: 0,
            tvl: ethers.BigNumber.from(0),
            successRate: 0,
            recentTransactions: []
        };
        this.alerts = new Set();
        this.transferTimes = new Map();
    }

    async initialize() {
        // Initialize contracts
        this.sourceContract = new ethers.Contract(
            this.bridgeConfig.sourceChain.bridgeAddress,
            [
                'event TokensBridged(bytes32 indexed messageId, address token, uint256 amount, address recipient)',
                'event MessageSent(bytes32 indexed messageId, address sender, bytes data)',
                'function getMessageFee() view returns (uint256)',
                'function getTotalBridged() view returns (uint256)',
                'function getActiveTransfers() view returns (uint256)',
                'function getSuccessRate() view returns (uint256)'
            ],
            this.provider
        );

        this.destContract = new ethers.Contract(
            this.bridgeConfig.destinationChain.bridgeAddress,
            [
                'event TokensClaimed(bytes32 indexed messageId, address token, uint256 amount, address recipient)',
                'event MessageFailed(bytes32 indexed messageId, bytes reason)',
                'function messageStatus(bytes32) view returns (uint8)'
            ],
            this.provider
        );

        // Set up event listeners
        this.setupEventListeners();

        // Load initial metrics
        await this.updateMetrics();
    }

    setupEventListeners() {
        // Source chain events
        this.sourceContract.on('TokensBridged', async (messageId, token, amount, recipient) => {
            this.transferTimes.set(messageId, Date.now());
            this.metrics.activeTransfers++;
            this.metrics.totalTransfers++;
            this.metrics.recentTransactions.push({
                messageId,
                token,
                amount: amount.toString(),
                recipient,
                status: 'pending',
                timestamp: Date.now()
            });

            await this.checkLargeTransfer(amount, recipient);
        });

        // Destination chain events
        this.destContract.on('TokensClaimed', async (messageId, token, amount, recipient) => {
            const startTime = this.transferTimes.get(messageId);
            if (startTime) {
                const completionTime = Date.now() - startTime;
                this.updateAverageCompletionTime(completionTime);
                this.transferTimes.delete(messageId);
            }

            this.metrics.activeTransfers--;
            this.metrics.completedTransfers++;
            this.updateTransactionStatus(messageId, 'completed');
        });

        this.destContract.on('MessageFailed', async (messageId, reason) => {
            this.metrics.activeTransfers--;
            this.metrics.failedTransfers++;
            this.updateTransactionStatus(messageId, 'failed');
            
            await this.handleFailedTransfer(messageId, reason);
        });
    }

    async monitorBridge() {
        while (true) {
            try {
                await this.updateMetrics();
                await this.checkBridgeAlerts();
                await this.reportMetrics();
                
                // Clean up old transactions
                this.cleanupOldTransactions();
                
                // Wait before next update
                await sleep(parseInt(process.env.BRIDGE_MONITORING_INTERVAL) * 1000 || 30000);
            } catch (error) {
                console.error('Error monitoring bridge:', error);
                await sleep(5000);
            }
        }
    }

    async updateMetrics() {
        // Update TVL
        const tvl = await this.sourceContract.getTotalBridged();
        this.metrics.tvl = tvl;

        // Update success rate
        const successRate = await this.sourceContract.getSuccessRate();
        this.metrics.successRate = successRate.toNumber() / 100; // Assuming 2 decimal places

        // Update active transfers
        const activeTransfers = await this.sourceContract.getActiveTransfers();
        this.metrics.activeTransfers = activeTransfers.toNumber();

        // Calculate completion rate
        if (this.metrics.totalTransfers > 0) {
            this.metrics.completionRate = this.metrics.completedTransfers / this.metrics.totalTransfers;
        }
    }

    async checkBridgeAlerts() {
        // Check high number of pending transfers
        if (this.metrics.activeTransfers > parseInt(process.env.MAX_PENDING_TRANSFERS || '100')) {
            await this.sendAlert('High Pending Transfers', {
                current: this.metrics.activeTransfers,
                threshold: process.env.MAX_PENDING_TRANSFERS,
                timestamp: new Date().toISOString()
            });
        }

        // Check low success rate
        const minSuccessRate = parseFloat(process.env.MIN_SUCCESS_RATE || '0.95');
        if (this.metrics.successRate < minSuccessRate) {
            await this.sendAlert('Low Success Rate', {
                current: this.metrics.successRate,
                threshold: minSuccessRate,
                timestamp: new Date().toISOString()
            });
        }

        // Check high average completion time
        const maxCompletionTime = parseInt(process.env.MAX_COMPLETION_TIME || '3600000');
        if (this.metrics.averageCompletionTime > maxCompletionTime) {
            await this.sendAlert('High Completion Time', {
                current: this.metrics.averageCompletionTime / 1000,
                threshold: maxCompletionTime / 1000,
                timestamp: new Date().toISOString()
            });
        }

        // Check for stuck transfers
        await this.checkStuckTransfers();
    }

    async checkLargeTransfer(amount, recipient) {
        const largeTransferThreshold = ethers.utils.parseEther(
            process.env.LARGE_TRANSFER_THRESHOLD || '1000'
        );

        if (amount.gt(largeTransferThreshold)) {
            await this.sendAlert('Large Transfer Detected', {
                amount: ethers.utils.formatEther(amount),
                recipient,
                threshold: ethers.utils.formatEther(largeTransferThreshold),
                timestamp: new Date().toISOString()
            });
        }
    }

    async handleFailedTransfer(messageId, reason) {
        await this.sendAlert('Transfer Failed', {
            messageId,
            reason: ethers.utils.toUtf8String(reason),
            timestamp: new Date().toISOString()
        });

        // Update failure statistics
        this.updateFailureStats(reason);
    }

    async checkStuckTransfers() {
        const stuckThreshold = parseInt(process.env.STUCK_TRANSFER_THRESHOLD || '3600000');
        const now = Date.now();

        for (const [messageId, startTime] of this.transferTimes.entries()) {
            if (now - startTime > stuckThreshold) {
                await this.sendAlert('Stuck Transfer', {
                    messageId,
                    duration: (now - startTime) / 1000,
                    threshold: stuckThreshold / 1000,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    updateAverageCompletionTime(newTime) {
        const completedCount = this.metrics.completedTransfers;
        this.metrics.averageCompletionTime = 
            (this.metrics.averageCompletionTime * (completedCount - 1) + newTime) / completedCount;
    }

    updateTransactionStatus(messageId, status) {
        const tx = this.metrics.recentTransactions.find(tx => tx.messageId === messageId);
        if (tx) {
            tx.status = status;
            tx.completedAt = status === 'completed' ? Date.now() : undefined;
        }
    }

    updateFailureStats(reason) {
        if (!this.metrics.failureReasons) {
            this.metrics.failureReasons = {};
        }
        const reasonStr = ethers.utils.toUtf8String(reason);
        this.metrics.failureReasons[reasonStr] = (this.metrics.failureReasons[reasonStr] || 0) + 1;
    }

    cleanupOldTransactions() {
        const retentionPeriod = parseInt(process.env.TRANSACTION_RETENTION_PERIOD || '86400000');
        const cutoffTime = Date.now() - retentionPeriod;
        
        this.metrics.recentTransactions = this.metrics.recentTransactions.filter(
            tx => tx.timestamp > cutoffTime
        );
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

        // Add to alert set with cooldown
        this.alerts.add(alertId);
        setTimeout(() => this.alerts.delete(alertId), 
            parseInt(process.env.ALERT_COOLDOWN_PERIOD || '3600000'));

        // Log alert
        console.log(`[BRIDGE ALERT] ${type}:`, data);
    }

    async reportMetrics() {
        // Output current metrics
        console.log('Bridge Metrics:', {
            totalTransfers: this.metrics.totalTransfers,
            activeTransfers: this.metrics.activeTransfers,
            completedTransfers: this.metrics.completedTransfers,
            failedTransfers: this.metrics.failedTransfers,
            successRate: this.metrics.successRate,
            averageCompletionTime: this.metrics.averageCompletionTime / 1000,
            tvl: ethers.utils.formatEther(this.metrics.tvl)
        });

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    async pushMetricsToPrometheus() {
        const metrics = {
            'bridge_total_transfers': this.metrics.totalTransfers,
            'bridge_active_transfers': this.metrics.activeTransfers,
            'bridge_completed_transfers': this.metrics.completedTransfers,
            'bridge_failed_transfers': this.metrics.failedTransfers,
            'bridge_success_rate': this.metrics.successRate,
            'bridge_average_completion_time': this.metrics.averageCompletionTime / 1000,
            'bridge_tvl': parseFloat(ethers.utils.formatEther(this.metrics.tvl))
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
    // Load bridge configuration
    const bridgeConfig = require('../../bridge/ccip/config.json');

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    
    // Initialize monitor
    const monitor = new BridgeMonitor(provider, bridgeConfig);
    await monitor.initialize();
    
    // Start monitoring
    await monitor.monitorBridge();
}

if (require.main === module) {
    main().catch(console.error);
} 