import { ethers } from 'hardhat';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying MarginPool with account:', deployer.address);

  // Deploy MarginPool
  const MarginPool = await ethers.getContractFactory('MarginPool');
  const marginPool = await MarginPool.deploy(
    ethers.utils.parseEther('0.8'), // 80% max LTV
    ethers.utils.parseEther('0.85'), // 85% liquidation threshold
    ethers.utils.parseEther('0.05') // 5% liquidation penalty
  );

  await marginPool.deployed();
  console.log('MarginPool deployed to:', marginPool.address);

  // Initialize pool
  await marginPool.initialize();
  console.log('MarginPool initialized');

  // Set up interest rate model
  await marginPool.setInterestRateModel(
    ethers.utils.parseEther('0.02'), // 2% base rate
    ethers.utils.parseEther('0.1'), // 10% slope1
    ethers.utils.parseEther('0.2'), // 20% slope2
    ethers.utils.parseEther('0.8') // 80% optimal utilization
  );
  console.log('Interest rate model set');

  // Set up supported collateral tokens
  const supportedTokens = [
    {
      token: process.env.USDC_ADDRESS || '0x...',
      ltv: ethers.utils.parseEther('0.8'),
      liquidationThreshold: ethers.utils.parseEther('0.85')
    },
    {
      token: process.env.ETH_ADDRESS || '0x...',
      ltv: ethers.utils.parseEther('0.75'),
      liquidationThreshold: ethers.utils.parseEther('0.8')
    }
  ];

  for (const token of supportedTokens) {
    await marginPool.addSupportedToken(token.token, token.ltv, token.liquidationThreshold);
    console.log(`Added support for token: ${token.token}`);
  }

  return {
    marginPool: marginPool.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
