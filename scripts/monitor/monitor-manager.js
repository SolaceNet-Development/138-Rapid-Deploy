#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MonitorManager {
  constructor() {
    this.monitors = new Map();
    this.restartAttempts = new Map();
    this.maxRestarts = 5;
    this.restartDelay = 5000;

    // Initialize monitor definitions
    this.monitorDefs = [
      {
        name: 'network',
        script: 'check-network-health.js',
        enabled: true,
        critical: true
      },
      {
        name: 'validators',
        script: 'monitor-validators.js',
        enabled: true,
        critical: true
      },
      {
        name: 'resources',
        script: 'monitor-resources.js',
        enabled: true,
        critical: false
      },
      {
        name: 'security',
        script: 'monitor-security.js',
        enabled: true,
        critical: true
      }
    ];
  }

  async start() {
    console.log('Starting monitoring system...');

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Start each monitor
    for (const def of this.monitorDefs) {
      if (def.enabled) {
        await this.startMonitor(def);
      }
    }

    // Setup process handlers
    this.setupProcessHandlers();

    console.log('All monitors started');
  }

  async startMonitor(def) {
    const scriptPath = path.join(__dirname, def.script);

    // Create log streams
    const logFile = path.join(__dirname, '../../logs', `${def.name}.log`);
    const errorFile = path.join(__dirname, '../../logs', `${def.name}.error.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    const errorStream = fs.createWriteStream(errorFile, { flags: 'a' });

    // Spawn monitor process
    const monitor = spawn('node', [scriptPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Setup logging
    monitor.stdout.pipe(logStream);
    monitor.stderr.pipe(errorStream);

    // Initialize restart attempts
    this.restartAttempts.set(def.name, 0);

    // Setup event handlers
    monitor.on('error', (error) => {
      console.error(`Monitor ${def.name} error:`, error);
      this.handleMonitorError(def);
    });

    monitor.on('exit', (code, signal) => {
      console.log(`Monitor ${def.name} exited with code ${code} and signal ${signal}`);
      this.handleMonitorExit(def, code);
    });

    // Store monitor process
    this.monitors.set(def.name, {
      process: monitor,
      def,
      logStream,
      errorStream
    });

    console.log(`Started monitor: ${def.name}`);
  }

  async handleMonitorError(def) {
    console.error(`Error in monitor ${def.name}`);
    await this.restartMonitor(def);
  }

  async handleMonitorExit(def, code) {
    if (code !== 0) {
      console.error(`Monitor ${def.name} exited with code ${code}`);
      await this.restartMonitor(def);
    }
  }

  async restartMonitor(def) {
    const attempts = this.restartAttempts.get(def.name) || 0;

    if (attempts >= this.maxRestarts) {
      console.error(`Monitor ${def.name} failed to restart after ${attempts} attempts`);
      if (def.critical) {
        console.error('Critical monitor failed, shutting down monitoring system');
        await this.shutdown();
        process.exit(1);
      }
      return;
    }

    console.log(`Restarting monitor ${def.name} (attempt ${attempts + 1}/${this.maxRestarts})`);
    this.restartAttempts.set(def.name, attempts + 1);

    // Wait before restarting
    await new Promise((resolve) => setTimeout(resolve, this.restartDelay));

    // Stop existing monitor if it's still running
    await this.stopMonitor(def.name);

    // Start new monitor
    await this.startMonitor(def);
  }

  async stopMonitor(name) {
    const monitor = this.monitors.get(name);
    if (!monitor) return;

    // Close streams
    monitor.logStream.end();
    monitor.errorStream.end();

    // Kill process
    monitor.process.kill();
    this.monitors.delete(name);
  }

  setupProcessHandlers() {
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  async shutdown() {
    console.log('Shutting down monitoring system...');

    // Stop all monitors
    for (const [name] of this.monitors) {
      await this.stopMonitor(name);
    }

    console.log('All monitors stopped');
  }

  async getStatus() {
    const status = {
      monitors: {},
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    for (const [name, monitor] of this.monitors) {
      status.monitors[name] = {
        running: !monitor.process.killed,
        pid: monitor.process.pid,
        restarts: this.restartAttempts.get(name) || 0,
        critical: monitor.def.critical
      };
    }

    return status;
  }
}

async function main() {
  const manager = new MonitorManager();
  await manager.start();

  // Periodically log status
  setInterval(async () => {
    const status = await manager.getStatus();
    console.log('Monitor Status:', JSON.stringify(status, null, 2));
  }, 60000);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MonitorManager;
