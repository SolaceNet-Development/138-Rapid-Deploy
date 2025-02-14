# Deployment Guides

## Development Environment

### Prerequisites
- Docker Desktop
- Node.js 16+
- Go 1.19+
- Git
- Make

### Setup Steps
1. Clone repository:
   ```bash
   git clone https://github.com/yourusername/chain-138-infrastructure.git
   cd chain-138-infrastructure
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create development environment:
   ```bash
   cp .env.example .env.development
   # Edit .env.development with development settings
   ```

4. Start development stack:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

5. Deploy contracts:
   ```bash
   npx hardhat run scripts/deploy-all.ts --network localhost
   ```

### Development Tools
- Hardhat Console: `npx hardhat console`
- Local Explorer: http://localhost:4000
- Grafana Dev: http://localhost:3000

## Staging Environment

### Infrastructure Requirements
- 4 CPU cores
- 8GB RAM
- 100GB SSD
- Ubuntu 20.04 LTS

### Network Setup
1. Configure firewall:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 8545/tcp
   sudo ufw allow 30303/tcp
   sudo ufw enable
   ```

2. Setup SSL certificates:
   ```bash
   sudo certbot certonly --standalone -d staging.chain138.com
   ```

3. Configure reverse proxy:
   ```nginx
   server {
     listen 443 ssl;
     server_name staging.chain138.com;
     
     ssl_certificate /etc/letsencrypt/live/staging.chain138.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/staging.chain138.com/privkey.pem;
     
     location / {
       proxy_pass http://localhost:8545;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

### Deployment Steps
1. Setup environment:
   ```bash
   cp .env.example .env.staging
   # Edit .env.staging with staging settings
   ```

2. Deploy infrastructure:
   ```bash
   ./scripts/deploy-staging.sh
   ```

3. Configure monitoring:
   ```bash
   ./monitoring/scripts/setup-staging.sh
   ```

4. Verify deployment:
   ```bash
   ./scripts/verify-deployment.sh
   ```

## Production Environment

### Infrastructure Requirements
- Minimum 8 CPU cores
- 32GB RAM
- 500GB SSD
- Ubuntu 20.04 LTS
- Hardware Security Module (HSM)

### Security Setup
1. Configure SSH:
   ```bash
   # /etc/ssh/sshd_config
   PermitRootLogin no
   PasswordAuthentication no
   ```

2. Setup fail2ban:
   ```bash
   sudo apt-get install fail2ban
   sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
   ```

3. Configure firewall:
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 8545/tcp
   sudo ufw allow 30303/tcp
   sudo ufw enable
   ```

### High Availability Setup
1. Configure load balancer:
   ```nginx
   upstream chain138_nodes {
     server node1.chain138.com:8545;
     server node2.chain138.com:8545;
     server node3.chain138.com:8545;
   }
   
   server {
     listen 443 ssl;
     server_name api.chain138.com;
     
     location / {
       proxy_pass http://chain138_nodes;
     }
   }
   ```

2. Setup database replication:
   ```bash
   # Primary PostgreSQL
   postgresql.conf:
   wal_level = replica
   max_wal_senders = 3
   
   # Replica PostgreSQL
   recovery.conf:
   primary_conninfo = 'host=primary.chain138.com port=5432 user=replicator password=xxx'
   ```

