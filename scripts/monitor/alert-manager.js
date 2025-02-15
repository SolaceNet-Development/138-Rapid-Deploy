#!/usr/bin/env node

const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const { PagerDuty } = require('@pagerduty/pdjs');

class AlertManager {
  constructor() {
    this.alerts = [];
    this.escalations = new Map();
    this.acknowledgedAlerts = new Set();
    this.resolvedAlerts = new Set();

    // Initialize severity levels
    this.severityLevels = {
      critical: {
        priority: 1,
        timeout: 5 * 60 * 1000, // 5 minutes
        escalationPath: ['slack', 'email', 'pagerduty'],
        autoEscalate: true
      },
      high: {
        priority: 2,
        timeout: 15 * 60 * 1000, // 15 minutes
        escalationPath: ['slack', 'email'],
        autoEscalate: true
      },
      medium: {
        priority: 3,
        timeout: 30 * 60 * 1000, // 30 minutes
        escalationPath: ['slack'],
        autoEscalate: false
      },
      low: {
        priority: 4,
        timeout: 60 * 60 * 1000, // 1 hour
        escalationPath: ['slack'],
        autoEscalate: false
      }
    };

    // Initialize notification channels
    this.channels = {
      slack: {
        enabled: !!process.env.SLACK_WEBHOOK_URL,
        webhooks: {
          critical: process.env.SLACK_CRITICAL_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL,
          high: process.env.SLACK_HIGH_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL,
          medium: process.env.SLACK_MEDIUM_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL,
          low: process.env.SLACK_LOW_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL
        }
      },
      discord: {
        enabled: !!process.env.DISCORD_WEBHOOK_URL,
        webhooks: {
          critical: process.env.DISCORD_CRITICAL_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
          high: process.env.DISCORD_HIGH_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
          medium: process.env.DISCORD_MEDIUM_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
          low: process.env.DISCORD_LOW_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL
        }
      },
      email: {
        enabled: !!process.env.SMTP_HOST,
        config: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        recipients: {
          critical: (process.env.EMAIL_CRITICAL_RECIPIENTS || '').split(','),
          high: (process.env.EMAIL_HIGH_RECIPIENTS || '').split(','),
          medium: (process.env.EMAIL_MEDIUM_RECIPIENTS || '').split(','),
          low: (process.env.EMAIL_LOW_RECIPIENTS || '').split(',')
        }
      },
      pagerduty: {
        enabled: !!process.env.PAGERDUTY_API_KEY,
        config: {
          apiKey: process.env.PAGERDUTY_API_KEY,
          serviceId: process.env.PAGERDUTY_SERVICE_ID
        }
      }
    };

    // Initialize email transport if enabled
    if (this.channels.email.enabled) {
      this.emailTransport = nodemailer.createTransport(this.channels.email.config);
    }

    // Initialize PagerDuty client if enabled
    if (this.channels.pagerduty.enabled) {
      this.pagerduty = new PagerDuty(this.channels.pagerduty.config.apiKey);
    }
  }

  async processAlert(alert) {
    const alertId = this.generateAlertId(alert);
    const severity = alert.data.severity || 'low';
    const severityConfig = this.severityLevels[severity];

    // Add alert to tracking
    this.alerts.push({
      id: alertId,
      alert,
      severity,
      timestamp: Date.now(),
      escalationLevel: 0,
      lastEscalation: Date.now(),
      acknowledged: false,
      resolved: false
    });

    // Initial notification
    await this.sendNotifications(alert, severity, 0);

    // Set up escalation if needed
    if (severityConfig.autoEscalate) {
      this.setupEscalation(alertId, severity);
    }

    return alertId;
  }

