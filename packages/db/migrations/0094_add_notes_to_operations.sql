-- Add notes field to batch_filter_operations
ALTER TABLE batch_filter_operations
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add notes field to batch_racking_operations
ALTER TABLE batch_racking_operations
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN batch_filter_operations.notes IS 'Optional notes about the filtering operation';
COMMENT ON COLUMN batch_racking_operations.notes IS 'Optional notes about the racking operation';
