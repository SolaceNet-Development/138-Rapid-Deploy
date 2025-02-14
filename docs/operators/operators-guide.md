# Chain 138 Operator's Guide

## System Overview

### Architecture Components
1. Blockchain Layer
   - Besu Nodes
   - Tessera Privacy Manager
   - Permissioning Service

2. Protocol Layer
   - DeFi Protocols
   - Bridge Services
   - Oracle Network

3. Monitoring Layer
   - Prometheus
   - Grafana
   - AlertManager

## Operational Procedures

### Node Operations

#### Starting the Network
```bash
# Start all services
docker-compose up -d

# Verify services
docker-compose ps

# Check logs
docker-compose logs -f besu-node
```

#### Node Maintenance
1. Regular Updates:
   ```bash
   # Pull latest images
   docker-compose pull
   
   # Graceful restart
   docker-compose down
   docker-compose up -d
   ```

2. Log Management:
   ```bash
   # Rotate logs
   logrotate /etc/logrotate.d/chain138
   
   # Archive old logs
   tar -czf logs-$(date +%Y%m%d).tar.gz /var/log/chain138/
   ```

### Protocol Management

#### DeFi Protocol Operations
1. Monitor Protocol Health:
   ```bash
   # Check TVL
   curl -X POST localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"eth_call","params":[{"to":"PROTOCOL_ADDRESS","data":"0x..."}],"id":1}'
   
   # Check utilization
   curl localhost:9090/api/v1/query?query=protocol_utilization_rate
   ```

2. Risk Parameter Updates:
   ```bash
   # Update collateral parameters
   npx hardhat run scripts/update-parameters.ts --network chain138
   
   # Verify changes
   npx hardhat verify-parameters --network chain138
   ```

#### Bridge Operations
1. Monitor Transfers:
   ```bash
   # Check pending transfers
   curl localhost:9547/metrics | grep bridge_pending_transfers
   
   # Check failed transfers
   curl localhost:9547/metrics | grep bridge_failed_transfers
   ```

2. Emergency Procedures:
   ```bash
   # Pause bridge
   npx hardhat run scripts/pause-bridge.ts --network chain138
   
   # Resume bridge
   npx hardhat run scripts/resume-bridge.ts --network chain138
   ```

### Privacy Management

#### Privacy Group Operations
1. Create Privacy Group:
   ```bash
   ./scripts/manage-privacy.sh create \
     --name "Group1" \
     --members "0x...,0x..."
   ```

2. Manage Membership:
   ```bash
   # Add member
   ./scripts/manage-privacy.sh add-member \
     --group "0x..." \
     --member "0x..."
   
   # Remove member
   ./scripts/manage-privacy.sh remove-member \
     --group "0x..." \
     --member "0x..."
   ```

### Monitoring Operations

#### Metrics Management
1. Query Metrics:
   ```bash
   # Node metrics
   curl localhost:9545/metrics
   
   # Protocol metrics
   curl localhost:9548/metrics
   ```

2. Dashboard Management:
   ```bash
   # Import dashboard
   curl -X POST \
     -H "Content-Type: application/json" \
     -d @dashboard.json \
     http://admin:admin@localhost:3000/api/dashboards/db
   ```

#### Alert Management
1. Configure Alerts:
   ```bash
   # Update alert rules
   vi monitoring/config/rules/chain138.yml
   
   # Reload configuration
   curl -X POST localhost:9090/-/reload
   ```

2. Manage Notifications:
   ```bash
   # Test alert
   curl -H "Content-Type: application/json" \
     -d '[{"labels":{"alertname":"TestAlert"}}]' \
     localhost:9093/api/v1/alerts
   ```

## Troubleshooting Procedures

### Node Issues

#### Consensus Problems
1. Check validator status:
   ```bash
   curl -X POST localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"ibft_getValidatorsByBlockNumber","params":["latest"],"id":1}'
   ```

2. Verify sync status:
   ```bash
   curl -X POST localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"eth_syncing","params":[],"id":1}'
   ```

#### Network Issues
1. Check peer connections:
   ```bash
   curl -X POST localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"net_peerCount","params":[],"id":1}'
   ```

2. Verify network config:
   ```bash
   cat blockchain/config/network/config.toml
   ```

### Protocol Issues

#### DeFi Protocol Recovery
1. Emergency shutdown:
   ```bash
   # Pause protocol
   npx hardhat run scripts/emergency-shutdown.ts --network chain138
   
   # Verify state
   npx hardhat run scripts/verify-state.ts --network chain138
   ```

2. State recovery:
   ```bash
   # Export state
   npx hardhat run scripts/export-state.ts --network chain138
   
   # Import state
   npx hardhat run scripts/import-state.ts --network chain138
   ```

#### Bridge Recovery
1. Handle stuck transfers:
   ```bash
   # List stuck transfers
   npx hardhat run scripts/list-stuck-transfers.ts --network chain138
   
   # Force complete transfer
   npx hardhat run scripts/force-complete-transfer.ts --network chain138
   ```

### Performance Issues

