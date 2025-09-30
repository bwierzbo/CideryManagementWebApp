-- Safe migration that checks for existing columns first

DO $$
BEGIN
    -- Check and add columns only if they don't exist

    -- BATCHES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='batches' AND column_name='initial_volume_unit') THEN
        ALTER TABLE batches ADD COLUMN initial_volume_unit text DEFAULT 'L';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='batches' AND column_name='current_volume_unit') THEN
        ALTER TABLE batches ADD COLUMN current_volume_unit text DEFAULT 'L';
    END IF;

    -- VESSELS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='vessels' AND column_name='capacity_unit') THEN
        ALTER TABLE vessels ADD COLUMN capacity_unit text DEFAULT 'L';
    END IF;

    -- Convert text columns to enum if they're still text
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='batches' AND column_name='initial_volume_unit'
               AND data_type='text') THEN
        ALTER TABLE batches
            ALTER COLUMN initial_volume_unit TYPE unit USING initial_volume_unit::unit;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='batches' AND column_name='current_volume_unit'
               AND data_type='text') THEN
        ALTER TABLE batches
            ALTER COLUMN current_volume_unit TYPE unit USING current_volume_unit::unit;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='vessels' AND column_name='capacity_unit'
               AND data_type='text') THEN
        ALTER TABLE vessels
            ALTER COLUMN capacity_unit TYPE unit USING capacity_unit::unit;
    END IF;

    -- Rename columns if they haven't been renamed yet
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='batches' AND column_name='initial_volume_l') THEN
        ALTER TABLE batches RENAME COLUMN initial_volume_l TO initial_volume;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='batches' AND column_name='current_volume_l') THEN
        ALTER TABLE batches RENAME COLUMN current_volume_l TO current_volume;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='vessels' AND column_name='capacity_l') THEN
        ALTER TABLE vessels RENAME COLUMN capacity_l TO capacity;
    END IF;

END $$;