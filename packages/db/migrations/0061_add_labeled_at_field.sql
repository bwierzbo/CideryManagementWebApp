-- Migration: Add labeledAt tracking field to bottle_runs
-- Adds field to track when labels are physically applied to bottles

ALTER TABLE "bottle_runs"
  ADD COLUMN "labeled_at" timestamp;
