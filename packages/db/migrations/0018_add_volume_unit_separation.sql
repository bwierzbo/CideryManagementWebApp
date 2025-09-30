-- Migration to add separate volume and unit tracking
-- This migration adds unit columns to all volume fields and renames existing volume columns

-- 1. VESSELS TABLE - Update capacity tracking
ALTER TABLE vessels
  RENAME COLUMN capacity_l TO capacity;

-- capacity_unit already exists but ensure it has a default
ALTER TABLE vessels
  ALTER COLUMN capacity_unit SET DEFAULT 'L';

-- Update any null capacity_unit values to 'L'
UPDATE vessels
  SET capacity_unit = 'L'
  WHERE capacity_unit IS NULL;

-- 2. JUICE_PURCHASE_ITEMS TABLE
ALTER TABLE juice_purchase_items
  RENAME COLUMN volume_l TO volume;

ALTER TABLE juice_purchase_items
  ADD COLUMN volume_unit unit DEFAULT 'L' NOT NULL;

-- 3. JUICE_LOTS TABLE
ALTER TABLE juice_lots
  RENAME COLUMN volume_l TO volume;

ALTER TABLE juice_lots
  ADD COLUMN volume_unit unit DEFAULT 'L' NOT NULL;

-- 4. BATCHES TABLE
ALTER TABLE batches
  RENAME COLUMN initial_volume_l TO initial_volume;

ALTER TABLE batches
  RENAME COLUMN current_volume_l TO current_volume;

ALTER TABLE batches
  ADD COLUMN initial_volume_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN current_volume_unit unit DEFAULT 'L' NOT NULL;

-- 5. BATCH_COMPOSITIONS TABLE
ALTER TABLE batch_compositions
  RENAME COLUMN juice_volume_l TO juice_volume;

ALTER TABLE batch_compositions
  ADD COLUMN juice_volume_unit unit DEFAULT 'L' NOT NULL;

-- 6. BATCH_MEASUREMENTS TABLE
ALTER TABLE batch_measurements
  RENAME COLUMN volume_l TO volume;

ALTER TABLE batch_measurements
  ADD COLUMN volume_unit unit DEFAULT 'L' NOT NULL;

-- 7. PACKAGES TABLE
ALTER TABLE packages
  RENAME COLUMN volume_packaged_l TO volume_packaged;

ALTER TABLE packages
  ADD COLUMN volume_packaged_unit unit DEFAULT 'L' NOT NULL;

-- 8. APPLE_PRESS_RUNS TABLE
ALTER TABLE apple_press_runs
  RENAME COLUMN total_juice_volume_l TO total_juice_volume;

ALTER TABLE apple_press_runs
  ADD COLUMN total_juice_volume_unit unit DEFAULT 'L' NOT NULL;

-- 9. APPLE_PRESS_RUN_LOADS TABLE
ALTER TABLE apple_press_run_loads
  RENAME COLUMN juice_volume_l TO juice_volume;

ALTER TABLE apple_press_run_loads
  ADD COLUMN juice_volume_unit unit DEFAULT 'L' NOT NULL;

-- Keep original_volume and original_volume_unit as they are (already separated)

-- 10. PRESS_ITEMS TABLE
ALTER TABLE press_items
  RENAME COLUMN juice_produced_l TO juice_produced;

ALTER TABLE press_items
  ADD COLUMN juice_produced_unit unit DEFAULT 'L' NOT NULL;

-- 10b. PRESS_RUNS TABLE (legacy/old press workflow)
ALTER TABLE press_runs
  RENAME COLUMN total_juice_produced_l TO total_juice_produced;

ALTER TABLE press_runs
  ADD COLUMN total_juice_produced_unit unit DEFAULT 'L' NOT NULL;

-- 11. BATCH_TRANSFERS TABLE
ALTER TABLE batch_transfers
  RENAME COLUMN volume_transferred_l TO volume_transferred;

ALTER TABLE batch_transfers
  RENAME COLUMN loss_l TO loss;

ALTER TABLE batch_transfers
  RENAME COLUMN total_volume_processed_l TO total_volume_processed;

