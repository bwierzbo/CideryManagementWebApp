-- Labor can now attach to keg cleaning operations (hours -> COGS),
-- same polymorphic pattern as vessel cleaning / keg fills.
ALTER TABLE activity_labor_assignments
  ADD COLUMN IF NOT EXISTS keg_cleaning_operation_id uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS activity_labor_assignments_keg_cleaning_idx
  ON activity_labor_assignments (keg_cleaning_operation_id);
