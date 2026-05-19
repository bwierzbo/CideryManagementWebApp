-- Adds destruction tracking for the new Destroy Batch flow.
--
-- Before this change, the only way to remove a batch was vessel.purge, which
-- soft-deleted the batch row (deleted_at = now). The result: destroyed cider
-- was invisible to TTB Form 5120.17 because most reports filter on
-- deleted_at IS NULL.
--
-- Now Destroy Batch sets status='discarded' (already in batch_status enum,
-- previously unused) plus the new destroyed_at / destruction_reason /
-- destruction_category columns, AND writes a batch_volume_adjustments row
-- of the new 'destruction' type. TTB loss reports surface it as a distinct
-- "Destroyed in process" line.

-- 1. New adjustment type so destruction adjustments are categorically
--    separate from sediment/spillage/contamination on TTB loss breakdowns.
ALTER TYPE batch_volume_adjustment_type ADD VALUE IF NOT EXISTS 'destruction';

-- 2. Destruction-tracking columns on batches. Nullable: only populated when
--    Destroy Batch runs.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS destroyed_at TIMESTAMPTZ;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS destruction_reason TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS destruction_category TEXT;

-- 3. Helpful index for "show me everything destroyed this year" TTB queries.
CREATE INDEX IF NOT EXISTS batches_destroyed_at_idx
  ON batches (destroyed_at)
  WHERE destroyed_at IS NOT NULL;