ALTER TABLE batch_transfers
  RENAME COLUMN remaining_volume_l TO remaining_volume;

ALTER TABLE batch_transfers
  ADD COLUMN volume_transferred_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN loss_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN total_volume_processed_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN remaining_volume_unit unit DEFAULT 'L' NOT NULL;

-- 12. BATCH_MERGE_HISTORY TABLE
ALTER TABLE batch_merge_history
  RENAME COLUMN volume_added_l TO volume_added;

ALTER TABLE batch_merge_history
  RENAME COLUMN target_volume_before_l TO target_volume_before;

ALTER TABLE batch_merge_history
  RENAME COLUMN target_volume_after_l TO target_volume_after;

ALTER TABLE batch_merge_history
  ADD COLUMN volume_added_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN target_volume_before_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN target_volume_after_unit unit DEFAULT 'L' NOT NULL;

-- 13. PACKAGING_RUNS TABLE
ALTER TABLE packaging_runs
  RENAME COLUMN volume_taken_l TO volume_taken;

ALTER TABLE packaging_runs
  RENAME COLUMN loss_l TO loss;

ALTER TABLE packaging_runs
  RENAME COLUMN unit_size_l TO unit_size;

ALTER TABLE packaging_runs
  ADD COLUMN volume_taken_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN loss_unit unit DEFAULT 'L' NOT NULL,
  ADD COLUMN unit_size_unit unit DEFAULT 'L' NOT NULL;

-- Add indexes for efficient queries on unit columns
CREATE INDEX idx_vessels_capacity_unit ON vessels(capacity_unit);
CREATE INDEX idx_batches_volume_units ON batches(initial_volume_unit, current_volume_unit);
CREATE INDEX idx_batch_transfers_volume_units ON batch_transfers(volume_transferred_unit);

-- Add check constraints to ensure volume values are positive
ALTER TABLE vessels ADD CONSTRAINT chk_capacity_positive CHECK (capacity >= 0);
ALTER TABLE batches ADD CONSTRAINT chk_initial_volume_positive CHECK (initial_volume >= 0);
ALTER TABLE batches ADD CONSTRAINT chk_current_volume_positive CHECK (current_volume >= 0);
ALTER TABLE batch_transfers ADD CONSTRAINT chk_volume_transferred_positive CHECK (volume_transferred >= 0);

-- Create a helper function to convert between units
CREATE OR REPLACE FUNCTION convert_volume(
  value DECIMAL,
  from_unit unit,
  to_unit unit
) RETURNS DECIMAL AS $$
BEGIN
  -- If units are the same, return the value
  IF from_unit = to_unit THEN
    RETURN value;
  END IF;

  -- Convert to liters first (base unit)
  DECLARE
    value_in_liters DECIMAL;
  BEGIN
    CASE from_unit
      WHEN 'L' THEN value_in_liters := value;
      WHEN 'gal' THEN value_in_liters := value * 3.78541;
      ELSE
        RAISE EXCEPTION 'Unsupported volume unit for conversion: %', from_unit;
    END CASE;

    -- Then convert from liters to target unit
    CASE to_unit
      WHEN 'L' THEN RETURN value_in_liters;
      WHEN 'gal' THEN RETURN value_in_liters / 3.78541;
      ELSE
        RAISE EXCEPTION 'Unsupported volume unit for conversion: %', to_unit;
    END CASE;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for easy volume queries in any unit
CREATE OR REPLACE VIEW batch_volumes_view AS
SELECT
  id,
  name,
  initial_volume,
  initial_volume_unit,
  current_volume,
  current_volume_unit,
  -- Computed columns for common conversions
  convert_volume(initial_volume, initial_volume_unit, 'L') as initial_volume_liters,
  convert_volume(initial_volume, initial_volume_unit, 'gal') as initial_volume_gallons,
  convert_volume(current_volume, current_volume_unit, 'L') as current_volume_liters,
  convert_volume(current_volume, current_volume_unit, 'gal') as current_volume_gallons
FROM batches;