### Deployment Steps
1. Setup environment:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production settings
   ```

2. Deploy infrastructure:
   ```bash
   ./scripts/deploy-production.sh
   ```

3. Configure monitoring:
   ```bash
   ./monitoring/scripts/setup-production.sh
   ```

4. Setup backup system:
   ```bash
   ./scripts/setup-backups.sh
   ```

5. Verify deployment:
   ```bash
   ./scripts/verify-deployment.sh
   ```

### Monitoring Setup
1. Configure Prometheus:
   ```yaml
   global:
     scrape_interval: 15s
     evaluation_interval: 15s
   
   alerting:
     alertmanagers:
       - static_configs:
           - targets: ['alertmanager:9093']
   
   rule_files:
     - "rules/*.yml"
   
   scrape_configs:
     - job_name: 'chain138'
       static_configs:
         - targets: ['node1:9545', 'node2:9545', 'node3:9545']
   ```

2. Setup Grafana dashboards:
   ```bash
   ./monitoring/scripts/import-dashboards.sh
   ```

3. Configure alerts:
   ```bash
   ./monitoring/scripts/setup-alerts.sh
   ```

### Backup and Recovery
1. Setup automated backups:
   ```bash
   # /etc/cron.d/chain138-backup
   0 */6 * * * root /usr/local/bin/chain138-backup.sh
   ```

2. Configure offsite backup:
   ```bash
   rclone sync /var/backups/chain138 s3:chain138-backups
   ```

3. Test recovery procedure:
   ```bash
   ./scripts/test-recovery.sh
   ```

## Disaster Recovery

### Backup Strategy
1. Database Backups:
   - Full backup every 24 hours
   - WAL archiving every 5 minutes
   - Retention: 30 days

2. Blockchain Data:
   - Daily snapshots
   - Transaction logs
   - State backups

3. Configuration Backups:
   - Version controlled
   - Encrypted secrets
   - Infrastructure as Code

### Recovery Procedures
1. Node Recovery:
   ```bash
   ./scripts/recover-node.sh --node=node1 --snapshot=latest
   ```

2. Database Recovery:
   ```bash
   ./scripts/recover-db.sh --backup=latest
   ```

3. Full System Recovery:
   ```bash
   ./scripts/disaster-recovery.sh --config=production
   ```

## Maintenance Procedures

### Regular Maintenance
1. System Updates:
   ```bash
   ./scripts/update-system.sh
   ```

2. Certificate Renewal:
   ```bash
   ./scripts/renew-certificates.sh
   ```

3. Log Rotation:
   ```bash
   ./scripts/rotate-logs.sh
   ```

### Performance Tuning
1. Node Optimization:
   ```bash
   ./scripts/optimize-node.sh
   ```

2. Database Optimization:
   ```bash
   ./scripts/optimize-db.sh
   ```

3. Network Optimization:
   ```bash
   ./scripts/optimize-network.sh
   ```

## Scaling Procedures

### Horizontal Scaling
1. Add New Node:
   ```bash
   ./scripts/add-node.sh --type=validator
   ```

2. Add Read Replica:
   ```bash
   ./scripts/add-replica.sh
   ```

### Vertical Scaling
1. Upgrade Resources:
   ```bash
   ./scripts/upgrade-resources.sh
   ```

2. Optimize Configuration:
   ```bash
   ./scripts/optimize-config.sh
   ```

## Cross-Chain Staking Deployment

### Prerequisites
- Access to target networks (Ethereum, Polygon, Arbitrum, Optimism)
- CCIP Router contracts deployed
- Staking protocol contracts deployed
- Aave/Compound integration contracts ready

### Deployment Steps

1. Deploy Staking Contracts:
```bash
# Deploy on Chain 138
./scripts/deploy-staking.sh
```

2. Deploy Bridge Infrastructure:
```bash
# Deploy CCIP contracts on all networks
./scripts/deploy-bridge.sh --network chain138
./scripts/deploy-bridge.sh --network ethereum
./scripts/deploy-bridge.sh --network polygon
./scripts/deploy-bridge.sh --network arbitrum
./scripts/deploy-bridge.sh --network optimism
```

3. Deploy Lending Integration:
```bash
# Deploy on target networks
./scripts/deploy-lending.sh --network ethereum
./scripts/deploy-lending.sh --network polygon
./scripts/deploy-lending.sh --network arbitrum
./scripts/deploy-lending.sh --network optimism
```

4. Configure Cross-Chain Routes:
```bash
# Set up routing and permissions
./scripts/configure-routes.sh
```

5. Verify Deployments:
```bash
# Verify all contracts
./scripts/verify-deployment.sh --component cross-chain
```

### Monitoring Setup

1. Configure Metrics:
```bash
# Set up cross-chain monitoring
./monitoring/scripts/setup-cross-chain-monitoring.sh
```

2. Setup Alerts:
```bash
# Configure cross-chain alerts
./monitoring/scripts/setup-cross-chain-alerts.sh
```

### Security Verification

1. Verify Access Controls:
```bash
# Check permissions
./scripts/verify-permissions.sh --component cross-chain
```

2. Test Emergency Procedures:
```bash
# Test emergency stops
./scripts/test-emergency.sh --component cross-chain
``` 