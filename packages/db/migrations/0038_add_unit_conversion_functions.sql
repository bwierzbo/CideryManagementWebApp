-- Add unit conversion functions for volumes and weights
-- These functions provide standardized conversion to/from base units (L and kg)

-- ============================================================
-- VOLUME CONVERSION FUNCTIONS
-- ============================================================

-- Convert any volume unit to liters (base unit)
CREATE OR REPLACE FUNCTION convert_to_liters(value NUMERIC, unit unit)
RETURNS NUMERIC
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle NULL values
  IF value IS NULL OR unit IS NULL THEN
    RETURN value;
  END IF;

  -- Convert based on unit
  CASE unit
    WHEN 'L' THEN
      RETURN value;
    WHEN 'gal' THEN
      RETURN value * 3.78541;
    WHEN 'bushel' THEN
      -- Bushel liquid volume (35.2391 L)
      RETURN value * 35.2391;
    ELSE
      -- Unknown unit (kg, lb), return original value
      RETURN value;
  END CASE;
END;
$$;

-- Convert liters to any target unit
CREATE OR REPLACE FUNCTION convert_from_liters(liters NUMERIC, target_unit unit)
RETURNS NUMERIC
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle NULL values
  IF liters IS NULL OR target_unit IS NULL THEN
    RETURN liters;
  END IF;

  -- Convert based on target unit
  CASE target_unit
    WHEN 'L' THEN
      RETURN liters;
    WHEN 'gal' THEN
      RETURN liters / 3.78541;
    WHEN 'bushel' THEN
      -- Bushel liquid volume (35.2391 L)
      RETURN liters / 35.2391;
    ELSE
      -- Unknown unit (kg, lb), return original value
      RETURN liters;
  END CASE;
END;
$$;

-- ============================================================
-- WEIGHT CONVERSION FUNCTIONS
-- ============================================================

-- Convert any weight unit to kilograms (base unit)
CREATE OR REPLACE FUNCTION convert_to_kg(value NUMERIC, unit unit)
RETURNS NUMERIC
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle NULL values
  IF value IS NULL OR unit IS NULL THEN
    RETURN value;
  END IF;

  -- Convert based on unit
  CASE unit
    WHEN 'kg' THEN
      RETURN value;
    WHEN 'lb' THEN
      RETURN value * 0.453592;
    WHEN 'bushel' THEN
      -- Apple bushel weight (approximately 19.05 kg or 42 lbs)
      RETURN value * 19.05;
    ELSE
      -- Unknown unit, return original value
      RETURN value;
  END CASE;
END;
$$;

-- Convert kilograms to any target unit
CREATE OR REPLACE FUNCTION convert_from_kg(kg NUMERIC, target_unit unit)
RETURNS NUMERIC
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle NULL values
  IF kg IS NULL OR target_unit IS NULL THEN
    RETURN kg;
  END IF;

  -- Convert based on target unit
  CASE target_unit
    WHEN 'kg' THEN
      RETURN kg;
    WHEN 'lb' THEN
      RETURN kg / 0.453592;
    WHEN 'bushel' THEN
      -- Apple bushel weight (approximately 19.05 kg or 42 lbs)
      RETURN kg / 19.05;
    ELSE
      -- Unknown unit, return original value
      RETURN kg;
  END CASE;
END;
$$;

-- ============================================================
-- USAGE EXAMPLES (commented out)
-- ============================================================

-- Convert 5 gallons to liters:
-- SELECT convert_to_liters(5, 'gal'::unit);  -- Returns 18.92705

-- Convert 100 liters to gallons:
-- SELECT convert_from_liters(100, 'gal'::unit);  -- Returns 26.417

-- Convert 50 pounds to kilograms:
-- SELECT convert_to_kg(50, 'lb'::unit);  -- Returns 22.6796

-- Convert 20 kilograms to pounds:
-- SELECT convert_from_kg(20, 'lb'::unit);  -- Returns 44.0925

-- Convert 10 bushels (volume) to liters:
-- SELECT convert_to_liters(10, 'bushel'::unit);  -- Returns 352.391

-- Convert 10 bushels (weight) to kg:
-- SELECT convert_to_kg(10, 'bushel'::unit);  -- Returns 190.5
