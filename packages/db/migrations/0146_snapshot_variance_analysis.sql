-- Phase 3 C7 (reconciliation-robustness-plan §3): a filed TTB period snapshot
-- records the varianceAnalysis (per-class unexplained variance + components)
-- at generation time, so the filing preserves what was unexplained when it
-- was made (feeds the Phase 4 filed-vs-recompute drift comparison).
ALTER TABLE ttb_reporting_periods ADD COLUMN variance_analysis jsonb;
