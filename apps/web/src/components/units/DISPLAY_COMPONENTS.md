# Display Components

Read-only display components that automatically show values in the user's preferred units.

## Overview

These components are designed for displaying values (not editing). They:
- Automatically use the user's preferred units from the store
- Support showing both primary and conversion units
- Are fully typed with TypeScript
- Use consistent styling with shadcn/ui
- Include tabular numbers for better alignment in tables

## VolumeDisplay

Display volume in user's preferred unit (Liters, Gallons, or Milliliters).

### Props

```typescript
interface VolumeDisplayProps {
  liters: number;              // Always receives base unit (liters)
  showUnit?: boolean;          // Show unit label (default: true)
  decimals?: number;           // Decimal places (default: 2)
  className?: string;          // Custom CSS classes
  showBothUnits?: boolean;     // Show conversion in parentheses
}
```

### Examples

```tsx
import { VolumeDisplay } from "@/components/units";

// Basic usage
<VolumeDisplay liters={189.271} />
// If user prefers gallons: "50.00 gal"
// If user prefers liters: "189.27 L"

// With both units
<VolumeDisplay liters={189.271} showBothUnits />
// Shows: "50.00 gal (189.27 L)"

// Custom precision
<VolumeDisplay liters={189.271} decimals={3} />
// Shows: "50.000 gal"

// Without unit label (for charts/tables)
<VolumeDisplay liters={100} showUnit={false} />
// Shows: "100.00"

// With custom styling
<VolumeDisplay
  liters={189.271}
  className="text-lg font-bold text-green-600"
/>
```

## WeightDisplay

Display weight in user's preferred unit (Kilograms or Pounds).

### Props

```typescript
interface WeightDisplayProps {
  kg: number;                  // Always receives base unit (kg)
  showUnit?: boolean;          // Show unit label (default: true)
  decimals?: number;           // Decimal places (default: 2)
  className?: string;          // Custom CSS classes
  showBothUnits?: boolean;     // Show conversion in parentheses
}
```

### Examples

```tsx
import { WeightDisplay } from "@/components/units";

// Basic usage
<WeightDisplay kg={453.592} />
// If user prefers pounds: "1000.00 lb"
// If user prefers kg: "453.59 kg"

// With both units
<WeightDisplay kg={453.592} showBothUnits />
// Shows: "1000.00 lb (453.59 kg)"

// Apple harvest weight
<WeightDisplay kg={1000} decimals={0} />
// Shows: "2205 lb" or "1000 kg"
```

## TemperatureDisplay

Display temperature in user's preferred unit (Celsius or Fahrenheit).

### Props

```typescript
interface TemperatureDisplayProps {
  celsius: number;             // Always receives base unit (Celsius)
  showUnit?: boolean;          // Show unit label (default: true)
  decimals?: number;           // Decimal places (default: 1)
  className?: string;          // Custom CSS classes
  showBothUnits?: boolean;     // Show conversion in parentheses
}
```

### Examples

```tsx
import { TemperatureDisplay } from "@/components/units";

// Basic usage
<TemperatureDisplay celsius={20} />
// If user prefers Fahrenheit: "68.0°F"
// If user prefers Celsius: "20.0°C"

// With both units
<TemperatureDisplay celsius={20} showBothUnits />
// Shows: "68.0°F (20.0°C)"

// No decimals
<TemperatureDisplay celsius={20} decimals={0} />
// Shows: "68°F"

// Fermentation temperature
<TemperatureDisplay celsius={18} className="text-blue-600" />
```

## UnitToggle

Button component to quickly toggle between metric and imperial unit systems.

### Props

```typescript
interface UnitToggleProps {
  className?: string;          // Custom CSS classes
  showLabels?: boolean;        // Show system labels (default: true)
}
```

### Examples

```tsx
import { UnitToggle, CompactUnitToggle } from "@/components/units";

// Full toggle with labels
<UnitToggle />
// Shows: "Metric: L / kg / °C" or "Imperial: gal / lb / °F"
// Click to toggle between systems

// Compact version (no labels)
<CompactUnitToggle />
// Shows: "L / kg / °C" or "gal / lb / °F"

// In a card header
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>Batch Details</CardTitle>
  <UnitToggle />
</CardHeader>

// In a toolbar
<div className="flex items-center gap-2">
  <span>Units:</span>
  <CompactUnitToggle />
</div>
```

### Behavior

- **Click to toggle**: Switches between metric (L/kg/°C) and imperial (gal/lb/°F)
- **Smart detection**: Shows "Metric", "Imperial", or "Mixed" based on current preferences
- **Visual feedback**: Different button variants for pure vs mixed unit systems
- **Accessibility**: Proper ARIA labels and title attributes

