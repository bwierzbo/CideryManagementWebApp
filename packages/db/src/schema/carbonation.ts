/**
 * Batch Carbonation Operations Schema
 *
 * Tracks forced carbonation operations where CO2 is added to batches under
 * pressure in sealed vessels.
 *
 * @see https://en.wikipedia.org/wiki/Henry%27s_law
 */

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  timestamp,
  numeric,
  text,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { batches, vessels, users, additivePurchases } from "../schema";
import { unitEnum } from "./shared";

/**
 * Carbonation process type enum
 */
export const carbonationProcessTypeEnum = pgEnum("carbonation_process_type", [
  "headspace",
  "inline",
  "stone",
  "bottle_conditioning",
]);

/**
 * Carbonation quality assessment enum
 */
export const carbonationQualityEnum = pgEnum("carbonation_quality", [
  "pass",
  "fail",
  "needs_adjustment",
  "in_progress",
]);

/**
 * Batch Carbonation Operations
 *
 * Tracks carbonation operations including:
 * - Forced carbonation where CO2 is added to batches under pressure in sealed vessels
 * - Bottle conditioning where priming sugar is added before bottling
 *
 * @example
 * // Start a forced carbonation operation
 * const carbonation = await db.insert(batchCarbonationOperations).values({
 *   batchId: batch.id,
 *   vesselId: pressureVessel.id, // Optional - null for bottle conditioning
 *   startingVolume: 500,
 *   startingTemperature: 4,
 *   targetCo2Volumes: 2.5,
 *   pressureApplied: 18,
 *   carbonationProcess: 'headspace',
 *   performedBy: user.id,
 * });
 */
export const batchCarbonationOperations = pgTable(
  "batch_carbonation_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    vesselId: uuid("vessel_id").references(() => vessels.id),

    // Timing
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    /**
     * Duration in hours - auto-calculated by trigger when completed
     */
    durationHours: numeric("duration_hours", { precision: 6, scale: 1 }),

    // Starting conditions
    startingVolume: numeric("starting_volume", {
      precision: 10,
      scale: 3,
    }).notNull(),
    startingVolumeUnit: unitEnum("starting_volume_unit")
      .notNull()
      .default("L"),
    /**
     * Starting temperature in Celsius (optional)
     */
    startingTemperature: numeric("starting_temperature", {
      precision: 4,
      scale: 1,
    }),
    /**
     * Starting CO2 volumes if known from prior measurement
     */
    startingCo2Volumes: numeric("starting_co2_volumes", {
      precision: 4,
      scale: 2,
    }),

    // Target conditions
    /**
     * Target carbonation level in volumes
     * 1 volume = 1L CO2 per 1L liquid
     * Ranges: still <1, petillant 1-2.5, sparkling 2.5-4
     */
    targetCo2Volumes: numeric("target_co2_volumes", {
      precision: 4,
      scale: 2,
    }).notNull(),
    /**
     * System-calculated suggested pressure based on target CO2 and temperature
     * using Henry's Law
     */
    suggestedPressure: numeric("suggested_pressure", {
      precision: 5,
      scale: 1,
    }),

    // Process details
    /**
     * Physical method used for carbonation
     * - headspace: CO2 applied to headspace (most common)
     * - inline: CO2 injected inline during transfer
     * - stone: CO2 via carbonation stone in tank
     */
    carbonationProcess: carbonationProcessTypeEnum("carbonation_process")
      .notNull()
      .default("headspace"),
    /**
     * Pressure applied in PSI
     */
    pressureApplied: numeric("pressure_applied", {
      precision: 5,
      scale: 1,
    }).notNull(),
    /**
     * Gas type used
     * Typically 'CO2', but can be 'Beer Gas 75/25', 'CO2/N2 mix', etc.
     */
    gasType: text("gas_type").default("CO2"),

    // Additive tracking (for bottle conditioning)
    /**
     * Reference to the additive purchase used for priming (bottle conditioning only)
     */
    additivePurchaseId: uuid("additive_purchase_id").references(
      () => additivePurchases.id,
    ),
    /**
     * Amount of priming sugar used in grams
     */
    primingSugarAmount: numeric("priming_sugar_amount", {
      precision: 10,
      scale: 2,
    }),
    /**
     * Type of sugar used for priming
     */
    primingSugarType: text("priming_sugar_type"),

    // Final conditions
    finalPressure: numeric("final_pressure", { precision: 5, scale: 1 }),
    finalTemperature: numeric("final_temperature", { precision: 4, scale: 1 }),
    finalCo2Volumes: numeric("final_co2_volumes", { precision: 4, scale: 2 }),
    finalVolume: numeric("final_volume", { precision: 10, scale: 3 }),
    finalVolumeUnit: unitEnum("final_volume_unit").default("L"),

    // Quality
    /**
     * Quality assessment of carbonation
     * - pass: Target achieved, good quality
     * - fail: Did not carbonate properly
     * - needs_adjustment: Close but needs tweaking
     * - in_progress: Currently carbonating
     */
    qualityCheck: carbonationQualityEnum("quality_check").default(
      "in_progress",
    ),
    qualityNotes: text("quality_notes"),
    notes: text("notes"),

    // Tracking
    performedBy: uuid("performed_by").references(() => users.id),
    completedBy: uuid("completed_by").references(() => users.id),

    // Audit
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Find all carbonations for a batch (most common query)
    batchIdx: index("idx_carbonation_batch")
      .on(table.batchId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Find what's carbonating in a vessel
    vesselIdx: index("idx_carbonation_vessel")
      .on(table.vesselId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Dashboard: List all active carbonations
    activeIdx: index("idx_carbonation_active")
      .on(table.startedAt, table.completedAt)
      .where(sql`${table.completedAt} IS NULL AND ${table.deletedAt} IS NULL`),

    // Reports: List completed carbonations
    completedIdx: index("idx_carbonation_completed")
      .on(table.completedAt)
      .where(sql`${table.completedAt} IS NOT NULL AND ${table.deletedAt} IS NULL`),
  }),
);

// Relations
export const batchCarbonationOperationsRelations = relations(
  batchCarbonationOperations,
  ({ one }) => ({
    batch: one(batches, {
      fields: [batchCarbonationOperations.batchId],
      references: [batches.id],
    }),
    vessel: one(vessels, {
      fields: [batchCarbonationOperations.vesselId],
      references: [vessels.id],
    }),
    additivePurchase: one(additivePurchases, {
      fields: [batchCarbonationOperations.additivePurchaseId],
      references: [additivePurchases.id],
    }),
    performedByUser: one(users, {
      fields: [batchCarbonationOperations.performedBy],
      references: [users.id],
      relationName: "carbonation_performed_by",
    }),
    completedByUser: one(users, {
      fields: [batchCarbonationOperations.completedBy],
      references: [users.id],
      relationName: "carbonation_completed_by",
    }),
  }),
);

// Type inference helpers
export type BatchCarbonationOperation =
  typeof batchCarbonationOperations.$inferSelect;
export type NewBatchCarbonationOperation =
  typeof batchCarbonationOperations.$inferInsert;
