#!/usr/bin/env node

const os = require('os');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fetch = require('node-fetch');

class ResourceMonitor {
    constructor() {
        this.metrics = {
            cpu: {
                usage: 0,
                loadAverage: [],
                temperature: 0
            },
            memory: {
                total: 0,
                used: 0,
                free: 0,
                cached: 0
            },
            disk: {
                total: 0,
                used: 0,
                free: 0,
                iops: 0
            },
            network: {
                bytesIn: 0,
                bytesOut: 0,
                connections: 0,
                latency: {}
            },
            api: {
                responseTime: {},
                errorRate: {},
                requestCount: {},
                activeConnections: 0
            }
        };

        this.thresholds = {
            cpu: {
                usage: parseFloat(process.env.CPU_USAGE_THRESHOLD || 80),
                temperature: parseFloat(process.env.CPU_TEMP_THRESHOLD || 70)
            },
            memory: {
                usage: parseFloat(process.env.MEMORY_USAGE_THRESHOLD || 85)
            },
            disk: {
                usage: parseFloat(process.env.DISK_USAGE_THRESHOLD || 85),
                iops: parseFloat(process.env.DISK_IOPS_THRESHOLD || 1000)
            },
            api: {
                responseTime: parseFloat(process.env.API_RESPONSE_TIME_THRESHOLD || 1000),
                errorRate: parseFloat(process.env.API_ERROR_RATE_THRESHOLD || 5)
            }
        };
    }

    async initialize() {
        // Initialize system metrics
        this.metrics.memory.total = os.totalmem();
        
        // Get initial disk metrics
        await this.updateDiskMetrics();
        
        // Initialize API endpoints to monitor
        this.apiEndpoints = process.env.API_ENDPOINTS ? 
            JSON.parse(process.env.API_ENDPOINTS) : 
            ['http://localhost:3000/health'];
            
        console.log('Resource monitor initialized');
    }

    async monitorResources() {
        while (true) {
            try {
                await this.updateMetrics();
                await this.checkAlerts();
                await this.reportMetrics();
                
                // Wait before next update
                await new Promise(resolve => setTimeout(resolve, 
                    parseInt(process.env.RESOURCE_MONITORING_INTERVAL) * 1000 || 30000
                ));
            } catch (error) {
                console.error('Error monitoring resources:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async updateMetrics() {
        // Update CPU metrics
        const cpuUsage = await this.getCPUUsage();
        this.metrics.cpu.usage = cpuUsage;
        this.metrics.cpu.loadAverage = os.loadavg();
        this.metrics.cpu.temperature = await this.getCPUTemperature();

        // Update memory metrics
        const freemem = os.freemem();
        this.metrics.memory.used = this.metrics.memory.total - freemem;
        this.metrics.memory.free = freemem;
        
        // Update disk metrics
        await this.updateDiskMetrics();
        
        // Update network metrics
        await this.updateNetworkMetrics();
        
        // Update API metrics
        await this.updateAPIMetrics();
    }

    async getCPUUsage() {
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        return (endUsage.user + endUsage.system) / 1000000 * 100;
    }

    async getCPUTemperature() {
        try {
            const { stdout } = await exec('sensors -j');
            const data = JSON.parse(stdout);
            // Extract CPU temperature from sensors output
            // This is system-dependent and may need adjustment
            return data.coretemp?.[0]?.['Core 0']?.temp1_input || 0;
        } catch (error) {
            console.warn('Could not get CPU temperature:', error.message);
            return 0;
        }
    }

    async updateDiskMetrics() {
        try {
            const { stdout } = await exec('df -k /');
            const lines = stdout.trim().split('\n');
            const [, stats] = lines;
            const [, total, used, free] = stats.split(/\s+/);
            
            this.metrics.disk.total = parseInt(total) * 1024;
            this.metrics.disk.used = parseInt(used) * 1024;
            this.metrics.disk.free = parseInt(free) * 1024;
            
            // Get IOPS
            const { stdout: iostat } = await exec('iostat -x 1 1');
            const iostatLines = iostat.trim().split('\n');
            this.metrics.disk.iops = parseFloat(iostatLines[3].split(/\s+/)[3]);
        } catch (error) {
            console.warn('Could not update disk metrics:', error.message);
        }
    }

    async updateNetworkMetrics() {
        try {
            const { stdout } = await exec('netstat -i');
            const lines = stdout.trim().split('\n');
            let totalIn = 0;
            let totalOut = 0;
            
            for (let i = 2; i < lines.length; i++) {
                const [, , , , in_bytes, out_bytes] = lines[i].split(/\s+/);
                totalIn += parseInt(in_bytes);
                totalOut += parseInt(out_bytes);
            }
            
            this.metrics.network.bytesIn = totalIn;
            this.metrics.network.bytesOut = totalOut;
            
            // Get active connections
            const { stdout: connections } = await exec('netstat -an | grep ESTABLISHED | wc -l');
            this.metrics.network.connections = parseInt(connections);
            
            // Measure network latency
            for (const endpoint of this.apiEndpoints) {
                const startTime = Date.now();
                await fetch(endpoint);
                this.metrics.network.latency[endpoint] = Date.now() - startTime;
            }
        } catch (error) {
            console.warn('Could not update network metrics:', error.message);
        }
    }

    async updateAPIMetrics() {
        for (const endpoint of this.apiEndpoints) {
            try {
                const startTime = Date.now();
                const response = await fetch(endpoint);
                const responseTime = Date.now() - startTime;
                
                // Update metrics
                this.metrics.api.responseTime[endpoint] = responseTime;
                this.metrics.api.requestCount[endpoint] = 
                    (this.metrics.api.requestCount[endpoint] || 0) + 1;
                this.metrics.api.errorRate[endpoint] = 
                    response.ok ? 0 : 100;
            } catch (error) {
                this.metrics.api.errorRate[endpoint] = 100;
                console.warn(`API endpoint ${endpoint} error:`, error.message);
            }
        }
    }

    async checkAlerts() {
        // CPU alerts
        if (this.metrics.cpu.usage > this.thresholds.cpu.usage) {
            await this.sendAlert('High CPU Usage', {
                usage: `${this.metrics.cpu.usage.toFixed(2)}%`,
                threshold: `${this.thresholds.cpu.usage}%`
            });
        }

        if (this.metrics.cpu.temperature > this.thresholds.cpu.temperature) {
            await this.sendAlert('High CPU Temperature', {
                temperature: `${this.metrics.cpu.temperature}°C`,
                threshold: `${this.thresholds.cpu.temperature}°C`
            });
        }

        // Memory alerts
        const memoryUsagePercent = (this.metrics.memory.used / this.metrics.memory.total) * 100;
        if (memoryUsagePercent > this.thresholds.memory.usage) {
            await this.sendAlert('High Memory Usage', {
                usage: `${memoryUsagePercent.toFixed(2)}%`,
                threshold: `${this.thresholds.memory.usage}%`
            });
        }

        // Disk alerts
        const diskUsagePercent = (this.metrics.disk.used / this.metrics.disk.total) * 100;
        if (diskUsagePercent > this.thresholds.disk.usage) {
            await this.sendAlert('High Disk Usage', {
                usage: `${diskUsagePercent.toFixed(2)}%`,
                threshold: `${this.thresholds.disk.usage}%`
            });
        }

        // API alerts
        for (const endpoint of this.apiEndpoints) {
            const responseTime = this.metrics.api.responseTime[endpoint];
            if (responseTime > this.thresholds.api.responseTime) {
                await this.sendAlert('High API Response Time', {
                    endpoint,
                    responseTime: `${responseTime}ms`,
                    threshold: `${this.thresholds.api.responseTime}ms`
                });
            }

            const errorRate = this.metrics.api.errorRate[endpoint];
            if (errorRate > this.thresholds.api.errorRate) {
                await this.sendAlert('High API Error Rate', {
                    endpoint,
                    errorRate: `${errorRate}%`,
                    threshold: `${this.thresholds.api.errorRate}%`
                });
            }
        }
    }

    async sendAlert(type, data) {
        const timestamp = new Date().toISOString();
        const alert = {
            type,
            data,
            timestamp
        };

        // Send to configured alert channels
        if (process.env.SLACK_WEBHOOK_URL) {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚨 *${type}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                })
            });
        }

