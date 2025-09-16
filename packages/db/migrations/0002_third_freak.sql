DO $$ BEGIN
 CREATE TYPE "vessel_jacketed" AS ENUM('yes', 'no');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vessel_material" AS ENUM('stainless_steel', 'plastic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "vessels" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vessels" ADD COLUMN "capacity_unit" "unit" DEFAULT 'L' NOT NULL;--> statement-breakpoint
ALTER TABLE "vessels" ADD COLUMN "material" "vessel_material";--> statement-breakpoint
ALTER TABLE "vessels" ADD COLUMN "jacketed" "vessel_jacketed";