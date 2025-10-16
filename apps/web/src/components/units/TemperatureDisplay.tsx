"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  convertFromCelsius,
  formatTemperature,
  type TemperatureUnit,
} from "lib/src/units/conversions";
import { useTemperatureUnit } from "lib/src/stores";

/**
 * TemperatureDisplay Component Props
 *
 * A display-only component that shows temperature in the user's preferred unit.
 */
export interface TemperatureDisplayProps {
  /** Temperature value in Celsius (base unit) */
  celsius: number;
  /** Whether to show the unit label (default: true) */
  showUnit?: boolean;
  /** Number of decimal places to display (default: 1) */
  decimals?: number;
  /** Optional CSS class for styling */
  className?: string;
  /** Show both user's preferred unit and conversion (e.g., "68°F (20°C)") */
  showBothUnits?: boolean;
}

/**
 * TemperatureDisplay Component
 *
 * Displays a temperature value in the user's preferred unit with automatic conversion.
 * Values are stored in Celsius and converted for display.
 *
 * @example
 * ```tsx
 * // Simple display
 * <TemperatureDisplay celsius={20} />
 * // Shows: "68.0°F" (if user prefers Fahrenheit)
 *
 * // With both units
 * <TemperatureDisplay celsius={20} showBothUnits />
 * // Shows: "68.0°F (20.0°C)"
 *
 * // Without unit label
 * <TemperatureDisplay celsius={20} showUnit={false} decimals={0} />
 * // Shows: "68"
 * ```
 */
export function TemperatureDisplay({
  celsius,
  showUnit = true,
  decimals = 1,
  className,
  showBothUnits = false,
}: TemperatureDisplayProps) {
  // Get user's preferred temperature unit
  const preferredUnit = useTemperatureUnit();

  // Convert to preferred unit
  const displayValue = React.useMemo(
    () => convertFromCelsius(celsius, preferredUnit),
    [celsius, preferredUnit],
  );

  // Format the primary value
  const formattedValue = displayValue.toFixed(decimals);

  // If showing both units, format the conversion
  const conversion = React.useMemo(() => {
    if (!showBothUnits || preferredUnit === "C") {
      return null;
    }

    // Show Celsius as the conversion
    const celsiusValue = celsius.toFixed(decimals);
    return `${celsiusValue}°C`;
  }, [showBothUnits, preferredUnit, celsius, decimals]);

  return (
    <span className={cn("tabular-nums", className)}>
      {formattedValue}
      {showUnit && (
        <span className="text-muted-foreground">°{preferredUnit}</span>
      )}
      {conversion && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({conversion})
        </span>
      )}
    </span>
  );
}

/**
 * Helper function to format temperature without a component
 *
 * @param celsius - Temperature in Celsius
 * @param unit - Unit to display in
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatTemperatureDisplay(20, 'F', 1) // "68.0°F"
 * ```
 */
export function formatTemperatureDisplay(
  celsius: number,
  unit: TemperatureUnit,
  decimals: number = 1,
): string {
  return formatTemperature(celsius, unit, decimals);
}
