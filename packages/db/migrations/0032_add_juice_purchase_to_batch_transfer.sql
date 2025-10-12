-- Migration: Add juice purchase to batch transfer functionality
-- Description: Adds volume tracking and batch origin fields for juice purchases

-- Add volume_allocated column to juice_purchase_items
ALTER TABLE juice_purchase_items
ADD COLUMN IF NOT EXISTS volume_allocated numeric(10, 3) DEFAULT '0' NOT NULL;

-- Add origin_juice_purchase_item_id to batches
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS origin_juice_purchase_item_id uuid REFERENCES juice_purchase_items(id);

-- Add source_juice_purchase_item_id to batch_merge_history
ALTER TABLE batch_merge_history
ADD COLUMN IF NOT EXISTS source_juice_purchase_item_id uuid REFERENCES juice_purchase_items(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS batches_origin_juice_purchase_idx
ON batches (origin_juice_purchase_item_id);

CREATE INDEX IF NOT EXISTS batch_merge_history_source_juice_purchase_idx
ON batch_merge_history (source_juice_purchase_item_id);

-- Update sourceType comment to include 'juice_purchase'
COMMENT ON COLUMN batch_merge_history.source_type IS 'Source type: press_run, batch_transfer, or juice_purchase';
