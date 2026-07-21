-- Phase 1 (reconciliation-robustness-plan §3): real columns replace the three
-- volume-reconstruction heuristics. Backfills reproduce TODAY'S heuristic
-- verdicts exactly, so the engine cutover is bit-identical; from then on the
-- columns are authoritative and borderline batches stop flipping.
-- Probe counts at authoring time (2026-07-20): 39 active Historical Record
-- racking rows; 66/69 bottle runs loss-included; all unit columns 'L'.

-- 1. Explicit transfer-created flag (replaces the >=90% transfersIn cliff, §2.5)
ALTER TABLE batches ADD COLUMN transfer_created boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE batches b SET transfer_created = true
WHERE b.parent_batch_id IS NOT NULL
  AND (SELECT COALESCE(SUM(t.volume_transferred::numeric), 0)
         FROM batch_transfers t
        WHERE t.destination_batch_id = b.id
          AND t.deleted_at IS NULL
          AND t.source_batch_id != t.destination_batch_id)
      >= COALESCE(b.initial_volume_liters::numeric, 0) * 0.9
  AND COALESCE(b.initial_volume_liters::numeric, 0) >= 0;
--> statement-breakpoint

-- 2. Real column for import-era racking rows (replaces notes string match, §2.4)
ALTER TABLE batch_racking_operations ADD COLUMN is_historical_record boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE batch_racking_operations SET is_historical_record = true
WHERE notes LIKE '%Historical Record%';
--> statement-breakpoint

-- 3. Real flag for bottling-loss-included (replaces the <2L fuzzy heuristic, §2.4)
ALTER TABLE bottle_runs ADD COLUMN loss_included_in_volume_taken boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE bottle_runs SET loss_included_in_volume_taken = true
WHERE ABS(COALESCE(volume_taken_liters::numeric, 0)
      - ((COALESCE(units_produced, 0) * COALESCE(package_size_ml, 0)) / 1000.0
         + CASE WHEN loss_unit = 'gal' THEN COALESCE(loss::numeric, 0) * 3.78541
                ELSE COALESCE(loss::numeric, 0) END)) < 2;
