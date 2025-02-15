import { ethers } from 'hardhat';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying StrategyFactory with account:', deployer.address);

  // Deploy strategy implementations
  console.log('Deploying strategy implementations...');

  const GridTradingStrategy = await ethers.getContractFactory('GridTradingStrategy');
  const gridTradingImpl = await GridTradingStrategy.deploy();
  await gridTradingImpl.deployed();
  console.log('GridTradingStrategy implementation deployed to:', gridTradingImpl.address);

  const MeanReversionStrategy = await ethers.getContractFactory('MeanReversionStrategy');
  const meanReversionImpl = await MeanReversionStrategy.deploy();
  await meanReversionImpl.deployed();
  console.log('MeanReversionStrategy implementation deployed to:', meanReversionImpl.address);

  const TrendFollowingStrategy = await ethers.getContractFactory('TrendFollowingStrategy');
  const trendFollowingImpl = await TrendFollowingStrategy.deploy();
  await trendFollowingImpl.deployed();
  console.log('TrendFollowingStrategy implementation deployed to:', trendFollowingImpl.address);

  // Deploy StrategyFactory
  const StrategyFactory = await ethers.getContractFactory('StrategyFactory');
  const strategyFactory = await StrategyFactory.deploy();
  await strategyFactory.deployed();
  console.log('StrategyFactory deployed to:', strategyFactory.address);

  // Initialize factory
  await strategyFactory.initialize();
  console.log('StrategyFactory initialized');

  // Register strategy implementations
  await strategyFactory.registerStrategy(
    'GRID_TRADING',
    gridTradingImpl.address,
    ethers.utils.parseEther('0.001') // 0.1% deployment fee
  );
  console.log('Registered GridTradingStrategy');

  await strategyFactory.registerStrategy(
    'MEAN_REVERSION',
    meanReversionImpl.address,
    ethers.utils.parseEther('0.001') // 0.1% deployment fee
  );
  console.log('Registered MeanReversionStrategy');

  await strategyFactory.registerStrategy(
    'TREND_FOLLOWING',
    trendFollowingImpl.address,
    ethers.utils.parseEther('0.001') // 0.1% deployment fee
  );
  console.log('Registered TrendFollowingStrategy');

  // Set up strategy parameters
  const strategyParams = {
    maxGrids: 100,
    minGridSpacing: ethers.utils.parseEther('0.001'),
    maxPriceRange: ethers.utils.parseEther('0.5'),
    minLookbackPeriod: 24,
    maxLookbackPeriod: 168,
    minDeviationThreshold: ethers.utils.parseEther('0.02'),
    maxDeviationThreshold: ethers.utils.parseEther('0.1'),
    minTrendStrength: ethers.utils.parseEther('0.01')
  };

  await strategyFactory.setStrategyParameters('GRID_TRADING', [
    strategyParams.maxGrids,
    strategyParams.minGridSpacing,
    strategyParams.maxPriceRange
  ]);
  console.log('Set GridTradingStrategy parameters');

  await strategyFactory.setStrategyParameters('MEAN_REVERSION', [
    strategyParams.minLookbackPeriod,
    strategyParams.maxLookbackPeriod,
    strategyParams.minDeviationThreshold,
    strategyParams.maxDeviationThreshold
  ]);
  console.log('Set MeanReversionStrategy parameters');

  await strategyFactory.setStrategyParameters('TREND_FOLLOWING', [
    strategyParams.minLookbackPeriod,
    strategyParams.maxLookbackPeriod,
    strategyParams.minTrendStrength
  ]);
  console.log('Set TrendFollowingStrategy parameters');

  return {
    strategyFactory: strategyFactory.address,
    implementations: {
      gridTrading: gridTradingImpl.address,
      meanReversion: meanReversionImpl.address,
      trendFollowing: trendFollowingImpl.address
    }
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
