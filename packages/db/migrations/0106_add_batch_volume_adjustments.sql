-- Batch Volume Adjustments
-- Records physical inventory corrections for bulk batches with audit trail
-- Similar pattern to inventory_adjustments for packaged goods

-- Create adjustment type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_volume_adjustment_type') THEN
    CREATE TYPE batch_volume_adjustment_type AS ENUM (
      'evaporation',         -- Natural evaporation (angel's share)
      'measurement_error',   -- Physical count differs from calculated
      'sampling',            -- Volume removed for testing/QC
      'contamination',       -- Loss due to contamination
      'spillage',            -- Accidental spillage
      'theft',               -- Suspected theft
      'correction_up',       -- Undercount correction (increases volume)
      'correction_down',     -- Overcount correction (decreases volume)
      'other'                -- Other reason (requires notes)
    );
  END IF;
END
$$;

-- Create the batch volume adjustments table
CREATE TABLE IF NOT EXISTS batch_volume_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES vessels(id),

  -- Adjustment details
  adjustment_date TIMESTAMPTZ NOT NULL,
  adjustment_type batch_volume_adjustment_type NOT NULL,

  -- Volume tracking (all in liters for consistency)
  volume_before NUMERIC(10,3) NOT NULL,
  volume_after NUMERIC(10,3) NOT NULL,
  adjustment_amount NUMERIC(10,3) NOT NULL,

  -- Reason and notes
  reason TEXT NOT NULL,
  notes TEXT,

  -- TTB reconciliation link (optional - links to reconciliation when done during physical count)
  reconciliation_snapshot_id UUID REFERENCES ttb_reconciliation_snapshots(id),

  -- Audit trail
  adjusted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT volume_after_non_negative CHECK (volume_after >= 0),
  CONSTRAINT adjustment_amount_matches CHECK (
    ABS(volume_after - volume_before - adjustment_amount) < 0.01
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS batch_volume_adjustments_batch_idx
  ON batch_volume_adjustments(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS batch_volume_adjustments_vessel_idx
  ON batch_volume_adjustments(vessel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS batch_volume_adjustments_date_idx
  ON batch_volume_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS batch_volume_adjustments_reconciliation_idx
  ON batch_volume_adjustments(reconciliation_snapshot_id) WHERE reconciliation_snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS batch_volume_adjustments_type_idx
  ON batch_volume_adjustments(adjustment_type);

-- Comments for documentation
COMMENT ON TABLE batch_volume_adjustments IS 'Physical inventory corrections for bulk batches - updates batch current_volume_liters';
COMMENT ON COLUMN batch_volume_adjustments.adjustment_type IS 'Type of adjustment: evaporation, measurement_error, sampling, contamination, spillage, theft, correction_up, correction_down, other';
COMMENT ON COLUMN batch_volume_adjustments.volume_before IS 'Batch volume in liters before adjustment';
COMMENT ON COLUMN batch_volume_adjustments.volume_after IS 'Batch volume in liters after adjustment';
COMMENT ON COLUMN batch_volume_adjustments.adjustment_amount IS 'Change in volume (positive = increase, negative = decrease)';
COMMENT ON COLUMN batch_volume_adjustments.reason IS 'Required explanation for the adjustment';
COMMENT ON COLUMN batch_volume_adjustments.reconciliation_snapshot_id IS 'Optional link to TTB reconciliation when adjustment is part of physical count';
