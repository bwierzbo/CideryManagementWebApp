/**
 * TTB Reporting Schema
 *
 * Tables for TTB Form 5120.17 (Wine Premises Operations) compliance reporting
 * and sales channel tracking for hard cider production.
 *
 * Tax Rate: $0.226/gallon for hard cider under 8.5% ABV
 * Small Producer Credit: $0.056/gallon (first 30,000 gallons annually)
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, vessels, batches, batchVolumeAdjustments } from "../schema";

/**
 * Sales channel enum for categorizing distributions
 */
export const salesChannelEnum = pgEnum("sales_channel", [
  "tasting_room",
  "wholesale",
  "online_dtc",
  "events",
]);

/**
 * TTB report period type enum
 */
export const ttbPeriodTypeEnum = pgEnum("ttb_period_type", [
  "monthly",
  "quarterly",
  "annual",
]);

/**
 * TTB report status enum
 */
export const ttbReportStatusEnum = pgEnum("ttb_report_status", [
  "draft",
  "submitted",
]);

/**
 * Sales Channels Reference Table
 *
 * Defines the available sales channels for distribution tracking.
 * All tax-paid removals are categorized by channel for TTB reporting.
 */
export const salesChannels = pgTable(
  "sales_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: salesChannelEnum("code").notNull().unique(),
    name: text("name").notNull(),
    /**
     * TTB category for reporting purposes
     * Most removals are "tax_paid_removals" but could include others
     * like "tax_free_removals" for samples/exhibitions
     */
    ttbCategory: text("ttb_category").notNull().default("tax_paid_removals"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    sortOrderIdx: index("sales_channels_sort_order_idx").on(table.sortOrder),
    activeIdx: index("sales_channels_active_idx").on(table.isActive),
  }),
);

/**
 * TTB Reporting Periods
 *
 * Stores snapshots of TTB Form 5120.17 data for each reporting period.
 * This allows historical reporting and auditing while preserving
 * point-in-time values even if underlying data changes.
 *
 * All volume values are in wine gallons (1 wine gallon = 3.78541 liters)
 */
export const ttbReportingPeriods = pgTable(
  "ttb_reporting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodType: ttbPeriodTypeEnum("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Part I - Beginning Inventory (wine gallons)
    beginningInventoryBulkGallons: numeric("beginning_inventory_bulk_gallons", {
      precision: 12,
      scale: 3,
    }),
    beginningInventoryBottledGallons: numeric(
      "beginning_inventory_bottled_gallons",
      { precision: 12, scale: 3 },
    ),
    beginningInventoryTotalGallons: numeric(
      "beginning_inventory_total_gallons",
      { precision: 12, scale: 3 },
    ),

    // Part II - Wine Produced (wine gallons)
    wineProducedGallons: numeric("wine_produced_gallons", {
      precision: 12,
      scale: 3,
    }),

    // Part III - Tax-Paid Removals by Channel (wine gallons)
    taxPaidTastingRoomGallons: numeric("tax_paid_tasting_room_gallons", {
      precision: 12,
      scale: 3,
    }),
    taxPaidWholesaleGallons: numeric("tax_paid_wholesale_gallons", {
      precision: 12,
      scale: 3,
    }),
    taxPaidOnlineDtcGallons: numeric("tax_paid_online_dtc_gallons", {
      precision: 12,
      scale: 3,
    }),
    taxPaidEventsGallons: numeric("tax_paid_events_gallons", {
      precision: 12,
      scale: 3,
    }),
    taxPaidRemovalsTotalGallons: numeric("tax_paid_removals_total_gallons", {
      precision: 12,
      scale: 3,
    }),

    // Part IV - Other Removals (wine gallons)
    otherRemovalsSamplesGallons: numeric("other_removals_samples_gallons", {
      precision: 12,
      scale: 3,
    }),
    otherRemovalsBreakageGallons: numeric("other_removals_breakage_gallons", {
      precision: 12,
      scale: 3,
    }),
    otherRemovalsLossesGallons: numeric("other_removals_losses_gallons", {
      precision: 12,
      scale: 3,
    }),
    otherRemovalsTotalGallons: numeric("other_removals_total_gallons", {
      precision: 12,
      scale: 3,
    }),

    // Part V - Ending Inventory (wine gallons)
    endingInventoryBulkGallons: numeric("ending_inventory_bulk_gallons", {
      precision: 12,
      scale: 3,
    }),
    endingInventoryBottledGallons: numeric("ending_inventory_bottled_gallons", {
      precision: 12,
      scale: 3,
    }),
    endingInventoryTotalGallons: numeric("ending_inventory_total_gallons", {
      precision: 12,
      scale: 3,
    }),

    // Part VI - Tax Calculation
    taxableGallons: numeric("taxable_gallons", { precision: 12, scale: 3 }),
    /**
     * Tax rate per gallon at time of report
     * Hard cider: $0.226/gallon
     */
    taxRate: numeric("tax_rate", { precision: 8, scale: 4 }),
    /**
     * Small producer credit applied
     * $0.056/gallon for first 30,000 gallons annually
     */
    smallProducerCreditGallons: numeric("small_producer_credit_gallons", {
      precision: 12,
      scale: 3,
    }),
    smallProducerCreditAmount: numeric("small_producer_credit_amount", {
      precision: 10,
      scale: 2,
    }),
    /**
     * Net tax owed after credits
     */
    taxOwed: numeric("tax_owed", { precision: 12, scale: 2 }),

    // Status and metadata
    status: ttbReportStatusEnum("status").notNull().default("draft"),
    generatedBy: uuid("generated_by").references(() => users.id),
    submittedAt: timestamp("submitted_at"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    periodTypeIdx: index("ttb_reporting_periods_period_type_idx").on(
      table.periodType,
    ),
    periodStartIdx: index("ttb_reporting_periods_period_start_idx").on(
      table.periodStart,
    ),
    statusIdx: index("ttb_reporting_periods_status_idx").on(table.status),
    // Unique constraint to prevent duplicate reports for same period
    periodUniqueIdx: uniqueIndex("ttb_reporting_periods_unique_idx").on(
      table.periodType,
      table.periodStart,
      table.periodEnd,
    ),
  }),
);

