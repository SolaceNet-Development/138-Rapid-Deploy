import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface FraudPreventionConfig {
  anomalyDetection: boolean;
  fraudPrevention: boolean;
  realTimeAlerts: boolean;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Fraud Prevention with account:', deployer.address);

  // Load configuration
  const configPath = path.join(__dirname, '../deployment/config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const env = process.env.DEPLOYMENT_ENV || 'development';
  const fraudConfig: FraudPreventionConfig = config.environments[env].security.monitoring;

  // Deploy Fraud Prevention Registry
  const FraudPrevention = await ethers.getContractFactory('FraudPrevention');
  const fraudPrevention = await FraudPrevention.deploy();
  await fraudPrevention.deployed();
  console.log('FraudPrevention deployed to:', fraudPrevention.address);

  // Deploy Anomaly Detection if enabled
  if (fraudConfig.anomalyDetection) {
    const AnomalyDetection = await ethers.getContractFactory('AnomalyDetection');
    const anomalyDetection = await AnomalyDetection.deploy(fraudPrevention.address);
    await anomalyDetection.deployed();
    console.log('AnomalyDetection deployed to:', anomalyDetection.address);

    // Set up detection rules
    const detectionRules = [
      {
        name: 'large_position_change',
        threshold: ethers.utils.parseEther('100000'), // $100k
        timeWindow: 300 // 5 minutes
      },
      {
        name: 'rapid_liquidations',
        threshold: 5,
        timeWindow: 600 // 10 minutes
      },
      {
        name: 'price_manipulation',
        threshold: ethers.utils.parseEther('0.05'), // 5%
        timeWindow: 60 // 1 minute
      }
    ];

    for (const rule of detectionRules) {
      await anomalyDetection.addDetectionRule(rule.name, rule.threshold, rule.timeWindow);
      console.log(`Added detection rule: ${rule.name}`);
    }
  }

  // Set up fraud prevention rules
  const preventionRules = [
    {
      name: 'suspicious_trading_pattern',
      params: {
        maxPositionSize: ethers.utils.parseEther('1000000'),
        maxLeverageChange: 5,
        minTimeBetweenTrades: 60
      }
    },
    {
      name: 'wash_trading_prevention',
      params: {
        minPriceImpact: ethers.utils.parseEther('0.001'),
        minTimeBetweenTrades: 300,
        maxSelfTrades: 3
      }
    },
    {
      name: 'market_manipulation',
      params: {
        maxPriceDeviation: ethers.utils.parseEther('0.1'),
        maxVolumeSpike: ethers.utils.parseEther('5'),
        detectionWindow: 1800
      }
    }
  ];

  for (const rule of preventionRules) {
    await fraudPrevention.addPreventionRule(rule.name, rule.params);
    console.log(`Added prevention rule: ${rule.name}`);
  }

  // Set up real-time alerts if enabled
  if (fraudConfig.realTimeAlerts) {
    const alertConfig = {
      endpoints: {
        slack: process.env.FRAUD_ALERT_SLACK_WEBHOOK,
        discord: process.env.FRAUD_ALERT_DISCORD_WEBHOOK,
        email: process.env.FRAUD_ALERT_EMAIL
      },
      severity: {
        high: {
          delay: 0,
          retries: 3
        },
        medium: {
          delay: 300,
          retries: 2
        },
        low: {
          delay: 900,
          retries: 1
        }
      }
    };

    await fraudPrevention.setAlertConfig(alertConfig);
    console.log('Alert configuration set');
  }

  // Set up automated responses
  const automatedResponses = [
    {
      trigger: 'high_severity_fraud',
      actions: [
        {
          type: 'pause_trading',
          params: { duration: 3600 }
        },
        {
          type: 'notify_admins',
          params: { priority: 'high' }
        }
      ]
    },
    {
      trigger: 'suspicious_activity',
      actions: [
        {
          type: 'increase_monitoring',
          params: { duration: 7200 }
        },
        {
          type: 'flag_account',
          params: { reviewPeriod: 86400 }
        }
      ]
    }
  ];

  for (const response of automatedResponses) {
    await fraudPrevention.addAutomatedResponse(response.trigger, response.actions);
    console.log(`Added automated response for: ${response.trigger}`);
  }

  return {
    fraudPrevention: fraudPrevention.address,
    anomalyDetection: fraudConfig.anomalyDetection ? anomalyDetection.address : null
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
