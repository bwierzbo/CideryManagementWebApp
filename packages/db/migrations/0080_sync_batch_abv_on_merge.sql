-- Migration: Auto-sync batch ABV when merge history is created
-- This ensures Pommeau/blended batches always have their ABV updated
-- regardless of how the merge history record is created (API, script, import)

-- Create function to sync batch ABV from merge history
CREATE OR REPLACE FUNCTION sync_batch_abv_on_merge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if the merge has a resulting ABV
  IF NEW.resulting_abv IS NOT NULL THEN
    -- Update the target batch's estimated_abv
    UPDATE batches
    SET
      estimated_abv = NEW.resulting_abv,
      updated_at = NOW()
    WHERE id = NEW.target_batch_id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on batch_merge_history
DROP TRIGGER IF EXISTS trigger_sync_batch_abv_on_merge ON batch_merge_history;

CREATE TRIGGER trigger_sync_batch_abv_on_merge
  AFTER INSERT ON batch_merge_history
  FOR EACH ROW
  EXECUTE FUNCTION sync_batch_abv_on_merge();

-- Add comment explaining the trigger
COMMENT ON FUNCTION sync_batch_abv_on_merge() IS
  'Automatically syncs batch estimated_abv when merge history is created. Ensures Pommeau and blended batches always have their ABV set correctly regardless of creation method.';
