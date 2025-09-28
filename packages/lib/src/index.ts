export const placeholder = "lib package";

// Re-export audit functions
export {
  auditEventBus,
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
  publishSoftDeleteEvent,
  publishRestoreEvent,
  createDatabaseAuditSubscriber,
} from "./audit/eventBus";

// Re-export validation functions and schemas
export * from "./validation";
export * from "./schemas";

// Re-export utility functions
export * from "./utils";

// Re-export calculation functions
export * from "./calc/abv";
export * from "./calc/yield";
export * from "./calc/cogs";
export * from "./calc/financial";

// Re-export apple-related constants and utilities
export * from "./apples";

// Re-export naming utilities
export * from "./naming/batchName";

// Re-export press domain services
export * from "./press/createBatchesFromPressCompletion";

// Re-export audit service functions
export {
  generateAuditChecksum,
  validateAuditIntegrity,
  generateDataDiff,
  sanitizeAuditData,
  createAuditLogEntry,
  filterAuditDataForQuery,
  validateAuditSnapshot,
  extractChangedFields,
  generateChangeSummary,
} from "./audit/service";

// Re-export audit database functions
export { AuditDatabase } from "./audit/database";

// Re-export audit query functions
export {
  AuditQueryService,
  auditQuerySchema,
  recordHistoryQuerySchema,
  userActivityQuerySchema,
  auditStatsQuerySchema,
  integrityCheckSchema,
} from "./audit/queries";

// Export audit types
export type {
  AuditContext,
  AuditSnapshot,
  AuditLogEntry,
} from "./audit/service";

export type { AuditQueryOptions, AuditQueryResult } from "./audit/database";

export type {
  AuditQueryInput,
  RecordHistoryQueryInput,
  UserActivityQueryInput,
  AuditStatsQueryInput,
  IntegrityCheckInput,
} from "./audit/queries";
