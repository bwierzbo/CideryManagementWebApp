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
import { users } from "../schema";

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

// Type inference helpers
export type SalesChannel = typeof salesChannels.$inferSelect;
export type NewSalesChannel = typeof salesChannels.$inferInsert;
export type TTBReportingPeriod = typeof ttbReportingPeriods.$inferSelect;
export type NewTTBReportingPeriod = typeof ttbReportingPeriods.$inferInsert;
