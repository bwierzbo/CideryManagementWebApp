-- Add batch merge history table for tracking when batches are combined
CREATE TABLE IF NOT EXISTS "batch_merge_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_batch_id" uuid NOT NULL,
	"source_press_run_id" uuid,
	"source_type" text NOT NULL,
	"volume_added_l" numeric(10, 3) NOT NULL,
	"target_volume_before_l" numeric(10, 3) NOT NULL,
	"target_volume_after_l" numeric(10, 3) NOT NULL,
	"composition_snapshot" jsonb,
	"notes" text,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"merged_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "batch_merge_history_target_batch_idx" ON "batch_merge_history" ("target_batch_id");
CREATE INDEX IF NOT EXISTS "batch_merge_history_source_press_run_idx" ON "batch_merge_history" ("source_press_run_id");
CREATE INDEX IF NOT EXISTS "batch_merge_history_merged_at_idx" ON "batch_merge_history" ("merged_at");

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "batch_merge_history" ADD CONSTRAINT "batch_merge_history_target_batch_id_batches_id_fk" FOREIGN KEY ("target_batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_merge_history" ADD CONSTRAINT "batch_merge_history_source_press_run_id_apple_press_runs_id_fk" FOREIGN KEY ("source_press_run_id") REFERENCES "apple_press_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_merge_history" ADD CONSTRAINT "batch_merge_history_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;