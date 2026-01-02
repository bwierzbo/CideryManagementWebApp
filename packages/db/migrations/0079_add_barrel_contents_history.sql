-- Create barrel_contents_history table for tracking full barrel provenance
-- This includes pre-purchase history and batch usage with flavor notes

CREATE TABLE barrel_contents_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,

  -- What was in the barrel
  contents_type TEXT NOT NULL, -- e.g., 'rye_whiskey', 'bourbon', 'cider', 'perry', 'brandy'
  contents_description TEXT, -- e.g., "Caudil Distillery 4-year Rye"

  -- Time period
  started_at DATE NOT NULL,
  ended_at DATE,

  -- Source of this entry
  source TEXT NOT NULL DEFAULT 'manual', -- 'pre_purchase', 'batch', 'manual'
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL, -- Optional - linked when source is 'batch'

  -- Flavor tracking
  tasting_notes TEXT, -- Notes about what this contents contributed
  flavor_impact TEXT, -- How it affected the barrel's character

  -- Ordering for display
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes for efficient queries
CREATE INDEX barrel_contents_history_vessel_idx ON barrel_contents_history(vessel_id);
CREATE INDEX barrel_contents_history_batch_idx ON barrel_contents_history(batch_id);
CREATE INDEX barrel_contents_history_started_at_idx ON barrel_contents_history(started_at);

-- Comment for documentation
COMMENT ON TABLE barrel_contents_history IS 'Tracks the complete history of what has been stored in each barrel, including pre-purchase contents and batch usage. Used for flavor profile tracking.';
COMMENT ON COLUMN barrel_contents_history.source IS 'pre_purchase = entered manually for history before acquisition, batch = auto-tracked from batch transfers, manual = user-entered for other cases';
