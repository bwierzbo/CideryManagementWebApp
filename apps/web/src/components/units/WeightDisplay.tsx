"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  convertFromKg,
  formatWeight,
  type WeightUnit,
} from "lib/src/units/conversions";
import { useWeightUnit } from "lib/src/stores";

/**
 * WeightDisplay Component Props
 *
 * A display-only component that shows weight in the user's preferred unit.
 */
export interface WeightDisplayProps {
  /** Weight value in kilograms (base unit) */
  kg: number;
  /** Whether to show the unit label (default: true) */
  showUnit?: boolean;
  /** Number of decimal places to display (default: 2) */
  decimals?: number;
  /** Optional CSS class for styling */
  className?: string;
  /** Show both user's preferred unit and conversion (e.g., "220 lb (100.00 kg)") */
  showBothUnits?: boolean;
}

/**
 * WeightDisplay Component
 *
 * Displays a weight value in the user's preferred unit with automatic conversion.
 * Values are stored in kilograms and converted for display.
 *
 * @example
 * ```tsx
 * // Simple display
 * <WeightDisplay kg={453.592} />
 * // Shows: "1000.00 lb" (if user prefers pounds)
 *
 * // With both units
 * <WeightDisplay kg={453.592} showBothUnits />
 * // Shows: "1000.00 lb (453.59 kg)"
 *
 * // Without unit label
 * <WeightDisplay kg={100} showUnit={false} decimals={1} />
 * // Shows: "100.0"
 * ```
 */
export function WeightDisplay({
  kg,
  showUnit = true,
  decimals = 2,
  className,
  showBothUnits = false,
}: WeightDisplayProps) {
  // Get user's preferred weight unit
  const preferredUnit = useWeightUnit();

  // Convert to preferred unit
  const displayValue = React.useMemo(
    () => convertFromKg(kg, preferredUnit),
    [kg, preferredUnit],
  );

  // Format the primary value
  const formattedValue = displayValue.toFixed(decimals);

  // If showing both units, format the conversion
  const conversion = React.useMemo(() => {
    if (!showBothUnits || preferredUnit === "kg") {
      return null;
    }

    // Show kg as the conversion
    const kgValue = kg.toFixed(decimals);
    return `${kgValue} kg`;
  }, [showBothUnits, preferredUnit, kg, decimals]);

  return (
    <span className={cn("tabular-nums", className)}>
      {formattedValue}
      {showUnit && (
        <span className="ml-1 text-muted-foreground">{preferredUnit}</span>
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
 * Helper function to format weight without a component
 *
 * @param kg - Weight in kilograms
 * @param unit - Unit to display in
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatWeightDisplay(453.592, 'lb', 2) // "1000.00 lb"
 * ```
 */
export function formatWeightDisplay(
  kg: number,
  unit: WeightUnit,
  decimals: number = 2,
): string {
  return formatWeight(kg, unit, decimals);
}
