-- Add 'juice' to product_type enum for unfermented juice batches
-- This allows proper ABV calculation when blending juice with spirits (pommeau)

ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'juice' BEFORE 'cider';
