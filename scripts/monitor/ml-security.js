#!/usr/bin/env node

const { ethers } = require('ethers');
const tf = require('@tensorflow/tfjs-node');
const { MLSecurityOracle, MLModelRegistry, FeatureProcessor } = require('../../contracts/typechain');

class MLSecurityMonitor {
    constructor(provider, config) {
        this.provider = provider;
        this.config = config;
        this.models = new Map();
        this.featureProcessors = new Map();
        this.predictionHistory = [];
        this.anomalyScores = new Map();
    }

    async initialize() {
        // Initialize ML Security Oracle contract
        this.oracle = new ethers.Contract(
            this.config.mlSecurity.oracleAddress,
            [
                'function registerModel(string,string,string[],uint256,uint256)',
                'function updatePrediction(string,uint256,uint256)',
                'function setAutomatedAction(string,uint256,tuple[])',
                'event PredictionUpdated(string,uint256,uint256)',
                'event AnomalyDetected(string,uint256,uint256)'
            ],
            this.provider
        ) as MLSecurityOracle;

        // Initialize Model Registry contract
        this.modelRegistry = new ethers.Contract(
            this.config.mlSecurity.modelRegistryAddress,
            [
                'function registerFeatureProcessor(string,address)',
                'function getModelConfig(string) view returns (tuple)',
                'function getFeatureProcessor(string) view returns (address)'
            ],
            this.provider
        ) as MLModelRegistry;

        // Load and initialize models
        await this.loadModels();

        // Initialize feature processors
        await this.initializeFeatureProcessors();

        // Set up event listeners
        this.setupEventListeners();
    }

    async loadModels() {
        // Load transaction anomaly detection model
        const transactionModel = await tf.loadLayersModel(
            'file://models/transaction_anomaly.json'
        );
        this.models.set('transaction_anomaly', transactionModel);

        // Load price manipulation detection model
        const priceModel = await tf.loadLayersModel(
            'file://models/price_manipulation.json'
        );
        this.models.set('price_manipulation', priceModel);

        // Load risk assessment model
        const riskModel = await tf.loadLayersModel(
            'file://models/risk_assessment.json'
        );
        this.models.set('risk_assessment', riskModel);
    }

    async initializeFeatureProcessors() {
        // Initialize transaction pattern processor
        const txProcessor = new ethers.Contract(
            await this.modelRegistry.getFeatureProcessor('transaction_patterns'),
            [
                'function processFeatures(address) view returns (float[])',
                'function updateFeatures(address,uint256[])'
            ],
            this.provider
        ) as FeatureProcessor;
        this.featureProcessors.set('transaction_patterns', txProcessor);

        // Initialize price pattern processor
        const priceProcessor = new ethers.Contract(
            await this.modelRegistry.getFeatureProcessor('price_patterns'),
            [
                'function processFeatures(address) view returns (float[])',
                'function updateFeatures(address,uint256[])'
            ],
            this.provider
        ) as FeatureProcessor;
        this.featureProcessors.set('price_patterns', priceProcessor);

        // Initialize risk pattern processor
        const riskProcessor = new ethers.Contract(
            await this.modelRegistry.getFeatureProcessor('risk_patterns'),
            [
                'function processFeatures(address) view returns (float[])',
                'function updateFeatures(address,uint256[])'
            ],
            this.provider
        ) as FeatureProcessor;
        this.featureProcessors.set('risk_patterns', riskProcessor);
    }

    setupEventListeners() {
        // Listen for prediction updates
        this.oracle.on('PredictionUpdated', async (modelName, prediction, confidence) => {
            this.predictionHistory.push({
                modelName,
                prediction: prediction.toNumber(),
                confidence: confidence.toNumber(),
                timestamp: Date.now()
            });

            // Clean up old predictions
            this.cleanupPredictionHistory();
        });

        // Listen for anomaly detections
        this.oracle.on('AnomalyDetected', async (modelName, score, threshold) => {
            await this.handleAnomalyDetection(modelName, score, threshold);
        });
    }

