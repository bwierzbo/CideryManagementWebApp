-- Rename vessels to follow TYPE-SIZE-NUMBER convention
-- Pattern: TYPE-CAPACITY-NUMBER where capacity uses appropriate unit (L, G, BBL)

-- Wood Barrels (actual barrels with is_barrel = true)
UPDATE vessels SET name = 'BARREL-10G-1' WHERE name = '10 Barrel 1' AND is_barrel = true;
UPDATE vessels SET name = 'BARREL-60G-1' WHERE name = '225 Barrel 2' AND is_barrel = true;

-- Brite Tanks
UPDATE vessels SET name = 'BRITE-3BBL-1' WHERE name = '3BBL BRITE ' OR name = '3BBL BRITE';
UPDATE vessels SET name = 'BRITE-600-1' WHERE name = 'Bright Tank D1';

-- 5 Gallon Carboys
UPDATE vessels SET name = 'CARBOY-5G-1' WHERE name = '5 Carboy 1';
UPDATE vessels SET name = 'CARBOY-5G-2' WHERE name = '5 Carboy 2';
UPDATE vessels SET name = 'CARBOY-5G-3' WHERE name = '5 Carboy 3';
UPDATE vessels SET name = 'CARBOY-5G-4' WHERE name = '5 Carboy 4';
UPDATE vessels SET name = 'CARBOY-5G-5' WHERE name = '5 Carboy 5';
UPDATE vessels SET name = 'CARBOY-5G-6' WHERE name = '5 Carboy 6';
UPDATE vessels SET name = 'CARBOY-5G-7' WHERE name = '5 Carboy 7';
UPDATE vessels SET name = 'CARBOY-5G-8' WHERE name = '5 Carboy 8';
UPDATE vessels SET name = 'CARBOY-5G-9' WHERE name = '5 Carboy 9';
UPDATE vessels SET name = 'CARBOY-5G-10' WHERE name = '5 Carboy 10';
UPDATE vessels SET name = 'CARBOY-5G-11' WHERE name = '5 Carboy 11';
UPDATE vessels SET name = 'CARBOY-5G-12' WHERE name = '5 Carboy 12';
UPDATE vessels SET name = 'CARBOY-5G-13' WHERE name = '5 Carboy 13';
UPDATE vessels SET name = 'CARBOY-5G-14' WHERE name = 'Carboy 2';

-- 6 Gallon Carboys
UPDATE vessels SET name = 'CARBOY-6G-1' WHERE name = '6 Carboy 1';
UPDATE vessels SET name = 'CARBOY-6G-2' WHERE name = '6 Carboy 2';
UPDATE vessels SET name = 'CARBOY-6G-3' WHERE name = '6 Carboy 3';

-- IBCs (1000L plastic)
-- Note: There are duplicate "1000 IBC 1" entries - updating all to have unique names based on ID order
UPDATE vessels SET name = 'IBC-1000-2' WHERE name = '1000 IBC 2';
UPDATE vessels SET name = 'IBC-1000-3' WHERE name = '1000 IBC 3';
UPDATE vessels SET name = 'IBC-1000-4' WHERE name = '1000 IBC 4';
UPDATE vessels SET name = 'IBC-1000-5' WHERE name = '1000 IBC 5';
UPDATE vessels SET name = 'IBC-1000-6' WHERE name = '1000 IBC 6' OR name = '1000 IBC 6 ';
UPDATE vessels SET name = 'IBC-1000-7' WHERE name = '1000 IBC 7';
UPDATE vessels SET name = 'IBC-1000-8' WHERE name = '1000 IBC 8';
UPDATE vessels SET name = 'IBC-1000-9' WHERE name = '1000 IBC 9';
UPDATE vessels SET name = 'IBC-1000-10' WHERE name = '1000 IBC 10';
UPDATE vessels SET name = 'IBC-1000-11' WHERE name = '1000 IBC 11';
UPDATE vessels SET name = 'IBC-1000-TEST' WHERE name = '1000 IBC Test';

