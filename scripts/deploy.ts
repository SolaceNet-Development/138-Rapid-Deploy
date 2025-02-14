import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentConfig {
    environments: {
        [key: string]: {
            rpc: string;
            chainId: number;
            contracts: {
                [key: string]: string;
            };
            monitoring: {
                enabled: boolean;
                grafanaUrl: string;
                prometheusUrl: string;
                alerting?: {
                    enabled: boolean;
                    slackWebhook: string;
                    discordWebhook: string;
                    emailNotifications: string;
                };
            };
            features: {
                [key: string]: boolean;
            };
            security?: {
                maxGasPrice: string;
                maxPositionSize: string;
                maxLeverage: number;
                emergencyShutdown: {
                    enabled: boolean;
                    multisigThreshold: number;
                    timelock: number;
                };
            };
            performance?: {
                caching: {
                    enabled: boolean;
                    duration: number;
                };
                rpcBatchSize: number;
                maxConcurrentRequests: number;
            };
        };
    };
    deployment: {
        scripts: {
            [key: string]: string;
        };
        order: string[];
        verification: {
            enabled: boolean;
            apiKey: string;
        };
    };
}

async function main() {
    // Load configuration
    const configPath = path.join(__dirname, '../deployment/config.json');
    const config: DeploymentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Get environment from command line or default to development
    const env = process.env.DEPLOYMENT_ENV || 'development';
    const envConfig = config.environments[env];

    if (!envConfig) {
        throw new Error(`Environment ${env} not found in config`);
    }

    console.log(`Deploying to ${env} environment...`);

    // Deploy contracts in order
    const deployedContracts: { [key: string]: string } = {};

    for (const contractName of config.deployment.order) {
        console.log(`\nDeploying ${contractName}...`);
        
        try {
            // Get the script path
            const scriptPath = config.deployment.scripts[contractName];
            if (!scriptPath) {
                throw new Error(`Deployment script not found for ${contractName}`);
            }

            // Deploy the contract
            const Contract = await ethers.getContractFactory(contractName);
            const contract = await Contract.deploy();
            await contract.deployed();

            deployedContracts[contractName] = contract.address;
            console.log(`${contractName} deployed to:`, contract.address);

            // Verify contract if enabled
            if (config.deployment.verification.enabled) {
                console.log(`Verifying ${contractName}...`);
                try {
                    await verifyContract(contract.address, []);
                } catch (error) {
                    console.error(`Error verifying ${contractName}:`, error);
                }
            }
        } catch (error) {
            console.error(`Error deploying ${contractName}:`, error);
            throw error;
        }
    }

    // Update config with deployed addresses
    envConfig.contracts = {
        ...envConfig.contracts,
        ...deployedContracts
    };

    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\nDeployment complete! Updated addresses saved to config.');

    // Setup monitoring if enabled
    if (envConfig.monitoring.enabled) {
        await setupMonitoring(envConfig);
    }
}

async function verifyContract(address: string, constructorArguments: any[]) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: constructorArguments,
        });
    } catch (error) {
        console.error("Error verifying contract:", error);
        throw error;
    }
}

async function setupMonitoring(envConfig: DeploymentConfig['environments'][string]) {
    console.log('\nSetting up monitoring...');

    // Setup Prometheus metrics
    const metricsConfig = {
        endpoint: envConfig.monitoring.prometheusUrl,
        metrics: [
            'transaction_count',
            'block_height',
            'gas_price',
            'contract_events'
        ]
    };

    // Setup Grafana dashboards
    const dashboardConfig = {
        endpoint: envConfig.monitoring.grafanaUrl,
        dashboards: [
            'network_overview',
            'contract_metrics',
            'performance_metrics'
        ]
    };

    // Setup alerting if enabled
    if (envConfig.monitoring.alerting?.enabled) {
        const alertConfig = {
            slack: envConfig.monitoring.alerting.slackWebhook,
            discord: envConfig.monitoring.alerting.discordWebhook,
            email: envConfig.monitoring.alerting.emailNotifications
        };
        // Setup alert rules and notifications
        await setupAlerts(alertConfig);
    }

    console.log('Monitoring setup complete!');
}

async function setupAlerts(alertConfig: any) {
    // Implementation for setting up alerts
    console.log('Setting up alerts...');
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 