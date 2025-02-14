#!/usr/bin/env node

const { ethers } = require('ethers');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');

// ABI for ERC20 token contract
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

class RewardDistributor {
  constructor(provider, wallet, tokenAddress, rewardPerPoint) {
    this.provider = provider;
    this.wallet = wallet;
    this.tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    this.rewardPerPoint = ethers.utils.parseEther(rewardPerPoint.toString());
  }

  async initialize() {
    // Get token decimals
    this.decimals = await this.tokenContract.decimals();
    
    // Check wallet balance
    const balance = await this.tokenContract.balanceOf(this.wallet.address);
    console.log(`Wallet balance: ${ethers.utils.formatUnits(balance, this.decimals)} tokens`);
  }

  async distributeRewards(points) {
    const results = {};
    const failedTransactions = [];

    for (const [user, userPoints] of Object.entries(points)) {
      try {
        // Get user's Ethereum address from GitHub username
        const userAddress = await this.getUserAddress(user);
        if (!userAddress) {
          console.warn(`No Ethereum address found for user ${user}`);
          continue;
        }

        // Calculate reward amount
        const rewardAmount = this.rewardPerPoint.mul(userPoints);
        
        // Send transaction
        console.log(`Distributing ${ethers.utils.formatUnits(rewardAmount, this.decimals)} tokens to ${user} (${userAddress})`);
        const tx = await this.tokenContract.transfer(userAddress, rewardAmount);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        results[user] = ethers.utils.formatUnits(rewardAmount, this.decimals);
        
        // Log success
        console.log(`Successfully sent rewards to ${user} (tx: ${receipt.transactionHash})`);
        
        // Add delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to send rewards to ${user}:`, error);
        failedTransactions.push({ user, error: error.message });
      }
    }

    // Save distribution results
    this.saveDistributionResults(results, failedTransactions);

    return results;
  }

  async getUserAddress(username) {
    // Read mapping from JSON file
    const mappingPath = path.join(__dirname, '../data/github-eth-mapping.json');
    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    return mapping[username];
  }

  saveDistributionResults(results, failedTransactions) {
    const timestamp = new Date().toISOString();
    const distributionData = {
      timestamp,
      results,
      failedTransactions,
      totalDistributed: Object.values(results).reduce((a, b) => a + parseFloat(b), 0)
    };

    // Save to distribution history
    const historyPath = path.join(__dirname, '../data/distribution-history.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
    history.push(distributionData);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    // Save latest distribution results
    const resultsPath = path.join(__dirname, '../data/latest-distribution.json');
    fs.writeFileSync(resultsPath, JSON.stringify(distributionData, null, 2));
  }
}

async function main() {
  program
    .requiredOption('--points <json>', 'JSON string of user points')
    .requiredOption('--token-address <address>', 'Address of the reward token contract')
    .requiredOption('--reward-per-point <number>', 'Number of tokens to award per point')
    .parse(process.argv);

  const { points, tokenAddress, rewardPerPoint } = program.opts();

  try {
    // Parse points data
    const pointsData = JSON.parse(points);

    // Setup provider and wallet
    const provider = new ethers.providers.InfuraProvider(
      'mainnet',
      process.env.INFURA_API_KEY
    );
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Initialize distributor
    const distributor = new RewardDistributor(
      provider,
      wallet,
      tokenAddress,
      rewardPerPoint
    );
    await distributor.initialize();

    // Distribute rewards
    const results = await distributor.distributeRewards(pointsData);

    // Output results
    console.log('Distribution completed successfully');
    console.log(JSON.stringify({ rewards: results }, null, 2));
  } catch (error) {
    console.error('Error during distribution:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error); 