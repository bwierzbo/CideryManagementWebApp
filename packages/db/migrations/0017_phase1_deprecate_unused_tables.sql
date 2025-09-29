-- Phase 1 Database Safety Migration: Deprecate Unused Tables
-- Migration ID: phase1_deprecate_unused_tables_20250928
-- Issue #91: Database Safety System - Non-destructive migrations and monitoring
--
-- This migration deprecates unused tables identified in task #88 by renaming them
-- with the _deprecated_YYYYMMDD_unu naming convention instead of dropping them.
-- This allows for safe recovery if these tables are actually needed.

-- =============================================================================
-- SAFETY CHECKS AND VALIDATION
-- =============================================================================

-- Verify this is not running in production without proper approval
DO $$
BEGIN
    IF current_setting('server_version_num')::int >= 140000 THEN
        -- PostgreSQL 14+ allows this check
        IF current_setting('application_name', true) = 'production' THEN
            RAISE EXCEPTION 'Phase 1 deprecation migration requires explicit production approval';
        END IF;
    END IF;
END $$;

-- Create deprecation metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS deprecation_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    deprecated_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    deprecation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    migration_id TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    rollback_sql TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create monitoring table for deprecated element access
CREATE TABLE IF NOT EXISTS deprecated_element_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_name TEXT NOT NULL,
    element_type TEXT NOT NULL,
    access_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source_type TEXT NOT NULL, -- 'application', 'migration', 'admin', 'unknown'
    source_identifier TEXT NOT NULL,
    query_type TEXT NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE', etc.
    query_context TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for monitoring performance
CREATE INDEX IF NOT EXISTS idx_deprecated_access_element ON deprecated_element_access(element_name, access_timestamp);
CREATE INDEX IF NOT EXISTS idx_deprecated_access_timestamp ON deprecated_element_access(access_timestamp);
CREATE INDEX IF NOT EXISTS idx_deprecated_access_source ON deprecated_element_access(source_type, source_identifier);

-- =============================================================================
-- PRE-MIGRATION VALIDATION
-- =============================================================================

-- Function to validate table exists and is empty
CREATE OR REPLACE FUNCTION validate_table_deprecation(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_allow_non_empty BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
    query_text TEXT;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_schema_name
        AND table_name = p_table_name
    ) INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Table %.% does not exist', p_schema_name, p_table_name;
    END IF;

    -- Check row count
    query_text := format('SELECT COUNT(*) FROM %I.%I', p_schema_name, p_table_name);
    EXECUTE query_text INTO row_count;

    IF row_count > 0 AND NOT p_allow_non_empty THEN
        RAISE EXCEPTION 'Table %.% contains % rows and cannot be deprecated safely',
            p_schema_name, p_table_name, row_count;
    END IF;

    -- Log validation
    RAISE NOTICE 'Table %.% validated: exists=%, rows=%',
        p_schema_name, p_table_name, table_exists, row_count;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check for foreign key dependencies
CREATE OR REPLACE FUNCTION check_foreign_key_dependencies(
    p_schema_name TEXT,
    p_table_name TEXT
) RETURNS TEXT[] AS $$
DECLARE
    dependencies TEXT[];
    dep_record RECORD;
BEGIN
    -- Find tables that reference this table
    FOR dep_record IN
        SELECT DISTINCT
            format('%s.%s', tc.table_schema, tc.table_name) as referencing_table,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = p_schema_name
        AND ccu.table_name = p_table_name
    LOOP
        dependencies := array_append(dependencies, dep_record.referencing_table);
    END LOOP;

    RETURN dependencies;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DEPRECATION EXECUTION FUNCTIONS
-- =============================================================================

-- Function to deprecate a table safely
CREATE OR REPLACE FUNCTION deprecate_table(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_reason TEXT DEFAULT 'unused',
    p_migration_id TEXT DEFAULT 'manual'
) RETURNS TEXT AS $$
DECLARE
    deprecated_name TEXT;
    rollback_sql TEXT;
    dependencies TEXT[];
    dep_count INTEGER;
