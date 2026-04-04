-- Fix Salish #3 batch: correct productType, status, and ABV after brandy blend
-- The batch was blended with brandy via standard rack flow before the auto-reclassification fix.
-- ABV was calculated incorrectly due to stale reads during sequential brandy transfers.

UPDATE batches
SET
  product_type = 'pommeau',
  status = 'aging',
  fermentation_stage = 'not_applicable',
  actual_abv = '18',
  updated_at = NOW()
WHERE id = '61b5a88f-6f70-4d6f-8587-6bb9d592a7a7';
