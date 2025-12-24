-- Add max_capacity column to vessels table
-- capacity = working/standard fill level
-- max_capacity = absolute maximum including headspace (for overfill situations)

ALTER TABLE vessels ADD COLUMN max_capacity DECIMAL(10, 3);

-- Set max_capacity equal to capacity for existing vessels (can be adjusted per vessel later)
UPDATE vessels SET max_capacity = capacity WHERE max_capacity IS NULL;
