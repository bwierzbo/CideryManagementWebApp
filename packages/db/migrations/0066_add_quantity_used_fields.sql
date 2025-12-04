-- Add quantity_used field to track consumption for additives and packaging
-- Mirrors the volumeAllocated pattern used for juice purchases

-- Add quantity_used to additive_purchase_items (decimal to match quantity field)
ALTER TABLE additive_purchase_items
ADD COLUMN quantity_used DECIMAL(10, 3) NOT NULL DEFAULT '0';

-- Add quantity_used to packaging_purchase_items (integer to match quantity field)
ALTER TABLE packaging_purchase_items
ADD COLUMN quantity_used INTEGER NOT NULL DEFAULT 0;

-- Backfill additive quantity_used from batch_additives
UPDATE additive_purchase_items api
SET quantity_used = COALESCE((
  SELECT SUM(CAST(ba.amount AS DECIMAL(10,3)))
  FROM batch_additives ba
  WHERE ba.additive_purchase_item_id = api.id
    AND ba.deleted_at IS NULL
), 0);

-- Backfill packaging quantity_used from bottle_run_materials and keg_fill_materials
UPDATE packaging_purchase_items ppi
SET quantity_used =
  COALESCE((
    SELECT SUM(brm.quantity_used)
    FROM bottle_run_materials brm
    WHERE brm.packaging_purchase_item_id = ppi.id
  ), 0)
  +
  COALESCE((
    SELECT SUM(kfm.quantity_used)
    FROM keg_fill_materials kfm
    WHERE kfm.packaging_purchase_item_id = ppi.id
  ), 0);
