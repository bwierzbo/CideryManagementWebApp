-- Add fermentation stage tracking for unstarted and non-applicable batches
-- not_started: juice/cider/perry awaiting fermentation (yeast not added, SG unchanged)
-- not_applicable: brandy/pommeau/spirits (don't ferment)

-- Set brandy and pommeau batches to not_applicable (they don't ferment)
UPDATE batches
SET fermentation_stage = 'not_applicable',
    fermentation_stage_updated_at = NOW()
WHERE product_type IN ('brandy', 'pommeau')
  AND deleted_at IS NULL;

-- Set juice batches to not_started (awaiting use)
UPDATE batches
SET fermentation_stage = 'not_started',
    fermentation_stage_updated_at = NOW()
WHERE product_type = 'juice'
  AND deleted_at IS NULL;

-- Set cider/perry batches with unknown stage and no SG drop to not_started
-- (Only if they have OG but no measurements showing fermentation activity)
UPDATE batches b
SET fermentation_stage = 'not_started',
    fermentation_stage_updated_at = NOW()
WHERE b.product_type IN ('cider', 'perry')
  AND b.fermentation_stage = 'unknown'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    -- Check if any SG measurement exists that's lower than OG
    SELECT 1 FROM batch_measurements bm
    WHERE bm.batch_id = b.id
      AND bm.specific_gravity IS NOT NULL
      AND b.original_gravity IS NOT NULL
      AND bm.specific_gravity < b.original_gravity - 0.005
  )
  AND NOT EXISTS (
    -- Check if yeast/fermentation organism was ever added to this batch
    -- NOTE: Check additive_type, not additive_name, since yeast strains are named 'AB-1', 'EC-1118', etc.
    SELECT 1 FROM batch_additives ba
    WHERE ba.batch_id = b.id
      AND ba.additive_type = 'Fermentation Organisms'
      AND ba.deleted_at IS NULL
  );