// Relations
export const salesChannelsRelations = relations(salesChannels, () => ({
  // Relations will be added when inventoryDistributions and kegFills get salesChannelId
}));

export const ttbReportingPeriodsRelations = relations(
  ttbReportingPeriods,
  ({ one }) => ({
    generatedByUser: one(users, {
      fields: [ttbReportingPeriods.generatedBy],
      references: [users.id],
      relationName: "ttb_report_generated_by",
    }),
    submittedByUser: one(users, {
      fields: [ttbReportingPeriods.submittedBy],
      references: [users.id],
      relationName: "ttb_report_submitted_by",
    }),
  }),
);

/**
 * TTB Period Snapshot Status Enum
 */
export const ttbSnapshotStatusEnum = pgEnum("ttb_snapshot_status", [
  "draft",
  "review",
  "finalized",
]);

/**
 * TTB Period Snapshots
 *
 * Stores finalized inventory data by tax class for each reporting period.
 * Ending inventory from one period becomes beginning inventory for the next.
 * Supports all TTB Form 5120.17 tax classes.
 *
 * Tax Classes:
 * - Hard Cider: <8.5% ABV, ≤0.64g CO2/100ml, apple/pear only ($0.226/gal, -$0.056 credit)
 * - Wine Not Over 16%: ≤16% ABV ($1.07/gal, -$0.90 credit for small producer)
 * - Wine 16-21%: 16-21% ABV ($1.57/gal)
 * - Wine 21-24%: 21-24% ABV ($3.15/gal)
 * - Sparkling Wine: Naturally carbonated ($3.40/gal)
 * - Carbonated Wine: Artificially carbonated ($3.30/gal)
 */
