-- Pad COGS: which Supplies lot a filter run consumed and what it cost.
ALTER TABLE batch_filter_operations ADD COLUMN IF NOT EXISTS pad_purchase_item_id uuid;
--> statement-breakpoint
ALTER TABLE batch_filter_operations ADD COLUMN IF NOT EXISTS pad_cost numeric(10,2);
