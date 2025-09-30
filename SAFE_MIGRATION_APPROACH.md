# Safe Database Migration Approach for Volume/Unit Separation

## ⚠️ IMPORTANT: Always backup before migrations!

```bash
# Create a backup first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Safe Migration Steps

### 1. Add New Columns Without Touching Existing Data

```sql
-- This approach ADDS columns without modifying existing ones
-- No data loss risk

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS initial_volume numeric(10,3),
  ADD COLUMN IF NOT EXISTS initial_volume_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS current_volume numeric(10,3),
  ADD COLUMN IF NOT EXISTS current_volume_unit unit DEFAULT 'L';

ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS capacity numeric(10,3),
  ADD COLUMN IF NOT EXISTS capacity_unit unit DEFAULT 'L';

-- Copy data from old columns to new ones
UPDATE batches
SET
  initial_volume = initial_volume_l,
  current_volume = current_volume_l
WHERE initial_volume IS NULL;

UPDATE vessels
SET capacity = capacity_l
WHERE capacity IS NULL;
```

### 2. Verify Data Before Removing Old Columns

```sql
-- Check that data was copied correctly
SELECT
  COUNT(*) as total,
  COUNT(initial_volume_l) as old_initial,
  COUNT(initial_volume) as new_initial,
  COUNT(current_volume_l) as old_current,
  COUNT(current_volume) as new_current
FROM batches;

-- Only proceed if counts match!
```

### 3. Update Application Code First

1. Update schema.ts to use new column names
2. Update API to handle both old and new columns
3. Deploy and test
4. Only then remove old columns

### 4. Remove Old Columns (Only After Verification)

```sql
-- Only run this after confirming data is safe
ALTER TABLE batches
  DROP COLUMN initial_volume_l,
  DROP COLUMN current_volume_l;

ALTER TABLE vessels
  DROP COLUMN capacity_l;
```

## Alternative: Non-Destructive Approach

Instead of renaming columns, keep both versions:

```typescript
// In schema.ts - support both field names
export const batches = pgTable("batches", {
  // Keep old fields for compatibility
  initialVolumeL: decimal("initial_volume_l", { precision: 10, scale: 3 }),
  currentVolumeL: decimal("current_volume_l", { precision: 10, scale: 3 }),

  // New fields with units
  initialVolume: decimal("initial_volume", { precision: 10, scale: 3 }),
  initialVolumeUnit: unitEnum("initial_volume_unit").default("L"),
  currentVolume: decimal("current_volume", { precision: 10, scale: 3 }),
  currentVolumeUnit: unitEnum("current_volume_unit").default("L"),
});
```

## Recovery Steps If Data Was Lost

1. **Restore from backup**
   ```bash
   psql $DATABASE_URL < backup_file.sql
   ```

2. **Use Neon's point-in-time recovery** (if using Neon)
   - Go to Neon dashboard
   - Select "Restore"
   - Choose timestamp before migration
   - Create branch from that point

3. **Check for soft deletes**
   ```sql
   -- Some data might be soft-deleted, not hard-deleted
   SELECT * FROM batches WHERE deleted_at IS NOT NULL;
   ```

## Testing Migration Safely

Always test on a development database first:

```bash
# Create a test branch in Neon
neon branches create --name test-migration

# Run migration on test branch
psql $TEST_DATABASE_URL < migration.sql

# Verify no data loss
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM batches;"
```

## Key Principles

1. **Never use CASCADE** in production migrations
2. **Always ADD before REMOVE**
3. **Copy data, verify, then delete old columns**
4. **Test on a copy of production data first**
5. **Have a rollback plan ready**
6. **Use transactions for atomic changes**

```sql
BEGIN;
  -- migration steps here
  -- if anything goes wrong, can ROLLBACK
COMMIT;
```