export const ttbPeriodSnapshots = pgTable(
  "ttb_period_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Period identification
    periodType: ttbPeriodTypeEnum("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    year: integer("year").notNull(),
    periodNumber: integer("period_number"), // Month (1-12) or Quarter (1-4), NULL for annual

    // Bulk wines by tax class (wine gallons)
    bulkHardCider: numeric("bulk_hard_cider", { precision: 10, scale: 3 }).notNull().default("0"),
    bulkWineUnder16: numeric("bulk_wine_under_16", { precision: 10, scale: 3 }).notNull().default("0"),
    bulkWine16To21: numeric("bulk_wine_16_to_21", { precision: 10, scale: 3 }).notNull().default("0"),
    bulkWine21To24: numeric("bulk_wine_21_to_24", { precision: 10, scale: 3 }).notNull().default("0"),
    bulkSparklingWine: numeric("bulk_sparkling_wine", { precision: 10, scale: 3 }).notNull().default("0"),
    bulkCarbonatedWine: numeric("bulk_carbonated_wine", { precision: 10, scale: 3 }).notNull().default("0"),

    // Bottled wines by tax class (wine gallons)
    bottledHardCider: numeric("bottled_hard_cider", { precision: 10, scale: 3 }).notNull().default("0"),
    bottledWineUnder16: numeric("bottled_wine_under_16", { precision: 10, scale: 3 }).notNull().default("0"),
    bottledWine16To21: numeric("bottled_wine_16_to_21", { precision: 10, scale: 3 }).notNull().default("0"),
    bottledWine21To24: numeric("bottled_wine_21_to_24", { precision: 10, scale: 3 }).notNull().default("0"),
    bottledSparklingWine: numeric("bottled_sparkling_wine", { precision: 10, scale: 3 }).notNull().default("0"),
    bottledCarbonatedWine: numeric("bottled_carbonated_wine", { precision: 10, scale: 3 }).notNull().default("0"),

    // Spirits on hand (proof gallons)
    spiritsAppleBrandy: numeric("spirits_apple_brandy", { precision: 10, scale: 3 }).notNull().default("0"),
    spiritsGrape: numeric("spirits_grape", { precision: 10, scale: 3 }).notNull().default("0"),
    spiritsOther: numeric("spirits_other", { precision: 10, scale: 3 }).notNull().default("0"),

    // Production during period (wine gallons)
    producedHardCider: numeric("produced_hard_cider", { precision: 10, scale: 3 }).notNull().default("0"),
    producedWineUnder16: numeric("produced_wine_under_16", { precision: 10, scale: 3 }).notNull().default("0"),
    producedWine16To21: numeric("produced_wine_16_to_21", { precision: 10, scale: 3 }).notNull().default("0"),

    // Tax-paid removals by channel (wine gallons)
    taxpaidTastingRoom: numeric("taxpaid_tasting_room", { precision: 10, scale: 3 }).notNull().default("0"),
    taxpaidWholesale: numeric("taxpaid_wholesale", { precision: 10, scale: 3 }).notNull().default("0"),
    taxpaidOnlineDtc: numeric("taxpaid_online_dtc", { precision: 10, scale: 3 }).notNull().default("0"),
    taxpaidEvents: numeric("taxpaid_events", { precision: 10, scale: 3 }).notNull().default("0"),
    taxpaidOther: numeric("taxpaid_other", { precision: 10, scale: 3 }).notNull().default("0"),

    // Other removals (wine gallons)
    removedSamples: numeric("removed_samples", { precision: 10, scale: 3 }).notNull().default("0"),
    removedBreakage: numeric("removed_breakage", { precision: 10, scale: 3 }).notNull().default("0"),
    removedProcessLoss: numeric("removed_process_loss", { precision: 10, scale: 3 }).notNull().default("0"),
    removedDistilling: numeric("removed_distilling", { precision: 10, scale: 3 }).notNull().default("0"),

    // Materials received
    materialsApplesLbs: numeric("materials_apples_lbs", { precision: 12, scale: 2 }).notNull().default("0"),
    materialsOtherFruitLbs: numeric("materials_other_fruit_lbs", { precision: 12, scale: 2 }).notNull().default("0"),
    materialsJuiceGallons: numeric("materials_juice_gallons", { precision: 10, scale: 3 }).notNull().default("0"),
    materialsSugarLbs: numeric("materials_sugar_lbs", { precision: 10, scale: 2 }).notNull().default("0"),

    // Tax calculation
    taxHardCider: numeric("tax_hard_cider", { precision: 10, scale: 2 }).notNull().default("0"),
    taxWineUnder16: numeric("tax_wine_under_16", { precision: 10, scale: 2 }).notNull().default("0"),
    taxWine16To21: numeric("tax_wine_16_to_21", { precision: 10, scale: 2 }).notNull().default("0"),
    taxSmallProducerCredit: numeric("tax_small_producer_credit", { precision: 10, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 10, scale: 2 }).notNull().default("0"),

    // Status and workflow
    status: ttbSnapshotStatusEnum("status").notNull().default("draft"),
    finalizedAt: timestamp("finalized_at"),
    finalizedBy: uuid("finalized_by").references(() => users.id),

    // Notes and audit
    notes: text("notes"),
    adjustments: text("adjustments"), // JSON string for manual adjustments

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    periodEndIdx: index("ttb_period_snapshots_period_end_idx").on(table.periodEnd),
    statusIdx: index("ttb_period_snapshots_status_idx").on(table.status),
    yearIdx: index("ttb_period_snapshots_year_idx").on(table.year),
    // Unique constraint - one snapshot per period
    periodUniqueIdx: uniqueIndex("ttb_period_snapshots_unique_idx").on(
      table.periodType,
      table.year,
      table.periodNumber,
    ),
  }),
);

