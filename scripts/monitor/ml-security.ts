#!/usr/bin/env node

import { ethers } from 'ethers';
import * as tf from '@tensorflow/tfjs-node';
import { MLSecurityOracle, MLModelRegistry, FeatureProcessor } from '../../contracts/typechain';
import * as path from 'path';

interface MLSecurityConfig {
    mlSecurity: {
        oracleAddress: string;
        modelRegistryAddress: string;
    };
}

interface PredictionRecord {
    modelName: string;
    prediction: number;
    confidence: number;
    timestamp: number;
}

interface AggregatedPrediction {
    score: number;
    confidence: number;
}

interface ModelThresholds {
    [key: string]: number;
}

class MLSecurityMonitor {
    private provider: ethers.providers.Provider;
    private config: MLSecurityConfig;
    private models: Map<string, tf.LayersModel>;
    private featureProcessors: Map<string, ethers.Contract>;
    private predictionHistory: PredictionRecord[];
    private anomalyScores: Map<string, number>;
    private oracle: MLSecurityOracle;
    private modelRegistry: MLModelRegistry;
    private lastProcessedBlock?: number;

    constructor(provider: ethers.providers.Provider, config: MLSecurityConfig) {
        this.provider = provider;
        this.config = config;
        this.models = new Map();
        this.featureProcessors = new Map();
        this.predictionHistory = [];
        this.anomalyScores = new Map();
    }

    async initialize(): Promise<void> {
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

    async loadModels(): Promise<void> {
        // Use absolute paths to load models so they are resolved correctly regardless of the working directory
        const transactionModelPath = `file://${path.join(__dirname, '../../models/transaction_anomaly.json')}`;
        const transactionModel = await tf.loadLayersModel(transactionModelPath);
        this.models.set('transaction_anomaly', transactionModel);

        const priceModelPath = `file://${path.join(__dirname, '../../models/price_manipulation.json')}`;
        const priceModel = await tf.loadLayersModel(priceModelPath);
        this.models.set('price_manipulation', priceModel);

        const riskModelPath = `file://${path.join(__dirname, '../../models/risk_assessment.json')}`;
        const riskModel = await tf.loadLayersModel(riskModelPath);
        this.models.set('risk_assessment', riskModel);
    }

    async initializeFeatureProcessors(): Promise<void> {
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

    setupEventListeners(): void {
        // Listen for prediction updates
        this.oracle.on('PredictionUpdated', async (modelName: string, prediction: ethers.BigNumber, confidence: ethers.BigNumber) => {
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
        this.oracle.on('AnomalyDetected', async (modelName: string, score: ethers.BigNumber, threshold: ethers.BigNumber) => {
            await this.handleAnomalyDetection(modelName, score.toNumber() / 100, threshold.toNumber() / 100);
        });
    }

    async monitorSecurity(): Promise<void> {
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
                    parseInt(process.env.ML_MONITORING_INTERVAL || '30000')));
            } catch (error) {
                console.error('Error in ML security monitoring:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async processNewBlocks