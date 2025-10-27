# Vessel Type Migration Strategy

## Overview

This document outlines the strategy for removing the `vessel_type` enum from the database and migrating to a more flexible, capability-based vessel identification system.

## Background

### Current System (Before Migration)
Vessels are categorized using a rigid `vessel_type` enum with four values:
- `fermenter` - Used for initial fermentation
- `conditioning_tank` - Used for conditioning/aging
- `bright_tank` - Used for final clarification before packaging
- `storage` - Used for general storage

### Problems with Current System
1. **Too Restrictive** - Real cideries don't operate with such rigid categories
2. **Not Flexible** - A vessel might serve multiple purposes depending on the batch
3. **Doesn't Capture Capabilities** - Type doesn't tell you if a vessel can handle pressure or has temperature control
4. **Not User-Friendly** - Users think in terms of vessel names and capabilities, not abstract types

### New System (After Migration)
Vessels are identified by:
- **Name** - Descriptive name (e.g., "Fermentation Tank 1", "Bright Tank A", "Conditioning Keg 5")
- **Capabilities**:
  - `is_pressure_vessel` - Can handle carbonation/pressure operations
  - `jacketed` - Has temperature control jacket
- **Properties**:
  - `capacity` + `capacity_unit` - Size of vessel
  - `material` - Construction material (stainless_steel, plastic)
  - `location` - Physical location in facility

## Migration Steps

### 1. Pre-Migration Data Analysis

Before running the migration, analyze existing vessel data:

```sql
-- Count vessels by type
SELECT type, COUNT(*) as count
FROM vessels
WHERE deleted_at IS NULL
GROUP BY type;

-- List all vessels with their current type
SELECT id, name, type, capacity, capacity_unit,
       material, jacketed, is_pressure_vessel
FROM vessels
WHERE deleted_at IS NULL
ORDER BY type, name;
```

### 2. Data Preservation Strategy

**Option A: Preserve Type in Notes Field (Recommended)**

If you want to preserve the original type information for historical purposes:

```sql
-- Before running migration 0044, optionally preserve type info
UPDATE vessels
SET notes = CONCAT(
  COALESCE(notes || E'\n\n', ''),
  'Original vessel type: ', type::text
)
WHERE type IS NOT NULL
  AND deleted_at IS NULL;
```

**Option B: Preserve Type in Vessel Name**

Alternatively, you could encode the type in the vessel name:

```sql
-- Before running migration 0044, optionally update vessel names
UPDATE vessels
SET name = CONCAT('[', type::text, '] ', COALESCE(name, 'Unnamed Vessel'))
WHERE type IS NOT NULL
  AND name IS NOT NULL
  AND deleted_at IS NULL;
```

**Option C: No Preservation (Recommended)**

Since vessel capabilities are now explicitly tracked, you likely don't need to preserve the old type. The combination of `is_pressure_vessel`, `jacketed`, and `name` provides more useful information.

### 3. Run Migration

Execute the migration file:

```bash
# Let me know when you're ready to push the migration
# I'll help you with the interactive prompt
```

Or manually:

```sql
-- Run migration 0044
\i packages/db/migrations/0044_remove_vessel_type.sql
```

### 4. Post-Migration Verification

After migration, verify the schema changes:

```sql
-- Verify column was dropped
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vessels'
ORDER BY ordinal_position;

-- Verify enum was dropped
SELECT typname
FROM pg_type
WHERE typname = 'vessel_type';
-- Should return 0 rows

-- Verify vessels still accessible
SELECT id, name, capacity, material, jacketed, is_pressure_vessel
FROM vessels
WHERE deleted_at IS NULL
LIMIT 5;
```

### 5. Update Application Code

The following files have been updated with TODO comments:

1. **packages/db/src/schema.ts** - Removed `vesselTypeEnum` and `type` field from vessels table
2. **packages/lib/src/schemas/index.ts** - Commented out `vesselTypeSchema`
3. **packages/lib/src/validation/vessel-state.ts** - Commented out:
   - `type` field in `VesselStateData` interface
   - `validateVesselTypeForOperation()` function
   - `type` field in `vesselStateValidationSchema`
4. **packages/api/src/routers/pressRun.ts** - Commented out `vesselType` field in query response

**Next Steps for Code Cleanup:**
- Remove all TODO comments after testing
- Remove commented-out code blocks
- Update TypeScript types that reference vessel type
- Update tests that use vessel type
- Update any UI components that display vessel type

