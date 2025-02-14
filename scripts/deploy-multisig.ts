import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface MultiSigConfig {
    enabled: boolean;
    threshold: number;
    owners: string[];
    delayPeriod: number;
    executionDelay?: number;
    guardians?: string[];
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying MultiSig Governance with account:", deployer.address);

    // Load configuration
    const configPath = path.join(__dirname, '../deployment/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const env = process.env.DEPLOYMENT_ENV || 'development';
    const multiSigConfig: MultiSigConfig = config.environments[env].security.multiSig;

    if (!multiSigConfig.enabled) {
        console.log("MultiSig governance is disabled for this environment");
        return;
    }

    // Deploy MultiSig Wallet
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = await MultiSigWallet.deploy(
        multiSigConfig.owners.length > 0 ? multiSigConfig.owners : [deployer.address],
        multiSigConfig.threshold
    );
    await multiSigWallet.deployed();
    console.log("MultiSigWallet deployed to:", multiSigWallet.address);

    // Deploy Timelock
    const Timelock = await ethers.getContractFactory("Timelock");
    const timelock = await Timelock.deploy(
        multiSigWallet.address,
        multiSigConfig.delayPeriod
    );
    await timelock.deployed();
    console.log("Timelock deployed to:", timelock.address);

    // Deploy Guardian Registry if guardians are configured
    let guardianRegistry;
    if (multiSigConfig.guardians && multiSigConfig.guardians.length > 0) {
        const GuardianRegistry = await ethers.getContractFactory("GuardianRegistry");
        guardianRegistry = await GuardianRegistry.deploy(
            multiSigWallet.address,
            multiSigConfig.guardians
        );
        await guardianRegistry.deployed();
        console.log("GuardianRegistry deployed to:", guardianRegistry.address);

        // Link Guardian Registry to MultiSig
        await multiSigWallet.setGuardianRegistry(guardianRegistry.address);
        console.log("Guardian Registry linked to MultiSig");
    }

    // Set up governance parameters
    const governanceParams = {
        minDelay: multiSigConfig.delayPeriod,
        executionDelay: multiSigConfig.executionDelay || 86400,
        gracePeriod: 604800, // 1 week
        maxOperations: 10,
        votingPeriod: 17280 // ~3 days with 15s blocks
    };

    await multiSigWallet.setGovernanceParams(governanceParams);
    console.log("Governance parameters set");

    // Set up operation types
    const operationTypes = [
        {
            name: "protocol_upgrade",
            requiredApprovals: multiSigConfig.threshold,
            timelock: true,
            guardianVeto: true
        },
        {
            name: "parameter_change",
            requiredApprovals: Math.ceil(multiSigConfig.threshold / 2),
            timelock: true,
            guardianVeto: false
        },
        {
            name: "emergency_action",
            requiredApprovals: 1,
            timelock: false,
            guardianVeto: true
        }
    ];

    for (const op of operationTypes) {
        await multiSigWallet.setOperationType(
            ethers.utils.formatBytes32String(op.name),
            op.requiredApprovals,
            op.timelock,
            op.guardianVeto
        );
        console.log(`Operation type set: ${op.name}`);
    }

    // Set up security policies
    const securityPolicies = [
        {
            name: "max_value_policy",
            params: {
                maxValue: ethers.utils.parseEther("1000000"),
                requiresFullConsensus: true
            }
        },
        {
            name: "cooldown_policy",
            params: {
                cooldownPeriod: 3600,
                maxOperationsPerPeriod: 5
            }
        },
        {
            name: "restricted_addresses_policy",
            params: {
                restrictedAddresses: [],
                requiresGuardianApproval: true
            }
        }
    ];

    for (const policy of securityPolicies) {
        await multiSigWallet.addSecurityPolicy(
            ethers.utils.formatBytes32String(policy.name),
            policy.params
        );
        console.log(`Security policy added: ${policy.name}`);
    }

    // Set up monitoring hooks
    const monitoringHooks = {
        preExecution: true,
        postExecution: true,
        failedExecution: true,
        guardianActions: true
    };

    await multiSigWallet.setMonitoringHooks(monitoringHooks);
    console.log("Monitoring hooks configured");

    return {
        multiSigWallet: multiSigWallet.address,
        timelock: timelock.address,
        guardianRegistry: guardianRegistry?.address
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 