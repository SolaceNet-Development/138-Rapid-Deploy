import { Contract, providers, Wallet, utils, BigNumber, Log } from 'ethers';
import { tatumService } from './TatumService';
import { thirdwebService } from './ThirdwebService';

interface BridgeConfig {
  sourceChain: {
    rpcUrl: string;
    chainId: number;
    bridgeAddress: string;
  };
  destinationChain: {
    rpcUrl: string;
    chainId: number;
    bridgeAddress: string;
  };
}

interface BridgeContract extends Contract {
  getMessageFee(): Promise<BigNumber>;
  bridgeTokens(
    token: string,
    amount: BigNumber,
    recipient: string,
    deadline: number,
    overrides: any
  ): Promise<any>;
  messageStatus(messageId: string): Promise<number>;
  claimTokens(messageId: string, overrides: any): Promise<boolean>;
  getTotalBridged(): Promise<BigNumber>;
  getActiveTransfers(): Promise<BigNumber>;
  getSuccessRate(): Promise<BigNumber>;
  estimateFees(token: string, amount: BigNumber): Promise<[BigNumber, BigNumber]>;
}

class BridgeService {
  private sourceProvider: providers.Provider;
  private destProvider: providers.Provider;
  private sourceSigner: Wallet | null = null;
  private destSigner: Wallet | null = null;
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
    this.sourceProvider = new providers.JsonRpcProvider(config.sourceChain.rpcUrl);
    this.destProvider = new providers.JsonRpcProvider(config.destinationChain.rpcUrl);
  }

  async connect(sourcePrivateKey: string, destPrivateKey?: string) {
    this.sourceSigner = new Wallet(sourcePrivateKey, this.sourceProvider);
    if (destPrivateKey) {
      this.destSigner = new Wallet(destPrivateKey, this.destProvider);
    }
  }

  // Bridge Token Transfer
  async bridgeTokens(
    tokenAddress: string,
    amount: string,
    recipient: string,
    options: {
      gasLimit?: number;
      maxFee?: string;
      deadline?: number;
    } = {}
  ) {
    if (!this.sourceSigner) throw new Error('Not connected');

    const bridge = new Contract(
      this.config.sourceChain.bridgeAddress,
      [
        'function bridgeTokens(address,uint256,address,uint256) returns (bytes32)',
        'function getMessageFee() view returns (uint256)'
      ],
      this.sourceSigner
    ) as BridgeContract;

    // Get bridge fee
    const fee = await bridge.getMessageFee();

    // Prepare transaction
    const tx = await bridge.bridgeTokens(
      tokenAddress,
      utils.parseEther(amount),
      recipient,
      options.deadline || Math.floor(Date.now() / 1000) + 3600,
      {
        value: options.maxFee ? utils.parseEther(options.maxFee) : fee,
        gasLimit: options.gasLimit || 300000,
        gasPrice: await this.sourceProvider.getGasPrice()
      }
    );

    return tx;
  }

  // Monitor Bridge Transaction
  async monitorBridgeTransaction(txHash: string) {
    const receipt = await this.sourceProvider.waitForTransaction(txHash);

    // Get bridge event
    const bridge = new Contract(
      this.config.sourceChain.bridgeAddress,
      [
        'event TokensBridged(bytes32 indexed messageId, address token, uint256 amount, address recipient)'
      ],
      this.sourceProvider
    ) as BridgeContract;

    const events = receipt.logs
      .filter((log: Log) => log.address === this.config.sourceChain.bridgeAddress)
      .map((log: Log) => {
        try {
          return bridge.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (events.length === 0) {
      throw new Error('No bridge event found');
    }

    return {
      messageId: events[0].args.messageId,
      token: events[0].args.token,
      amount: events[0].args.amount,
      recipient: events[0].args.recipient
    };
  }

  // Check Message Status
  async checkMessageStatus(messageId: string) {
    const bridge = new Contract(
      this.config.destinationChain.bridgeAddress,
      ['function messageStatus(bytes32) view returns (uint8)'],
      this.destProvider
    ) as BridgeContract;

    const status = await bridge.messageStatus(messageId);
    return {
      status,
      description: this.getStatusDescription(status)
    };
  }

  // Claim Bridged Tokens
  async claimTokens(messageId: string) {
    if (!this.destSigner) throw new Error('Destination chain not connected');

    const bridge = new Contract(
      this.config.destinationChain.bridgeAddress,
      ['function claimTokens(bytes32) returns (bool)'],
      this.destSigner
    ) as BridgeContract;

    const tx = await bridge.claimTokens(messageId, {
      gasLimit: 200000,
      gasPrice: await this.destProvider.getGasPrice()
    });

    return tx;
  }

  // Get Bridge Statistics
  async getBridgeStats() {
    const sourceBridge = new Contract(
      this.config.sourceChain.bridgeAddress,
      [
        'function getTotalBridged() view returns (uint256)',
        'function getActiveTransfers() view returns (uint256)',
        'function getSuccessRate() view returns (uint256)'
      ],
      this.sourceProvider
    ) as BridgeContract;

    const [totalBridged, activeTransfers, successRate] = await Promise.all([
      sourceBridge.getTotalBridged(),
      sourceBridge.getActiveTransfers(),
      sourceBridge.getSuccessRate()
    ]);

    return {
      totalBridged: utils.formatEther(totalBridged),
      activeTransfers: activeTransfers.toString(),
      successRate: successRate.toString()
    };
  }

  // Get Bridge Fees
  async estimateBridgeFees(tokenAddress: string, amount: string) {
    const bridge = new Contract(
      this.config.sourceChain.bridgeAddress,
      [
        'function estimateFees(address,uint256) view returns (uint256,uint256)',
        'function getMessageFee() view returns (uint256)'
      ],
      this.sourceProvider
    ) as BridgeContract;

    const [bridgeFee, messageFee] = await Promise.all([
      bridge.estimateFees(tokenAddress, utils.parseEther(amount)),
      bridge.getMessageFee()
    ]);

    const [fee1, fee2] = bridgeFee;
    return {
      bridgeFee: utils.formatEther(fee1),
      messageFee: utils.formatEther(messageFee),
      total: utils.formatEther(fee1.add(messageFee))
    };
  }

  private getStatusDescription(status: number): string {
    switch (status) {
      case 0:
        return 'Pending';
      case 1:
        return 'Completed';
      case 2:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }
}

// Create instance for Chain 138 to Ethereum bridge
export const chain138ToEthBridge = new BridgeService({
  sourceChain: {
    rpcUrl: 'https://rpc.chain138.com',
    chainId: 138,
    bridgeAddress: '0x...' // Chain 138 bridge address
  },
  destinationChain: {
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
    chainId: 1,
    bridgeAddress: '0x...' // Ethereum bridge address
  }
});
