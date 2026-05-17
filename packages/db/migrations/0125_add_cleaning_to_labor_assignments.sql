-- Add vessel_cleaning_operation_id polymorphic FK to activity_labor_assignments
-- so cleaning operations can track multi-worker assignments like other activities.
-- The "cleaning" value already exists in the activity_labor_type enum; this column
-- finishes the wiring.
ALTER TABLE "activity_labor_assignments"
  ADD COLUMN "vessel_cleaning_operation_id" uuid;

CREATE INDEX "activity_labor_assignments_vessel_cleaning_idx"
  ON "activity_labor_assignments" ("vessel_cleaning_operation_id");
