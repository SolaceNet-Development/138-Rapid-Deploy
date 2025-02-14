# Chain 138 SDK Integration Guide

## Overview
This guide provides instructions for integrating Chain 138 into various blockchain development SDKs and tools.

## Chain Configuration

### Basic Chain Info
```typescript
const chain138Config = {
  id: 138,
  name: 'Chain 138',
  network: 'chain138',
  nativeCurrency: {
    decimals: 18,
    name: 'Chain 138',
    symbol: 'C138',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.chain138.com'],
      webSocket: ['wss://ws.chain138.com'],
    },
    public: {
      http: ['https://rpc.chain138.com'],
      webSocket: ['wss://ws.chain138.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chain 138 Explorer',
      url: 'https://explorer.chain138.com',
    },
  },
  contracts: {
    multicall3: {
      address: '0x...',
      blockCreated: 1,
    },
  },
}
```

## SDK Integration Examples

### Ethers.js Integration
```typescript
import { ethers } from 'ethers';

// Create provider
const provider = new ethers.providers.JsonRpcProvider('https://rpc.chain138.com');

// Create signer
const signer = new ethers.Wallet(privateKey, provider);

// Create contract instance
const contract = new ethers.Contract(address, abi, signer);
```

### Web3.js Integration
```javascript
const Web3 = require('web3');

// Create Web3 instance
const web3 = new Web3('https://rpc.chain138.com');

// Create contract instance
const contract = new web3.eth.Contract(abi, address);
```

### Thirdweb Integration
```typescript
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Chain138 } from "./chain138";

// Initialize SDK with Chain 138
const sdk = new ThirdwebSDK(Chain138);

// Deploy contract
const contractAddress = await sdk.deployer.deployContract({
  name: "MyContract",
  contractType: "custom",
  abi: [...],
  bytecode: "0x..."
});
```

### Tatum Integration
```typescript
import { TatumSDK, Network } from '@tatumio/tatum';

// Initialize SDK with Chain 138
const tatum = await TatumSDK.init({
  network: {
    name: 'chain138',
    rpc: {
      url: 'https://rpc.chain138.com',
    },
    chain: 'C138',
    chainId: 138,
  },
  apiKey: 'YOUR_API_KEY',
});

// Use SDK
const balance = await tatum.address.getBalance({
  address: '0x...',
});
```

## Chain-Specific Features

### Governance Integration
```typescript
import { Chain138Governance } from '@chain138/governance';

const governance = new Chain138Governance({
  rpcUrl: 'https://rpc.chain138.com',
  governanceAddress: '0x...',
});

// Create proposal
const proposalId = await governance.createProposal({
  title: 'My Proposal',
  description: 'Description',
  actions: [...],
});
```

### Cross-Chain Bridge Integration
```typescript
import { Chain138Bridge } from '@chain138/bridge';

const bridge = new Chain138Bridge({
  sourceChain: 'ethereum',
  destinationChain: 'chain138',
  rpcUrl: 'https://rpc.chain138.com',
});

// Bridge assets
const tx = await bridge.bridgeAssets({
  token: '0x...',
  amount: '1000000000000000000',
  recipient: '0x...',
});
```

## Best Practices

### RPC URL Management
```typescript
const RPC_URLS = {
  mainnet: 'https://rpc.chain138.com',
  testnet: 'https://testnet.rpc.chain138.com',
  local: 'http://localhost:8545',
};

function getProvider(network: 'mainnet' | 'testnet' | 'local') {
  return new ethers.providers.JsonRpcProvider(RPC_URLS[network]);
}
```

### Error Handling
```typescript
try {
  const tx = await contract.method();
  await tx.wait();
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Handle network issues
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    // Handle insufficient funds
  } else {
    // Handle other errors
  }
}
```

### Gas Management
```typescript
const gasPrice = await provider.getGasPrice();
const gasLimit = await contract.estimateGas.method();

const tx = await contract.method({
  gasPrice: gasPrice.mul(120).div(100), // 20% buffer
  gasLimit: gasLimit.mul(120).div(100), // 20% buffer
});
```

## Testing

### Local Testing
```typescript
import { Chain138Local } from '@chain138/local';

// Start local node
const node = new Chain138Local({
  port: 8545,
  chainId: 138,
});

// Connect to local node
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
```

### Testnet Usage
```typescript
const TESTNET_CONFIG = {
  rpcUrl: 'https://testnet.rpc.chain138.com',
  chainId: 13800,
  faucetUrl: 'https://faucet.testnet.chain138.com',
};

async function getTestnetTokens(address: string) {
  const response = await fetch(TESTNET_CONFIG.faucetUrl, {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
  return response.json();
}
```

## Security Considerations

### Private Key Management
```typescript
import { Wallet } from 'ethers';

// Generate new wallet
const wallet = Wallet.createRandom();

// Save encrypted JSON
const encryptedJson = await wallet.encrypt(password);

// Load from encrypted JSON
const loadedWallet = await Wallet.fromEncryptedJson(encryptedJson, password);
```

### Transaction Signing
```typescript
// Sign transaction
const signedTx = await wallet.signTransaction({
  to: recipient,
  value: amount,
  nonce: await provider.getTransactionCount(wallet.address),
  gasLimit: 21000,
  gasPrice: await provider.getGasPrice(),
});

// Send signed transaction
const tx = await provider.sendTransaction(signedTx);
```

## Monitoring and Analytics

### Event Monitoring
```typescript
contract.on('Transfer', (from, to, amount, event) => {
  console.log(`
    Transfer:
    From: ${from}
    To: ${to}
    Amount: ${amount}
    Block: ${event.blockNumber}
  `);
});
```

### Analytics Integration
```typescript
interface TransactionMetrics {
  blockTime: number;
  gasUsed: number;
  transactionCount: number;
}

async function collectMetrics(): Promise<TransactionMetrics> {
  const block = await provider.getBlock('latest');
  return {
    blockTime: block.timestamp,
    gasUsed: block.gasUsed.toNumber(),
    transactionCount: block.transactions.length,
  };
}
``` 