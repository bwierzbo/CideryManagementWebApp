-- Add normalized volume columns to batches table
-- These columns store volumes in a standard unit (liters) for accurate calculations
-- and are automatically maintained via triggers

-- ============================================================
-- STEP 1: Add new columns (nullable initially for backfill)
-- ============================================================

ALTER TABLE batches
  ADD COLUMN initial_volume_liters NUMERIC(10,3),
  ADD COLUMN current_volume_liters NUMERIC(10,3);

-- ============================================================
-- STEP 2: Backfill existing data using conversion functions
-- ============================================================

-- Update initial volumes (convert from stored unit to liters)
-- Backfill ALL batches including deleted ones to satisfy NOT NULL constraint
UPDATE batches
SET initial_volume_liters = convert_to_liters(
  CAST(initial_volume AS NUMERIC),
  initial_volume_unit
)
WHERE initial_volume IS NOT NULL
  AND initial_volume_unit IS NOT NULL;

-- Update current volumes (convert from stored unit to liters)
-- Backfill ALL batches including deleted ones
UPDATE batches
SET current_volume_liters = convert_to_liters(
  CAST(current_volume AS NUMERIC),
  current_volume_unit
)
WHERE current_volume IS NOT NULL
  AND current_volume_unit IS NOT NULL;

-- ============================================================
-- STEP 3: Add NOT NULL constraint to initial_volume_liters
-- ============================================================

-- After backfill, initial_volume_liters should always have a value
ALTER TABLE batches
  ALTER COLUMN initial_volume_liters SET NOT NULL;

-- current_volume_liters remains nullable (batch may not have current volume set)

-- ============================================================
-- STEP 4: Create index for performance
-- ============================================================

-- Index on current_volume_liters for queries filtering by volume
-- Partial index excludes deleted batches
CREATE INDEX idx_batches_volume_liters
  ON batches(current_volume_liters)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 5: Create trigger function to auto-maintain normalized values
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_batch_volumes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate initial_volume_liters when initial_volume changes
  IF NEW.initial_volume IS NOT NULL AND NEW.initial_volume_unit IS NOT NULL THEN
    NEW.initial_volume_liters := convert_to_liters(
      CAST(NEW.initial_volume AS NUMERIC),
      NEW.initial_volume_unit
    );
  END IF;

  -- Automatically calculate current_volume_liters when current_volume changes
  IF NEW.current_volume IS NOT NULL AND NEW.current_volume_unit IS NOT NULL THEN
    NEW.current_volume_liters := convert_to_liters(
      CAST(NEW.current_volume AS NUMERIC),
      NEW.current_volume_unit
    );
  ELSE
    -- If current_volume is NULL, set normalized value to NULL as well
    NEW.current_volume_liters := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 6: Create trigger to call the function
-- ============================================================

CREATE TRIGGER trigger_normalize_batch_volumes
  BEFORE INSERT OR UPDATE OF initial_volume, initial_volume_unit, current_volume, current_volume_unit
  ON batches
  FOR EACH ROW
  EXECUTE FUNCTION normalize_batch_volumes();

-- ============================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================

-- Check that all non-deleted batches have normalized initial volumes:
-- SELECT COUNT(*) as total_batches,
--        COUNT(initial_volume_liters) as with_normalized_initial
-- FROM batches
-- WHERE deleted_at IS NULL;

-- Compare original vs normalized volumes for a few batches:
-- SELECT
--   id,
--   initial_volume,
--   initial_volume_unit,
--   initial_volume_liters,
--   current_volume,
--   current_volume_unit,
--   current_volume_liters
-- FROM batches
-- WHERE deleted_at IS NULL
-- LIMIT 5;

-- Test the trigger by inserting a batch with gallons:
-- INSERT INTO batches (
--   name, batch_number, vessel_id,
--   initial_volume, initial_volume_unit,
--   current_volume, current_volume_unit
-- ) VALUES (
--   'Test Batch', 'TEST-001', (SELECT id FROM vessels LIMIT 1),
--   '50', 'gal',
--   '48', 'gal'
-- ) RETURNING
--   initial_volume, initial_volume_unit, initial_volume_liters,
--   current_volume, current_volume_unit, current_volume_liters;
