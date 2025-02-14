# Monitoring and Alerting Guide

## Monitoring Stack Overview

### Components
1. **Prometheus**
   - Metrics collection
   - Data storage
   - Alert evaluation

2. **Grafana**
   - Visualization
   - Dashboard management
   - Alert notifications

3. **AlertManager**
   - Alert routing
   - Alert grouping
   - Notification management

4. **Node Exporter**
   - System metrics
   - Resource utilization
   - Network statistics

## Metrics Collection

### Blockchain Metrics

#### Node Metrics
```promql
# Block Production Rate
rate(ethereum_blockchain_height[5m])

# Peer Count
ethereum_peer_count

# Transaction Pool
besu_transaction_pool_transactions

# Gas Usage
rate(ethereum_gas_used[5m])
```

#### Consensus Metrics
```promql
# Consensus Rounds
rate(besu_consensus_rounds[5m])

# Validator Participation
besu_consensus_validators_active / besu_consensus_validators_total

# Block Proposal Success
rate(besu_consensus_blocks_proposed{status="success"}[5m])
```

#### Network Metrics
```promql
# Network Latency
rate(ethereum_network_latency_seconds[5m])

# Bandwidth Usage
rate(ethereum_network_bytes_total[5m])

# P2P Connections
ethereum_p2p_connections
```

### DeFi Protocol Metrics

#### Protocol TVL
```promql
# Total Value Locked
sum(defi_protocol_tvl) by (protocol)

# TVL Change
(defi_protocol_tvl - defi_protocol_tvl offset 1d) / defi_protocol_tvl offset 1d
```

#### Trading Metrics
```promql
# Trading Volume
rate(dex_trading_volume[24h])

# Liquidity Depth
dex_liquidity_depth

# Price Impact
dex_price_impact
```

#### Lending Metrics
```promql
# Total Borrowed
sum(lending_borrowed_amount) by (asset)

# Utilization Rate
lending_borrowed_amount / lending_total_supply

# Interest Rates
lending_interest_rate
```

## Alert Rules

### Node Alerts

#### High Priority
```yaml
- alert: NodeDown
  expr: up == 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Node {{ $labels.instance }} down"
    description: "Node has been down for more than 5 minutes"

- alert: ConsensusFailure
  expr: increase(besu_consensus_failures[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Consensus failures detected"
    description: "Node is experiencing consensus failures"
```

#### Medium Priority
```yaml
- alert: HighGasUsage
  expr: ethereum_gas_used / ethereum_gas_limit > 0.8
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "High gas usage"
    description: "Gas usage is above 80% for 15 minutes"

- alert: PeerCountLow
  expr: ethereum_peer_count < 5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Low peer count"
    description: "Node has less than 5 peers"
```

### Protocol Alerts

#### DeFi Alerts
```yaml
- alert: HighUtilizationRate
  expr: lending_borrowed_amount / lending_total_supply > 0.9
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High utilization rate"
    description: "Protocol utilization above 90%"

- alert: LargeTVLDrop
  expr: (defi_protocol_tvl - defi_protocol_tvl offset 1h) / defi_protocol_tvl offset 1h < -0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Large TVL drop"
    description: "TVL dropped more than 10% in 1 hour"
```

#### Bridge Alerts
```yaml
- alert: BridgeDelayedTransfers
  expr: bridge_pending_transfers > 0 and bridge_transfer_delay > 3600
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Delayed bridge transfers"
    description: "Bridge transfers delayed for more than 1 hour"

- alert: BridgeFailedTransfers
  expr: increase(bridge_failed_transfers[15m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Failed bridge transfers"
    description: "Bridge transfers are failing"
```

## Dashboards

### Main Dashboard
```json
{
  "title": "Chain 138 Overview",
  "panels": [
    {
      "title": "Block Height",
      "type": "gauge",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "ethereum_blockchain_height",
          "refId": "A"
        }
      ]
    },
    {
      "title": "Transaction Rate",
      "type": "graph",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "rate(ethereum_transaction_count[5m])",
          "refId": "A"
        }
      ]
    }
  ]
}
```

