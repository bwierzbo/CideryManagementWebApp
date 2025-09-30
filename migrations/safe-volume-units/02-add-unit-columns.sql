-- Safe Volume/Unit Migration - Step 2: Add Unit Columns
-- This migration ONLY ADDS new columns, does NOT modify or remove existing data

BEGIN; -- Start transaction for safety

-- ============================================
-- 1. ADD UNIT COLUMNS (Non-destructive)
-- ============================================

-- BATCHES - Add unit columns without touching existing volume_l columns
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS initial_volume_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS current_volume_unit unit DEFAULT 'L';

-- VESSELS - Add unit column
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS capacity_unit unit DEFAULT 'L';

-- JUICE_PURCHASE_ITEMS
ALTER TABLE juice_purchase_items
  ADD COLUMN IF NOT EXISTS volume_unit unit DEFAULT 'L';

-- JUICE_LOTS
ALTER TABLE juice_lots
  ADD COLUMN IF NOT EXISTS volume_unit unit DEFAULT 'L';

-- BATCH_COMPOSITIONS
ALTER TABLE batch_compositions
  ADD COLUMN IF NOT EXISTS juice_volume_unit unit DEFAULT 'L';

-- BATCH_MEASUREMENTS
ALTER TABLE batch_measurements
  ADD COLUMN IF NOT EXISTS volume_unit unit DEFAULT 'L';

-- PACKAGES
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS volume_packaged_unit unit DEFAULT 'L';

-- APPLE_PRESS_RUNS
ALTER TABLE apple_press_runs
  ADD COLUMN IF NOT EXISTS total_juice_volume_unit unit DEFAULT 'L';

-- APPLE_PRESS_RUN_LOADS
ALTER TABLE apple_press_run_loads
  ADD COLUMN IF NOT EXISTS juice_volume_unit unit DEFAULT 'L';

-- PRESS_ITEMS
ALTER TABLE press_items
  ADD COLUMN IF NOT EXISTS juice_produced_unit unit DEFAULT 'L';

-- BATCH_TRANSFERS
ALTER TABLE batch_transfers
  ADD COLUMN IF NOT EXISTS volume_transferred_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS loss_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS total_volume_processed_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS remaining_volume_unit unit DEFAULT 'L';

-- BATCH_MERGE_HISTORY
ALTER TABLE batch_merge_history
  ADD COLUMN IF NOT EXISTS volume_added_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS target_volume_before_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS target_volume_after_unit unit DEFAULT 'L';

-- PACKAGING_RUNS
ALTER TABLE packaging_runs
  ADD COLUMN IF NOT EXISTS volume_taken_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS loss_unit unit DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS unit_size_unit unit DEFAULT 'L';

-- ============================================
-- 2. ADD DUPLICATE COLUMNS WITHOUT '_L' SUFFIX
-- These will exist alongside the original columns
-- ============================================

-- BATCHES - Add new columns that mirror the _l columns
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS initial_volume numeric(10,3),
  ADD COLUMN IF NOT EXISTS current_volume numeric(10,3);

-- Copy data from _l columns to new columns
UPDATE batches
SET
  initial_volume = initial_volume_l,
  current_volume = current_volume_l
WHERE initial_volume IS NULL OR current_volume IS NULL;

-- VESSELS
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS capacity numeric(10,3);

UPDATE vessels
SET capacity = capacity_l
WHERE capacity IS NULL;

-- JUICE_PURCHASE_ITEMS
ALTER TABLE juice_purchase_items
  ADD COLUMN IF NOT EXISTS volume numeric(10,3);

UPDATE juice_purchase_items
SET volume = volume_l
WHERE volume IS NULL;

-- JUICE_LOTS
ALTER TABLE juice_lots
  ADD COLUMN IF NOT EXISTS volume numeric(10,3);

UPDATE juice_lots
SET volume = volume_l
WHERE volume IS NULL;

-- BATCH_COMPOSITIONS
ALTER TABLE batch_compositions
  ADD COLUMN IF NOT EXISTS juice_volume numeric(12,3);

UPDATE batch_compositions
SET juice_volume = juice_volume_l
WHERE juice_volume IS NULL;

-- BATCH_MEASUREMENTS
ALTER TABLE batch_measurements
  ADD COLUMN IF NOT EXISTS volume numeric(10,3);

UPDATE batch_measurements
SET volume = volume_l
WHERE volume IS NULL;

-- PACKAGES
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS volume_packaged numeric(10,3);

