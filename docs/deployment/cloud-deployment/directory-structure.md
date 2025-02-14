# Cloud Deployment Directory Structure

```
infrastructure/
├── aws/
│   ├── modules/
│   │   ├── vpc/
│   │   ├── eks/
│   │   ├── rds/
│   │   └── monitoring/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── azure/
│   ├── modules/
│   │   ├── vnet/
│   │   ├── aks/
│   │   └── postgresql/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── gcp/
│   ├── modules/
│   │   ├── vpc/
│   │   ├── gke/
│   │   └── cloudsql/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── common/
│   ├── helm/
│   │   ├── chain138/
│   │   │   ├── templates/
│   │   │   ├── values.yaml
│   │   │   └── Chart.yaml
│   │   └── monitoring/
│   │       ├── templates/
│   │       ├── values.yaml
│   │       └── Chart.yaml
│   └── kubernetes/
│       ├── base/
│       └── overlays/
└── scripts/
    ├── aws/
    ├── azure/
    └── gcp/
```

This directory structure organizes cloud deployment resources by provider and type. Each provider has its own Terraform modules, Helm charts, and deployment scripts. 