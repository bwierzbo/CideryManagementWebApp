-- Migration: Refactor batch and vessel status enums
-- Batch status should track fermentation stage (fermentation, aging, conditioning, completed, discarded)
-- Vessel status should track physical state (available, in_use, cleaning, maintenance)

-- Step 1: Create new enum types
CREATE TYPE batch_status_new AS ENUM ('fermentation', 'aging', 'conditioning', 'completed', 'discarded');
CREATE TYPE vessel_status_new AS ENUM ('available', 'in_use', 'cleaning', 'maintenance');

-- Step 2: Add new columns with new types
ALTER TABLE batches ADD COLUMN status_new batch_status_new;
ALTER TABLE vessels ADD COLUMN status_new vessel_status_new;

-- Step 3: Migrate batch status data
-- Map old statuses to new ones:
-- 'planned' -> 'fermentation' (batch is being prepared)
-- 'active' -> 'fermentation' (batch is actively fermenting)
-- 'packaged' -> 'conditioning' (batch has been bottled)
-- 'blended' -> 'aging' (batch is being aged/blended)
UPDATE batches
SET status_new = CASE
  WHEN status = 'planned' THEN 'fermentation'::batch_status_new
  WHEN status = 'active' THEN 'fermentation'::batch_status_new
  WHEN status = 'packaged' THEN 'conditioning'::batch_status_new
  WHEN status = 'blended' THEN 'aging'::batch_status_new
  ELSE 'fermentation'::batch_status_new
END;

-- Step 4: Migrate vessel status data
-- Map old statuses to new ones:
-- 'available' -> 'available' (unchanged)
-- 'fermenting' -> 'in_use' (vessel contains a batch)
-- 'aging' -> 'in_use' (vessel contains a batch)
-- 'cleaning' -> 'cleaning' (unchanged)
-- 'maintenance' -> 'maintenance' (unchanged)
UPDATE vessels
SET status_new = CASE
  WHEN status = 'available' THEN 'available'::vessel_status_new
  WHEN status = 'fermenting' THEN 'in_use'::vessel_status_new
  WHEN status = 'aging' THEN 'in_use'::vessel_status_new
  WHEN status = 'cleaning' THEN 'cleaning'::vessel_status_new
  WHEN status = 'maintenance' THEN 'maintenance'::vessel_status_new
  ELSE 'available'::vessel_status_new
END;

-- Step 5: Make new columns NOT NULL (now that they have data)
ALTER TABLE batches ALTER COLUMN status_new SET NOT NULL;
ALTER TABLE vessels ALTER COLUMN status_new SET NOT NULL;

-- Step 6: Drop old columns
ALTER TABLE batches DROP COLUMN status;
ALTER TABLE vessels DROP COLUMN status;

-- Step 7: Rename new columns to old names
ALTER TABLE batches RENAME COLUMN status_new TO status;
ALTER TABLE vessels RENAME COLUMN status_new TO status;

-- Step 8: Drop old enum types
DROP TYPE batch_status;
DROP TYPE vessel_status;

-- Step 9: Rename new enum types to old names
ALTER TYPE batch_status_new RENAME TO batch_status;
ALTER TYPE vessel_status_new RENAME TO vessel_status;

-- Step 10: Set default values
ALTER TABLE batches ALTER COLUMN status SET DEFAULT 'fermentation'::batch_status;
ALTER TABLE vessels ALTER COLUMN status SET DEFAULT 'available'::vessel_status;
