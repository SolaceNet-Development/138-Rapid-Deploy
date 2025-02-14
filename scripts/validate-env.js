#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

// Required environment variables and their validation rules
const ENV_RULES = {
  // Network configuration
  INFURA_API_KEY: {
    required: true,
    validate: (value) => value.length === 32,
    error: 'Invalid Infura API key format'
  },
  NETWORK_ID: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Network ID must be a positive number'
  },
  RPC_URL: {
    required: true,
    validate: (value) => value.startsWith('http') || value.startsWith('ws'),
    error: 'Invalid RPC URL format'
  },
  CHAIN_ID: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Invalid chain ID'
  },
  
  // Contract deployment
  PRIVATE_KEY: {
    required: true,
    validate: (value) => {
      try {
        return ethers.utils.isHexString(value, 32);
      } catch {
        return false;
      }
    },
    error: 'Invalid private key format'
  },
  ETHERSCAN_API_KEY: {
    required: true,
    validate: (value) => value.length === 34,
    error: 'Invalid Etherscan API key format'
  },
  DEPLOYER_ADDRESS: {
    required: true,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid deployer address'
  },
  
  // Bridge configuration
  BRIDGE_TOKEN_ADDRESS: {
    required: true,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid token contract address'
  },
  BRIDGE_FEE_BPS: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 0 && parseInt(value) <= 10000,
    error: 'Bridge fee must be between 0 and 10000 basis points'
  },
  BRIDGE_ADMIN_ADDRESS: {
    required: true,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid bridge admin address'
  },
  BRIDGE_VALIDATOR_ADDRESSES: {
    required: true,
    validate: (value) => {
      try {
        const addresses = JSON.parse(value);
        return Array.isArray(addresses) && addresses.every(addr => ethers.utils.isAddress(addr));
      } catch {
        return false;
      }
    },
    error: 'Invalid validator addresses array'
  },
  
  // Security
  MIN_TRANSFER_AMOUNT: {
    required: true,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0,
    error: 'Minimum transfer amount must be greater than 0'
  },
  MAX_TRANSFER_AMOUNT: {
    required: true,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0,
    error: 'Maximum transfer amount must be greater than 0'
  },
  EMERGENCY_ADMIN_ADDRESS: {
    required: true,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid emergency admin address'
  },
  TIMELOCK_DELAY: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 3600,
    error: 'Timelock delay must be at least 1 hour'
  },
  
  // Monitoring
  ALERT_WEBHOOK_URL: {
    required: false,
    validate: (value) => value.startsWith('https://'),
    error: 'Invalid webhook URL format'
  },
  MONITORING_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 60,
    error: 'Monitoring interval must be at least 60 seconds'
  },
  SLACK_WEBHOOK_URL: {
    required: false,
    validate: (value) => value.startsWith('https://hooks.slack.com/'),
    error: 'Invalid Slack webhook URL'
  },
  DISCORD_WEBHOOK_URL: {
    required: false,
    validate: (value) => value.startsWith('https://discord.com/api/webhooks/'),
    error: 'Invalid Discord webhook URL'
  },
  ALERT_EMAIL: {
    required: false,
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    error: 'Invalid email format'
  },
  
  // Performance & Scaling
  MAX_GAS_PRICE: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Invalid max gas price'
  },
  GAS_PRICE_BUFFER: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 110 && parseInt(value) <= 200,
    error: 'Gas price buffer must be between 110% and 200%'
  },
  MAX_CONCURRENT_REQUESTS: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Invalid max concurrent requests'
  },
  RATE_LIMIT_PER_SECOND: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Invalid rate limit'
  },
  
  // Database & Storage
  DATABASE_URL: {
    required: true,
    validate: (value) => value.startsWith('postgresql://'),
    error: 'Invalid PostgreSQL database URL'
  },
  REDIS_URL: {
    required: false,
    validate: (value) => value.startsWith('redis://'),
    error: 'Invalid Redis URL'
  },
  IPFS_NODE: {
    required: false,
    validate: (value) => value.startsWith('http') || value.startsWith('ipfs://'),
    error: 'Invalid IPFS node URL'
  },
  
  // API & External Services
  ALCHEMY_API_KEY: {
    required: false,
    validate: (value) => value.length === 32,
    error: 'Invalid Alchemy API key'
  },
  CHAINLINK_NODE_ADDRESS: {
    required: false,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid Chainlink node address'
  },
  GRAPH_API_KEY: {
    required: false,
    validate: (value) => value.length === 32,
    error: 'Invalid Graph API key'
  },

  // Network monitoring
  MAX_BLOCK_TIME: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 2 && parseInt(value) <= 60,
    error: 'Block time must be between 2 and 60 seconds'
  },
  MIN_PEER_COUNT: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 3,
    error: 'Minimum peer count must be at least 3'
  },
  MAX_NETWORK_LATENCY: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 100 && parseInt(value) <= 5000,
    error: 'Network latency must be between 100ms and 5000ms'
  },
  MAX_PENDING_TRANSACTIONS: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Maximum pending transactions must be greater than 0'
  },
  NETWORK_MONITORING_INTERVAL: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 15,
    error: 'Network monitoring interval must be at least 15 seconds'
  },

  // Validator monitoring
  VALIDATOR_CONTRACT_ADDRESS: {
    required: true,
    validate: (value) => ethers.utils.isAddress(value),
    error: 'Invalid validator contract address'
  },
  MIN_ACTIVE_VALIDATORS: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 3,
    error: 'Minimum active validators must be at least 3'
  },
  VALIDATOR_MISSED_BLOCKS_THRESHOLD: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Validator missed blocks threshold must be greater than 0'
  },
  VALIDATOR_INACTIVITY_THRESHOLD: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Validator inactivity threshold must be greater than 0'
  },
  VALIDATOR_PERFORMANCE_THRESHOLD: {
    required: true,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0 && parseFloat(value) <= 1,
    error: 'Validator performance threshold must be between 0 and 1'
  },
  VALIDATOR_MONITORING_INTERVAL: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 30,
    error: 'Validator monitoring interval must be at least 30 seconds'
  },

  // Metrics & Monitoring
  PROMETHEUS_PUSH_GATEWAY: {
    required: false,
    validate: (value) => value.startsWith('http'),
    error: 'Invalid Prometheus push gateway URL'
  },
  GRAFANA_API_KEY: {
    required: false,
    validate: (value) => value.length >= 32,
    error: 'Invalid Grafana API key'
  },
  GRAFANA_DASHBOARD_ID: {
    required: false,
    validate: (value) => value.length > 0,
    error: 'Invalid Grafana dashboard ID'
  },
  ALERT_SEVERITY_LEVELS: {
    required: false,
    validate: (value) => {
      try {
        const levels = JSON.parse(value);
        return Array.isArray(levels) && levels.every(l => typeof l === 'string');
      } catch {
        return false;
      }
    },
    error: 'Invalid alert severity levels array'
  },

  // Performance Tuning
  NODE_OPTIONS: {
    required: false,
    validate: (value) => value.includes('--max-old-space-size='),
    error: 'Node memory limit not configured'
  },
  CACHE_SIZE_MB: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 512,
    error: 'Cache size must be at least 512 MB'
  },
  DB_POOL_SIZE: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0 && parseInt(value) <= 100,
    error: 'Database pool size must be between 1 and 100'
  },
  DB_IDLE_TIMEOUT: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 1000,
    error: 'Database idle timeout must be at least 1000ms'
  },

  // Security & Rate Limiting
  JWT_SECRET: {
    required: true,
    validate: (value) => value.length >= 32,
    error: 'JWT secret must be at least 32 characters'
  },
  API_RATE_LIMIT: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'API rate limit must be greater than 0'
  },
  API_RATE_WINDOW: {
    required: true,
    validate: (value) => !isNaN(value) && parseInt(value) >= 60000,
    error: 'API rate window must be at least 60000ms (1 minute)'
  },
  IP_WHITELIST: {
    required: false,
    validate: (value) => {
      try {
        const ips = JSON.parse(value);
        return Array.isArray(ips) && ips.every(ip => /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(ip));
      } catch {
        return false;
      }
    },
    error: 'Invalid IP whitelist format'
  },

  // Backup & Recovery
  BACKUP_ENABLED: {
    required: false,
    validate: (value) => value === 'true' || value === 'false',
    error: 'Backup enabled must be true or false'
  },
  BACKUP_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 3600,
    error: 'Backup interval must be at least 3600 seconds (1 hour)'
  },
  BACKUP_RETENTION_DAYS: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Backup retention must be greater than 0 days'
  },
  BACKUP_PATH: {
    required: false,
    validate: (value) => value.startsWith('/') || value.startsWith('./'),
    error: 'Invalid backup path format'
  },

  // Resource Monitoring
  CPU_USAGE_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0 && parseFloat(value) <= 100,
    error: 'CPU usage threshold must be between 0 and 100 percent'
  },
  CPU_TEMP_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0 && parseFloat(value) <= 100,
    error: 'CPU temperature threshold must be between 0 and 100 degrees Celsius'
  },
  MEMORY_USAGE_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0 && parseFloat(value) <= 100,
    error: 'Memory usage threshold must be between 0 and 100 percent'
  },
  DISK_USAGE_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) > 0 && parseFloat(value) <= 100,
    error: 'Disk usage threshold must be between 0 and 100 percent'
  },
  DISK_IOPS_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Disk IOPS threshold must be greater than 0'
  },
  API_RESPONSE_TIME_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'API response time threshold must be greater than 0 milliseconds'
  },
  API_ERROR_RATE_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) >= 0 && parseFloat(value) <= 100,
    error: 'API error rate threshold must be between 0 and 100 percent'
  },
  API_ENDPOINTS: {
    required: false,
    validate: (value) => {
      try {
        const endpoints = JSON.parse(value);
        return Array.isArray(endpoints) && endpoints.every(url => url.startsWith('http'));
      } catch {
        return false;
      }
    },
    error: 'API endpoints must be a JSON array of valid URLs'
  },
  RESOURCE_MONITORING_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 15,
    error: 'Resource monitoring interval must be at least 15 seconds'
  },
  
  // System Metrics
  SYSTEM_METRICS_ENABLED: {
    required: false,
    validate: (value) => value === 'true' || value === 'false',
    error: 'System metrics enabled must be true or false'
  },
  SYSTEM_METRICS_RETENTION_DAYS: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'System metrics retention must be greater than 0 days'
  },
  SYSTEM_METRICS_AGGREGATION_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 300,
    error: 'System metrics aggregation interval must be at least 300 seconds (5 minutes)'
  },

  // API Rate Limiting
  API_CONCURRENT_REQUESTS_LIMIT: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'API concurrent requests limit must be greater than 0'
  },
  API_BURST_LIMIT: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'API burst limit must be greater than 0'
  },
  API_THROTTLE_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 1000,
    error: 'API throttle interval must be at least 1000 milliseconds'
  },

  // Network Monitoring
  NETWORK_LATENCY_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Network latency threshold must be greater than 0 milliseconds'
  },
  NETWORK_PACKET_LOSS_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseFloat(value) >= 0 && parseFloat(value) <= 100,
    error: 'Network packet loss threshold must be between 0 and 100 percent'
  },
  NETWORK_BANDWIDTH_THRESHOLD: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Network bandwidth threshold must be greater than 0 bytes per second'
  },

  // Log Management
  LOG_RETENTION_DAYS: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Log retention must be greater than 0 days'
  },
  LOG_LEVEL: {
    required: false,
    validate: (value) => ['error', 'warn', 'info', 'debug', 'trace'].includes(value.toLowerCase()),
    error: 'Invalid log level'
  },
  LOG_FORMAT: {
    required: false,
    validate: (value) => ['json', 'text', 'pretty'].includes(value.toLowerCase()),
    error: 'Invalid log format'
  },

  // Security Monitoring
  SECURITY_SCAN_INTERVAL: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) >= 3600,
    error: 'Security scan interval must be at least 3600 seconds (1 hour)'
  },
  SECURITY_ALERT_THRESHOLD: {
    required: false,
    validate: (value) => ['low', 'medium', 'high', 'critical'].includes(value.toLowerCase()),
    error: 'Invalid security alert threshold'
  },
  SECURITY_SCAN_DEPTH: {
    required: false,
    validate: (value) => !isNaN(value) && parseInt(value) > 0,
    error: 'Security scan depth must be greater than 0'
  }
};

