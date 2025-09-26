-- Migration: 0015_packaging_performance_indexes
-- Description: Add performance indexes for packaging features
--
-- This migration adds optimized indexes for:
-- 1. Common filtering patterns in packaging runs list
-- 2. Efficient sorting and pagination
-- 3. Quick lookups by lot code
-- 4. Optimized joins with batches and vessels
-- 5. Date range queries

-- Performance indexes for packaging_runs table
-- These indexes optimize the common query patterns from the packaging router

-- Composite index for batch_id + created_at (common filter + sort pattern)
CREATE INDEX IF NOT EXISTS "packaging_runs_batch_created_idx"
  ON "packaging_runs" ("batch_id", "created_at" DESC);

-- Composite index for vessel_id + created_at (vessel tracking + chronological sorting)
CREATE INDEX IF NOT EXISTS "packaging_runs_vessel_created_idx"
  ON "packaging_runs" ("vessel_id", "created_at" DESC);

-- Index for lot code quick lookups (used frequently in inventory queries)
CREATE INDEX IF NOT EXISTS "packaging_runs_lot_code_idx"
  ON "packaging_runs" ("package_type", "package_size_ml", "packaged_at");

-- Optimized index for list sorting (packaged_at DESC is the default sort in list query)
CREATE INDEX IF NOT EXISTS "packaging_runs_packaged_at_desc_idx"
  ON "packaging_runs" ("packaged_at" DESC)
  WHERE "status" = 'completed';

-- Composite index for common filter combinations used in list API
-- Covers: status + package_type + packaged_at for efficient filtering
CREATE INDEX IF NOT EXISTS "packaging_runs_status_type_date_idx"
  ON "packaging_runs" ("status", "package_type", "packaged_at" DESC);

-- Composite index for batch search optimization
-- Helps when joining with batches table for batch name searches
CREATE INDEX IF NOT EXISTS "packaging_runs_batch_status_idx"
  ON "packaging_runs" ("batch_id", "status", "packaged_at" DESC);

-- Index for package size queries (used in filtering by package size)
CREATE INDEX IF NOT EXISTS "packaging_runs_package_size_idx"
  ON "packaging_runs" ("package_size_ml", "package_type");

-- Performance index for inventory_items packaging_run_id lookup
-- This optimizes the join in the get() method when loading inventory for a run
CREATE INDEX IF NOT EXISTS "inventory_items_packaging_run_created_idx"
  ON "inventory_items" ("packaging_run_id", "created_at" DESC);

-- Composite index for expiration date queries with package info
-- Useful for inventory management and expiration tracking
CREATE INDEX IF NOT EXISTS "inventory_items_expiry_package_idx"
  ON "inventory_items" ("expiration_date", "package_type", "package_size_ml")
  WHERE "deleted_at" IS NULL;

-- Index for QA technician queries (used in packaging run details)
CREATE INDEX IF NOT EXISTS "packaging_runs_qa_technician_idx"
  ON "packaging_runs" ("qa_technician_id", "test_date")
  WHERE "qa_technician_id" IS NOT NULL;

-- Partial index for voided runs (less common, separate index)
CREATE INDEX IF NOT EXISTS "packaging_runs_voided_idx"
  ON "packaging_runs" ("voided_at", "voided_by")
  WHERE "status" = 'voided';

-- Index for user attribution queries (audit purposes)
CREATE INDEX IF NOT EXISTS "packaging_runs_created_by_date_idx"
  ON "packaging_runs" ("created_by", "created_at" DESC);

-- Performance index for package_sizes lookup (frequently accessed reference data)
CREATE INDEX IF NOT EXISTS "package_sizes_active_type_size_idx"
  ON "package_sizes" ("is_active", "package_type", "sort_order", "size_ml")
  WHERE "is_active" = true;

-- Analyze tables after creating indexes to update statistics
ANALYZE "packaging_runs";
ANALYZE "inventory_items";
ANALYZE "package_sizes";

-- Comments for index usage patterns:
COMMENT ON INDEX "packaging_runs_batch_created_idx" IS 'Optimizes batch filtering with chronological sorting';
COMMENT ON INDEX "packaging_runs_vessel_created_idx" IS 'Optimizes vessel tracking queries with date sorting';
COMMENT ON INDEX "packaging_runs_packaged_at_desc_idx" IS 'Optimizes default list view sorting for completed runs';
COMMENT ON INDEX "packaging_runs_status_type_date_idx" IS 'Covers common filter combinations in list API';
COMMENT ON INDEX "packaging_runs_batch_status_idx" IS 'Optimizes batch-based queries with status filtering';
COMMENT ON INDEX "inventory_items_packaging_run_created_idx" IS 'Optimizes inventory lookup for packaging run details';
COMMENT ON INDEX "inventory_items_expiry_package_idx" IS 'Optimizes expiration and package type queries';
COMMENT ON INDEX "package_sizes_active_type_size_idx" IS 'Optimizes reference data lookups for active package sizes';