// Period Snapshots Relations
export const ttbPeriodSnapshotsRelations = relations(
  ttbPeriodSnapshots,
  ({ one }) => ({
    finalizedByUser: one(users, {
      fields: [ttbPeriodSnapshots.finalizedBy],
      references: [users.id],
      relationName: "ttb_snapshot_finalized_by",
    }),
    createdByUser: one(users, {
      fields: [ttbPeriodSnapshots.createdBy],
      references: [users.id],
      relationName: "ttb_snapshot_created_by",
    }),
  }),
);

/**
 * TTB Reconciliation Snapshots
 *
 * Stores finalized reconciliation audits comparing:
 * 1. TTB Balance (from opening balance or previous TTB form)
 * 2. Inventory Audit (physical inventory + removals + legacy batches)
 * 3. Production Audit (press runs + juice purchases)
 *
 * Allows historical tracking and audit trail of reconciliation activities.
 */
export const ttbReconciliationSnapshots = pgTable(
  "ttb_reconciliation_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Reconciliation identification
    reconciliationDate: date("reconciliation_date").notNull(), // "As of" date
    name: text("name"), // Optional friendly name (e.g., "Q4 2024 Physical Inventory")

    // Period tracking (for continuous reconciliation)
    periodStartDate: date("period_start_date"), // Start of period (exclusive - day after previous period end)
    periodEndDate: date("period_end_date"), // End of period (inclusive - typically = reconciliation_date)
    previousReconciliationId: uuid("previous_reconciliation_id"), // Self-reference to previous snapshot

    // Balance tracking
    openingBalanceGallons: numeric("opening_balance_gallons", { precision: 12, scale: 3 }), // From previous or TTB opening
    calculatedEndingGallons: numeric("calculated_ending_gallons", { precision: 12, scale: 3 }), // Opening + Production - Removals - Losses
    physicalCountGallons: numeric("physical_count_gallons", { precision: 12, scale: 3 }), // Actual physical inventory
    varianceGallons: numeric("variance_gallons", { precision: 12, scale: 3 }), // Physical - Calculated

    // TTB Reference
    ttbBalance: numeric("ttb_balance", { precision: 12, scale: 3 }).notNull(), // Total TTB balance (gal)
    ttbSourceType: text("ttb_source_type").notNull(), // "opening_balance" | "previous_snapshot"
    ttbSourceDate: date("ttb_source_date"), // Date of TTB source

    // Inventory Audit (Where is it now?)
    inventoryBulk: numeric("inventory_bulk", { precision: 12, scale: 3 }).notNull().default("0"),
    inventoryPackaged: numeric("inventory_packaged", { precision: 12, scale: 3 }).notNull().default("0"),
    inventoryOnHand: numeric("inventory_on_hand", { precision: 12, scale: 3 }).notNull().default("0"), // Bulk + Packaged
    inventoryRemovals: numeric("inventory_removals", { precision: 12, scale: 3 }).notNull().default("0"),
    inventoryLegacy: numeric("inventory_legacy", { precision: 12, scale: 3 }).notNull().default("0"),
    inventoryAccountedFor: numeric("inventory_accounted_for", { precision: 12, scale: 3 }).notNull().default("0"), // OnHand + Removals + Legacy
    inventoryDifference: numeric("inventory_difference", { precision: 12, scale: 3 }).notNull().default("0"), // TTB - AccountedFor

    // Production Audit (Did we track all sources?)
    productionPressRuns: numeric("production_press_runs", { precision: 12, scale: 3 }).notNull().default("0"),
    productionJuicePurchases: numeric("production_juice_purchases", { precision: 12, scale: 3 }).notNull().default("0"),
    productionTotal: numeric("production_total", { precision: 12, scale: 3 }).notNull().default("0"),

    // Production by year breakdown (JSON)
    productionByYear: text("production_by_year"), // JSON array of {year, pressRuns, juicePurchases, total}

    // Inventory by year breakdown (JSON)
    inventoryByYear: text("inventory_by_year"), // JSON array of {year, bulk, packaged, total}

    // Tax class breakdown (JSON) - optional detailed breakdown
    taxClassBreakdown: text("tax_class_breakdown"), // JSON for detailed per-class data

    // Reconciliation status
    isReconciled: boolean("is_reconciled").notNull().default(false),
    // Using text with CHECK constraint in DB (not enum) to match migration pattern
    status: text("status").notNull().default("draft").$type<"draft" | "review" | "finalized">(),
    finalizedAt: timestamp("finalized_at"),
    finalizedBy: uuid("finalized_by").references(() => users.id),

    // Notes for audit trail
    notes: text("notes"),
    discrepancyExplanation: text("discrepancy_explanation"), // If not reconciled, explain why

    // Physical Inventory Support (added in migration 0108)
    hasPhysicalInventory: boolean("has_physical_inventory").default(false),
    physicalInventoryTotalLiters: numeric("physical_inventory_total_liters", { precision: 12, scale: 3 }),
    adjustmentsTotalLiters: numeric("adjustments_total_liters", { precision: 12, scale: 3 }),
    batchDispositionSummary: text("batch_disposition_summary"), // JSON summary of where batches ended up

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    reconciliationDateIdx: index("ttb_reconciliation_snapshots_date_idx").on(table.reconciliationDate),
    statusIdx: index("ttb_reconciliation_snapshots_status_idx").on(table.status),
    createdAtIdx: index("ttb_reconciliation_snapshots_created_idx").on(table.createdAt),
    periodIdx: index("ttb_reconciliation_snapshots_period_idx").on(table.periodStartDate, table.periodEndDate),
    previousIdx: index("ttb_reconciliation_snapshots_prev_idx").on(table.previousReconciliationId),
  }),
);

