declare module 'hardhat' {
    import { ethers } from 'ethers';
    export { ethers };
    export const run: (taskName: string, args?: any) => Promise<any>;
}

declare module '@nomiclabs/hardhat-ethers' {
    import { ethers } from 'ethers';
    export { ethers };
}

declare module '@nomiclabs/hardhat-waffle' {
    export const solidity: any;
}

declare module 'ethers' {
    export namespace providers {
        export class Provider {
            getGasPrice(): Promise<BigNumber>;
            getBlock(blockHashOrBlockTag: BlockTag | string): Promise<Block>;
            getTransaction(transactionHash: string): Promise<TransactionResponse>;
            getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt>;
            waitForTransaction(transactionHash: string, confirmations?: number): Promise<TransactionReceipt>;
        }
        export class JsonRpcProvider extends Provider {
            constructor(url: string);
        }
    }

    export interface TransactionResponse {
        hash: string;
        blockNumber?: number;
        blockHash?: string;
        timestamp?: number;
        confirmations: number;
        from: string;
        to?: string;
        value: BigNumber;
        gasPrice: BigNumber;
        gasLimit: BigNumber;
        data: string;
        chainId: number;
        nonce: number;
        wait(confirmations?: number): Promise<TransactionReceipt>;
    }

    export interface TransactionReceipt {
        to: string;
        from: string;
        contractAddress: string;
        transactionIndex: number;
        root?: string;
        gasUsed: BigNumber;
        logsBloom: string;
        blockHash: string;
        transactionHash: string;
        logs: Array<Log>;
        blockNumber: number;
        confirmations: number;
        cumulativeGasUsed: BigNumber;
        effectiveGasPrice: BigNumber;
        byzantium: boolean;
        type: number;
        status?: number;
    }

    export interface Log {
        blockNumber: number;
        blockHash: string;
        transactionIndex: number;
        removed: boolean;
        address: string;
        data: string;
        topics: Array<string>;
        transactionHash: string;
        logIndex: number;
    }

    export interface Block {
        hash: string;
        parentHash: string;
        number: number;
        timestamp: number;
        nonce: string;
        difficulty: number;
        gasLimit: BigNumber;
        gasUsed: BigNumber;
        miner: string;
        extraData: string;
        transactions: Array<string>;
    }

    export type BlockTag = string | number;

    export class Contract {
        interface: utils.Interface;
        address: string;
        deployTransaction: TransactionResponse;
        deployed(): Promise<Contract>;
        
        constructor(address: string, abi: any[], signerOrProvider: Signer | providers.Provider);
        connect(signerOrProvider: Signer | providers.Provider): Contract;
        attach(addressOrName: string): Contract;
        
        // Standard contract methods
        initialize(...args: any[]): Promise<TransactionResponse>;
        setParameters(...args: any[]): Promise<TransactionResponse>;
        addPriceFeed(token: string, feed: string, decimals: number): Promise<TransactionResponse>;
        addOperator(operator: string): Promise<TransactionResponse>;
        registerStrategy(name: string, implementation: string, fee: BigNumber): Promise<TransactionResponse>;
        setStrategyParameters(name: string, params: any[]): Promise<TransactionResponse>;
        
        // Events
        filters: {
            [eventName: string]: (...args: any[]) => EventFilter;
        };
        queryFilter(event: EventFilter, fromBlock?: BlockTag, toBlock?: BlockTag): Promise<Array<Event>>;
        listeners(eventFilter?: EventFilter): Array<Listener>;
        on(event: EventFilter | string, listener: Listener): Contract;
        off(event: EventFilter | string, listener: Listener): Contract;
    }

    export interface EventFilter {
        address?: string;
        topics?: Array<string | Array<string> | null>;
    }

    export type Event = Log & {
        event?: string;
        eventSignature?: string;
        args?: Array<any> | { [key: string]: any };
    };

    export type Listener = (...args: Array<any>) => void;

