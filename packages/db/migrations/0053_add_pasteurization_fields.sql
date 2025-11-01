-- Migration: Add pasteurization tracking fields to bottle_runs
-- Adds fields to track temperature, time, calculated PU, and timestamp

ALTER TABLE "bottle_runs"
  ADD COLUMN "pasteurization_temperature_celsius" numeric(5, 2),
  ADD COLUMN "pasteurization_time_minutes" numeric(6, 2),
  ADD COLUMN "pasteurization_units" numeric(10, 2),
  ADD COLUMN "pasteurized_at" timestamp;
