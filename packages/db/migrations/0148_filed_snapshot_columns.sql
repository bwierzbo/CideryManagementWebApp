-- Phase 4 C2 (reconciliation-robustness-plan §3): persist the FILED TTB numbers
-- on their period snapshot so a recomputed period can be compared to what was
-- actually submitted, flagging NEW drift while tolerating the documented
-- permanent deltas. `filed_form` = the filed Form 5120.17 values; `expected_drift`
-- = the owner-accepted recompute-vs-filed deltas. Both sourced from
-- packages/lib/src/calculations/ttb-filed.ts (seed-filed-snapshots.ts).
ALTER TABLE ttb_period_snapshots ADD COLUMN is_filed boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE ttb_period_snapshots ADD COLUMN filed_at date;
--> statement-breakpoint
ALTER TABLE ttb_period_snapshots ADD COLUMN filed_form jsonb;
--> statement-breakpoint
ALTER TABLE ttb_period_snapshots ADD COLUMN expected_drift jsonb;
