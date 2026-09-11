-- New first lifecycle stage: fresh-pressed batches hold as 'juice'
-- until fermentation starts (yeast pitched, or a wild ferment shown
-- by a gravity drop). Lifecycle: juice -> fermentation -> aging ->
-- conditioning -> completed.
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'juice' BEFORE 'fermentation';
