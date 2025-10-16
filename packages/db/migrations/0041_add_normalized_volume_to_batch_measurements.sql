-- Add normalized volume column to batch_measurements table
-- Stores measurement volume in liters for accurate calculations

-- ============================================================
-- STEP 1: Add new column (nullable initially for backfill)
-- ============================================================

ALTER TABLE batch_measurements
  ADD COLUMN volume_liters NUMERIC(10,3);

-- ============================================================
-- STEP 2: Backfill existing data using conversion function
-- ============================================================

-- Update volumes (convert from stored unit to liters)
-- Backfill ALL measurements including deleted ones
UPDATE batch_measurements
SET volume_liters = convert_to_liters(
  CAST(volume AS NUMERIC),
  volume_unit
)
WHERE volume IS NOT NULL
  AND volume_unit IS NOT NULL;

-- ============================================================
-- STEP 3: Create index for performance
-- ============================================================

-- Index on volume_liters for queries filtering by volume
-- Partial index excludes deleted measurements
CREATE INDEX idx_batch_measurements_volume_liters
  ON batch_measurements(volume_liters)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 4: Create trigger function to auto-maintain normalized value
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_batch_measurement_volume()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate volume_liters when volume changes
  IF NEW.volume IS NOT NULL AND NEW.volume_unit IS NOT NULL THEN
    NEW.volume_liters := convert_to_liters(
      CAST(NEW.volume AS NUMERIC),
      NEW.volume_unit
    );
  ELSE
    NEW.volume_liters := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 5: Create trigger to call the function
-- ============================================================

CREATE TRIGGER trigger_normalize_batch_measurement_volume
  BEFORE INSERT OR UPDATE OF volume, volume_unit
  ON batch_measurements
  FOR EACH ROW
  EXECUTE FUNCTION normalize_batch_measurement_volume();

-- ============================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================

-- Check that all measurements have normalized volumes:
-- SELECT COUNT(*) as total_measurements,
--        COUNT(volume_liters) as with_normalized_volume
-- FROM batch_measurements
-- WHERE deleted_at IS NULL;

-- Compare original vs normalized volumes:
-- SELECT
--   id,
--   batch_id,
--   volume,
--   volume_unit,
--   volume_liters,
--   measurement_date
-- FROM batch_measurements
-- WHERE deleted_at IS NULL
-- LIMIT 5;
