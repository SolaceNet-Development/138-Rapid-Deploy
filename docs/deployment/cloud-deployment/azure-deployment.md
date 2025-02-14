# Azure Deployment Guide

## Prerequisites
- Azure CLI installed and configured
- `kubectl` installed
- `helm` installed
- Azure subscription with appropriate permissions

## Infrastructure Components

### Virtual Network Configuration
```hcl
# infrastructure/azure/modules/vnet/main.tf
resource "azurerm_virtual_network" "chain138" {
  name                = "chain138-vnet"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = ["10.0.0.0/16"]

  subnet {
    name           = "aks-subnet"
    address_prefix = "10.0.1.0/24"
  }

  subnet {
    name           = "db-subnet"
    address_prefix = "10.0.2.0/24"
  }
}
```

### AKS Cluster
```hcl
# infrastructure/azure/modules/aks/main.tf
resource "azurerm_kubernetes_cluster" "chain138" {
  name                = "chain138"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "chain138"

  default_node_pool {
    name                = "validators"
    node_count          = 4
    vm_size            = "Standard_D8s_v3"
    availability_zones  = [1, 2, 3]
    enable_auto_scaling = true
    min_count          = 3
    max_count          = 6
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    network_policy    = "calico"
  }
}
```

### Azure Database for PostgreSQL
```hcl
# infrastructure/azure/modules/postgresql/main.tf
resource "azurerm_postgresql_flexible_server" "chain138" {
  name                = "chain138-db"
  resource_group_name = var.resource_group_name
  location            = var.location
  version            = "13"
  
  administrator_login    = "chain138admin"
  administrator_password = var.db_password

  storage_mb = 102400
  sku_name   = "GP_Standard_D4s_v3"

  backup_retention_days = 7
  geo_redundant_backup_enabled = true

  high_availability {
    mode = "ZoneRedundant"
  }
}
```

## Deployment Steps

### 1. Initialize Infrastructure
```bash
# Login to Azure
az login

# Set subscription
az account set --subscription <subscription-id>

# Initialize Terraform
cd infrastructure/azure
terraform init

# Apply infrastructure
terraform apply
```

### 2. Configure kubectl
```bash
# Get AKS credentials
az aks get-credentials --resource-group chain138-rg --name chain138
```

### 3. Deploy Core Components

#### Storage Classes
```yaml
# infrastructure/common/kubernetes/base/storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: chain138-premium
provisioner: kubernetes.io/azure-disk
parameters:
  storageaccounttype: Premium_LRS
  kind: Managed
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

#### Deploy Blockchain Nodes
```bash
# Deploy using Helm
helm upgrade --install chain138 ./infrastructure/common/helm/chain138 \
  --namespace chain138 \
  --create-namespace \
  -f infrastructure/common/helm/chain138/values-azure.yaml
```

### 4. Configure Monitoring

#### Deploy Azure Monitor
```bash
# Enable monitoring add-on
az aks enable-addons \
  --resource-group chain138-rg \
  --name chain138 \
  --addons monitoring

# Deploy Prometheus
helm upgrade --install monitoring ./infrastructure/common/helm/monitoring \
  --namespace monitoring \
  --create-namespace \
  -f infrastructure/common/helm/monitoring/values-azure.yaml
```

### 5. Security Configuration

#### Network Security Groups
```hcl
# infrastructure/azure/modules/network/security.tf
resource "azurerm_network_security_group" "validator" {
  name                = "validator-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name

  security_rule {
    name                       = "allow-p2p"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range         = "*"
    destination_port_range    = "30303"
    source_address_prefix     = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }
}
```

#### Azure Key Vault Integration
```hcl
# infrastructure/azure/modules/keyvault/main.tf
resource "azurerm_key_vault" "chain138" {
  name                = "chain138-vault"
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id          = data.azurerm_client_config.current.tenant_id
  sku_name           = "premium"

  purge_protection_enabled = true
  soft_delete_retention_days = 90
}
```

### 6. Backup Configuration

#### Azure Backup
```hcl
# infrastructure/azure/modules/backup/main.tf
resource "azurerm_recovery_services_vault" "chain138" {
  name                = "chain138-vault"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
}

resource "azurerm_backup_policy_vm" "daily" {
  name                = "daily-backup"
  resource_group_name = var.resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.chain138.name

  backup {
    frequency = "Daily"
    time      = "23:00"
  }

  retention_daily {
    count = 7
  }
}
```

## Maintenance Procedures

### Scaling
```bash
# Scale node pool
az aks scale \
  --resource-group chain138-rg \
  --name chain138 \
  --node-count 6 \
  --nodepool-name validators

# Update node pool
az aks nodepool upgrade \
  --resource-group chain138-rg \
  --cluster-name chain138 \
  --name validators \
  --kubernetes-version 1.24.0
```

### Updates
```bash
# Update AKS version
az aks upgrade \
  --resource-group chain138-rg \
  --name chain138 \
  --kubernetes-version 1.24.0
```

### Monitoring
```bash
# View cluster metrics
az monitor metrics list \
  --resource chain138 \
  --resource-group chain138-rg \
  --resource-type Microsoft.ContainerService/managedClusters

# View logs
az monitor log-analytics query \
  --workspace-name chain138-workspace \
  --analytics-query "ContainerLog | where ContainerName contains 'validator'"
```

## Troubleshooting

### Common Issues

#### Cluster Issues
```bash
# Check cluster health
az aks show \
  --resource-group chain138-rg \
  --name chain138

# Get cluster logs
az aks get-diagnostics \
  --resource-group chain138-rg \
  --name chain138
```

#### Network Issues
```bash
# Test network connectivity
az network watcher test-ip-flow \
  --resource-group chain138-rg \
  --vm chain138-node \
  --direction Inbound \
  --protocol TCP \
  --local 10.0.1.4 \
  --remote 10.0.2.4 \
  --local-port 30303
```

## Cost Optimization

### Resource Recommendations
- Use B-series VMs for non-critical workloads
- Implement auto-scaling for optimal resource usage
- Use managed disks with the right performance tier
- Configure automatic backup retention policies

### Example Cost Management
```hcl
# infrastructure/azure/modules/aks/cost-management.tf
resource "azurerm_monitor_action_group" "cost_alert" {
  name                = "cost-alert"
  resource_group_name = var.resource_group_name
  short_name          = "cost"

  email_receiver {
    name          = "admin"
    email_address = "admin@chain138.com"
  }
}

resource "azurerm_monitor_metric_alert" "cost" {
  name                = "cost-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_kubernetes_cluster.chain138.id]
  description         = "Alert when cost exceeds threshold"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.cost_alert.id
  }
}
``` 