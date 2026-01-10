-- Make additive_variety_id required on additive_purchase_items
-- This ensures all additive inventory items are properly linked to a variety
-- for filtering by item type (e.g., "Fermentation Organisms")

ALTER TABLE additive_purchase_items
ALTER COLUMN additive_variety_id SET NOT NULL;