    async monitorSecurity() {
        while (true) {
            try {
                // Process new blocks for features
                await this.processNewBlocks();

                // Run anomaly detection
                await this.detectAnomalies();

                // Update on-chain predictions
                await this.updatePredictions();

                // Wait before next iteration
                await new Promise(resolve => setTimeout(resolve, 
                    parseInt(process.env.ML_MONITORING_INTERVAL) * 1000 || 30000));
            } catch (error) {
                console.error('Error in ML security monitoring:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async processNewBlocks() {
        const latestBlock = await this.provider.getBlockNumber();
        const fromBlock = this.lastProcessedBlock || latestBlock - 100;

        for (let blockNumber = fromBlock + 1; blockNumber <= latestBlock; blockNumber++) {
            const block = await this.provider.getBlock(blockNumber, true);
            
            // Process transactions for feature extraction
            for (const tx of block.transactions) {
                await this.processTransaction(tx);
            }
        }

        this.lastProcessedBlock = latestBlock;
    }

    async processTransaction(tx: any) {
        // Extract features from transaction
        const txFeatures = await this.extractTransactionFeatures(tx);
        const priceFeatures = await this.extractPriceFeatures(tx);
        const riskFeatures = await this.extractRiskFeatures(tx);

        // Update feature processors
        await Promise.all([
            this.featureProcessors.get('transaction_patterns')
                .updateFeatures(tx.from, txFeatures),
            this.featureProcessors.get('price_patterns')
                .updateFeatures(tx.from, priceFeatures),
            this.featureProcessors.get('risk_patterns')
                .updateFeatures(tx.from, riskFeatures)
        ]);
    }

    async detectAnomalies() {
        // Get latest features for each processor
        const [txFeatures, priceFeatures, riskFeatures] = await Promise.all([
            this.getLatestFeatures('transaction_patterns'),
            this.getLatestFeatures('price_patterns'),
            this.getLatestFeatures('risk_patterns')
        ]);

        // Run anomaly detection models
        const txAnomalyScore = await this.detectTransactionAnomalies(txFeatures);
        const priceAnomalyScore = await this.detectPriceAnomalies(priceFeatures);
        const riskAnomalyScore = await this.detectRiskAnomalies(riskFeatures);

        // Update anomaly scores
        this.anomalyScores.set('transaction_anomaly', txAnomalyScore);
        this.anomalyScores.set('price_manipulation', priceAnomalyScore);
        this.anomalyScores.set('risk_assessment', riskAnomalyScore);

        // Check for anomalies and trigger alerts
        await this.checkAnomalyThresholds();
    }

    async detectTransactionAnomalies(features: number[]) {
        const model = this.models.get('transaction_anomaly');
        const prediction = await model.predict(tf.tensor([features])).array();
        return prediction[0][0];
    }

    async detectPriceAnomalies(features: number[]) {
        const model = this.models.get('price_manipulation');
        const prediction = await model.predict(tf.tensor([features])).array();
        return prediction[0][0];
    }

    async detectRiskAnomalies(features: number[]) {
        const model = this.models.get('risk_assessment');
        const prediction = await model.predict(tf.tensor([features])).array();
        return prediction[0][0];
    }

    async checkAnomalyThresholds() {
        const thresholds = {
            transaction_anomaly: parseFloat(process.env.TX_ANOMALY_THRESHOLD || '0.8'),
            price_manipulation: parseFloat(process.env.PRICE_ANOMALY_THRESHOLD || '0.8'),
            risk_assessment: parseFloat(process.env.RISK_ANOMALY_THRESHOLD || '0.8')
        };

        for (const [modelName, score] of this.anomalyScores.entries()) {
            if (score > thresholds[modelName]) {
                await this.handleAnomalyDetection(
                    modelName,
                    score,
                    thresholds[modelName]
                );
            }
        }
    }

    async handleAnomalyDetection(modelName: string, score: number, threshold: number) {
        // Emit alert
        await this.sendAlert('ML Security Alert', {
            modelName,
            anomalyScore: score,
            threshold,
            timestamp: new Date().toISOString()
        });

        // Update on-chain oracle
        const confidence = Math.floor((score - threshold) * 100);
        await this.oracle.updatePrediction(
            modelName,
            Math.floor(score * 100),
            confidence
        );

        // Log detection
        console.log(`[ML SECURITY] Anomaly detected by ${modelName}:`, {
            score,
            threshold,
            confidence
        });
    }

    async updatePredictions() {
        // Calculate aggregate predictions
        const predictions = {
            transaction_anomaly: this.calculateAggregatePrediction('transaction_anomaly'),
            price_manipulation: this.calculateAggregatePrediction('price_manipulation'),
            risk_assessment: this.calculateAggregatePrediction('risk_assessment')
        };

        // Update on-chain predictions
        for (const [modelName, prediction] of Object.entries(predictions)) {
            await this.oracle.updatePrediction(
                modelName,
                Math.floor(prediction.score * 100),
                Math.floor(prediction.confidence * 100)
            );
        }
    }

    calculateAggregatePrediction(modelName: string) {
        const recentPredictions = this.predictionHistory
            .filter(p => p.modelName === modelName)
            .slice(-10);

        if (recentPredictions.length === 0) {
            return { score: 0, confidence: 0 };
        }

        const weightedSum = recentPredictions.reduce((acc, p) => {
            return acc + (p.prediction * (p.confidence / 100));
        }, 0);

        const totalConfidence = recentPredictions.reduce((acc, p) => {
            return acc + (p.confidence / 100);
        }, 0);

        return {
            score: weightedSum / totalConfidence,
            confidence: totalConfidence / recentPredictions.length
        };
    }

    cleanupPredictionHistory() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours
        this.predictionHistory = this.predictionHistory.filter(p => 
            p.timestamp > cutoff
        );
    }

    async sendAlert(type: string, data: any) {
        // Send to configured alert channels
        if (process.env.SLACK_WEBHOOK_URL) {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🤖 *${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                })
            });
        }

        if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `🤖 **${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
                })
            });
        }

        // Log alert
        console.log(`[ML ALERT] ${type}:`, data);
    }

    // Feature extraction methods
    async extractTransactionFeatures(tx: any) {
        // Implementation for transaction feature extraction
    }

    async extractPriceFeatures(tx: any) {
        // Implementation for price feature extraction
    }

    async extractRiskFeatures(tx: any) {
        // Implementation for risk feature extraction
    }

    async getLatestFeatures(processorName: string) {
        // Implementation for getting latest features from processor
    }
}

async function main() {
    // Load configuration
    const config = require('../../deployment/config.json');

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    
    // Initialize monitor
    const monitor = new MLSecurityMonitor(provider, config);
    await monitor.initialize();
    
    // Start monitoring
    await monitor.monitorSecurity();
}

if (require.main === module) {
    main().catch(console.error);
} 