#!/usr/bin/env node

const { ethers } = require('ethers');
const fetch = require('node-fetch');

class GasMonitor {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {
      current: {
        safe: 0,
        standard: 0,
        fast: 0,
        rapid: 0
      },
      historical: [],
      predictions: {
        nextHour: 0,
        nextDay: 0
      },
      stats: {
        daily: {
          min: Infinity,
          max: 0,
          average: 0
        },
        weekly: {
          min: Infinity,
          max: 0,
          average: 0
        }
      },
      volatility: 0,
      lastUpdate: 0
    };

    this.thresholds = {
      high: parseFloat(process.env.GAS_PRICE_HIGH_THRESHOLD || '150'),
      critical: parseFloat(process.env.GAS_PRICE_CRITICAL_THRESHOLD || '300'),
      volatility: parseFloat(process.env.GAS_PRICE_VOLATILITY_THRESHOLD || '50'),
      rapidIncrease: parseFloat(process.env.GAS_PRICE_RAPID_INCREASE_THRESHOLD || '30')
    };

    // Initialize moving averages
    this.movingAverages = {
      short: [], // 5-minute MA
      medium: [], // 1-hour MA
      long: [] // 4-hour MA
    };
  }

  async initialize() {
    // Load historical data
    await this.loadHistoricalData();

    // Initialize gas price feeds
    this.gasFeeds = [
      { name: 'etherscan', enabled: !!process.env.ETHERSCAN_API_KEY },
      { name: 'blocknative', enabled: !!process.env.BLOCKNATIVE_API_KEY },
      { name: 'etherchain', enabled: true }
    ];

    console.log('Gas monitor initialized');
  }

  async loadHistoricalData() {
    try {
      // Load last 7 days of gas prices
      const endBlock = await this.provider.getBlockNumber();
      const startBlock = endBlock - 7200 * 7; // Approximately 7 days worth of blocks

      for (let i = startBlock; i <= endBlock; i += 100) {
        const block = await this.provider.getBlock(i);
        if (block && block.baseFeePerGas) {
          this.metrics.historical.push({
            timestamp: block.timestamp,
            baseFee: ethers.utils.formatUnits(block.baseFeePerGas, 'gwei'),
            blockNumber: block.number
          });
        }
      }

      // Calculate initial statistics
      this.updateStatistics();
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  }

  async monitorGasPrices() {
    while (true) {
      try {
        await this.updateGasMetrics();
        await this.predictGasPrices();
        await this.checkGasAlerts();
        await this.reportMetrics();

        // Wait before next update
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.GAS_MONITORING_INTERVAL) * 1000 || 15000)
        );
      } catch (error) {
        console.error('Error monitoring gas prices:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async updateGasMetrics() {
    // Get current gas prices from multiple sources
    const prices = await Promise.all([
      this.getCurrentGasPrice(),
      ...this.gasFeeds
        .filter((feed) => feed.enabled)
        .map((feed) => this.getGasPriceFromFeed(feed.name))
    ]);

    // Calculate median prices for each category
    const medianPrices = this.calculateMedianPrices(prices.filter(Boolean));
    this.metrics.current = medianPrices;

    // Update historical data
    this.metrics.historical.push({
      timestamp: Date.now(),
      ...medianPrices
    });

    // Keep only last 7 days of historical data
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.metrics.historical = this.metrics.historical.filter((data) => data.timestamp > oneWeekAgo);

    // Update moving averages
    this.updateMovingAverages(medianPrices.standard);

    // Update statistics
    this.updateStatistics();

    // Calculate volatility
    this.calculateVolatility();

    this.metrics.lastUpdate = Date.now();
  }

  async getCurrentGasPrice() {
    const feeData = await this.provider.getFeeData();
    return {
      safe: ethers.utils.formatUnits(feeData.maxFeePerGas || feeData.gasPrice, 'gwei'),
      standard: ethers.utils.formatUnits(feeData.maxPriorityFeePerGas || feeData.gasPrice, 'gwei'),
      fast: ethers.utils.formatUnits(feeData.gasPrice, 'gwei'),
      rapid: ethers.utils.formatUnits(feeData.gasPrice.mul(120).div(100), 'gwei')
    };
  }

  async getGasPriceFromFeed(feed) {
    try {
      switch (feed) {
        case 'etherscan':
          const etherscanUrl = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`;
          const etherscanResponse = await fetch(etherscanUrl);
          const etherscanData = await etherscanResponse.json();
          return {
            safe: etherscanData.result.SafeGasPrice,
            standard: etherscanData.result.ProposeGasPrice,
            fast: etherscanData.result.FastGasPrice,
            rapid: etherscanData.result.FastGasPrice * 1.2
          };

        case 'blocknative':
          const blocknativeUrl = 'https://api.blocknative.com/gasprices/blockprices';
          const blocknativeResponse = await fetch(blocknativeUrl, {
            headers: { Authorization: process.env.BLOCKNATIVE_API_KEY }
          });
          const blocknativeData = await blocknativeResponse.json();
          return {
            safe: blocknativeData.blockPrices[0].estimatedPrices[3].price,
            standard: blocknativeData.blockPrices[0].estimatedPrices[2].price,
            fast: blocknativeData.blockPrices[0].estimatedPrices[1].price,
            rapid: blocknativeData.blockPrices[0].estimatedPrices[0].price
          };

        case 'etherchain':
          const etherchainUrl = 'https://www.etherchain.org/api/gasPriceOracle';
          const etherchainResponse = await fetch(etherchainUrl);
          const etherchainData = await etherchainResponse.json();
          return {
            safe: etherchainData.safeLow,
            standard: etherchainData.standard,
            fast: etherchainData.fast,
            rapid: etherchainData.fastest
          };

        default:
          return null;
      }
    } catch (error) {
      console.warn(`Error getting gas price from ${feed}:`, error);
      return null;
    }
  }

  calculateMedianPrices(prices) {
    const result = {
      safe: 0,
      standard: 0,
      fast: 0,
      rapid: 0
    };

    for (const category of Object.keys(result)) {
      const values = prices.map((p) => parseFloat(p[category])).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      result[category] =
        values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    }

    return result;
  }

  updateMovingAverages(price) {
    // Update 5-minute MA
    this.movingAverages.short.push(price);
    if (this.movingAverages.short.length > 20) {
      // 5 minutes at 15-second intervals
      this.movingAverages.short.shift();
    }

    // Update 1-hour MA
    this.movingAverages.medium.push(price);
    if (this.movingAverages.medium.length > 240) {
      // 1 hour at 15-second intervals
      this.movingAverages.medium.shift();
    }

    // Update 4-hour MA
    this.movingAverages.long.push(price);
    if (this.movingAverages.long.length > 960) {
      // 4 hours at 15-second intervals
      this.movingAverages.long.shift();
    }
  }

  updateStatistics() {
    // Daily statistics
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const dailyPrices = this.metrics.historical
      .filter((data) => data.timestamp > oneDayAgo)
      .map((data) => parseFloat(data.standard));

    this.metrics.stats.daily = {
      min: Math.min(...dailyPrices),
      max: Math.max(...dailyPrices),
      average: dailyPrices.reduce((a, b) => a + b, 0) / dailyPrices.length
    };

    // Weekly statistics
    const weeklyPrices = this.metrics.historical.map((data) => parseFloat(data.standard));

    this.metrics.stats.weekly = {
      min: Math.min(...weeklyPrices),
      max: Math.max(...weeklyPrices),
      average: weeklyPrices.reduce((a, b) => a + b, 0) / weeklyPrices.length
    };
  }

  calculateVolatility() {
    const prices = this.metrics.historical
      .slice(-240) // Last hour of data
      .map((data) => parseFloat(data.standard));

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance =
      prices.reduce((acc, price) => {
        const diff = price - mean;
        return acc + diff * diff;
      }, 0) /
      (prices.length - 1);

    this.metrics.volatility = Math.sqrt(variance);
  }

  async predictGasPrices() {
    // Simple prediction based on moving averages and trend
    const shortMA = this.calculateAverage(this.movingAverages.short);
    const mediumMA = this.calculateAverage(this.movingAverages.medium);
    const longMA = this.calculateAverage(this.movingAverages.long);

    // Calculate trend
    const shortTrend = (shortMA - mediumMA) / mediumMA;
    const longTrend = (mediumMA - longMA) / longMA;

    // Predict next hour
    this.metrics.predictions.nextHour = this.metrics.current.standard * (1 + shortTrend);

    // Predict next day
    this.metrics.predictions.nextDay = this.metrics.current.standard * (1 + longTrend);
  }

  calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  async checkGasAlerts() {
    const currentPrice = this.metrics.current.standard;

    // Check absolute thresholds
    if (currentPrice > this.thresholds.critical) {
      await this.sendAlert('Critical Gas Price', {
        current: currentPrice,
        threshold: this.thresholds.critical,
        severity: 'critical'
      });
    } else if (currentPrice > this.thresholds.high) {
      await this.sendAlert('High Gas Price', {
        current: currentPrice,
        threshold: this.thresholds.high,
        severity: 'high'
      });
    }

    // Check volatility
    if (this.metrics.volatility > this.thresholds.volatility) {
      await this.sendAlert('High Gas Price Volatility', {
        volatility: this.metrics.volatility,
        threshold: this.thresholds.volatility,
        severity: 'medium'
      });
    }

    // Check rapid increases
    const fiveMinChange =
      ((currentPrice - this.calculateAverage(this.movingAverages.short)) /
        this.calculateAverage(this.movingAverages.short)) *
      100;

    if (fiveMinChange > this.thresholds.rapidIncrease) {
      await this.sendAlert('Rapid Gas Price Increase', {
        change: `${fiveMinChange.toFixed(2)}%`,
        threshold: `${this.thresholds.rapidIncrease}%`,
        severity: 'high'
      });
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
          text: `⛽ *${type}*\nSeverity: ${data.severity}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⛽ **${type}**\nSeverity: ${data.severity}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[GAS ALERT] ${type} (${data.severity}):`, data);
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Gas Price Metrics:', {
      current: this.metrics.current,
      predictions: this.metrics.predictions,
      stats: this.metrics.stats,
      volatility: this.metrics.volatility,
      lastUpdate: new Date(this.metrics.lastUpdate).toISOString()
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      gas_price_safe: this.metrics.current.safe,
      gas_price_standard: this.metrics.current.standard,
      gas_price_fast: this.metrics.current.fast,
      gas_price_rapid: this.metrics.current.rapid,
      gas_price_volatility: this.metrics.volatility,
      gas_price_prediction_hour: this.metrics.predictions.nextHour,
      gas_price_prediction_day: this.metrics.predictions.nextDay,
      gas_price_daily_min: this.metrics.stats.daily.min,
      gas_price_daily_max: this.metrics.stats.daily.max,
      gas_price_daily_avg: this.metrics.stats.daily.average,
      gas_price_weekly_min: this.metrics.stats.weekly.min,
      gas_price_weekly_max: this.metrics.stats.weekly.max,
      gas_price_weekly_avg: this.metrics.stats.weekly.average
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
  const monitor = new GasMonitor(provider);
  await monitor.initialize();

  // Start monitoring
  await monitor.monitorGasPrices();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = GasMonitor;
