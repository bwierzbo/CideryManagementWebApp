ALTER TYPE "vessel_status" ADD VALUE 'empty';--> statement-breakpoint
ALTER TYPE "vessel_status" ADD VALUE 'fermenting';--> statement-breakpoint
ALTER TYPE "vessel_status" ADD VALUE 'storing';--> statement-breakpoint
ALTER TYPE "vessel_status" ADD VALUE 'aging';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tank_additives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"additive_type" text NOT NULL,
	"amount" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tank_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"measurement_date" timestamp DEFAULT now() NOT NULL,
	"temp_c" numeric(5, 2),
	"sh" numeric(5, 2),
	"ph" numeric(4, 2),
	"abv" numeric(5, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tank_additives_vessel_idx" ON "tank_additives" ("vessel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tank_additives_added_at_idx" ON "tank_additives" ("added_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tank_measurements_vessel_idx" ON "tank_measurements" ("vessel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tank_measurements_date_idx" ON "tank_measurements" ("measurement_date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tank_additives" ADD CONSTRAINT "tank_additives_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tank_additives" ADD CONSTRAINT "tank_additives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tank_measurements" ADD CONSTRAINT "tank_measurements_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tank_measurements" ADD CONSTRAINT "tank_measurements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
