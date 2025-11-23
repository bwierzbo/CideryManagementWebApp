-- Create system_settings table for storing system-wide configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS system_settings_key_idx ON system_settings(key);

-- Insert default timezone setting (Pacific Time)
INSERT INTO system_settings (key, value)
VALUES ('timezone', '"America/Los_Angeles"')
ON CONFLICT (key) DO NOTHING;