// Reconciliation Snapshots Relations
export const ttbReconciliationSnapshotsRelations = relations(
  ttbReconciliationSnapshots,
  ({ one, many }) => ({
    previousReconciliation: one(ttbReconciliationSnapshots, {
      fields: [ttbReconciliationSnapshots.previousReconciliationId],
      references: [ttbReconciliationSnapshots.id],
      relationName: "ttb_reconciliation_chain",
    }),
    finalizedByUser: one(users, {
      fields: [ttbReconciliationSnapshots.finalizedBy],
      references: [users.id],
      relationName: "ttb_reconciliation_finalized_by",
    }),
    createdByUser: one(users, {
      fields: [ttbReconciliationSnapshots.createdBy],
      references: [users.id],
      relationName: "ttb_reconciliation_created_by",
    }),
    // Physical inventory and adjustments (added in migration 0108)
    physicalInventoryCounts: many(physicalInventoryCounts, {
      relationName: "reconciliation_physical_counts",
    }),
    reconciliationAdjustments: many(reconciliationAdjustments, {
      relationName: "reconciliation_adjustments",
    }),
  }),
);

/**
 * Measurement Method Enum
 * How physical inventory was measured
 */
export const measurementMethodEnum = pgEnum("measurement_method", [
  "dipstick",
  "sight_glass",
  "flowmeter",
  "estimated",
  "weighed",
]);

