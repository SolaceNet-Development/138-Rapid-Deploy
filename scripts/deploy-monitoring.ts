import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface MonitoringConfig {
  enabled: boolean;
  grafanaUrl: string;
  prometheusUrl: string;
  alerting?: {
    enabled: boolean;
    slackWebhook: string;
    discordWebhook: string;
    emailNotifications: string;
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Setting up monitoring with account:', deployer.address);

  // Load configuration
  const configPath = path.join(__dirname, '../deployment/config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const env = process.env.DEPLOYMENT_ENV || 'development';
  const monitoringConfig: MonitoringConfig = config.environments[env].monitoring;

  if (!monitoringConfig.enabled) {
    console.log('Monitoring is disabled for this environment');
    return;
  }

  // Deploy monitoring contracts
  const MonitoringRegistry = await ethers.getContractFactory('MonitoringRegistry');
  const monitoringRegistry = await MonitoringRegistry.deploy();
  await monitoringRegistry.deployed();
  console.log('MonitoringRegistry deployed to:', monitoringRegistry.address);

  // Set up metrics collectors
  const metrics = [
    {
      name: 'transaction_volume',
      interval: 300, // 5 minutes
      aggregation: 'sum'
    },
    {
      name: 'active_positions',
      interval: 300,
      aggregation: 'latest'
    },
    {
      name: 'total_value_locked',
      interval: 300,
      aggregation: 'latest'
    },
    {
      name: 'gas_usage',
      interval: 300,
      aggregation: 'average'
    }
  ];

  for (const metric of metrics) {
    await monitoringRegistry.addMetric(metric.name, metric.interval, metric.aggregation);
    console.log(`Added metric: ${metric.name}`);
  }

  // Set up alerting rules
  if (monitoringConfig.alerting?.enabled) {
    const alerts = [
      {
        name: 'high_gas_usage',
        condition: 'gas_usage > 1000000',
        threshold: '5m',
        severity: 'warning'
      },
      {
        name: 'large_position',
        condition: 'position_size > 1000000',
        threshold: '1m',
        severity: 'critical'
      },
      {
        name: 'low_liquidity',
        condition: 'liquidity_ratio < 0.1',
        threshold: '5m',
        severity: 'critical'
      }
    ];

    for (const alert of alerts) {
      await monitoringRegistry.addAlert(
        alert.name,
        alert.condition,
        alert.threshold,
        alert.severity
      );
      console.log(`Added alert: ${alert.name}`);
    }

    // Configure notification channels
    await monitoringRegistry.setNotificationChannels(
      monitoringConfig.alerting.slackWebhook,
      monitoringConfig.alerting.discordWebhook,
      monitoringConfig.alerting.emailNotifications
    );
    console.log('Notification channels configured');
  }

  // Update Grafana dashboards
  const dashboards = [
    'network_overview',
    'defi_metrics',
    'risk_management',
    'performance_analytics'
  ];

  for (const dashboard of dashboards) {
    const dashboardConfig = require(`../monitoring/dashboards/${dashboard}.json`);
    await monitoringRegistry.updateDashboard(dashboard, JSON.stringify(dashboardConfig));
    console.log(`Updated dashboard: ${dashboard}`);
  }

  return {
    monitoringRegistry: monitoringRegistry.address
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
