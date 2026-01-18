-- TTB Reconciliation Snapshots
-- Stores finalized reconciliation audits comparing TTB balance, inventory audit, and production audit
-- Provides audit trail and historical tracking of reconciliation activities

CREATE TABLE IF NOT EXISTS ttb_reconciliation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reconciliation identification
  reconciliation_date DATE NOT NULL,
  name TEXT,

  -- TTB Reference
  ttb_balance NUMERIC(12,3) NOT NULL,
  ttb_source_type TEXT NOT NULL,
  ttb_source_date DATE,

  -- Inventory Audit (Where is it now?)
  inventory_bulk NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_packaged NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_removals NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_legacy NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_accounted_for NUMERIC(12,3) NOT NULL DEFAULT 0,
  inventory_difference NUMERIC(12,3) NOT NULL DEFAULT 0,

  -- Production Audit (Did we track all sources?)
  production_press_runs NUMERIC(12,3) NOT NULL DEFAULT 0,
  production_juice_purchases NUMERIC(12,3) NOT NULL DEFAULT 0,
  production_total NUMERIC(12,3) NOT NULL DEFAULT 0,

  -- Breakdown data (JSON)
  production_by_year TEXT,
  inventory_by_year TEXT,
  tax_class_breakdown TEXT,

  -- Reconciliation status
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'finalized')),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id),

  -- Notes
  notes TEXT,
  discrepancy_explanation TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS ttb_reconciliation_snapshots_date_idx ON ttb_reconciliation_snapshots(reconciliation_date);
CREATE INDEX IF NOT EXISTS ttb_reconciliation_snapshots_status_idx ON ttb_reconciliation_snapshots(status);
CREATE INDEX IF NOT EXISTS ttb_reconciliation_snapshots_created_idx ON ttb_reconciliation_snapshots(created_at);

-- Comment
COMMENT ON TABLE ttb_reconciliation_snapshots IS 'Stores finalized TTB reconciliation audits for audit trail and historical tracking';
