import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Multicall3
  const Multicall3 = await ethers.getContractFactory("Multicall3");
  const multicall3 = await Multicall3.deploy();
  await multicall3.deployed();
  console.log("Multicall3 deployed to:", multicall3.address);

  // Deploy ProxyAdmin for upgradeable contracts
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.deployed();
  console.log("ProxyAdmin deployed to:", proxyAdmin.address);

  // Deploy TransparentUpgradeableProxy
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  
  // Deploy WETH9
  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth9 = await WETH9.deploy();
  await weth9.deployed();
  console.log("WETH9 deployed to:", weth9.address);

  // Deploy UniswapV2Factory
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
  const uniswapFactory = await UniswapV2Factory.deploy(deployer.address);
  await uniswapFactory.deployed();
  console.log("UniswapV2Factory deployed to:", uniswapFactory.address);

  // Deploy UniswapV2Router02
  const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
  const uniswapRouter = await UniswapV2Router02.deploy(
    uniswapFactory.address,
    weth9.address
  );
  await uniswapRouter.deployed();
  console.log("UniswapV2Router02 deployed to:", uniswapRouter.address);

  // Deploy ChainlinkOracle
  const ChainlinkOracle = await ethers.getContractFactory("ChainlinkOracle");
  const chainlinkOracle = await ChainlinkOracle.deploy();
  await chainlinkOracle.deployed();
  console.log("ChainlinkOracle deployed to:", chainlinkOracle.address);

  // Deploy PriceOracle
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.deployed();
  console.log("PriceOracle deployed to:", priceOracle.address);

  // Deploy ENSRegistry
  const ENSRegistry = await ethers.getContractFactory("ENSRegistry");
  const ensRegistry = await ENSRegistry.deploy();
  await ensRegistry.deployed();
  console.log("ENSRegistry deployed to:", ensRegistry.address);

  // Deploy PublicResolver
  const PublicResolver = await ethers.getContractFactory("PublicResolver");
  const publicResolver = await PublicResolver.deploy(ensRegistry.address, weth9.address);
  await publicResolver.deployed();
  console.log("PublicResolver deployed to:", publicResolver.address);

  // Deploy Governance Token
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy("Chain138 Governance", "C138");
  await governanceToken.deployed();
  console.log("GovernanceToken deployed to:", governanceToken.address);

  // Deploy Timelock
  const Timelock = await ethers.getContractFactory("Timelock");
  const timelock = await Timelock.deploy(deployer.address, 172800); // 2 days delay
  await timelock.deployed();
  console.log("Timelock deployed to:", timelock.address);

  // Deploy GovernorBravo
  const GovernorBravo = await ethers.getContractFactory("GovernorBravo");
  const governorBravo = await GovernorBravo.deploy(
    timelock.address,
    governanceToken.address,
    17280, // voting delay (1 day)
    17280, // voting period (1 day)
    100000e18 // proposal threshold
  );
  await governorBravo.deployed();
  console.log("GovernorBravo deployed to:", governorBravo.address);

  // Write deployment addresses to a file
  const fs = require("fs");
  const deployments = {
    multicall3: multicall3.address,
    proxyAdmin: proxyAdmin.address,
    weth9: weth9.address,
    uniswapFactory: uniswapFactory.address,
    uniswapRouter: uniswapRouter.address,
    chainlinkOracle: chainlinkOracle.address,
    priceOracle: priceOracle.address,
    ensRegistry: ensRegistry.address,
    publicResolver: publicResolver.address,
    governanceToken: governanceToken.address,
    timelock: timelock.address,
    governorBravo: governorBravo.address
  };

  fs.writeFileSync(
    "deployments.json",
    JSON.stringify(deployments, null, 2)
  );

  console.log("All contracts deployed successfully!");
  console.log("Deployment addresses saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 