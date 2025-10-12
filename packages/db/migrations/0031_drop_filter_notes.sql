-- Migration 0031: Drop notes column from batch_filter_operations
-- Created: 2025-01-08
-- Notes are no longer needed for filter operations

ALTER TABLE batch_filter_operations
  DROP COLUMN IF EXISTS notes;
