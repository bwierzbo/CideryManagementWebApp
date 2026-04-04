-- Add 'cyser' to the product_type enum
-- Cyser = apple juice co-fermented with honey (taxed as wine for TTB)
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'cyser' AFTER 'wine';
