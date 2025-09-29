/**
 * Alert System for Database Deprecation Monitoring
 *
 * Provides real-time alerting when deprecated database elements are accessed.
 * Supports multiple notification channels and alert severity levels.
 */

import { AccessEvent } from "./deprecated-monitor";

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  defaultSeverity: AlertSeverity;
  throttleWindowMinutes: number;
  maxAlertsPerHour: number;
  escalationRules: EscalationRule[];
}

export interface AlertChannel {
  type: "console" | "email" | "slack" | "webhook" | "database";
  name: string;
  config: Record<string, any>;
  severityFilter: AlertSeverity[];
}

export interface EscalationRule {
  triggerCount: number;
  timeWindowMinutes: number;
  escalateTo: AlertSeverity;
  additionalChannels?: string[];
}

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface Alert {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string;
  metadata: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: string;
}

export type AlertType =
  | "deprecated_element_access"
  | "threshold_exceeded"
  | "usage_spike"
  | "system_error"
  | "escalation";

/**
 * Main alert system for deprecated database element monitoring
 */
export class AlertSystem {
  private config: AlertConfig;
  private alertHistory: Alert[] = [];
  private throttleMap: Map<string, number> = new Map();
  private escalationCounters: Map<string, { count: number; firstSeen: Date }> =
    new Map();

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      enabled: true,
      channels: [
        {
          type: "console",
          name: "console",
          config: {},
          severityFilter: ["info", "warning", "error", "critical"],
        },
      ],
      defaultSeverity: "warning",
      throttleWindowMinutes: 5,
      maxAlertsPerHour: 60,
      escalationRules: [
        {
          triggerCount: 5,
          timeWindowMinutes: 15,
          escalateTo: "error",
        },
        {
          triggerCount: 20,
          timeWindowMinutes: 60,
          escalateTo: "critical",
        },
      ],
      ...config,
    };

    // Clean up old throttle data periodically
    setInterval(() => this.cleanupThrottleMap(), 60000); // Every minute
  }

  /**
   * Trigger alert when deprecated element is accessed
   */
  async triggerDeprecatedElementAccess(event: AccessEvent): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `deprecated_access_${event.elementType}_${event.elementName}`;

    // Check throttling
    if (this.isThrottled(alertKey)) {
      return;
    }

    // Check escalation
    const severity = this.checkEscalation(alertKey);

    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity,
      type: "deprecated_element_access",
      title: `Deprecated ${event.elementType} Accessed`,
      message: `Deprecated ${event.elementType} "${event.elementName}" was accessed by ${event.source.identifier} (${event.source.type})`,
      metadata: {
        elementName: event.elementName,
        elementType: event.elementType,
        source: event.source,
        queryType: event.queryType,
        eventId: event.id,
      },
      acknowledged: false,
    };

    await this.sendAlert(alert);
    this.updateThrottle(alertKey);
  }

  /**
   * Trigger alert when access threshold is exceeded
   */
  async triggerThresholdAlert(
    elementKey: string,
    actualCount: number,
    threshold: number,
  ): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `threshold_${elementKey}`;

    if (this.isThrottled(alertKey)) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: "error",
      type: "threshold_exceeded",
      title: "Deprecated Element Access Threshold Exceeded",
      message: `Element ${elementKey} accessed ${actualCount} times, exceeding threshold of ${threshold}`,
      metadata: {
        elementKey,
        actualCount,
        threshold,
      },
      acknowledged: false,
    };

    await this.sendAlert(alert);
    this.updateThrottle(alertKey);
  }

  /**
   * Trigger alert for usage spikes
   */
  async triggerUsageSpike(
    elementName: string,
    currentUsage: number,
    normalUsage: number,
    spikeRatio: number,
  ): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `spike_${elementName}`;

    if (this.isThrottled(alertKey)) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: "warning",
      type: "usage_spike",
      title: "Deprecated Element Usage Spike Detected",
      message: `Unusual spike in usage for ${elementName}: ${currentUsage} (${spikeRatio.toFixed(1)}x normal)`,
      metadata: {
        elementName,
        currentUsage,
        normalUsage,
        spikeRatio,
      },
      acknowledged: false,
    };

    await this.sendAlert(alert);
    this.updateThrottle(alertKey);
  }

  /**
   * Trigger system error alert
   */
  async triggerSystemError(error: Error, context: string): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `system_error_${context}`;

    if (this.isThrottled(alertKey)) {
      return;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: "critical",
      type: "system_error",
      title: "Database Monitoring System Error",
      message: `System error in ${context}: ${error.message}`,
      metadata: {
        context,
        error: error.message,
        stack: error.stack,
      },
      acknowledged: false,
    };

    await this.sendAlert(alert);
    this.updateThrottle(alertKey);
  }

  /**
   * Get alert history
   */
  getAlertHistory(
    limit: number = 100,
    severity?: AlertSeverity,
    type?: AlertType,
  ): Alert[] {
    let filtered = [...this.alertHistory];

    if (severity) {
      filtered = filtered.filter((alert) => alert.severity === severity);
    }

    if (type) {
      filtered = filtered.filter((alert) => alert.type === type);
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
  ): Promise<boolean> {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.metadata.acknowledgedBy = acknowledgedBy;
    alert.metadata.acknowledgedAt = new Date().toISOString();

    console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    return true;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution?: string,
  ): Promise<boolean> {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date().toISOString();
    alert.metadata.resolvedBy = resolvedBy;
    if (resolution) {
      alert.metadata.resolution = resolution;
    }

    console.log(`🔄 Alert ${alertId} resolved by ${resolvedBy}`);
    return true;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(hours: number = 24): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    acknowledged: number;
    resolved: number;
    avgResponseTime: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentAlerts = this.alertHistory.filter(
      (alert) => new Date(alert.timestamp) >= cutoff,
    );

    const bySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byType: Record<AlertType, number> = {
      deprecated_element_access: 0,
      threshold_exceeded: 0,
      usage_spike: 0,
      system_error: 0,
      escalation: 0,
    };

    let acknowledged = 0;
    let resolved = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const alert of recentAlerts) {
      bySeverity[alert.severity]++;
      byType[alert.type]++;

      if (alert.acknowledged) acknowledged++;
      if (alert.resolvedAt) resolved++;

      if (alert.metadata.acknowledgedAt) {
        const responseTime =
          new Date(alert.metadata.acknowledgedAt).getTime() -
          new Date(alert.timestamp).getTime();
        totalResponseTime += responseTime;
        responseTimeCount++;
      }
    }

    return {
      total: recentAlerts.length,
      bySeverity,
      byType,
      acknowledged,
      resolved,
      avgResponseTime:
        responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
    };
  }

  /**
   * Configure alert channels
   */
  addChannel(channel: AlertChannel): void {
    const existingIndex = this.config.channels.findIndex(
      (c) => c.name === channel.name,
    );
    if (existingIndex >= 0) {
      this.config.channels[existingIndex] = channel;
    } else {
      this.config.channels.push(channel);
    }

    console.log(
      `📢 Alert channel ${channel.name} (${channel.type}) configured`,
    );
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelName: string): void {
    this.config.channels = this.config.channels.filter(
      (c) => c.name !== channelName,
    );
    console.log(`📢 Alert channel ${channelName} removed`);
  }

  /**
   * Test alert system
   */
  async testAlerts(): Promise<void> {
    const testAlert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: "info",
      type: "system_error",
      title: "Alert System Test",
      message:
        "This is a test alert to verify the alert system is working correctly",
      metadata: { test: true },
      acknowledged: false,
    };

    await this.sendAlert(testAlert);
    console.log("🧪 Test alert sent successfully");
  }

  // Private methods

  private async sendAlert(alert: Alert): Promise<void> {
    // Add to history
    this.alertHistory.push(alert);

    // Trim history to prevent memory issues
    if (this.alertHistory.length > 10000) {
      this.alertHistory.splice(0, this.alertHistory.length - 10000);
    }

    // Send to appropriate channels
    for (const channel of this.config.channels) {
      if (channel.severityFilter.includes(alert.severity)) {
        await this.sendToChannel(channel, alert);
      }
    }

    console.log(
      `🚨 Alert sent: ${alert.severity.toUpperCase()} - ${alert.title}`,
    );
  }

  private async sendToChannel(
    channel: AlertChannel,
    alert: Alert,
  ): Promise<void> {
    try {
      switch (channel.type) {
        case "console":
          await this.sendToConsole(alert);
          break;

        case "email":
          await this.sendToEmail(channel, alert);
          break;

        case "slack":
          await this.sendToSlack(channel, alert);
          break;

        case "webhook":
          await this.sendToWebhook(channel, alert);
          break;

        case "database":
          await this.sendToDatabase(channel, alert);
          break;

        default:
          console.warn(`Unknown alert channel type: ${channel.type}`);
      }
    } catch (error) {
      console.error(`Failed to send alert to ${channel.name}:`, error);
    }
  }

  private async sendToConsole(alert: Alert): Promise<void> {
    const icon = this.getSeverityIcon(alert.severity);
    const timestamp = new Date(alert.timestamp).toLocaleTimeString();

    console.log(`${icon} [${timestamp}] ${alert.title}`);
    console.log(`   ${alert.message}`);

    if (Object.keys(alert.metadata).length > 0) {
      console.log(`   Metadata:`, alert.metadata);
    }
  }

  private async sendToEmail(
    channel: AlertChannel,
    alert: Alert,
  ): Promise<void> {
    // Email implementation would go here
    console.log(
      `📧 Sending email alert to ${channel.config.recipients}: ${alert.title}`,
    );
  }

  private async sendToSlack(
    channel: AlertChannel,
    alert: Alert,
  ): Promise<void> {
    // Slack implementation would go here
    console.log(
      `💬 Sending Slack alert to ${channel.config.channel}: ${alert.title}`,
    );
  }

  private async sendToWebhook(
    channel: AlertChannel,
    alert: Alert,
  ): Promise<void> {
    // Webhook implementation would go here
    console.log(
      `🔗 Sending webhook alert to ${channel.config.url}: ${alert.title}`,
    );
  }

  private async sendToDatabase(
    channel: AlertChannel,
    alert: Alert,
  ): Promise<void> {
    // Database storage implementation would go here
    console.log(`💾 Storing alert in database: ${alert.title}`);
  }

  private isThrottled(alertKey: string): boolean {
    const now = Date.now();
    const lastAlert = this.throttleMap.get(alertKey);

    if (!lastAlert) return false;

    const throttleWindow = this.config.throttleWindowMinutes * 60 * 1000;
    return now - lastAlert < throttleWindow;
  }

  private updateThrottle(alertKey: string): void {
    this.throttleMap.set(alertKey, Date.now());
  }

  private cleanupThrottleMap(): void {
    const now = Date.now();
    const throttleWindow = this.config.throttleWindowMinutes * 60 * 1000;

    for (const [key, timestamp] of this.throttleMap.entries()) {
      if (now - timestamp > throttleWindow) {
        this.throttleMap.delete(key);
      }
    }
  }

  private checkEscalation(alertKey: string): AlertSeverity {
    const now = new Date();
    let counter = this.escalationCounters.get(alertKey);

    if (!counter) {
      counter = { count: 1, firstSeen: now };
      this.escalationCounters.set(alertKey, counter);
      return this.config.defaultSeverity;
    }

    counter.count++;

    // Check escalation rules
    for (const rule of this.config.escalationRules) {
      const windowStart = new Date(
        now.getTime() - rule.timeWindowMinutes * 60 * 1000,
      );

      if (
        counter.firstSeen >= windowStart &&
        counter.count >= rule.triggerCount
      ) {
        console.log(
          `📈 Escalating alert ${alertKey} to ${rule.escalateTo} (${counter.count} occurrences)`,
        );

        // Reset counter for next escalation level
        this.escalationCounters.set(alertKey, { count: 1, firstSeen: now });

        return rule.escalateTo;
      }
    }

    return this.config.defaultSeverity;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case "info":
        return "ℹ️";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "critical":
        return "🚨";
      default:
        return "📢";
    }
  }
}

