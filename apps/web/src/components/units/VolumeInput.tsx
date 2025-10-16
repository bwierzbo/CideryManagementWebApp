"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  convertToLiters,
  convertFromLiters,
  type VolumeUnit,
} from "lib/src/units/conversions";
import { useVolumeUnit } from "lib/src/stores";

/**
 * VolumeInput Component Props
 *
 * A reusable input component for volume values with automatic unit conversion.
 * Stores value internally in liters (base unit) and converts for display.
 */
export interface VolumeInputProps {
  /** Volume value in liters (base unit) */
  value: number;
  /** Callback when volume changes, receives value in liters */
  onChange: (liters: number) => void;
  /** Optional label to display above the input */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Optional error message to display below the input */
  error?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional input id for accessibility */
  id?: string;
  /** Optional input name for forms */
  name?: string;
  /** Optional CSS class for the container */
  className?: string;
}

/**
 * VolumeInput Component
 *
 * A smart volume input that:
 * - Stores values in liters internally
 * - Displays in user's preferred unit (from store)
 * - Auto-converts between units
 * - Supports Liters, Gallons, and Milliliters
 *
 * @example
 * ```tsx
 * <VolumeInput
 *   value={batchVolumeLiters}
 *   onChange={(liters) => setBatchVolume(liters)}
 *   label="Batch Volume"
 *   required
 *   error={errors.volume?.message}
 * />
 * ```
 */
export function VolumeInput({
  value,
  onChange,
  label,
  disabled = false,
  error,
  required = false,
  placeholder = "0.00",
  id,
  name,
  className,
}: VolumeInputProps) {
  // Get user's preferred volume unit from store
  const preferredUnit = useVolumeUnit();

  // Track selected unit (defaults to user preference)
  const [selectedUnit, setSelectedUnit] = React.useState<VolumeUnit>(
    preferredUnit,
  );

  // Update selected unit when user preference changes
  React.useEffect(() => {
    setSelectedUnit(preferredUnit);
  }, [preferredUnit]);

  // Convert liters to display unit
  const displayValue = React.useMemo(
    () => convertFromLiters(value, selectedUnit),
    [value, selectedUnit],
  );

  // Handle value change in the input field
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow empty input
    if (inputValue === "") {
      onChange(0);
      return;
    }

    // Parse the numeric value
    const numericValue = parseFloat(inputValue);

    // Validate numeric input
    if (isNaN(numericValue)) {
      return;
    }

    // Convert to liters before calling onChange
    const liters = convertToLiters(numericValue, selectedUnit);
    onChange(liters);
  };

  // Handle unit change
  const handleUnitChange = (newUnit: string) => {
    setSelectedUnit(newUnit as VolumeUnit);
    // Value stays the same in liters, just changes display
  };

  // Generate unique ID if not provided
  const inputId = id || React.useId();

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}

      {/* Input and Unit Selector */}
      <div className="flex gap-2">
        {/* Numeric Input (70% width) */}
        <Input
          id={inputId}
          name={name}
          type="number"
          value={displayValue.toFixed(3)}
          onChange={handleValueChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          min={0}
          step={0.001}
          className={cn(
            "flex-[7]",
            error && "border-destructive focus-visible:ring-destructive",
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />

        {/* Unit Selector (30% width) */}
        <Select
          value={selectedUnit}
          onValueChange={handleUnitChange}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              "flex-[3]",
              error && "border-destructive focus-visible:ring-destructive",
            )}
            aria-label="Volume unit"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L">Liters</SelectItem>
            <SelectItem value="gal">Gallons</SelectItem>
            <SelectItem value="mL">Milliliters</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error Message */}
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
