-- Migration: Add cascade delete for press run references
-- When a press run is deleted:
-- - Batches created from it will be deleted (CASCADE)
-- - Merge history will just lose the reference (SET NULL)

-- Drop existing foreign key constraints
ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "batches_origin_press_run_id_press_runs_id_fk";
ALTER TABLE "batch_merge_history" DROP CONSTRAINT IF EXISTS "batch_merge_history_source_press_run_id_press_runs_id_fk";

-- Re-add with cascade behavior
ALTER TABLE "batches"
  ADD CONSTRAINT "batches_origin_press_run_id_press_runs_id_fk"
  FOREIGN KEY ("origin_press_run_id")
  REFERENCES "press_runs"("id")
  ON DELETE CASCADE;

ALTER TABLE "batch_merge_history"
  ADD CONSTRAINT "batch_merge_history_source_press_run_id_press_runs_id_fk"
  FOREIGN KEY ("source_press_run_id")
  REFERENCES "press_runs"("id")
  ON DELETE SET NULL;
