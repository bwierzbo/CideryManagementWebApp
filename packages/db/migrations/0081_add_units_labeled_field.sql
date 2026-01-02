-- Add units_labeled field for partial labeling support
-- This tracks how many bottles have been labeled vs total unitsProduced

ALTER TABLE bottle_runs
ADD COLUMN units_labeled INTEGER DEFAULT 0;

-- Backfill: If labeledAt is set, assume all units were labeled
UPDATE bottle_runs
SET units_labeled = units_produced
WHERE labeled_at IS NOT NULL AND units_labeled = 0;

-- Add comment
COMMENT ON COLUMN bottle_runs.units_labeled IS 'Number of units that have been labeled. When < unitsProduced, more labels can be applied.';
