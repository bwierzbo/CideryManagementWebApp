-- Rename material enum value from 'oak' to 'wood'
-- This makes the material type more generic, with specific wood type in barrel details

-- Update the enum value
ALTER TYPE vessel_material RENAME VALUE 'oak' TO 'wood';

-- Update any existing vessels with oak material to wood
-- (This is handled by the enum rename above, but just in case)
