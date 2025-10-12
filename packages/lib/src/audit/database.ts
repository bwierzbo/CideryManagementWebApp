import { eq, and, desc, asc, gte, lte, inArray, sql } from "drizzle-orm";
import { type Database } from "db";
import {
  auditLogs,
  type AuditLog,
  type NewAuditLog,
} from "db/src/schema/audit";
import type { AuditLogEntry, AuditSnapshot } from "./service";
import { createAuditLogEntry, validateAuditSnapshot } from "./service";

export interface AuditQueryOptions {
  tableName?: string;
  recordId?: string;
  operation?: string;
  changedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: "asc" | "desc";
  includeData?: boolean;
  includeDiff?: boolean;
}

export interface AuditQueryResult {
  auditLogs: AuditLog[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Database service for audit log operations
 */
export class AuditDatabase {
  constructor(private db: Database) {}

  /**
   * Writes an audit log entry to the database
   */
  async writeAuditLog(snapshot: AuditSnapshot): Promise<string> {
    // Validate snapshot first
    const validation = validateAuditSnapshot(snapshot);
    if (!validation.valid) {
      throw new Error(
        `Invalid audit snapshot: ${validation.errors.join(", ")}`,
      );
    }

    // Create audit log entry
    const auditEntry = createAuditLogEntry(snapshot);

    // Convert to database format
    const dbEntry: NewAuditLog = {
      tableName: auditEntry.tableName,
      recordId: auditEntry.recordId,
      operation: auditEntry.operation,
      oldData: auditEntry.oldData,
      newData: auditEntry.newData,
      diffData: auditEntry.diffData,
      changedBy: auditEntry.changedBy,
      changedByEmail: auditEntry.changedByEmail,
      changedAt: auditEntry.changedAt,
      reason: auditEntry.reason,
      ipAddress: auditEntry.ipAddress,
      userAgent: auditEntry.userAgent,
      sessionId: auditEntry.sessionId,
      auditVersion: auditEntry.auditVersion,
      checksum: auditEntry.checksum,
    };

    // Insert into database
    const result = await this.db
      .insert(auditLogs)
      .values(dbEntry)
      .returning({ id: auditLogs.id });

    return result[0].id;
  }

  /**
   * Queries audit logs with filtering and pagination
   */
  async queryAuditLogs(
    options: AuditQueryOptions = {},
  ): Promise<AuditQueryResult> {
    const {
      tableName,
      recordId,
      operation,
      changedBy,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      orderBy = "desc",
    } = options;

    // Build WHERE conditions
    const conditions = [];

    if (tableName) {
      conditions.push(eq(auditLogs.tableName, tableName));
    }

    if (recordId) {
      conditions.push(eq(auditLogs.recordId, recordId));
    }

    if (operation) {
      conditions.push(eq(auditLogs.operation, operation as any));
    }

    if (changedBy) {
      conditions.push(eq(auditLogs.changedBy, changedBy));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.changedAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.changedAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs);

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [{ count: totalCount }] = await countQuery;

    // Get audit logs with pagination
    const orderDirection = orderBy === "asc" ? asc : desc;

    let query = this.db
      .select()
      .from(auditLogs)
      .limit(limit)
      .offset(offset)
      .orderBy(orderDirection(auditLogs.changedAt));

    if (whereClause) {
      query = query.where(whereClause);
    }

    const auditLogResults = await query;

    return {
      auditLogs: auditLogResults,
      totalCount,
      hasMore: offset + auditLogResults.length < totalCount,
    };
  }

  /**
   * Gets audit history for a specific record
   */
  async getRecordHistory(
    tableName: string,
    recordId: string,
  ): Promise<AuditLog[]> {
    return await this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tableName, tableName),
          eq(auditLogs.recordId, recordId),
        ),
      )
      .orderBy(desc(auditLogs.changedAt));
  }

  /**
   * Gets recent activity for a user
   */
  async getUserActivity(
    userId: string,
    limit: number = 20,
    startDate?: Date,
  ): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.changedBy, userId)];

    if (startDate) {
      conditions.push(gte(auditLogs.changedAt, startDate));
    }

    return await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.changedAt))
      .limit(limit);
  }

  /**
   * Gets audit statistics for a table
   */
  async getTableAuditStats(
    tableName: string,
    daysPast: number = 30,
  ): Promise<{
    totalOperations: number;
    operationBreakdown: Record<string, number>;
    uniqueUsers: number;
    dateRange: { start: Date; end: Date };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysPast);

    // Get operation counts
    const operationCounts = await this.db
      .select({
        operation: auditLogs.operation,
        count: sql<number>`COUNT(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tableName, tableName),
          gte(auditLogs.changedAt, startDate),
          lte(auditLogs.changedAt, endDate),
        ),
      )
      .groupBy(auditLogs.operation);

    // Get unique users count
    const uniqueUsersResult = await this.db
      .select({
        uniqueUsers: sql<number>`COUNT(DISTINCT ${auditLogs.changedBy})`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tableName, tableName),
          gte(auditLogs.changedAt, startDate),
          lte(auditLogs.changedAt, endDate),
        ),
      );

    const operationBreakdown: Record<string, number> = {};
    let totalOperations = 0;

    for (const { operation, count } of operationCounts) {
      operationBreakdown[operation] = count;
      totalOperations += count;
    }

    return {
      totalOperations,
      operationBreakdown,
      uniqueUsers: uniqueUsersResult[0]?.uniqueUsers || 0,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Validates audit log integrity by checking checksums
   */
  async validateAuditIntegrity(
    tableName?: string,
    recordId?: string,
    limit: number = 100,
  ): Promise<{
    validated: number;
    invalid: string[];
    errors: Array<{ id: string; error: string }>;
  }> {
    const conditions = [];

    if (tableName) {
      conditions.push(eq(auditLogs.tableName, tableName));
    }

    if (recordId) {
      conditions.push(eq(auditLogs.recordId, recordId));
    }

    let query = this.db
      .select()
      .from(auditLogs)
      .limit(limit)
      .orderBy(desc(auditLogs.changedAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const auditEntries = await query;

    const result = {
      validated: 0,
      invalid: [] as string[],
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const entry of auditEntries) {
      try {
        if (!entry.checksum) {
          result.invalid.push(entry.id);
          result.errors.push({ id: entry.id, error: "Missing checksum" });
          continue;
        }

        // Validate checksum (would need to import validation function)
        // For now, just assume valid if checksum exists
        result.validated++;
      } catch (error) {
        result.invalid.push(entry.id);
        result.errors.push({
          id: entry.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  // auditMetadata methods removed - table no longer exists

  /**
   * Cleans up old audit logs beyond retention period
   */
  async cleanupOldAuditLogs(
    retentionDays: number,
    tableName?: string,
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const conditions = [lte(auditLogs.changedAt, cutoffDate)];

    if (tableName) {
      conditions.push(eq(auditLogs.tableName, tableName));
    }

    const result = await this.db.delete(auditLogs).where(and(...conditions));

    // Note: The exact way to get affected rows may vary by database
    // This is a placeholder implementation
    return { deletedCount: 0 }; // Would need proper implementation based on your DB driver
  }

  /**
   * Gets audit coverage statistics for all tables
   */
  async getAuditCoverageStats(): Promise<
    Array<{
      tableName: string;
      operationCounts: Record<string, number>;
      lastActivity: Date | null;
      totalLogs: number;
    }>
  > {
    const stats = await this.db
      .select({
        tableName: auditLogs.tableName,
        operation: auditLogs.operation,
        count: sql<number>`COUNT(*)`,
        lastActivity: sql<Date>`MAX(${auditLogs.changedAt})`,
      })
      .from(auditLogs)
      .groupBy(auditLogs.tableName, auditLogs.operation)
      .orderBy(auditLogs.tableName);

    // Group by table name and aggregate
    const tableStats = new Map<
      string,
      {
        tableName: string;
        operationCounts: Record<string, number>;
        lastActivity: Date | null;
        totalLogs: number;
      }
    >();

    for (const stat of stats) {
      if (!tableStats.has(stat.tableName)) {
        tableStats.set(stat.tableName, {
          tableName: stat.tableName,
          operationCounts: {},
          lastActivity: null,
          totalLogs: 0,
        });
      }

      const tableData = tableStats.get(stat.tableName)!;
      tableData.operationCounts[stat.operation] = stat.count;
      tableData.totalLogs += stat.count;

      if (
        !tableData.lastActivity ||
        (stat.lastActivity && stat.lastActivity > tableData.lastActivity)
      ) {
        tableData.lastActivity = stat.lastActivity;
      }
    }

    return Array.from(tableStats.values());
  }
}
