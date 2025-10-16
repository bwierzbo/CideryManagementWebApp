-- Add pressure vessel enum and column to vessels table
-- This indicates if a vessel can handle pressure (e.g., metal bright tanks vs plastic IBCs)

-- Create the enum type for pressure vessel status
DO $$ BEGIN
 CREATE TYPE "vessel_pressure" AS ENUM('yes', 'no');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add the is_pressure_vessel column to vessels table
ALTER TABLE "vessels" ADD COLUMN "is_pressure_vessel" "vessel_pressure";
