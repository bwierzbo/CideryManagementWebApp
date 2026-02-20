-- Backfill distributedAt from updatedAt for distributed runs that are missing the timestamp.
-- This ensures "By Date Distributed" filtering works correctly for historical data.

-- Bottle runs: status 'distributed' or 'completed' with NULL distributed_at
UPDATE bottle_runs
SET distributed_at = updated_at
WHERE status IN ('distributed', 'completed')
  AND distributed_at IS NULL
  AND voided_at IS NULL;

-- Keg fills: status 'distributed' or 'returned' with NULL distributed_at
UPDATE keg_fills
SET distributed_at = updated_at
WHERE status IN ('distributed', 'returned')
  AND distributed_at IS NULL
  AND voided_at IS NULL
  AND deleted_at IS NULL;
