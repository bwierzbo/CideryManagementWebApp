import {
  pgTable,
  uuid,
  text,
  decimal,
  integer,
  timestamp,
  boolean,
  date,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { unitEnum } from "./shared";
import { batches, users, vessels } from "../schema";

// Packaging-specific enums
export const packageTypeEnum = pgEnum("package_type", ["bottle", "can", "keg"]);
export const carbonationLevelEnum = pgEnum("carbonation_level", [
  "still",
  "petillant",
  "sparkling",
]);
export const fillCheckEnum = pgEnum("fill_check", [
  "pass",
  "fail",
  "not_tested",
]);
export const bottleRunStatusEnum = pgEnum("bottle_run_status", [
  "completed",
  "voided",
]);
export const packageSizeTypeEnum = pgEnum("package_size_type", [
  "bottle",
  "can",
  "keg",
]);
export const bottleRunPhotoTypeEnum = pgEnum("bottle_run_photo_type", [
  "fill_level",
  "label_placement",
  "other",
]);

// Package size reference table for dropdown population
export const packageSizes = pgTable(
  "package_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sizeML: integer("size_ml").notNull(),
    sizeOz: decimal("size_oz", { precision: 6, scale: 2 }),
    displayName: text("display_name").notNull(),
    packageType: packageSizeTypeEnum("package_type").notNull(),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint to prevent duplicate sizes for same package type
    sizePackageTypeUniqueIdx: uniqueIndex(
      "package_sizes_size_package_type_unique_idx",
    ).on(table.sizeML, table.packageType),
    packageTypeIdx: index("package_sizes_package_type_idx").on(
      table.packageType,
    ),
    sortOrderIdx: index("package_sizes_sort_order_idx").on(table.sortOrder),
  }),
);

// Core bottling operation record
export const bottleRuns = pgTable(
  "bottle_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull(),
    vesselId: uuid("vessel_id")
      .notNull(),
    packagedAt: timestamp("packaged_at").notNull(),
    packageType: packageTypeEnum("package_type").notNull(),
    packageSizeML: integer("package_size_ml").notNull(),
    unitSize: decimal("unit_size", { precision: 10, scale: 4 }).notNull(), // Computed from package_size_ml
    unitSizeUnit: unitEnum("unit_size_unit").notNull().default("L"),
    unitsProduced: integer("units_produced").notNull(),
    volumeTaken: decimal("volume_taken", {
      precision: 10,
      scale: 2,
    }).notNull(),
    volumeTakenUnit: unitEnum("volume_taken_unit").notNull().default("L"),
    loss: decimal("loss", { precision: 10, scale: 2 }).notNull(),
    lossUnit: unitEnum("loss_unit").notNull().default("L"),
    // Loss percentage (computed in application logic)
    lossPercentage: decimal("loss_percentage", { precision: 5, scale: 2 }),

    // QA Fields (optional)
    abvAtPackaging: decimal("abv_at_packaging", { precision: 5, scale: 2 }),
    carbonationLevel: carbonationLevelEnum("carbonation_level"),
    fillCheck: fillCheckEnum("fill_check"),
    fillVarianceML: decimal("fill_variance_ml", { precision: 6, scale: 2 }),
    testMethod: text("test_method"),
    testDate: timestamp("test_date"),
    qaTechnicianId: uuid("qa_technician_id"),
    qaNotes: text("qa_notes"),

    // Metadata
    productionNotes: text("production_notes"),
    status: bottleRunStatusEnum("status").default("completed"),
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at"),
    voidedBy: uuid("voided_by"),

    // Audit fields
    createdBy: uuid("created_by")
      .notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Performance indexes
    batchIdx: index("bottle_runs_batch_idx").on(table.batchId),
    vesselIdx: index("bottle_runs_vessel_idx").on(table.vesselId),
    packagedAtIdx: index("bottle_runs_packaged_at_idx").on(table.packagedAt),
    statusIdx: index("bottle_runs_status_idx").on(table.status),

    // Composite indexes for common queries
    batchStatusIdx: index("bottle_runs_batch_status_idx").on(
      table.batchId,
      table.status,
    ),

    // Check constraints for data integrity
    unitsProducedPositive: sql`CHECK (units_produced >= 0)`,
    volumeTakenPositive: sql`CHECK (volume_taken > 0)`,
    lossNonNegative: sql`CHECK (loss >= 0)`,
  }),
);

