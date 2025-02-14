#!/usr/bin/env node

import { ethers } from 'ethers';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

interface GasMetrics {
    currentPrice: ethers.BigNumber;
    historicalPrices: {
        timestamp: number;
        price: ethers.BigNumber;
        blockNumber: number;
    }[];
    movingAverages: {
        short: number;  // 5 minutes
        medium: number; // 1 hour
        long: number;   // 24 hours
    };
    statistics: {
        volatility: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        percentile95: number;
        minPrice24h: ethers.BigNumber;
        maxPrice24h: ethers.BigNumber;
        medianPrice: number;
    };
    predictions: {
        nextHour: number;
        nextDay: number;
        confidence: number;
    };
    optimizationMetrics: {
        recommendedBaseFee: ethers.BigNumber;
        recommendedPriorityFee: ethers.BigNumber;
        estimatedSavings: number;
        optimalSubmissionTime: number;
    };
}

interface GasConfig {
    rpcUrl: string;
    priceFeeds: {
        ethGas: string;
        fastGas: string;
    };
    thresholds: {
        highGasPrice: number;
        extremeGasPrice: number;
        volatilityThreshold: number;
        predictionConfidenceThreshold: number;
    };
    updateInterval: number;
    historicalDataWindow: number;
}

class GasMonitor {
    private provider: ethers.providers.Provider;
    private metrics: GasMetrics;
    private config: GasConfig;
    private priceFeeds: {
        ethGas: ethers.Contract;
        fastGas: ethers.Contract;
    };
    private lastUpdate: number;
    private historicalData: Map<number, ethers.BigNumber>;
    private movingAverageWindows: number[];

    constructor(config: GasConfig) {
        this.config = config;
        this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        this.metrics = this.initializeMetrics();
        this.priceFeeds = this.initializePriceFeeds();
        this.lastUpdate = 0;
        this.historicalData = new Map();
        this.movingAverageWindows = [5 * 60, 60 * 60, 24 * 60 * 60]; // 5min, 1h, 24h in seconds
    }

    private initializeMetrics(): GasMetrics {
        return {
            currentPrice: ethers.BigNumber.from(0),
            historicalPrices: [],
            movingAverages: {
                short: 0,
                medium: 0,
                long: 0
            },
            statistics: {
                volatility: 0,
                trend: 'stable',
                percentile95: 0,
                minPrice24h: ethers.BigNumber.from(0),
                maxPrice24h: ethers.BigNumber.from(0),
                medianPrice: 0
            },
            predictions: {
                nextHour: 0,
                nextDay: 0,
                confidence: 0
            },
            optimizationMetrics: {
                recommendedBaseFee: ethers.BigNumber.from(0),
                recommendedPriorityFee: ethers.BigNumber.from(0),
                estimatedSavings: 0,
                optimalSubmissionTime: 0
            }
        };
    }

    private initializePriceFeeds() {
        const feedABI = [
            'function latestAnswer() view returns (int256)',
            'function latestRound() view returns (uint256)',
            'function getRoundData(uint256 roundId) view returns (uint256, int256, uint256, uint256, uint256)'
        ];

        return {
            ethGas: new ethers.Contract(this.config.priceFeeds.ethGas, feedABI, this.provider),
            fastGas: new ethers.Contract(this.config.priceFeeds.fastGas, feedABI, this.provider)
        };
    }

    async initialize(): Promise<void> {
        // Load historical data
        await this.loadHistoricalData();
        
        // Initial metrics update
        await this.updateGasMetrics();
        
        // Set up block listeners
        this.provider.on('block', async (blockNumber) => {
            const now = Date.now();
            if (now - this.lastUpdate >= this.config.updateInterval) {
                await this.updateGasMetrics();
                this.lastUpdate = now;
            }
        });
    }

    private async loadHistoricalData(): Promise<void> {
        const currentBlock = await this.provider.getBlockNumber();
        const historicalBlocks = Array.from(
            { length: this.config.historicalDataWindow },
            (_, i) => currentBlock - i
        );

        for (const blockNumber of historicalBlocks) {
            try {
                const block = await this.provider.getBlock(blockNumber);
                if (block && block.baseFeePerGas) {
                    this.historicalData.set(blockNumber, block.baseFeePerGas);
                    this.metrics.historicalPrices.push({
                        timestamp: block.timestamp,
                        price: block.baseFeePerGas,
                        blockNumber
                    });
                }
            } catch (error) {
                console.error(`Error loading historical data for block ${blockNumber}:`, error);
            }
        }

        // Sort historical prices by timestamp
        this.metrics.historicalPrices.sort((a, b) => a.timestamp - b.timestamp);
    }

