#!/usr/bin/env node

import { ethers } from 'ethers';
import * as tf from '@tensorflow/tfjs-node';
import { MLSecurityOracle, MLModelRegistry } from '../../contracts/typechain';

interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  features: string[];
  model: tf.LayersModel;
  threshold: number;
  cooldown: number;
  lastDetection?: number;
}

interface PatternMatch {
  patternId: string;
  confidence: number;
  features: number[];
  timestamp: number;
  metadata: Record<string, unknown>;
}

class MLSecurityPatterns {
  private patterns: Map<string, SecurityPattern>;
  private provider: ethers.providers.Provider;
  private oracle: MLSecurityOracle;
  private modelRegistry: MLModelRegistry;
  private detectionHistory: PatternMatch[];

  constructor(
    provider: ethers.providers.Provider,
    oracle: MLSecurityOracle,
    modelRegistry: MLModelRegistry
  ) {
    this.provider = provider;
    this.oracle = oracle;
    this.modelRegistry = modelRegistry;
    this.patterns = new Map();
    this.detectionHistory = [];
  }

  async initialize(): Promise<void> {
    // Initialize security patterns
    await this.initializeFlashLoanPattern();
    await this.initializeReentrancyPattern();
    await this.initializePriceManipulationPattern();
    await this.initializeContractExploitPattern();
    await this.initializePhishingPattern();
    await this.initializeFrontRunningPattern();
    await this.initializeMarketManipulationPattern();
    await this.initializeAnomalousBehaviorPattern();
  }

