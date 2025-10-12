-- Migration: Clean up duplicate and unused audit tables
-- Drop audit_metadata (not being used)
-- Drop audit_log (duplicate - use audit_logs instead)

-- Drop the unused audit_metadata table
DROP TABLE IF EXISTS "audit_metadata";

-- Drop the duplicate audit_log table (keep audit_logs)
DROP TABLE IF EXISTS "audit_log";
