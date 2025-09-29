import { z } from "zod";
import type { AuditLog, AuditOperation } from "db/src/schema/audit";
import {
  AuditDatabase,
  type AuditQueryOptions,
  type AuditQueryResult,
} from "./database";

/**
 * Zod schemas for audit query validation
 */

export const auditQuerySchema = z.object({
  tableName: z.string().optional(),
  recordId: z.string().uuid().optional(),
  operation: z
    .enum(["create", "update", "delete", "soft_delete", "restore"])
    .optional(),
  changedBy: z.string().uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(1000).default(50),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(["asc", "desc"]).default("desc"),
  includeData: z.boolean().default(true),
  includeDiff: z.boolean().default(true),
});

export const recordHistoryQuerySchema = z.object({
  tableName: z.string().min(1),
  recordId: z.string().uuid(),
  limit: z.number().min(1).max(500).default(100),
  includeData: z.boolean().default(true),
  includeDiff: z.boolean().default(true),
});

export const userActivityQuerySchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(1).max(200).default(50),
  startDate: z.date().optional(),
  includeData: z.boolean().default(false),
  includeDiff: z.boolean().default(false),
});

export const auditStatsQuerySchema = z.object({
  tableName: z.string().optional(),
  daysPast: z.number().min(1).max(365).default(30),
});

export const integrityCheckSchema = z.object({
  tableName: z.string().optional(),
  recordId: z.string().uuid().optional(),
  limit: z.number().min(1).max(1000).default(100),
});

/**
 * Type-safe input types derived from schemas
 */
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
export type RecordHistoryQueryInput = z.infer<typeof recordHistoryQuerySchema>;
export type UserActivityQueryInput = z.infer<typeof userActivityQuerySchema>;
export type AuditStatsQueryInput = z.infer<typeof auditStatsQuerySchema>;
export type IntegrityCheckInput = z.infer<typeof integrityCheckSchema>;

/**
 * High-level audit query service that provides validated, type-safe queries
 */
export class AuditQueryService {
  constructor(private auditDatabase: AuditDatabase) {}

  /**
   * Query audit logs with validation and filtering
   */
  async queryAuditLogs(input: AuditQueryInput): Promise<AuditQueryResult> {
    const validatedInput = auditQuerySchema.parse(input);

    // Validate date range
    if (validatedInput.startDate && validatedInput.endDate) {
      if (validatedInput.startDate > validatedInput.endDate) {
        throw new Error("Start date must be before end date");
      }

      // Limit date range to prevent excessive queries
      const maxDays = 365;
      const daysDiff = Math.ceil(
        (validatedInput.endDate.getTime() -
          validatedInput.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff > maxDays) {
        throw new Error(`Date range cannot exceed ${maxDays} days`);
      }
    }

    return await this.auditDatabase.queryAuditLogs(validatedInput);
  }

  /**
   * Get complete audit history for a specific record
   */
  async getRecordHistory(input: RecordHistoryQueryInput): Promise<AuditLog[]> {
    const validatedInput = recordHistoryQuerySchema.parse(input);

    const auditLogs = await this.auditDatabase.getRecordHistory(
      validatedInput.tableName,
      validatedInput.recordId,
    );

    // Apply limit and data filtering
    const limitedLogs = auditLogs.slice(0, validatedInput.limit);

    if (!validatedInput.includeData || !validatedInput.includeDiff) {
      return limitedLogs.map((log) => ({
        ...log,
        oldData: validatedInput.includeData ? log.oldData : undefined,
        newData: validatedInput.includeData ? log.newData : undefined,
        diffData: validatedInput.includeDiff ? log.diffData : undefined,
      }));
    }

    return limitedLogs;
  }

  /**
   * Get recent user activity with validation
   */
  async getUserActivity(input: UserActivityQueryInput): Promise<AuditLog[]> {
    const validatedInput = userActivityQuerySchema.parse(input);

    const auditLogs = await this.auditDatabase.getUserActivity(
      validatedInput.userId,
      validatedInput.limit,
      validatedInput.startDate,
    );

    if (!validatedInput.includeData || !validatedInput.includeDiff) {
      return auditLogs.map((log) => ({
        ...log,
        oldData: validatedInput.includeData ? log.oldData : undefined,
        newData: validatedInput.includeData ? log.newData : undefined,
        diffData: validatedInput.includeDiff ? log.diffData : undefined,
      }));
    }

    return auditLogs;
  }

  /**
   * Get audit statistics for tables
   */
  async getAuditStats(input: AuditStatsQueryInput) {
    const validatedInput = auditStatsQuerySchema.parse(input);

    if (validatedInput.tableName) {
      return await this.auditDatabase.getTableAuditStats(
        validatedInput.tableName,
        validatedInput.daysPast,
      );
    }

    // Get coverage stats for all tables
    return await this.auditDatabase.getAuditCoverageStats();
  }

  /**
   * Validate audit log integrity
   */
  async validateIntegrity(input: IntegrityCheckInput) {
    const validatedInput = integrityCheckSchema.parse(input);

    return await this.auditDatabase.validateAuditIntegrity(
      validatedInput.tableName,
      validatedInput.recordId,
      validatedInput.limit,
    );
  }

  /**
   * Get audit logs for specific operations on a table
   */
  async getTableOperations(
    tableName: string,
    operations: AuditOperation[],
    limit: number = 50,
    startDate?: Date,
  ): Promise<AuditLog[]> {
    if (!tableName) {
      throw new Error("Table name is required");
    }

    if (operations.length === 0) {
      throw new Error("At least one operation must be specified");
    }

    const validOperations = [
      "create",
      "update",
      "delete",
      "soft_delete",
      "restore",
    ];
    for (const op of operations) {
      if (!validOperations.includes(op)) {
        throw new Error(`Invalid operation: ${op}`);
      }
    }

    const results = await Promise.all(
      operations.map((operation) =>
        this.auditDatabase.queryAuditLogs({
          tableName,
          operation,
          startDate,
          limit: Math.ceil(limit / operations.length),
          orderBy: "desc",
        }),
      ),
    );

    // Combine and sort results
    const allLogs = results.flatMap((result) => result.auditLogs);

    return allLogs
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Search audit logs by content
   */
  async searchAuditLogs(
    searchTerm: string,
    tableName?: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new Error("Search term must be at least 2 characters");
    }

    // This would require full-text search implementation in the database
    // For now, we'll return basic filtering
    const queryOptions: AuditQueryOptions = {
      tableName,
      limit,
      orderBy: "desc",
    };

    const result = await this.auditDatabase.queryAuditLogs(queryOptions);

    // Simple text search in reason and changed by email
    return result.auditLogs.filter((log) => {
      const searchableText = [
        log.reason,
        log.changedByEmail,
        JSON.stringify(log.newData),
        JSON.stringify(log.oldData),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm.toLowerCase());
    });
  }

  /**
   * Get audit summary for a date range
   */
  async getAuditSummary(startDate: Date, endDate: Date) {
    if (startDate > endDate) {
      throw new Error("Start date must be before end date");
    }

    const maxDays = 90;
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff > maxDays) {
      throw new Error(`Date range cannot exceed ${maxDays} days for summary`);
    }

    const result = await this.auditDatabase.queryAuditLogs({
      startDate,
      endDate,
      limit: 10000, // Large limit for summary
      includeData: false,
      includeDiff: false,
    });

    // Aggregate statistics
    const summary = {
      totalOperations: result.totalCount,
      dateRange: { startDate, endDate },
      operationBreakdown: {} as Record<string, number>,
      tableBreakdown: {} as Record<string, number>,
      userBreakdown: {} as Record<string, number>,
      dailyActivity: {} as Record<string, number>,
    };

    result.auditLogs.forEach((log) => {
      // Operation breakdown
      summary.operationBreakdown[log.operation] =
        (summary.operationBreakdown[log.operation] || 0) + 1;

      // Table breakdown
      summary.tableBreakdown[log.tableName] =
        (summary.tableBreakdown[log.tableName] || 0) + 1;

      // User breakdown
      if (log.changedByEmail) {
        summary.userBreakdown[log.changedByEmail] =
          (summary.userBreakdown[log.changedByEmail] || 0) + 1;
      }

      // Daily activity
      const dateKey = log.changedAt.toISOString().split("T")[0];
      summary.dailyActivity[dateKey] =
        (summary.dailyActivity[dateKey] || 0) + 1;
    });

    return summary;
  }

