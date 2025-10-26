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
import { batchCarbonationOperations } from "./carbonation";

// Packaging-specific enums
export const packageTypeEnum = pgEnum("package_type", ["bottle", "can", "keg"]);
export const carbonationMethodEnum = pgEnum("carbonation_method", [
  "natural",
  "forced",
  "none",
]);
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
    volumeTakenLiters: decimal("volume_taken_liters", {
      precision: 10,
      scale: 3,
    }), // Normalized volume in liters (auto-maintained by trigger)
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

    // Carbonation tracking
    /**
     * How this batch was carbonated
     * - 'natural': Bottle/keg conditioning with residual sugars
     * - 'forced': Tank/keg pressurized with CO2
     * - 'none': Still cider, no carbonation
     */
    carbonationMethod: carbonationMethodEnum("carbonation_method").default(
      "none",
    ),
    /**
     * Links to the carbonation operation if forced carbonation was used
     * NULL for natural or no carbonation
     */
    sourceCarbonationOperationId: uuid("source_carbonation_operation_id")
      .references(() => batchCarbonationOperations.id),

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

// Junction table for tracking packaging materials used in each bottle run
export const bottleRunMaterials = pgTable(
  "bottle_run_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bottleRunId: uuid("bottle_run_id")
      .notNull()
      .references(() => bottleRuns.id, { onDelete: "cascade" }),
    // Reference to the packaging purchase line item used
    packagingPurchaseItemId: uuid("packaging_purchase_item_id")
      .notNull(),
    // Quantity used from this specific purchase line
    quantityUsed: integer("quantity_used").notNull(),
    // Material type for reporting (bottles, caps, labels, etc.)
    materialType: text("material_type").notNull(), // e.g., "Primary Packaging", "Caps", "Labels"
    // Audit fields
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull(),
  },
  (table) => ({
    bottleRunIdx: index("bottle_run_materials_bottle_run_idx").on(
      table.bottleRunId,
    ),
    packagingItemIdx: index("bottle_run_materials_packaging_item_idx").on(
      table.packagingPurchaseItemId,
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

    // Carbonation operation relation
    sourceCarbonationOperation: one(batchCarbonationOperations, {
      fields: [bottleRuns.sourceCarbonationOperationId],
      references: [batchCarbonationOperations.id],
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
    materials: many(bottleRunMaterials),
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

export const bottleRunMaterialsRelations = relations(
  bottleRunMaterials,
  ({ one }) => ({
    bottleRun: one(bottleRuns, {
      fields: [bottleRunMaterials.bottleRunId],
      references: [bottleRuns.id],
    }),
    createdByUser: one(users, {
      fields: [bottleRunMaterials.createdBy],
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
