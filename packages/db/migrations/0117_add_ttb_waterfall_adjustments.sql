-- TTB Waterfall Adjustments
-- Summary-level reconciliation adjustments with audit trail.
-- Supports opening balance corrections, physical inventory true-ups, and loss corrections.

CREATE TYPE "public"."waterfall_adjustment_line" AS ENUM('opening', 'production', 'losses', 'distillation', 'other');

CREATE TABLE IF NOT EXISTS "ttb_waterfall_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_year" integer NOT NULL,
  "waterfall_line" "waterfall_adjustment_line" NOT NULL,
  "amount_gallons" numeric(12, 3) NOT NULL,
  "reason" text NOT NULL,
  "notes" text,
  "adjusted_by" uuid,
  "adjusted_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "ttb_waterfall_adj_period_year_idx" ON "ttb_waterfall_adjustments" USING btree ("period_year");

DO $$ BEGIN
  ALTER TABLE "ttb_waterfall_adjustments"
    ADD CONSTRAINT "ttb_waterfall_adjustments_adjusted_by_users_id_fk"
    FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
