import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../schema";

// Audit operation types
export const auditOperationEnum = pgEnum("audit_operation", [
  "create",
  "update",
  "delete",
  "soft_delete",
  "restore",
]);

// Audit logs table - stores complete audit trail for all mutations
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What was changed
    tableName: text("table_name").notNull(),
    recordId: uuid("record_id").notNull(),
    operation: auditOperationEnum("operation").notNull(),

    // Before/after snapshots
    oldData: jsonb("old_data"), // Complete state before change (for update/delete)
    newData: jsonb("new_data"), // Complete state after change (for create/update)
    diffData: jsonb("diff_data"), // Computed diff between old and new

    // User attribution
    changedBy: uuid("changed_by").references(() => users.id),
    changedByEmail: text("changed_by_email"), // Backup in case user is deleted

    // Temporal information
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Additional context
    reason: text("reason"), // Optional reason for the change
    ipAddress: text("ip_address"), // IP address of the user making the change
    userAgent: text("user_agent"), // User agent string
    sessionId: text("session_id"), // Session identifier

    // Audit metadata
    auditVersion: text("audit_version").notNull().default("1.0"), // Schema version for future migrations
    checksum: text("checksum"), // Hash of the audit data for integrity verification

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Performance indexes
    tableNameIdx: index("audit_logs_table_name_idx").on(table.tableName),
    recordIdIdx: index("audit_logs_record_id_idx").on(table.recordId),
    changedByIdx: index("audit_logs_changed_by_idx").on(table.changedBy),
    changedAtIdx: index("audit_logs_changed_at_idx").on(table.changedAt),
    operationIdx: index("audit_logs_operation_idx").on(table.operation),

    // Composite indexes for common queries
    tableRecordIdx: index("audit_logs_table_record_idx").on(
      table.tableName,
      table.recordId,
    ),
    userTimeIdx: index("audit_logs_user_time_idx").on(
      table.changedBy,
      table.changedAt,
    ),
    tableTimeIdx: index("audit_logs_table_time_idx").on(
      table.tableName,
      table.changedAt,
    ),
  }),
);

// Audit log relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  changedByUser: one(users, {
    fields: [auditLogs.changedBy],
    references: [users.id],
  }),
}));

// Type exports for use in other packages
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditOperation =
  | "create"
  | "update"
  | "delete"
  | "soft_delete"
  | "restore";

// auditMetadata table removed - was not being used
