-- Add quantity_used field to track consumption for additives and packaging
-- Mirrors the volumeAllocated pattern used for juice purchases
--
-- NOTE: No backfill is needed because the old code was decrementing the
-- `quantity` field directly when materials were used. The current `quantity`
-- values already represent remaining inventory. Going forward, `quantity`
-- stays fixed at purchase amount and `quantityUsed` tracks consumption.

-- Add quantity_used to additive_purchase_items (decimal to match quantity field)
ALTER TABLE additive_purchase_items
ADD COLUMN quantity_used DECIMAL(10, 3) NOT NULL DEFAULT '0';

-- Add quantity_used to packaging_purchase_items (integer to match quantity field)
ALTER TABLE packaging_purchase_items
ADD COLUMN quantity_used INTEGER NOT NULL DEFAULT 0;
