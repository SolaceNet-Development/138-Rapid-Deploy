# Troubleshooting Guide

## Common Issues and Solutions

### Blockchain Node Issues

#### Node Not Starting
**Symptoms:**
- Besu node fails to start
- Error in logs about port already in use

**Solutions:**
1. Check if ports are already in use:
   ```bash
   lsof -i :8545
   lsof -i :8546
   ```
2. Verify configuration file paths:
   ```bash
   ls -l blockchain/config/network/config.toml
   ```
3. Check logs for specific errors:
   ```bash
   tail -f data/chain138/logs/besu.log
   ```

#### Consensus Issues
**Symptoms:**
- Blocks not being produced
- Consensus failures in logs

**Solutions:**
1. Verify validator configuration:
   ```bash
   cat blockchain/config/genesis.json | grep validators
   ```
2. Check network connectivity between validators:
   ```bash
   curl -X POST --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' localhost:8545
   ```
3. Verify IBFT 2.0 configuration:
   ```bash
   cat blockchain/config/ibft/config.toml
   ```

### Privacy Manager Issues

#### Tessera Connection Failed
**Symptoms:**
- Private transactions failing
- Tessera connection errors

**Solutions:**
1. Check Tessera status:
   ```bash
   curl -X GET http://localhost:9102/upcheck
   ```
2. Verify database connection:
   ```bash
   psql -h localhost -U admin -d tessera -c "\dt"
   ```
3. Check Tessera logs:
   ```bash
   docker logs chain138-tessera
   ```

### Monitoring Stack Issues

#### Prometheus Not Scraping
**Symptoms:**
- No metrics in Grafana
- Target shows as down in Prometheus

**Solutions:**
1. Check Prometheus targets:
   ```bash
   curl localhost:9090/api/v1/targets
   ```
2. Verify scrape configuration:
   ```bash
   cat monitoring/config/prometheus.yml
   ```
3. Check node exporter:
   ```bash
   curl localhost:9100/metrics
   ```

#### AlertManager Not Sending Alerts
**Symptoms:**
- No alerts being received
- Alerts showing as pending

**Solutions:**
1. Verify webhook configuration:
   ```bash
   cat monitoring/config/alertmanager/alertmanager.yml
   ```
2. Test alert routing:
   ```bash
   curl -H "Content-Type: application/json" -d '[{"labels":{"alertname":"TestAlert"}}]' localhost:9093/api/v1/alerts
   ```
3. Check AlertManager status:
   ```bash
   curl localhost:9093/-/healthy
   ```

### Bridge Issues

#### CCIP Transaction Failures
**Symptoms:**
- Cross-chain transfers failing
- Tokens not being minted

**Solutions:**
1. Check CCIP router status:
   ```bash
   curl -X POST --data '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"ROUTER_ADDRESS","data":"0x"}],"id":1}' localhost:8545
   ```
2. Verify bridge configuration:
   ```bash
   cat bridge/ccip/config.json
   ```
3. Monitor bridge events:
   ```bash
   tail -f bridge/logs/bridge.log
   ```

### DeFi Protocol Issues

#### Protocol Deployment Failures
**Symptoms:**
- Contract deployment failing
- Protocol initialization errors

**Solutions:**
1. Check contract deployment logs:
   ```bash
   cat defi/logs/deployment.log
   ```
2. Verify protocol configuration:
   ```bash
   cat defi/config.json
   ```
3. Check gas settings:
   ```bash
   cat hardhat.config.ts | grep gasLimit
   ```

## Performance Issues

### High Resource Usage
**Symptoms:**
- High CPU/Memory usage
- Slow transaction processing

**Solutions:**
1. Check system resources:
   ```bash
   top -b -n 1
   free -m
   df -h
   ```
2. Monitor network I/O:
   ```bash
   nethogs
   ```
3. Analyze database performance:
   ```bash
   psql -h localhost -U admin -d chain138 -c "SELECT * FROM pg_stat_activity;"
   ```

### Network Latency
**Symptoms:**
- Slow block propagation
- High transaction confirmation times

**Solutions:**
1. Check network connectivity:
   ```bash
   ping besu-node
   ```
2. Monitor network metrics:
   ```bash
   curl localhost:9545/metrics | grep network
   ```
3. Verify peer connections:
   ```bash
   curl -X POST --data '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}' localhost:8545
   ```

## Security Issues

### Permission Denied
**Symptoms:**
- Access denied errors
- Permission configuration failures

**Solutions:**
1. Check file permissions:
   ```bash
   ls -l data/chain138/
   ```
2. Verify user permissions:
   ```bash
   id
   groups
   ```
3. Check Docker permissions:
   ```bash
   docker info
   ```

### TLS Certificate Issues
**Symptoms:**
- SSL/TLS handshake failures
- Certificate validation errors

**Solutions:**
1. Verify certificate validity:
   ```bash
   openssl x509 -in /path/to/cert.pem -text
   ```
2. Check certificate chain:
   ```bash
   openssl verify -CAfile /path/to/ca.pem /path/to/cert.pem
   ```
3. Verify TLS configuration:
   ```bash
   cat blockchain/config/network/config.toml | grep tls
   ```

## Recovery Procedures

### Node Recovery
1. Backup current state:
   ```bash
   tar -czf backup.tar.gz data/chain138/
   ```
2. Stop services:
   ```bash
   docker-compose down
   ```
3. Clear problematic data:
   ```bash
   rm -rf data/chain138/database
   ```
4. Restore from backup:
   ```bash
   tar -xzf backup.tar.gz
   ```
5. Restart services:
   ```bash
   docker-compose up -d
   ```

### Database Recovery
1. Create database backup:
   ```bash
   pg_dump -h localhost -U admin chain138 > backup.sql
   ```
2. Stop affected services:
   ```bash
   docker-compose stop postgres
   ```
3. Restore database:
   ```bash
   psql -h localhost -U admin chain138 < backup.sql
   ```
4. Restart services:
   ```bash
   docker-compose up -d
   ```

## Maintenance Procedures

### Log Rotation
1. Configure logrotate:
   ```bash
   cat > /etc/logrotate.d/chain138 << EOF
   /var/log/chain138/*.log {
       daily
       rotate 7
       compress
       delaycompress
       missingok
       notifempty
       create 0640 chain138 chain138
   }
   EOF
   ```

### Backup Procedures
1. Create backup script:
   ```bash
   cat > backup.sh << EOF
   #!/bin/bash
   DATE=$(date +%Y%m%d)
   tar -czf backup_$DATE.tar.gz data/
   pg_dump -h localhost -U admin chain138 > backup_$DATE.sql
   EOF
   ```
2. Schedule backup:
   ```bash
   crontab -e
   # Add: 0 0 * * * /path/to/backup.sh
   ```

## Support Information

### Log Collection
Run the following script to collect logs for support:
```bash
#!/bin/bash
LOGDIR="support_logs_$(date +%Y%m%d)"
mkdir -p $LOGDIR
cp data/chain138/logs/* $LOGDIR/
docker-compose logs > $LOGDIR/docker.log
tar -czf $LOGDIR.tar.gz $LOGDIR/
```

### System Information
Collect system information:
```bash
#!/bin/bash
echo "System Information" > sysinfo.txt
uname -a >> sysinfo.txt
docker version >> sysinfo.txt
docker-compose version >> sysinfo.txt
df -h >> sysinfo.txt
free -m >> sysinfo.txt
``` 