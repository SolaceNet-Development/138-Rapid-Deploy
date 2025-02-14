# AWS Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate credentials
- `eksctl` installed
- `kubectl` installed
- `helm` installed

## Infrastructure Components

### VPC Configuration
```hcl
# infrastructure/aws/modules/vpc/main.tf
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "3.0.0"

  name = "chain138-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false
  
  tags = {
    Environment = "production"
    Project     = "chain138"
  }
}
```

### EKS Cluster
```hcl
# infrastructure/aws/modules/eks/main.tf
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "17.1.0"

  cluster_name    = "chain138"
  cluster_version = "1.24"

  vpc_id  = var.vpc_id
  subnets = var.private_subnets

  node_groups = {
    validators = {
      desired_capacity = 4
      max_capacity     = 6
      min_capacity     = 3

      instance_types = ["r5.2xlarge"]
      capacity_type  = "ON_DEMAND"

      k8s_labels = {
        role = "validator"
      }
    }
  }
}
```

### RDS Instance
```hcl
# infrastructure/aws/modules/rds/main.tf
module "db" {
  source = "terraform-aws-modules/rds/aws"
  version = "3.0.0"

  identifier = "chain138-db"

  engine            = "postgres"
  engine_version    = "13.7"
  instance_class    = "db.r5.xlarge"
  allocated_storage = 100

  name     = "chain138"
  username = "admin"
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids             = var.database_subnet_ids

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  multi_az = true
}
```

## Deployment Steps

### 1. Initialize Infrastructure
```bash
# Initialize Terraform
cd infrastructure/aws
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

### 2. Configure kubectl
```bash
aws eks update-kubeconfig --name chain138 --region us-east-1
```

### 3. Deploy Core Components

#### Storage Classes
```yaml
# infrastructure/common/kubernetes/base/storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: chain138-storage
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

#### Deploy Blockchain Nodes
```bash
# Deploy using Helm
helm upgrade --install chain138 ./infrastructure/common/helm/chain138 \
  --namespace chain138 \
  --create-namespace \
  -f infrastructure/common/helm/chain138/values-aws.yaml
```

### 4. Configure Monitoring

#### Deploy Prometheus Stack
```bash
helm upgrade --install monitoring ./infrastructure/common/helm/monitoring \
  --namespace monitoring \
  --create-namespace \
  -f infrastructure/common/helm/monitoring/values-aws.yaml
```

### 5. Security Configuration

#### Network Policies
```yaml
# infrastructure/common/kubernetes/base/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: validator-policy
spec:
  podSelector:
    matchLabels:
      role: validator
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: validator
    ports:
    - protocol: TCP
      port: 30303
```

#### IAM Roles
```hcl
# infrastructure/aws/modules/eks/iam.tf
resource "aws_iam_role" "chain138_node" {
  name = "chain138-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}
```

### 6. Backup Configuration

#### S3 Bucket Setup
```hcl
# infrastructure/aws/modules/backup/main.tf
resource "aws_s3_bucket" "backup" {
  bucket = "chain138-backups"
  
  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}
```

#### Backup CronJob
```yaml
# infrastructure/common/kubernetes/base/backup-cronjob.yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: chain138-backup
spec:
  schedule: "0 0 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: chain138/backup:latest
            env:
            - name: AWS_REGION
              value: us-east-1
            - name: BACKUP_BUCKET
              value: chain138-backups
```

## Maintenance Procedures

### Scaling
```bash
# Scale validator nodes
eksctl scale nodegroup --cluster=chain138 --name=validators --nodes=6

# Update instance types
eksctl upgrade nodegroup --cluster=chain138 --name=validators --instance-types=r5.2xlarge
```

### Updates
```bash
# Update EKS version
eksctl upgrade cluster --name=chain138 --approve

# Update node groups
eksctl upgrade nodegroup --cluster=chain138 --name=validators
```

### Monitoring
```bash
# Get cluster metrics
kubectl top nodes

# Get pod metrics
kubectl top pods -n chain138

# View logs
kubectl logs -f -l role=validator -n chain138
```

## Troubleshooting

### Common Issues

#### Node Group Issues
```bash
# Check node status
kubectl get nodes
kubectl describe node <node-name>

# Check node group status
eksctl get nodegroup --cluster=chain138
```

#### Pod Issues
```bash
# Check pod status
kubectl get pods -n chain138
kubectl describe pod <pod-name> -n chain138

# Check pod logs
kubectl logs <pod-name> -n chain138
```

## Cost Optimization

### Resource Recommendations
- Use Spot Instances for non-validator nodes
- Enable auto-scaling for optimal resource usage
- Use gp3 EBS volumes for better performance/cost ratio
- Enable S3 Lifecycle policies for backups

### Example Auto-scaling Configuration
```hcl
# infrastructure/aws/modules/eks/auto-scaling.tf
resource "aws_autoscaling_policy" "validator_scale_up" {
  name                   = "validator-scale-up"
  scaling_adjustment     = 1
  adjustment_type       = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = module.eks.node_groups.validators.resources[0].autoscaling_groups[0].name
}
``` 