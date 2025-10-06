-- Migration: Simplify press run schema - replace timestamps with dateCompleted
-- This migration preserves existing completion data

-- Step 1: Add new date_completed column
ALTER TABLE "apple_press_runs" ADD COLUMN "date_completed" date;

-- Step 2: Migrate existing data from end_time to date_completed
-- Convert timestamp to date, preserving the completion date
UPDATE "apple_press_runs"
SET "date_completed" = "end_time"::date
WHERE "end_time" IS NOT NULL;

-- Step 3: Drop the old timestamp columns
ALTER TABLE "apple_press_runs" DROP COLUMN "start_time";
ALTER TABLE "apple_press_runs" DROP COLUMN "end_time";

-- Step 4: Drop unused columns
ALTER TABLE "apple_press_runs" DROP COLUMN IF EXISTS "pressing_method";
ALTER TABLE "apple_press_runs" DROP COLUMN IF EXISTS "weather_conditions";

-- Step 5: Drop old index and create new one
DROP INDEX IF EXISTS "apple_press_runs_start_time_idx";
CREATE INDEX IF NOT EXISTS "apple_press_runs_date_completed_idx" ON "apple_press_runs" ("date_completed");
