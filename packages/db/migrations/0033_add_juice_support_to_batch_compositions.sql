-- Migration: Add juice purchase support to batch_compositions
-- This allows batch_compositions to track both base fruit AND juice purchases

-- Step 1: Add source_type column to identify the type of composition
ALTER TABLE batch_compositions
ADD COLUMN source_type TEXT NOT NULL DEFAULT 'base_fruit'
CHECK (source_type IN ('base_fruit', 'juice_purchase'));

-- Step 2: Add juice_purchase_item_id reference (nullable)
ALTER TABLE batch_compositions
ADD COLUMN juice_purchase_item_id UUID REFERENCES juice_purchase_items(id);

-- Step 3: Make fruit-specific columns nullable since juice won't have these
ALTER TABLE batch_compositions
ALTER COLUMN purchase_item_id DROP NOT NULL,
ALTER COLUMN variety_id DROP NOT NULL,
ALTER COLUMN input_weight_kg DROP NOT NULL,
ALTER COLUMN fraction_of_batch DROP NOT NULL;

-- Step 4: Drop the old unique constraint and recreate it to handle both types
DROP INDEX IF EXISTS batch_compositions_batch_purchase_item_unique_idx;

-- Step 5: Add new constraint - ensure either purchase_item_id OR juice_purchase_item_id is set
ALTER TABLE batch_compositions
ADD CONSTRAINT batch_compositions_source_check
CHECK (
  (source_type = 'base_fruit' AND purchase_item_id IS NOT NULL AND juice_purchase_item_id IS NULL) OR
  (source_type = 'juice_purchase' AND juice_purchase_item_id IS NOT NULL AND purchase_item_id IS NULL)
);

-- Step 6: Add unique constraints for both source types
CREATE UNIQUE INDEX batch_compositions_batch_fruit_item_unique_idx
ON batch_compositions(batch_id, purchase_item_id)
WHERE purchase_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX batch_compositions_batch_juice_item_unique_idx
ON batch_compositions(batch_id, juice_purchase_item_id)
WHERE juice_purchase_item_id IS NOT NULL AND deleted_at IS NULL;

-- Step 7: Add index for juice_purchase_item_id lookups
CREATE INDEX batch_compositions_juice_purchase_item_idx
ON batch_compositions(juice_purchase_item_id)
WHERE juice_purchase_item_id IS NOT NULL;

-- Step 8: Update check constraint for inputWeightKg to allow NULL
ALTER TABLE batch_compositions DROP CONSTRAINT IF EXISTS batch_compositions_input_weight_kg_positive;
ALTER TABLE batch_compositions
ADD CONSTRAINT batch_compositions_input_weight_kg_positive
CHECK (input_weight_kg IS NULL OR input_weight_kg >= 0);

-- Step 9: Update check constraint for fractionOfBatch to allow NULL
ALTER TABLE batch_compositions DROP CONSTRAINT IF EXISTS batch_compositions_fraction_of_batch_valid;
ALTER TABLE batch_compositions
ADD CONSTRAINT batch_compositions_fraction_of_batch_valid
CHECK (fraction_of_batch IS NULL OR (fraction_of_batch >= 0 AND fraction_of_batch <= 1));
