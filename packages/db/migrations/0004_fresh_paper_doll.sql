DO $$ BEGIN
 CREATE TYPE "material_type" AS ENUM('apple', 'additive', 'juice', 'packaging');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "material_type" "material_type" DEFAULT 'apple' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;