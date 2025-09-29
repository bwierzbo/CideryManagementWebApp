/**
 * Telemetry Collector for Database Deprecation Monitoring
 *
 * Collects, aggregates, and stores telemetry data about deprecated element usage.
 * Provides data export and analysis capabilities.
 */

import { AccessEvent } from "./deprecated-monitor";

export interface TelemetryConfig {
  enabled: boolean;
  storageType: "memory" | "file" | "database";
  retentionDays: number;
  aggregationInterval: number; // in minutes
  exportFormat: "json" | "csv" | "both";
  maxEventBufferSize: number;
}

export interface TelemetryMetrics {
  timestamp: string;
  totalEvents: number;
  uniqueElements: number;
  topAccessedElements: Array<{ name: string; count: number }>;
  accessByType: Record<string, number>;
  accessBySource: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
}

export interface TelemetryExport {
  metadata: {
    exportDate: string;
    periodStart: string;
    periodEnd: string;
    totalEvents: number;
    version: string;
  };
  events: AccessEvent[];
  metrics: TelemetryMetrics[];
  summary: {
    mostAccessedElements: Array<{ name: string; type: string; count: number }>;
    riskAssessment: Record<string, "low" | "medium" | "high">;
    recommendations: string[];
  };
}

/**
 * Main telemetry collection and analysis class
 */
