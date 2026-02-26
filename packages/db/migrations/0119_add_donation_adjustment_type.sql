-- Add 'donation' to batch_volume_adjustment_type for tracking donated/given-away volume
ALTER TYPE batch_volume_adjustment_type ADD VALUE IF NOT EXISTS 'donation';