    export class Wallet extends Signer {
        constructor(privateKey: string, provider?: providers.Provider);
        static createRandom(): Wallet;
        connect(provider: providers.Provider): Wallet;
    }

    export class Signer {
        connect(provider: providers.Provider): Signer;
        getAddress(): Promise<string>;
        address?: string;
    }

    export namespace utils {
        export function parseEther(value: string): BigNumber;
        export function formatEther(value: BigNumber): string;
        export function formatBytes32String(text: string): string;
        export const defaultAbiCoder: {
            encode(types: string[], values: any[]): string;
        };
        export const constants: {
            AddressZero: string;
            Zero: BigNumber;
            One: BigNumber;
            Two: BigNumber;
            WeiPerEther: BigNumber;
            MaxUint256: BigNumber;
            HashZero: string;
        };
        export function parseUnits(value: string, unit?: string | number): BigNumber;
    }

    export class BigNumber {
        static from(value: number | string): BigNumber;
        add(other: BigNumber): BigNumber;
        sub(other: BigNumber): BigNumber;
        mul(other: BigNumber): BigNumber;
        div(other: BigNumber): BigNumber;
        toString(): string;
    }

    export interface ContractFactory {
        deploy(...args: any[]): Promise<Contract | MultiSigWallet | MLSecurityOracle | MLModelRegistry | FeatureProcessor>;
    }

    export function getContractFactory(name: string): Promise<ContractFactory>;
    export function getSigners(): Promise<Signer[]>;
}

declare module 'chai' {
    export function expect(value: any): Assertion;
    export interface Assertion {
        to: Assertion;
        be: Assertion;
        not: Assertion;
        equal(value: any): void;
        revertedWith(reason: string): Promise<void>;
        rejectedWith(reason: string): Promise<void>;
        emit(contract: any, event: string): void;
        changeTokenBalance(token: any, wallet: any, change: any): Promise<void>;
        properHex(length: number): void;
        properPrivateKey: void;
        properAddress: void;
        above(value: number): void;
        greaterThan(value: number): void;
        true: void;
        false: void;
    }
}

declare namespace NodeJS {
    interface ProcessEnv {
        DEPLOYMENT_ENV?: string;
        PRICE_ORACLE_ADDRESS?: string;
        ETH_ADDRESS?: string;
        BTC_ADDRESS?: string;
        USDC_ADDRESS?: string;
        ETH_USD_FEED?: string;
        BTC_USD_FEED?: string;
        USDC_USD_FEED?: string;
        OPERATOR_1?: string;
        OPERATOR_2?: string;
        OPERATOR_3?: string;
        FRAUD_ALERT_SLACK_WEBHOOK?: string;
        FRAUD_ALERT_DISCORD_WEBHOOK?: string;
        FRAUD_ALERT_EMAIL?: string;
        MEV_PROTECTION_ADDRESS?: string;
        FLASHBOT_PROTECTION_ADDRESS?: string;
        FRAUD_PREVENTION_ADDRESS?: string;
        ANOMALY_DETECTION_ADDRESS?: string;
    }
}

// Add DeFi specific types
interface PerpetualPosition {
    isLong: boolean;
    size: BigNumber;
    leverage: number;
    entryPrice: BigNumber;
    liquidationPrice: BigNumber;
    margin: BigNumber;
    lastUpdateTime: number;
}

interface MarginPosition {
    borrowToken: string;
    borrowAmount: BigNumber;
    collateralToken: string;
    collateralAmount: BigNumber;
    healthFactor: BigNumber;
    interestRate: BigNumber;
    lastUpdateTime: number;
}

interface TradingStrategy {
    name: string;
    implementation: string;
    params: any;
    status: 'active' | 'paused' | 'closed';
    performance: {
        pnl: BigNumber;
        trades: number;
        winRate: number;
    };
}

interface PortfolioMetrics {
    totalValue: BigNumber;
    pnl: BigNumber;
    apy: number;
    sharpeRatio: number;
    volatility: number;
    drawdown: number;
    positions: Array<PerpetualPosition | MarginPosition>;
    strategies: Array<TradingStrategy>;
}