## Usage in Tables

Display components work great in tables with automatic alignment:

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Batch</TableHead>
      <TableHead className="text-right">Volume</TableHead>
      <TableHead className="text-right">Weight</TableHead>
      <TableHead className="text-right">Temp</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {batches.map((batch) => (
      <TableRow key={batch.id}>
        <TableCell>{batch.name}</TableCell>
        <TableCell className="text-right">
          <VolumeDisplay liters={batch.volumeLiters} />
        </TableCell>
        <TableCell className="text-right">
          <WeightDisplay kg={batch.weightKg} />
        </TableCell>
        <TableCell className="text-right">
          <TemperatureDisplay celsius={batch.tempCelsius} />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Real-world Example: Batch Details Card

```tsx
function BatchDetailsCard({ batch }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{batch.name}</CardTitle>
        <CompactUnitToggle />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Volume</p>
            <p className="text-lg font-semibold">
              <VolumeDisplay
                liters={batch.volumeLiters}
                showBothUnits
              />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Weight</p>
            <p className="text-lg font-semibold">
              <WeightDisplay
                kg={batch.weightKg}
                showBothUnits
              />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Temperature</p>
            <p className="text-lg font-semibold">
              <TemperatureDisplay
                celsius={batch.tempCelsius}
              />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Helper Functions

All display components also export helper functions for formatting without JSX:

```typescript
import {
  formatVolumeDisplay,
  formatWeightDisplay,
  formatTemperatureDisplay,
} from "@/components/units";

// For use in non-React contexts
const volumeText = formatVolumeDisplay(189.271, 'gal', 2);
// "50.00 gal"

const weightText = formatWeightDisplay(453.592, 'lb', 0);
// "1000 lb"

const tempText = formatTemperatureDisplay(20, 'F', 1);
// "68.0°F"
```

## Styling Features

### Tabular Numbers

All display components use `tabular-nums` class for better alignment:

```tsx
<div className="space-y-2">
  <VolumeDisplay liters={9.5} />
  <VolumeDisplay liters={99.5} />
  <VolumeDisplay liters={999.5} />
</div>
// Numbers align vertically
```

### Muted Unit Labels

Unit labels use `text-muted-foreground` for subtle appearance:

```tsx
<VolumeDisplay liters={100} />
// Renders: "100.00" (dark) "L" (muted)
```

### Consistent Spacing

- Primary value and unit: `ml-1` spacing
- Conversion in parentheses: `ml-1 text-xs` spacing

## Best Practices

### 1. Always Use Base Units

Store and pass values in base units (liters, kg, Celsius):

```tsx
// ✅ Good
<VolumeDisplay liters={batch.volumeLiters} />

// ❌ Bad - don't convert before passing
<VolumeDisplay liters={convertToLiters(batch.volume, batch.unit)} />
```

### 2. Use `showBothUnits` for Important Values

Show conversions for critical measurements:

```tsx
// Tank capacity (important to see both)
<VolumeDisplay liters={tankCapacityLiters} showBothUnits />

// Minor measurements (single unit is fine)
<VolumeDisplay liters={lossVolumeLiters} />
```

### 3. Pair with UnitToggle

Add UnitToggle to pages with many measurements:

```tsx
<div className="flex justify-between items-center mb-4">
  <h2>Batch List</h2>
  <UnitToggle />
</div>
```

### 4. Match Precision to Context

- Volumes: 2-3 decimals for precision
- Weights: 0-2 decimals (often 0 for harvests)
- Temperatures: 1 decimal for fermentation

```tsx
<VolumeDisplay liters={189.271} decimals={2} />  // 50.00 gal
<WeightDisplay kg={1000} decimals={0} />         // 2205 lb
<TemperatureDisplay celsius={18} decimals={1} /> // 64.4°F
```

## Integration with Input Components

Display and input components work together seamlessly:

```tsx
function BatchForm() {
  const [isEditing, setIsEditing] = useState(false);
  const [volumeLiters, setVolumeLiters] = useState(189.271);

  return (
    <div>
      {isEditing ? (
        <VolumeInput
          value={volumeLiters}
          onChange={setVolumeLiters}
          label="Volume"
        />
      ) : (
        <div>
          <Label>Volume</Label>
          <VolumeDisplay liters={volumeLiters} showBothUnits />
        </div>
      )}
      <Button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? "Save" : "Edit"}
      </Button>
    </div>
  );
}
```

## TypeScript

All components are fully typed:

```typescript
import type {
  VolumeDisplayProps,
  WeightDisplayProps,
  TemperatureDisplayProps,
  UnitToggleProps,
} from "@/components/units";
```
