-- Migration: Rename packaging → bottle_runs
-- This comprehensive migration renames all packaging-related tables, enums, indexes, and constraints

-- Step 1: Rename the enum type
ALTER TYPE packaging_run_status RENAME TO bottle_run_status;

-- Step 2: Rename the main tables
ALTER TABLE packaging_runs RENAME TO bottle_runs;
ALTER TABLE packaging_run_photos RENAME TO bottle_run_photos;

-- Step 3: Rename columns in inventory_items
ALTER TABLE inventory_items RENAME COLUMN packaging_run_id TO bottle_run_id;

-- Step 4: Rename foreign key constraints
-- inventory_items FK
ALTER TABLE inventory_items
  RENAME CONSTRAINT inventory_items_packaging_run_id_packaging_runs_id_fk
  TO inventory_items_bottle_run_id_bottle_runs_id_fk;

-- bottle_run_photos FK
ALTER TABLE bottle_run_photos
  RENAME CONSTRAINT packaging_run_photos_packaging_run_id_packaging_runs_id_fk
  TO bottle_run_photos_bottle_run_id_bottle_runs_id_fk;

-- Step 5: Rename primary key constraint (if named explicitly)
ALTER INDEX packaging_runs_pkey RENAME TO bottle_runs_pkey;

-- Step 6: Rename indexes on bottle_runs table
ALTER INDEX packaging_runs_batch_idx RENAME TO bottle_runs_batch_idx;
ALTER INDEX packaging_runs_vessel_idx RENAME TO bottle_runs_vessel_idx;
ALTER INDEX packaging_runs_packaged_at_idx RENAME TO bottle_runs_packaged_at_idx;
ALTER INDEX packaging_runs_status_idx RENAME TO bottle_runs_status_idx;
ALTER INDEX packaging_runs_batch_status_idx RENAME TO bottle_runs_batch_status_idx;

-- Step 7: Rename indexes on bottle_run_photos table
ALTER INDEX packaging_run_photos_packaging_run_idx RENAME TO bottle_run_photos_bottle_run_idx;
ALTER INDEX packaging_run_photos_uploaded_by_idx RENAME TO bottle_run_photos_uploaded_by_idx;

-- Step 8: Rename index on inventory_items
ALTER INDEX inventory_items_packaging_run_idx RENAME TO inventory_items_bottle_run_idx;

-- Step 9: Rename column in bottle_run_photos table
ALTER TABLE bottle_run_photos RENAME COLUMN packaging_run_id TO bottle_run_id;
