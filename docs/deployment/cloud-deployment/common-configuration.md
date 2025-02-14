# Common Cloud Deployment Configuration

## Overview
This guide covers common configuration patterns and resources shared across cloud providers for Chain 138 deployment.

## Helm Charts

### Chain 138 Core Chart
```yaml
# infrastructure/common/helm/chain138/Chart.yaml
apiVersion: v2
name: chain138
description: Chain 138 Core Components
version: 1.0.0
appVersion: "1.0.0"

dependencies:
  - name: prometheus
    version: "15.0.0"
    repository: "https://prometheus-community.github.io/helm-charts"
    condition: monitoring.enabled
```

### Values Template
```yaml
# infrastructure/common/helm/chain138/values.yaml
nodes:
  count: 4
  resources:
    requests:
      cpu: 4
      memory: 16Gi
    limits:
      cpu: 8
      memory: 32Gi

storage:
  size: 500Gi
  class: chain138-storage

monitoring:
  enabled: true
  prometheus:
    retention: 15d
    resources:
      requests:
        cpu: 2
        memory: 8Gi

security:
  networkPolicy:
    enabled: true
  rbac:
    create: true
```

## Kubernetes Base Resources

### Network Policies
```yaml
# infrastructure/common/kubernetes/base/network-policies/default.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: chain138
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - port: 9545
      protocol: TCP
```

### RBAC Configuration
```yaml
# infrastructure/common/kubernetes/base/rbac/roles.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: chain138-operator
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: chain138-operator
subjects:
- kind: ServiceAccount
  name: chain138-operator
  namespace: chain138
roleRef:
  kind: ClusterRole
  name: chain138-operator
  apiGroup: rbac.authorization.k8s.io
```

## Monitoring Configuration

### Prometheus Rules
```yaml
# infrastructure/common/monitoring/prometheus-rules.yaml
groups:
- name: chain138.rules
  rules:
  - alert: NodeDown
    expr: up == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Node {{ $labels.instance }} down"
      description: "Node has been down for more than 5 minutes"

  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes{container!=""} > 0.9 * container_spec_memory_limit_bytes
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage on {{ $labels.instance }}"
      description: "Container memory usage is above 90%"
```

### Grafana Dashboards
```json
# infrastructure/common/monitoring/dashboards/chain138.json
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

## Backup Configuration

### Backup Script
```bash
#!/bin/bash
# infrastructure/common/scripts/backup.sh

# Set variables
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
NODE_DATA_DIR="/data/chain138"

# Create backup
tar -czf $BACKUP_DIR/chain138_$BACKUP_DATE.tar.gz $NODE_DATA_DIR

# Upload to cloud storage
case "$CLOUD_PROVIDER" in
  "aws")
    aws s3 cp $BACKUP_DIR/chain138_$BACKUP_DATE.tar.gz s3://$BUCKET_NAME/
    ;;
  "azure")
    az storage blob upload \
      --container-name $CONTAINER_NAME \
      --file $BACKUP_DIR/chain138_$BACKUP_DATE.tar.gz \
      --name chain138_$BACKUP_DATE.tar.gz
    ;;
  "gcp")
    gsutil cp $BACKUP_DIR/chain138_$BACKUP_DATE.tar.gz gs://$BUCKET_NAME/
    ;;
esac

# Cleanup old backups
find $BACKUP_DIR -type f -mtime +7 -name "chain138_*.tar.gz" -delete
```

## Security Configuration

### Pod Security Policies
```yaml
# infrastructure/common/kubernetes/base/security/pod-security-policies.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: chain138-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1
        max: 65535
```

## Resource Management

### Resource Quotas
```yaml
# infrastructure/common/kubernetes/base/quotas/resource-quotas.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: chain138-quota
spec:
  hard:
    requests.cpu: "32"
    requests.memory: 64Gi
    limits.cpu: "64"
    limits.memory: 128Gi
    requests.storage: 1Ti
```

### Limit Ranges
```yaml
# infrastructure/common/kubernetes/base/quotas/limit-ranges.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: chain138-limits
spec:
  limits:
  - default:
      cpu: 4
      memory: 8Gi
    defaultRequest:
      cpu: 2
      memory: 4Gi
    type: Container
```

## Logging Configuration

### Fluentd Configuration
```yaml
# infrastructure/common/monitoring/fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_key time
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
    </filter>

    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      logstash_format true
      logstash_prefix chain138
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_interval 5s
        retry_forever false
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
``` 