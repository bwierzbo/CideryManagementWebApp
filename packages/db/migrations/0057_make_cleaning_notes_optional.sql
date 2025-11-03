-- Make vessel cleaning operation notes optional
ALTER TABLE vessel_cleaning_operations
ALTER COLUMN notes DROP NOT NULL;
