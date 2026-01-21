-- Add reconciliation tracking fields to batches table
-- This helps track which batches should be counted for TTB reconciliation

-- Add reconciliation status enum
DO $$ BEGIN
  CREATE TYPE batch_reconciliation_status AS ENUM ('verified', 'duplicate', 'excluded', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add reconciliation fields to batches
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS reconciliation_status batch_reconciliation_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT,
ADD COLUMN IF NOT EXISTS parent_batch_id UUID REFERENCES batches(id),
ADD COLUMN IF NOT EXISTS is_racking_derivative BOOLEAN DEFAULT false;

-- Add index for reconciliation queries
CREATE INDEX IF NOT EXISTS batches_reconciliation_status_idx ON batches(reconciliation_status);
CREATE INDEX IF NOT EXISTS batches_parent_batch_id_idx ON batches(parent_batch_id);

-- Add comment explaining the fields
COMMENT ON COLUMN batches.reconciliation_status IS 'Status for TTB reconciliation: verified=counted, duplicate=racking duplicate not counted, excluded=manually excluded, pending=needs review';
COMMENT ON COLUMN batches.reconciliation_notes IS 'Notes explaining reconciliation decisions';
COMMENT ON COLUMN batches.parent_batch_id IS 'Reference to parent batch if this is a derivative (racking, split, etc.)';
COMMENT ON COLUMN batches.is_racking_derivative IS 'True if this batch was created from a racking operation (has -R suffix)';
