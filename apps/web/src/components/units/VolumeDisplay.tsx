"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  convertFromLiters,
  formatVolume,
  type VolumeUnit,
} from "lib/src/units/conversions";
import { useVolumeUnit } from "lib/src/stores";

/**
 * VolumeDisplay Component Props
 *
 * A display-only component that shows volume in the user's preferred unit.
 */
export interface VolumeDisplayProps {
  /** Volume value in liters (base unit) */
  liters: number;
  /** Whether to show the unit label (default: true) */
  showUnit?: boolean;
  /** Number of decimal places to display (default: 2) */
  decimals?: number;
  /** Optional CSS class for styling */
  className?: string;
  /** Show both user's preferred unit and conversion (e.g., "100 gal (378.54 L)") */
  showBothUnits?: boolean;
}

/**
 * VolumeDisplay Component
 *
 * Displays a volume value in the user's preferred unit with automatic conversion.
 * Values are stored in liters and converted for display.
 *
 * @example
 * ```tsx
 * // Simple display
 * <VolumeDisplay liters={189.271} />
 * // Shows: "50.00 gal" (if user prefers gallons)
 *
 * // With both units
 * <VolumeDisplay liters={189.271} showBothUnits />
 * // Shows: "50.00 gal (189.27 L)"
 *
 * // Without unit label
 * <VolumeDisplay liters={100} showUnit={false} decimals={1} />
 * // Shows: "100.0"
 * ```
 */
export function VolumeDisplay({
  liters,
  showUnit = true,
  decimals = 2,
  className,
  showBothUnits = false,
}: VolumeDisplayProps) {
  // Get user's preferred volume unit
  const preferredUnit = useVolumeUnit();

  // Convert to preferred unit
  const displayValue = React.useMemo(
    () => convertFromLiters(liters, preferredUnit),
    [liters, preferredUnit],
  );

  // Format the primary value
  const formattedValue = displayValue.toFixed(decimals);

  // If showing both units, format the conversion
  const conversion = React.useMemo(() => {
    if (!showBothUnits || preferredUnit === "L") {
      return null;
    }

    // Show liters as the conversion
    const litersValue = liters.toFixed(decimals);
    return `${litersValue} L`;
  }, [showBothUnits, preferredUnit, liters, decimals]);

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
 * Helper function to format volume without a component
 *
 * @param liters - Volume in liters
 * @param unit - Unit to display in
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatVolumeDisplay(189.271, 'gal', 2) // "50.00 gal"
 * ```
 */
export function formatVolumeDisplay(
  liters: number,
  unit: VolumeUnit,
  decimals: number = 2,
): string {
  return formatVolume(liters, unit, decimals);
}
