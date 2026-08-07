CREATE TABLE IF NOT EXISTS "keg_cleaning_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keg_id" uuid NOT NULL,
	"cleaned_at" timestamp DEFAULT now() NOT NULL,
	"cleaned_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "keg_cleaning_operations" ADD CONSTRAINT "keg_cleaning_operations_keg_id_kegs_id_fk" FOREIGN KEY ("keg_id") REFERENCES "kegs"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keg_cleaning_ops_keg_idx" ON "keg_cleaning_operations" ("keg_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keg_cleaning_ops_cleaned_at_idx" ON "keg_cleaning_operations" ("cleaned_at");