BEGIN
    -- Validate the table can be deprecated
    PERFORM validate_table_deprecation(p_schema_name, p_table_name, TRUE);

    -- Check dependencies
    dependencies := check_foreign_key_dependencies(p_schema_name, p_table_name);
    dep_count := array_length(dependencies, 1);

    IF dep_count > 0 THEN
        RAISE WARNING 'Table %.% has % foreign key dependencies: %',
            p_schema_name, p_table_name, dep_count, array_to_string(dependencies, ', ');
    END IF;

    -- Generate deprecated name
    deprecated_name := format('%s_deprecated_%s_unu',
        p_table_name,
        to_char(CURRENT_DATE, 'YYYYMMDD')
    );

    -- Ensure deprecated name doesn't exceed PostgreSQL limits (63 chars)
    IF length(deprecated_name) > 63 THEN
        deprecated_name := left(deprecated_name, 63);
        RAISE NOTICE 'Deprecated name truncated to fit PostgreSQL limits: %', deprecated_name;
    END IF;

    -- Check if deprecated name already exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_schema_name
        AND table_name = deprecated_name
    ) THEN
        -- Add sequence number to make unique
        deprecated_name := left(deprecated_name, 60) || '_01';
    END IF;

    -- Create rollback SQL
    rollback_sql := format('ALTER TABLE %I.%I RENAME TO %I;',
        p_schema_name, deprecated_name, p_table_name);

    -- Record metadata before deprecation
    INSERT INTO deprecation_metadata (
        element_type, original_name, deprecated_name, schema_name,
        reason, migration_id, rollback_sql, metadata
    ) VALUES (
        'table', p_table_name, deprecated_name, p_schema_name,
        p_reason, p_migration_id, rollback_sql,
        jsonb_build_object(
            'dependencies', dependencies,
            'dependency_count', dep_count,
            'deprecation_timestamp', NOW()
        )
    );

    -- Execute the deprecation
    EXECUTE format('ALTER TABLE %I.%I RENAME TO %I',
        p_schema_name, p_table_name, deprecated_name);

    RAISE NOTICE 'Table %.% deprecated to %', p_schema_name, p_table_name, deprecated_name;

    RETURN deprecated_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PHASE 1 DEPRECATION EXECUTION
-- =============================================================================

DO $$
DECLARE
    migration_id TEXT := 'phase1_deprecate_unused_tables_20250928';
    deprecated_name TEXT;
BEGIN
    RAISE NOTICE '=== Starting Phase 1 Table Deprecation ===';
    RAISE NOTICE 'Migration ID: %', migration_id;
    RAISE NOTICE 'Timestamp: %', NOW();

    -- 1. Deprecate juiceLots table
    -- Analysis: This table is unused and has no foreign key references in current codebase
    BEGIN
        RAISE NOTICE '--- Deprecating table: juice_lots ---';

        -- Validate table state
        PERFORM validate_table_deprecation('public', 'juice_lots', TRUE);

        -- Execute deprecation
        deprecated_name := deprecate_table(
            'public',
            'juice_lots',
            'unused',
            migration_id
        );

        RAISE NOTICE 'juice_lots successfully deprecated to: %', deprecated_name;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to deprecate juice_lots: %', SQLERRM;
        -- Continue with other tables
    END;

    -- 2. Deprecate tankMeasurements table
    -- Analysis: This table is part of tank management but unused in current workflow
    BEGIN
        RAISE NOTICE '--- Deprecating table: tank_measurements ---';

        -- Validate table state
        PERFORM validate_table_deprecation('public', 'tank_measurements', TRUE);

        -- Execute deprecation
        deprecated_name := deprecate_table(
            'public',
            'tank_measurements',
            'unused',
            migration_id
        );

        RAISE NOTICE 'tank_measurements successfully deprecated to: %', deprecated_name;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to deprecate tank_measurements: %', SQLERRM;
        -- Continue with other tables
    END;

    -- 3. Deprecate tankAdditives table
    -- Analysis: This table is part of tank management but unused in current workflow
    BEGIN
        RAISE NOTICE '--- Deprecating table: tank_additives ---';

        -- Validate table state
        PERFORM validate_table_deprecation('public', 'tank_additives', TRUE);

        -- Execute deprecation
        deprecated_name := deprecate_table(
            'public',
            'tank_additives',
            'unused',
            migration_id
        );

        RAISE NOTICE 'tank_additives successfully deprecated to: %', deprecated_name;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to deprecate tank_additives: %', SQLERRM;
        -- Continue
    END;

    RAISE NOTICE '=== Phase 1 Table Deprecation Complete ===';

    -- Show deprecation summary
    RAISE NOTICE 'Summary of deprecated elements:';
    FOR deprecated_name IN
        SELECT format('- %s.%s -> %s.%s (reason: %s)',
            schema_name, original_name, schema_name, deprecated_name, reason)
        FROM deprecation_metadata
        WHERE migration_id = 'phase1_deprecate_unused_tables_20250928'
        ORDER BY created_at
    LOOP
        RAISE NOTICE '%', deprecated_name;
    END LOOP;

END $$;

-- =============================================================================
-- POST-MIGRATION MONITORING SETUP
-- =============================================================================

-- Create trigger function to monitor deprecated table access
CREATE OR REPLACE FUNCTION log_deprecated_access() RETURNS event_trigger AS $$
DECLARE
    r RECORD;
    obj_name TEXT;
