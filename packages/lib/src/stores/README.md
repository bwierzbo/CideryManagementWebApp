# Stores Module

Zustand stores for client-side state management with persistence.

## Unit Preferences Store

Manages user preferences for volume, weight, and temperature units with automatic locale detection and localStorage persistence.

### Features

- **Automatic Locale Detection**: Detects user locale on first load and sets appropriate defaults
- **Imperial/Metric Defaults**: US locales get imperial units, others get metric
- **localStorage Persistence**: Preferences persist across sessions
- **Type-Safe**: Full TypeScript support with strict typing
- **Convenience Hooks**: Specialized hooks for accessing individual unit preferences

### Usage

#### Basic Usage

```typescript
import { useUnitPreferences } from "lib/src/stores";

function PreferencesPanel() {
  const { preferences, setVolumeUnit, setWeightUnit, setTemperatureUnit } =
    useUnitPreferences();

  return (
    <div>
      <h2>Unit Preferences</h2>

      <label>
        Volume:
        <select
          value={preferences.volume}
          onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}
        >
          <option value="L">Liters (L)</option>
          <option value="gal">Gallons (gal)</option>
          <option value="mL">Milliliters (mL)</option>
        </select>
      </label>

      <label>
        Weight:
        <select
          value={preferences.weight}
          onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
        >
          <option value="kg">Kilograms (kg)</option>
          <option value="lb">Pounds (lb)</option>
        </select>
      </label>

      <label>
        Temperature:
        <select
          value={preferences.temperature}
          onChange={(e) => setTemperatureUnit(e.target.value as TemperatureUnit)}
        >
          <option value="C">Celsius (°C)</option>
          <option value="F">Fahrenheit (°F)</option>
        </select>
      </label>
    </div>
  );
}
```

#### Using with Conversion Functions

```typescript
import { useVolumeUnit } from "lib/src/stores";
import { convertFromLiters, formatVolume } from "lib/src/units";

function VolumeDisplay({ liters }: { liters: number }) {
  const volumeUnit = useVolumeUnit();

  // Convert to user's preferred unit
  const displayValue = convertFromLiters(liters, volumeUnit);

  // Or use formatting helper
  const formatted = formatVolume(liters, volumeUnit, 2);

  return (
    <div>
      <p>
        Volume: {displayValue.toFixed(2)} {volumeUnit}
      </p>
      <p>Formatted: {formatted}</p>
    </div>
  );
}
```

#### Convenience Hooks

```typescript
import {
  useVolumeUnit,
  useWeightUnit,
  useTemperatureUnit,
} from "lib/src/stores";

function BatchDisplay({ batch }) {
  // Get individual unit preferences
  const volumeUnit = useVolumeUnit();
  const weightUnit = useWeightUnit();
  const tempUnit = useTemperatureUnit();

  return (
    <div>
      <p>
        Volume: {convertFromLiters(batch.volumeLiters, volumeUnit)} {volumeUnit}
      </p>
      <p>
        Weight: {convertFromKg(batch.weightKg, weightUnit)} {weightUnit}
      </p>
      <p>
        Temp: {convertFromCelsius(batch.tempC, tempUnit)}°{tempUnit}
      </p>
    </div>
  );
}
```

#### Reset and Locale Defaults

```typescript
import { useUnitPreferences, getLocaleDefaults } from "lib/src/stores";

function SettingsPanel() {
  const { resetToDefaults, setLocaleDefaults } = useUnitPreferences();

  return (
    <div>
      <button onClick={resetToDefaults}>Reset to System Defaults</button>

      <button onClick={() => setLocaleDefaults("en-US")}>
        Use US Imperial Units
      </button>

      <button onClick={() => setLocaleDefaults("en-GB")}>
        Use UK Metric Units
      </button>
    </div>
  );
}

// Get defaults for a locale programmatically
const usDefaults = getLocaleDefaults("en-US");
// { volume: 'gal', weight: 'lb', temperature: 'F' }

const ukDefaults = getLocaleDefaults("en-GB");
// { volume: 'L', weight: 'kg', temperature: 'C' }
```

### API Reference

#### Store State

```typescript
interface UnitPreferences {
  volume: VolumeUnit; // 'L' | 'gal' | 'mL'
  weight: WeightUnit; // 'kg' | 'lb'
  temperature: TemperatureUnit; // 'C' | 'F'
}
```

#### Store Actions

- `setVolumeUnit(unit: VolumeUnit)` - Update volume unit preference
- `setWeightUnit(unit: WeightUnit)` - Update weight unit preference
- `setTemperatureUnit(unit: TemperatureUnit)` - Update temperature unit preference
- `resetToDefaults()` - Reset to locale-based defaults
- `setLocaleDefaults(locale: string)` - Set defaults for a specific locale

#### Convenience Selectors

- `useVolumeUnit()` - Hook that returns current volume unit
- `useWeightUnit()` - Hook that returns current weight unit
- `useTemperatureUnit()` - Hook that returns current temperature unit

#### Helper Functions

- `getLocaleDefaults(locale: string): UnitPreferences` - Get appropriate defaults for a locale

### Locale Detection

On first load, the store automatically detects the user's locale using:

1. `navigator.language` (primary)
2. `navigator.languages[0]` (fallback)
3. `'en-US'` (default for SSR or unavailable)

**Imperial Units (US)**: Locales containing "us" (case-insensitive) get:

- Volume: gallons (gal)
- Weight: pounds (lb)
- Temperature: Fahrenheit (F)

**Metric Units (Rest of World)**: All other locales get:

- Volume: liters (L)
- Weight: kilograms (kg)
- Temperature: Celsius (C)

### Persistence

Preferences are automatically persisted to localStorage with the key `unit-preferences`.

The store uses Zustand's persist middleware to:

- Save preferences on every change
- Restore preferences on page load
- Handle SSR gracefully (no localStorage errors)

### Testing

The store includes comprehensive tests covering:

- Locale detection and defaults
- All actions (setters, reset, locale defaults)
- Persistence to localStorage
- Restoration from localStorage
- Convenience selectors
- Real-world usage scenarios

See `__tests__/useUnitPreferences.test.ts` for examples.

### TypeScript Support

All types are fully typed and exported:

```typescript
import type {
  UnitPreferences,
  VolumeUnit,
  WeightUnit,
  TemperatureUnit,
} from "lib/src/stores";
```

### Integration with Unit Conversions

This store is designed to work seamlessly with the `units/conversions` module:

```typescript
import { useVolumeUnit } from "lib/src/stores";
import { convertFromLiters, formatVolume } from "lib/src/units";

// In your component
const volumeUnit = useVolumeUnit();
const displayValue = convertFromLiters(batchVolumeLiters, volumeUnit);
const formatted = formatVolume(batchVolumeLiters, volumeUnit, 2);
```

This pattern allows you to:

1. Store all values in the database in base units (L, kg, C)
2. Convert to user's preferred units for display
3. Let users switch units without affecting data
