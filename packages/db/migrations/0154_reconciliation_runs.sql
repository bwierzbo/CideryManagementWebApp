-- Phase 5 (automated-reconciliation PRD; reconciliation-robustness-plan §3 Phase 5):
-- durable log of automated/manual reconciliation health checks. Each row is one
-- run of the read-only health check over the existing reconciliation engines
-- (per-batch validation, getReconciliationSummary waterfall, filed-drift). The
-- dashboard "Reconciliation health" card reads the latest row; alert-on-change
-- compares consecutive rows.
--
--   trigger                'cron' | 'manual' — how the run was initiated.
--   status                 'clean' | 'attention' | 'drift' — roll-up.
--   per_batch_fail_count   # batches the reconciliation page would flag as fail.
--   per_batch_warn_count   # batches flagged as warning.
--   total_unexplained_gal  signed aggregate unexplained variance (post-adjustment).
--   checkpoint_drift_status 'clean' | 'drifted' | NULL (no checkpoint) — Phase 6 C3.
--   filed_drift            jsonb: per filed year { year: 'clean'|'expected_only'|'new_drift', ... }.
--   details                jsonb: openingWarnings, per-year detail, changedSinceLastRun.
--   duration_ms            wall-clock of the check.
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL,
  status text NOT NULL,
  per_batch_fail_count integer NOT NULL DEFAULT 0,
  per_batch_warn_count integer NOT NULL DEFAULT 0,
  total_unexplained_gal numeric(12,3),
  checkpoint_drift_status text,
  filed_drift jsonb,
  details jsonb,
  duration_ms integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS reconciliation_runs_ran_at_idx ON reconciliation_runs (ran_at DESC);
