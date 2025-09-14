# ApplePress Database Schema Design

## Overview
This document outlines the database schema design for the ApplePress epic, specifically the `press_runs` and `press_run_loads` tables that extend the existing domain model to support mobile-first apple pressing workflow.

## Design Analysis

### Existing Schema Patterns
After analyzing the current schema (`/packages/db/src/schema.ts` and `/packages/db/src/schema/audit.ts`), I identified the following patterns to follow:

1. **Naming Convention**: snake_case for all table and column names
2. **Primary Keys**: UUID with `defaultRandom()` using `uuid('id').primaryKey().defaultRandom()`
3. **Timestamps**: `timestamp` columns with `defaultNow()` for audit fields
4. **Audit Trail**: Standard audit fields pattern:
   - `createdAt: timestamp('created_at').notNull().defaultNow()`
   - `updatedAt: timestamp('updated_at').notNull().defaultNow()`
   - `deletedAt: timestamp('deleted_at')` (for soft deletes)
5. **Decimal Precision**: Consistent patterns for financial/measurement data:
   - Money: `decimal({ precision: 10, scale: 2 })`
   - Weights: `decimal({ precision: 10, scale: 3 })`
   - Volumes: `decimal({ precision: 10, scale: 3 })`
   - Percentages: `decimal({ precision: 4, scale: 2 })`
6. **Enums**: pgEnum definitions for constrained values
7. **Foreign Keys**: Proper references with cascade rules
8. **RBAC Integration**: User attribution via `users` table relationships

### Relationship to Existing Domain
The new tables will integrate with existing entities:
- `vendors` - Press runs are organized by vendor
- `purchase_items` (existing `purchaseItems`) - Individual fruit loads reference purchase items for traceability
- `vessels` - Press runs will be assigned to vessels for juice collection
- `users` - RBAC and audit trail integration

**Note**: There are existing `pressRuns` and `pressItems` tables in the current schema. The new `press_runs` and `press_run_loads` tables are designed for the mobile ApplePress workflow and represent a different use case with enhanced mobile-specific features, status tracking, and labor management.

## Schema Design

### 1. Press Run Status Enum
```typescript
export const pressRunStatusEnum = pgEnum('press_run_status', [
  'draft',        // Initial state, can be edited
  'in_progress',  // Active pressing session
  'completed',    // Finished pressing, juice transferred
  'cancelled'     // Cancelled press run
])
```

### 2. Press Runs Table
```typescript
export const pressRuns = pgTable('press_runs', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  vesselId: uuid('vessel_id').references(() => vessels.id), // Where juice will go

  // Status and workflow
  status: pressRunStatusEnum('status').notNull().default('draft'),

  // Timing
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  scheduledDate: date('scheduled_date'), // When the press run is planned

  // Totals (calculated from loads)
  totalAppleWeightKg: decimal('total_apple_weight_kg', { precision: 10, scale: 3 }),
  totalJuiceVolumeL: decimal('total_juice_volume_l', { precision: 10, scale: 3 }),
  extractionRate: decimal('extraction_rate', { precision: 5, scale: 4 }), // calculated percentage

  // Labor tracking
  laborHours: decimal('labor_hours', { precision: 8, scale: 2 }),
  laborCostPerHour: decimal('labor_cost_per_hour', { precision: 8, scale: 2 }),
  totalLaborCost: decimal('total_labor_cost', { precision: 10, scale: 2 }),

  // Additional metadata
  notes: text('notes'),
  pressingMethod: text('pressing_method'), // e.g., "hydraulic", "screw_press", "bladder"
  weatherConditions: text('weather_conditions'),

  // Full audit trail following existing pattern
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  // Performance indexes for mobile app
  vendorIdx: index('press_runs_vendor_idx').on(table.vendorId),
  statusIdx: index('press_runs_status_idx').on(table.status),
  scheduledDateIdx: index('press_runs_scheduled_date_idx').on(table.scheduledDate),
  startTimeIdx: index('press_runs_start_time_idx').on(table.startTime),

  // Composite indexes for common queries
  vendorStatusIdx: index('press_runs_vendor_status_idx').on(table.vendorId, table.status),
  dateStatusIdx: index('press_runs_date_status_idx').on(table.scheduledDate, table.status)
}))
```

### 3. Press Run Loads Table
```typescript
export const pressRunLoads = pgTable('press_run_loads', {
  // Primary identification
  id: uuid('id').primaryKey().defaultRandom(),

  // Core relationships
  pressRunId: uuid('press_run_id').notNull().references(() => pressRuns.id, { onDelete: 'cascade' }),
  purchaseItemId: uuid('purchase_item_id').notNull().references(() => purchaseItems.id), // For traceability
  appleVarietyId: uuid('apple_variety_id').notNull().references(() => appleVarieties.id),

  // Load sequence for ordering
  loadSequence: integer('load_sequence').notNull(), // Order within press run

  // Apple measurements following canonical storage pattern
  appleWeightKg: decimal('apple_weight_kg', { precision: 10, scale: 3 }).notNull(), // Canonical storage
  originalWeight: decimal('original_weight', { precision: 10, scale: 3 }), // As entered by user
  originalWeightUnit: text('original_weight_unit'), // Original unit entered

  // Juice production measurements
  juiceVolumeL: decimal('juice_volume_l', { precision: 10, scale: 3 }), // Canonical storage
  originalVolume: decimal('original_volume', { precision: 10, scale: 3 }), // As entered by user
  originalVolumeUnit: text('original_volume_unit'), // Original unit entered

  // Quality measurements
  brixMeasured: decimal('brix_measured', { precision: 4, scale: 2 }),
  phMeasured: decimal('ph_measured', { precision: 3, scale: 2 }),

  // Load-specific metadata
  notes: text('notes'),
  pressedAt: timestamp('pressed_at'), // When this specific load was processed

  // Condition tracking
  appleCondition: text('apple_condition'), // e.g., "excellent", "good", "poor"
  defectPercentage: decimal('defect_percentage', { precision: 4, scale: 2 }),

  // Full audit trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at')
}, (table) => ({
  // Performance indexes
  pressRunIdx: index('press_run_loads_press_run_idx').on(table.pressRunId),
  purchaseItemIdx: index('press_run_loads_purchase_item_idx').on(table.purchaseItemId),
  varietyIdx: index('press_run_loads_variety_idx').on(table.appleVarietyId),
  sequenceIdx: index('press_run_loads_sequence_idx').on(table.pressRunId, table.loadSequence),

  // Unique constraint to prevent duplicate sequences within a press run
  uniqueSequence: uniqueIndex('press_run_loads_unique_sequence').on(table.pressRunId, table.loadSequence)
}))
```