BEGIN
    -- This is a simplified monitoring setup
    -- In a full implementation, this would integrate with the monitoring system

    FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        obj_name := r.object_identity;

        -- Check if the object being accessed is deprecated
        IF obj_name LIKE '%_deprecated_%' THEN
            INSERT INTO deprecated_element_access (
                element_name, element_type, source_type,
                source_identifier, query_type, query_context
            ) VALUES (
                obj_name, 'table', 'ddl',
                current_user, TG_EVENT, TG_TAG
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create event trigger for DDL monitoring
-- Note: This is commented out as event triggers require superuser privileges
-- and may not be appropriate for all environments
/*
CREATE EVENT TRIGGER deprecated_access_monitor
    ON ddl_command_end
    EXECUTE FUNCTION log_deprecated_access();
*/

-- =============================================================================
-- ROLLBACK PROCEDURES
-- =============================================================================

-- Function to rollback table deprecation
CREATE OR REPLACE FUNCTION rollback_table_deprecation(
    p_deprecated_name TEXT,
    p_schema_name TEXT DEFAULT 'public'
) RETURNS TEXT AS $$
DECLARE
    metadata_record RECORD;
    original_name TEXT;
BEGIN
    -- Get deprecation metadata
    SELECT * INTO metadata_record
    FROM deprecation_metadata
    WHERE deprecated_name = p_deprecated_name
    AND schema_name = p_schema_name
    AND element_type = 'table';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No deprecation metadata found for table: %.%',
            p_schema_name, p_deprecated_name;
    END IF;

    original_name := metadata_record.original_name;

    -- Check if original name is available
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_schema_name
        AND table_name = original_name
    ) THEN
        RAISE EXCEPTION 'Cannot rollback: original name %.% already exists',
            p_schema_name, original_name;
    END IF;

    -- Execute rollback
    EXECUTE metadata_record.rollback_sql;

    -- Update metadata to mark as rolled back
    UPDATE deprecation_metadata
    SET metadata = metadata || jsonb_build_object(
        'rollback_timestamp', NOW(),
        'rollback_by', current_user
    )
    WHERE id = metadata_record.id;

    RAISE NOTICE 'Table %.% successfully rolled back to %.%',
        p_schema_name, p_deprecated_name, p_schema_name, original_name;

    RETURN original_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DEPRECATION REPORT FUNCTIONS
-- =============================================================================

-- Function to generate deprecation status report
CREATE OR REPLACE FUNCTION get_deprecation_status()
RETURNS TABLE (
    element_type TEXT,
    original_name TEXT,
    deprecated_name TEXT,
    deprecation_date DATE,
    reason TEXT,
    days_deprecated INTEGER,
    access_count BIGINT,
    last_accessed TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dm.element_type,
        dm.original_name,
        dm.deprecated_name,
        dm.deprecation_date,
        dm.reason,
        (CURRENT_DATE - dm.deprecation_date)::INTEGER as days_deprecated,
        COALESCE(access_stats.access_count, 0) as access_count,
        access_stats.last_accessed
    FROM deprecation_metadata dm
    LEFT JOIN (
        SELECT
            element_name,
            COUNT(*) as access_count,
            MAX(access_timestamp) as last_accessed
        FROM deprecated_element_access
        GROUP BY element_name
    ) access_stats ON dm.deprecated_name = access_stats.element_name
    ORDER BY dm.deprecation_date DESC, dm.element_type, dm.original_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Function to clean up old deprecation data
CREATE OR REPLACE FUNCTION cleanup_deprecation_data(
    p_retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old access logs
    DELETE FROM deprecated_element_access
    WHERE access_timestamp < (NOW() - (p_retention_days || ' days')::INTERVAL);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % old access log entries', deleted_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MIGRATION COMPLETION
-- =============================================================================

-- Final validation and summary
DO $$
DECLARE
    deprecated_count INTEGER;
    status_record RECORD;
BEGIN
    -- Count deprecated elements
    SELECT COUNT(*) INTO deprecated_count
    FROM deprecation_metadata
    WHERE migration_id = 'phase1_deprecate_unused_tables_20250928';

    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Deprecated % elements in this migration', deprecated_count;

    -- Show final status
    RAISE NOTICE 'Current deprecation status:';
    FOR status_record IN
        SELECT * FROM get_deprecation_status()
        WHERE deprecated_name LIKE '%_deprecated_20250928_%'
    LOOP
        RAISE NOTICE '- % % (% days old)',
            status_record.element_type,
            status_record.deprecated_name,
            status_record.days_deprecated;
    END LOOP;

    RAISE NOTICE 'Monitoring tables created for tracking access to deprecated elements';
    RAISE NOTICE 'Use get_deprecation_status() function to check status';
    RAISE NOTICE 'Use rollback_table_deprecation() function for emergency rollback';
END $$;

-- Drop temporary validation functions (keep core functions)
DROP FUNCTION IF EXISTS validate_table_deprecation(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS check_foreign_key_dependencies(TEXT, TEXT);

-- Grant necessary permissions
GRANT SELECT ON deprecation_metadata TO PUBLIC;
GRANT SELECT ON deprecated_element_access TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_deprecation_status() TO PUBLIC;

-- Document this migration
COMMENT ON TABLE deprecation_metadata IS 'Tracks deprecated database elements for Phase 1 safety migrations';
COMMENT ON TABLE deprecated_element_access IS 'Monitors access to deprecated database elements';
COMMENT ON FUNCTION rollback_table_deprecation(TEXT, TEXT) IS 'Emergency rollback function for deprecated tables';
COMMENT ON FUNCTION get_deprecation_status() IS 'Status report for all deprecated elements';
COMMENT ON FUNCTION cleanup_deprecation_data(INTEGER) IS 'Cleanup old deprecation monitoring data';