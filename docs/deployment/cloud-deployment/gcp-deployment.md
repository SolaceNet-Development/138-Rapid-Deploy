# Google Cloud Platform Deployment Guide

## Prerequisites
- Google Cloud SDK installed and configured
- `kubectl` installed
- `helm` installed
- GCP project with necessary APIs enabled

## Infrastructure Components

### Network Configuration
```hcl
# infrastructure/gcp/modules/vpc/main.tf
resource "google_compute_network" "chain138" {
  name                    = "chain138-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gke" {
  name          = "gke-subnet"
  ip_cidr_range = "10.0.0.0/24"
  network       = google_compute_network.chain138.self_link
  region        = var.region

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}
```

### GKE Cluster
```hcl
# infrastructure/gcp/modules/gke/main.tf
resource "google_container_cluster" "chain138" {
  name     = "chain138"
  location = var.region

  network    = var.network
  subnetwork = var.subnetwork

  initial_node_count = 1
  remove_default_node_pool = true

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  private_cluster_config {
    enable_private_nodes = true
    enable_private_endpoint = false
    master_ipv4_cidr_block = "172.16.0.0/28"
  }
}

resource "google_container_node_pool" "validators" {
  name       = "validators"
  location   = var.region
  cluster    = google_container_cluster.chain138.name

  node_count = 4

  node_config {
    machine_type = "n2-standard-8"
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      role = "validator"
    }

    taint {
      key    = "dedicated"
      value  = "validator"
      effect = "NO_SCHEDULE"
    }
  }

  autoscaling {
    min_node_count = 3
    max_node_count = 6
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
```

### Cloud SQL Instance
```hcl
# infrastructure/gcp/modules/cloudsql/main.tf
resource "google_sql_database_instance" "chain138" {
  name             = "chain138-db"
  database_version = "POSTGRES_13"
  region           = var.region

  settings {
    tier = "db-custom-4-16384"
    
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = false
      private_network = var.network_id
    }

    availability_type = "REGIONAL"
    
    database_flags {
      name  = "max_connections"
      value = "1000"
    }
  }

  deletion_protection = true
}
```

## Deployment Steps

### 1. Initialize Infrastructure
```bash
# Set project
gcloud config set project <project-id>

# Initialize Terraform
cd infrastructure/gcp
terraform init

# Apply infrastructure
terraform apply
```

### 2. Configure kubectl
```bash
# Get GKE credentials
gcloud container clusters get-credentials chain138 --region <region>
```

### 3. Deploy Core Components

#### Storage Classes
```yaml
# infrastructure/common/kubernetes/base/storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: chain138-ssd
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

#### Deploy Blockchain Nodes
```bash
# Deploy using Helm
helm upgrade --install chain138 ./infrastructure/common/helm/chain138 \
  --namespace chain138 \
  --create-namespace \
  -f infrastructure/common/helm/chain138/values-gcp.yaml
```

### 4. Configure Monitoring

#### Deploy Cloud Operations
```bash
# Enable monitoring
gcloud container clusters update chain138 \
  --region <region> \
  --enable-stackdriver-kubernetes

# Deploy Prometheus
helm upgrade --install monitoring ./infrastructure/common/helm/monitoring \
  --namespace monitoring \
  --create-namespace \
  -f infrastructure/common/helm/monitoring/values-gcp.yaml
```

### 5. Security Configuration

#### Firewall Rules
```hcl
# infrastructure/gcp/modules/network/firewall.tf
resource "google_compute_firewall" "validator" {
  name    = "validator-firewall"
  network = var.network

  allow {
    protocol = "tcp"
    ports    = ["30303"]
  }

  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["validator"]
}
```

#### Secret Management
```hcl
# infrastructure/gcp/modules/secrets/main.tf
resource "google_secret_manager_secret" "chain138" {
  secret_id = "chain138-secret"

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "chain138" {
  secret = google_secret_manager_secret.chain138.id
  secret_data = var.secret_data
}
```

### 6. Backup Configuration

#### Cloud Storage Backup
```hcl
# infrastructure/gcp/modules/backup/main.tf
resource "google_storage_bucket" "backup" {
  name          = "chain138-backups"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
}
```

## Maintenance Procedures

### Scaling
```bash
# Scale node pool
gcloud container clusters resize chain138 \
  --node-pool validators \
  --num-nodes 6 \
  --region <region>

# Update node pool
gcloud container node-pools upgrade validators \
  --cluster chain138 \
  --region <region>
```

### Updates
```bash
# Update GKE version
gcloud container clusters upgrade chain138 \
  --region <region> \
  --master \
  --cluster-version 1.24.0
```

### Monitoring
```bash
# View cluster metrics
gcloud monitoring metrics list \
  --filter="resource.type = k8s_container"

# View logs
gcloud logging read "resource.type=k8s_container AND resource.labels.container_name:validator" \
  --limit 10
```

## Troubleshooting

### Common Issues

#### Cluster Issues
```bash
# Check cluster status
gcloud container clusters describe chain138 \
  --region <region>

# Get cluster logs
gcloud logging read "resource.type=k8s_cluster" \
  --limit 10
```

#### Network Issues
```bash
# Test connectivity
gcloud compute networks subnets get-iam-policy gke-subnet \
  --region <region>

# Check firewall rules
gcloud compute firewall-rules list \
  --filter="network:chain138-network"
```

## Cost Optimization

### Resource Recommendations
- Use preemptible VMs for non-critical workloads
- Implement auto-scaling for optimal resource usage
- Use appropriate disk types based on workload
- Configure object lifecycle management for backups

### Example Cost Management
```hcl
# infrastructure/gcp/modules/budget/main.tf
resource "google_billing_budget" "chain138" {
  billing_account = var.billing_account_id
  display_name    = "chain138-budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
    labels = {
      environment = "production"
    }
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "1000"
    }
  }

  threshold_rules {
    threshold_percent = 0.8
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.name
    ]
    disable_default_iam_recipients = true
  }
}
``` 