    async monitorGasPrices(): Promise<void> {
        while (true) {
            try {
                await this.updateGasMetrics();
                await this.predictGasPrices();
                await this.checkGasAlerts();
                await this.reportMetrics();
                
                // Wait before next update
                await sleep(this.config.updateInterval);
            } catch (error) {
                console.error('Error monitoring gas prices:', error);
                await sleep(5000);
            }
        }
    }

    private async updateGasMetrics(): Promise<void> {
        // Get current gas price
        const currentPrice = await this.getCurrentGasPrice();
        this.metrics.currentPrice = currentPrice;

        // Update historical data
        const currentBlock = await this.provider.getBlockNumber();
        const block = await this.provider.getBlock(currentBlock);
        if (block && block.baseFeePerGas) {
            this.historicalData.set(currentBlock, block.baseFeePerGas);
            this.metrics.historicalPrices.push({
                timestamp: block.timestamp,
                price: block.baseFeePerGas,
                blockNumber: currentBlock
            });
        }

        // Clean up old data
        const oldestAllowedTimestamp = Date.now() - this.config.historicalDataWindow * 1000;
        this.metrics.historicalPrices = this.metrics.historicalPrices.filter(
            p => p.timestamp * 1000 > oldestAllowedTimestamp
        );

        // Update moving averages
        this.updateMovingAverages(currentPrice);

        // Update statistics
        this.updateStatistics();

        // Update optimization metrics
        await this.updateOptimizationMetrics();
    }

    private async getCurrentGasPrice(): Promise<ethers.BigNumber> {
        try {
            // Try getting from price feeds first
            const [ethGasPrice, fastGasPrice] = await Promise.all([
                this.getGasPriceFromFeed(this.priceFeeds.ethGas),
                this.getGasPriceFromFeed(this.priceFeeds.fastGas)
            ]);

            if (ethGasPrice && fastGasPrice) {
                // Use the average of both feeds
                return ethGasPrice.add(fastGasPrice).div(2);
            }
        } catch (error) {
            console.error('Error getting gas price from feeds:', error);
        }

        // Fallback to provider's gas price
        return await this.provider.getGasPrice();
    }

    private async getGasPriceFromFeed(feed: ethers.Contract): Promise<ethers.BigNumber | null> {
        try {
            const roundData = await feed.latestRoundData();
            if (roundData && roundData.answer) {
                return ethers.BigNumber.from(roundData.answer);
            }
        } catch (error) {
            console.error('Error getting price from feed:', error);
        }
        return null;
    }

    private updateMovingAverages(currentPrice: ethers.BigNumber): void {
        const now = Date.now();
        const prices = this.metrics.historicalPrices;

        // Calculate moving averages for different windows
        this.metrics.movingAverages.short = this.calculateAverage(
            prices.filter(p => p.timestamp * 1000 > now - 5 * 60 * 1000)
                .map(p => parseFloat(ethers.utils.formatUnits(p.price, 'gwei')))
        );

        this.metrics.movingAverages.medium = this.calculateAverage(
            prices.filter(p => p.timestamp * 1000 > now - 60 * 60 * 1000)
                .map(p => parseFloat(ethers.utils.formatUnits(p.price, 'gwei')))
        );

        this.metrics.movingAverages.long = this.calculateAverage(
            prices.filter(p => p.timestamp * 1000 > now - 24 * 60 * 60 * 1000)
                .map(p => parseFloat(ethers.utils.formatUnits(p.price, 'gwei')))
        );
    }

