import { expect } from 'chai';
import { providers, Contract, utils, Wallet } from 'ethers';
import { setupTestEnvironment, mockData, testConstants } from './setup';
import { DeFiService } from '../frontend/src/integrations/DeFiService';

// Add type declarations for test environment
declare global {
    var describe: Function;
    var beforeEach: Function;
    var it: Function;
}

describe('DeFiService', () => {
    let defiService: DeFiService;
    let env: any;

    beforeEach(async () => {
        env = await setupTestEnvironment();
        defiService = new DeFiService(env.provider.connection.url);
        await defiService.connect(env.wallets[0].privateKey);
    });

    describe('Perpetual Trading', () => {
        it('should open a long position', async () => {
            const tx = await defiService.openPerpetualPosition(
                env.contracts.perpetualMarket.address,
                true,
                '1.0',
                5,
                '0.95',
                '1.05'
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            const position = await env.contracts.perpetualMarket.getPosition(env.wallets[0].address);
            expect(position.isLong).to.equal(true);
            expect(position.size).to.equal(utils.parseEther('1.0'));
        });

        it('should handle liquidation correctly', async () => {
            await defiService.openPerpetualPosition(
                env.contracts.perpetualMarket.address,
                true,
                '1.0',
                10
            );

            await env.contracts.priceOracle.setPrice(utils.parseEther('0.9'));

            const position = await env.contracts.perpetualMarket.getPosition(env.wallets[0].address);
            expect(position.size).to.equal(0);
        });
    });

    describe('Margin Trading', () => {
        it('should open a margin position', async () => {
            const tx = await defiService.openMarginPosition(
                env.contracts.marginPool.address,
                env.contracts.token0.address,
                '100',
                env.contracts.token1.address,
                '50'
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const position = await env.contracts.marginPool.getPosition(env.wallets[0].address);
            expect(position.borrowToken).to.equal(env.contracts.token0.address);
            expect(position.borrowAmount).to.equal(utils.parseEther('100'));
        });

        it('should enforce collateral requirements', async () => {
            await expect(
                defiService.openMarginPosition(
                    env.contracts.marginPool.address,
                    env.contracts.token0.address,
                    '1000',
                    env.contracts.token1.address,
                    '1'
                )
            ).to.be.rejectedWith('Insufficient collateral');
        });
    });

    describe('Automated Strategies', () => {
        it('should deploy a grid trading strategy', async () => {
            const params = {
                token0: env.contracts.token0.address,
                token1: env.contracts.token1.address,
                gridSize: 10,
                priceRange: {
                    min: utils.parseEther('0.8'),
                    max: utils.parseEther('1.2')
                }
            };

            const tx = await defiService.deployTradingStrategy(
                env.contracts.strategyFactory.address,
                'GRID_TRADING',
                params
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const strategyAddress = await env.contracts.strategyFactory.getStrategy(
                env.wallets[0].address,
                0
            );
            expect(strategyAddress).to.not.equal('0x0000000000000000000000000000000000000000');
        });

        it('should execute strategy trades', async () => {
            const strategyTx = await defiService.deployTradingStrategy(
                env.contracts.strategyFactory.address,
                'GRID_TRADING',
                {
                    token0: env.contracts.token0.address,
                    token1: env.contracts.token1.address,
                    gridSize: 5,
                    priceRange: {
                        min: utils.parseEther('0.9'),
                        max: utils.parseEther('1.1')
                    }
                }
            );
            await strategyTx.wait();

            await env.contracts.priceOracle.setPrice(utils.parseEther('1.05'));

            const strategy = await env.contracts.strategyFactory.getStrategy(
                env.wallets[0].address,
                0
            );
            const trades = await env.contracts.strategyFactory.getStrategyTrades(strategy);
            expect(trades.length).to.be.above(0);
        });
    });

    describe('Portfolio Analytics', () => {
        it('should calculate advanced metrics correctly', async () => {
            await setupTestPortfolio(env, defiService);

            const metrics = await defiService.getAdvancedPortfolioMetrics(
                env.wallets[0].address
            );

            expect(metrics.totalValue).to.not.equal('0');
            expect(metrics.sharpeRatio).to.not.equal('0');
            expect(metrics.volatility).to.not.equal('0');
            expect(metrics.drawdown).to.not.equal('0');
            expect(metrics.positions.length).to.be.above(0);
        });

        it('should track historical performance', async () => {
            await setupTestPortfolio(env, defiService);

            await env.provider.send('evm_increaseTime', [86400]);
            await env.provider.send('evm_mine', []);

            await updateTestPrices(env);

            const metrics = await defiService.getAdvancedPortfolioMetrics(
                env.wallets[0].address
            );

            expect(metrics.pnl).to.not.equal('0');
        });
    });
});

async function setupTestPortfolio(env: any, defiService: DeFiService) {
    // Add liquidity
    await defiService.addLiquidity(
        env.contracts.pool.address,
        '100',
        '100'
    );

    // Open positions
    await defiService.openPerpetualPosition(
        env.contracts.perpetualMarket.address,
        true,
        '1.0',
        5
    );

    await defiService.openMarginPosition(
        env.contracts.marginPool.address,
        env.contracts.token0.address,
        '50',
        env.contracts.token1.address,
        '25'
    );
}

async function updateTestPrices(env: any) {
    await env.contracts.priceOracle.setPrice(
        utils.parseEther('1.1')
    );
} 