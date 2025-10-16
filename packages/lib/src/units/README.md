# Unit Conversion Utilities

Type-safe unit conversion utilities for volume, weight, and temperature with the same conversion factors as the database SQL functions.

## Usage

Import directly from the units module:

```typescript
import {
  convertToLiters,
  convertFromLiters,
  convertToKg,
  convertFromKg,
  convertToCelsius,
  convertFromCelsius,
  formatVolume,
  formatWeight,
  formatTemperature,
  isValidVolume,
  isValidWeight,
  type VolumeUnit,
  type WeightUnit,
  type TemperatureUnit,
} from "lib/src/units";
```

## Volume Conversions

### Convert to base unit (liters)

```typescript
const liters = convertToLiters(50, "gal"); // 189.271 L
const liters = convertToLiters(750, "mL"); // 0.75 L
```

### Convert from base unit (liters)

```typescript
const gallons = convertFromLiters(189.271, "gal"); // 50 gal
const milliliters = convertFromLiters(0.75, "mL"); // 750 mL
```

### Format volume for display

```typescript
formatVolume(189.271, "gal", 1); // "50.0 gal"
formatVolume(0.75, "mL", 0); // "750 mL"
formatVolume(5.5, "L", 2); // "5.50 L"
```

## Weight Conversions

### Convert to base unit (kilograms)

```typescript
const kg = convertToKg(100, "lb"); // 45.3592 kg
```

### Convert from base unit (kilograms)

```typescript
const pounds = convertFromKg(45.3592, "lb"); // 100 lb
```

### Format weight for display

```typescript
formatWeight(45.3592, "lb", 0); // "100 lb"
formatWeight(5.5, "kg", 2); // "5.50 kg"
```

## Temperature Conversions

### Convert to base unit (Celsius)

```typescript
const celsius = convertToCelsius(68, "F"); // 20°C
const celsius = convertToCelsius(20, "C"); // 20°C
```

### Convert from base unit (Celsius)

```typescript
const fahrenheit = convertFromCelsius(20, "F"); // 68°F
const celsius = convertFromCelsius(20, "C"); // 20°C
```

### Format temperature for display

```typescript
formatTemperature(20, "F", 0); // "68°F"
formatTemperature(20, "C", 1); // "20.0°C"
```

## Validation

```typescript
isValidVolume(5.5); // true
isValidVolume(0); // false
isValidVolume(-1); // false

isValidWeight(100); // true
isValidWeight(0); // false
isValidWeight(-1); // false
```

## Conversion Factors

These utilities use the same conversion factors as the database SQL functions:

- **Volume**
  - 1 gal = 3.78541 L
  - 1 mL = 0.001 L

- **Weight**
  - 1 lb = 0.453592 kg

- **Temperature**
  - F to C: (F - 32) × 5/9
  - C to F: C × 9/5 + 32

## Real-world Examples

```typescript
// Typical cidery batch (50 gallon)
const batchLiters = convertToLiters(50, "gal"); // 189.271 L
formatVolume(batchLiters, "gal", 1); // "50.0 gal"

// Apple weight (1000 lbs)
const applesKg = convertToKg(1000, "lb"); // 453.592 kg
formatWeight(applesKg, "lb", 0); // "1000 lb"

// Fermentation temperature (68°F)
const tempC = convertToCelsius(68, "F"); // 20°C
formatTemperature(tempC, "F", 0); // "68°F"
formatTemperature(tempC, "C", 1); // "20.0°C"

// Bottle volume (750mL)
const bottleLiters = convertToLiters(750, "mL"); // 0.75 L
formatVolume(bottleLiters, "mL", 0); // "750 mL"
```

## Note on Existing Utils

This module provides a cleaner API compared to the legacy `utils/unitConversion` and `utils/volumeConversion` modules. The legacy modules remain available for backwards compatibility but new code should prefer this module.

Key differences:
- Simpler function names
- No validation errors thrown (use validation functions separately)
- Consistent base unit approach (liters for volume, kg for weight, Celsius for temperature)
- Type-safe unit parameters
- Comprehensive JSDoc documentation