## Backfilling Strategy

### Current Vessel Data

If you need to classify existing vessels based on their capabilities:

```sql
-- Identify fermenters (typically large, not pressure vessels)
SELECT id, name, capacity, is_pressure_vessel
FROM vessels
WHERE capacity_liters > 100
  AND is_pressure_vessel = 'no'
  AND deleted_at IS NULL;

-- Identify bright tanks (typically pressure vessels)
SELECT id, name, capacity, is_pressure_vessel
FROM vessels
WHERE is_pressure_vessel = 'yes'
  AND deleted_at IS NULL;

-- Identify small vessels that might be kegs
SELECT id, name, capacity, capacity_unit, is_pressure_vessel
FROM vessels
WHERE capacity < 100
  OR capacity_unit = 'gal' AND capacity < 30
  AND deleted_at IS NULL;
```

### Recommended Naming Convention

After migration, consider renaming vessels to be more descriptive:

**Good Examples:**
- "Primary Fermenter 1 (500L)"
- "Conditioning Tank A (300L)"
- "Bright Tank B (200L, Jacketed)"
- "Pressure Keg 1 (50L)"
- "Storage Barrel 3 (20gal)"

**Poor Examples:**
- "Tank 1"
- "FT1"
- "Vessel"

## Testing Checklist

Before deploying to production:

- [ ] Backup database
- [ ] Run migration on development database
- [ ] Verify all vessels still appear in UI
- [ ] Test creating new vessels without type field
- [ ] Test press run operations (vessel selection)
- [ ] Test batch operations (vessel selection)
- [ ] Test vessel filtering and sorting
- [ ] Run TypeScript type checker (`pnpm typecheck`)
- [ ] Run application tests (`pnpm test`)
- [ ] Verify no runtime errors in browser console
- [ ] Check for any references to `vessel.type` in logs

## Rollback Plan

If you need to revert this migration:

```sql
-- 1. Recreate the enum
CREATE TYPE vessel_type AS ENUM (
  'fermenter',
  'conditioning_tank',
  'bright_tank',
  'storage'
);

-- 2. Add the column back
ALTER TABLE vessels
ADD COLUMN type vessel_type;

-- 3. Backfill type values based on vessel characteristics
-- (This requires manual classification or using preserved notes)
UPDATE vessels
SET type = CASE
  WHEN name ILIKE '%fermenter%' THEN 'fermenter'::vessel_type
  WHEN name ILIKE '%bright%' THEN 'bright_tank'::vessel_type
  WHEN name ILIKE '%conditioning%' THEN 'conditioning_tank'::vessel_type
  WHEN name ILIKE '%storage%' THEN 'storage'::vessel_type
  ELSE 'storage'::vessel_type -- default to storage for unknown
END
WHERE type IS NULL;
```

**However, we do NOT recommend rolling back** - the new system is more flexible and better reflects real-world usage.

## FAQs

### Q: What if I have existing batches that reference vessel types?
**A:** Batches don't directly reference vessel types - they reference vessel IDs. The migration only removes the type categorization from vessels themselves.

### Q: How do I know what type of vessel to use for a new batch?
**A:** Choose vessels based on:
- **Capacity** - Ensure vessel can hold the batch volume
- **Pressure Capability** - Use pressure vessels for carbonated batches
- **Temperature Control** - Use jacketed vessels if temperature control is needed
- **Name** - Descriptive names help you identify purpose

### Q: Can I still filter vessels by "type"?
**A:** Not by the old type enum, but you can filter by:
- Pressure capability (`is_pressure_vessel = 'yes'`)
- Jacketed (`jacketed = 'yes'`)
- Capacity range
- Name (using ILIKE '%fermenter%', etc.)

### Q: Will this break my existing press runs or batches?
**A:** No. Press runs and batches reference vessels by ID, not by type. Existing data is unaffected.

## Timeline

1. **Code Review** - Review all changes in this PR
2. **Testing** - Test on development database
3. **Staging Deployment** - Deploy to staging environment
4. **Production Migration** - Run migration during maintenance window
5. **Code Cleanup** - Remove TODO comments and commented code after verification

## Support

If you encounter any issues during migration:
1. Check the PostgreSQL logs for errors
2. Verify the migration completed successfully using the verification queries above
3. Check application logs for any references to `vessel.type`
4. File an issue with error details if problems persist
