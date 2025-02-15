import { ethers } from 'hardhat';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying PerpetualMarket with account:', deployer.address);

  // Deploy PriceOracle if not already deployed
  let priceOracleAddress = process.env.PRICE_ORACLE_ADDRESS;
  if (!priceOracleAddress) {
    const PriceOracle = await ethers.getContractFactory('PriceOracle');
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    priceOracleAddress = priceOracle.address;
    console.log('PriceOracle deployed to:', priceOracleAddress);
  }

  // Deploy PerpetualMarket
  const PerpetualMarket = await ethers.getContractFactory('PerpetualMarket');
  const perpetualMarket = await PerpetualMarket.deploy(
    priceOracleAddress,
    ethers.utils.parseEther('0.05'), // 5% maintenance margin
    ethers.utils.parseEther('0.1'), // 10% initial margin
    10 // max leverage
  );

  await perpetualMarket.deployed();
  console.log('PerpetualMarket deployed to:', perpetualMarket.address);

  // Initialize market
  await perpetualMarket.initialize();
  console.log('PerpetualMarket initialized');

  // Set up market parameters
  await perpetualMarket.setParameters(
    ethers.utils.parseEther('0.001'), // 0.1% taker fee
    ethers.utils.parseEther('0.0005'), // 0.05% maker fee
    ethers.utils.parseEther('0.01'), // 1% liquidation fee
    ethers.utils.parseEther('1000000') // $1M max position size
  );
  console.log('Market parameters set');

  return {
    priceOracle: priceOracleAddress,
    perpetualMarket: perpetualMarket.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
