import { ethers } from 'hardhat';
import type { Contract } from 'ethers';
import '@nomiclabs/hardhat-ethers';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy GovernanceToken
    console.log("\nDeploying Chain138Token...");
    const GovernanceToken = await ethers.getContractFactory("Chain138Token");
    const governanceToken = await GovernanceToken.deploy(process.env.PROTOCOL_ADMIN || deployer.address);
    await governanceToken.deployed();
    console.log("Chain138Token deployed to:", governanceToken.address);

    // Deploy TimelockController
    console.log("\nDeploying TimelockController...");
    const TimelockController = await ethers.getContractFactory("TimelockController");
    const timelock = await TimelockController.deploy(
        process.env.GOVERNANCE_TIMELOCK_DELAY || "172800",
        [process.env.PROTOCOL_ADMIN || deployer.address],
        [process.env.PROTOCOL_GUARDIAN || deployer.address],
        process.env.ADMIN_MULTISIG || deployer.address
    );
    await timelock.deployed();
    console.log("TimelockController deployed to:", timelock.address);

    // Deploy Governance
    console.log("\nDeploying Chain138Governance...");
    const Governance = await ethers.getContractFactory("Chain138Governance");
    const governance = await Governance.deploy(
        governanceToken.address,
        timelock.address,
        process.env.GOVERNANCE_VOTING_DELAY || "17280",
        process.env.GOVERNANCE_VOTING_PERIOD || "17280",
        process.env.GOVERNANCE_PROPOSAL_THRESHOLD || "100000000000000000000000",
        4 // 4% quorum
    );
    await governance.deployed();
    console.log("Chain138Governance deployed to:", governance.address);

    console.log('\nDeployment complete!');
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });        