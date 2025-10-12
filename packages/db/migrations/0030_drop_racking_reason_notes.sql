-- Migration 0030: Drop reason and notes columns from batch_racking_operations
-- Created: 2025-01-08
-- Volume loss is now auto-calculated, reason and notes are no longer needed

ALTER TABLE batch_racking_operations
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS notes;
