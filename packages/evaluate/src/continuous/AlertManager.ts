/**
 * AlertManager
 *
 * Manage quality degradation alerts.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AlertManagerConfig,
  AlertRule,
  Alert,
  AlertChannelConfig,
  AlertNotification,
} from '../types/index.js';
import { importOptional } from '../utils/optional-import.js';

interface AlertManagerEvents {
  'alert:triggered': (alert: Alert) => void;
  'alert:resolved': (alert: Alert) => void;
  'notification:sent': (notification: AlertNotification) => void;
}

/**
 * Minimal structural contract for `nodemailer` so the email channel can be
 * implemented without taking a hard type dependency on the optional package.
 */
interface NodemailerLike {
  createTransport(options: unknown): {
    sendMail(mail: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    }): Promise<unknown>;
  };
}

/**
 * Alert manager
 */
export class AlertManager extends EventEmitter<AlertManagerEvents> {
  private channels: AlertChannelConfig[];
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private cooldownMs: number;
  private lastAlertTime: Map<string, number> = new Map();
  private alertCount = 0;

  constructor(config: AlertManagerConfig) {
    super();
    this.channels = config.channels;
    this.cooldownMs = config.cooldownMs ?? 300000; // 5 minutes default

    if (config.rules) {
      for (const [metric, rule] of Object.entries(config.rules)) {
        this.rules.set(metric, rule);
      }
    }
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.metric, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(metric: string): boolean {
    return this.rules.delete(metric);
  }

  /**
   * Check value against rules
   */
  check(metric: string, value: number): Alert | null {
    const rule = this.rules.get(metric);
    if (!rule) return null;

    const shouldAlert =
      (rule.direction === 'above' && value > rule.threshold) ||
      (rule.direction === 'below' && value < rule.threshold);

    if (shouldAlert) {
      return this.triggerAlert(rule, metric, value);
    } else {
      // Check if we should resolve an existing alert
      const existingAlert = this.activeAlerts.get(metric);
      if (existingAlert) {
        this.resolveAlert(metric);
      }
    }

    return null;
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(
    rule: AlertRule,
    metric: string,
    value: number,
  ): Alert | null {
    // Check cooldown
    const lastTime = this.lastAlertTime.get(metric);
    if (lastTime && Date.now() - lastTime < this.cooldownMs) {
      return null;
    }

    const alert: Alert = {
      id: nanoid(),
      rule,
      metric,
      currentValue: value,
      threshold: rule.threshold,
      severity: rule.severity ?? 'warning',
      message: this.formatMessage(rule, metric, value),
      triggeredAt: Date.now(),
    };

    this.activeAlerts.set(metric, alert);
    this.lastAlertTime.set(metric, Date.now());
    this.alertCount++;

    this.emit('alert:triggered', alert);
    void this.sendNotifications(alert);

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(metric: string): void {
    const alert = this.activeAlerts.get(metric);
    if (alert) {
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(metric);
      this.emit('alert:resolved', alert);
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Send notifications
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      try {
        await this.sendToChannel(channel, alert);

        const notification: AlertNotification = {
          alertId: alert.id,
          channel: channel.type,
          sentAt: Date.now(),
          success: true,
        };

        this.emit('notification:sent', notification);
      } catch (error) {
        const notification: AlertNotification = {
          alertId: alert.id,
          channel: channel.type,
          sentAt: Date.now(),
          success: false,
          error: (error as Error).message,
        };

        this.emit('notification:sent', notification);
      }
    }
  }

  /**
   * Send to a specific channel
   */
  private async sendToChannel(
    channel: AlertChannelConfig,
    alert: Alert,
  ): Promise<void> {
    switch (channel.type) {
      case 'webhook':
        if (channel.webhook) {
          await fetch(channel.webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alert: {
                id: alert.id,
                metric: alert.metric,
                severity: alert.severity,
                message: alert.message,
                value: alert.currentValue,
                threshold: alert.threshold,
                triggeredAt: new Date(alert.triggeredAt).toISOString(),
              },
            }),
          });
        }
        break;

      case 'slack':
        if (channel.webhook) {
          await fetch(channel.webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 *${alert.severity.toUpperCase()}*: ${alert.message}`,
              attachments: [
                {
                  color: alert.severity === 'critical' ? 'danger' : 'warning',
                  fields: [
                    { title: 'Metric', value: alert.metric, short: true },
                    {
                      title: 'Value',
                      value: alert.currentValue.toFixed(4),
                      short: true,
                    },
                    {
                      title: 'Threshold',
                      value: alert.threshold.toString(),
                      short: true,
                    },
                  ],
                },
              ],
            }),
          });
        }
        break;

      case 'email':
        await this.sendEmail(channel, alert);
        break;

      case 'pagerduty':
        await this.sendPagerDuty(channel, alert);
        break;
    }
  }

  /**
   * Deliver an alert by email over SMTP via `nodemailer` (lazily imported so it
   * is only required when the email channel is actually used).
   */
  private async sendEmail(
    channel: AlertChannelConfig,
    alert: Alert,
  ): Promise<void> {
    if (!channel.to?.length) {
      throw new Error('Email alert channel requires `to` recipients');
    }
    if (!channel.smtp?.host) {
      throw new Error('Email alert channel requires `smtp.host`');
    }

    // `nodemailer` is an optional dependency and may not be installed; import it
    // dynamically and type it with a minimal local contract so the package
    // type-checks without `@types/nodemailer` present.
    let mod: unknown;
    try {
      mod = await importOptional('nodemailer');
    } catch {
      throw new Error(
        'Email alerts require the "nodemailer" package. Install it to use the ' +
          'email channel, or choose a different alert channel.',
      );
    }
    // Some bundlers wrap the CJS module under `.default`.
    const mailer = ((mod as { default?: NodemailerLike }).default ??
      mod) as NodemailerLike;

    const transport = mailer.createTransport({
      host: channel.smtp.host,
      port: channel.smtp.port ?? 587,
      secure: channel.smtp.secure ?? false,
      auth: channel.smtp.auth,
    });

    await transport.sendMail({
      from: channel.from ?? channel.smtp.auth?.user ?? 'alerts@agentsea.local',
      to: channel.to.join(', '),
      subject: `[${alert.severity.toUpperCase()}] ${alert.metric} alert`,
      text: alert.message,
      html:
        `<p><strong>${alert.severity.toUpperCase()}</strong>: ${alert.message}</p>` +
        `<ul><li>Metric: ${alert.metric}</li>` +
        `<li>Value: ${alert.currentValue}</li>` +
        `<li>Threshold: ${alert.threshold}</li></ul>`,
    });
  }

  /**
   * Trigger a PagerDuty incident through the Events API v2 enqueue endpoint.
   */
  private async sendPagerDuty(
    channel: AlertChannelConfig,
    alert: Alert,
  ): Promise<void> {
    const routingKey = channel.routingKey ?? channel.apiKey;
    if (!routingKey) {
      throw new Error(
        'PagerDuty alert channel requires a `routingKey` (or `apiKey`)',
      );
    }

    // PagerDuty severities are info | warning | error | critical.
    const severity =
      alert.severity === 'critical'
        ? 'critical'
        : alert.severity === 'warning'
          ? 'warning'
          : 'info';

    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        // Group repeated alerts for the same metric into one incident.
        dedup_key: `agentsea-evaluate:${alert.metric}`,
        payload: {
          summary: alert.message,
          source: 'agentsea-evaluate',
          severity,
          custom_details: {
            metric: alert.metric,
            value: alert.currentValue,
            threshold: alert.threshold,
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(
        `PagerDuty enqueue failed: ${res.status} ${res.statusText}`,
      );
    }
  }

  /**
   * Format alert message
   */
  private formatMessage(
    rule: AlertRule,
    metric: string,
    value: number,
  ): string {
    const direction = rule.direction === 'above' ? 'exceeded' : 'dropped below';
    return `${metric} ${direction} threshold: ${value.toFixed(4)} (threshold: ${rule.threshold})`;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert count
   */
  getAlertCount(): number {
    return this.alertCount;
  }

  /**
   * Get rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }
}

/**
 * Create an alert manager
 */
export function createAlertManager(config: AlertManagerConfig): AlertManager {
  return new AlertManager(config);
}
