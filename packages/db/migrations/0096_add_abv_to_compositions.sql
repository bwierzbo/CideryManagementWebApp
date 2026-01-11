-- Migration: Add ABV column to batch_compositions for robust ABV calculation
-- This allows the system to calculate blended ABV correctly for ANY product type

-- ============================================================================
-- Part 1: Add ABV column to batch_compositions
-- ============================================================================

ALTER TABLE batch_compositions
ADD COLUMN IF NOT EXISTS abv NUMERIC(5,2);

COMMENT ON COLUMN batch_compositions.abv IS
  'ABV of this component at the time it was added to the batch. Used for calculating blended ABV.';


-- ============================================================================
-- Part 2: Backfill ABV data for existing compositions
-- ============================================================================

-- 2a. Set ABV = 70 for brandy components
UPDATE batch_compositions
SET abv = 70
WHERE source_type = 'brandy'
  AND abv IS NULL;

-- 2b. Set ABV = 0 for fresh juice (base_fruit and juice_purchase with no fermentation)
UPDATE batch_compositions bc
SET abv = 0
WHERE bc.source_type IN ('base_fruit', 'juice_purchase')
  AND bc.abv IS NULL
  AND EXISTS (
    SELECT 1 FROM batches b
    WHERE b.id = bc.batch_id
    AND b.product_type IN ('pommeau', 'juice')
  );

-- 2c. For fermented cider compositions, try to get ABV from the source batch
-- This handles blends of already-fermented cider
UPDATE batch_compositions bc
SET abv = COALESCE(
  (SELECT COALESCE(b2.actual_abv, b2.estimated_abv)::numeric
   FROM batches b2
   WHERE b2.id = bc.batch_id),
  0
)
WHERE bc.source_type NOT IN ('brandy')
  AND bc.abv IS NULL;


-- ============================================================================
-- Part 3: Create universal ABV recalculation function
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_batch_abv_from_compositions(p_batch_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_result_abv NUMERIC;
BEGIN
  -- Simple weighted average using stored ABV values
  SELECT
    ROUND(
      SUM(COALESCE(juice_volume, 0) * COALESCE(abv, 0)) /
      NULLIF(SUM(COALESCE(juice_volume, 0)), 0),
      2
    )
  INTO v_result_abv
  FROM batch_compositions
  WHERE batch_id = p_batch_id
    AND deleted_at IS NULL;

  RETURN v_result_abv;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_batch_abv_from_compositions(UUID) IS
  'Recalculates ABV for a batch using stored ABV values in compositions. Works for any product type.';


-- ============================================================================
-- Part 4: Update trigger to work universally (remove product_type restriction)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_batch_abv_on_composition_change()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_new_abv NUMERIC;
  v_has_brandy BOOLEAN;
  v_product_type TEXT;
BEGIN
  -- Get the batch_id from the appropriate record
  IF TG_OP = 'DELETE' THEN
    v_batch_id := OLD.batch_id;
  ELSE
    v_batch_id := NEW.batch_id;
  END IF;

  -- Check if this batch has any brandy components (indicates it's a blend that needs ABV calc)
  SELECT EXISTS(
    SELECT 1 FROM batch_compositions
    WHERE batch_id = v_batch_id
    AND source_type = 'brandy'
    AND deleted_at IS NULL
  ) INTO v_has_brandy;

  -- Get product type
  SELECT product_type INTO v_product_type
  FROM batches
  WHERE id = v_batch_id;

  -- Recalculate ABV for:
  -- 1. Any batch with brandy components (pommeau, fortified products)
  -- 2. Any pommeau batch (even if brandy component was deleted)
  IF v_has_brandy OR v_product_type = 'pommeau' THEN
    v_new_abv := recalculate_batch_abv_from_compositions(v_batch_id);

    IF v_new_abv IS NOT NULL THEN
      UPDATE batches
      SET estimated_abv = v_new_abv,
          updated_at = NOW()
      WHERE id = v_batch_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_batch_abv_on_composition_change() IS
  'Automatically recalculates batch ABV when composition records are modified. Works for any blended product with brandy or pommeau type.';


-- ============================================================================
-- Part 5: Recalculate ABV for all batches with brandy components
-- ============================================================================

DO $$
DECLARE
  v_batch RECORD;
  v_new_abv NUMERIC;
BEGIN
  -- Find all batches that have brandy in their compositions
  FOR v_batch IN
    SELECT DISTINCT b.id, b.custom_name, b.estimated_abv
    FROM batches b
    JOIN batch_compositions bc ON bc.batch_id = b.id
    WHERE bc.source_type = 'brandy'
      AND bc.deleted_at IS NULL
      AND b.deleted_at IS NULL
  LOOP
    v_new_abv := recalculate_batch_abv_from_compositions(v_batch.id);

    IF v_new_abv IS NOT NULL AND v_new_abv != COALESCE(v_batch.estimated_abv, 0) THEN
      UPDATE batches
      SET estimated_abv = v_new_abv,
          updated_at = NOW()
      WHERE id = v_batch.id;

      RAISE NOTICE 'Updated % ABV: % -> %', v_batch.custom_name, v_batch.estimated_abv, v_new_abv;
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- Summary
-- ============================================================================
-- This migration:
-- 1. Added 'abv' column to batch_compositions to store component ABV
-- 2. Backfilled ABV for existing compositions (brandy=70, juice=0, fermented=from batch)
-- 3. Updated recalculation function to use stored ABV values
-- 4. Made trigger universal (works for any blend with brandy, not just pommeau)
-- 5. Recalculated ABV for all batches with brandy components
