-- Add unit_type to packaging_purchase_items
ALTER TABLE packaging_purchase_items
ADD COLUMN unit_type TEXT;

-- Backfill with default value for existing records
UPDATE packaging_purchase_items
SET unit_type = 'individual'
WHERE unit_type IS NULL AND deleted_at IS NULL;
