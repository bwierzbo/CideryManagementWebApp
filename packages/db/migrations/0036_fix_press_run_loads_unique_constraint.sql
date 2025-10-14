-- Fix press_run_loads unique constraint to exclude deleted rows
-- This allows sequence numbers to be reused after deletion

-- Drop the old unique index
DROP INDEX IF EXISTS press_run_loads_unique_sequence;

-- Create a new partial unique index that only applies to non-deleted rows
CREATE UNIQUE INDEX press_run_loads_unique_sequence
  ON press_run_loads(press_run_id, load_sequence)
  WHERE deleted_at IS NULL;
