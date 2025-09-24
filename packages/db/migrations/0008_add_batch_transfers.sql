-- Create batch_transfers table if it doesn't exist
CREATE TABLE IF NOT EXISTS "batch_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_batch_id" uuid NOT NULL,
	"source_vessel_id" uuid NOT NULL,
	"destination_batch_id" uuid NOT NULL,
	"destination_vessel_id" uuid NOT NULL,
	"remaining_batch_id" uuid,
	"volume_transferred_l" numeric(10, 3) NOT NULL,
	"loss_l" numeric(10, 3) DEFAULT '0',
	"total_volume_processed_l" numeric(10, 3) NOT NULL,
	"remaining_volume_l" numeric(10, 3),
	"notes" text,
	"transferred_at" timestamp DEFAULT now() NOT NULL,
	"transferred_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "batch_transfers_source_batch_idx" ON "batch_transfers" ("source_batch_id");
CREATE INDEX IF NOT EXISTS "batch_transfers_destination_batch_idx" ON "batch_transfers" ("destination_batch_id");
CREATE INDEX IF NOT EXISTS "batch_transfers_source_vessel_idx" ON "batch_transfers" ("source_vessel_id");
CREATE INDEX IF NOT EXISTS "batch_transfers_destination_vessel_idx" ON "batch_transfers" ("destination_vessel_id");
CREATE INDEX IF NOT EXISTS "batch_transfers_transferred_at_idx" ON "batch_transfers" ("transferred_at");

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_source_batch_id_batches_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_source_vessel_id_vessels_id_fk" FOREIGN KEY ("source_vessel_id") REFERENCES "vessels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_destination_batch_id_batches_id_fk" FOREIGN KEY ("destination_batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_destination_vessel_id_vessels_id_fk" FOREIGN KEY ("destination_vessel_id") REFERENCES "vessels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_remaining_batch_id_batches_id_fk" FOREIGN KEY ("remaining_batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_transfers" ADD CONSTRAINT "batch_transfers_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;