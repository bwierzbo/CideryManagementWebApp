-- Add reorder threshold fields to all variety tables

-- Base Fruit Varieties
ALTER TABLE base_fruit_varieties
ADD COLUMN reorder_threshold NUMERIC(10, 3),
ADD COLUMN reorder_unit TEXT;

-- Additive Varieties
ALTER TABLE additive_varieties
ADD COLUMN reorder_threshold NUMERIC(10, 3),
ADD COLUMN reorder_unit TEXT;

-- Juice Varieties
ALTER TABLE juice_varieties
ADD COLUMN reorder_threshold NUMERIC(10, 3),
ADD COLUMN reorder_unit TEXT;

-- Packaging Varieties
ALTER TABLE packaging_varieties
ADD COLUMN reorder_threshold NUMERIC(10, 3),
ADD COLUMN reorder_unit TEXT;
