-- Create vessel_cleaning_operations table for tracking tank cleaning
CREATE TABLE IF NOT EXISTS "vessel_cleaning_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"cleaned_at" timestamp NOT NULL,
	"cleaned_by" uuid,
	"notes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Add foreign key constraints
ALTER TABLE "vessel_cleaning_operations" ADD CONSTRAINT "vessel_cleaning_operations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "vessel_cleaning_operations" ADD CONSTRAINT "vessel_cleaning_operations_cleaned_by_users_id_fk" FOREIGN KEY ("cleaned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "vessel_cleaning_operations_vessel_id_idx" ON "vessel_cleaning_operations" ("vessel_id");
CREATE INDEX IF NOT EXISTS "vessel_cleaning_operations_cleaned_at_idx" ON "vessel_cleaning_operations" ("cleaned_at");
