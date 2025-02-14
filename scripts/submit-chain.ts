import axios from 'axios';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

interface ChainConfig {
    name: string;
    chain: string;
    icon: string;
    rpc: string[];
    faucets: string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    infoURL: string;
    shortName: string;
    chainId: number;
    networkId: number;
    slip44: number;
    explorers: {
        name: string;
        url: string;
        standard: string;
    }[];
    testnet: boolean;
    slug: string;
}

async function submitToChainlist(config: ChainConfig) {
    try {
        const response = await axios.post('https://chainid.network/chains.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        console.log('Successfully submitted to Chainlist:', response.data);
    } catch (error) {
        console.error('Error submitting to Chainlist:', error);
    }
}

async function submitToThirdweb() {
    try {
        const response = await axios.post('https://thirdweb.com/chains/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chainId: 138,
                name: 'Chain 138',
                symbol: 'C138',
                rpc: 'https://rpc.chain138.com'
            })
        });
        console.log('Successfully submitted to Thirdweb:', response.data);
    } catch (error) {
        console.error('Error submitting to Thirdweb:', error);
    }
}

async function submitToMetaMask(config: ChainConfig) {
    try {
        const response = await axios.post('https://chainlist.metamask.io/api/chains', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chainId: `0x${config.chainId.toString(16)}`,
                chainName: config.name,
                nativeCurrency: config.nativeCurrency,
                rpcUrls: config.rpc,
                blockExplorerUrls: config.explorers.map(e => e.url)
            })
        });
        console.log('Successfully submitted to MetaMask:', response.data);
    } catch (error) {
        console.error('Error submitting to MetaMask:', error);
    }
}

async function createPullRequest() {
    try {
        const response = await axios.post('https://api.github.com/repos/ethereum-lists/chains/pulls', {
            title: 'Add Chain 138',
            body: 'Adding Chain 138 configuration',
            head: 'chain138',
            base: 'master'
        }, {
            headers: {
                Authorization: `token ${process.env.GITHUB_TOKEN}`
            }
        });
        console.log('Successfully created pull request:', response.data.html_url);
    } catch (error) {
        console.error('Error creating pull request:', error);
    }
}

async function main() {
    const configPath = path.join(__dirname, '../chain-config/chain138.json');
    const config: ChainConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log('Submitting Chain 138 to various chain lists...');

    await submitToChainlist(config);
    await submitToThirdweb();
    await submitToMetaMask(config);
    await createPullRequest();

    console.log('Submission process completed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 