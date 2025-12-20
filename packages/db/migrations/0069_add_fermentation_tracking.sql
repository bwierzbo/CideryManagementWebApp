-- Add fermentation stage tracking to batches table
ALTER TABLE "batches" ADD COLUMN "target_final_gravity" numeric(5,3);
ALTER TABLE "batches" ADD COLUMN "fermentation_stage" text DEFAULT 'unknown';
ALTER TABLE "batches" ADD COLUMN "fermentation_stage_updated_at" timestamp with time zone;

-- Add measurement method to batch_measurements table
ALTER TABLE "batch_measurements" ADD COLUMN "measurement_method" text DEFAULT 'hydrometer';

-- Add fermentation stage settings to organization_settings table
ALTER TABLE "organization_settings" ADD COLUMN "fermentation_stage_early_max" integer NOT NULL DEFAULT 70;
ALTER TABLE "organization_settings" ADD COLUMN "fermentation_stage_mid_max" integer NOT NULL DEFAULT 90;
ALTER TABLE "organization_settings" ADD COLUMN "fermentation_stage_approaching_dry_max" integer NOT NULL DEFAULT 98;
ALTER TABLE "organization_settings" ADD COLUMN "stall_detection_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "organization_settings" ADD COLUMN "stall_detection_days" integer NOT NULL DEFAULT 3;
ALTER TABLE "organization_settings" ADD COLUMN "stall_detection_threshold" numeric(5,4) NOT NULL DEFAULT 0.001;
ALTER TABLE "organization_settings" ADD COLUMN "terminal_confirmation_hours" integer NOT NULL DEFAULT 48;
ALTER TABLE "organization_settings" ADD COLUMN "default_target_fg_dry" numeric(5,3) NOT NULL DEFAULT 0.998;
ALTER TABLE "organization_settings" ADD COLUMN "default_target_fg_semi_dry" numeric(5,3) NOT NULL DEFAULT 1.005;
ALTER TABLE "organization_settings" ADD COLUMN "default_target_fg_semi_sweet" numeric(5,3) NOT NULL DEFAULT 1.012;
ALTER TABLE "organization_settings" ADD COLUMN "default_target_fg_sweet" numeric(5,3) NOT NULL DEFAULT 1.020;

-- Add index for fermentation stage queries
CREATE INDEX "batches_fermentation_stage_idx" ON "batches" ("fermentation_stage") WHERE "deleted_at" IS NULL;

-- Add index for measurement method queries
CREATE INDEX "batch_measurements_method_idx" ON "batch_measurements" ("measurement_method") WHERE "deleted_at" IS NULL;
