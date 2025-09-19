-- Replace ABV with TA (Titratable Acid) in tank_measurements
ALTER TABLE "tank_measurements" DROP COLUMN IF EXISTS "abv";
ALTER TABLE "tank_measurements" ADD COLUMN IF NOT EXISTS "ta" numeric(5, 2);