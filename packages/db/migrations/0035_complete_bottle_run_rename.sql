-- Follow-up migration: Complete bottle_run rename
-- Rename remaining packaging_photo_type enum and missed primary key constraint

-- Rename the packaging_photo_type enum to bottle_run_photo_type
ALTER TYPE packaging_photo_type RENAME TO bottle_run_photo_type;

-- Rename the primary key constraint on bottle_run_photos
ALTER INDEX packaging_run_photos_pkey RENAME TO bottle_run_photos_pkey;