  /**
   * Get audit logs that might indicate suspicious activity
   */
  async getSuspiciousActivity(
    daysPast: number = 7,
    thresholds: {
      maxOperationsPerUser?: number;
      maxDeletesPerHour?: number;
      suspiciousPatterns?: string[];
    } = {},
  ) {
    const {
      maxOperationsPerUser = 100,
      maxDeletesPerHour = 10,
      suspiciousPatterns = ["bulk", "admin", "override", "bypass"],
    } = thresholds;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysPast);

    const result = await this.auditDatabase.queryAuditLogs({
      startDate,
      limit: 5000,
      orderBy: "desc",
    });

    const suspiciousLogs: Array<AuditLog & { reason?: string }> = [];

    // Group by user
    const userActivity = new Map<string, AuditLog[]>();
    const hourlyDeletes = new Map<string, number>();

    result.auditLogs.forEach((log) => {
      // Check for suspicious patterns in reason
      if (log.reason) {
        const hasPattern = suspiciousPatterns.some((pattern) =>
          log.reason!.toLowerCase().includes(pattern.toLowerCase()),
        );
        if (hasPattern) {
          suspiciousLogs.push({
            ...log,
            reason: "Suspicious pattern in reason",
          });
        }
      }

      // Track user activity
      const userId = log.changedBy || "unknown";
      if (!userActivity.has(userId)) {
        userActivity.set(userId, []);
      }
      userActivity.get(userId)!.push(log);

      // Track deletes by hour
      if (log.operation === "delete") {
        const hourKey = log.changedAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        hourlyDeletes.set(hourKey, (hourlyDeletes.get(hourKey) || 0) + 1);
      }
    });

    // Check for users with excessive activity
    userActivity.forEach((logs, userId) => {
      if (logs.length > maxOperationsPerUser) {
        logs.forEach((log) => {
          suspiciousLogs.push({
            ...log,
            reason: `User exceeded ${maxOperationsPerUser} operations`,
          });
        });
      }
    });

    // Check for excessive deletes per hour
    hourlyDeletes.forEach((count, hour) => {
      if (count > maxDeletesPerHour) {
        result.auditLogs
          .filter(
            (log) =>
              log.operation === "delete" &&
              log.changedAt.toISOString().slice(0, 13) === hour,
          )
          .forEach((log) => {
            suspiciousLogs.push({
              ...log,
              reason: `Excessive deletes in hour (${count})`,
            });
          });
      }
    });

    return suspiciousLogs;
  }
}
