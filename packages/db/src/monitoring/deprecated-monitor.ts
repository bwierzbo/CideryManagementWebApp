/**
 * Deprecated Element Monitoring System
 *
 * Tracks usage and access patterns for deprecated database elements.
 * Provides real-time monitoring, alerting, and usage analytics.
 */

import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DeprecatedElement } from '../migrations/deprecation-system';
import { TelemetryCollector } from './telemetry-collector';
import { AlertSystem } from './alert-system';

export interface MonitoringConfig {
  enabled: boolean;
  alertOnAccess: boolean;
  trackPerformance: boolean;
  retentionDays: number;
  batchSize: number;
  alertThresholds: {
    accessCount: number;
    timeWindow: number; // in minutes
  };
}

export interface AccessEvent {
  id: string;
  elementName: string;
  elementType: string;
  timestamp: string;
  source: AccessSource;
  queryType: QueryType;
  executionTime?: number;
  affectedRows?: number;
  metadata?: Record<string, any>;
}

export interface AccessSource {
  type: 'application' | 'migration' | 'admin' | 'unknown';
  identifier: string; // Function name, migration ID, user, etc.
  origin: string; // File path, IP address, etc.
}

export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALTER' | 'CREATE' | 'DROP' | 'OTHER';

export interface MonitoringStats {
  elementName: string;
  totalAccess: number;
  lastAccessed: string | null;
  accessFrequency: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  sources: Record<string, number>;
  queryTypes: Record<QueryType, number>;
  averageExecutionTime: number;
  peakAccessHour: number;
}

/**
 * Main monitoring class for deprecated database elements
 */
export class DeprecatedMonitor {
  private db: NodePgDatabase<any>;
  private config: MonitoringConfig;
  private telemetry: TelemetryCollector;
  private alerts: AlertSystem;
  private monitoredElements: Map<string, DeprecatedElement> = new Map();
  private accessEventBuffer: AccessEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    db: NodePgDatabase<any>,
    telemetry: TelemetryCollector,
    alerts: AlertSystem,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.db = db;
    this.telemetry = telemetry;
    this.alerts = alerts;
    this.config = {
      enabled: true,
      alertOnAccess: true,
      trackPerformance: true,
      retentionDays: 90,
      batchSize: 100,
      alertThresholds: {
        accessCount: 5,
        timeWindow: 60, // 1 hour
      },
      ...config,
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring a deprecated element
   */
  async startMonitoring(element: DeprecatedElement): Promise<void> {
    if (!this.config.enabled) {
      console.log('Monitoring is disabled');
      return;
    }

    const key = `${element.type}:${element.deprecatedName}`;
    this.monitoredElements.set(key, element);

    console.log(`📊 Started monitoring deprecated ${element.type}: ${element.deprecatedName}`);

    // Create monitoring metadata entry
    await this.createMonitoringEntry(element);

    // Set up database-level monitoring if supported
    await this.setupDatabaseMonitoring(element);
  }

  /**
   * Stop monitoring a deprecated element
   */
  async stopMonitoring(element: DeprecatedElement): Promise<void> {
    const key = `${element.type}:${element.deprecatedName}`;
    this.monitoredElements.delete(key);

    console.log(`📊 Stopped monitoring deprecated ${element.type}: ${element.deprecatedName}`);

    // Clean up monitoring resources
    await this.cleanupMonitoring(element);
  }

  /**
   * Record an access event for a deprecated element
   */
  async recordAccess(
    elementName: string,
    elementType: string,
    source: AccessSource,
    queryType: QueryType,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled) return;

    const accessEvent: AccessEvent = {
      id: this.generateEventId(),
      elementName,
      elementType,
      timestamp: new Date().toISOString(),
      source,
      queryType,
      metadata,
    };

    // Add to buffer for batch processing
    this.accessEventBuffer.push(accessEvent);

    // Trigger alert if enabled
    if (this.config.alertOnAccess) {
      await this.alerts.triggerDeprecatedElementAccess(accessEvent);
    }

    // Flush buffer if it's full
    if (this.accessEventBuffer.length >= this.config.batchSize) {
      await this.flushAccessEvents();
    }

    console.log(`⚠️ DEPRECATED ELEMENT ACCESSED: ${elementType} ${elementName} by ${source.identifier}`);
  }

