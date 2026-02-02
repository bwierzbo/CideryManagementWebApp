-- Add 'sediment' to adjustment type enums for tracking lees/sediment losses

-- Add to batch_volume_adjustment_type (used by batch_volume_adjustments table)
ALTER TYPE batch_volume_adjustment_type ADD VALUE IF NOT EXISTS 'sediment';

-- Add to adjustment_type (used by reconciliation_adjustments table in TTB)
ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'sediment';
