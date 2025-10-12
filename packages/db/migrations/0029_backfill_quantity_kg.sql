-- Migration 0029: Backfill quantity_kg for existing basefruit_purchase_items
-- Created: 2025-01-08
-- Converts quantity to kg based on unit

UPDATE basefruit_purchase_items
SET quantity_kg =
  CASE
    WHEN unit = 'lb' THEN quantity * 0.453592
    WHEN unit = 'bushel' THEN quantity * 19.05
    ELSE quantity  -- kg, L, gal stay as-is
  END
WHERE quantity_kg IS NULL;
