# Units Components

Smart input and display components with automatic unit conversion and user preference integration.

## Quick Links

- [VolumeInput](./README.md#volumeinput) - Editable input for volumes
- [VolumeDisplay](#volumedisplay) - Read-only volume display
- [WeightDisplay](#weightdisplay) - Read-only weight display
- [TemperatureDisplay](#temperaturedisplay) - Read-only temperature display
- [UnitToggle](#unittoggle) - Toggle between metric/imperial
- [Full Display Components Documentation](./DISPLAY_COMPONENTS.md)

---

## VolumeInput

A reusable volume input component that:
- Stores values in liters (base unit) internally
- Displays in user's preferred unit from `useUnitPreferences` store
- Auto-converts between Liters, Gallons, and Milliliters
- Integrates with shadcn/ui styling
- Includes validation and error display
- Fully accessible with proper ARIA attributes

### Props

```typescript
interface VolumeInputProps {
  value: number;              // Always in liters (base unit)
  onChange: (liters: number) => void;
  label?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
}
```

### Basic Usage

```tsx
import { VolumeInput } from "@/components/units";

function BatchForm() {
  const [volumeLiters, setVolumeLiters] = useState(189.271); // 50 gallons

  return (
    <VolumeInput
      value={volumeLiters}
      onChange={setVolumeLiters}
      label="Batch Volume"
      required
    />
  );
}
```

### With React Hook Form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VolumeInput } from "@/components/units";

const schema = z.object({
  volumeLiters: z.number().positive("Volume must be positive"),
});

type FormData = z.infer<typeof schema>;

function BatchForm() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      volumeLiters: 0,
    },
  });

  const volumeLiters = watch("volumeLiters");

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <VolumeInput
        value={volumeLiters}
        onChange={(liters) => setValue("volumeLiters", liters)}
        label="Batch Volume"
        required
        error={errors.volumeLiters?.message}
      />
    </form>
  );
}
```

### With API Integration

```tsx
import { VolumeInput } from "@/components/units";
import { trpc } from "@/lib/trpc";

function CreateBatchDialog() {
  const [volumeLiters, setVolumeLiters] = useState(0);

  const createBatch = trpc.batch.create.useMutation();

  const handleSubmit = () => {
    // volumeLiters is already in the correct unit (liters)
    createBatch.mutate({
      initialVolume: volumeLiters.toString(),
      initialVolumeUnit: "L",
      // ... other fields
    });
  };

  return (
    <div>
      <VolumeInput
        value={volumeLiters}
        onChange={setVolumeLiters}
        label="Initial Volume"
        required
        error={createBatch.error?.message}
        disabled={createBatch.isPending}
      />
      <button onClick={handleSubmit}>Create Batch</button>
    </div>
  );
}
```

### Features

#### Automatic Unit Preference

The component automatically uses the user's preferred volume unit from the store:

```tsx
// User has set preference to gallons
<VolumeInput value={189.271} onChange={setVolume} />
// Displays: "50.000 gal" in the input

// User switches preference to liters
// Displays: "189.271 L" in the input
// Value prop (189.271) remains unchanged
```

#### Manual Unit Selection

Users can manually change the display unit using the dropdown:

```tsx
<VolumeInput value={100} onChange={setVolume} />
// User can select between:
// - Liters: "100.000 L"
// - Gallons: "26.417 gal"
// - Milliliters: "100000.000 mL"
```

#### Layout

```
┌─────────────────────────────────┐
│ Batch Volume *                  │ ← Label with required asterisk
├───────────────────┬─────────────┤
│ 50.000           │ Gallons   ▼ │ ← Input (70%) + Unit selector (30%)
├───────────────────┴─────────────┤
│ Volume must be positive         │ ← Error message (if provided)
└─────────────────────────────────┘
```

#### Validation

```tsx
<VolumeInput
  value={volumeLiters}
  onChange={setVolumeLiters}
  error="Volume must be greater than zero"
/>
// Shows red border and error message below
```

#### Disabled State

```tsx
<VolumeInput
  value={volumeLiters}
  onChange={setVolumeLiters}
  disabled={isSubmitting}
/>
// Both input and unit selector are disabled
```

### Accessibility

The component includes proper accessibility attributes:

- `aria-label` on unit selector
- `aria-invalid` on input when error is present
- `aria-describedby` linking input to error message
- `role="alert"` on error message
- Unique IDs generated with `React.useId()`
- Required field indicator in label

### Styling

The component uses shadcn/ui components and follows Tailwind conventions:

- Integrates with your theme colors
- Responsive layout (flex-based)
- Error states use `destructive` color variant
- Consistent with other shadcn/ui form components

### Data Flow

```
User inputs "50" with unit "gal"
         ↓
Component converts: 50 gal → 189.271 L
         ↓
onChange(189.271) called
         ↓
Parent receives liters
         ↓