  /**
   * Get monitoring statistics for an element
   */
  async getElementStats(elementName: string): Promise<MonitoringStats | null> {
    if (!this.config.enabled) return null;

    try {
      // Query access events from the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const events = await this.getAccessEvents(elementName, thirtyDaysAgo);

      if (events.length === 0) {
        return {
          elementName,
          totalAccess: 0,
          lastAccessed: null,
          accessFrequency: {
            daily: new Array(30).fill(0),
            weekly: new Array(4).fill(0),
            monthly: new Array(12).fill(0),
          },
          sources: {},
          queryTypes: {
            SELECT: 0,
            INSERT: 0,
            UPDATE: 0,
            DELETE: 0,
            ALTER: 0,
            CREATE: 0,
            DROP: 0,
            OTHER: 0,
          },
          averageExecutionTime: 0,
          peakAccessHour: 0,
        };
      }

      // Calculate statistics
      const stats: MonitoringStats = {
        elementName,
        totalAccess: events.length,
        lastAccessed: events[0]?.timestamp || null,
        accessFrequency: this.calculateAccessFrequency(events),
        sources: this.calculateSourceStats(events),
        queryTypes: this.calculateQueryTypeStats(events),
        averageExecutionTime: this.calculateAverageExecutionTime(events),
        peakAccessHour: this.calculatePeakAccessHour(events),
      };

      return stats;
    } catch (error) {
      console.error(`Error getting stats for ${elementName}:`, error);
      return null;
    }
  }

  /**
   * Get all monitoring statistics
   */
  async getAllStats(): Promise<MonitoringStats[]> {
    const stats: MonitoringStats[] = [];

    for (const [key, element] of this.monitoredElements) {
      const elementStats = await this.getElementStats(element.deprecatedName);
      if (elementStats) {
        stats.push(elementStats);
      }
    }

    return stats;
  }

  /**
   * Check if any deprecated elements are ready for removal
   */
  async getRemovalCandidates(daysSinceLastAccess: number = 30): Promise<string[]> {
    const candidates: string[] = [];
    const cutoffDate = new Date(Date.now() - daysSinceLastAccess * 24 * 60 * 60 * 1000);

    for (const [key, element] of this.monitoredElements) {
      const stats = await this.getElementStats(element.deprecatedName);
      if (!stats || !stats.lastAccessed) {
        candidates.push(element.deprecatedName);
        continue;
      }

      const lastAccessed = new Date(stats.lastAccessed);
      if (lastAccessed < cutoffDate) {
        candidates.push(element.deprecatedName);
      }
    }

    return candidates;
  }

  /**
   * Generate monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    overview: {
      totalMonitored: number;
      totalAccess: number;
      recentAlerts: number;
      removalCandidates: number;
    };
    elements: Array<{
      name: string;
      type: string;
      accessCount: number;
      lastAccessed: string | null;
      status: 'safe' | 'warning' | 'active';
    }>;
    trends: {
      dailyAccess: number[];
      topSources: Array<{ name: string; count: number }>;
      queryTypes: Record<QueryType, number>;
    };
  }> {
    const allStats = await this.getAllStats();
    const removalCandidates = await this.getRemovalCandidates();

    // Calculate overview metrics
    const totalAccess = allStats.reduce((sum, stat) => sum + stat.totalAccess, 0);
    const recentAlerts = await this.getRecentAlertCount();

    // Determine element status
    const elements = allStats.map(stat => {
      let status: 'safe' | 'warning' | 'active' = 'safe';
      if (stat.totalAccess > 0) {
        status = removalCandidates.includes(stat.elementName) ? 'warning' : 'active';
      }

      return {
        name: stat.elementName,
        type: this.getElementType(stat.elementName),
        accessCount: stat.totalAccess,
        lastAccessed: stat.lastAccessed,
        status,
      };
    });

    // Calculate trends
    const dailyAccess = this.aggregateDailyAccess(allStats);
    const topSources = this.aggregateTopSources(allStats);
    const queryTypes = this.aggregateQueryTypes(allStats);

    return {
      overview: {
        totalMonitored: this.monitoredElements.size,
        totalAccess,
        recentAlerts,
        removalCandidates: removalCandidates.length,
      },
      elements,
      trends: {
        dailyAccess,
        topSources,
        queryTypes,
      },
    };
  }

  /**
   * Cleanup monitoring data older than retention period
   */
  async cleanupOldData(): Promise<void> {
    if (!this.config.enabled) return;

    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

    try {
      // Clean up access events (would be implemented with actual storage)
      console.log(`🧹 Cleaning up monitoring data older than ${cutoffDate.toISOString()}`);

      // Implementation would delete old records from storage
    } catch (error) {
      console.error('Error cleaning up monitoring data:', error);
    }
  }

