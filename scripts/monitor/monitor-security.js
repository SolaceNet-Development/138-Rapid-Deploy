#!/usr/bin/env node

const { ethers } = require('ethers');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fetch = require('node-fetch');

class SecurityMonitor {
  constructor(provider) {
    this.provider = provider;
    this.metrics = {
      unusualTransactions: [],
      suspiciousAddresses: new Set(),
      recentAttacks: [],
      vulnerabilities: [],
      securityScore: 100,
      lastScan: 0
    };

    this.thresholds = {
      largeTransactionEth: parseFloat(process.env.LARGE_TRANSACTION_THRESHOLD || '100'),
      maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE || '500'),
      minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || '12'),
      scanDepth: parseInt(process.env.SECURITY_SCAN_DEPTH || '1000'),
      alertThreshold: process.env.SECURITY_ALERT_THRESHOLD || 'medium'
    };
  }

  async initialize() {
    // Initialize security patterns
    this.securityPatterns = {
      reentrancy: /(\bsend\b|\btransfer\b|\bcall\b).*\bvalue\b/,
      uncheckedCalls: /\bcall\b(?!.*\brequire\b)/,
      integerOverflow: /\+\+|\+=|-=|\*=|\/=/,
      accessControl: /\bonlyOwner\b|\brequire\(msg\.sender/
    };

    // Initialize known attack patterns
    this.attackPatterns = new Map([
      [
        'flash_loan_attack',
        {
          pattern: /multiple.*loans.*single.*transaction/i,
          severity: 'high'
        }
      ],
      [
        'reentrancy_attack',
        {
          pattern: /multiple.*calls.*same.*contract/i,
          severity: 'critical'
        }
      ],
      [
        'front_running',
        {
          pattern: /high.*gas.*price.*pending.*pool/i,
          severity: 'medium'
        }
      ]
    ]);

    console.log('Security monitor initialized');
  }

  async monitorSecurity() {
    while (true) {
      try {
        await this.performSecurityScan();
        await this.checkSecurityAlerts();
        await this.reportMetrics();

        // Wait before next scan
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.SECURITY_SCAN_INTERVAL) * 1000 || 3600000)
        );
      } catch (error) {
        console.error('Error monitoring security:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async performSecurityScan() {
    const startTime = Date.now();

    // Get latest block
    const latestBlock = await this.provider.getBlock('latest');

    // Scan recent transactions
    await this.scanRecentTransactions(latestBlock.number);

    // Check for contract vulnerabilities
    await this.scanContractVulnerabilities();

    // Update security score
    this.updateSecurityScore();

    this.metrics.lastScan = Date.now();
    console.log(`Security scan completed in ${Date.now() - startTime}ms`);
  }

  async scanRecentTransactions(latestBlockNumber) {
    const startBlock = latestBlockNumber - this.thresholds.scanDepth;

    for (let i = startBlock; i <= latestBlockNumber; i++) {
      const block = await this.provider.getBlock(i, true);

      for (const tx of block.transactions) {
        // Check for large transactions
        if (ethers.utils.formatEther(tx.value) > this.thresholds.largeTransactionEth) {
          this.metrics.unusualTransactions.push({
            hash: tx.hash,
            value: ethers.utils.formatEther(tx.value),
            from: tx.from,
            to: tx.to,
            blockNumber: i
          });
        }

        // Check for high gas price transactions
        if (
          tx.gasPrice &&
          ethers.utils.formatUnits(tx.gasPrice, 'gwei') > this.thresholds.maxGasPrice
        ) {
          await this.sendAlert('High Gas Price Transaction', {
            hash: tx.hash,
            gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
            threshold: this.thresholds.maxGasPrice
          });
        }

        // Check for contract interactions
        if (tx.to && (await this.provider.getCode(tx.to)) !== '0x') {
          await this.analyzeContractInteraction(tx);
        }
      }
    }
  }

  async analyzeContractInteraction(tx) {
    try {
      // Get transaction receipt for more details
      const receipt = await this.provider.getTransactionReceipt(tx.hash);

      // Check for failed transactions
      if (!receipt.status) {
        this.metrics.vulnerabilities.push({
          type: 'failed_transaction',
          hash: tx.hash,
          contract: tx.to,
          severity: 'medium'
        });
      }

      // Analyze event logs
      for (const log of receipt.logs) {
        await this.analyzeEventLog(log);
      }

      // Check for suspicious patterns
      const txTrace = await this.provider.send('debug_traceTransaction', [tx.hash]);
      await this.analyzeTransactionTrace(txTrace);
    } catch (error) {
      console.warn('Error analyzing contract interaction:', error);
    }
  }

  async analyzeEventLog(log) {
    // Check for known malicious events
    const eventSignature = log.topics[0];

    // Example signatures to watch for
    const suspiciousEvents = {
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Unlimited Approval',
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Large Transfer'
    };

    if (suspiciousEvents[eventSignature]) {
      await this.sendAlert('Suspicious Event Detected', {
        contract: log.address,
        event: suspiciousEvents[eventSignature],
        transaction: log.transactionHash
      });
    }
  }

  async analyzeTransactionTrace(trace) {
    // Check for suspicious patterns in transaction execution
    const patterns = {
      multipleExternalCalls: 0,
      valueTransfers: 0,
      storageWrites: 0
    };

    // Analyze trace recursively
    const analyzeOps = (ops) => {
      for (const op of ops) {
        if (op.op === 'CALL' || op.op === 'DELEGATECALL') {
          patterns.multipleExternalCalls++;
        }
        if (op.op === 'SSTORE') {
          patterns.storageWrites++;
        }
        if (op.value && op.value !== '0x0') {
          patterns.valueTransfers++;
        }
      }
    };

    analyzeOps(trace.structLogs);

    // Check for suspicious patterns
    if (patterns.multipleExternalCalls > 3) {
      this.metrics.vulnerabilities.push({
        type: 'multiple_external_calls',
        calls: patterns.multipleExternalCalls,
        severity: 'high'
      });
    }

    if (patterns.valueTransfers > 2) {
      this.metrics.vulnerabilities.push({
        type: 'multiple_value_transfers',
        transfers: patterns.valueTransfers,
        severity: 'medium'
      });
    }
  }

  async scanContractVulnerabilities() {
    // Get list of contracts to scan
    const contracts = await this.getActiveContracts();

    for (const contract of contracts) {
      // Get contract code
      const code = await this.provider.getCode(contract);

      // Check for known vulnerabilities
      for (const [name, pattern] of Object.entries(this.securityPatterns)) {
        if (pattern.test(code)) {
          this.metrics.vulnerabilities.push({
            type: name,
            contract,
            severity: 'high'
          });
        }
      }

      // Check for attack patterns
      for (const [name, { pattern, severity }] of this.attackPatterns) {
        if (pattern.test(code)) {
          this.metrics.vulnerabilities.push({
            type: name,
            contract,
            severity
          });
        }
      }
    }
  }

  async getActiveContracts() {
    // This would be replaced with actual logic to get relevant contracts
    // For now, return hardcoded test contracts
    return [process.env.BRIDGE_CONTRACT_ADDRESS, process.env.VALIDATOR_CONTRACT_ADDRESS].filter(
      Boolean
    );
  }

  updateSecurityScore() {
    let score = 100;

    // Deduct points for vulnerabilities based on severity
    const severityImpact = {
      low: 5,
      medium: 10,
      high: 20,
      critical: 40
    };

    for (const vulnerability of this.metrics.vulnerabilities) {
      score -= severityImpact[vulnerability.severity] || 10;
    }

    // Deduct points for suspicious activities
    score -= this.metrics.suspiciousAddresses.size * 5;
    score -= this.metrics.unusualTransactions.length * 2;

    // Ensure score stays within 0-100
    this.metrics.securityScore = Math.max(0, Math.min(100, score));
  }

  async checkSecurityAlerts() {
    // Check security score
    if (this.metrics.securityScore < 70) {
      await this.sendAlert('Low Security Score', {
        score: this.metrics.securityScore,
        vulnerabilities: this.metrics.vulnerabilities.length,
        suspiciousActivities: this.metrics.unusualTransactions.length
      });
    }

    // Check vulnerabilities
    const criticalVulnerabilities = this.metrics.vulnerabilities.filter(
      (v) => v.severity === 'critical'
    );

    if (criticalVulnerabilities.length > 0) {
      await this.sendAlert('Critical Vulnerabilities Detected', {
        count: criticalVulnerabilities.length,
        details: criticalVulnerabilities
      });
    }

    // Check unusual transactions
    if (this.metrics.unusualTransactions.length > 5) {
      await this.sendAlert('Multiple Unusual Transactions', {
        count: this.metrics.unusualTransactions.length,
        transactions: this.metrics.unusualTransactions
      });
    }
  }

  async sendAlert(type, data) {
    const timestamp = new Date().toISOString();
    const alert = {
      type,
      data,
      timestamp,
      severity: this.getSeverity(type, data)
    };

    // Only send alert if it meets the threshold
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityLevels.indexOf(this.thresholds.alertThreshold);
    const alertIndex = severityLevels.indexOf(alert.severity);

    if (alertIndex >= thresholdIndex) {
      // Send to configured alert channels
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *Security Alert - ${type}*\nSeverity: ${alert.severity}\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
          })
        });
      }

      if (process.env.DISCORD_WEBHOOK_URL) {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **Security Alert - ${type}**\nSeverity: ${alert.severity}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
          })
        });
      }
    }

    // Log alert
    console.log(`[SECURITY ALERT] ${type} (${alert.severity}):`, data);
  }

  getSeverity(type, data) {
    // Define severity levels based on alert type and data
    switch (type) {
      case 'Critical Vulnerabilities Detected':
        return 'critical';
      case 'Low Security Score':
        return data.score < 50 ? 'critical' : 'high';
      case 'Multiple Unusual Transactions':
        return data.count > 10 ? 'high' : 'medium';
      case 'Suspicious Event Detected':
        return 'medium';
      default:
        return 'low';
    }
  }

  async reportMetrics() {
    // Output current metrics
    console.log('Security Metrics:', {
      securityScore: this.metrics.securityScore,
      vulnerabilities: this.metrics.vulnerabilities.length,
      unusualTransactions: this.metrics.unusualTransactions.length,
      suspiciousAddresses: this.metrics.suspiciousAddresses.size,
      lastScan: new Date(this.metrics.lastScan).toISOString()
    });

    // Push to Prometheus if configured
    if (process.env.PROMETHEUS_PUSH_GATEWAY) {
      await this.pushMetricsToPrometheus();
    }
  }

  async pushMetricsToPrometheus() {
    const metrics = {
      security_score: this.metrics.securityScore,
      vulnerabilities_total: this.metrics.vulnerabilities.length,
      unusual_transactions_total: this.metrics.unusualTransactions.length,
      suspicious_addresses_total: this.metrics.suspiciousAddresses.size
    };

    // Add vulnerability metrics by severity
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const vuln of this.metrics.vulnerabilities) {
      severityCounts[vuln.severity]++;
    }

    for (const [severity, count] of Object.entries(severityCounts)) {
      metrics[`vulnerabilities_${severity}`] = count;
    }

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
  const monitor = new SecurityMonitor(provider);
  await monitor.initialize();

  // Start monitoring
  await monitor.monitorSecurity();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SecurityMonitor;