/**
 * Factory function to create a configured AlertSystem
 */
export function createAlertSystem(config?: Partial<AlertConfig>): AlertSystem {
  return new AlertSystem(config);
}

/**
 * Pre-configured alert systems for common scenarios
 */
export const AlertPresets = {
  /**
   * Development environment - console only, less strict
   */
  development: (): AlertSystem =>
    createAlertSystem({
      enabled: true,
      channels: [
        {
          type: "console",
          name: "dev-console",
          config: {},
          severityFilter: ["warning", "error", "critical"],
        },
      ],
      throttleWindowMinutes: 1,
      maxAlertsPerHour: 100,
    }),

  /**
   * Production environment - multiple channels, strict alerting
   */
  production: (): AlertSystem =>
    createAlertSystem({
      enabled: true,
      channels: [
        {
          type: "console",
          name: "prod-console",
          config: {},
          severityFilter: ["error", "critical"],
        },
        // Additional channels would be configured based on infrastructure
      ],
      throttleWindowMinutes: 5,
      maxAlertsPerHour: 60,
      escalationRules: [
        {
          triggerCount: 3,
          timeWindowMinutes: 10,
          escalateTo: "error",
        },
        {
          triggerCount: 10,
          timeWindowMinutes: 30,
          escalateTo: "critical",
        },
      ],
    }),

  /**
   * Testing environment - capture all alerts for analysis
   */
  testing: (): AlertSystem =>
    createAlertSystem({
      enabled: true,
      channels: [
        {
          type: "console",
          name: "test-console",
          config: {},
          severityFilter: ["info", "warning", "error", "critical"],
        },
      ],
      throttleWindowMinutes: 0, // No throttling for tests
      maxAlertsPerHour: 1000,
    }),
};
