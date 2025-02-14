#!/usr/bin/env node

import { ethers } from 'ethers';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

interface ValidatorMetrics {
    address: string;
    blocksMissed: number;
    blocksProposed: number;
    proposalEfficiency: number;
    lastProposalTime: number;
    rewardRate: number;
    responseTime: number;
    attestationRate: number;
    slashingEvents: number;
    uptimePercentage: number;
    performance: number;
    stake: ethers.BigNumber;
    delegations: ethers.BigNumber;
}

interface ValidatorConfig {
    minProposalEfficiency: number;
    maxMissedBlocks: number;
    minAttestationRate: number;
    maxResponseTime: number;
    minUptime: number;
    minStake: string;
}

class ValidatorMonitor {
    private provider: ethers.providers.Provider;
    private config: ValidatorConfig;
    private metrics: Map<string, ValidatorMetrics>;
    private validatorContract: ethers.Contract;
    private stakingContract: ethers.Contract;
    private slashingContract: ethers.Contract;

    constructor(
        provider: ethers.providers.Provider,
        validatorContract: ethers.Contract,
        stakingContract: ethers.Contract,
        slashingContract: ethers.Contract,
        config: ValidatorConfig
    ) {
        this.provider = provider;
        this.validatorContract = validatorContract;
        this.stakingContract = stakingContract;
        this.slashingContract = slashingContract;
        this.config = config;
        this.metrics = new Map();
    }

