-- Migration: Add batch filter operations tracking
-- Created: 2025-01-15
-- Purpose: Track filtering operations (coarse, fine, sterile) with volume loss

-- Create filter type enum
CREATE TYPE filter_type AS ENUM ('coarse', 'fine', 'sterile');

-- Create batch filter operations table
CREATE TABLE batch_filter_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  filter_type filter_type NOT NULL,

  -- Volume tracking
  volume_before NUMERIC(10, 3) NOT NULL,
  volume_before_unit unit NOT NULL DEFAULT 'L',
  volume_after NUMERIC(10, 3) NOT NULL,
  volume_after_unit unit NOT NULL DEFAULT 'L',
  volume_loss NUMERIC(10, 3) NOT NULL DEFAULT 0,

  -- Metadata
  notes TEXT,
  filtered_by TEXT,
  filtered_at TIMESTAMP NOT NULL DEFAULT NOW(),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX batch_filter_operations_batch_id_idx ON batch_filter_operations(batch_id);
CREATE INDEX batch_filter_operations_vessel_id_idx ON batch_filter_operations(vessel_id);
CREATE INDEX batch_filter_operations_filtered_at_idx ON batch_filter_operations(filtered_at);

-- Add comment
COMMENT ON TABLE batch_filter_operations IS 'Tracks filtering operations performed on batches, including coarse, fine, and sterile filtering with volume loss tracking';
COMMENT ON COLUMN batch_filter_operations.filter_type IS 'Type of filter used: coarse (removes large particles), fine (removes small particles), sterile (final filtering)';
COMMENT ON COLUMN batch_filter_operations.volume_loss IS 'Calculated volume lost during filtering (volume_before - volume_after)';
