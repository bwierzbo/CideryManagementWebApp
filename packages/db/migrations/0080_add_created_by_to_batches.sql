-- Add created_by column to batches table for user attribution
ALTER TABLE batches ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS batches_created_by_idx ON batches(created_by);

-- Backfill from audit_logs where possible
UPDATE batches b
SET created_by = (
  SELECT al.changed_by
  FROM audit_logs al
  WHERE al.table_name = 'batches'
    AND al.record_id = b.id
    AND al.operation = 'create'
    AND al.changed_by IS NOT NULL
  ORDER BY al.changed_at ASC
  LIMIT 1
)
WHERE b.created_by IS NULL;
