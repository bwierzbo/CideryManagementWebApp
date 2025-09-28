import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import { AuditDatabase } from "lib/src/audit/database";
import {
  AuditQueryService,
  auditQuerySchema,
  recordHistoryQuerySchema,
  userActivityQuerySchema,
  auditStatsQuerySchema,
  integrityCheckSchema,
} from "lib/src/audit/queries";
import { db } from "db";
import { TRPCError } from "@trpc/server";

// Initialize audit services
const auditDatabase = new AuditDatabase(db);
const auditQueryService = new AuditQueryService(auditDatabase);

export const auditRouter = router({
  /**
   * Query audit logs with filtering and pagination
   */
  queryLogs: createRbacProcedure("list", "audit")
    .input(auditQuerySchema)
    .query(async ({ input }) => {
      try {
        return await auditQueryService.queryAuditLogs(input);
      } catch (error) {
        console.error("Error querying audit logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to query audit logs",
        });
      }
    }),

  /**
   * Get complete audit history for a specific record
   */
  getRecordHistory: createRbacProcedure("list", "audit")
    .input(recordHistoryQuerySchema)
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getRecordHistory(input);
      } catch (error) {
        console.error("Error getting record history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get record history",
        });
      }
    }),

  /**
   * Get recent user activity
   */
  getUserActivity: createRbacProcedure("list", "audit")
    .input(userActivityQuerySchema)
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getUserActivity(input);
      } catch (error) {
        console.error("Error getting user activity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get user activity",
        });
      }
    }),

  /**
   * Get audit statistics
   */
  getStats: createRbacProcedure("list", "audit")
    .input(auditStatsQuerySchema)
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getAuditStats(input);
      } catch (error) {
        console.error("Error getting audit stats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get audit stats",
        });
      }
    }),

  /**
   * Validate audit log integrity
   */
  validateIntegrity: createRbacProcedure("list", "audit")
    .input(integrityCheckSchema)
    .query(async ({ input }) => {
      try {
        return await auditQueryService.validateIntegrity(input);
      } catch (error) {
        console.error("Error validating audit integrity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to validate audit integrity",
        });
      }
    }),

  /**
   * Get audit summary for a date range
   */
  getSummary: createRbacProcedure("list", "audit")
    .input(
      z.object({
        startDate: z.date().or(z.string().transform((val) => new Date(val))),
        endDate: z.date().or(z.string().transform((val) => new Date(val))),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getAuditSummary(
          input.startDate,
          input.endDate,
        );
      } catch (error) {
        console.error("Error getting audit summary:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get audit summary",
        });
      }
    }),

  /**
   * Search audit logs by content
   */
  searchLogs: createRbacProcedure("list", "audit")
    .input(
      z.object({
        searchTerm: z
          .string()
          .min(2, "Search term must be at least 2 characters"),
        tableName: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await auditQueryService.searchAuditLogs(
          input.searchTerm,
          input.tableName,
          input.limit,
        );
      } catch (error) {
        console.error("Error searching audit logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search audit logs",
        });
      }
    }),

  /**
   * Get table operations
   */
  getTableOperations: createRbacProcedure("list", "audit")
    .input(
      z.object({
        tableName: z.string().min(1, "Table name is required"),
        operations: z
          .array(
            z.enum(["create", "update", "delete", "soft_delete", "restore"]),
          )
          .min(1),
        limit: z.number().min(1).max(200).default(50),
        startDate: z
          .date()
          .or(z.string().transform((val) => new Date(val)))
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getTableOperations(
          input.tableName,
          input.operations,
          input.limit,
          input.startDate,
        );
      } catch (error) {
        console.error("Error getting table operations:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get table operations",
        });
      }
    }),

  /**
   * Get suspicious activity report
   */
  getSuspiciousActivity: createRbacProcedure("list", "audit")
    .input(
      z.object({
        daysPast: z.number().min(1).max(90).default(7),
        maxOperationsPerUser: z.number().min(1).max(1000).default(100),
        maxDeletesPerHour: z.number().min(1).max(100).default(10),
        suspiciousPatterns: z
          .array(z.string())
          .default(["bulk", "admin", "override", "bypass"]),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await auditQueryService.getSuspiciousActivity(input.daysPast, {
          maxOperationsPerUser: input.maxOperationsPerUser,
          maxDeletesPerHour: input.maxDeletesPerHour,
          suspiciousPatterns: input.suspiciousPatterns,
        });
      } catch (error) {
        console.error("Error getting suspicious activity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get suspicious activity",
        });
      }
    }),

  /**
   * Get audit coverage report
   */
  getCoverage: createRbacProcedure("list", "audit").query(async () => {
    try {
      return await auditDatabase.getAuditCoverageStats();
    } catch (error) {
      console.error("Error getting audit coverage:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get audit coverage",
      });
    }
  }),

  /**
   * Write audit metadata (admin only)
   */
  writeMetadata: createRbacProcedure("create", "audit")
    .input(
      z.object({
        metadataType: z.string().min(1, "Metadata type is required"),
        data: z.record(z.string(), z.any()),
        tableName: z.string().optional(),
        validUntil: z
          .date()
          .or(z.string().transform((val) => new Date(val)))
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const metadataId = await auditDatabase.writeAuditMetadata(
          input.metadataType,
          input.data,
          input.tableName,
          input.validUntil,
        );

        return {
          success: true,
          metadataId,
          message: "Audit metadata written successfully",
        };
      } catch (error) {
        console.error("Error writing audit metadata:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to write audit metadata",
        });
      }
    }),

  /**
   * Get audit metadata
   */
  getMetadata: createRbacProcedure("list", "audit")
    .input(
      z.object({
        metadataType: z.string().min(1, "Metadata type is required"),
        tableName: z.string().optional(),
        includeExpired: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await auditDatabase.getAuditMetadata(
          input.metadataType,
          input.tableName,
          input.includeExpired,
        );
      } catch (error) {
        console.error("Error getting audit metadata:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get audit metadata",
        });
      }
    }),

  /**
   * Cleanup old audit logs (admin only)
   */
  cleanup: createRbacProcedure("delete", "audit")
    .input(
      z.object({
        retentionDays: z.number().min(1).max(3650), // Max 10 years
        tableName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await auditDatabase.cleanupOldAuditLogs(
          input.retentionDays,
          input.tableName,
        );

        return {
          success: true,
          deletedCount: result.deletedCount,
          message: `Cleaned up ${result.deletedCount} old audit logs`,
        };
      } catch (error) {
        console.error("Error cleaning up audit logs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cleanup audit logs",
        });
      }
    }),
});
