-- Migration 0026: Fix batch_status enum to match TypeScript schema
-- Created: 2025-01-08
-- Changes batch_status enum from (planned, active, completed, cancelled, packaged, blended)
-- to (fermentation, aging, conditioning, completed, discarded)

-- The column is currently using batch_status_old type
-- We already have batch_status type with correct values
-- We just need to migrate the data and switch the column type

-- ============================================================================
-- Convert column from batch_status_old to batch_status with data mapping
-- ============================================================================

-- Map old values to new values using CASE statement
ALTER TABLE batches
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE batch_status USING (
    CASE status::text
      WHEN 'planned' THEN 'fermentation'
      WHEN 'active' THEN 'fermentation'
      WHEN 'completed' THEN 'completed'
      WHEN 'cancelled' THEN 'discarded'
      WHEN 'packaged' THEN 'completed'
      WHEN 'blended' THEN 'fermentation'
      ELSE 'fermentation'  -- fallback
    END::batch_status
  ),
  ALTER COLUMN status SET DEFAULT 'fermentation'::batch_status;

-- Drop the old enum type
DROP TYPE batch_status_old;
