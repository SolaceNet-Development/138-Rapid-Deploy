#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

class GasMonitor {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {
      currentGasPrice: 0,
      historicalPrices: [],
      maxGasPrice: 0,
      minGasPrice: Infinity,
      volatility: 0,
      lastUpdate: 0
    };
  }

  async initialize() {
    // Get initial gas price
    const gasPrice = await this.provider.getGasPrice();
    this.metrics.currentGasPrice = gasPrice.toNumber();
    this.metrics.lastUpdate = Date.now();

    // Initialize historical data
    this.metrics.historicalPrices.push({
      timestamp: Date.now(),
      price: this.metrics.currentGasPrice
    });
  }

  async monitorGasPrices() {
    while (true) {
      try {
        await this.updateGasMetrics();
        await this.checkGasAlerts();
        await this.reportMetrics();
        
        // Wait before next update
        await sleep(parseInt(process.env.GAS_MONITORING_INTERVAL) * 1000 || 30000);
      } catch (error) {
        console.error('Error monitoring gas prices:', error);
        await sleep(5000);
      }
    }
  }

  async updateGasMetrics() {
    // Get current gas price
    const gasPrice = await this.provider.getGasPrice();
    const currentPrice = gasPrice.toNumber();
    
    // Update metrics
    this.metrics.currentGasPrice = currentPrice;
    this.metrics.maxGasPrice = Math.max(this.metrics.maxGasPrice, currentPrice);
    this.metrics.minGasPrice = Math.min(this.metrics.minGasPrice, currentPrice);
    
    // Add to historical data
    this.metrics.historicalPrices.push({
      timestamp: Date.now(),
      price: currentPrice
    });
    
    // Keep only last 24 hours of data
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics.historicalPrices = this.metrics.historicalPrices.filter(
      data => data.timestamp > oneDayAgo
    );
    
    // Calculate volatility
    this.calculateVolatility();
  }

  calculateVolatility() {
    if (this.metrics.historicalPrices.length < 2) return;
    
    const prices = this.metrics.historicalPrices.map(data => data.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const variance = prices.reduce((acc, price) => {
      const diff = price - mean;
      return acc + (diff * diff);
    }, 0) / (prices.length - 1);
    
    this.metrics.volatility = Math.sqrt(variance);
  }

  async checkGasAlerts() {
    const maxGasPrice = ethers.utils.parseUnits(
      process.env.MAX_GAS_PRICE || '100',
      'gwei'
    ).toNumber();
    
    // Check high gas price
    if (this.metrics.currentGasPrice > maxGasPrice) {
      await this.sendAlert('High Gas Price', {
        current: ethers.utils.formatUnits(this.metrics.currentGasPrice, 'gwei'),
        threshold: ethers.utils.formatUnits(maxGasPrice, 'gwei'),
        timestamp: new Date().toISOString()
      });
    }
    
    // Check high volatility
    const volatilityThreshold = parseFloat(process.env.GAS_VOLATILITY_THRESHOLD || '0.5');
    if (this.metrics.volatility > volatilityThreshold * this.metrics.currentGasPrice) {
      await this.sendAlert('High Gas Price Volatility', {
        volatility: ethers.utils.formatUnits(this.metrics.volatility, 'gwei'),
        current: ethers.utils.formatUnits(this.metrics.currentGasPrice, 'gwei'),
        timestamp: new Date().toISOString()
      });
    }
    
    // Check rapid increase
    const recentPrices = this.metrics.historicalPrices.slice(-2);
    if (recentPrices.length === 2) {
      const priceIncrease = (recentPrices[1].price - recentPrices[0].price) / recentPrices[0].price;
      const rapidIncreaseThreshold = parseFloat(process.env.GAS_RAPID_INCREASE_THRESHOLD || '0.3');
      
      if (priceIncrease > rapidIncreaseThreshold) {
        await this.sendAlert('Rapid Gas Price Increase', {
          increase: `${(priceIncrease * 100).toFixed(2)}%`,
          from: ethers.utils.formatUnits(recentPrices[0].price, 'gwei'),
          to: ethers.utils.formatUnits(recentPrices[1].price, 'gwei'),
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async sendAlert(type, data) {
    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⛽ *${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⛽ **${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
        })
      });
    }

    // Log alert
    console.log(`[GAS ALERT] ${type}:`, data);
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Gas Metrics:', {
      current: ethers.utils.formatUnits(this.metrics.currentGasPrice, 'gwei'),
      max: ethers.utils.formatUnits(this.metrics.maxGasPrice, 'gwei'),
      min: ethers.utils.formatUnits(this.metrics.minGasPrice, 'gwei'),
      volatility: ethers.utils.formatUnits(this.metrics.volatility, 'gwei'),
      lastUpdate: new Date(this.metrics.lastUpdate).toISOString()
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      'gas_price_current': parseFloat(ethers.utils.formatUnits(this.metrics.currentGasPrice, 'gwei')),
      'gas_price_max': parseFloat(ethers.utils.formatUnits(this.metrics.maxGasPrice, 'gwei')),
      'gas_price_min': parseFloat(ethers.utils.formatUnits(this.metrics.minGasPrice, 'gwei')),
      'gas_price_volatility': parseFloat(ethers.utils.formatUnits(this.metrics.volatility, 'gwei'))
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