-- 2026 variance cleanup D3: scope column for ttb_waterfall_adjustments.
-- The annual FORM opens from the FILED snapshot basis while the CHECKPOINT
-- summary opens from reconstruction/checkpoint basis — an explanation row can
-- be true on one basis and false on the other (the fall-2025 backlog phantom
-- exists ONLY on the filed-snapshot basis). Rows default to 'both'.
ALTER TABLE ttb_waterfall_adjustments ADD COLUMN scope text NOT NULL DEFAULT 'both';
--> statement-breakpoint
ALTER TABLE ttb_waterfall_adjustments ADD CONSTRAINT ttb_waterfall_adj_scope_check
  CHECK (scope IN ('both', 'form', 'checkpoint'));
