/**
 * Square POS Integration Schema
 *
 * Tables for managing Square API integration and inventory synchronization
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "../schema";
import { inventoryItems } from "./packaging";

/**
 * Sync direction enum
 */
export const syncDirectionEnum = pgEnum("sync_direction", [
  "to_square",
  "from_square",
]);

/**
 * Sync type enum
 */
export const syncTypeEnum = pgEnum("sync_type", [
  "inventory_update",
  "product_mapping",
  "manual_sync",
  "webhook",
]);

/**
 * Sync status enum
 */
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

/**
 * Square environment enum
 */
export const squareEnvironmentEnum = pgEnum("square_environment", [
  "production",
  "sandbox",
]);

/**
 * Square Sync Log
 *
 * Tracks all inventory sync events between the cidery app and Square POS
 */
export const squareSyncLog = pgTable(
  "square_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Sync metadata
    syncDirection: syncDirectionEnum("sync_direction").notNull(),
    syncType: syncTypeEnum("sync_type").notNull(),

    // Related records
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItems.id
    ),
    squareCatalogItemId: text("square_catalog_item_id"),
    squareVariationId: text("square_variation_id"),

    // Sync details
    quantityBefore: integer("quantity_before"),
    quantityAfter: integer("quantity_after"),
    squareQuantity: integer("square_quantity"),

    // Status
    status: syncStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),

    // Square webhook data (if applicable)
    squareEventId: text("square_event_id"),
    squareEventType: text("square_event_type"),
    webhookPayload: jsonb("webhook_payload"),
  },
  (table) => ({
    statusIdx: index("idx_square_sync_status").on(
      table.status,
      table.createdAt
    ),
    inventoryIdx: index("idx_square_sync_inventory").on(
      table.inventoryItemId
    ),
    eventIdx: index("idx_square_sync_event").on(table.squareEventId),
  })
);

/**
 * Square Configuration
 *
 * Stores Square API credentials and sync configuration (singleton table)
 */
export const squareConfig = pgTable("square_config", {
  id: uuid("id").primaryKey().defaultRandom(),

  // OAuth tokens (should be encrypted in application layer)
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),

  // Square account info
  merchantId: text("merchant_id"),
  locationId: text("location_id"),
  environment: squareEnvironmentEnum("environment"),

  // Sync settings
  autoSyncEnabled: boolean("auto_sync_enabled").default(true),
  webhookSignatureKey: text("webhook_signature_key"),
  lastFullSyncAt: timestamp("last_full_sync_at"),

  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// Relations
export const squareSyncLogRelations = relations(
  squareSyncLog,
  ({ one }) => ({
    inventoryItem: one(inventoryItems, {
      fields: [squareSyncLog.inventoryItemId],
      references: [inventoryItems.id],
    }),
  })
);

export const squareConfigRelations = relations(squareConfig, ({ one }) => ({
  createdByUser: one(users, {
    fields: [squareConfig.createdBy],
    references: [users.id],
    relationName: "squareConfigCreatedBy",
  }),
  updatedByUser: one(users, {
    fields: [squareConfig.updatedBy],
    references: [users.id],
    relationName: "squareConfigUpdatedBy",
  }),
}));
