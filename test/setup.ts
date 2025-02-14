import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { MockProvider } from 'ethereum-waffle';

export const setupTestEnvironment = async () => {
    // Deploy mock contracts
    const mockContracts = await deployMockContracts();
    
    // Create test wallets
    const wallets = createTestWallets();
    
    // Setup mock provider
    const provider = new MockProvider();
    
    return {
        contracts: mockContracts,
        wallets,
        provider
    };
};

async function deployMockContracts() {
    // Deploy mock token
    const MockToken = await ethers.getContractFactory('MockToken');
    const token = await MockToken.deploy('Mock Token', 'MTK', ethers.utils.parseEther('1000000'));
    
    // Deploy mock bridge
    const MockBridge = await ethers.getContractFactory('MockBridge');
    const bridge = await MockBridge.deploy();
    
    // Deploy mock governance
    const MockGovernance = await ethers.getContractFactory('MockGovernance');
    const governance = await MockGovernance.deploy();
    
    return {
        token,
        bridge,
        governance
    };
}

function createTestWallets() {
    return [
        Wallet.createRandom(),
        Wallet.createRandom(),
        Wallet.createRandom()
    ];
}

export const mockData = {
    proposals: [
        {
            id: 1,
            title: 'Test Proposal 1',
            description: 'Description for test proposal 1',
            status: 'active'
        },
        {
            id: 2,
            title: 'Test Proposal 2',
            description: 'Description for test proposal 2',
            status: 'passed'
        }
    ],
    transactions: [
        {
            hash: '0x123...',
            from: '0x456...',
            to: '0x789...',
            value: '1.0'
        }
    ],
    bridgeEvents: [
        {
            messageId: '0xabc...',
            token: '0xdef...',
            amount: '100',
            recipient: '0xghi...'
        }
    ]
};

export const testConstants = {
    CHAIN_ID: 138,
    VOTING_DELAY: 1,
    VOTING_PERIOD: 5,
    PROPOSAL_THRESHOLD: ethers.utils.parseEther('100'),
    QUORUM_PERCENTAGE: 4
}; 