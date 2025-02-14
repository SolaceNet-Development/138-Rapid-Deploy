#!/usr/bin/env node

const { EventEmitter } = require('events');

class AlertCorrelation extends EventEmitter {
    constructor() {
        super();
        this.alertPatterns = new Map();
        this.alertHistory = [];
        this.correlationRules = new Map();
        this.activeCorrelations = new Map();

        // Initialize default correlation rules
        this.initializeDefaultRules();
    }

    initializeDefaultRules() {
        // Rule: Multiple failed transfers from same address
        this.addCorrelationRule('repeated-failures', {
            condition: (alerts) => {
                const failedTransfers = alerts.filter(a => 
                    a.type === 'Transfer Failed' && 
                    Date.now() - a.timestamp < 3600000 // Last hour
                );
                
                const addressCounts = new Map();
                failedTransfers.forEach(alert => {
                    const address = alert.data.from;
                    addressCounts.set(address, (addressCounts.get(address) || 0) + 1);
                });

                return Array.from(addressCounts.entries())
                    .filter(([_, count]) => count >= 3)
                    .map(([address, count]) => ({
                        address,
                        count,
                        severity: count >= 5 ? 'high' : 'medium'
                    }));
            },
            action: async (results) => {
                for (const result of results) {
                    await this.emit('correlated-alert', {
                        type: 'Repeated Transfer Failures',
                        data: {
                            address: result.address,
                            failureCount: result.count,
                            timeWindow: '1 hour',
                            severity: result.severity
                        }
                    });
                }
            }
        });

        // Rule: Bridge congestion detection
        this.addCorrelationRule('bridge-congestion', {
            condition: (alerts) => {
                const congestionIndicators = alerts.filter(a => 
                    (a.type === 'High Pending Transfers' || 
                     a.type === 'High Completion Time' || 
                     a.type === 'Stuck Transfer') &&
                    Date.now() - a.timestamp < 900000 // Last 15 minutes
                );

                if (congestionIndicators.length >= 3) {
                    const severity = congestionIndicators.length >= 5 ? 'critical' : 'high';
                    return [{
                        indicators: congestionIndicators.length,
                        types: [...new Set(congestionIndicators.map(a => a.type))],
                        severity
                    }];
                }
                return [];
            },
            action: async (results) => {
                for (const result of results) {
                    await this.emit('correlated-alert', {
                        type: 'Bridge Congestion Detected',
                        data: {
                            indicatorCount: result.indicators,
                            indicatorTypes: result.types,
                            severity: result.severity
                        }
                    });
                }
            }
        });

        // Rule: Security incident detection
        this.addCorrelationRule('security-incident', {
            condition: (alerts) => {
                const securityAlerts = alerts.filter(a => 
                    (a.type === 'Large Transfer Detected' || 
                     a.type === 'Suspicious Repeated Calls' ||
                     a.type === 'Contract Deployment') &&
                    Date.now() - a.timestamp < 300000 // Last 5 minutes
                );

                const addressSet = new Set(securityAlerts.map(a => a.data.from || a.data.recipient));
                if (securityAlerts.length >= 2 && addressSet.size <= 2) {
                    return [{
                        alerts: securityAlerts,
                        addresses: Array.from(addressSet),
                        severity: 'critical'
                    }];
                }
                return [];
            },
            action: async (results) => {
                for (const result of results) {
                    await this.emit('correlated-alert', {
                        type: 'Potential Security Incident',
                        data: {
                            relatedAlerts: result.alerts.map(a => ({
                                type: a.type,
                                timestamp: a.timestamp
                            })),
                            involvedAddresses: result.addresses,
                            severity: result.severity
                        }
                    });
                }
            }
        });

        // Rule: System health correlation
        this.addCorrelationRule('system-health', {
            condition: (alerts) => {
                const healthAlerts = alerts.filter(a => 
                    (a.type === 'High CPU Usage' || 
                     a.type === 'High Memory Usage' ||
                     a.type === 'High Disk Usage' ||
                     a.type === 'API Error Rate High') &&
                    Date.now() - a.timestamp < 600000 // Last 10 minutes
                );

                if (healthAlerts.length >= 2) {
                    return [{
                        alerts: healthAlerts,
                        severity: healthAlerts.length >= 3 ? 'critical' : 'high'
                    }];
                }
                return [];
            },
            action: async (results) => {
                for (const result of results) {
                    await this.emit('correlated-alert', {
                        type: 'System Health Degradation',
                        data: {
                            affectedSystems: result.alerts.map(a => a.type),
                            alertCount: result.alerts.length,
                            severity: result.severity
                        }
                    });
                }
            }
        });
    }