    private updateStatistics(): void {
        const prices = this.metrics.historicalPrices.map(p => 
            parseFloat(ethers.utils.formatUnits(p.price, 'gwei'))
        );

        // Calculate volatility (standard deviation)
        const mean = this.calculateAverage(prices);
        const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
        this.metrics.statistics.volatility = Math.sqrt(this.calculateAverage(squaredDiffs));

        // Determine trend
        const recentPrices = prices.slice(-10);
        const recentMean = this.calculateAverage(recentPrices);
        const oldMean = this.calculateAverage(prices.slice(0, 10));
        
        if (recentMean > oldMean * 1.05) {
            this.metrics.statistics.trend = 'increasing';
        } else if (recentMean < oldMean * 0.95) {
            this.metrics.statistics.trend = 'decreasing';
        } else {
            this.metrics.statistics.trend = 'stable';
        }

        // Calculate percentile95
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const index = Math.floor(sortedPrices.length * 0.95);
        this.metrics.statistics.percentile95 = sortedPrices[index];

        // Update min/max prices
        const last24hPrices = this.metrics.historicalPrices.filter(
            p => p.timestamp * 1000 > Date.now() - 24 * 60 * 60 * 1000
        );
        this.metrics.statistics.minPrice24h = last24hPrices.reduce(
            (min, p) => p.price.lt(min) ? p.price : min,
            last24hPrices[0].price
        );
        this.metrics.statistics.maxPrice24h = last24hPrices.reduce(
            (max, p) => p.price.gt(max) ? p.price : max,
            last24hPrices[0].price
        );

        // Calculate median price
        this.metrics.statistics.medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    }

    private calculateVolatility(): number {
        const prices = this.metrics.historicalPrices.map(p => 
            parseFloat(ethers.utils.formatUnits(p.price, 'gwei'))
        );
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        const meanReturn = this.calculateAverage(returns);
        const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
        return Math.sqrt(this.calculateAverage(squaredDiffs));
    }

