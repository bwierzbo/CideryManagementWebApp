-- Add year-aware reconciliation verification
-- When a batch is verified for a specific year, this tracks which year was verified.
-- Carried-forward batches need re-verification each year because new activity
-- (packaging, transfers, losses) may have occurred.
ALTER TABLE batches ADD COLUMN reconciliation_verified_for_year INTEGER;

-- Backfill: all currently verified batches get their start year as the verified year
UPDATE batches
SET reconciliation_verified_for_year = EXTRACT(YEAR FROM start_date)::INTEGER
WHERE reconciliation_status = 'verified'
  AND start_date IS NOT NULL;
