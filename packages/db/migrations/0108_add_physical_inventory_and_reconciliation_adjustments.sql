-- Migration: Add Physical Inventory Counts and Reconciliation Adjustments
-- For TTB Batch Lifecycle Audit feature

-- Physical Inventory Counts Table
-- Stores vessel-by-vessel physical count entries during TTB reconciliation
CREATE TABLE IF NOT EXISTS physical_inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_snapshot_id UUID NOT NULL REFERENCES ttb_reconciliation_snapshots(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES vessels(id),
  batch_id UUID REFERENCES batches(id),

  -- Book vs Physical volumes (in liters for consistency with batch volumes)
  book_volume_liters NUMERIC(10,3) NOT NULL,
  physical_volume_liters NUMERIC(10,3) NOT NULL,
  variance_liters NUMERIC(10,3) NOT NULL,
  variance_percentage NUMERIC(5,2),

  -- Count metadata
  counted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  counted_by UUID REFERENCES users(id),
  measurement_method TEXT, -- dipstick, sight_glass, flowmeter, estimated
  notes TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for physical_inventory_counts
CREATE INDEX IF NOT EXISTS physical_inventory_counts_recon_idx
  ON physical_inventory_counts(reconciliation_snapshot_id);
CREATE INDEX IF NOT EXISTS physical_inventory_counts_vessel_idx
  ON physical_inventory_counts(vessel_id);
CREATE INDEX IF NOT EXISTS physical_inventory_counts_batch_idx
  ON physical_inventory_counts(batch_id);
CREATE INDEX IF NOT EXISTS physical_inventory_counts_counted_at_idx
  ON physical_inventory_counts(counted_at);

-- Reconciliation Adjustments Table
-- Stores adjustments made during reconciliation with reason codes
CREATE TABLE IF NOT EXISTS reconciliation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_snapshot_id UUID NOT NULL REFERENCES ttb_reconciliation_snapshots(id) ON DELETE CASCADE,

  -- Link to what was adjusted
  batch_id UUID REFERENCES batches(id),
  vessel_id UUID REFERENCES vessels(id),
  physical_count_id UUID REFERENCES physical_inventory_counts(id),

  -- Adjustment details (volumes in liters)
  adjustment_type TEXT NOT NULL, -- evaporation, measurement_error, sampling, contamination, spillage, theft, correction_up, correction_down, other
  volume_before_liters NUMERIC(10,3) NOT NULL,
  volume_after_liters NUMERIC(10,3) NOT NULL,
  adjustment_liters NUMERIC(10,3) NOT NULL,

  -- Reason and audit trail
  reason TEXT NOT NULL,
  notes TEXT,

  -- Link to batch_volume_adjustments if adjustment was applied
  applied_to_batch_id UUID REFERENCES batches(id),
  batch_volume_adjustment_id UUID REFERENCES batch_volume_adjustments(id),

  -- Audit
  adjusted_by UUID NOT NULL REFERENCES users(id),
  adjusted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for reconciliation_adjustments
CREATE INDEX IF NOT EXISTS reconciliation_adjustments_recon_idx
  ON reconciliation_adjustments(reconciliation_snapshot_id);
CREATE INDEX IF NOT EXISTS reconciliation_adjustments_batch_idx
  ON reconciliation_adjustments(batch_id);
CREATE INDEX IF NOT EXISTS reconciliation_adjustments_vessel_idx
  ON reconciliation_adjustments(vessel_id);
CREATE INDEX IF NOT EXISTS reconciliation_adjustments_adjusted_at_idx
  ON reconciliation_adjustments(adjusted_at);

-- Add new columns to ttb_reconciliation_snapshots for physical inventory support
ALTER TABLE ttb_reconciliation_snapshots
  ADD COLUMN IF NOT EXISTS has_physical_inventory BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS physical_inventory_total_liters NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS adjustments_total_liters NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS batch_disposition_summary TEXT; -- JSON summary of where batches ended up
