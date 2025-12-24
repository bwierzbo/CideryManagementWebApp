-- Add isArchived column to batches table
-- Archived batches are hidden from default views but preserved for historical data

ALTER TABLE batches ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add archivedAt timestamp to track when batch was archived
ALTER TABLE batches ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Add archivedReason to explain why batch was archived
ALTER TABLE batches ADD COLUMN archived_reason TEXT;

-- Create index for efficient filtering
CREATE INDEX batches_is_archived_idx ON batches (is_archived);

-- Archive existing batches that have 0 volume and are completed
-- These are typically source batches that have been fully transferred
UPDATE batches
SET
  is_archived = true,
  archived_at = NOW(),
  archived_reason = 'Auto-archived: Batch fully transferred (0L remaining)'
WHERE
  status = 'completed'
  AND (current_volume = 0 OR current_volume IS NULL)
  AND deleted_at IS NULL;
