-- Migration 0028: Fix vessel_status enum to match TypeScript schema
-- Created: 2025-01-08
-- Simplifies vessel_status to (available, cleaning, maintenance)
-- Vessel colors will be based on batch status when batch is present

-- ============================================================================
-- PART 1: Map in_use to available
-- ============================================================================

-- Map in_use → available (vessel color now comes from batch status)
UPDATE vessels SET status = 'available' WHERE status = 'in_use';

-- ============================================================================
-- PART 2: Recreate enum with only correct values
-- ============================================================================

-- Create the new enum type
CREATE TYPE vessel_status_new AS ENUM ('available', 'cleaning', 'maintenance');

-- Update the column to use the new enum type
ALTER TABLE vessels
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE vessel_status_new USING status::text::vessel_status_new,
  ALTER COLUMN status SET DEFAULT 'available'::vessel_status_new;

-- Drop the old enum and rename the new one
DROP TYPE vessel_status;
ALTER TYPE vessel_status_new RENAME TO vessel_status;
