-- Add normalized volume column to bottle_runs table
-- Stores volume taken in liters for accurate calculations

-- ============================================================
-- STEP 1: Add new column (nullable initially for backfill)
-- ============================================================

ALTER TABLE bottle_runs
  ADD COLUMN volume_taken_liters NUMERIC(10,3);

-- ============================================================
-- STEP 2: Backfill existing data using conversion function
-- ============================================================

-- Update volumes taken (convert from stored unit to liters)
-- Backfill ALL bottle runs including deleted ones
UPDATE bottle_runs
SET volume_taken_liters = convert_to_liters(
  CAST(volume_taken AS NUMERIC),
  volume_taken_unit
)
WHERE volume_taken IS NOT NULL
  AND volume_taken_unit IS NOT NULL;

-- ============================================================
-- STEP 3: Add NOT NULL constraint after backfill
-- ============================================================

-- After backfill, volume_taken_liters should always have a value
-- since volume_taken is NOT NULL
ALTER TABLE bottle_runs
  ALTER COLUMN volume_taken_liters SET NOT NULL;

-- ============================================================
-- STEP 4: Create index for performance
-- ============================================================

-- Index on volume_taken_liters for queries filtering by volume
CREATE INDEX idx_bottle_runs_volume_taken_liters
  ON bottle_runs(volume_taken_liters);

-- ============================================================
-- STEP 5: Create trigger function to auto-maintain normalized value
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_bottle_run_volume()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate volume_taken_liters when volume changes
  IF NEW.volume_taken IS NOT NULL AND NEW.volume_taken_unit IS NOT NULL THEN
    NEW.volume_taken_liters := convert_to_liters(
      CAST(NEW.volume_taken AS NUMERIC),
      NEW.volume_taken_unit
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 6: Create trigger to call the function
-- ============================================================

CREATE TRIGGER trigger_normalize_bottle_run_volume
  BEFORE INSERT OR UPDATE OF volume_taken, volume_taken_unit
  ON bottle_runs
  FOR EACH ROW
  EXECUTE FUNCTION normalize_bottle_run_volume();

-- ============================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================

-- Check that all bottle runs have normalized volumes:
-- SELECT COUNT(*) as total_bottle_runs,
--        COUNT(volume_taken_liters) as with_normalized_volume
-- FROM bottle_runs;

-- Compare original vs normalized volumes:
-- SELECT
--   id,
--   run_date,
--   volume_taken,
--   volume_taken_unit,
--   volume_taken_liters,
--   batch_id
-- FROM bottle_runs
-- LIMIT 5;
