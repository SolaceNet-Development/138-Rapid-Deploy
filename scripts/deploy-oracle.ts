import { ethers } from 'hardhat';
import { Contract } from 'ethers';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying PriceOracle with account:", deployer.address);

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    console.log("PriceOracle deployed to:", priceOracle.address);

    // Initialize oracle
    await priceOracle.initialize();
    console.log("PriceOracle initialized");

    // Set up price feeds
    const priceFeeds = [
        {
            token: process.env.ETH_ADDRESS || "0x...",
            feed: process.env.ETH_USD_FEED || "0x..."
        },
        {
            token: process.env.BTC_ADDRESS || "0x...",
            feed: process.env.BTC_USD_FEED || "0x..."
        },
        {
            token: process.env.USDC_ADDRESS || "0x...",
            feed: process.env.USDC_USD_FEED || "0x..."
        }
    ];

    for (const feed of priceFeeds) {
        await priceOracle.addPriceFeed(
            feed.token,
            feed.feed,
            18 // decimals
        );
        console.log(`Added price feed for token: ${feed.token}`);
    }

    // Set up oracle parameters
    await priceOracle.setParameters(
        300, // 5 minutes heartbeat
        ethers.utils.parseEther("0.01"), // 1% max deviation
        3 // minimum number of sources
    );
    console.log("Oracle parameters set");

    // Set up oracle operators
    const operators = [
        process.env.OPERATOR_1 || deployer.address,
        process.env.OPERATOR_2 || deployer.address,
        process.env.OPERATOR_3 || deployer.address
    ];

    for (const operator of operators) {
        await priceOracle.addOperator(operator);
        console.log(`Added operator: ${operator}`);
    }

    return {
        priceOracle: priceOracle.address
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 