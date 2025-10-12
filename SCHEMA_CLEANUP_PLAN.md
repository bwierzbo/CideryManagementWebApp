# Schema Cleanup Plan

## Overview
Major schema simplification to remove unused tables and streamline the data model.

## Phase 1: Database Migration ✅
**File**: `migrations/0024_major_schema_cleanup.sql`

### Tables to Drop
- [x] `tank_measurements` - Functionality moved to batch operations
- [x] `tank_additives` - Functionality moved to batch operations
- [x] `press_runs` - Empty table, using apple_press_runs
- [x] `press_items` - Empty table, using apple_press_run_loads
- [x] `packages` - Not yet implemented
- [x] `inventory` - Not yet implemented
- [x] `inventory_transactions` - Not yet implemented
- [x] `batch_costs` - Not yet implemented
- [x] `cogs_items` - Not yet implemented

### Tables to Rename
- [x] `apple_press_runs` → `press_runs`
- [x] `apple_press_run_loads` → `press_run_loads`

### Column Removals

**vendor_varieties** (and related tables):
- [x] Remove `notes` from all vendor variety junction tables

**basefruit_purchases**:
- [x] Remove `invoice_number`
- [x] Remove `auto_generated_invoice`
- [x] Add `created_by` uuid
- [x] Add `updated_by` uuid

**basefruit_purchase_items**:
- [x] Remove `quantity_l` (only need kg for fruit)
- [x] Remove `original_unit` (redundant)
- [x] Rename `original_quantity` → `quantity`

**press_runs** (formerly apple_press_runs):
- [x] Remove `scheduled_date`

**press_run_loads** (formerly apple_press_run_loads):
- [x] Remove `brix_measured`
- [x] Remove `ph_measured`
- [x] Remove `pressed_at`
- [x] Remove `apple_condition`
- [x] Remove `defect_percentage`
- [x] Rename `apple_press_run_id` → `press_run_id`

---

## Phase 2: Schema File Updates

### Files to Update:
1. **`packages/db/src/schema.ts`**
   - [ ] Remove dropped table definitions
   - [ ] Rename `applePressRuns` → `pressRuns`
   - [ ] Rename `applePressRunLoads` → `pressRunLoads`
   - [ ] Update all column definitions
   - [ ] Update all relations

2. **`packages/db/src/schema/audit.ts`**
   - [ ] Already cleaned up (audit_metadata removed)

3. **`packages/db/src/index.ts`**
   - [ ] Update exports if needed

---

## Phase 3: Code Updates

### API Routers to Update:
1. **`packages/api/src/routers/pressRun.ts`**
   - [ ] Update all references: `applePressRuns` → `pressRuns`
   - [ ] Update all references: `applePressRunLoads` → `pressRunLoads`
   - [ ] Remove `scheduled_date` from create schemas
   - [ ] Remove measurement fields from load schemas

2. **`packages/api/src/routers/index.ts`**
   - [ ] Update press run queries
   - [ ] Update liquidMap query
   - [ ] Remove references to dropped tables

3. **`packages/api/src/routers/batch.ts`**
   - [ ] Check for tank measurement references
   - [ ] Check for inventory table references

4. **`packages/api/src/routers/packaging.ts`**
   - [ ] Update or remove (if uses dropped tables)

5. **`packages/api/src/routers/vendor.ts`**
   - [ ] Remove invoice number handling
   - [ ] Add created_by/updated_by handling

### UI Components to Update:
1. **Pressing Pages**
   - [ ] `apps/web/src/app/pressing/page.tsx`
   - [ ] `apps/web/src/app/pressing/[id]/page.tsx`
   - [ ] `apps/web/src/components/pressing/*.tsx`

2. **Vendor/Purchase Pages**
   - [ ] Remove invoice number inputs
   - [ ] Update vendor variety forms (no notes field)

3. **Cellar Pages**
   - [ ] Remove tank measurement references
   - [ ] Remove tank additive references

### Library Updates:
1. **`packages/lib/src/audit/database.ts`**
   - [ ] Already updated (metadata removed)

2. **Type definitions**
   - [ ] Update any types that reference dropped tables

---

## Phase 4: Testing Plan

### Automated Tests:
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Run build: `pnpm build`
- [ ] Run tests: `pnpm test`

### Manual Testing (Critical Paths):
1. **Purchases Flow**
   - [ ] Create vendor
   - [ ] Add vendor varieties
   - [ ] Create base fruit purchase
   - [ ] Add purchase items
   - [ ] Verify data saves correctly

2. **Pressing Flow**
   - [ ] Create press run
   - [ ] Add loads to press run
   - [ ] Complete press run
   - [ ] Verify juice lots created
   - [ ] Verify batch creation

3. **Batch Flow**
   - [ ] View batches in cellar
   - [ ] Add measurements
   - [ ] Transfer batch
   - [ ] Rack batch
   - [ ] Filter batch

4. **Reporting**
   - [ ] Export data to Excel
   - [ ] Verify all tables export correctly
   - [ ] Check audit logs work

---

## Phase 5: Data Verification

### Before Migration:
- [ ] Export current data to Excel
- [ ] Count records in each table
- [ ] Document current state

### After Migration:
- [ ] Verify press_runs has all data from apple_press_runs
- [ ] Verify press_run_loads has all data
- [ ] Verify no data loss
- [ ] Spot-check critical records

---

## Rollback Plan

If issues arise:
1. Keep backup of pre-migration database
2. Have previous migration files
3. Can restore from `cidery-data-export-2025-10-07.xlsx`

---

## Execution Order

1. ✅ Create migration file
2. ✅ Create this plan document
3. ⏳ Update schema.ts
4. ⏳ Update API routers
5. ⏳ Update UI components
6. ⏳ Run typecheck
7. ⏳ Run migration
8. ⏳ Test workflows
9. ⏳ Verify data integrity

---

## Notes

- The excel export already created (2025-10-07) serves as a backup
- All dropped tables had 0 records, so no data loss
- Renaming tables preserves all data
- Column drops are on non-critical fields
