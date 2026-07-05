-- Whether a distillation send deducted volume from the source batch, so that
-- cancelling the record knows whether to restore that volume. Defaults true
-- (the common/historical path deducts); record-only sends set it false.
ALTER TABLE "distillation_records" ADD COLUMN IF NOT EXISTS "deducted_from_batch" boolean NOT NULL DEFAULT true;