  private async initializeFlashLoanPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/flash_loan_detection.json');
    this.patterns.set('flash_loan', {
      id: 'flash_loan',
      name: 'Flash Loan Attack Detection',
      description:
        'Detects potential flash loan attacks by analyzing transaction patterns and value flows',
      severity: 'critical',
      features: [
        'loan_amount',
        'profit_ratio',
        'involved_protocols',
        'execution_time',
        'gas_used',
        'value_locked_change'
      ],
      model,
      threshold: 0.85,
      cooldown: 300000 // 5 minutes
    });
  }

  private async initializeReentrancyPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/reentrancy_detection.json');
    this.patterns.set('reentrancy', {
      id: 'reentrancy',
      name: 'Reentrancy Attack Detection',
      description:
        'Identifies potential reentrancy attacks by analyzing call patterns and state changes',
      severity: 'critical',
      features: [
        'call_depth',
        'state_changes',
        'eth_balance_changes',
        'call_pattern_similarity',
        'gas_pattern'
      ],
      model,
      threshold: 0.9,
      cooldown: 60000 // 1 minute
    });
  }

  private async initializePriceManipulationPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/price_manipulation.json');
    this.patterns.set('price_manipulation', {
      id: 'price_manipulation',
      name: 'Price Manipulation Detection',
      description: 'Detects potential price manipulation attempts in DeFi protocols',
      severity: 'high',
      features: [
        'price_change_rate',
        'volume_anomaly',
        'liquidity_impact',
        'trade_frequency',
        'price_reversion'
      ],
      model,
      threshold: 0.8,
      cooldown: 120000 // 2 minutes
    });
  }

  private async initializeContractExploitPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/contract_exploit.json');
    this.patterns.set('contract_exploit', {
      id: 'contract_exploit',
      name: 'Smart Contract Exploit Detection',
      description: 'Identifies potential exploits of smart contract vulnerabilities',
      severity: 'critical',
      features: [
        'bytecode_pattern',
        'state_transition_anomaly',
        'gas_usage_pattern',
        'call_graph_structure',
        'value_flow_pattern'
      ],
      model,
      threshold: 0.9,
      cooldown: 30000 // 30 seconds
    });
  }

  private async initializePhishingPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/phishing_detection.json');
    this.patterns.set('phishing', {
      id: 'phishing',
      name: 'Phishing Attack Detection',
      description: 'Detects potential phishing attacks by analyzing transaction patterns',
      severity: 'high',
      features: [
        'address_similarity',
        'token_approval_pattern',
        'interaction_frequency',
        'value_pattern',
        'contract_creation_pattern'
      ],
      model,
      threshold: 0.85,
      cooldown: 300000 // 5 minutes
    });
  }

  private async initializeFrontRunningPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/frontrunning_detection.json');
    this.patterns.set('frontrunning', {
      id: 'frontrunning',
      name: 'Front-Running Detection',
      description: 'Identifies potential front-running attacks in the mempool',
      severity: 'medium',
      features: [
        'tx_sequence_pattern',
        'gas_price_pattern',
        'timing_pattern',
        'value_correlation',
        'address_interaction_pattern'
      ],
      model,
      threshold: 0.8,
      cooldown: 60000 // 1 minute
    });
  }

  private async initializeMarketManipulationPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/market_manipulation.json');
    this.patterns.set('market_manipulation', {
      id: 'market_manipulation',
      name: 'Market Manipulation Detection',
      description: 'Detects potential market manipulation strategies',
      severity: 'high',
      features: [
        'order_pattern',
        'volume_distribution',
        'price_impact',
        'trade_size_pattern',
        'temporal_pattern'
      ],
      model,
      threshold: 0.85,
      cooldown: 180000 // 3 minutes
    });
  }

  private async initializeAnomalousBehaviorPattern(): Promise<void> {
    const model = await tf.loadLayersModel('file://models/anomalous_behavior.json');
    this.patterns.set('anomalous_behavior', {
      id: 'anomalous_behavior',
      name: 'Anomalous Behavior Detection',
      description: 'Identifies general anomalous behavior patterns',
      severity: 'medium',
      features: [
        'transaction_frequency',
        'value_pattern',
        'contract_interaction',
        'gas_usage',
        'temporal_pattern'
      ],
      model,
      threshold: 0.75,
      cooldown: 300000 // 5 minutes
    });
  }

  async detectPatterns(transaction: ethers.providers.TransactionResponse): Promise<void> {
    for (const pattern of this.patterns.values()) {
      // Skip if in cooldown
      if (pattern.lastDetection && Date.now() - pattern.lastDetection < pattern.cooldown) {
        continue;
      }

      // Extract features for the pattern
      const features = await this.extractFeatures(transaction, pattern.features);
      if (!features) continue;

      // Run prediction
      const prediction = await this.runPrediction(pattern.model, features);

      // Check if prediction exceeds threshold
      if (prediction > pattern.threshold) {
        const match: PatternMatch = {
          patternId: pattern.id,
          confidence: prediction,
          features,
          timestamp: Date.now(),
          metadata: {
            transaction: transaction.hash,
            from: transaction.from,
            to: transaction.to,
            value: transaction.value.toString(),
            gasPrice: transaction.gasPrice?.toString()
          }
        };

        // Update detection history
        this.detectionHistory.push(match);
        pattern.lastDetection = Date.now();

        // Send alert
        await this.handlePatternMatch(pattern, match);
      }
    }

    // Clean up old history
    this.cleanupHistory();
  }

  private async extractFeatures(
    tx: ethers.providers.TransactionResponse,
    requiredFeatures: string[]
  ): Promise<number[] | null> {
    try {
      const features: number[] = [];
      const receipt = await tx.wait();

      for (const feature of requiredFeatures) {
        switch (feature) {
          case 'loan_amount':
            features.push(this.extractLoanAmount(tx, receipt));
            break;
          case 'profit_ratio':
            features.push(await this.calculateProfitRatio(tx, receipt));
            break;
          case 'call_depth':
            features.push(this.calculateCallDepth(receipt));
            break;
          case 'price_change_rate':
            features.push(await this.calculatePriceChangeRate(tx));
            break;
          // Add more feature extraction methods as needed
          default:
            features.push(0); // Default value for unknown features
        }
      }

      return features;
    } catch (error) {
      console.error('Error extracting features:', error);
      return null;
    }
  }

  private async runPrediction(model: tf.LayersModel, features: number[]): Promise<number> {
    const tensor = tf.tensor2d([features]);
    const prediction = (await model.predict(tensor)) as tf.Tensor;
    const value = (await prediction.data())[0];
    tensor.dispose();
    prediction.dispose();
    return value;
  }

  private async handlePatternMatch(pattern: SecurityPattern, match: PatternMatch): Promise<void> {
    // Update on-chain oracle
    await this.oracle.updatePrediction(
      pattern.id,
      Math.floor(match.confidence * 100),
      Math.floor((match.confidence - pattern.threshold) * 100)
    );

    // Send alert
    await this.sendAlert(pattern, match);

    // Log detection
    console.log(`[ML SECURITY] Pattern detected: ${pattern.name}`, {
      confidence: match.confidence,
      threshold: pattern.threshold,
      transaction: match.metadata.transaction
    });
  }

  private async sendAlert(pattern: SecurityPattern, match: PatternMatch): Promise<void> {
    const alert = {
      type: pattern.name,
      severity: pattern.severity,
      confidence: match.confidence,
      threshold: pattern.threshold,
      transaction: match.metadata.transaction,
      timestamp: new Date(match.timestamp).toISOString(),
      details: {
        from: match.metadata.from,
        to: match.metadata.to,
        value: match.metadata.value,
        description: pattern.description
      }
    };

    // Send to configured alert channels
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *Security Pattern Detected*\n\`\`\`${JSON.stringify(alert, null, 2)}\`\`\``
        })
      });
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **Security Pattern Detected**\n\`\`\`json\n${JSON.stringify(alert, null, 2)}\n\`\`\``
        })
      });
    }
  }

  private cleanupHistory(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours
    this.detectionHistory = this.detectionHistory.filter((match) => match.timestamp > cutoff);
  }

  // Feature extraction helper methods
  private extractLoanAmount(
    tx: ethers.providers.TransactionResponse,
    receipt: ethers.providers.TransactionReceipt
  ): number {
    // Implementation for extracting loan amount
    return 0;
  }

  private async calculateProfitRatio(
    tx: ethers.providers.TransactionResponse,
    receipt: ethers.providers.TransactionReceipt
  ): Promise<number> {
    // Implementation for calculating profit ratio
    return 0;
  }

  private calculateCallDepth(receipt: ethers.providers.TransactionReceipt): number {
    // Implementation for calculating call depth
    return 0;
  }

  private async calculatePriceChangeRate(
    tx: ethers.providers.TransactionResponse
  ): Promise<number> {
    // Implementation for calculating price change rate
    return 0;
  }
}

export { MLSecurityPatterns, SecurityPattern, PatternMatch };