  // Private methods

  private startMonitoring(): void {
    // Set up periodic flushing of access events
    this.flushInterval = setInterval(async () => {
      if (this.accessEventBuffer.length > 0) {
        await this.flushAccessEvents();
      }
    }, 30000); // Flush every 30 seconds

    console.log('📊 Deprecated element monitoring started');
  }

  private stopMonitoring(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining events
    if (this.accessEventBuffer.length > 0) {
      this.flushAccessEvents().catch(console.error);
    }

    console.log('📊 Deprecated element monitoring stopped');
  }

  private async createMonitoringEntry(element: DeprecatedElement): Promise<void> {
    // Create monitoring metadata entry
    // In a real implementation, this would store in a monitoring table
    console.log(`Creating monitoring entry for ${element.deprecatedName}`);
  }

  private async setupDatabaseMonitoring(element: DeprecatedElement): Promise<void> {
    // Set up database-level monitoring (e.g., triggers, log analysis)
    // This would depend on the specific database system capabilities
    console.log(`Setting up database monitoring for ${element.deprecatedName}`);
  }

  private async cleanupMonitoring(element: DeprecatedElement): Promise<void> {
    // Clean up monitoring resources
    console.log(`Cleaning up monitoring for ${element.deprecatedName}`);
  }

  private async flushAccessEvents(): Promise<void> {
    if (this.accessEventBuffer.length === 0) return;

    const events = [...this.accessEventBuffer];
    this.accessEventBuffer = [];

    try {
      // Store events in telemetry system
      await this.telemetry.recordAccessEvents(events);

      // Check for alert thresholds
      await this.checkAlertThresholds(events);

      console.log(`📊 Flushed ${events.length} access events to telemetry`);
    } catch (error) {
      console.error('Error flushing access events:', error);
      // Re-add events to buffer for retry
      this.accessEventBuffer.unshift(...events);
    }
  }