// Add Security specific types
interface MEVProtection extends Contract {
    setFlashbotProtection(address: string): Promise<ContractTransaction>;
    addProtectionRule(name: string, enabled: boolean, params: any): Promise<ContractTransaction>;
    setMonitoringParams(params: any): Promise<ContractTransaction>;
}

interface FlashbotProtection extends Contract {
    setPrivatePoolConfig(config: any): Promise<ContractTransaction>;
}

interface FraudPrevention extends Contract {
    addPreventionRule(name: string, params: any): Promise<ContractTransaction>;
    setAlertConfig(config: any): Promise<ContractTransaction>;
    addAutomatedResponse(trigger: string, actions: any[]): Promise<ContractTransaction>;
}

interface AnomalyDetection extends Contract {
    addDetectionRule(name: string, threshold: BigNumber, timeWindow: number): Promise<ContractTransaction>;
}

interface MonitoringRegistry extends Contract {
    addMetric(name: string, interval: number, aggregation: string): Promise<ContractTransaction>;
    addAlert(name: string, condition: string, threshold: string, severity: string): Promise<ContractTransaction>;
    setNotificationChannels(slack: string, discord: string, email: string): Promise<ContractTransaction>;
    updateDashboard(name: string, config: string): Promise<ContractTransaction>;
}

// Add Security specific metrics
interface SecurityMetrics {
    mevProtection: {
        blockedTransactions: number;
        savedValue: BigNumber;
        averageGasPrice: BigNumber;
    };
    fraudPrevention: {
        detectedIncidents: number;
        preventedLosses: BigNumber;
        activeAlerts: number;
    };
    anomalyDetection: {
        detectedAnomalies: number;
        falsePositives: number;
        responseTime: number;
    };
}

// Add Security Contract types
interface MultiSigWallet extends Contract {
    setGuardianRegistry(address: string): Promise<ContractTransaction>;
    setGovernanceParams(params: any): Promise<ContractTransaction>;
    setOperationType(name: string, approvals: number, timelock: boolean, guardianVeto: boolean): Promise<ContractTransaction>;
    addSecurityPolicy(name: string, params: any): Promise<ContractTransaction>;
    setMonitoringHooks(hooks: any): Promise<ContractTransaction>;
    deployed(): Promise<MultiSigWallet>;
}

interface MLSecurityOracle extends Contract {
    registerFeatureProcessor(name: string, address: string): Promise<ContractTransaction>;
    setAutomatedAction(trigger: string, confidence: BigNumber, actions: any[]): Promise<ContractTransaction>;
    setMonitoringParams(params: any): Promise<ContractTransaction>;
    deployed(): Promise<MLSecurityOracle>;
}

interface MLModelRegistry extends Contract {
    registerModel(
        name: string,
        version: string,
        features: string[],
        threshold: BigNumber,
        minDataPoints: number
    ): Promise<ContractTransaction>;
    deployed(): Promise<MLModelRegistry>;
}

interface FeatureProcessor extends Contract {
    deployed(): Promise<FeatureProcessor>;
}

interface FeatureProcessors {
    [key: string]: string;
}

// Add ML types
interface ModelConfig {
    name: string;
    version: string;
    inputFeatures: string[];
    updateThreshold: BigNumber;
    minDataPoints: number;
}

interface AutomatedAction {
    trigger: string;
    confidence: BigNumber;
    actions: {
        type: string;
        params: Record<string, any>;
    }[];
}

interface MonitoringParameters {
    modelHealthCheck: {
        enabled: boolean;
        interval: number;
        accuracyThreshold: BigNumber;
        driftThreshold: BigNumber;
    };
    dataQuality: {
        enabled: boolean;
        minDataPoints: number;
        maxMissingValues: number;
        outlierThreshold: number;
    };
    performance: {
        enabled: boolean;
        maxLatency: number;
        maxMemoryUsage: BigNumber;
        maxGPUUsage: BigNumber;
    };
}