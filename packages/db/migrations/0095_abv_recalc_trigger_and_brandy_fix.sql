-- Migration: Add UPDATE trigger for ABV recalculation + Set ABV on brandy batches
-- This ensures ABV is recalculated when merge history is updated (not just inserted)
-- and that brandy batches have their estimated_abv set for consistent calculations

-- Part 1: Enhance the trigger to also fire on UPDATE
-- =====================================================

-- Drop the existing INSERT-only trigger
DROP TRIGGER IF EXISTS trigger_sync_batch_abv_on_merge ON batch_merge_history;

-- Create enhanced trigger that fires on both INSERT and UPDATE
CREATE TRIGGER trigger_sync_batch_abv_on_merge
  AFTER INSERT OR UPDATE ON batch_merge_history
  FOR EACH ROW
  EXECUTE FUNCTION sync_batch_abv_on_merge();

-- Add comment explaining the enhanced trigger
COMMENT ON TRIGGER trigger_sync_batch_abv_on_merge ON batch_merge_history IS
  'Syncs batch estimated_abv when merge history is created OR updated. Ensures ABV recalculation when composition corrections are made.';


-- Part 2: Create function to recalculate ABV from composition data
-- ================================================================

CREATE OR REPLACE FUNCTION recalculate_batch_abv_from_compositions(p_batch_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_alcohol NUMERIC := 0;
  v_total_volume NUMERIC := 0;
  v_brandy_abv NUMERIC := 70; -- Default brandy ABV
  v_result_abv NUMERIC;
  v_comp RECORD;
BEGIN
  -- Get compositions for this batch
  FOR v_comp IN
    SELECT
      bc.source_type,
      bc.juice_volume,
      CASE
        WHEN bc.source_type = 'brandy' THEN v_brandy_abv
        ELSE 0 -- Fresh juice
      END as abv
    FROM batch_compositions bc
    WHERE bc.batch_id = p_batch_id
      AND bc.deleted_at IS NULL
  LOOP
    v_total_volume := v_total_volume + COALESCE(v_comp.juice_volume, 0);
    v_total_alcohol := v_total_alcohol + (COALESCE(v_comp.juice_volume, 0) * v_comp.abv / 100);
  END LOOP;

  -- Calculate ABV
  IF v_total_volume > 0 THEN
    v_result_abv := ROUND((v_total_alcohol / v_total_volume) * 100, 2);
  ELSE
    v_result_abv := NULL;
  END IF;

  RETURN v_result_abv;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_batch_abv_from_compositions(UUID) IS
  'Recalculates ABV for a batch based on its composition data. Used for Pommeau and other blended products.';


-- Part 3: Create trigger function for composition changes
-- =======================================================

CREATE OR REPLACE FUNCTION sync_batch_abv_on_composition_change()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_new_abv NUMERIC;
  v_product_type TEXT;
BEGIN
  -- Get the batch_id from the appropriate record
  IF TG_OP = 'DELETE' THEN
    v_batch_id := OLD.batch_id;
  ELSE
    v_batch_id := NEW.batch_id;
  END IF;

  -- Only recalculate for pommeau batches (brandy + juice blends)
  SELECT product_type INTO v_product_type
  FROM batches
  WHERE id = v_batch_id;

  IF v_product_type = 'pommeau' THEN
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
  'Automatically recalculates batch ABV when composition records are modified. Only affects pommeau batches.';


-- Create trigger on batch_compositions
DROP TRIGGER IF EXISTS trigger_sync_batch_abv_on_composition ON batch_compositions;

CREATE TRIGGER trigger_sync_batch_abv_on_composition
  AFTER INSERT OR UPDATE OR DELETE ON batch_compositions
  FOR EACH ROW
  EXECUTE FUNCTION sync_batch_abv_on_composition_change();

COMMENT ON TRIGGER trigger_sync_batch_abv_on_composition ON batch_compositions IS
  'Recalculates pommeau ABV when composition data changes.';


-- Part 4: Set estimated_abv on all brandy batches (copy from actual_abv)
-- =====================================================================

UPDATE batches
SET estimated_abv = actual_abv::numeric,
    updated_at = NOW()
WHERE product_type = 'brandy'
  AND actual_abv IS NOT NULL
  AND (estimated_abv IS NULL OR estimated_abv != actual_abv::numeric)
  AND deleted_at IS NULL;

-- Also set estimated_abv = 70 for any brandy batch that has neither set
UPDATE batches
SET estimated_abv = 70,
    updated_at = NOW()
WHERE product_type = 'brandy'
  AND estimated_abv IS NULL
  AND actual_abv IS NULL
  AND deleted_at IS NULL;


-- Part 5: Recalculate ABV for all pommeau batches using their compositions
-- ========================================================================

DO $$
DECLARE
  v_batch RECORD;
  v_new_abv NUMERIC;
BEGIN
  FOR v_batch IN
    SELECT id, custom_name, estimated_abv
    FROM batches
    WHERE product_type = 'pommeau'
      AND deleted_at IS NULL
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


-- Summary
-- =======
-- This migration:
-- 1. Enhanced merge history trigger to fire on UPDATE (not just INSERT)
-- 2. Added function to recalculate ABV from composition data
-- 3. Added trigger on batch_compositions for automatic ABV recalculation
-- 4. Set estimated_abv on all brandy batches (70% from actual_abv)
-- 5. Recalculated ABV for all existing pommeau batches
