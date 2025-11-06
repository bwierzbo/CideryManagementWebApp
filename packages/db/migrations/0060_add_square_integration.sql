-- Add Square POS integration fields and tables
-- This enables two-way inventory sync between the cidery app and Square

-- Add Square mapping fields to inventory_items
ALTER TABLE inventory_items
ADD COLUMN square_catalog_item_id TEXT,
ADD COLUMN square_variation_id TEXT,
ADD COLUMN square_synced_at TIMESTAMP,
ADD COLUMN square_sync_enabled BOOLEAN DEFAULT true;

-- Create index for Square lookups
CREATE INDEX IF NOT EXISTS idx_inventory_square_variation
ON inventory_items(square_variation_id)
WHERE square_variation_id IS NOT NULL AND deleted_at IS NULL;

-- Create Square sync log table to track all sync events
CREATE TABLE IF NOT EXISTS square_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync metadata
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('to_square', 'from_square')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('inventory_update', 'product_mapping', 'manual_sync', 'webhook')),

  -- Related records
  inventory_item_id UUID REFERENCES inventory_items(id),
  square_catalog_item_id TEXT,
  square_variation_id TEXT,

  -- Sync details
  quantity_before INTEGER,
  quantity_after INTEGER,
  square_quantity INTEGER,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Square webhook data (if applicable)
  square_event_id TEXT,
  square_event_type TEXT,
  webhook_payload JSONB
);

-- Indexes for sync log queries
CREATE INDEX IF NOT EXISTS idx_square_sync_status ON square_sync_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_sync_inventory ON square_sync_log(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_square_sync_event ON square_sync_log(square_event_id) WHERE square_event_id IS NOT NULL;

-- Create Square configuration table for storing API credentials and settings
CREATE TABLE IF NOT EXISTS square_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OAuth tokens (encrypted in application layer)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP,

  -- Square account info
  merchant_id TEXT,
  location_id TEXT,
  environment TEXT CHECK (environment IN ('production', 'sandbox')),

  -- Sync settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  webhook_signature_key TEXT,
  last_full_sync_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Only allow one config row (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_square_config_singleton ON square_config ((1));

COMMENT ON TABLE square_sync_log IS 'Tracks all inventory sync events between the cidery app and Square POS';
COMMENT ON TABLE square_config IS 'Stores Square API credentials and sync configuration (singleton table)';
COMMENT ON COLUMN inventory_items.square_catalog_item_id IS 'Square catalog object ID (product level)';
COMMENT ON COLUMN inventory_items.square_variation_id IS 'Square variation ID (SKU level) - used for inventory sync';
COMMENT ON COLUMN inventory_items.square_synced_at IS 'Last successful sync timestamp to Square';
