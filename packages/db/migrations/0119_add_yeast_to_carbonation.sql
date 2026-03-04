-- Add yeast tracking columns to batch_carbonation_operations for bottle conditioning
ALTER TABLE batch_carbonation_operations
  ADD COLUMN yeast_additive_purchase_id UUID REFERENCES additive_purchases(id),
  ADD COLUMN yeast_strain_name TEXT,
  ADD COLUMN yeast_amount NUMERIC(10, 2),
  ADD COLUMN yeast_amount_unit TEXT DEFAULT 'g';
