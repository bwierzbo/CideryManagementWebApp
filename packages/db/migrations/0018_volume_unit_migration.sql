-- Migration to add separate volume and unit tracking
-- This migration handles the conversion properly with USING clause

-- 1. First, add the new unit columns as text temporarily
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS initial_volume_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS current_volume_unit text DEFAULT 'L';

ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS capacity_unit text DEFAULT 'L';

ALTER TABLE juice_purchase_items
  ADD COLUMN IF NOT EXISTS volume_unit text DEFAULT 'L';

ALTER TABLE juice_lots
  ADD COLUMN IF NOT EXISTS volume_unit text DEFAULT 'L';

ALTER TABLE batch_compositions
  ADD COLUMN IF NOT EXISTS juice_volume_unit text DEFAULT 'L';

ALTER TABLE batch_measurements
  ADD COLUMN IF NOT EXISTS volume_unit text DEFAULT 'L';

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS volume_packaged_unit text DEFAULT 'L';

ALTER TABLE apple_press_runs
  ADD COLUMN IF NOT EXISTS total_juice_volume_unit text DEFAULT 'L';

ALTER TABLE apple_press_run_loads
  ADD COLUMN IF NOT EXISTS juice_volume_unit text DEFAULT 'L';

ALTER TABLE press_items
  ADD COLUMN IF NOT EXISTS juice_produced_unit text DEFAULT 'L';

ALTER TABLE batch_transfers
  ADD COLUMN IF NOT EXISTS volume_transferred_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS loss_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS total_volume_processed_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS remaining_volume_unit text DEFAULT 'L';

ALTER TABLE batch_merge_history
  ADD COLUMN IF NOT EXISTS volume_added_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS target_volume_before_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS target_volume_after_unit text DEFAULT 'L';

ALTER TABLE packaging_runs
  ADD COLUMN IF NOT EXISTS volume_taken_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS loss_unit text DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS unit_size_unit text DEFAULT 'L';

-- 2. Now convert the text columns to enum type using explicit casting
ALTER TABLE batches
  ALTER COLUMN initial_volume_unit TYPE unit USING initial_volume_unit::unit,
  ALTER COLUMN current_volume_unit TYPE unit USING current_volume_unit::unit;

ALTER TABLE vessels
  ALTER COLUMN capacity_unit TYPE unit USING capacity_unit::unit;

ALTER TABLE juice_purchase_items
  ALTER COLUMN volume_unit TYPE unit USING volume_unit::unit;

ALTER TABLE juice_lots
  ALTER COLUMN volume_unit TYPE unit USING volume_unit::unit;

ALTER TABLE batch_compositions
  ALTER COLUMN juice_volume_unit TYPE unit USING juice_volume_unit::unit;

ALTER TABLE batch_measurements
  ALTER COLUMN volume_unit TYPE unit USING volume_unit::unit;

ALTER TABLE packages
  ALTER COLUMN volume_packaged_unit TYPE unit USING volume_packaged_unit::unit;

ALTER TABLE apple_press_runs
  ALTER COLUMN total_juice_volume_unit TYPE unit USING total_juice_volume_unit::unit;

ALTER TABLE apple_press_run_loads
  ALTER COLUMN juice_volume_unit TYPE unit USING juice_volume_unit::unit;

ALTER TABLE press_items
  ALTER COLUMN juice_produced_unit TYPE unit USING juice_produced_unit::unit;

ALTER TABLE batch_transfers
  ALTER COLUMN volume_transferred_unit TYPE unit USING volume_transferred_unit::unit,
  ALTER COLUMN loss_unit TYPE unit USING loss_unit::unit,
  ALTER COLUMN total_volume_processed_unit TYPE unit USING total_volume_processed_unit::unit,
  ALTER COLUMN remaining_volume_unit TYPE unit USING remaining_volume_unit::unit;

ALTER TABLE batch_merge_history
  ALTER COLUMN volume_added_unit TYPE unit USING volume_added_unit::unit,
  ALTER COLUMN target_volume_before_unit TYPE unit USING target_volume_before_unit::unit,
  ALTER COLUMN target_volume_after_unit TYPE unit USING target_volume_after_unit::unit;

ALTER TABLE packaging_runs
  ALTER COLUMN volume_taken_unit TYPE unit USING volume_taken_unit::unit,
  ALTER COLUMN loss_unit TYPE unit USING loss_unit::unit,
  ALTER COLUMN unit_size_unit TYPE unit USING unit_size_unit::unit;

-- 3. Rename the volume columns to remove the 'L' suffix
ALTER TABLE batches
  RENAME COLUMN initial_volume_l TO initial_volume;
ALTER TABLE batches
  RENAME COLUMN current_volume_l TO current_volume;

ALTER TABLE vessels
  RENAME COLUMN capacity_l TO capacity;

ALTER TABLE juice_purchase_items
  RENAME COLUMN volume_l TO volume;

ALTER TABLE juice_lots
  RENAME COLUMN volume_l TO volume;

ALTER TABLE batch_compositions
  RENAME COLUMN juice_volume_l TO juice_volume;

ALTER TABLE batch_measurements
  RENAME COLUMN volume_l TO volume;

ALTER TABLE packages
  RENAME COLUMN volume_packaged_l TO volume_packaged;

ALTER TABLE apple_press_runs
  RENAME COLUMN total_juice_volume_l TO total_juice_volume;

ALTER TABLE apple_press_run_loads
  RENAME COLUMN juice_volume_l TO juice_volume;

ALTER TABLE press_items
  RENAME COLUMN juice_produced_l TO juice_produced;

ALTER TABLE batch_transfers
  RENAME COLUMN volume_transferred_l TO volume_transferred;
ALTER TABLE batch_transfers
  RENAME COLUMN loss_l TO loss;
ALTER TABLE batch_transfers
  RENAME COLUMN total_volume_processed_l TO total_volume_processed;
ALTER TABLE batch_transfers
  RENAME COLUMN remaining_volume_l TO remaining_volume;

ALTER TABLE batch_merge_history
  RENAME COLUMN volume_added_l TO volume_added;
ALTER TABLE batch_merge_history
  RENAME COLUMN target_volume_before_l TO target_volume_before;
ALTER TABLE batch_merge_history
  RENAME COLUMN target_volume_after_l TO target_volume_after;

ALTER TABLE packaging_runs
  RENAME COLUMN volume_taken_l TO volume_taken;
ALTER TABLE packaging_runs
  RENAME COLUMN loss_l TO loss;
ALTER TABLE packaging_runs
  RENAME COLUMN unit_size_l TO unit_size;

-- 4. Add indexes for efficient queries on unit columns
CREATE INDEX IF NOT EXISTS idx_vessels_capacity_unit ON vessels(capacity_unit);
CREATE INDEX IF NOT EXISTS idx_batches_volume_units ON batches(initial_volume_unit, current_volume_unit);
CREATE INDEX IF NOT EXISTS idx_batch_transfers_volume_units ON batch_transfers(volume_transferred_unit);

-- 5. Add check constraints to ensure volume values are positive
ALTER TABLE vessels ADD CONSTRAINT chk_capacity_positive CHECK (capacity >= 0);
ALTER TABLE batches ADD CONSTRAINT chk_initial_volume_positive CHECK (initial_volume >= 0);
ALTER TABLE batches ADD CONSTRAINT chk_current_volume_positive CHECK (current_volume >= 0);
ALTER TABLE batch_transfers ADD CONSTRAINT chk_volume_transferred_positive CHECK (volume_transferred >= 0);