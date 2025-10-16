-- Add normalized capacity column to vessels table
-- Stores vessel capacity in liters for accurate calculations

-- ============================================================
-- STEP 1: Add new column (nullable initially for backfill)
-- ============================================================

ALTER TABLE vessels
  ADD COLUMN capacity_liters NUMERIC(10,3);

-- ============================================================
-- STEP 2: Backfill existing data using conversion function
-- ============================================================

-- Update capacities (convert from stored unit to liters)
-- Backfill ALL vessels including deleted ones
UPDATE vessels
SET capacity_liters = convert_to_liters(
  CAST(capacity AS NUMERIC),
  capacity_unit
)
WHERE capacity IS NOT NULL
  AND capacity_unit IS NOT NULL;

-- ============================================================
-- STEP 3: Add NOT NULL constraint after backfill
-- ============================================================

-- After backfill, capacity_liters should always have a value
-- since capacity is NOT NULL
ALTER TABLE vessels
  ALTER COLUMN capacity_liters SET NOT NULL;

-- ============================================================
-- STEP 4: Create index for performance
-- ============================================================

-- Index on capacity_liters for queries filtering by capacity
-- Partial index excludes deleted vessels
CREATE INDEX idx_vessels_capacity_liters
  ON vessels(capacity_liters)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 5: Create trigger function to auto-maintain normalized value
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_vessel_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate capacity_liters when capacity changes
  IF NEW.capacity IS NOT NULL AND NEW.capacity_unit IS NOT NULL THEN
    NEW.capacity_liters := convert_to_liters(
      CAST(NEW.capacity AS NUMERIC),
      NEW.capacity_unit
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 6: Create trigger to call the function
-- ============================================================

CREATE TRIGGER trigger_normalize_vessel_capacity
  BEFORE INSERT OR UPDATE OF capacity, capacity_unit
  ON vessels
  FOR EACH ROW
  EXECUTE FUNCTION normalize_vessel_capacity();

-- ============================================================
-- VERIFICATION QUERIES (commented out)
-- ============================================================

-- Check that all vessels have normalized capacities:
-- SELECT COUNT(*) as total_vessels,
--        COUNT(capacity_liters) as with_normalized_capacity
-- FROM vessels
-- WHERE deleted_at IS NULL;

-- Compare original vs normalized capacities:
-- SELECT
--   id,
--   name,
--   capacity,
--   capacity_unit,
--   capacity_liters,
--   material
-- FROM vessels
-- WHERE deleted_at IS NULL
-- LIMIT 5;
