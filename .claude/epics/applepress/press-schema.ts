/**
 * ApplePress Schema Definition
 * Database schema for mobile-first apple pressing workflow
 *
 * This file contains the schema definitions that would be added to packages/db/src/schema.ts
 * to support the ApplePress epic functionality.
 */

import { pgTable, uuid, text, decimal, integer, timestamp, date, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users, vendors, vessels, purchaseItems, appleVarieties } from '../schema'

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Press Run Status Enum
 * Manages the workflow states of a pressing session
 */
export const pressRunStatusEnum = pgEnum('press_run_status', [
  'draft',        // Initial state, can be edited freely
  'in_progress',  // Active pressing session in mobile app
  'completed',    // Finished pressing, juice transferred to vessel
  'cancelled'     // Cancelled press run, resources released
])

// ============================================================================
// TABLES
// ============================================================================

/**
 * Press Runs Table
 * Main entity for organizing apple pressing sessions by vendor
 * Supports mobile workflow with draft state for resumable sessions
 */
export const pressRuns = pgTable('press_runs', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships following existing foreign key patterns
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  vesselId: uuid('vessel_id').references(() => vessels.id), // Target vessel for juice collection

  // Workflow status with enum constraint
  status: pressRunStatusEnum('status').notNull().default('draft'),

  // Timing fields for session management
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  scheduledDate: date('scheduled_date'), // Planning/scheduling support

  // Aggregate measurements (calculated from loads)
  // Using existing decimal precision patterns: precision 10, scale 3 for weights/volumes
  totalAppleWeightKg: decimal('total_apple_weight_kg', { precision: 10, scale: 3 }),
  totalJuiceVolumeL: decimal('total_juice_volume_l', { precision: 10, scale: 3 }),
  extractionRate: decimal('extraction_rate', { precision: 5, scale: 4 }), // Percentage with 4 decimal precision

  // Labor cost tracking following existing cost field patterns
  laborHours: decimal('labor_hours', { precision: 8, scale: 2 }),
  laborCostPerHour: decimal('labor_cost_per_hour', { precision: 8, scale: 2 }),
  totalLaborCost: decimal('total_labor_cost', { precision: 10, scale: 2 }), // Matches existing cost precision

  // Operational metadata
  notes: text('notes'),
  pressingMethod: text('pressing_method'), // e.g., "hydraulic", "screw_press", "bladder_press"
  weatherConditions: text('weather_conditions'), // External factors affecting pressing

  // Full audit trail following existing pattern from schema.ts
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at') // Soft delete support
}, (table) => ({
  // Performance indexes optimized for mobile app query patterns
  vendorIdx: index('press_runs_vendor_idx').on(table.vendorId),
  statusIdx: index('press_runs_status_idx').on(table.status),
  scheduledDateIdx: index('press_runs_scheduled_date_idx').on(table.scheduledDate),
  startTimeIdx: index('press_runs_start_time_idx').on(table.startTime),

  // Composite indexes for common filtered queries
  vendorStatusIdx: index('press_runs_vendor_status_idx').on(table.vendorId, table.status),
  dateStatusIdx: index('press_runs_date_status_idx').on(table.scheduledDate, table.status),

  // User attribution indexes for audit queries
  createdByIdx: index('press_runs_created_by_idx').on(table.createdBy),
  updatedByIdx: index('press_runs_updated_by_idx').on(table.updatedBy)
}))

/**
 * Press Run Loads Table
 * Individual fruit loads within a pressing session
 * Maintains full traceability to purchase items and supports mobile data entry
 */