        if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `🚨 **${type}**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
                })
            });
        }

        // Log alert
        console.log(`[RESOURCE ALERT] ${type}:`, data);
    }

    async reportMetrics() {
        // Output current metrics
        console.log('Resource Metrics:', {
            cpu: {
                usage: `${this.metrics.cpu.usage.toFixed(2)}%`,
                temperature: `${this.metrics.cpu.temperature}°C`,
                loadAverage: this.metrics.cpu.loadAverage
            },
            memory: {
                used: `${(this.metrics.memory.used / 1024 / 1024).toFixed(2)} MB`,
                free: `${(this.metrics.memory.free / 1024 / 1024).toFixed(2)} MB`,
                total: `${(this.metrics.memory.total / 1024 / 1024).toFixed(2)} MB`
            },
            disk: {
                used: `${(this.metrics.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(this.metrics.disk.free / 1024 / 1024 / 1024).toFixed(2)} GB`,
                iops: this.metrics.disk.iops
            },
            network: {
                connections: this.metrics.network.connections,
                latency: this.metrics.network.latency
            },
            api: {
                responseTime: this.metrics.api.responseTime,
                errorRate: this.metrics.api.errorRate
            }
        });

        // Push to Prometheus if configured
        if (process.env.PROMETHEUS_PUSH_GATEWAY) {
            await this.pushMetricsToPrometheus();
        }
    }

    async pushMetricsToPrometheus() {
        const metrics = {
            'cpu_usage': this.metrics.cpu.usage,
            'cpu_temperature': this.metrics.cpu.temperature,
            'memory_used_bytes': this.metrics.memory.used,
            'memory_free_bytes': this.metrics.memory.free,
            'disk_used_bytes': this.metrics.disk.used,
            'disk_free_bytes': this.metrics.disk.free,
            'disk_iops': this.metrics.disk.iops,
            'network_connections': this.metrics.network.connections
        };

        // Add API metrics
        for (const endpoint of this.apiEndpoints) {
            const endpointKey = endpoint.replace(/[^a-zA-Z0-9]/g, '_');
            metrics[`api_response_time_${endpointKey}`] = this.metrics.api.responseTime[endpoint];
            metrics[`api_error_rate_${endpointKey}`] = this.metrics.api.errorRate[endpoint];
        }

        try {
            await fetch(process.env.PROMETHEUS_PUSH_GATEWAY, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: Object.entries(metrics)
                    .map(([key, value]) => `${key} ${value}`)
                    .join('\n')
            });
        } catch (error) {
            console.error('Error pushing metrics to Prometheus:', error);
        }
    }
}

async function main() {
    // Initialize monitor
    const monitor = new ResourceMonitor();
    await monitor.initialize();
    
    // Start monitoring
    await monitor.monitorResources();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ResourceMonitor; 