    addCorrelationRule(name, rule) {
        this.correlationRules.set(name, rule);
    }

    async processAlert(alert) {
        // Add timestamp if not present
        if (!alert.timestamp) {
            alert.timestamp = Date.now();
        }

        // Add to history
        this.alertHistory.push(alert);

        // Clean up old alerts (keep last 24 hours)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);

        // Update alert patterns
        this.updateAlertPatterns(alert);

        // Check correlation rules
        await this.checkCorrelations();
    }

    updateAlertPatterns(alert) {
        const key = `${alert.type}-${JSON.stringify(alert.data)}`;
        const pattern = this.alertPatterns.get(key) || {
            count: 0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            occurrences: []
        };

        pattern.count++;
        pattern.lastSeen = Date.now();
        pattern.occurrences.push(Date.now());

        // Keep only last 100 occurrences
        if (pattern.occurrences.length > 100) {
            pattern.occurrences.shift();
        }

        this.alertPatterns.set(key, pattern);
    }

    async checkCorrelations() {
        for (const [name, rule] of this.correlationRules.entries()) {
            try {
                const results = rule.condition(this.alertHistory);
                if (results && results.length > 0) {
                    const correlationKey = `${name}-${JSON.stringify(results)}`;
                    
                    // Check if this correlation was recently triggered
                    if (!this.activeCorrelations.has(correlationKey)) {
                        await rule.action(results);
                        
                        // Add to active correlations with expiry
                        this.activeCorrelations.set(correlationKey, Date.now());
                        
                        // Clean up old correlations after cooldown
                        setTimeout(() => {
                            this.activeCorrelations.delete(correlationKey);
                        }, parseInt(process.env.CORRELATION_COOLDOWN_PERIOD || '3600000'));
                    }
                }
            } catch (error) {
                console.error(`Error in correlation rule ${name}:`, error);
            }
        }
    }

    getAlertPatterns() {
        return Array.from(this.alertPatterns.entries()).map(([key, pattern]) => ({
            pattern: key,
            ...pattern
        }));
    }

    getActiveCorrelations() {
        return Array.from(this.activeCorrelations.entries()).map(([key, timestamp]) => ({
            correlation: key,
            timestamp
        }));
    }

    addCustomRule(name, options) {
        const {
            timeWindow = 3600000,
            minOccurrences = 1,
            maxOccurrences = Infinity,
            conditions = [],
            severity = 'medium',
            description = '',
            action = async () => {}
        } = options;

        this.addCorrelationRule(name, {
            condition: (alerts) => {
                const relevantAlerts = alerts.filter(a => 
                    Date.now() - a.timestamp < timeWindow &&
                    conditions.every(condition => condition(a))
                );

                if (relevantAlerts.length >= minOccurrences && 
                    relevantAlerts.length <= maxOccurrences) {
                    return [{
                        alerts: relevantAlerts,
                        severity,
                        description
                    }];
                }
                return [];
            },
            action: async (results) => {
                for (const result of results) {
                    await action(result);
                    await this.emit('correlated-alert', {
                        type: name,
                        data: {
                            matchedAlerts: result.alerts.length,
                            description: result.description,
                            severity: result.severity
                        }
                    });
                }
            }
        });
    }
}

// Export singleton instance
const alertCorrelation = new AlertCorrelation();
module.exports = alertCorrelation;

// If running directly, start with example
if (require.main === module) {
    console.log('Alert Correlation initialized');
    
    // Example custom rule
    if (process.env.NODE_ENV === 'development') {
        alertCorrelation.addCustomRule('example-pattern', {
            timeWindow: 300000, // 5 minutes
            minOccurrences: 2,
            conditions: [
                alert => alert.type === 'Test Alert',
                alert => alert.data.severity === 'medium'
            ],
            severity: 'high',
            description: 'Multiple test alerts detected',
            action: async (result) => {
                console.log('Custom rule triggered:', result);
            }
        });

        // Test alert
        alertCorrelation.processAlert({
            type: 'Test Alert',
            data: {
                message: 'This is a test alert',
                severity: 'medium'
            }
        });
    }
} 