### DeFi Dashboard
```json
{
  "title": "DeFi Protocols",
  "panels": [
    {
      "title": "Total Value Locked",
      "type": "graph",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(defi_protocol_tvl) by (protocol)",
          "refId": "A"
        }
      ]
    },
    {
      "title": "Trading Volume",
      "type": "graph",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "rate(dex_trading_volume[24h])",
          "refId": "A"
        }
      ]
    }
  ]
}
```

## Alert Routing

### Slack Integration
```yaml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#chain138-alerts'
        send_resolved: true
        title: '{{ template "slack.default.title" . }}'
        text: '{{ template "slack.default.text" . }}'

route:
  group_by: ['alertname', 'instance', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
      repeat_interval: 1h
```

### Email Integration
```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'team@chain138.com'
        from: 'alerts@chain138.com'
        smarthost: 'smtp.chain138.com:587'
        auth_username: 'alerts@chain138.com'
        auth_password: '{{ .EmailPassword }}'
        send_resolved: true
```

## Metric Collection Configuration

### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'besu'
    static_configs:
      - targets: ['localhost:9545']
    metrics_path: '/metrics'
    scheme: 'http'

  - job_name: 'defi-protocols'
    static_configs:
      - targets: ['localhost:9548']
    metrics_path: '/metrics'
    scheme: 'http'

  - job_name: 'bridges'
    static_configs:
      - targets: ['localhost:9547']
    metrics_path: '/metrics'
    scheme: 'http'
```

### Node Exporter Configuration
```yaml
- job_name: 'node'
  static_configs:
    - targets: ['localhost:9100']
  relabel_configs:
    - source_labels: [__address__]
      target_label: instance
      replacement: '{{ $labels.instance }}'
```

## Log Aggregation

### Logging Configuration
```yaml
logging:
  level: INFO
  format: json
  outputs:
    - type: file
      path: /var/log/chain138/node.log
    - type: elasticsearch
      hosts: ["elasticsearch:9200"]
      index: chain138-logs
```

### Log Parsing Rules
```yaml
- type: docker
  patterns:
    - 'time="(?P<timestamp>.*?)" level=(?P<level>.*?) msg="(?P<message>.*?)"'
  fields:
    container_name: chain138
    service: blockchain
```

## Performance Monitoring

### Resource Metrics
```promql
# CPU Usage
rate(process_cpu_seconds_total[5m])

# Memory Usage
process_resident_memory_bytes

# Disk I/O
rate(node_disk_io_time_seconds_total[5m])
```

### Network Metrics
```promql
# Network Traffic
rate(node_network_transmit_bytes_total[5m])
rate(node_network_receive_bytes_total[5m])

# Network Errors
rate(node_network_transmit_errs_total[5m])
```

## Alerting Templates

### Slack Templates
```gotemplate
{{ define "slack.default.title" }}
[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }}
{{ end }}

{{ define "slack.default.text" }}
{{ range .Alerts }}
*Alert:* {{ .Annotations.summary }}
*Description:* {{ .Annotations.description }}
*Severity:* {{ .Labels.severity }}
*Instance:* {{ .Labels.instance }}
*Started:* {{ .StartsAt | since }}
{{ end }}
{{ end }}
```

### Email Templates
```gotemplate
{{ define "email.default.subject" }}
[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}
{{ end }}

{{ define "email.default.html" }}
<h2>{{ .CommonLabels.alertname }}</h2>
<p>Status: {{ .Status }}</p>
<p>Severity: {{ .CommonLabels.severity }}</p>
<hr>
{{ range .Alerts }}
<h3>{{ .Annotations.summary }}</h3>
<p>{{ .Annotations.description }}</p>
<p>Instance: {{ .Labels.instance }}</p>
<p>Started: {{ .StartsAt }}</p>
{{ end }}
{{ end }}
``` 