// Optional QA photos for bottle runs
export const bottleRunPhotos = pgTable(
  "bottle_run_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bottleRunId: uuid("bottle_run_id")
      .notNull()
      .references(() => bottleRuns.id, { onDelete: "cascade" }),
    photoUrl: text("photo_url").notNull(),
    photoType: bottleRunPhotoTypeEnum("photo_type"),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by")
      .notNull(),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  },
  (table) => ({
    bottleRunIdx: index("bottle_run_photos_bottle_run_idx").on(
      table.bottleRunId,
    ),
    uploadedByIdx: index("bottle_run_photos_uploaded_by_idx").on(
      table.uploadedBy,
    ),
  }),
);

// Relations
export const packageSizesRelations = relations(packageSizes, ({ many }) => ({
  // No direct relations needed as this is a reference table
}));

export const bottleRunsRelations = relations(
  bottleRuns,
  ({ one, many }) => ({
    // Core relationships
    batch: one(batches, {
      fields: [bottleRuns.batchId],
      references: [batches.id],
    }),
    vessel: one(vessels, {
      fields: [bottleRuns.vesselId],
      references: [vessels.id],
    }),

    // User relationships
    qaTechnician: one(users, {
      fields: [bottleRuns.qaTechnicianId],
      references: [users.id],
    }),
    voidedByUser: one(users, {
      fields: [bottleRuns.voidedBy],
      references: [users.id],
    }),
    createdByUser: one(users, {
      fields: [bottleRuns.createdBy],
      references: [users.id],
    }),
    updatedByUser: one(users, {
      fields: [bottleRuns.updatedBy],
      references: [users.id],
    }),

    // Child relationships
    photos: many(bottleRunPhotos),
    inventoryItems: many(inventoryItems),
  }),
);

export const bottleRunPhotosRelations = relations(
  bottleRunPhotos,
  ({ one }) => ({
    bottleRun: one(bottleRuns, {
      fields: [bottleRunPhotos.bottleRunId],
      references: [bottleRuns.id],
    }),
    uploadedByUser: one(users, {
      fields: [bottleRunPhotos.uploadedBy],
      references: [users.id],
    }),
  }),
);

// Finished goods inventory for packaged products
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id"),
    lotCode: text("lot_code").unique(),
    bottleRunId: uuid("bottle_run_id").references(() => bottleRuns.id),
    packageType: text("package_type"),
    packageSizeML: integer("package_size_ml"),
    expirationDate: date("expiration_date"),

    // Purchase date reference - derived from batch composition data
    // This represents the weighted average purchase date of raw materials in the batch
    purchaseDate: date("purchase_date"),

    // Standard audit fields
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Index for lot code lookups as specified in PRD
    lotCodeIdx: index("idx_inventory_lot_code").on(table.lotCode),
    batchIdx: index("inventory_items_batch_idx").on(table.batchId),
    bottleRunIdx: index("inventory_items_bottle_run_idx").on(
      table.bottleRunId,
    ),
    expirationDateIdx: index("inventory_items_expiration_date_idx").on(
      table.expirationDate,
    ),
    purchaseDateIdx: index("inventory_items_purchase_date_idx").on(
      table.purchaseDate,
    ),
  }),
);

// Inventory items relations
export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  batch: one(batches, {
    fields: [inventoryItems.batchId],
    references: [batches.id],
  }),
  bottleRun: one(bottleRuns, {
    fields: [inventoryItems.bottleRunId],
    references: [bottleRuns.id],
  }),
}));