/**
 * Adjustment Type Enum
 * Reason codes for reconciliation adjustments
 */
export const adjustmentTypeEnum = pgEnum("adjustment_type", [
  "evaporation",
  "measurement_error",
  "sampling",
  "contamination",
  "spillage",
  "theft",
  "correction_up",
  "correction_down",
  "other",
]);

/**
 * Physical Inventory Counts
 *
 * Stores vessel-by-vessel physical count entries during TTB reconciliation.
 * Allows comparing book (calculated) inventory vs actual measured inventory.
 * Variances can trigger reconciliation adjustments.
 */
export const physicalInventoryCounts = pgTable(
  "physical_inventory_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reconciliationSnapshotId: uuid("reconciliation_snapshot_id")
      .notNull()
      .references(() => ttbReconciliationSnapshots.id, { onDelete: "cascade" }),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id),
    batchId: uuid("batch_id").references(() => batches.id),

    // Book vs Physical volumes (in liters for consistency with batch volumes)
    bookVolumeLiters: numeric("book_volume_liters", { precision: 10, scale: 3 }).notNull(),
    physicalVolumeLiters: numeric("physical_volume_liters", { precision: 10, scale: 3 }).notNull(),
    varianceLiters: numeric("variance_liters", { precision: 10, scale: 3 }).notNull(),
    variancePercentage: numeric("variance_percentage", { precision: 5, scale: 2 }),

    // Count metadata
    countedAt: timestamp("counted_at").notNull(),
    countedBy: uuid("counted_by").references(() => users.id),
    measurementMethod: measurementMethodEnum("measurement_method"),
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    reconIdx: index("physical_inventory_counts_recon_idx").on(table.reconciliationSnapshotId),
    vesselIdx: index("physical_inventory_counts_vessel_idx").on(table.vesselId),
    batchIdx: index("physical_inventory_counts_batch_idx").on(table.batchId),
    countedAtIdx: index("physical_inventory_counts_counted_at_idx").on(table.countedAt),
  }),
);

// Physical Inventory Counts Relations
export const physicalInventoryCountsRelations = relations(
  physicalInventoryCounts,
  ({ one }) => ({
    reconciliationSnapshot: one(ttbReconciliationSnapshots, {
      fields: [physicalInventoryCounts.reconciliationSnapshotId],
      references: [ttbReconciliationSnapshots.id],
      relationName: "reconciliation_physical_counts",
    }),
    vessel: one(vessels, {
      fields: [physicalInventoryCounts.vesselId],
      references: [vessels.id],
      relationName: "vessel_physical_counts",
    }),
    batch: one(batches, {
      fields: [physicalInventoryCounts.batchId],
      references: [batches.id],
      relationName: "batch_physical_counts",
    }),
    countedByUser: one(users, {
      fields: [physicalInventoryCounts.countedBy],
      references: [users.id],
      relationName: "physical_count_user",
    }),
  }),
);

/**
 * Reconciliation Adjustments
 *
 * Stores adjustments made during reconciliation to explain variances.
 * Each adjustment has a reason code and can optionally be applied to
 * a batch's volume through batch_volume_adjustments.
 */
export const reconciliationAdjustments = pgTable(
  "reconciliation_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reconciliationSnapshotId: uuid("reconciliation_snapshot_id")
      .notNull()
      .references(() => ttbReconciliationSnapshots.id, { onDelete: "cascade" }),

    // Link to what was adjusted
    batchId: uuid("batch_id").references(() => batches.id),
    vesselId: uuid("vessel_id").references(() => vessels.id),
    physicalCountId: uuid("physical_count_id").references(() => physicalInventoryCounts.id),

    // Adjustment details (volumes in liters)
    adjustmentType: adjustmentTypeEnum("adjustment_type").notNull(),
    volumeBeforeLiters: numeric("volume_before_liters", { precision: 10, scale: 3 }).notNull(),
    volumeAfterLiters: numeric("volume_after_liters", { precision: 10, scale: 3 }).notNull(),
    adjustmentLiters: numeric("adjustment_liters", { precision: 10, scale: 3 }).notNull(),

    // Reason and audit trail
    reason: text("reason").notNull(),
    notes: text("notes"),

    // Link to batch_volume_adjustments if adjustment was applied
    appliedToBatchId: uuid("applied_to_batch_id").references(() => batches.id),
    batchVolumeAdjustmentId: uuid("batch_volume_adjustment_id").references(() => batchVolumeAdjustments.id),

    // Audit
    adjustedBy: uuid("adjusted_by")
      .notNull()
      .references(() => users.id),
    adjustedAt: timestamp("adjusted_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    reconIdx: index("reconciliation_adjustments_recon_idx").on(table.reconciliationSnapshotId),
    batchIdx: index("reconciliation_adjustments_batch_idx").on(table.batchId),
    vesselIdx: index("reconciliation_adjustments_vessel_idx").on(table.vesselId),
    adjustedAtIdx: index("reconciliation_adjustments_adjusted_at_idx").on(table.adjustedAt),
  }),
);

