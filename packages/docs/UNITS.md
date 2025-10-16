# Unit Management System

Complete guide to the unit management system in the Cidery Management App.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Storage Strategy](#storage-strategy)
- [Component Library](#component-library)
- [Developer Guide](#developer-guide)
- [Best Practices](#best-practices)
- [Common Pitfalls](#common-pitfalls)
- [Migration Guide](#migration-guide)

---

## Overview

The unit management system provides automatic conversion between different measurement units while maintaining data integrity and user preferences. It supports:

- **Volumes**: Liters (L), Gallons (gal), Milliliters (mL)
- **Weights**: Kilograms (kg), Pounds (lb)
- **Temperatures**: Celsius (°C), Fahrenheit (°F)

### Key Features

- **Automatic Conversions**: All conversions handled transparently
- **User Preferences**: Remembers user's preferred units
- **Database Triggers**: Auto-maintains normalized values
- **Type Safety**: Full TypeScript support
- **Precision**: Accurate conversion factors
- **Locale Detection**: Auto-detects metric/imperial preference

---

## Architecture

The system consists of four layers:

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React Components)                    │
│  - VolumeInput, VolumeDisplay                   │
│  - WeightDisplay, TemperatureDisplay            │
│  - UnitToggle                                   │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Store Layer (Zustand)                          │
│  - useUnitPreferences                           │
│  - useVolumeUnit, useWeightUnit                 │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Conversion Layer (Pure Functions)              │
│  - convertToLiters, convertFromLiters           │
│  - convertToKg, convertFromKg                   │
│  - convertToCelsius, convertFromCelsius         │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Database Layer (PostgreSQL + Triggers)         │
│  - Original values (volume + volumeUnit)        │
│  - Normalized values (volumeLiters)             │
│  - Automatic trigger maintenance                │
└─────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: User Input                                          │
│  ┌────────────────────────────────────────────────────┐      │
│  │  VolumeInput Component                             │      │
│  │  • User enters: "50"                               │      │
│  │  • Selects unit: "gal"                             │      │
│  │  • Reads preference from: useVolumeUnit()          │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Conversion to Base Unit                            │
│  ┌────────────────────────────────────────────────────┐      │
│  │  convertToLiters(50, "gal")                        │      │
│  │  • Input: 50 gal                                   │      │
│  │  • Factor: 1 gal = 3.78541 L                       │      │
│  │  • Output: 189.271 L                               │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: API Layer (tRPC)                                   │
│  ┌────────────────────────────────────────────────────┐      │
│  │  trpc.batch.transferJuiceToTank.mutate({           │      │
│  │    volumeToTransfer: 50,                           │      │
│  │    volumeUnit: "gal"                               │      │
│  │  })                                                │      │
│  │  • Converts: convertToLiters(50, "gal")            │      │
│  │  • Result: 189.271 L                               │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: Database Storage (PostgreSQL)                      │
│  ┌────────────────────────────────────────────────────┐      │
│  │  INSERT INTO batches (                             │      │
│  │    initialVolume,        -- "189.271" (string)     │      │
│  │    initialVolumeUnit,    -- "L"                    │      │
│  │    initialVolumeLiters   -- Auto-set by trigger    │      │
│  │  ) VALUES (                                        │      │
│  │    '189.271',                                      │      │
│  │    'L',                                            │      │
│  │    NULL  -- Trigger will set this                 │      │
│  │  );                                                │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 5: Database Trigger Execution                         │
│  ┌────────────────────────────────────────────────────┐      │
│  │  BEFORE INSERT OR UPDATE                           │      │
│  │  • Reads: initialVolume = "189.271"                │      │
│  │  • Reads: initialVolumeUnit = "L"                  │      │
│  │  • Calls: convert_to_liters(189.271, 'L')          │      │
│  │  • Sets: initialVolumeLiters = 189.271 (numeric)   │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  Result in database:                                        │
│  ┌────────────────────────────────────────────────────┐      │
│  │  initialVolume:       "189.271"    (text/decimal)  │      │
│  │  initialVolumeUnit:   "L"          (enum)          │      │
│  │  initialVolumeLiters: 189.271      (numeric)       │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 6: Retrieval (API Query)                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │  SELECT                                            │      │
│  │    initialVolume,       -- "189.271"               │      │
│  │    initialVolumeUnit,   -- "L"                     │      │
│  │    initialVolumeLiters  -- 189.271                 │      │
│  │  FROM batches WHERE id = ?                         │      │
│  │                                                    │      │
│  │  Returns to frontend:                              │      │
│  │  {                                                 │      │
│  │    initialVolumeLiters: 189.271                    │      │
│  │  }                                                 │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 7: Display Conversion                                 │
│  ┌────────────────────────────────────────────────────┐      │
│  │  <VolumeDisplay liters={189.271} />                │      │
│  │  • Reads preference: useVolumeUnit() → "gal"       │      │
│  │  • Converts: convertFromLiters(189.271, "gal")     │      │
│  │  • Displays: "50.00 gal"                           │      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      USER SEES RESULT                         │
│                      "50.00 gal"                             │
└──────────────────────────────────────────────────────────────┘
```

### Why Normalized Fields?

Normalized fields (e.g., `volumeLiters`) enable:
- **Consistent Sorting**: `ORDER BY volumeLiters` works regardless of original unit
- **Accurate Filtering**: `WHERE volumeLiters > 100` compares apples to apples
- **Aggregate Queries**: `SUM(volumeLiters)` gives correct totals
- **Performance**: Indexed numeric field is faster than conversion on-the-fly

---

## Storage Strategy

### Dual Storage Pattern

Every measurement is stored in **two ways**:

1. **Original Values** (for display/audit)
   - `volume` (text/decimal) - "50" or "189.271"
   - `volumeUnit` (enum) - "gal" or "L"
   - Preserves user's input exactly as entered

2. **Normalized Values** (for calculations)
   - `volumeLiters` (numeric) - Always in liters
   - Auto-maintained by database triggers
   - Used for sorting, filtering, aggregations

### Example Table Schema

```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY,

  -- Original values (what user entered)
  initial_volume NUMERIC(10,3) NOT NULL,
  initial_volume_unit unit NOT NULL DEFAULT 'L',

  -- Normalized value (for queries)
  initial_volume_liters NUMERIC(10,3) NOT NULL,
  -- Auto-maintained by trigger!

  -- ... other fields
);

-- Trigger to maintain normalized value
CREATE TRIGGER trigger_normalize_batch_volumes
  BEFORE INSERT OR UPDATE OF initial_volume, initial_volume_unit
  ON batches
  FOR EACH ROW
  EXECUTE FUNCTION normalize_batch_volumes();
```

### Benefits of This Approach

✅ **Data Integrity**: Original input preserved for audit trails
✅ **Query Performance**: Normalized fields indexed for fast lookups
✅ **Automatic Maintenance**: Triggers keep normalized values in sync
✅ **Developer Friendly**: Just insert original values, triggers handle the rest
✅ **Backward Compatible**: Existing queries still work

---

## Component Library

### Input Components

#### VolumeInput

Editable input with unit conversion.

```tsx
import { VolumeInput } from "@/components/units";

function BatchForm() {
  const [volumeLiters, setVolumeLiters] = useState(189.271);

  return (
    <VolumeInput
      value={volumeLiters}           // Always in liters
      onChange={setVolumeLiters}     // Receives liters
      label="Batch Volume"
      required
      error={errors.volume?.message}
    />
  );
}
```

**Key Points:**
- Value prop is always in liters (base unit)
- onChange callback receives liters
- Component handles all conversions internally
- Automatically uses user's preferred unit

### Display Components

#### VolumeDisplay

Read-only display with automatic conversion.

```tsx
import { VolumeDisplay } from "@/components/units";

// Simple display
<VolumeDisplay liters={189.271} />
// Shows: "50.00 gal" (if user prefers gallons)

// With both units
<VolumeDisplay liters={189.271} showBothUnits />
// Shows: "50.00 gal (189.27 L)"
```

#### WeightDisplay

```tsx
import { WeightDisplay } from "@/components/units";

<WeightDisplay kg={453.592} />
// Shows: "1000.00 lb" (if user prefers pounds)
```

#### TemperatureDisplay

```tsx
import { TemperatureDisplay } from "@/components/units";

<TemperatureDisplay celsius={20} />
// Shows: "68.0°F" (if user prefers Fahrenheit)
```

### Utility Components

#### UnitToggle

Quick toggle between metric and imperial.

```tsx
import { UnitToggle } from "@/components/units";

<CardHeader className="flex justify-between">
  <CardTitle>Batch Details</CardTitle>
  <UnitToggle />
</CardHeader>
```

---

## Developer Guide

### Adding a New Measurement

Follow these steps to add a new unit-aware field:

#### 1. Update Database Schema

```sql
-- Add columns for original and normalized values
ALTER TABLE my_table
  ADD COLUMN my_measurement NUMERIC(10,3),
  ADD COLUMN my_measurement_unit unit DEFAULT 'L',
  ADD COLUMN my_measurement_liters NUMERIC(10,3);

-- Create trigger function
CREATE OR REPLACE FUNCTION normalize_my_measurement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.my_measurement IS NOT NULL AND NEW.my_measurement_unit IS NOT NULL THEN
    NEW.my_measurement_liters := convert_to_liters(
      CAST(NEW.my_measurement AS NUMERIC),
      NEW.my_measurement_unit
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_normalize_my_measurement
  BEFORE INSERT OR UPDATE OF my_measurement, my_measurement_unit
  ON my_table
  FOR EACH ROW
  EXECUTE FUNCTION normalize_my_measurement();
```

#### 2. Update Drizzle Schema

```typescript
// packages/db/src/schema.ts
export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Original values
  myMeasurement: decimal("my_measurement", { precision: 10, scale: 3 }),
  myMeasurementUnit: unitEnum("my_measurement_unit").default("L"),

  // Normalized value (auto-maintained by trigger)
  myMeasurementLiters: decimal("my_measurement_liters", {
    precision: 10,
    scale: 3
  }),
});
```

#### 3. Update API Router

```typescript
// packages/api/src/routers/myRouter.ts
import { convertToLiters } from "lib/src/units/conversions";

const createSchema = z.object({
  measurement: z.number().positive(),
  measurementUnit: z.enum(["L", "gal", "mL"]).default("L"),
});

// In your procedure
.mutation(async ({ input }) => {
  // Convert to liters before storing
  const measurementL = convertToLiters(
    input.measurement,
    input.measurementUnit
  );

  await db.insert(myTable).values({
    myMeasurement: measurementL.toString(),
    myMeasurementUnit: "L",
    // myMeasurementLiters will be set by trigger
  });
});
```

#### 4. Use in Frontend

```tsx
import { VolumeInput, VolumeDisplay } from "@/components/units";

// Editable
<VolumeInput
  value={measurementLiters}
  onChange={setMeasurementLiters}
  label="Measurement"
/>

// Display only
<VolumeDisplay liters={data.myMeasurementLiters} />
```

### Adding a New Unit Type

To add a completely new unit type (e.g., pressure):

#### 1. Add Conversion Functions

```typescript
// packages/lib/src/units/conversions.ts

export type PressureUnit = "psi" | "bar" | "kPa";

const PSI_TO_KPA = 6.89476;
const BAR_TO_KPA = 100;

export function convertToKPa(value: number, unit: PressureUnit): number {
  switch (unit) {
    case "kPa":
      return value;
    case "psi":
      return value * PSI_TO_KPA;
    case "bar":
      return value * BAR_TO_KPA;
    default:
      return value;
  }
}

export function convertFromKPa(kPa: number, targetUnit: PressureUnit): number {
  switch (targetUnit) {
    case "kPa":
      return kPa;
    case "psi":
      return kPa / PSI_TO_KPA;
    case "bar":
      return kPa / BAR_TO_KPA;
    default:
      return kPa;
  }
}

export function formatPressure(
  kPa: number,
  unit: PressureUnit,
  decimals: number = 1
): string {
  const converted = convertFromKPa(kPa, unit);
  return `${converted.toFixed(decimals)} ${unit}`;
}
```

#### 2. Add to User Preferences Store

```typescript
// packages/lib/src/stores/useUnitPreferences.ts

export interface UnitPreferences {
  volume: VolumeUnit;
  weight: WeightUnit;
  temperature: TemperatureUnit;
  pressure: PressureUnit;  // NEW
}

// Add selectors
export const usePressureUnit = () =>
  useUnitPreferences((state) => state.preferences.pressure);

// Update locale defaults
export function getLocaleDefaults(locale: string): UnitPreferences {
  if (usesImperialUnits(locale)) {
    return {
      volume: "gal",
      weight: "lb",
      temperature: "F",
      pressure: "psi",  // NEW
    };
  }

  return {
    volume: "L",
    weight: "kg",
    temperature: "C",
    pressure: "kPa",  // NEW
  };
}
```

#### 3. Create Display Component

```tsx
// apps/web/src/components/units/PressureDisplay.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  convertFromKPa,
  type PressureUnit,
} from "lib/src/units/conversions";
import { usePressureUnit } from "lib/src/stores";

export interface PressureDisplayProps {
  kPa: number;
  showUnit?: boolean;
  decimals?: number;
  className?: string;
}

export function PressureDisplay({
  kPa,
  showUnit = true,
  decimals = 1,
  className,
}: PressureDisplayProps) {
  const preferredUnit = usePressureUnit();

  const displayValue = React.useMemo(
    () => convertFromKPa(kPa, preferredUnit),
    [kPa, preferredUnit]
  );

  return (
    <span className={cn("tabular-nums", className)}>
      {displayValue.toFixed(decimals)}
      {showUnit && (
        <span className="ml-1 text-muted-foreground">
          {preferredUnit}
        </span>
      )}
    </span>
  );
}
```

---

## Best Practices

### ✅ DO

1. **Always Store in Base Units**
   ```typescript
   // ✅ Good - store in liters
   await db.insert(batches).values({
     initialVolume: liters.toString(),
     initialVolumeUnit: "L",
   });
   ```

2. **Use Components for Consistency**
   ```tsx
   // ✅ Good - use VolumeDisplay
   <VolumeDisplay liters={batch.volumeLiters} />

   // ✅ Good - use VolumeInput
   <VolumeInput value={volumeLiters} onChange={setVolumeLiters} />
   ```

3. **Let Triggers Do the Work**
   ```sql
   -- ✅ Good - triggers auto-set normalized values
   INSERT INTO batches (initial_volume, initial_volume_unit)
   VALUES (189.271, 'L');
   -- initial_volume_liters set automatically
   ```

4. **Use Normalized Fields for Queries**
   ```typescript
   // ✅ Good - sort by normalized field
   const batches = await db
     .select()
     .from(batches)
     .orderBy(desc(batches.currentVolumeLiters));
   ```

5. **Show Both Units for Important Values**
   ```tsx
   // ✅ Good - shows conversion for clarity
   <VolumeDisplay
     liters={tankCapacity}
     showBothUnits
   />
   ```

### ❌ DON'T

1. **Don't Store Converted Values Manually**
   ```typescript
   // ❌ Bad - manual conversion
   const gallons = liters * 0.264172;
   await db.insert(batches).values({
     initialVolume: gallons.toString(),
     initialVolumeUnit: "gal",
   });
   ```

2. **Don't Hardcode Conversion Factors**
   ```typescript
   // ❌ Bad - hardcoded conversion
   const liters = gallons * 3.78541;

   // ✅ Good - use utility function
   const liters = convertToLiters(gallons, "gal");
   ```

3. **Don't Convert Before Passing to Components**
   ```tsx
   // ❌ Bad - converting before passing
   const displayValue = convertFromLiters(liters, preferredUnit);
   <span>{displayValue}</span>

   // ✅ Good - let component handle it
   <VolumeDisplay liters={liters} />
   ```

4. **Don't Query Original Unit Fields for Sorting**
   ```typescript
   // ❌ Bad - inconsistent sorting
   .orderBy(desc(batches.currentVolume))

   // ✅ Good - consistent sorting
   .orderBy(desc(batches.currentVolumeLiters))
   ```

5. **Don't Forget Nullable Fields**
   ```typescript
   // ❌ Bad - might crash on null
   <VolumeDisplay liters={batch.volumeLiters} />

   // ✅ Good - handle null
   {batch.volumeLiters && (
     <VolumeDisplay liters={batch.volumeLiters} />
   )}
   ```

---

## Common Pitfalls

### Pitfall 1: Mixing Units in Calculations

❌ **Problem:**
```typescript
const batch1Volume = 50; // gallons
const batch2Volume = 100; // liters
const totalVolume = batch1Volume + batch2Volume; // Wrong!
```

✅ **Solution:**
```typescript
const batch1Liters = convertToLiters(50, "gal");
const batch2Liters = 100;
const totalVolume = batch1Liters + batch2Liters;
```

### Pitfall 2: Forgetting Triggers Don't Run on Direct SQL

❌ **Problem:**
```sql
-- Triggers won't run on raw SQL updates
UPDATE batches
SET initial_volume = '200'
WHERE id = 'xxx';
-- initial_volume_liters is now out of sync!
```

✅ **Solution:**
```typescript
// Use ORM which properly triggers
await db
  .update(batches)
  .set({
    initialVolume: "200",
    initialVolumeUnit: "L"
  })
  .where(eq(batches.id, batchId));
// Trigger runs automatically
```

### Pitfall 3: Type Coercion Issues

❌ **Problem:**
```typescript
// Database returns string, not number
const volume = batch.initialVolume; // "189.271" (string)
const doubled = volume * 2; // NaN or coerced incorrectly
```

✅ **Solution:**
```typescript
// Use normalized numeric field
const volume = batch.initialVolumeLiters; // 189.271 (number)
const doubled = volume * 2; // 378.542
```

### Pitfall 4: Precision Loss

❌ **Problem:**
```typescript
// Rounding too early
const liters = Math.round(convertToLiters(50, "gal"));
// 189 instead of 189.271
```

✅ **Solution:**
```typescript
// Keep precision, round only for display
const liters = convertToLiters(50, "gal");
// 189.271
// Let display components handle rounding
<VolumeDisplay liters={liters} decimals={2} />
```

### Pitfall 5: Not Handling User Preference Changes

❌ **Problem:**
```typescript
// Component doesn't re-render when preference changes
function MyComponent({ liters }) {
  const preferredUnit = useVolumeUnit();
  const displayValue = convertFromLiters(liters, preferredUnit);

  return <div>{displayValue}</div>;
  // Missing unit label, no formatting
}
```

✅ **Solution:**
```typescript
// Use display component that handles everything
function MyComponent({ liters }) {
  return <VolumeDisplay liters={liters} />;
  // Auto-updates when preferences change
}
```

---

## Migration Guide

### Migrating Existing Code

If you have existing code with hardcoded conversions, follow these steps:

#### Step 1: Identify Hardcoded Conversions

Search for:
```bash
grep -r "3.78541" .  # Gallons to liters
grep -r "0.453592" . # Pounds to kg
grep -r "* 1.8 + 32" # Celsius to Fahrenheit
```

#### Step 2: Replace with Utility Functions

**Before:**
```typescript
const liters = input.volumeUnit === "gal"
  ? input.volume * 3.78541
  : input.volume;
```

**After:**
```typescript
import { convertToLiters } from "lib/src/units/conversions";

const liters = convertToLiters(input.volume, input.volumeUnit);
```

#### Step 3: Update Database Queries

**Before:**
```typescript
const batches = await db
  .select()
  .from(batches)
  .orderBy(desc(batches.currentVolume));
```

**After:**
```typescript
const batches = await db
  .select()
  .from(batches)
  .orderBy(desc(batches.currentVolumeLiters));
```

#### Step 4: Update Display Logic

**Before:**
```tsx
const displayValue = batch.initialVolume;
const displayUnit = batch.initialVolumeUnit;
return <div>{displayValue} {displayUnit}</div>;
```

**After:**
```tsx
return <VolumeDisplay liters={batch.initialVolumeLiters} />;
```

---

## Testing

### Unit Tests

Test conversion functions:

```typescript
import { convertToLiters, convertFromLiters } from "lib/src/units/conversions";

describe("convertToLiters", () => {
  it("converts gallons to liters", () => {
    expect(convertToLiters(1, "gal")).toBeCloseTo(3.78541, 5);
  });

  it("handles liters as identity", () => {
    expect(convertToLiters(100, "L")).toBe(100);
  });
});
```

### Integration Tests

Test complete flow:

```typescript
it("should store and retrieve volumes correctly", async () => {
  // Create with gallons
  const batch = await createBatch({
    volumeGallons: 50,
    volumeUnit: "gal",
  });

  // Retrieve
  const retrieved = await getBatch(batch.id);

  // Should have normalized value
  expect(retrieved.initialVolumeLiters).toBeCloseTo(189.271, 2);
});
```

### E2E Tests

Test user workflows:

```typescript
test("user can create batch with preferred unit", async ({ page }) => {
  // Set preference to gallons
  await page.click('[data-testid="unit-toggle"]');

  // Enter volume
  await page.fill('[data-testid="volume-input"]', '50');

  // Unit selector should show gallons
  await expect(page.locator('[data-testid="unit-selector"]'))
    .toHaveValue('gal');

  // Submit and verify
  await page.click('button[type="submit"]');

  // Should display in gallons
  await expect(page.locator('[data-testid="batch-volume"]'))
    .toContainText('50.00 gal');
});
```

---

## FAQ

### Q: Why store both original and normalized values?

**A:** Original values preserve user intent and provide audit trails. Normalized values enable efficient querying and calculations. Both are needed for a complete solution.

### Q: Can I add custom units?

**A:** Yes! Follow the [Adding a New Unit Type](#adding-a-new-unit-type) guide. You'll need to add conversion functions, update the store, and create display components.

### Q: What happens if triggers fail?

**A:** Database triggers run within the transaction. If a trigger fails, the entire INSERT/UPDATE is rolled back. Check PostgreSQL logs for trigger errors.

### Q: How accurate are the conversions?

**A:** We use standard conversion factors with 5+ decimal precision:
- 1 gal = 3.78541 L (NIST standard)
- 1 lb = 0.453592 kg (exact)
- °F = °C × 9/5 + 32 (exact)

### Q: Can users mix units in the same session?

**A:** Yes! The `UnitToggle` component lets users switch between metric and imperial instantly. All displays update immediately.

### Q: What about localization?

**A:** The system auto-detects locale on first load and sets appropriate defaults (US = imperial, others = metric). Users can override anytime.

---

## Summary

The unit management system provides:

✅ **Type-safe conversions** with utility functions
✅ **Automatic normalization** via database triggers
✅ **User-friendly components** for input and display
✅ **Persistent preferences** across sessions
✅ **Data integrity** with dual storage pattern

### Quick Reference

```typescript
// Conversions
import { convertToLiters, convertFromLiters } from "lib/src/units/conversions";

// User Preferences
import { useVolumeUnit, useUnitPreferences } from "lib/src/stores";

// Components
import {
  VolumeInput,
  VolumeDisplay,
  UnitToggle
} from "@/components/units";

// Usage
<VolumeInput value={liters} onChange={setLiters} label="Volume" />
<VolumeDisplay liters={liters} showBothUnits />
<UnitToggle />
```

For more details, see:
- [Component Documentation](../apps/web/src/components/units/README.md)
- [Conversion Functions](../packages/lib/src/units/README.md)
- [Store Documentation](../packages/lib/src/stores/README.md)
