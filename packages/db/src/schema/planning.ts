/**
 * Production Planning Schema
 *
 * Annual/seasonal production plans (scenarios) and the planned batches inside
 * them. Each planned batch is a recipe × target volume × period × bottle/keg
 * split. The planner sums every batch's bill-of-materials (computed in
 * `packages/lib/src/recipes/bom.ts`) into per-period inventory requirements.
 *
 * Plans are named scenarios: an org can save several and mark ONE operational.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { recipes, users } from "../schema";
import { organizations } from "./organization";

// ============================================
// PRODUCTION PLANS (scenarios)
// ============================================

export const productionPlans = pgTable(
  "production_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** Target year the plan covers, e.g. 2026. Optional. */
    year: integer("year"),
    /**
     * Exactly one plan per org should be operational at a time (the one you're
     * actually executing to). Enforced in the mutation layer, not the DB.
     */
    isOperational: boolean("is_operational").notNull().default(false),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Soft delete — matches the organizations table convention. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index("production_plans_org_idx").on(table.organizationId),
  }),
);

// ============================================
// PLANNED BATCHES
// ============================================

export const plannedBatches = pgTable(
  "planned_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => productionPlans.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),

    /** Optional friendly label, e.g. "Spring Honeycrisp run". */
    label: text("label"),

    /** Target finished volume in liters. */
    targetVolumeL: decimal("target_volume_l", { precision: 12, scale: 3 })
      .notNull(),
    /** Volume bottled. NULL → BOM treats the whole batch as bottled. */
    bottleVolumeL: decimal("bottle_volume_l", { precision: 12, scale: 3 }),
    /** Volume kegged. NULL → BOM derives it from the remainder. */
    kegVolumeL: decimal("keg_volume_l", { precision: 12, scale: 3 }),

    /**
     * Time-bucket the batch lands in. Format follows the org's planning
     * granularity: "2026-03" (monthly) or "2026-Q1" (quarterly). Aggregation
     * groups requirements by this string.
     */
    period: text("period").notNull(),

    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    planIdx: index("planned_batches_plan_idx").on(table.planId, table.sortOrder),
    recipeIdx: index("planned_batches_recipe_idx").on(table.recipeId),
  }),
);

// ============================================
// RELATIONS
// ============================================

export const productionPlansRelations = relations(
  productionPlans,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [productionPlans.organizationId],
      references: [organizations.id],
    }),
    batches: many(plannedBatches),
  }),
);

export const plannedBatchesRelations = relations(plannedBatches, ({ one }) => ({
  plan: one(productionPlans, {
    fields: [plannedBatches.planId],
    references: [productionPlans.id],
  }),
  recipe: one(recipes, {
    fields: [plannedBatches.recipeId],
    references: [recipes.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type ProductionPlan = typeof productionPlans.$inferSelect;
export type NewProductionPlan = typeof productionPlans.$inferInsert;

export type PlannedBatch = typeof plannedBatches.$inferSelect;
export type NewPlannedBatch = typeof plannedBatches.$inferInsert;
