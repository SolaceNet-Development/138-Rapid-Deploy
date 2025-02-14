import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Chain } from "@thirdweb-dev/chains";

class ThirdwebService {
    private sdk: ThirdwebSDK | null = null;
    private chain: Chain;

    async initialize(chain: Chain, privateKey?: string) {
        if (privateKey) {
            this.sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain);
        } else {
            this.sdk = new ThirdwebSDK(chain);
        }
        this.chain = chain;
    }

    async deployToken(
        name: string,
        symbol: string,
        initialSupply: string
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const contractAddress = await this.sdk.deployer.deployToken({
                name,
                symbol,
                primary_sale_recipient: await this.sdk.wallet.getAddress(),
                initial_supply: initialSupply
            });

            return contractAddress;
        } catch (error) {
            console.error('Error deploying token:', error);
            throw error;
        }
    }

    async deployNFTCollection(
        name: string,
        symbol: string,
        description: string
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");

            const contractAddress = await this.sdk.deployer.deployNFTCollection({
                name,
                symbol,
                description
            });

            return contractAddress;
        } catch (error) {
            console.error('Error deploying NFT collection:', error);
            throw error;
        }
    }

    async deployMarketplace(
        name: string,
        platformFee: number
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");

            const contractAddress = await this.sdk.deployer.deployMarketplace({
                name,
                platform_fee_basis_points: platformFee,
                platform_fee_recipient: await this.sdk.wallet.getAddress()
            });

            return contractAddress;
        } catch (error) {
            console.error('Error deploying marketplace:', error);
            throw error;
        }
    }

    async getContract(contractAddress: string) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const contract = await this.sdk.getContract(contractAddress);
            return contract;
        } catch (error) {
            console.error('Error getting contract:', error);
            throw error;
        }
    }

    async mintToken(
        contractAddress: string,
        amount: string,
        recipient: string
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const contract = await this.sdk.getContract(contractAddress);
            const tx = await contract.erc20.mint(amount, recipient);
            return tx;
        } catch (error) {
            console.error('Error minting token:', error);
            throw error;
        }
    }

    async mintNFT(
        contractAddress: string,
        metadata: any,
        recipient: string
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const contract = await this.sdk.getContract(contractAddress);
            const tx = await contract.erc721.mint({
                metadata,
                to: recipient
            });
            return tx;
        } catch (error) {
            console.error('Error minting NFT:', error);
            throw error;
        }
    }

    async createListing(
        marketplaceAddress: string,
        assetContractAddress: string,
        tokenId: string,
        price: string
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const marketplace = await this.sdk.getContract(marketplaceAddress);
            const tx = await marketplace.direct.createListing({
                assetContractAddress,
                tokenId,
                buyoutPricePerToken: price,
                quantity: 1
            });
            return tx;
        } catch (error) {
            console.error('Error creating listing:', error);
            throw error;
        }
    }

    async buyListing(
        marketplaceAddress: string,
        listingId: string,
        quantity: number
    ) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const marketplace = await this.sdk.getContract(marketplaceAddress);
            const tx = await marketplace.direct.buyoutListing(listingId, quantity);
            return tx;
        } catch (error) {
            console.error('Error buying listing:', error);
            throw error;
        }
    }

    async getBalance(address: string) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const balance = await this.sdk.wallet.balance(address);
            return balance;
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }

    async signMessage(message: string) {
        try {
            if (!this.sdk) throw new Error("SDK not initialized");
            
            const signature = await this.sdk.wallet.sign(message);
            return signature;
        } catch (error) {
            console.error('Error signing message:', error);
            throw error;
        }
    }
}

export const thirdwebService = new ThirdwebService(); 