class EnvironmentValidator {
  constructor(envPath = '.env') {
    this.envPath = envPath;
    this.errors = [];
    this.warnings = [];
  }

  loadEnvFile() {
    try {
      if (fs.existsSync(this.envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(this.envPath));
        for (const [key, value] of Object.entries(envConfig)) {
          process.env[key] = value;
        }
      } else {
        this.warnings.push(`Environment file ${this.envPath} not found`);
      }
    } catch (error) {
      this.errors.push(`Error loading environment file: ${error.message}`);
    }
  }

  validateEnvironment() {
    for (const [key, rules] of Object.entries(ENV_RULES)) {
      const value = process.env[key];

      // Check if required
      if (rules.required && !value) {
        this.errors.push(`Missing required environment variable: ${key}`);
        continue;
      }

      // Skip validation if value is not provided and not required
      if (!value) {
        continue;
      }

      // Validate value format
      if (rules.validate && !rules.validate(value)) {
        this.errors.push(`${rules.error} for ${key}: ${value}`);
      }
    }

    // Additional cross-field validations
    this.validateCrossFieldRules();
  }

  validateCrossFieldRules() {
    // Validate transfer amount range
    const minTransfer = parseFloat(process.env.MIN_TRANSFER_AMOUNT);
    const maxTransfer = parseFloat(process.env.MAX_TRANSFER_AMOUNT);
    if (minTransfer && maxTransfer && minTransfer >= maxTransfer) {
      this.errors.push('MIN_TRANSFER_AMOUNT must be less than MAX_TRANSFER_AMOUNT');
    }

    // Validate network configuration
    if (process.env.NETWORK_ID === '1' && !process.env.ALERT_WEBHOOK_URL) {
      this.warnings.push('Alert webhook URL is recommended for mainnet deployment');
    }

    // Validate gas price configuration
    const maxGasPrice = parseInt(process.env.MAX_GAS_PRICE);
    const gasPriceBuffer = parseInt(process.env.GAS_PRICE_BUFFER);
    if (maxGasPrice && gasPriceBuffer) {
      const effectiveMaxGas = maxGasPrice * (gasPriceBuffer / 100);
      if (effectiveMaxGas > 500e9) { // 500 Gwei
        this.warnings.push('Effective max gas price is very high');
      }
    }

    // Validate monitoring configuration
    if (process.env.NETWORK_ID === '1') {
      const hasAlerts = process.env.SLACK_WEBHOOK_URL || 
                       process.env.DISCORD_WEBHOOK_URL || 
                       process.env.ALERT_EMAIL;
      if (!hasAlerts) {
        this.warnings.push('No alert channels configured for mainnet');
      }
    }

    // Validate scaling configuration
    const maxRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS);
    const rateLimit = parseInt(process.env.RATE_LIMIT_PER_SECOND);
    if (maxRequests && rateLimit && maxRequests > rateLimit) {
      this.warnings.push('MAX_CONCURRENT_REQUESTS should not exceed RATE_LIMIT_PER_SECOND');
    }
  }

  generateEnvTemplate() {
    const template = Object.entries(ENV_RULES)
      .map(([key, rules]) => {
        const required = rules.required ? '(Required)' : '(Optional)';
        return `# ${key} ${required}\n# ${rules.error}\n${key}=\n`;
      })
      .join('\n');

    fs.writeFileSync('.env.example', template);
  }

  validateAndReport() {
    this.loadEnvFile();
    this.validateEnvironment();

    if (this.errors.length > 0) {
      console.error('❌ Environment validation failed:');
      this.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️ Environment validation warnings:');
      this.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    console.log('✅ Environment validation passed');
    return true;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.validateAndReport();
  
  // Generate template if it doesn't exist
  if (!fs.existsSync('.env.example')) {
    validator.generateEnvTemplate();
    console.log('📝 Generated .env.example template file');
  }
} 