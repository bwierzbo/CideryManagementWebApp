-- TTB Reconciliation Period Enhancement
-- Adds period-based reconciliation support with physical inventory tracking
-- Enables continuous reconciliation periods with automatic opening balance carry-forward

-- Add period tracking columns to ttb_reconciliation_snapshots
ALTER TABLE ttb_reconciliation_snapshots
  ADD COLUMN IF NOT EXISTS period_start_date DATE,
  ADD COLUMN IF NOT EXISTS period_end_date DATE,
  ADD COLUMN IF NOT EXISTS previous_reconciliation_id UUID REFERENCES ttb_reconciliation_snapshots(id),
  ADD COLUMN IF NOT EXISTS opening_balance_gallons NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS calculated_ending_gallons NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS physical_count_gallons NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS variance_gallons NUMERIC(12,3);

-- Update period_end_date to match reconciliation_date for existing records
UPDATE ttb_reconciliation_snapshots
SET period_end_date = reconciliation_date
WHERE period_end_date IS NULL;

-- Add index for period queries
CREATE INDEX IF NOT EXISTS ttb_reconciliation_snapshots_period_idx
  ON ttb_reconciliation_snapshots(period_start_date, period_end_date)
  WHERE period_start_date IS NOT NULL;

-- Add index for finding previous reconciliation
CREATE INDEX IF NOT EXISTS ttb_reconciliation_snapshots_prev_idx
  ON ttb_reconciliation_snapshots(previous_reconciliation_id)
  WHERE previous_reconciliation_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN ttb_reconciliation_snapshots.period_start_date IS 'Start date of reconciliation period (exclusive - day after previous period end)';
COMMENT ON COLUMN ttb_reconciliation_snapshots.period_end_date IS 'End date of reconciliation period (inclusive - typically = reconciliation_date)';
COMMENT ON COLUMN ttb_reconciliation_snapshots.previous_reconciliation_id IS 'Link to previous finalized reconciliation for continuous tracking';
COMMENT ON COLUMN ttb_reconciliation_snapshots.opening_balance_gallons IS 'Opening balance at period start (from previous reconciliation physical count or TTB opening balance)';
COMMENT ON COLUMN ttb_reconciliation_snapshots.calculated_ending_gallons IS 'Calculated ending balance: Opening + Production - Removals - Losses';
COMMENT ON COLUMN ttb_reconciliation_snapshots.physical_count_gallons IS 'Actual physical inventory count at period end';
COMMENT ON COLUMN ttb_reconciliation_snapshots.variance_gallons IS 'Difference between calculated and physical count (physical - calculated)';