  private async checkAlertThresholds(events: AccessEvent[]): Promise<void> {
    const elementCounts = new Map<string, number>();

    // Count accesses per element in current batch
    for (const event of events) {
      const key = `${event.elementType}:${event.elementName}`;
      elementCounts.set(key, (elementCounts.get(key) || 0) + 1);
    }

    // Check thresholds
    for (const [elementKey, count] of elementCounts) {
      if (count >= this.config.alertThresholds.accessCount) {
        await this.alerts.triggerThresholdAlert(elementKey, count, this.config.alertThresholds.accessCount);
      }
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private async getAccessEvents(elementName: string, since: string): Promise<AccessEvent[]> {
    // Query access events from storage
    // This would be implemented with actual storage queries
    return [];
  }

  private calculateAccessFrequency(events: AccessEvent[]): MonitoringStats['accessFrequency'] {
    const daily = new Array(30).fill(0);
    const weekly = new Array(4).fill(0);
    const monthly = new Array(12).fill(0);

    const now = new Date();

    for (const event of events) {
      const eventDate = new Date(event.timestamp);
      const daysDiff = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksDiff = Math.floor(daysDiff / 7);
      const monthsDiff = Math.floor(daysDiff / 30);

      if (daysDiff < 30) daily[daysDiff]++;
      if (weeksDiff < 4) weekly[weeksDiff]++;
      if (monthsDiff < 12) monthly[monthsDiff]++;
    }

    return { daily, weekly, monthly };
  }

  private calculateSourceStats(events: AccessEvent[]): Record<string, number> {
    const sources: Record<string, number> = {};

    for (const event of events) {
      const sourceKey = `${event.source.type}:${event.source.identifier}`;
      sources[sourceKey] = (sources[sourceKey] || 0) + 1;
    }

    return sources;
  }

  private calculateQueryTypeStats(events: AccessEvent[]): Record<QueryType, number> {
    const queryTypes: Record<QueryType, number> = {
      SELECT: 0,
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
      ALTER: 0,
      CREATE: 0,
      DROP: 0,
      OTHER: 0,
    };

    for (const event of events) {
      queryTypes[event.queryType]++;
    }

    return queryTypes;
  }

  private calculateAverageExecutionTime(events: AccessEvent[]): number {
    const timings = events.filter(e => e.executionTime !== undefined).map(e => e.executionTime!);
    return timings.length > 0 ? timings.reduce((sum, time) => sum + time, 0) / timings.length : 0;
  }

  private calculatePeakAccessHour(events: AccessEvent[]): number {
    const hourCounts = new Array(24).fill(0);

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour]++;
    }

    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private async getRecentAlertCount(): Promise<number> {
    // Get count of alerts from the last 24 hours
    // This would query the alert system
    return 0;
  }

  private getElementType(elementName: string): string {
    // Find element type from monitored elements
    for (const [key, element] of this.monitoredElements) {
      if (element.deprecatedName === elementName) {
        return element.type;
      }
    }
    return 'unknown';
  }

  private aggregateDailyAccess(stats: MonitoringStats[]): number[] {
    const dailyAccess = new Array(30).fill(0);

    for (const stat of stats) {
      for (let i = 0; i < 30; i++) {
        dailyAccess[i] += stat.accessFrequency.daily[i] || 0;
      }
    }

    return dailyAccess;
  }

  private aggregateTopSources(stats: MonitoringStats[]): Array<{ name: string; count: number }> {
    const sourceCounts = new Map<string, number>();

    for (const stat of stats) {
      for (const [source, count] of Object.entries(stat.sources)) {
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + count);
      }
    }

    return Array.from(sourceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private aggregateQueryTypes(stats: MonitoringStats[]): Record<QueryType, number> {
    const queryTypes: Record<QueryType, number> = {
      SELECT: 0,
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
      ALTER: 0,
      CREATE: 0,
      DROP: 0,
      OTHER: 0,
    };

    for (const stat of stats) {
      for (const [type, count] of Object.entries(stat.queryTypes)) {
        queryTypes[type as QueryType] += count;
      }
    }

    return queryTypes;
  }
}

/**
 * Factory function to create a configured DeprecatedMonitor
 */
export function createDeprecatedMonitor(
  db: NodePgDatabase<any>,
  telemetry: TelemetryCollector,
  alerts: AlertSystem,
  config?: Partial<MonitoringConfig>
): DeprecatedMonitor {
  return new DeprecatedMonitor(db, telemetry, alerts, config);
}

/**
 * Query interceptor to detect deprecated element access
 * This would be integrated with the database driver or ORM
 */
export class QueryInterceptor {
  private monitor: DeprecatedMonitor;
  private deprecatedPatterns: RegExp[] = [];

  constructor(monitor: DeprecatedMonitor) {
    this.monitor = monitor;
    this.updatePatterns();
  }

  /**
   * Intercept and analyze a database query
   */
  async interceptQuery(
    query: string,
    params?: any[],
    source?: AccessSource
  ): Promise<{ proceed: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let proceed = true;

    // Check if query touches deprecated elements
    for (const pattern of this.deprecatedPatterns) {
      if (pattern.test(query)) {
        const match = query.match(pattern);
        if (match) {
          const elementName = match[1];
          const queryType = this.detectQueryType(query);

          // Record the access
          await this.monitor.recordAccess(
            elementName,
            'unknown', // Would need to determine type
            source || {
              type: 'unknown',
              identifier: 'query-interceptor',
              origin: 'database',
            },
            queryType,
            { query, params }
          );

          warnings.push(`Query accesses deprecated element: ${elementName}`);
        }
      }
    }

    return { proceed, warnings };
  }

  private updatePatterns(): void {
    // Update patterns based on currently monitored elements
    // This would be called when new elements are added to monitoring
    this.deprecatedPatterns = [
      /(\w+_deprecated_\d{8}_\w+)/g, // General deprecated pattern
    ];
  }

  private detectQueryType(query: string): QueryType {
    const upperQuery = query.toUpperCase().trim();

    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    if (upperQuery.startsWith('ALTER')) return 'ALTER';
    if (upperQuery.startsWith('CREATE')) return 'CREATE';
    if (upperQuery.startsWith('DROP')) return 'DROP';

    return 'OTHER';
  }
}