    async initialize(): Promise<void> {
        // Get list of active validators
        const validators = await this.validatorContract.getActiveValidators();
        
        // Initialize metrics for each validator
        for (const validator of validators) {
            this.metrics.set(validator, {
                address: validator,
                blocksMissed: 0,
                blocksProposed: 0,
                proposalEfficiency: 100,
                lastProposalTime: 0,
                rewardRate: 0,
                responseTime: 0,
                attestationRate: 100,
                slashingEvents: 0,
                uptimePercentage: 100,
                performance: 100,
                stake: ethers.BigNumber.from(0),
                delegations: ethers.BigNumber.from(0)
            });
        }

        // Set up event listeners
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for block proposals
        this.validatorContract.on('BlockProposed', async (validator, blockNumber, timestamp) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.blocksProposed++;
                metrics.lastProposalTime = timestamp.toNumber();
                await this.updateValidatorMetrics(validator);
            }
        });

        // Listen for missed blocks
        this.validatorContract.on('BlockMissed', async (validator, blockNumber) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.blocksMissed++;
                await this.updateValidatorMetrics(validator);
            }
        });

        // Listen for attestations
        this.validatorContract.on('Attestation', async (validator, blockNumber, isValid) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.attestationRate = await this.calculateAttestationRate(validator);
                await this.updateValidatorMetrics(validator);
            }
        });

        // Listen for slashing events
        this.slashingContract.on('ValidatorSlashed', async (validator, reason, amount) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.slashingEvents++;
                await this.updateValidatorMetrics(validator);
            }
        });

        // Listen for stake changes
        this.stakingContract.on('StakeChanged', async (validator, newStake) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.stake = newStake;
                await this.updateValidatorMetrics(validator);
            }
        });

        // Listen for delegation changes
        this.stakingContract.on('DelegationChanged', async (validator, delegator, amount) => {
            const metrics = this.metrics.get(validator);
            if (metrics) {
                metrics.delegations = await this.stakingContract.getTotalDelegations(validator);
                await this.updateValidatorMetrics(validator);
            }
        });
    }

    async monitorValidators(): Promise<void> {
        while (true) {
            try {
                await this.updateAllMetrics();
                await this.checkValidatorAlerts();
                await this.reportMetrics();
                
                // Wait before next update
                await sleep(parseInt(process.env.VALIDATOR_MONITORING_INTERVAL || '60000'));
            } catch (error) {
                console.error('Error monitoring validators:', error);
                await sleep(5000);
            }
        }
    }

    private async updateAllMetrics(): Promise<void> {
        for (const validator of this.metrics.keys()) {
            await this.updateValidatorMetrics(validator);
        }
    }

    private async updateValidatorMetrics(validatorAddress: string): Promise<void> {
        const metrics = this.metrics.get(validatorAddress);
        if (!metrics) return;

        // Update proposal efficiency
        const totalBlocks = metrics.blocksProposed + metrics.blocksMissed;
        metrics.proposalEfficiency = totalBlocks > 0 
            ? (metrics.blocksProposed / totalBlocks) * 100 
            : 100;

        // Update response time
        metrics.responseTime = await this.calculateResponseTime(validatorAddress);

        // Update uptime
        metrics.uptimePercentage = await this.calculateUptime(validatorAddress);

        // Update reward rate
        metrics.rewardRate = await this.calculateRewardRate(validatorAddress);

        // Calculate overall performance
        metrics.performance = this.calculatePerformanceScore(metrics);

        // Update stake and delegations
        metrics.stake = await this.stakingContract.getValidatorStake(validatorAddress);
        metrics.delegations = await this.stakingContract.getTotalDelegations(validatorAddress);
    }

    private async calculateResponseTime(validator: string): Promise<number> {
        // Implementation for calculating average response time
        return 0;
    }

    private async calculateUptime(validator: string): Promise<number> {
        // Implementation for calculating validator uptime
        return 100;
    }

    private async calculateRewardRate(validator: string): Promise<number> {
        // Implementation for calculating reward rate
        return 0;
    }

    private async calculateAttestationRate(validator: string): Promise<number> {
        // Implementation for calculating attestation rate
        return 100;
    }

    private calculatePerformanceScore(metrics: ValidatorMetrics): number {
        let score = 100;

        // Penalize for low proposal efficiency
        if (metrics.proposalEfficiency < this.config.minProposalEfficiency) {
            score -= 20 * (1 - metrics.proposalEfficiency / this.config.minProposalEfficiency);
        }

        // Penalize for missed blocks
        if (metrics.blocksMissed > this.config.maxMissedBlocks) {
            score -= 15 * (metrics.blocksMissed / this.config.maxMissedBlocks);
        }

        // Penalize for low attestation rate
        if (metrics.attestationRate < this.config.minAttestationRate) {
            score -= 20 * (1 - metrics.attestationRate / this.config.minAttestationRate);
        }

        // Penalize for high response time
        if (metrics.responseTime > this.config.maxResponseTime) {
            score -= 15 * (metrics.responseTime / this.config.maxResponseTime);
        }

        // Penalize for low uptime
        if (metrics.uptimePercentage < this.config.minUptime) {
            score -= 20 * (1 - metrics.uptimePercentage / this.config.minUptime);
        }

        // Penalize for slashing events
        score -= metrics.slashingEvents * 25;

        return Math.max(0, score);
    }

    async checkValidatorAlerts(): Promise<void> {
        for (const [address, metrics] of this.metrics.entries()) {
            // Check proposal efficiency
            if (metrics.proposalEfficiency < this.config.minProposalEfficiency) {
                await this.sendAlert('Low Proposal Efficiency', {
                    validator: address,
                    current: metrics.proposalEfficiency,
                    threshold: this.config.minProposalEfficiency,
                    timestamp: new Date().toISOString()
                });
            }

            // Check missed blocks
            if (metrics.blocksMissed > this.config.maxMissedBlocks) {
                await this.sendAlert('High Missed Blocks', {
                    validator: address,
                    current: metrics.blocksMissed,
                    threshold: this.config.maxMissedBlocks,
                    timestamp: new Date().toISOString()
                });
            }

            // Check attestation rate
            if (metrics.attestationRate < this.config.minAttestationRate) {
                await this.sendAlert('Low Attestation Rate', {
                    validator: address,
                    current: metrics.attestationRate,
                    threshold: this.config.minAttestationRate,
                    timestamp: new Date().toISOString()
                });
            }

            // Check response time
            if (metrics.responseTime > this.config.maxResponseTime) {
                await this.sendAlert('High Response Time', {
                    validator: address,
                    current: metrics.responseTime,
                    threshold: this.config.maxResponseTime,
                    timestamp: new Date().toISOString()
                });
            }

            // Check uptime
            if (metrics.uptimePercentage < this.config.minUptime) {
                await this.sendAlert('Low Uptime', {
                    validator: address,
                    current: metrics.uptimePercentage,
                    threshold: this.config.minUptime,
                    timestamp: new Date().toISOString()
                });
            }

            // Check stake
            const minStake = ethers.utils.parseEther(this.config.minStake);
            if (metrics.stake.lt(minStake)) {
                await this.sendAlert('Low Stake', {
                    validator: address,
                    current: ethers.utils.formatEther(metrics.stake),
                    threshold: this.config.minStake,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    async sendAlert(type: string, data: unknown): Promise<void> {
        // Send to configured alert channels
        if (process.env.SLACK_WEBHOOK_URL) {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `⚡ *Validator Alert: ${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                })
            });
        }

        if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `⚡ **Validator Alert: ${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
                })
            });
        }

        // Log alert
        console.log(`[VALIDATOR ALERT] ${type}:`, data);
    }

    async reportMetrics(): Promise<void> {
        // Output current metrics
        for (const [address, metrics] of this.metrics.entries()) {
            console.log(`Validator ${address}:`, {
                proposalEfficiency: metrics.proposalEfficiency.toFixed(2),
                blocksMissed: metrics.blocksMissed,
                attestationRate: metrics.attestationRate.toFixed(2),
                responseTime: metrics.responseTime.toFixed(2),
                uptimePercentage: metrics.uptimePercentage.toFixed(2),
                performance: metrics.performance.toFixed(2),
                stake: ethers.utils.formatEther(metrics.stake),
                delegations: ethers.utils.formatEther(metrics.delegations)
            });
        }

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    private async pushMetricsToPrometheus(): Promise<void> {
        const metrics: string[] = [];

        for (const [address, validator] of this.metrics.entries()) {
            metrics.push(
                `validator_proposal_efficiency{address="${address}"} ${validator.proposalEfficiency}`,
                `validator_blocks_missed{address="${address}"} ${validator.blocksMissed}`,
                `validator_blocks_proposed{address="${address}"} ${validator.blocksProposed}`,
                `validator_attestation_rate{address="${address}"} ${validator.attestationRate}`,
                `validator_response_time{address="${address}"} ${validator.responseTime}`,
                `validator_uptime{address="${address}"} ${validator.uptimePercentage}`,
                `validator_performance{address="${address}"} ${validator.performance}`,
                `validator_stake{address="${address}"} ${validator.stake}`,
                `validator_delegations{address="${address}"} ${validator.delegations}`,
                `validator_slashing_events{address="${address}"} ${validator.slashingEvents}`
            );
        }

        try {
            await fetch(process.env.PROMETHEUS_PUSH_GATEWAY, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: metrics.join('\n')
            });
        } catch (error) {
            console.error('Error pushing metrics to Prometheus:', error);
        }
    }
}

export { ValidatorMonitor, ValidatorMetrics, ValidatorConfig }; 