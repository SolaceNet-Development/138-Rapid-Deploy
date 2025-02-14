import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Governance Token
  console.log("Deploying Governance Token...");
  const Chain138Token = await ethers.getContractFactory("Chain138Token");
  const token = await Chain138Token.deploy();
  await token.deployed();
  console.log("Governance Token deployed to:", token.address);

  // Deploy Timelock
  console.log("Deploying Timelock...");
  const minDelay = 172800; // 2 days
  const Chain138Timelock = await ethers.getContractFactory("Chain138Timelock");
  const timelock = await Chain138Timelock.deploy(
    minDelay,
    [], // proposers - will be set to governor
    [], // executors - will be set to governor
    deployer.address // admin
  );
  await timelock.deployed();
  console.log("Timelock deployed to:", timelock.address);

  // Deploy Governor
  console.log("Deploying Governor...");
  const votingDelay = 7200; // 1 day (assuming 12s block time)
  const votingPeriod = 50400; // 1 week (assuming 12s block time)
  const proposalThreshold = ethers.utils.parseEther("100000"); // 100,000 tokens
  const quorumPercentage = 4; // 4% quorum

  const Chain138Governance = await ethers.getContractFactory("Chain138Governance");
  const governor = await Chain138Governance.deploy(
    token.address,
    timelock.address,
    votingDelay,
    votingPeriod,
    proposalThreshold,
    quorumPercentage
  );
  await governor.deployed();
  console.log("Governor deployed to:", governor.address);

  // Setup roles
  console.log("Setting up roles...");
  
  // Timelock roles
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.TIMELOCK_ADMIN_ROLE();

  // Grant proposer role to governor
  await timelock.grantRole(proposerRole, governor.address);
  console.log("Granted proposer role to governor");

  // Grant executor role to governor
  await timelock.grantRole(executorRole, governor.address);
  console.log("Granted executor role to governor");

  // Revoke admin role from deployer
  await timelock.revokeRole(adminRole, deployer.address);
  console.log("Revoked admin role from deployer");

  // Transfer token ownership to timelock
  await token.transferOwnership(timelock.address);
  console.log("Transferred token ownership to timelock");

  // Write deployment addresses to a file
  const fs = require("fs");
  const deployments = {
    token: token.address,
    timelock: timelock.address,
    governor: governor.address,
    network: network.name,
    deployer: deployer.address
  };

  fs.writeFileSync(
    "deployments/governance.json",
    JSON.stringify(deployments, null, 2)
  );

  console.log("Deployment addresses saved to deployments/governance.json");
  console.log("\nGovernance system deployment completed!");
  console.log("Please verify the contracts on Etherscan.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 