### 4. Relations
```typescript
export const pressRunsRelations = relations(pressRuns, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [pressRuns.vendorId],
    references: [vendors.id]
  }),
  vessel: one(vessels, {
    fields: [pressRuns.vesselId],
    references: [vessels.id]
  }),
  createdByUser: one(users, {
    fields: [pressRuns.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [pressRuns.updatedBy],
    references: [users.id]
  }),
  loads: many(pressRunLoads)
}))

export const pressRunLoadsRelations = relations(pressRunLoads, ({ one }) => ({
  pressRun: one(pressRuns, {
    fields: [pressRunLoads.pressRunId],
    references: [pressRuns.id]
  }),
  purchaseItem: one(purchaseItems, {
    fields: [pressRunLoads.purchaseItemId],
    references: [purchaseItems.id]
  }),
  appleVariety: one(appleVarieties, {
    fields: [pressRunLoads.appleVarietyId],
    references: [appleVarieties.id]
  }),
  createdByUser: one(users, {
    fields: [pressRunLoads.createdBy],
    references: [users.id]
  }),
  updatedByUser: one(users, {
    fields: [pressRunLoads.updatedBy],
    references: [users.id]
  })
}))
```

## Key Design Decisions

### 1. Status Management
- **Draft Status**: Allows mobile app to save incomplete press runs for resumption
- **Status Enum**: Uses pgEnum with CHECK constraints for data integrity
- **Status Transitions**: Supports workflow: draft → in_progress → completed/cancelled

### 2. Unit Handling Strategy
Following existing codebase patterns:
- **Canonical Storage**: All weights in kg, all volumes in L for calculations
- **Original Unit Preservation**: Store user-entered units and values for display
- **Conversion Logic**: Handled at application layer (packages/lib)

### 3. Audit and RBAC Integration
- **Created/Updated By**: Full user attribution following existing audit patterns
- **Soft Deletes**: `deletedAt` timestamp for data preservation
- **Audit Logs**: Will integrate with existing `auditLogs` table automatically

### 4. Performance Optimization
- **Strategic Indexing**: Focused on mobile app query patterns
- **Composite Indexes**: For complex filtering (vendor + status, date + status)
- **CASCADE Deletes**: Proper cleanup for press_run_loads when press_run is deleted

### 5. Mobile-First Considerations
- **Load Sequencing**: Supports ordered entry of fruit loads
- **Flexible Measurements**: Accommodates field conditions with quality tracking
- **Resumable Workflow**: Draft status enables interrupted work sessions

## Integration with Existing Domain

### Vendor Integration
- Press runs are organized by vendor for operational efficiency
- Maintains vendor relationship patterns from existing purchase system

### Traceability Chain
- `purchase_items` → `press_run_loads` → eventual `juice_lots`
- Full farm-to-bottle traceability maintained

### Vessel Management
- Integration with existing vessel status tracking
- Supports juice collection vessel assignment

### Costing Integration
- Labor cost tracking at press run level
- Supports integration with existing COGS calculation system

## Migration Strategy

### Phase 1: Schema Creation
1. Add new enum types
2. Create press_runs table with indexes
3. Create press_run_loads table with indexes and constraints
4. Add foreign key relationships

### Phase 2: Data Migration (if needed)
- No existing data migration required as these are new tables
- Seed data can be added for testing

### Phase 3: Application Integration
- API layer development (packages/api)
- Frontend integration (apps/web)
- Mobile app optimization

## Performance Considerations

### Index Strategy
- **Primary Access Patterns**: By vendor, by status, by date range
- **Composite Indexes**: Optimized for filtered queries
- **Unique Constraints**: Prevent data integrity issues

### Query Optimization
- Load sequencing supports ordered retrieval
- Vendor-based filtering reduces result sets
- Status-based filtering for workflow queries

### Mobile Performance
- Minimal required fields for initial load
- Optional fields for detailed views
- Efficient pagination support through indexing

## Constraints and Validations

### Database Level
- Foreign key constraints with proper cascade rules
- Unique constraints on sequence within press runs
- NOT NULL constraints on critical fields

### Application Level (Future)
- Status transition validation
- Unit conversion validation
- Sequence validation for loads
- Business logic constraints (e.g., positive weights/volumes)

## Testing Strategy

### Schema Validation
- Migration scripts testing
- Foreign key constraint testing
- Index performance testing

### Data Integrity
- Cascade delete testing
- Constraint violation testing
- Audit trail verification

### Performance Testing
- Index effectiveness for mobile queries
- Large dataset performance
- Concurrent access patterns

This schema design provides a solid foundation for the ApplePress mobile workflow while maintaining consistency with existing codebase patterns and supporting future extensibility.