-- Handle duplicate "1000 IBC 1" entries - assign sequential numbers starting from 1
-- We'll use a CTE to number them and update
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as rn
  FROM vessels
  WHERE name = '1000 IBC 1'
)
UPDATE vessels v
SET name = 'IBC-1000-' || (n.rn + 11)::text
FROM numbered n
WHERE v.id = n.id AND v.name = '1000 IBC 1';

-- Now rename the first one back to IBC-1000-1 (the oldest one by created_at)
UPDATE vessels SET name = 'IBC-1000-1'
WHERE id = (SELECT id FROM vessels WHERE name LIKE 'IBC-1000-%' ORDER BY created_at LIMIT 1)
  AND name != 'IBC-1000-1';

-- Stainless Steel Tanks → TANK
UPDATE vessels SET name = 'TANK-1000-1' WHERE name = '1000 SS 1';
UPDATE vessels SET name = 'TANK-1000-2' WHERE name = '1000 SS 2';
UPDATE vessels SET name = 'TANK-1100-1' WHERE name = '1100SS1';
UPDATE vessels SET name = 'TANK-1100-2' WHERE name = '1100SS2';
UPDATE vessels SET name = 'TANK-500-1' WHERE name = '500 SS 1';
UPDATE vessels SET name = 'TANK-1000-A1' WHERE name = 'Tank A1';
UPDATE vessels SET name = 'TANK-500-B2' WHERE name = 'Tank B2';
UPDATE vessels SET name = 'COND-800-1' WHERE name = 'Conditioning Tank C1';

-- Plastic Drums (the "120 Barrel" and "225 Barrel" plastic ones)
UPDATE vessels SET name = 'DRUM-120-1' WHERE name = '120 Barrel 1';
UPDATE vessels SET name = 'DRUM-120-2' WHERE name = '120 Barrel 2';
UPDATE vessels SET name = 'DRUM-120-3' WHERE name = '120 Barrel 3';
UPDATE vessels SET name = 'DRUM-120-4' WHERE name = '120 Barrel 4';
UPDATE vessels SET name = 'DRUM-120-5' WHERE name = '120 Barrel 5';
UPDATE vessels SET name = 'DRUM-120-6' WHERE name = '120 Barrel 6';
UPDATE vessels SET name = 'DRUM-120-7' WHERE name = '120 Barrel 7';
UPDATE vessels SET name = 'DRUM-120-8' WHERE name = '120 Barrel 8';
UPDATE vessels SET name = 'DRUM-120-9' WHERE name = '120 Barrel 9';
UPDATE vessels SET name = 'DRUM-120-10' WHERE name = '120 Barrel 10';
UPDATE vessels SET name = 'DRUM-120-11' WHERE name = '120 Barrel 11';
UPDATE vessels SET name = 'DRUM-225-1' WHERE name = '225 Barrel 1' AND (is_barrel = false OR is_barrel IS NULL);

-- Kegs
UPDATE vessels SET name = 'KEG-5G-1' WHERE name = '5 Keg 1';
UPDATE vessels SET name = 'KEG-20-1' WHERE name = '20Keg1';
UPDATE vessels SET name = 'KEG-120-MIX' WHERE name = '120 Mixing Keg';

-- Special purpose vessels
UPDATE vessels SET name = 'PRESS-1000-1' WHERE name = '1000 Community Press';
UPDATE vessels SET name = 'PAIL-20-1' WHERE name = '20P1';

-- Test vessels (rename to follow convention)
UPDATE vessels SET name = 'IBC-1000-TST1' WHERE name = 'Test 1000 IBC';
UPDATE vessels SET name = 'TANK-1000-TST1' WHERE name = 'test tank';
UPDATE vessels SET name = 'TANK-1000-TST2' WHERE name = 'test tank 2';
