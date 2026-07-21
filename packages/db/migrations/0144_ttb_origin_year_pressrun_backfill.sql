-- Phase 1 (reconciliation-robustness-plan §3): backfill ttb_origin_year for the
-- fall-2025 data-entry backlog — ~40 cider/perry/fruited-cider batches physically
-- pressed Sept-Nov 2025 (origin press run completed in 2025) but data-entered with
-- 2026 start_dates. The TTB engine will use
-- COALESCE-style membership (ttb_origin_year first) so these book to tax year
-- 2025 without re-dating any event.
--
-- Scope guards:
-- - press year >= 2025 ONLY: the handful of 2024->2025 stragglers stay untouched
--   (owner constraint: closed years 2024/2025 are not re-attributed; the ones that
--   mattered were hand-set during the 2026-07-06 investigation).
-- - Never overwrites a deliberate override (only rows where ttb_origin_year is
--   NULL or still equals the start_date year).
--
-- Data-only: nothing reads ttb_origin_year until the membership-helper commit.
UPDATE batches b
SET ttb_origin_year = EXTRACT(YEAR FROM pr.date_completed)::integer
FROM press_runs pr
WHERE b.origin_press_run_id = pr.id
  AND b.deleted_at IS NULL
  AND pr.date_completed IS NOT NULL
  AND EXTRACT(YEAR FROM pr.date_completed) >= 2025
  AND EXTRACT(YEAR FROM pr.date_completed) < EXTRACT(YEAR FROM b.start_date)
  AND COALESCE(b.ttb_origin_year, EXTRACT(YEAR FROM b.start_date)::integer)
      = EXTRACT(YEAR FROM b.start_date)::integer;
