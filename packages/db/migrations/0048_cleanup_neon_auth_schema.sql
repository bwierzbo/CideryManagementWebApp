-- Migration: Cleanup orphaned neon_auth schema
-- Description: Removes unused neon_auth schema that has no tables or application references
-- Date: 2025-10-16
-- Safe: YES - No code references, no data loss risk

-- This schema was likely created by Neon platform but never used by the application
-- Our NextAuth implementation uses public.users table exclusively

-- Drop the orphaned schema
-- CASCADE ensures any objects within are also dropped (though none exist)
DROP SCHEMA IF EXISTS neon_auth CASCADE;

-- Verification query (run after migration):
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'neon_auth';
-- Expected result: 0 rows (schema successfully dropped)

-- SAFETY NOTES:
-- ✅ public.users table is NOT affected (it's in the public schema)
-- ✅ No foreign keys reference neon_auth schema
-- ✅ No application code references neon_auth schema
-- ✅ No Drizzle schema definitions for neon_auth
-- ✅ NextAuth continues to work with public.users table