#### High Resource Usage
1. Check system resources:
   ```bash
   # CPU usage
   top -b -n 1
   
   # Memory usage
   free -m
   
   # Disk usage
   df -h
   ```

2. Optimize performance:
   ```bash
   # Clear transaction pool
   curl -X POST localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"method":"txpool_clear","params":[],"id":1}'
   ```

## Maintenance Procedures

### Backup Procedures

#### Database Backup
1. Create backup:
   ```bash
   # Backup PostgreSQL
   pg_dump -h localhost -U admin chain138 > backup.sql
   
   # Backup blockchain data
   tar -czf chain-data-$(date +%Y%m%d).tar.gz data/chain138/
   ```

2. Verify backup:
   ```bash
   # Test restore
   psql -h localhost -U admin chain138_test < backup.sql
   ```

#### State Backup
1. Export state:
   ```bash
   # Export protocol state
   npx hardhat run scripts/export-protocol-state.ts --network chain138
   
   # Export privacy groups
   ./scripts/export-privacy-groups.sh
   ```

### Recovery Procedures

#### Full System Recovery
1. Stop services:
   ```bash
   docker-compose down
   ```

2. Restore data:
   ```bash
   # Restore database
   psql -h localhost -U admin chain138 < backup.sql
   
   # Restore blockchain data
   tar -xzf chain-data-backup.tar.gz
   ```

3. Restart services:
   ```bash
   docker-compose up -d
   ```

#### Partial Recovery
1. Identify affected components:
   ```bash
   # Check service status
   docker-compose ps
   
   # Check logs
   docker-compose logs --tail=100 affected-service
   ```

2. Restore component:
   ```bash
   # Restart service
   docker-compose restart affected-service
   
   # Verify recovery
   ./scripts/verify-service.sh affected-service
   ```

## Security Procedures

### Access Management

#### Key Management
1. Rotate keys:
   ```bash
   # Generate new keys
   ./scripts/generate-keys.sh
   
   # Update key configuration
   ./scripts/update-keys.sh
   ```

2. Backup keys:
   ```bash
   # Encrypt keys
   gpg -e -r admin@chain138.com keys.tar
   
   # Store securely
   aws s3 cp keys.tar.gpg s3://secure-backup/
   ```

#### Permission Management
1. Update permissions:
   ```bash
   # Add account to allowlist
   ./scripts/manage-permissions.sh add-account 0x...
   
   # Remove account from allowlist
   ./scripts/manage-permissions.sh remove-account 0x...
   ```

### Audit Procedures

#### System Audit
1. Check configurations:
   ```bash
   # Verify network config
   ./scripts/audit-config.sh network
   
   # Verify protocol config
   ./scripts/audit-config.sh protocols
   ```

2. Review permissions:
   ```bash
   # List authorized accounts
   ./scripts/list-permissions.sh
   
   # Verify role assignments
   ./scripts/verify-roles.sh
   ```

## Emergency Procedures

### Emergency Response

#### System Emergency
1. Assess situation:
   ```bash
   # Check system status
   ./scripts/system-status.sh
   
   # Check alerts
   curl localhost:9093/api/v1/alerts
   ```

2. Take action:
   ```bash
   # Emergency shutdown
   ./scripts/emergency-shutdown.sh
   
   # Notify stakeholders
   ./scripts/notify-emergency.sh
   ```

#### Protocol Emergency
1. Pause affected protocols:
   ```bash
   # Pause protocol
   ./scripts/pause-protocol.sh PROTOCOL_ADDRESS
   
   # Verify pause
   ./scripts/verify-protocol-status.sh PROTOCOL_ADDRESS
   ```

2. Investigate issue:
   ```bash
   # Collect logs
   ./scripts/collect-protocol-logs.sh PROTOCOL_ADDRESS
   
   # Analyze state
   ./scripts/analyze-protocol-state.sh PROTOCOL_ADDRESS
   ```

### Recovery Planning

#### Recovery Assessment
1. Evaluate impact:
   ```bash
   # Generate impact report
   ./scripts/generate-impact-report.sh
   
   # Estimate recovery time
   ./scripts/estimate-recovery.sh
   ```

2. Plan recovery:
   ```bash
   # Create recovery plan
   ./scripts/create-recovery-plan.sh
   
   # Test recovery procedure
   ./scripts/test-recovery-plan.sh
   ```

## Reporting Procedures

### Regular Reports

#### System Reports
1. Generate reports:
   ```bash
   # Daily performance report
   ./scripts/generate-performance-report.sh
   
   # Weekly status report
   ./scripts/generate-status-report.sh
   ```

2. Distribute reports:
   ```bash
   # Send reports
   ./scripts/send-reports.sh
   
   # Archive reports
   ./scripts/archive-reports.sh
   ```

#### Incident Reports
1. Document incident:
   ```bash
   # Create incident report
   ./scripts/create-incident-report.sh
   
   # Collect evidence
   ./scripts/collect-incident-data.sh
   ```

2. Follow up:
   ```bash
   # Track resolution
   ./scripts/track-incident.sh
   
   # Update procedures
   ./scripts/update-procedures.sh
   ``` 