    private async predictGasPrices(): Promise<void> {
        // Simple prediction based on trend and volatility
        const currentPrice = parseFloat(ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei'));
        const volatility = this.calculateVolatility();
        const trend = this.metrics.statistics.trend;

        let hourlyChange = 0;
        let dailyChange = 0;

        switch (trend) {
            case 'increasing':
                hourlyChange = 0.05 * (1 + volatility);
                dailyChange = 0.15 * (1 + volatility);
                break;
            case 'decreasing':
                hourlyChange = -0.05 * (1 + volatility);
                dailyChange = -0.15 * (1 + volatility);
                break;
            case 'stable':
                hourlyChange = 0;
                dailyChange = 0;
                break;
        }

        this.metrics.predictions = {
            nextHour: currentPrice * (1 + hourlyChange),
            nextDay: currentPrice * (1 + dailyChange),
            confidence: Math.max(0, 1 - volatility)
        };
    }

    private calculateAverage(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    async checkGasAlerts(): Promise<void> {
        const currentGwei = parseFloat(ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei'));

        // Check for high gas prices
        if (currentGwei > this.config.thresholds.extremeGasPrice) {
            await this.sendAlert('Extreme Gas Price', {
                current: currentGwei,
                threshold: this.config.thresholds.extremeGasPrice,
                trend: this.metrics.statistics.trend,
                prediction: this.metrics.predictions,
                timestamp: new Date().toISOString()
            });
        } else if (currentGwei > this.config.thresholds.highGasPrice) {
            await this.sendAlert('High Gas Price', {
                current: currentGwei,
                threshold: this.config.thresholds.highGasPrice,
                trend: this.metrics.statistics.trend,
                prediction: this.metrics.predictions,
                timestamp: new Date().toISOString()
            });
        }

        // Check for high volatility
        if (this.metrics.statistics.volatility > this.config.thresholds.volatilityThreshold) {
            await this.sendAlert('High Gas Price Volatility', {
                volatility: this.metrics.statistics.volatility,
                threshold: this.config.thresholds.volatilityThreshold,
                trend: this.metrics.statistics.trend,
                timestamp: new Date().toISOString()
            });
        }

        // Check for low prediction confidence
        if (this.metrics.predictions.confidence < this.config.thresholds.predictionConfidenceThreshold) {
            await this.sendAlert('Low Gas Price Prediction Confidence', {
                confidence: this.metrics.predictions.confidence,
                threshold: this.config.thresholds.predictionConfidenceThreshold,
                volatility: this.metrics.statistics.volatility,
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
                    text: `⛽ *Gas Alert: ${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                })
            });
        }

        if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `⛽ **Gas Alert: ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
                })
            });
        }

        // Log alert
        console.log(`[GAS ALERT] ${type}:`, data);
    }

    async reportMetrics(): Promise<void> {
        // Output current metrics
        console.log('Gas Metrics:', {
            currentPrice: ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei'),
            movingAverages: this.metrics.movingAverages,
            statistics: {
                ...this.metrics.statistics,
                minPrice24h: ethers.utils.formatUnits(this.metrics.statistics.minPrice24h, 'gwei'),
                maxPrice24h: ethers.utils.formatUnits(this.metrics.statistics.maxPrice24h, 'gwei')
            },
            predictions: this.metrics.predictions,
            optimizationMetrics: {
                ...this.metrics.optimizationMetrics,
                recommendedBaseFee: ethers.utils.formatUnits(this.metrics.optimizationMetrics.recommendedBaseFee, 'gwei'),
                recommendedPriorityFee: ethers.utils.formatUnits(this.metrics.optimizationMetrics.recommendedPriorityFee, 'gwei')
            }
        });

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    private async pushMetricsToPrometheus(): Promise<void> {
        const metrics: string[] = [];

        // Gas price metrics
        metrics.push(
            `gas_price_gwei ${ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei')}`,
            `gas_price_moving_average_short ${this.metrics.movingAverages.short}`,
            `gas_price_moving_average_medium ${this.metrics.movingAverages.medium}`,
            `gas_price_moving_average_long ${this.metrics.movingAverages.long}`,
            `gas_price_volatility ${this.metrics.statistics.volatility}`,
            `gas_price_percentile95 ${this.metrics.statistics.percentile95}`,
            `gas_price_min_24h ${ethers.utils.formatUnits(this.metrics.statistics.minPrice24h, 'gwei')}`,
            `gas_price_max_24h ${ethers.utils.formatUnits(this.metrics.statistics.maxPrice24h, 'gwei')}`,
            `gas_price_median ${this.metrics.statistics.medianPrice}`
        );

        // Prediction metrics
        metrics.push(
            `gas_price_prediction_next_hour ${this.metrics.predictions.nextHour}`,
            `gas_price_prediction_next_day ${this.metrics.predictions.nextDay}`,
            `gas_price_prediction_confidence ${this.metrics.predictions.confidence}`
        );

        // Optimization metrics
        metrics.push(
            `gas_price_recommended_base_fee ${ethers.utils.formatUnits(this.metrics.optimizationMetrics.recommendedBaseFee, 'gwei')}`,
            `gas_price_recommended_priority_fee ${ethers.utils.formatUnits(this.metrics.optimizationMetrics.recommendedPriorityFee, 'gwei')}`,
            `gas_price_estimated_savings ${this.metrics.optimizationMetrics.estimatedSavings}`
        );

        try {
            await fetch(process.env.PROMETHEUS_PUSH_GATEWAY, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: metrics.join('\n')
            });
        } catch (error) {
            console.error('Error pushing metrics to Prometheus:', error);
        }
    }

    private async updateOptimizationMetrics(): Promise<void> {
        // Calculate optimal base fee based on recent blocks
        const recentPrices = this.metrics.historicalPrices
            .slice(-50)
            .map(p => parseFloat(ethers.utils.formatUnits(p.price, 'gwei')));
        
        const medianPrice = recentPrices.sort((a, b) => a - b)[Math.floor(recentPrices.length / 2)];
        const volatility = this.calculateVolatility();

        // Adjust base fee based on network conditions
        let baseFee = medianPrice;
        if (this.metrics.statistics.trend === 'increasing') {
            baseFee *= (1 + volatility);
        } else if (this.metrics.statistics.trend === 'decreasing') {
            baseFee *= (1 - volatility);
        }

        // Calculate priority fee based on recent inclusion times
        const priorityFee = Math.max(1.5, volatility * 5); // Minimum 1.5 gwei

        this.metrics.optimizationMetrics = {
            recommendedBaseFee: ethers.utils.parseUnits(baseFee.toFixed(2), 'gwei'),
            recommendedPriorityFee: ethers.utils.parseUnits(priorityFee.toFixed(2), 'gwei'),
            estimatedSavings: (parseFloat(ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei')) - (baseFee + priorityFee)) / parseFloat(ethers.utils.formatUnits(this.metrics.currentPrice, 'gwei')) * 100,
            optimalSubmissionTime: this.metrics.statistics.trend === 'decreasing' ? Date.now() + 300000 : Date.now() // Wait 5 minutes if decreasing
        };
    }
}

export { GasMonitor, GasMetrics, GasConfig }; 