-- Migration: Add distillation tracking for brandy and pommeau production
-- This adds support for tracking:
-- 1. Cider sent to external distillery
-- 2. Brandy received back with ABV tracking
-- 3. Product types (cider, perry, brandy, pommeau)
-- 4. ABV tracking in batch merges for pommeau blending
-- 5. TTB TIB compliance fields

-- Create product_type enum
DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('cider', 'perry', 'brandy', 'pommeau', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create distillation_record_status enum
DO $$ BEGIN
    CREATE TYPE distillation_record_status AS ENUM ('sent', 'received', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add product_type to batches table
ALTER TABLE batches
ADD COLUMN IF NOT EXISTS product_type product_type NOT NULL DEFAULT 'cider';

-- Add ABV tracking fields to batch_merge_history
ALTER TABLE batch_merge_history
ADD COLUMN IF NOT EXISTS source_abv DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS resulting_abv DECIMAL(4,2);

-- Create distillation_records table
CREATE TABLE IF NOT EXISTS distillation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source batch (cider sent out)
    source_batch_id UUID NOT NULL REFERENCES batches(id),
    source_volume DECIMAL(10,3) NOT NULL,
    source_volume_unit unit NOT NULL DEFAULT 'L',
    source_volume_liters DECIMAL(10,3),
    source_abv DECIMAL(4,2),

    -- Distillery info
    distillery_name TEXT NOT NULL,
    distillery_address TEXT,
    distillery_permit_number TEXT,

    -- Outbound tracking
    sent_at TIMESTAMPTZ NOT NULL,
    sent_by UUID REFERENCES users(id),
    tib_outbound_number TEXT,

    -- Return tracking (brandy received)
    result_batch_id UUID REFERENCES batches(id),
    received_volume DECIMAL(10,3),
    received_volume_unit unit DEFAULT 'L',
    received_volume_liters DECIMAL(10,3),
    received_abv DECIMAL(4,2),
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES users(id),
    tib_inbound_number TEXT,

    -- Yield/Loss tracking (for TTB reporting)
    proof_gallons_sent DECIMAL(10,3),
    proof_gallons_received DECIMAL(10,3),

    -- Status and audit
    status distillation_record_status NOT NULL DEFAULT 'sent',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes for distillation_records
CREATE INDEX IF NOT EXISTS distillation_records_source_batch_idx ON distillation_records(source_batch_id);
CREATE INDEX IF NOT EXISTS distillation_records_result_batch_idx ON distillation_records(result_batch_id);
CREATE INDEX IF NOT EXISTS distillation_records_status_idx ON distillation_records(status);
CREATE INDEX IF NOT EXISTS distillation_records_sent_at_idx ON distillation_records(sent_at);

-- Add comment for documentation
COMMENT ON TABLE distillation_records IS 'Tracks cider sent to external distilleries and brandy received back for TTB TIB compliance';
COMMENT ON COLUMN distillation_records.tib_outbound_number IS 'TTB Transfer in Bond number for outbound shipment';
COMMENT ON COLUMN distillation_records.tib_inbound_number IS 'TTB Transfer in Bond number for inbound brandy receipt';
COMMENT ON COLUMN distillation_records.proof_gallons_sent IS 'Proof gallons = wine gallons × (ABV × 2) / 100';
COMMENT ON COLUMN distillation_records.proof_gallons_received IS 'Proof gallons of brandy received back';
