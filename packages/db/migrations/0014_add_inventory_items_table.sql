CREATE TABLE IF NOT EXISTS "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"lot_code" text,
	"packaging_run_id" uuid,
	"package_type" text,
	"package_size_ml" integer,
	"expiration_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_lot_code_unique" ON "inventory_items" ("lot_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inventory_lot_code" ON "inventory_items" ("lot_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_batch_idx" ON "inventory_items" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_packaging_run_idx" ON "inventory_items" ("packaging_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_expiration_date_idx" ON "inventory_items" ("expiration_date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;