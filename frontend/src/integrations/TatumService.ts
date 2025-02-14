import { TatumSDK, Network, Ethereum } from '@tatumio/tatum';

class TatumService {
    private sdk: any;
    private initialized: boolean = false;

    async initialize(apiKey: string) {
        if (!this.initialized) {
            this.sdk = await TatumSDK.init<Ethereum>({
                network: Network.ETHEREUM,
                apiKey: apiKey,
                version: '3'
            });
            this.initialized = true;
        }
    }

    async getWalletBalance(address: string) {
        try {
            const balance = await this.sdk.address.getBalance({
                addresses: [address]
            });
            return balance;
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            throw error;
        }
    }

    async getTransactionHistory(address: string) {
        try {
            const transactions = await this.sdk.address.getTransactions({
                address,
                pageSize: 50,
                offset: 0
            });
            return transactions;
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            throw error;
        }
    }

    async createVirtualAccount(chain: string) {
        try {
            const account = await this.sdk.virtualAccounts.create({
                chain,
                frozen: false
            });
            return account;
        } catch (error) {
            console.error('Error creating virtual account:', error);
            throw error;
        }
    }

    async getMarketData(symbol: string) {
        try {
            const marketData = await this.sdk.marketData.getPrice({
                symbol
            });
            return marketData;
        } catch (error) {
            console.error('Error fetching market data:', error);
            throw error;
        }
    }

    async monitorAddress(address: string, webhook: string) {
        try {
            const subscription = await this.sdk.notification.subscribe({
                type: 'ADDRESS_EVENT',
                attr: {
                    address,
                    chain: 'ETH',
                    url: webhook
                }
            });
            return subscription;
        } catch (error) {
            console.error('Error setting up address monitoring:', error);
            throw error;
        }
    }

    async estimateGasFee(from: string, to: string, amount: string) {
        try {
            const gas = await this.sdk.gas.estimateGas({
                from,
                to,
                amount
            });
            return gas;
        } catch (error) {
            console.error('Error estimating gas fee:', error);
            throw error;
        }
    }

    async generateWallet(chain: string) {
        try {
            const wallet = await this.sdk.wallet.generate({
                chain
            });
            return wallet;
        } catch (error) {
            console.error('Error generating wallet:', error);
            throw error;
        }
    }

    async getTokenMetadata(contractAddress: string) {
        try {
            const metadata = await this.sdk.nft.getMetadata({
                contractAddress
            });
            return metadata;
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            throw error;
        }
    }

    destroy() {
        if (this.initialized) {
            this.sdk.destroy();
            this.initialized = false;
        }
    }
}

export const tatumService = new TatumService(); 