Store in database as: { volume: "189.271", unit: "L" }
```

### Best Practices

1. **Always store in liters**: The component handles conversion, so always work with liters in your state and database.

2. **Use with normalized columns**: Pairs perfectly with the database normalized volume columns:
   ```typescript
   // Database has both display and normalized values
   {
     initialVolume: "50",
     initialVolumeUnit: "gal",
     initialVolumeLiters: "189.271"  // Auto-maintained by trigger
   }
   ```

3. **Combine with formatVolume**: For display-only values, use the formatting function:
   ```tsx
   import { formatVolume } from "lib/src/units";
   const volumeUnit = useVolumeUnit();

   // For display only
   <div>{formatVolume(batch.volumeLiters, volumeUnit, 2)}</div>

   // For editable input
   <VolumeInput value={batch.volumeLiters} onChange={handleChange} />
   ```

### TypeScript

Full TypeScript support with exported types:

```typescript
import type { VolumeInputProps } from "@/components/units";
```

### Testing

The component can be tested like any React component:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { VolumeInput } from "@/components/units";

test("converts gallons to liters", () => {
  const handleChange = vi.fn();

  render(
    <VolumeInput value={0} onChange={handleChange} />
  );

  // User enters 50 gallons
  const input = screen.getByRole("spinbutton");
  fireEvent.change(input, { target: { value: "50" } });

  // Should convert to liters (50 gal ≈ 189.271 L)
  expect(handleChange).toHaveBeenCalledWith(expect.closeTo(189.271, 2));
});
```

---

## VolumeDisplay

Read-only display component for volumes. Automatically shows in user's preferred unit.

```tsx
import { VolumeDisplay } from "@/components/units";

<VolumeDisplay liters={189.271} />
// Shows: "50.00 gal" or "189.27 L" (based on preference)

<VolumeDisplay liters={189.271} showBothUnits />
// Shows: "50.00 gal (189.27 L)"
```

### Props
- `liters: number` - Volume in liters (base unit)
- `showUnit?: boolean` - Show unit label (default: true)
- `decimals?: number` - Decimal places (default: 2)
- `showBothUnits?: boolean` - Show conversion in parentheses
- `className?: string` - Custom CSS classes

---

## WeightDisplay

Read-only display component for weights. Automatically shows in user's preferred unit.

```tsx
import { WeightDisplay } from "@/components/units";

<WeightDisplay kg={453.592} />
// Shows: "1000.00 lb" or "453.59 kg" (based on preference)

<WeightDisplay kg={453.592} showBothUnits />
// Shows: "1000.00 lb (453.59 kg)"
```

### Props
- `kg: number` - Weight in kilograms (base unit)
- `showUnit?: boolean` - Show unit label (default: true)
- `decimals?: number` - Decimal places (default: 2)
- `showBothUnits?: boolean` - Show conversion in parentheses
- `className?: string` - Custom CSS classes

---

## TemperatureDisplay

Read-only display component for temperatures. Automatically shows in user's preferred unit.

```tsx
import { TemperatureDisplay } from "@/components/units";

<TemperatureDisplay celsius={20} />
// Shows: "68.0°F" or "20.0°C" (based on preference)

<TemperatureDisplay celsius={20} showBothUnits />
// Shows: "68.0°F (20.0°C)"
```

### Props
- `celsius: number` - Temperature in Celsius (base unit)
- `showUnit?: boolean` - Show unit label (default: true)
- `decimals?: number` - Decimal places (default: 1)
- `showBothUnits?: boolean` - Show conversion in parentheses
- `className?: string` - Custom CSS classes

---

## UnitToggle

Button component to quickly toggle between metric and imperial unit systems.

```tsx
import { UnitToggle, CompactUnitToggle } from "@/components/units";

// Full version with labels
<UnitToggle />
// Shows: "Metric: L / kg / °C" or "Imperial: gal / lb / °F"

// Compact version
<CompactUnitToggle />
// Shows: "L / kg / °C" or "gal / lb / °F"
```

### Props
- `className?: string` - Custom CSS classes
- `showLabels?: boolean` - Show system labels (default: true)

### Features
- Click to toggle between metric and imperial
- Shows "Metric", "Imperial", or "Mixed" based on current preferences
- Visual feedback for different unit systems
- Accessible with ARIA labels

---

## Complete Example

```tsx
import {
  VolumeInput,
  VolumeDisplay,
  WeightDisplay,
  TemperatureDisplay,
  UnitToggle,
} from "@/components/units";

function BatchCard({ batch, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [volumeLiters, setVolumeLiters] = useState(batch.volumeLiters);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{batch.name}</CardTitle>
        <UnitToggle />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Editable volume */}
          <div>
            <Label>Volume</Label>
            {isEditing ? (
              <VolumeInput
                value={volumeLiters}
                onChange={setVolumeLiters}
              />
            ) : (
              <VolumeDisplay
                liters={batch.volumeLiters}
                showBothUnits
                className="text-lg"
              />
            )}
          </div>

          {/* Read-only displays */}
          <div>
            <Label>Weight</Label>
            <WeightDisplay
              kg={batch.weightKg}
              className="text-lg"
            />
          </div>

          <div>
            <Label>Temperature</Label>
            <TemperatureDisplay
              celsius={batch.tempCelsius}
              className="text-lg"
            />
          </div>
        </div>

        <Button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "Save" : "Edit"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## When to Use Each Component

### Use VolumeInput when:
- User needs to enter or edit volume values
- Forms and dialogs
- Creating or updating records

### Use VolumeDisplay when:
- Showing read-only volume data
- Tables and lists
- Detail views
- Cards and summaries

### Use UnitToggle when:
- Page has many measurements
- Settings panels
- User preferences sections
- Toolbars and headers

---

## See Also

- [Full Display Components Documentation](./DISPLAY_COMPONENTS.md) - Detailed docs for all display components
- [VolumeInput Examples](./VolumeInput.example.tsx) - Input component examples
- [Display Examples](./DisplayComponents.example.tsx) - Display component examples