export class TelemetryCollector {
  private config: TelemetryConfig;
  private eventBuffer: AccessEvent[] = [];
  private metricsBuffer: TelemetryMetrics[] = [];
  private aggregationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: true,
      storageType: "memory",
      retentionDays: 30,
      aggregationInterval: 15, // 15 minutes
      exportFormat: "json",
      maxEventBufferSize: 10000,
      ...config,
    };

    if (this.config.enabled) {
      this.startAggregation();
    }
  }

  /**
   * Record access events from the monitoring system
   */
  async recordAccessEvents(events: AccessEvent[]): Promise<void> {
    if (!this.config.enabled || events.length === 0) return;

    // Add events to buffer
    this.eventBuffer.push(...events);

    // Trim buffer if it exceeds maximum size
    if (this.eventBuffer.length > this.config.maxEventBufferSize) {
      const excess = this.eventBuffer.length - this.config.maxEventBufferSize;
      this.eventBuffer.splice(0, excess);
      console.warn(
        `⚠️ Telemetry buffer overflow, removed ${excess} oldest events`,
      );
    }

    // Store events based on storage type
    await this.storeEvents(events);

    console.log(`📊 Recorded ${events.length} access events in telemetry`);
  }

  /**
   * Get telemetry metrics for a specific time period
   */
  async getMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<TelemetryMetrics[]> {
    if (!this.config.enabled) return [];

    // Filter events by date range
    const filteredEvents = this.eventBuffer.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });

    // Calculate metrics for the period
    const metrics = this.calculateMetrics(filteredEvents, startDate, endDate);
    return [metrics];
  }

  /**
   * Get current telemetry summary
   */
  async getCurrentSummary(): Promise<{
    totalEvents: number;
    uniqueElements: number;
    recentActivity: number;
    topElements: Array<{ name: string; count: number }>;
    alertsTriggered: number;
  }> {
    if (!this.config.enabled) {
      return {
        totalEvents: 0,
        uniqueElements: 0,
        recentActivity: 0,
        topElements: [],
        alertsTriggered: 0,
      };
    }

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = this.eventBuffer.filter(
      (event) => new Date(event.timestamp) >= last24Hours,
    );

    const elementCounts = new Map<string, number>();
    for (const event of this.eventBuffer) {
      const key = `${event.elementType}:${event.elementName}`;
      elementCounts.set(key, (elementCounts.get(key) || 0) + 1);
    }

    const topElements = Array.from(elementCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: this.eventBuffer.length,
      uniqueElements: elementCounts.size,
      recentActivity: recentEvents.length,
      topElements,
      alertsTriggered: 0, // Would track actual alerts
    };
  }

  /**
   * Export telemetry data for analysis
   */
  async exportTelemetryData(
    startDate: Date,
    endDate: Date,
    format?: "json" | "csv",
  ): Promise<TelemetryExport> {
    const exportFormat = format || this.config.exportFormat;

    // Filter events by date range
    const filteredEvents = this.eventBuffer.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });

    // Calculate metrics for the period
    const metrics = this.calculateMetrics(filteredEvents, startDate, endDate);

    // Generate summary and recommendations
    const summary = this.generateSummary(filteredEvents);

    const exportData: TelemetryExport = {
      metadata: {
        exportDate: new Date().toISOString(),
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        totalEvents: filteredEvents.length,
        version: "1.0.0",
      },
      events: filteredEvents,
      metrics: [metrics],
      summary,
    };

    // Save export based on format
    if (exportFormat === "json" || exportFormat === "both") {
      await this.saveExport(exportData, "json");
    }

    if (exportFormat === "csv" || exportFormat === "both") {
      await this.saveExportAsCSV(exportData);
    }

    return exportData;
  }

  /**
   * Analyze trends in deprecated element usage
   */
  async analyzeTrends(days: number = 30): Promise<{
    overallTrend: "increasing" | "decreasing" | "stable";
    elementTrends: Record<string, "increasing" | "decreasing" | "stable">;
    recommendations: string[];
    riskElements: string[];
  }> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentEvents = this.eventBuffer.filter(
      (event) => new Date(event.timestamp) >= cutoffDate,
    );

    // Group events by day and element
    const dailyData = new Map<string, Map<string, number>>();

    for (const event of recentEvents) {
      const day = event.timestamp.split("T")[0];
      const elementKey = `${event.elementType}:${event.elementName}`;

      if (!dailyData.has(day)) {
        dailyData.set(day, new Map());
      }

      const dayData = dailyData.get(day)!;
      dayData.set(elementKey, (dayData.get(elementKey) || 0) + 1);
    }

    // Analyze trends
    const overallCounts = Array.from(dailyData.values()).map((dayData) =>
      Array.from(dayData.values()).reduce((sum, count) => sum + count, 0),
    );

    const overallTrend = this.calculateTrend(overallCounts);

    const elementTrends: Record<
      string,
      "increasing" | "decreasing" | "stable"
    > = {};
    const uniqueElements = new Set<string>();

    for (const dayData of dailyData.values()) {
      for (const element of dayData.keys()) {
        uniqueElements.add(element);
      }
    }

    for (const element of uniqueElements) {
      const elementCounts = Array.from(dailyData.values()).map(
        (dayData) => dayData.get(element) || 0,
      );
      elementTrends[element] = this.calculateTrend(elementCounts);
    }

    // Generate recommendations
    const recommendations = this.generateTrendRecommendations(
      overallTrend,
      elementTrends,
    );

    // Identify risk elements (those with increasing usage)
    const riskElements = Object.entries(elementTrends)
      .filter(([, trend]) => trend === "increasing")
      .map(([element]) => element);

    return {
      overallTrend,
      elementTrends,
      recommendations,
      riskElements,
    };
  }

  /**
   * Clean up old telemetry data
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000,
    );

    // Remove old events
    const originalLength = this.eventBuffer.length;
    this.eventBuffer = this.eventBuffer.filter(
      (event) => new Date(event.timestamp) >= cutoffDate,
    );

    const removedCount = originalLength - this.eventBuffer.length;
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old telemetry events`);
    }

    // Remove old metrics
    this.metricsBuffer = this.metricsBuffer.filter(
      (metrics) => new Date(metrics.timestamp) >= cutoffDate,
    );
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    console.log("📊 Telemetry collection stopped");
  }

  // Private methods

  private startAggregation(): void {
    this.aggregationTimer = setInterval(
      () => {
        this.aggregateMetrics().catch(console.error);
      },
      this.config.aggregationInterval * 60 * 1000,
    );

    console.log(
      `📊 Telemetry aggregation started (${this.config.aggregationInterval} min intervals)`,
    );
  }

  private async storeEvents(events: AccessEvent[]): Promise<void> {
    switch (this.config.storageType) {
      case "memory":
        // Events are already in eventBuffer
        break;

      case "file":
        await this.storeEventsToFile(events);
        break;

      case "database":
        await this.storeEventsToDatabase(events);
        break;
    }
  }

  private async storeEventsToFile(events: AccessEvent[]): Promise<void> {
    // Implementation would write to log files
    console.log(`Writing ${events.length} events to file storage`);
  }

  private async storeEventsToDatabase(events: AccessEvent[]): Promise<void> {
    // Implementation would store in database tables
    console.log(`Writing ${events.length} events to database storage`);
  }

  private calculateMetrics(
    events: AccessEvent[],
    startDate: Date,
    endDate: Date,
  ): TelemetryMetrics {
    const uniqueElements = new Set(
      events.map((e) => `${e.elementType}:${e.elementName}`),
    );

    // Count accesses by element
    const elementCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let errorCount = 0;

    for (const event of events) {
      const elementKey = `${event.elementType}:${event.elementName}`;
      elementCounts.set(elementKey, (elementCounts.get(elementKey) || 0) + 1);

      typeCounts.set(
        event.elementType,
        (typeCounts.get(event.elementType) || 0) + 1,
      );

      const sourceKey = `${event.source.type}:${event.source.identifier}`;
      sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) || 0) + 1);

      if (event.executionTime !== undefined) {
        totalResponseTime += event.executionTime;
        responseTimeCount++;
      }

      if (event.metadata?.error) {
        errorCount++;
      }
    }

    const topAccessedElements = Array.from(elementCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      timestamp: new Date().toISOString(),
      totalEvents: events.length,
      uniqueElements: uniqueElements.size,
      topAccessedElements,
      accessByType: Object.fromEntries(typeCounts),
      accessBySource: Object.fromEntries(sourceCounts),
      errorRate: events.length > 0 ? errorCount / events.length : 0,
      averageResponseTime:
        responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
    };
  }

  private generateSummary(events: AccessEvent[]): TelemetryExport["summary"] {
    const elementCounts = new Map<
      string,
      { name: string; type: string; count: number }
    >();

    for (const event of events) {
      const key = `${event.elementType}:${event.elementName}`;
      if (!elementCounts.has(key)) {
        elementCounts.set(key, {
          name: event.elementName,
          type: event.elementType,
          count: 0,
        });
      }
      elementCounts.get(key)!.count++;
    }

    const mostAccessedElements = Array.from(elementCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Risk assessment based on access frequency
    const riskAssessment: Record<string, "low" | "medium" | "high"> = {};
    for (const element of mostAccessedElements) {
      const key = `${element.type}:${element.name}`;
      if (element.count > 100) {
        riskAssessment[key] = "high";
      } else if (element.count > 10) {
        riskAssessment[key] = "medium";
      } else {
        riskAssessment[key] = "low";
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const highRiskElements = Object.entries(riskAssessment).filter(
      ([, risk]) => risk === "high",
    );

    if (highRiskElements.length > 0) {
      recommendations.push(
        `Review high-risk elements: ${highRiskElements.map(([name]) => name).join(", ")}`,
      );
    }

    if (mostAccessedElements.length === 0) {
      recommendations.push(
        "No deprecated element access detected - elements may be safe for removal",
      );
    } else {
      recommendations.push(
        "Monitor deprecated elements for additional 30 days before removal",
      );
    }

    return {
      mostAccessedElements,
      riskAssessment,
      recommendations,
    };
  }

  private calculateTrend(
    values: number[],
  ): "increasing" | "decreasing" | "stable" {
    if (values.length < 2) return "stable";

    // Simple linear regression slope calculation
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + val * (idx + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (Math.abs(slope) < 0.1) return "stable";
    return slope > 0 ? "increasing" : "decreasing";
  }

  private generateTrendRecommendations(
    overallTrend: "increasing" | "decreasing" | "stable",
    elementTrends: Record<string, "increasing" | "decreasing" | "stable">,
  ): string[] {
    const recommendations: string[] = [];

    if (overallTrend === "increasing") {
      recommendations.push(
        "Overall deprecated element usage is increasing - investigate root causes",
      );
    } else if (overallTrend === "decreasing") {
      recommendations.push(
        "Overall deprecated element usage is decreasing - good trend",
      );
    }

    const increasingElements = Object.entries(elementTrends)
      .filter(([, trend]) => trend === "increasing")
      .map(([element]) => element);

    if (increasingElements.length > 0) {
      recommendations.push(
        `Elements with increasing usage: ${increasingElements.join(", ")}`,
      );
      recommendations.push(
        "Investigate why deprecated elements are being accessed more frequently",
      );
    }

    const stableElements = Object.entries(elementTrends)
      .filter(([, trend]) => trend === "stable")
      .map(([element]) => element);

    if (stableElements.length > 0) {
      recommendations.push(
        "Monitor stable elements for potential removal after cooling-off period",
      );
    }

    return recommendations;
  }

  private async aggregateMetrics(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const now = new Date();
    const intervalStart = new Date(
      now.getTime() - this.config.aggregationInterval * 60 * 1000,
    );

    const intervalEvents = this.eventBuffer.filter((event) => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= intervalStart && eventDate <= now;
    });

    if (intervalEvents.length > 0) {
      const metrics = this.calculateMetrics(intervalEvents, intervalStart, now);
      this.metricsBuffer.push(metrics);

      // Trim metrics buffer to retain only recent data
      const maxMetrics = Math.ceil(
        (this.config.retentionDays * 24 * 60) / this.config.aggregationInterval,
      );
      if (this.metricsBuffer.length > maxMetrics) {
        this.metricsBuffer.splice(0, this.metricsBuffer.length - maxMetrics);
      }
    }
  }

  private async saveExport(
    data: TelemetryExport,
    format: "json",
  ): Promise<void> {
    // Implementation would save to file system
    console.log(`Saving telemetry export in ${format} format`);
  }

  private async saveExportAsCSV(data: TelemetryExport): Promise<void> {
    // Implementation would convert to CSV and save
    console.log("Saving telemetry export in CSV format");
  }
}

/**
 * Factory function to create a configured TelemetryCollector
 */
export function createTelemetryCollector(
  config?: Partial<TelemetryConfig>,
): TelemetryCollector {
  return new TelemetryCollector(config);
}
