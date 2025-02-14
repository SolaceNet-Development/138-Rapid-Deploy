# GitHub Workflows Documentation

## Overview
This document describes the GitHub Actions workflows used in the Chain 138 project. These workflows automate various aspects of development, deployment, monitoring, and community management.

## Workflows

### 1. Environment Validation (`env-validation.yml`)
Validates environment variables and configuration files to ensure proper setup.

#### Triggers
- Push events modifying `.env.example` or config files
- Pull requests affecting environment configuration
- Manual trigger

#### Key Features
- Validates required environment variables
- Checks variable format and values
- Generates `.env.example` template
- Updates environment documentation
- Cross-field validation rules

#### Environment Variables Validated
- Network configuration (RPC_URL, CHAIN_ID, etc.)
- Contract deployment settings
- Bridge configuration
- Security parameters
- Monitoring settings
- Performance & scaling options
- Database & storage configuration
- API & external service keys

### 2. Documentation (`documentation.yml`)
Manages documentation generation and deployment.

#### Triggers
- Push events to main branch affecting docs
- Pull requests modifying documentation
- Manual trigger

#### Key Features
- Markdown link validation
- TypeDoc generation for TypeScript
- Solidity documentation generation
- Documentation site building
- API documentation generation
- Documentation coverage checks
- Automated deployment to GitHub Pages

#### Documentation Types
- API documentation
- TypeScript interfaces
- Solidity contracts
- Markdown files
- Architecture diagrams
- Configuration guides

### 3. Monitoring (`monitoring.yml`)
Implements comprehensive system monitoring.

#### Triggers
- Scheduled every 15 minutes
- Manual trigger

#### Key Features
- Network health checks
- Gas price monitoring
- Contract event monitoring
- Metric collection
- Alert generation
- Dashboard updates

#### Monitored Metrics
- Network status
- Gas prices
- Contract events
- Transaction metrics
- Validator status
- Bridge statistics

### 4. Security (`security.yml`)
Performs security analysis and auditing.

#### Triggers
- Daily scheduled runs
- Push events to main branch
- Pull requests affecting contracts

#### Key Features
- CodeQL analysis
- Slither static analysis
- MythX deep scan
- Echidna fuzzing
- Manticore symbolic execution
- Dependency auditing
- License compliance checks

### 5. Ambassador Program (`ambassador.yml`)
Manages the community ambassador program.

#### Triggers
- Weekly scheduled runs
- Manual trigger

#### Key Features
- Contribution tracking
- Point calculation
- Reward distribution
- Rank updates
- Leaderboard management
- Automated notifications

#### Point Categories
- Code contributions
- Code reviews
- Documentation
- Community engagement

## Environment Setup

### Required Secrets
```yaml
# Authentication
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

# Deployment
PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
INFURA_API_KEY: ${{ secrets.INFURA_API_KEY }}
ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}

# Monitoring
SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
ALERT_EMAIL: ${{ secrets.ALERT_EMAIL }}

# Security
MYTHX_API_KEY: ${{ secrets.MYTHX_API_KEY }}
FOSSA_API_KEY: ${{ secrets.FOSSA_API_KEY }}
```

### Required Environment Variables
```shell
# Network
NETWORK_ID=138
CHAIN_ID=138
RPC_URL=https://rpc.chain138.com

# Monitoring
MONITORING_INTERVAL=60
GAS_PRICE_THRESHOLD=100
ALERT_THRESHOLD=5

# Security
MAX_GAS_PRICE=100
GAS_PRICE_BUFFER=120
MIN_VALIDATORS=3
```

## Workflow Dependencies

### Node.js Dependencies
```json
{
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^4.9.5",
    "ethers": "^5.7.2",
    "hardhat": "^2.22.18"
  }
}
```

### Python Dependencies
```python
requirements = [
    "web3>=6.0.0",
    "eth-brownie>=1.19.0",
    "slither-analyzer>=0.9.0"
]
```

## Best Practices

### Workflow Design
1. Use reusable actions when possible
2. Implement proper error handling
3. Add appropriate timeouts
4. Use caching for dependencies
5. Implement proper versioning

### Security
1. Minimize secret usage
2. Use environment-specific secrets
3. Implement proper access controls
4. Regular security audits
5. Proper error handling

### Monitoring
1. Implement comprehensive logging
2. Set up proper alerting
3. Monitor resource usage
4. Track performance metrics
5. Regular health checks

## Troubleshooting

### Common Issues
1. Environment validation failures
2. Documentation build errors
3. Monitoring alert floods
4. Security scan failures
5. Reward distribution issues

### Resolution Steps
1. Check environment variables
2. Verify workflow permissions
3. Review action logs
4. Check network status
5. Verify secret availability

## Contributing

### Adding New Workflows
1. Create workflow file in `.github/workflows/`
2. Add appropriate triggers
3. Define required secrets
4. Implement proper error handling
5. Add workflow documentation

### Modifying Existing Workflows
1. Review current implementation
2. Test changes locally
3. Update documentation
4. Create pull request
5. Add changelog entry 