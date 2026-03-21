-- Add warehouse temperature setting for bottle conditioning duration calculation
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "warehouse_temperature_celsius" numeric(4,1) NOT NULL DEFAULT '20.0';

-- Set to 10°C for this cidery (winter warehouse temp)
UPDATE "organization_settings" SET "warehouse_temperature_celsius" = '10.0';