export const pressRunLoads = pgTable('press_run_loads', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships with proper cascade behavior
  pressRunId: uuid('press_run_id').notNull().references(() => pressRuns.id, { onDelete: 'cascade' }),
  purchaseItemId: uuid('purchase_item_id').notNull().references(() => purchaseItems.id), // Traceability chain
  appleVarietyId: uuid('apple_variety_id').notNull().references(() => appleVarieties.id),

  // Load sequencing for ordered processing
  loadSequence: integer('load_sequence').notNull(), // Order within press run (1, 2, 3, ...)

  // Apple weight measurements following canonical storage pattern from purchaseItems
  appleWeightKg: decimal('apple_weight_kg', { precision: 10, scale: 3 }).notNull(), // Canonical storage in kg
  originalWeight: decimal('original_weight', { precision: 10, scale: 3 }), // As entered by user
  originalWeightUnit: text('original_weight_unit'), // Original unit for display/editing

  // Juice volume measurements following same pattern
  juiceVolumeL: decimal('juice_volume_l', { precision: 10, scale: 3 }), // Canonical storage in L
  originalVolume: decimal('original_volume', { precision: 10, scale: 3 }), // As entered by user
  originalVolumeUnit: text('original_volume_unit'), // Original unit for display/editing

  // Quality measurements following existing precision patterns
  brixMeasured: decimal('brix_measured', { precision: 4, scale: 2 }), // Sugar content
  phMeasured: decimal('ph_measured', { precision: 3, scale: 2 }), // Acidity measurement

  // Load-specific operational data
  notes: text('notes'),
  pressedAt: timestamp('pressed_at'), // When this specific load was processed

  // Fruit condition tracking for quality control
  appleCondition: text('apple_condition'), // e.g., "excellent", "good", "fair", "poor"
  defectPercentage: decimal('defect_percentage', { precision: 4, scale: 2 }), // % of damaged fruit

  // Full audit trail matching pressRuns pattern
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at') // Soft delete support
}, (table) => ({
  // Performance indexes for mobile queries
  pressRunIdx: index('press_run_loads_press_run_idx').on(table.pressRunId),
  purchaseItemIdx: index('press_run_loads_purchase_item_idx').on(table.purchaseItemId),
  varietyIdx: index('press_run_loads_variety_idx').on(table.appleVarietyId),

  // Composite index for ordered retrieval within press run
  sequenceIdx: index('press_run_loads_sequence_idx').on(table.pressRunId, table.loadSequence),

  // User attribution indexes
  createdByIdx: index('press_run_loads_created_by_idx').on(table.createdBy),
  updatedByIdx: index('press_run_loads_updated_by_idx').on(table.updatedBy),

  // Unique constraint to prevent duplicate sequences within a press run
  uniqueSequence: uniqueIndex('press_run_loads_unique_sequence').on(table.pressRunId, table.loadSequence)
}))

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Press Runs Relations
 * Defines relationships following existing codebase patterns
 */
export const pressRunsRelations = relations(pressRuns, ({ one, many }) => ({
  // Core entity relationships
  vendor: one(vendors, {
    fields: [pressRuns.vendorId],
    references: [vendors.id]
  }),
  vessel: one(vessels, {
    fields: [pressRuns.vesselId],
    references: [vessels.id]
  }),

  // User attribution relationships for RBAC
  createdByUser: one(users, {
    fields: [pressRuns.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [pressRuns.updatedBy],
    references: [users.id]
  }),

  // Child relationships
  loads: many(pressRunLoads)
}))

/**
 * Press Run Loads Relations
 * Links loads to parent press run and source purchase items
 */
export const pressRunLoadsRelations = relations(pressRunLoads, ({ one }) => ({
  // Parent relationship with cascade delete
  pressRun: one(pressRuns, {
    fields: [pressRunLoads.pressRunId],
    references: [pressRuns.id]
  }),

  // Traceability relationships
  purchaseItem: one(purchaseItems, {
    fields: [pressRunLoads.purchaseItemId],
    references: [purchaseItems.id]
  }),
  appleVariety: one(appleVarieties, {
    fields: [pressRunLoads.appleVarietyId],
    references: [appleVarieties.id]
  }),

  // User attribution relationships
  createdByUser: one(users, {
    fields: [pressRunLoads.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [pressRunLoads.updatedBy],
    references: [users.id]
  })
}))

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Inferred types for use in API and frontend
export type PressRun = typeof pressRuns.$inferSelect
export type NewPressRun = typeof pressRuns.$inferInsert
export type PressRunLoad = typeof pressRunLoads.$inferSelect
export type NewPressRunLoad = typeof pressRunLoads.$inferInsert

// Status type for type safety
export type PressRunStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'

// ============================================================================
// NOTES FOR INTEGRATION
// ============================================================================

/**
 * Integration Notes:
 *
 * 1. Add these exports to packages/db/src/schema.ts:
 *    - pressRunStatusEnum
 *    - pressRuns
 *    - pressRunLoads
 *    - pressRunsRelations
 *    - pressRunLoadsRelations
 *    - Type exports
 *
 * 2. Generate migration with: pnpm db:generate
 *
 * 3. Run migration with: pnpm db:migrate
 *
 * 4. The audit system will automatically track changes to these tables
 *    via the existing auditLogs infrastructure
 *
 * 5. RBAC integration works through the createdBy/updatedBy user references
 *
 * 6. Unit conversion logic should be implemented in packages/lib
 *    following the existing patterns from purchase_items handling
 */