  generateAlertId(alert) {
    return `${alert.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async sendNotifications(alert, severity, escalationLevel) {
    const severityConfig = this.severityLevels[severity];
    const channels = severityConfig.escalationPath.slice(0, escalationLevel + 1);

    for (const channel of channels) {
      await this.sendToChannel(channel, alert, severity);
    }
  }

  async sendToChannel(channel, alert, severity) {
    try {
      switch (channel) {
        case 'slack':
          await this.sendSlackAlert(alert, severity);
          break;
        case 'discord':
          await this.sendDiscordAlert(alert, severity);
          break;
        case 'email':
          await this.sendEmailAlert(alert, severity);
          break;
        case 'pagerduty':
          await this.sendPagerDutyAlert(alert, severity);
          break;
      }
    } catch (error) {
      console.error(`Error sending ${severity} alert to ${channel}:`, error);
    }
  }

  async sendSlackAlert(alert, severity) {
    if (!this.channels.slack.enabled) return;

    const webhook = this.channels.slack.webhooks[severity];
    const color = this.getAlertColor(severity);
    const emoji = this.getAlertEmoji(severity);

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color,
            title: `${emoji} ${alert.type}`,
            text: `*Severity:* ${severity}\n*Time:* ${new Date().toISOString()}\n\n\`\`\`${JSON.stringify(alert.data, null, 2)}\`\`\``,
            fields: [
              {
                title: 'Actions',
                value: this.getActionButtons(alert.id, severity),
                short: false
              }
            ]
          }
        ]
      })
    });
  }

  async sendDiscordAlert(alert, severity) {
    if (!this.channels.discord.enabled) return;

    const webhook = this.channels.discord.webhooks[severity];
    const color = this.getAlertColor(severity);
    const emoji = this.getAlertEmoji(severity);

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${emoji} ${alert.type}`,
            description: `**Severity:** ${severity}\n**Time:** ${new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(alert.data, null, 2)}\n\`\`\``,
            color: parseInt(color.slice(1), 16),
            fields: [
              {
                name: 'Actions',
                value: this.getActionButtons(alert.id, severity),
                inline: false
              }
            ]
          }
        ]
      })
    });
  }

  async sendEmailAlert(alert, severity) {
    if (!this.channels.email.enabled) return;

    const recipients = this.channels.email.recipients[severity];
    if (!recipients.length) return;

    const emoji = this.getAlertEmoji(severity);
    const subject = `${emoji} [${severity.toUpperCase()}] ${alert.type}`;
    const html = `
            <h2>${alert.type}</h2>
            <p><strong>Severity:</strong> ${severity}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <pre>${JSON.stringify(alert.data, null, 2)}</pre>
            <hr>
            <p>
                <a href="${process.env.DASHBOARD_URL}/alerts/${alert.id}/acknowledge">Acknowledge</a> |
                <a href="${process.env.DASHBOARD_URL}/alerts/${alert.id}/resolve">Resolve</a>
            </p>
        `;

    await this.emailTransport.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(','),
      subject,
      html
    });
  }

  async sendPagerDutyAlert(alert, severity) {
    if (!this.channels.pagerduty.enabled) return;

    await this.pagerduty.incidents.createIncident(this.channels.pagerduty.config.serviceId, {
      incident: {
        type: 'incident',
        title: alert.type,
        urgency: severity === 'critical' ? 'high' : 'low',
        body: {
          type: 'incident_body',
          details: JSON.stringify(alert.data, null, 2)
        }
      }
    });
  }

  setupEscalation(alertId, severity) {
    const config = this.severityLevels[severity];
    let escalationLevel = 0;

    const escalationInterval = setInterval(async () => {
      const alertInfo = this.alerts.find((a) => a.id === alertId);
      if (!alertInfo || alertInfo.resolved || alertInfo.acknowledged) {
        clearInterval(escalationInterval);
        return;
      }

      escalationLevel++;
      if (escalationLevel >= config.escalationPath.length) {
        clearInterval(escalationInterval);
        return;
      }

      alertInfo.escalationLevel = escalationLevel;
      alertInfo.lastEscalation = Date.now();

      await this.sendNotifications(alertInfo.alert, severity, escalationLevel);
    }, config.timeout);

    this.escalations.set(alertId, escalationInterval);
  }

  async acknowledgeAlert(alertId) {
    const alertInfo = this.alerts.find((a) => a.id === alertId);
    if (!alertInfo) return false;

    alertInfo.acknowledged = true;
    this.acknowledgedAlerts.add(alertId);

    // Clear escalation if exists
    if (this.escalations.has(alertId)) {
      clearInterval(this.escalations.get(alertId));
      this.escalations.delete(alertId);
    }

    // Send acknowledgment notification
    await this.sendAcknowledgmentNotification(alertInfo);

    return true;
  }

  async resolveAlert(alertId) {
    const alertInfo = this.alerts.find((a) => a.id === alertId);
    if (!alertInfo) return false;

    alertInfo.resolved = true;
    this.resolvedAlerts.add(alertId);

    // Clear escalation if exists
    if (this.escalations.has(alertId)) {
      clearInterval(this.escalations.get(alertId));
      this.escalations.delete(alertId);
    }

    // Send resolution notification
    await this.sendResolutionNotification(alertInfo);

    return true;
  }

  async sendAcknowledgmentNotification(alertInfo) {
    const message = {
      type: 'Alert Acknowledged',
      data: {
        alertId: alertInfo.id,
        alertType: alertInfo.alert.type,
        severity: alertInfo.severity,
        acknowledgedAt: new Date().toISOString()
      }
    };

    await this.sendToChannel('slack', message, alertInfo.severity);
    if (alertInfo.severity === 'critical' || alertInfo.severity === 'high') {
      await this.sendToChannel('email', message, alertInfo.severity);
    }
  }

  async sendResolutionNotification(alertInfo) {
    const message = {
      type: 'Alert Resolved',
      data: {
        alertId: alertInfo.id,
        alertType: alertInfo.alert.type,
        severity: alertInfo.severity,
        resolvedAt: new Date().toISOString()
      }
    };

    await this.sendToChannel('slack', message, alertInfo.severity);
    if (alertInfo.severity === 'critical' || alertInfo.severity === 'high') {
      await this.sendToChannel('email', message, alertInfo.severity);
    }
  }

  getAlertColor(severity) {
    switch (severity) {
      case 'critical':
        return '#FF0000';
      case 'high':
        return '#FFA500';
      case 'medium':
        return '#FFFF00';
      case 'low':
        return '#00FF00';
      default:
        return '#808080';
    }
  }

  getAlertEmoji(severity) {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '📝';
    }
  }

  getActionButtons(alertId, severity) {
    return `[Acknowledge](${process.env.DASHBOARD_URL}/alerts/${alertId}/acknowledge) | [Resolve](${process.env.DASHBOARD_URL}/alerts/${alertId}/resolve)`;
  }

  getActiveAlerts() {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  getAlertHistory() {
    return this.alerts;
  }

  getEscalationStatus(alertId) {
    const alertInfo = this.alerts.find((a) => a.id === alertId);
    if (!alertInfo) return null;

    return {
      escalationLevel: alertInfo.escalationLevel,
      lastEscalation: alertInfo.lastEscalation,
      acknowledged: alertInfo.acknowledged,
      resolved: alertInfo.resolved
    };
  }
}

// Export singleton instance
const alertManager = new AlertManager();
module.exports = alertManager;

// If running directly, start the manager
if (require.main === module) {
  console.log('Alert Manager initialized');

  // Example test alert
  if (process.env.NODE_ENV === 'development') {
    alertManager.processAlert({
      type: 'Test Alert',
      data: {
        message: 'This is a test alert',
        severity: 'medium',
        timestamp: new Date().toISOString()
      }
    });
  }
}
