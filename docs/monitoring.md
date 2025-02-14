# Chain 138 Monitoring Guide

## Overview
This guide describes the comprehensive monitoring system implemented for Chain 138. The monitoring system covers network health, validator performance, gas prices, and contract events.

## Monitoring Components

### 1. Network Health Monitoring
Monitors the overall health and performance of the Chain 138 network.

#### Metrics Tracked
- Block height and time
- Peer count
- Network latency
- Sync status
- Pending transactions
- Chain reorganizations
- Missed blocks

#### Configuration
```env
# Required
MAX_BLOCK_TIME=30
MIN_PEER_COUNT=3
MAX_NETWORK_LATENCY=1000
MAX_PENDING_TRANSACTIONS=5000
NETWORK_MONITORING_INTERVAL=15

# Optional
PROMETHEUS_PUSH_GATEWAY=http://localhost:9091
GRAFANA_API_KEY=your-api-key
GRAFANA_DASHBOARD_ID=chain138-network
```

#### Alerts
- High block time (> MAX_BLOCK_TIME)
- Low peer count (< MIN_PEER_COUNT)
- High network latency (> MAX_NETWORK_LATENCY)
- Node not synced
- High pending transactions (> MAX_PENDING_TRANSACTIONS)
- Chain reorganization detected

### 2. Validator Monitoring
Tracks the performance and health of network validators.

#### Metrics Tracked
- Total and active validators
- Block production statistics
- Missed blocks
- Validator performance
- Inactivity periods

#### Configuration
```env
# Required
VALIDATOR_CONTRACT_ADDRESS=0x...
MIN_ACTIVE_VALIDATORS=4
VALIDATOR_MISSED_BLOCKS_THRESHOLD=50
VALIDATOR_INACTIVITY_THRESHOLD=100
VALIDATOR_PERFORMANCE_THRESHOLD=0.95
VALIDATOR_MONITORING_INTERVAL=60
```

#### Alerts
- Low validator count
- High missed blocks
- Validator inactivity
- Low performance
- Validator added/removed

### 3. Gas Price Monitoring
Monitors gas prices and volatility.

#### Metrics Tracked
- Current gas price
- Historical prices (24h)
- Price volatility
- Maximum and minimum prices
- Rapid price changes

#### Configuration
```env
# Required
MAX_GAS_PRICE=100
GAS_PRICE_BUFFER=120
GAS_VOLATILITY_THRESHOLD=0.5
GAS_RAPID_INCREASE_THRESHOLD=0.3
GAS_MONITORING_INTERVAL=30
```

#### Alerts
- High gas price
- High volatility
- Rapid price increase

### 4. Contract Event Monitoring
Monitors smart contract events and interactions.

#### Metrics Tracked
- Bridge transfers
- Token claims
- Emergency events
- Failed transactions
- Total value locked

#### Configuration
```env
# Required
BRIDGE_CONTRACT_ADDRESS=0x...
LARGE_TRANSFER_THRESHOLD=1000
MAX_CLAIM_DELAY=86400000
MAX_FAILURE_RATE=0.1
```

#### Alerts
- Large transfers
- Long claim delays
- High failure rate
- Emergency events

## Alert Channels

### Slack Integration
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_SEVERITY_LEVELS=["critical","warning","info"]
```

### Discord Integration
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Email Notifications
```env
ALERT_EMAIL=alerts@chain138.com
```

## Metrics Storage

### Prometheus Configuration
```yaml
scrape_configs:
  - job_name: 'chain138'
    static_configs:
      - targets: ['localhost:9545']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'validators'
    static_configs:
      - targets:
        - 'validator1:9545'
        - 'validator2:9545'
        - 'validator3:9545'
        - 'validator4:9545'
```

### Grafana Dashboards
1. Network Overview Dashboard
   - Block production metrics
   - Network health indicators
   - Gas price trends
   - Transaction metrics

2. Validator Dashboard
   - Validator performance
   - Block production statistics
   - Missed blocks tracking
   - Rewards distribution

3. Bridge Dashboard
   - Transfer volume
   - Claim statistics
   - TVL metrics
   - Error rates

## Performance Tuning

### Node Configuration
```env
NODE_OPTIONS="--max-old-space-size=4096"
CACHE_SIZE_MB=1024
```

### Database Settings
```env
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=10000
```

## Security & Rate Limiting

### API Protection
```env
JWT_SECRET=your-secret-key
API_RATE_LIMIT=100
API_RATE_WINDOW=60000
IP_WHITELIST=["10.0.0.0/24","192.168.1.0/24"]
```

## Backup & Recovery

### Backup Configuration
```env
BACKUP_ENABLED=true
BACKUP_INTERVAL=3600
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/var/backups/chain138
```

## Best Practices

### Monitoring Setup
1. Configure all required environment variables
2. Set appropriate alert thresholds
3. Test alert channels
4. Verify metric collection
5. Set up dashboard access

### Alert Management
1. Define severity levels
2. Set up escalation paths
3. Document response procedures
4. Maintain alert history
5. Regular alert review

### Performance Optimization
1. Monitor resource usage
2. Adjust cache sizes
3. Optimize database queries
4. Regular performance testing
5. Load testing

## Troubleshooting

### Common Issues
1. Missing metrics
   - Check Prometheus configuration
   - Verify node connectivity
   - Check port accessibility

2. Alert failures
   - Verify webhook URLs
   - Check network connectivity
   - Validate alert configuration

3. Performance issues
   - Check resource usage
   - Verify cache settings
   - Monitor database performance

### Resolution Steps
1. Check logs
2. Verify configurations
3. Test connectivity
4. Validate metrics
5. Review alerts

## Contributing
1. Follow monitoring standards
2. Document changes
3. Test thoroughly
4. Update dashboards
5. Maintain alert quality 