// Reconciliation Adjustments Relations
export const reconciliationAdjustmentsRelations = relations(
  reconciliationAdjustments,
  ({ one }) => ({
    reconciliationSnapshot: one(ttbReconciliationSnapshots, {
      fields: [reconciliationAdjustments.reconciliationSnapshotId],
      references: [ttbReconciliationSnapshots.id],
      relationName: "reconciliation_adjustments",
    }),
    batch: one(batches, {
      fields: [reconciliationAdjustments.batchId],
      references: [batches.id],
      relationName: "batch_reconciliation_adjustments",
    }),
    vessel: one(vessels, {
      fields: [reconciliationAdjustments.vesselId],
      references: [vessels.id],
      relationName: "vessel_reconciliation_adjustments",
    }),
    physicalCount: one(physicalInventoryCounts, {
      fields: [reconciliationAdjustments.physicalCountId],
      references: [physicalInventoryCounts.id],
      relationName: "physical_count_adjustments",
    }),
    appliedToBatch: one(batches, {
      fields: [reconciliationAdjustments.appliedToBatchId],
      references: [batches.id],
      relationName: "applied_batch_adjustments",
    }),
    batchVolumeAdjustment: one(batchVolumeAdjustments, {
      fields: [reconciliationAdjustments.batchVolumeAdjustmentId],
      references: [batchVolumeAdjustments.id],
      relationName: "linked_volume_adjustment",
    }),
    adjustedByUser: one(users, {
      fields: [reconciliationAdjustments.adjustedBy],
      references: [users.id],
      relationName: "adjustment_user",
    }),
  }),
);

// Type inference helpers
export type SalesChannel = typeof salesChannels.$inferSelect;
export type NewSalesChannel = typeof salesChannels.$inferInsert;
export type TTBReportingPeriod = typeof ttbReportingPeriods.$inferSelect;
export type NewTTBReportingPeriod = typeof ttbReportingPeriods.$inferInsert;
export type TTBPeriodSnapshot = typeof ttbPeriodSnapshots.$inferSelect;
export type NewTTBPeriodSnapshot = typeof ttbPeriodSnapshots.$inferInsert;
export type TTBReconciliationSnapshot = typeof ttbReconciliationSnapshots.$inferSelect;
export type NewTTBReconciliationSnapshot = typeof ttbReconciliationSnapshots.$inferInsert;
export type PhysicalInventoryCount = typeof physicalInventoryCounts.$inferSelect;
export type NewPhysicalInventoryCount = typeof physicalInventoryCounts.$inferInsert;
export type ReconciliationAdjustment = typeof reconciliationAdjustments.$inferSelect;
export type NewReconciliationAdjustment = typeof reconciliationAdjustments.$inferInsert;

/**
 * TTB Opening Balances Type
 * Used in organization_settings.ttb_opening_balances
 */
export interface TTBOpeningBalances {
  bulk: {
    hardCider: number;
    wineUnder16: number;
    wine16To21: number;
    wine21To24: number;
    sparklingWine: number;
    carbonatedWine: number;
  };
  bottled: {
    hardCider: number;
    wineUnder16: number;
    wine16To21: number;
    wine21To24: number;
    sparklingWine: number;
    carbonatedWine: number;
  };
  spirits: {
    appleBrandy: number;
    grapeSpirits: number;
  };
}
