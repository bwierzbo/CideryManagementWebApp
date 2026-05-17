-- Add "addition" as a valid batch_volume_adjustment_type so the addAdditive
-- mutation can record volume increases from honey, brandy/spirits, fruit
-- purée, etc. with semantically correct labeling (instead of mislabeling as
-- correction_up or other).
ALTER TYPE batch_volume_adjustment_type ADD VALUE IF NOT EXISTS 'addition';
