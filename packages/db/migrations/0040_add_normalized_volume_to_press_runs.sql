-- Add normalized volume column to press_runs table
-- Stores total juice volume in liters for accurate calculations

-- ============================================================
-- STEP 1: Add new column (nullable initially for backfill)
-- ============================================================

ALTER TABLE press_runs
  ADD COLUMN total_juice_volume_liters NUMERIC(10,3);

-- ============================================================
-- STEP 2: Backfill existing data using conversion function
-- ============================================================

-- Update total juice volumes (convert from stored unit to liters)
-- Backfill ALL press runs including deleted ones
UPDATE press_runs
SET total_juice_volume_liters = convert_to_liters(
  CAST(total_juice_volume AS NUMERIC),
  total_juice_volume_unit
)
WHERE total_juice_volume IS NOT NULL
  AND total_juice_volume_unit IS NOT NULL;

-- ============================================================
-- STEP 3: Create index for performance
-- ============================================================

-- Index on total_juice_volume_liters for queries filtering by volume
-- Partial index excludes deleted press runs
CREATE INDEX idx_press_runs_juice_volume_liters
  ON press_runs(total_juice_volume_liters)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 4: Create trigger function to auto-maintain normalized value
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_press_run_volume()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate total_juice_volume_liters when volume changes
  IF NEW.total_juice_volume IS NOT NULL AND NEW.total_juice_volume_unit IS NOT NULL THEN
    NEW.total_juice_volume_liters := convert_to_liters(
      CAST(NEW.total_juice_volume AS NUMERIC),
      NEW.total_juice_volume_unit
    );
  ELSE
    NEW.total_juice_volume_liters := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 5: Create trigger to call the function
-- ============================================================

CREATE TRIGGER trigger_normalize_press_run_volume
  BEFORE INSERT OR UPDATE OF total_juice_volume, total_juice_volume_unit
  ON press_runs
  FOR EACH ROW
  EXECUTE FUNCTION normalize_press_run_volume();

-- ============================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================

-- Check that all press runs have normalized volumes:
-- SELECT COUNT(*) as total_press_runs,
--        COUNT(total_juice_volume_liters) as with_normalized_volume
-- FROM press_runs
-- WHERE deleted_at IS NULL;

-- Compare original vs normalized volumes:
-- SELECT
--   press_run_name,
--   total_juice_volume,
--   total_juice_volume_unit,
--   total_juice_volume_liters
-- FROM press_runs
-- WHERE deleted_at IS NULL
-- LIMIT 5;
