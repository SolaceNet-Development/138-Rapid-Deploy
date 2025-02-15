#!/usr/bin/env node

import { Contract, Signer } from 'ethers';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { JsonRpcProvider, Provider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
import fetch from 'node-fetch';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

interface ProtocolMetrics {
    tvl: BigNumber;
    activeUsers24h: number;
    healthScore: number;
    errorRate: number;
    lendingMetrics: LendingMetrics;
    tradingMetrics: TradingMetrics;
    performanceMetrics: PerformanceMetrics;
}

interface LendingMetrics {
    supplyVolume: Map<string, BigNumber>;
    borrowVolume: Map<string, BigNumber>;
    collateralizationRatio: number;
    liquidationRisk: number[];
}

interface TradingMetrics {
    volumeByDex: Map<string, BigNumber>;
    priceImpact: number;
    slippage: number;
}

interface PerformanceMetrics {
    transactionLatency: number;
    resourceUsage: Map<string, number>;
    gasUsage: BigNumber;
}

interface ProtocolConfig {
    rpcUrl: string;
    contracts: {
        lending: string;
        trading: string;
        liquidation: string;
        oracle: string;
    };
    thresholds: {
        minHealthScore: number;
        maxErrorRate: number;
        minCollateralizationRatio: number;
        maxLiquidationRisk: number;
        maxTransactionLatency: number;
    };
}

class ProtocolMonitor {
    private provider: JsonRpcProvider;
    private metrics: ProtocolMetrics;
    private config: ProtocolConfig;
    private contracts: {
        lending: Contract;
        trading: Contract;
        liquidation: Contract;
        oracle: Contract;
    };

    constructor(config: ProtocolConfig) {
        this.config = config;
        this.provider = new JsonRpcProvider(config.rpcUrl);
        this.metrics = this.initializeMetrics();
        this.contracts = this.initializeContracts();
    }

    private initializeMetrics(): ProtocolMetrics {
        return {
            tvl: BigNumber.from(0),
            activeUsers24h: 0,
            healthScore: 100,
            errorRate: 0,
            lendingMetrics: {
                supplyVolume: new Map(),
                borrowVolume: new Map(),
                collateralizationRatio: 0,
                liquidationRisk: []
            },
            tradingMetrics: {
                volumeByDex: new Map(),
                priceImpact: 0,
                slippage: 0
            },
            performanceMetrics: {
                transactionLatency: 0,
                resourceUsage: new Map(),
                gasUsage: BigNumber.from(0)
            }
        };
    }

    private initializeContracts() {
        return {
            lending: new Contract(
                this.config.contracts.lending,
                [
                    'function getTotalSupply(address token) view returns (uint256)',
                    'function getTotalBorrow(address token) view returns (uint256)',
                    'function getCollateralizationRatio() view returns (uint256)',
                    'function getLiquidationRisks() view returns (uint256[])',
                    'event Supply(address token, address user, uint256 amount)',
                    'event Borrow(address token, address user, uint256 amount)',
                    'event Liquidation(address user, address token, uint256 amount)'
                ],
                this.provider as any
            ),
            trading: new Contract(
                this.config.contracts.trading,
                [
                    'function getVolumeByDex(address dex) view returns (uint256)',
                    'function getPriceImpact() view returns (uint256)',
                    'function getSlippage() view returns (uint256)',
                    'event Trade(address dex, address token0, address token1, uint256 amount)'
                ],
                this.provider as any
            ),
            liquidation: new Contract(
                this.config.contracts.liquidation,
                [
                    'function getLiquidationThreshold() view returns (uint256)',
                    'event LiquidationTriggered(address user, uint256 amount)'
                ],
                this.provider as any
            ),
            oracle: new Contract(
                this.config.contracts.oracle,
                [
                    'function getPrice(address token) view returns (uint256)',
                    'event PriceUpdate(address token, uint256 price)'
                ],
                this.provider as any
            )
        };
    }

    async initialize(): Promise<void> {
        // Set up event listeners
        this.setupEventListeners();
        
        // Initial metrics update
        await this.updateMetrics();
    }

    private setupEventListeners(): void {
        // Lending events
        this.contracts.lending.on('Supply', async (token, user, amount) => {
            const currentSupply = this.metrics.lendingMetrics.supplyVolume.get(token) || BigNumber.from(0);
            this.metrics.lendingMetrics.supplyVolume.set(token, currentSupply.add(amount));
            await this.updateMetrics();
        });

        this.contracts.lending.on('Borrow', async (token, user, amount) => {
            const currentBorrow = this.metrics.lendingMetrics.borrowVolume.get(token) || BigNumber.from(0);
            this.metrics.lendingMetrics.borrowVolume.set(token, currentBorrow.add(amount));
            await this.updateMetrics();
        });

        // Trading events
        this.contracts.trading.on('Trade', async (dex, token0, token1, amount) => {
            const currentVolume = this.metrics.tradingMetrics.volumeByDex.get(dex) || BigNumber.from(0);
            this.metrics.tradingMetrics.volumeByDex.set(dex, currentVolume.add(amount));
            await this.updateMetrics();
        });

        // Liquidation events
        this.contracts.liquidation.on('LiquidationTriggered', async (user, amount) => {
            await this.checkLiquidationRisk();
            await this.updateMetrics();
        });

        // Oracle events
        this.contracts.oracle.on('PriceUpdate', async (token, price) => {
            await this.updateTVL();
            await this.updateMetrics();
        });
    }

    async monitorProtocol(): Promise<void> {
        while (true) {
            try {
                await this.updateMetrics();
                await this.checkAlerts();
                await this.reportMetrics();
                
                // Wait before next update
                await sleep(parseInt(process.env.PROTOCOL_MONITORING_INTERVAL || '30000'));
            } catch (error) {
                console.error('Error monitoring protocol:', error);
                await sleep(5000);
            }
        }
    }

    private async updateMetrics(): Promise<void> {
        // Update TVL
        await this.updateTVL();

        // Update active users
        this.metrics.activeUsers24h = await this.getActiveUsers24h();

        // Update lending metrics
        this.metrics.lendingMetrics.collateralizationRatio = 
            (await (this.contracts.lending as any).getCollateralizationRatio()).toNumber() / 100;
        this.metrics.lendingMetrics.liquidationRisk = 
            await (this.contracts.lending as any).getLiquidationRisks();

        // Update trading metrics
        this.metrics.tradingMetrics.priceImpact = 
            (await (this.contracts.trading as any).getPriceImpact()).toNumber() / 100;
        this.metrics.tradingMetrics.slippage = 
            (await (this.contracts.trading as any).getSlippage()).toNumber() / 100;

        // Update performance metrics
        this.metrics.performanceMetrics.transactionLatency = 
            await this.measureTransactionLatency();
        this.metrics.performanceMetrics.gasUsage = 
            await this.provider.getGasPrice();

        // Calculate health score
        this.updateHealthScore();
    }

    private async updateTVL(): Promise<void> {
        let tvl = BigNumber.from(0);
        for (const [token, supply] of this.metrics.lendingMetrics.supplyVolume.entries()) {
            const price = await (this.contracts.oracle as any).getPrice(token);
            tvl = tvl.add(supply.mul(price));
        }
        this.metrics.tvl = tvl;
    }

    private async getActiveUsers24h(): Promise<number> {
        // Implementation to get unique users in last 24h
        return 0;
    }

    private async measureTransactionLatency(): Promise<number> {
        // Implementation to measure average transaction confirmation time
        return 0;
    }

    private async checkLiquidationRisk(): Promise<void> {
        const risks = await (this.contracts.lending as any).getLiquidationRisks();
        this.metrics.lendingMetrics.liquidationRisk = risks;

        if (Math.max(...risks) > this.config.thresholds.maxLiquidationRisk) {
            await this.sendAlert('High Liquidation Risk', {
                currentRisk: Math.max(...risks),
                threshold: this.config.thresholds.maxLiquidationRisk,
                timestamp: new Date().toISOString()
            });
        }
    }

    private updateHealthScore(): void {
        let score = 100;

        // Penalize for high error rate
        if (this.metrics.errorRate > this.config.thresholds.maxErrorRate) {
            score -= 20 * (this.metrics.errorRate / this.config.thresholds.maxErrorRate);
        }

        // Penalize for low collateralization
        if (this.metrics.lendingMetrics.collateralizationRatio < this.config.thresholds.minCollateralizationRatio) {
            score -= 20 * (1 - this.metrics.lendingMetrics.collateralizationRatio / this.config.thresholds.minCollateralizationRatio);
        }

        // Penalize for high liquidation risk
        const maxRisk = Math.max(...this.metrics.lendingMetrics.liquidationRisk);
        if (maxRisk > this.config.thresholds.maxLiquidationRisk) {
            score -= 20 * (maxRisk / this.config.thresholds.maxLiquidationRisk);
        }

        // Penalize for high latency
        if (this.metrics.performanceMetrics.transactionLatency > this.config.thresholds.maxTransactionLatency) {
            score -= 20 * (this.metrics.performanceMetrics.transactionLatency / this.config.thresholds.maxTransactionLatency);
        }

        this.metrics.healthScore = Math.max(0, score);
    }

    async checkAlerts(): Promise<void> {
        // Check health score
        if (this.metrics.healthScore < this.config.thresholds.minHealthScore) {
            await this.sendAlert('Low Health Score', {
                current: this.metrics.healthScore,
                threshold: this.config.thresholds.minHealthScore,
                timestamp: new Date().toISOString()
            });
        }

        // Check error rate
        if (this.metrics.errorRate > this.config.thresholds.maxErrorRate) {
            await this.sendAlert('High Error Rate', {
                current: this.metrics.errorRate,
                threshold: this.config.thresholds.maxErrorRate,
                timestamp: new Date().toISOString()
            });
        }

        // Check collateralization ratio
        if (this.metrics.lendingMetrics.collateralizationRatio < this.config.thresholds.minCollateralizationRatio) {
            await this.sendAlert('Low Collateralization Ratio', {
                current: this.metrics.lendingMetrics.collateralizationRatio,
                threshold: this.config.thresholds.minCollateralizationRatio,
                timestamp: new Date().toISOString()
            });
        }

        // Check transaction latency
        if (this.metrics.performanceMetrics.transactionLatency > this.config.thresholds.maxTransactionLatency) {
            await this.sendAlert('High Transaction Latency', {
                current: this.metrics.performanceMetrics.transactionLatency,
                threshold: this.config.thresholds.maxTransactionLatency,
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

        // Log alert
        console.log(`[PROTOCOL ALERT] ${type}:`, data);
    }

    async reportMetrics(): Promise<void> {
        // Output current metrics
        console.log('Protocol Metrics:', {
            tvl: formatUnits(this.metrics.tvl, 18),
            activeUsers24h: this.metrics.activeUsers24h,
            healthScore: this.metrics.healthScore.toFixed(2),
            errorRate: this.metrics.errorRate.toFixed(2),
            lendingMetrics: {
                collateralizationRatio: this.metrics.lendingMetrics.collateralizationRatio.toFixed(2),
                liquidationRisk: this.metrics.lendingMetrics.liquidationRisk.map(r => r.toFixed(2))
            },
            tradingMetrics: {
                priceImpact: this.metrics.tradingMetrics.priceImpact.toFixed(2),
                slippage: this.metrics.tradingMetrics.slippage.toFixed(2)
            },
            performanceMetrics: {
                transactionLatency: this.metrics.performanceMetrics.transactionLatency.toFixed(2),
                gasPrice: formatUnits(this.metrics.performanceMetrics.gasUsage, 'gwei')
            }
        });

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    private async pushMetricsToPrometheus(): Promise<void> {
        const metrics: string[] = [];

        // Protocol metrics
        metrics.push(
            `protocol_tvl ${this.metrics.tvl}`,
            `protocol_active_users_24h ${this.metrics.activeUsers24h}`,
            `protocol_health_score ${this.metrics.healthScore}`,
            `protocol_error_rate ${this.metrics.errorRate}`
        );

        // Lending metrics
        metrics.push(
            `lending_collateralization_ratio ${this.metrics.lendingMetrics.collateralizationRatio}`
        );
        this.metrics.lendingMetrics.liquidationRisk.forEach((risk, index) => {
            metrics.push(`lending_liquidation_risk{bucket="${index}"} ${risk}`);
        });

        // Supply and borrow volumes
        for (const [token, amount] of this.metrics.lendingMetrics.supplyVolume.entries()) {
            metrics.push(`lending_supply_volume{token="${token}"} ${amount}`);
        }
        for (const [token, amount] of this.metrics.lendingMetrics.borrowVolume.entries()) {
            metrics.push(`lending_borrow_volume{token="${token}"} ${amount}`);
        }

        // Trading metrics
        metrics.push(
            `trading_price_impact ${this.metrics.tradingMetrics.priceImpact}`,
            `trading_slippage ${this.metrics.tradingMetrics.slippage}`
        );
        for (const [dex, volume] of this.metrics.tradingMetrics.volumeByDex.entries()) {
            metrics.push(`dex_trading_volume_usd{dex="${dex}"} ${volume}`);
        }

        // Performance metrics
        metrics.push(
            `protocol_transaction_latency ${this.metrics.performanceMetrics.transactionLatency}`,
            `protocol_gas_price ${this.metrics.performanceMetrics.gasUsage}`
        );
        for (const [resource, usage] of this.metrics.performanceMetrics.resourceUsage.entries()) {
            metrics.push(`protocol_resource_usage{resource="${resource}"} ${usage}`);
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

export { ProtocolMonitor, ProtocolMetrics, ProtocolConfig };                              