-- Add "wine" to the product_type enum for batches with non-apple/pear fruit (TTB IC 17-2)
ALTER TYPE "product_type" ADD VALUE IF NOT EXISTS 'wine';
