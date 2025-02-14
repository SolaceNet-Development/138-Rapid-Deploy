import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

interface HardhatGasReporterConfig extends HardhatUserConfig {
  gasReporter?: {
    enabled?: boolean;
    currency?: string;
    excludeContracts?: string[];
    src?: string;
  };
  coverage?: {
    exclude?: string[];
    watermarks?: {
      statements: [number, number];
      branches: [number, number];
      functions: [number, number];
      lines: [number, number];
    };
  };
}

dotenv.config();

const config: HardhatGasReporterConfig = {
  coverage: {
    exclude: ["contracts/mocks", "contracts/test"],
    watermarks: {
      statements: [80, 90],
      branches: [80, 90],
      functions: [80, 90],
      lines: [80, 90]
    }
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 138,
      mining: {
        auto: true,
        interval: 5000
      }
    },
    chain138: {
      url: process.env.CHAIN_138_RPC || "http://localhost:8545",
      chainId: 138,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
      gasPrice: "auto"
    },
    chain138Test: {
      url: process.env.CHAIN_138_TEST_RPC || "http://localhost:8546",
      chainId: 13800,
      accounts: process.env.TEST_PRIVATE_KEY ? [process.env.TEST_PRIVATE_KEY] : [],
      gas: 8000000,
      gasPrice: "auto"
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    excludeContracts: [],
    src: "./contracts"
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};

export default config;    