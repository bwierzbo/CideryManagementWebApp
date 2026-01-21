-- Add ttb_origin_year column to batches for tracking carryover cider
-- This indicates the tax year when the cider was originally produced
-- For carryover batches (e.g., 2023 cider carried into 2024), this will differ from the batch start_date year

ALTER TABLE batches ADD COLUMN ttb_origin_year integer;

-- Create index for efficient TTB reconciliation queries
CREATE INDEX idx_batches_ttb_origin_year ON batches(ttb_origin_year) WHERE ttb_origin_year IS NOT NULL;

-- Set default origin year based on start_date for all existing batches
UPDATE batches
SET ttb_origin_year = EXTRACT(YEAR FROM start_date)::integer
WHERE ttb_origin_year IS NULL;

-- Mark 2023 carryover batches (those originating from Olympic Bluff Cidery juice purchases)
-- These are internal transfers of 2023 cider into the 2024 system
UPDATE batches b
SET ttb_origin_year = 2023
FROM juice_purchase_items jpi
JOIN juice_purchases jp ON jpi.purchase_id = jp.id
JOIN vendors v ON jp.vendor_id = v.id
WHERE b.origin_juice_purchase_item_id = jpi.id
  AND v.name ILIKE '%olympic%bluff%';

-- Add comment explaining the column
COMMENT ON COLUMN batches.ttb_origin_year IS 'Tax year when cider was originally produced. For carryover batches, this differs from start_date year. Used for TTB Form 5120.17 reconciliation.';
