-- Add calvados to barrel_origin_contents enum
ALTER TYPE barrel_origin_contents ADD VALUE IF NOT EXISTS 'calvados' AFTER 'brandy';
