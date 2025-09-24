-- Add depletion tracking to basefruit_purchase_items
ALTER TABLE basefruit_purchase_items
ADD COLUMN is_depleted boolean DEFAULT false,
ADD COLUMN depleted_at timestamp,
ADD COLUMN depleted_by uuid,
ADD COLUMN depleted_in_press_run uuid;

-- Add index for filtering non-depleted items
CREATE INDEX idx_basefruit_purchase_items_is_depleted ON basefruit_purchase_items(is_depleted);

-- Add foreign key reference to press runs
ALTER TABLE basefruit_purchase_items
ADD CONSTRAINT fk_depleted_in_press_run
FOREIGN KEY (depleted_in_press_run)
REFERENCES apple_press_runs(id) ON DELETE SET NULL;