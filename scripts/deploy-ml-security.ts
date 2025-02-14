import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import { ContractFactory } from 'ethers';

interface MLSecurityConfig {
    enabled: boolean;
    modelEndpoint: string;
    updateInterval: number;
    minConfidence: number;
    features: string[];
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying ML Security with account:", deployerAddress);

    // Load configuration
    const configPath = path.join(__dirname, '../deployment/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const env = process.env.DEPLOYMENT_ENV || 'development';
    const mlConfig: MLSecurityConfig = config.environments[env].security.mlSecurity;

    if (!mlConfig.enabled) {
        console.log("ML Security is disabled for this environment");
        return;
    }

    // Deploy ML Security Oracle
    const MLSecurityOracle = await ethers.getContractFactory("MLSecurityOracle") as ContractFactory;
    const mlOracle = (await MLSecurityOracle.deploy(
        mlConfig.modelEndpoint,
        mlConfig.updateInterval,
        ethers.utils.parseEther(mlConfig.minConfidence.toString())
    )) as MLSecurityOracle;
    await mlOracle.deployed();
    console.log("MLSecurityOracle deployed to:", mlOracle.address);

    // Deploy ML Feature Processors
    const featureProcessors: FeatureProcessors = {};
    for (const feature of mlConfig.features) {
        const FeatureProcessor = await ethers.getContractFactory(`${feature}Processor`) as ContractFactory;
        const processor = (await FeatureProcessor.deploy(mlOracle.address)) as FeatureProcessor;
        await processor.deployed();
        featureProcessors[feature] = processor.address;
        console.log(`${feature}Processor deployed to:`, processor.address);

        // Register processor with oracle
        await mlOracle.registerFeatureProcessor(
            ethers.utils.formatBytes32String(feature),
            processor.address
        );
        console.log(`${feature}Processor registered with oracle`);
    }

    // Deploy ML Model Registry
    const MLModelRegistry = await ethers.getContractFactory("MLModelRegistry") as ContractFactory;
    const modelRegistry = (await MLModelRegistry.deploy(mlOracle.address)) as MLModelRegistry;
    await modelRegistry.deployed();
    console.log("MLModelRegistry deployed to:", modelRegistry.address);

    // Set up model configurations
    const modelConfigs: ModelConfig[] = [
        {
            name: "transaction_anomaly",
            version: "1.0.0",
            inputFeatures: ["transaction_patterns", "price_manipulation"],
            updateThreshold: ethers.utils.parseEther("0.95"),
            minDataPoints: 1000
        },
        {
            name: "price_prediction",
            version: "1.0.0",
            inputFeatures: ["price", "volume", "positions"],
            updateThreshold: ethers.utils.parseEther("0.97"),
            minDataPoints: 5000
        },
        {
            name: "risk_assessment",
            version: "1.0.0",
            inputFeatures: ["positions", "liquidations", "flash_loans"],
            updateThreshold: ethers.utils.parseEther("0.96"),
            minDataPoints: 2000
        }
    ];

    for (const config of modelConfigs) {
        await modelRegistry.registerModel(
            ethers.utils.formatBytes32String(config.name),
            config.version,
            config.inputFeatures.map(f => ethers.utils.formatBytes32String(f)),
            config.updateThreshold,
            config.minDataPoints
        );
        console.log(`Model registered: ${config.name}`);
    }

    // Set up automated actions
    const automatedActions: AutomatedAction[] = [
        {
            trigger: "high_risk_transaction",
            confidence: ethers.utils.parseEther("0.98"),
            actions: [
                {
                    type: "block_transaction",
                    params: { reason: "ML detected high risk" }
                },
                {
                    type: "notify_guardians",
                    params: { priority: "high" }
                }
            ]
        },
        {
            trigger: "price_manipulation",
            confidence: ethers.utils.parseEther("0.95"),
            actions: [
                {
                    type: "pause_trading",
                    params: { duration: 1800 }
                },
                {
                    type: "increase_monitoring",
                    params: { duration: 7200 }
                }
            ]
        }
    ];

    for (const action of automatedActions) {
        await mlOracle.setAutomatedAction(
            ethers.utils.formatBytes32String(action.trigger),
            action.confidence,
            action.actions
        );
        console.log(`Automated action set: ${action.trigger}`);
    }

    // Set up monitoring parameters
    const monitoringParams: MonitoringParameters = {
        modelHealthCheck: {
            enabled: true,
            interval: 3600,
            accuracyThreshold: ethers.utils.parseEther("0.9"),
            driftThreshold: ethers.utils.parseEther("0.1")
        },
        dataQuality: {
            enabled: true,
            minDataPoints: 100,
            maxMissingValues: 0.1,
            outlierThreshold: 3
        },
        performance: {
            enabled: true,
            maxLatency: 1000,
            maxMemoryUsage: ethers.utils.parseEther("0.8"),
            maxGPUUsage: ethers.utils.parseEther("0.9")
        }
    };

    await mlOracle.setMonitoringParams(monitoringParams);
    console.log("Monitoring parameters set");

    return {
        mlOracle: mlOracle.address,
        modelRegistry: modelRegistry.address,
        featureProcessors
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 