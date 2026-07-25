-- Phase 6 C1 (reconciliation-robustness-plan §3): the reconciliation checkpoint
-- data model. `ttb_reconciliation_snapshots` becomes the durable "numbers
-- trusted-accurate through this date" record produced by completeReconciliation.
--   variance_analysis        JSON of the full waterfall (per-class + totals) and
--                            components captured at lock time.
--   unexplained_variance_gal the signed aggregate unexplained variance (net of
--                            accepted manual adjustments) at lock time.
--   accepted_adjustment_ids  JSON array of the checkpoint/both-scoped waterfall
--                            adjustment ids that explained variance in the window.
--   amends_id                self-reference: this finalized row SUPERSEDES the
--                            referenced (previously finalized) checkpoint. An
--                            amendment is a NEW row — finalized rows are immutable.
ALTER TABLE ttb_reconciliation_snapshots ADD COLUMN variance_analysis jsonb;
--> statement-breakpoint
ALTER TABLE ttb_reconciliation_snapshots ADD COLUMN unexplained_variance_gal numeric(12,3);
--> statement-breakpoint
ALTER TABLE ttb_reconciliation_snapshots ADD COLUMN accepted_adjustment_ids jsonb;
--> statement-breakpoint
ALTER TABLE ttb_reconciliation_snapshots ADD COLUMN amends_id uuid REFERENCES ttb_reconciliation_snapshots(id);
--> statement-breakpoint
-- Immutability: once a checkpoint is finalized it can never be updated or deleted.
-- The only legal write to a finalized row is the draft->finalized transition
-- (finalizeReconciliation / completeReconciliation), which the trigger permits
-- because it inspects OLD.status. Correcting a finalized checkpoint is done by
-- creating a NEW row that amends it (amends_id), never by mutating the old one.
CREATE OR REPLACE FUNCTION trg_checkpoint_immutable_fn()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized reconciliation checkpoints are immutable — create an amendment instead.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_checkpoint_immutable ON ttb_reconciliation_snapshots;
--> statement-breakpoint
CREATE TRIGGER trg_checkpoint_immutable
  BEFORE UPDATE OR DELETE ON ttb_reconciliation_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION trg_checkpoint_immutable_fn();
