export const placeholder = "lib package";

// Re-export validation functions and schemas (client-safe)
export * from "./schemas";

// Re-export utility functions (client-safe)
export * from "./utils";

// Re-export calculation functions (client-safe)
export * from "./calc/abv";
export * from "./calc/yield";
export * from "./calc/cogs";
export * from "./calc/financial";
export * from "./calc/fermentation";
export * from "./calculations/sugar";
export * from "./calculations/pasteurization";
export * from "./calculations/ttb";

// Re-export apple-related constants and utilities (client-safe)
export * from "./apples";

// Re-export cellar operation constants (client-safe)
export * from "./constants/cellar";

// Re-export date validation utilities (client-safe)
export * from "./validation/dateValidation";

// Re-export naming utilities (client-safe - no crypto)
export * from "./naming/batchName";

// Re-export audit event bus (uses EventEmitter, safe for server)
export {
  auditEventBus,
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
  publishSoftDeleteEvent,
  publishRestoreEvent,
  createDatabaseAuditSubscriber,
} from "./audit/eventBus";

// Export audit types only (no crypto-based implementations)
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

// Note: Server-only exports with crypto should be imported directly:
// import { generateAuditChecksum } from "lib/src/audit/service"
// import { createBatchesFromPressCompletion } from "lib/src/press/createBatchesFromPressCompletion"
