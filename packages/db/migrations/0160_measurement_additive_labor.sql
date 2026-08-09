-- Labor tracking on measurements and additive additions ("labor on ALL activities").
ALTER TYPE activity_labor_type ADD VALUE IF NOT EXISTS 'measurement';
--> statement-breakpoint
ALTER TYPE activity_labor_type ADD VALUE IF NOT EXISTS 'additive';
--> statement-breakpoint
ALTER TABLE activity_labor_assignments ADD COLUMN IF NOT EXISTS batch_measurement_id uuid;
--> statement-breakpoint
ALTER TABLE activity_labor_assignments ADD COLUMN IF NOT EXISTS batch_additive_id uuid;
