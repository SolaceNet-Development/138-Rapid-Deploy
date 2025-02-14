import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface AntiMEVConfig {
    enabled: boolean;
    maxGasPrice: string;
    minBlockDelay: number;
    flashbotProtection: boolean;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Anti-MEV protection with account:", deployer.address);

    // Load configuration
    const configPath = path.join(__dirname, '../deployment/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const env = process.env.DEPLOYMENT_ENV || 'development';
    const antiMEVConfig: AntiMEVConfig = config.environments[env].security.antiMEV;

    if (!antiMEVConfig.enabled) {
        console.log("Anti-MEV protection is disabled for this environment");
        return;
    }

    // Deploy MEV Protection
    const MEVProtection = await ethers.getContractFactory("MEVProtection");
    const mevProtection = await MEVProtection.deploy(
        ethers.utils.parseUnits(antiMEVConfig.maxGasPrice, "gwei"),
        antiMEVConfig.minBlockDelay
    );
    await mevProtection.deployed();
    console.log("MEVProtection deployed to:", mevProtection.address);

    // Deploy Flashbot Protection if enabled
    let flashbotProtection;
    if (antiMEVConfig.flashbotProtection) {
        const FlashbotProtection = await ethers.getContractFactory("FlashbotProtection");
        flashbotProtection = await FlashbotProtection.deploy(mevProtection.address);
        await flashbotProtection.deployed();
        console.log("FlashbotProtection deployed to:", flashbotProtection.address);

        // Link Flashbot Protection
        await mevProtection.setFlashbotProtection(flashbotProtection.address);
        console.log("Flashbot Protection linked");
    }

    // Set up protection rules
    const protectionRules = [
        {
            name: "sandwich_protection",
            enabled: true,
            params: {
                maxPriceImpact: ethers.utils.parseEther("0.01"), // 1%
                minBlockDelay: antiMEVConfig.minBlockDelay
            }
        },
        {
            name: "frontrunning_protection",
            enabled: true,
            params: {
                maxGasPrice: ethers.utils.parseUnits(antiMEVConfig.maxGasPrice, "gwei"),
                timeWindow: 3 // blocks
            }
        },
        {
            name: "backrunning_protection",
            enabled: true,
            params: {
                maxPriceDeviation: ethers.utils.parseEther("0.005"), // 0.5%
                maxBlockDelay: 5
            }
        }
    ];

    for (const rule of protectionRules) {
        await mevProtection.addProtectionRule(
            rule.name,
            rule.enabled,
            rule.params
        );
        console.log(`Added protection rule: ${rule.name}`);
    }

    // Set up monitoring
    const monitoringParams = {
        anomalyDetectionThreshold: ethers.utils.parseEther("0.02"), // 2%
        maxTransactionDelay: 10, // blocks
        suspiciousPatternDetection: true
    };

    await mevProtection.setMonitoringParams(monitoringParams);
    console.log("Monitoring parameters set");

    // Set up private transaction pool if flashbot protection is enabled
    if (antiMEVConfig.flashbotProtection) {
        const privatePoolConfig = {
            maxSize: 100,
            maxAge: 60, // seconds
            minPriority: ethers.utils.parseUnits("2", "gwei") // 2 gwei priority fee
        };

        await flashbotProtection.setPrivatePoolConfig(privatePoolConfig);
        console.log("Private transaction pool configured");
    }

    return {
        mevProtection: mevProtection.address,
        flashbotProtection: flashbotProtection?.address
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 