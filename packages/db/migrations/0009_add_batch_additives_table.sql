-- Add batch_additives table for tracking additives added to batches
CREATE TABLE IF NOT EXISTS "batch_additives" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "batch_id" uuid NOT NULL REFERENCES "batches"("id"),
    "vessel_id" uuid NOT NULL REFERENCES "vessels"("id"),
    "additive_type" text NOT NULL,
    "additive_name" text NOT NULL,
    "amount" numeric(10, 3) NOT NULL,
    "unit" text NOT NULL,
    "notes" text,
    "added_at" timestamp DEFAULT now() NOT NULL,
    "added_by" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "deleted_at" timestamp
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "batch_additives_batch_id_idx" ON "batch_additives"("batch_id");
CREATE INDEX IF NOT EXISTS "batch_additives_vessel_id_idx" ON "batch_additives"("vessel_id");
CREATE INDEX IF NOT EXISTS "batch_additives_added_at_idx" ON "batch_additives"("added_at");
CREATE INDEX IF NOT EXISTS "batch_additives_deleted_at_idx" ON "batch_additives"("deleted_at");