UPDATE packages
SET volume_packaged = volume_packaged_l
WHERE volume_packaged IS NULL;

-- APPLE_PRESS_RUNS
ALTER TABLE apple_press_runs
  ADD COLUMN IF NOT EXISTS total_juice_volume numeric(10,3);

UPDATE apple_press_runs
SET total_juice_volume = total_juice_volume_l
WHERE total_juice_volume IS NULL;

-- APPLE_PRESS_RUN_LOADS
ALTER TABLE apple_press_run_loads
  ADD COLUMN IF NOT EXISTS juice_volume numeric(10,3);

UPDATE apple_press_run_loads
SET juice_volume = juice_volume_l
WHERE juice_volume IS NULL;

-- PRESS_ITEMS
ALTER TABLE press_items
  ADD COLUMN IF NOT EXISTS juice_produced numeric(10,3);

UPDATE press_items
SET juice_produced = juice_produced_l
WHERE juice_produced IS NULL;

-- BATCH_TRANSFERS
ALTER TABLE batch_transfers
  ADD COLUMN IF NOT EXISTS volume_transferred numeric(10,3),
  ADD COLUMN IF NOT EXISTS loss numeric(10,3),
  ADD COLUMN IF NOT EXISTS total_volume_processed numeric(10,3),
  ADD COLUMN IF NOT EXISTS remaining_volume numeric(10,3);

UPDATE batch_transfers
SET
  volume_transferred = volume_transferred_l,
  loss = loss_l,
  total_volume_processed = total_volume_processed_l,
  remaining_volume = remaining_volume_l
WHERE volume_transferred IS NULL;

-- BATCH_MERGE_HISTORY
ALTER TABLE batch_merge_history
  ADD COLUMN IF NOT EXISTS volume_added numeric(10,3),
  ADD COLUMN IF NOT EXISTS target_volume_before numeric(10,3),
  ADD COLUMN IF NOT EXISTS target_volume_after numeric(10,3);

UPDATE batch_merge_history
SET
  volume_added = volume_added_l,
  target_volume_before = target_volume_before_l,
  target_volume_after = target_volume_after_l
WHERE volume_added IS NULL;

-- PACKAGING_RUNS
ALTER TABLE packaging_runs
  ADD COLUMN IF NOT EXISTS volume_taken numeric(10,2),
  ADD COLUMN IF NOT EXISTS loss numeric(10,2),
  ADD COLUMN IF NOT EXISTS unit_size numeric(10,4);

UPDATE packaging_runs
SET
  volume_taken = volume_taken_l,
  loss = loss_l,
  unit_size = unit_size_l
WHERE volume_taken IS NULL;

-- ============================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vessels_capacity_unit ON vessels(capacity_unit);
CREATE INDEX IF NOT EXISTS idx_batches_volume_units ON batches(initial_volume_unit, current_volume_unit);
CREATE INDEX IF NOT EXISTS idx_batch_transfers_volume_units ON batch_transfers(volume_transferred_unit);

-- ============================================
-- 4. VERIFICATION
-- ============================================

-- Verify that no data was lost
DO $$
DECLARE
  batches_before INTEGER;
  batches_after INTEGER;
BEGIN
  -- Check batches count
  SELECT COUNT(*) INTO batches_before FROM batches WHERE initial_volume_l IS NOT NULL;
  SELECT COUNT(*) INTO batches_after FROM batches WHERE initial_volume IS NOT NULL;

  IF batches_before != batches_after THEN
    RAISE EXCEPTION 'Data mismatch: batches volume copy failed';
  END IF;

  RAISE NOTICE 'Verification passed: % batches with volume data preserved', batches_after;
END $$;

-- Show summary of changes
SELECT 'Migration Complete - Summary' as status;
SELECT 'New columns added, original data preserved' as info;

SELECT
  'batches' as table_name,
  COUNT(*) as total_records,
  COUNT(initial_volume_l) as original_initial_volume,
  COUNT(initial_volume) as new_initial_volume,
  COUNT(initial_volume_unit) as with_unit
FROM batches

UNION ALL

SELECT
  'vessels' as table_name,
  COUNT(*) as total_records,
  COUNT(capacity_l) as original_capacity,
  COUNT(capacity) as new_capacity,
  COUNT(capacity_unit) as with_unit
FROM vessels;

COMMIT; -- Commit the transaction if everything succeeded

-- Note: The old _l columns are still present and unchanged
-- They can be removed in a future migration after verifying the application works with new columns