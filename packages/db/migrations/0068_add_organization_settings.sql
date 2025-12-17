-- Create enums for organization settings

-- Operation Type Enums
CREATE TYPE production_scale AS ENUM ('nano', 'small', 'medium', 'large');

-- UX Preferences - Units Enums
CREATE TYPE volume_units AS ENUM ('gallons', 'liters');
CREATE TYPE weight_units AS ENUM ('pounds', 'kilograms');
CREATE TYPE temperature_units AS ENUM ('fahrenheit', 'celsius');
CREATE TYPE density_units AS ENUM ('sg', 'brix', 'plato');
CREATE TYPE pressure_units AS ENUM ('psi', 'bar');

-- UX Preferences - Display Enums
CREATE TYPE date_format AS ENUM ('mdy', 'dmy', 'ymd');
CREATE TYPE time_format AS ENUM ('12h', '24h');
CREATE TYPE theme AS ENUM ('light', 'dark', 'system');

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create organization_settings table
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Organization Profile
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  logo TEXT,
  ttb_permit_number TEXT,
  state_license_number TEXT,

  -- Operation Type
  fruit_source TEXT[] NOT NULL DEFAULT ARRAY['purchase_fruit'],
  production_scale production_scale NOT NULL DEFAULT 'small',
  product_types TEXT[] NOT NULL DEFAULT ARRAY['cider'],

  -- Workflow Modules Enabled
  fruit_purchases_enabled BOOLEAN NOT NULL DEFAULT true,
  press_runs_enabled BOOLEAN NOT NULL DEFAULT true,
  juice_purchases_enabled BOOLEAN NOT NULL DEFAULT true,
  barrel_aging_enabled BOOLEAN NOT NULL DEFAULT true,
  carbonation_enabled BOOLEAN NOT NULL DEFAULT true,
  bottle_conditioning_enabled BOOLEAN NOT NULL DEFAULT false,
  kegging_enabled BOOLEAN NOT NULL DEFAULT true,
  bottling_enabled BOOLEAN NOT NULL DEFAULT true,
  canning_enabled BOOLEAN NOT NULL DEFAULT false,
  ttb_reporting_enabled BOOLEAN NOT NULL DEFAULT true,
  spirits_inventory_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Packaging Config
  package_types TEXT[] NOT NULL DEFAULT ARRAY['bottle', 'keg'],
  carbonation_methods TEXT[] NOT NULL DEFAULT ARRAY['forced'],
  default_target_co2 DECIMAL(4, 2) NOT NULL DEFAULT 2.70,

  -- Alert Thresholds
  stalled_batch_days INTEGER NOT NULL DEFAULT 14,
  long_aging_days INTEGER NOT NULL DEFAULT 90,
  low_inventory_threshold INTEGER NOT NULL DEFAULT 24,
  ttb_reminder_days INTEGER NOT NULL DEFAULT 7,

  -- UX Preferences - Units
  volume_units volume_units NOT NULL DEFAULT 'gallons',
  volume_show_secondary BOOLEAN NOT NULL DEFAULT false,
  weight_units weight_units NOT NULL DEFAULT 'pounds',
  weight_show_secondary BOOLEAN NOT NULL DEFAULT false,
  temperature_units temperature_units NOT NULL DEFAULT 'fahrenheit',
  temperature_show_secondary BOOLEAN NOT NULL DEFAULT false,
  density_units density_units NOT NULL DEFAULT 'sg',
  density_show_secondary BOOLEAN NOT NULL DEFAULT false,
  pressure_units pressure_units NOT NULL DEFAULT 'psi',
  pressure_show_secondary BOOLEAN NOT NULL DEFAULT false,

  -- UX Preferences - Display
  date_format date_format NOT NULL DEFAULT 'mdy',
  time_format time_format NOT NULL DEFAULT '12h',
  theme theme NOT NULL DEFAULT 'system',
  default_currency TEXT NOT NULL DEFAULT 'USD',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on organization_id
CREATE INDEX IF NOT EXISTS organization_settings_organization_idx ON organization_settings(organization_id);

-- Insert default organization and settings for existing single-tenant setup
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'My Cidery')
ON CONFLICT DO NOTHING;

INSERT INTO organization_settings (organization_id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'My Cidery')
ON CONFLICT DO NOTHING;
