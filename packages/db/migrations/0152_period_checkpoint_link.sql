-- Phase 7 C4: link a TTB period snapshot to the reconciliation checkpoint that
-- anchors its opening basis. Set to the latest finalized, non-superseded
-- checkpoint with reconciliation_date <= period_end at save/finalize time.
-- Nullable — a period can be saved before any checkpoint exists (a warning is
-- surfaced in that case).
ALTER TABLE ttb_period_snapshots
  ADD COLUMN reconciliation_snapshot_id uuid REFERENCES ttb_reconciliation_snapshots(id);
