"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useUnitPreferences } from "lib/src/stores";
import { cn } from "@/lib/utils";

/**
 * UnitToggle Component Props
 */
export interface UnitToggleProps {
  /** Optional CSS class for styling */
  className?: string;
  /** Show labels for units (default: true) */
  showLabels?: boolean;
}

/**
 * UnitToggle Component
 *
 * A small button that toggles between metric and imperial unit systems.
 * Displays current units and switches all at once when clicked.
 *
 * @example
 * ```tsx
 * // In a settings panel or toolbar
 * <UnitToggle />
 * // Shows: "L / kg / °C" (metric) or "gal / lb / °F" (imperial)
 *
 * // Without labels
 * <UnitToggle showLabels={false} />
 * ```
 */
export function UnitToggle({
  className,
  showLabels = true,
}: UnitToggleProps) {
  const { preferences, setVolumeUnit, setWeightUnit, setTemperatureUnit } =
    useUnitPreferences();

  // Determine if currently using metric or imperial
  const isMetric = React.useMemo(() => {
    return (
      preferences.volume === "L" &&
      preferences.weight === "kg" &&
      preferences.temperature === "C"
    );
  }, [preferences]);

  const isImperial = React.useMemo(() => {
    return (
      preferences.volume === "gal" &&
      preferences.weight === "lb" &&
      preferences.temperature === "F"
    );
  }, [preferences]);

  // Toggle between metric and imperial
  const handleToggle = () => {
    if (isMetric) {
      // Switch to imperial
      setVolumeUnit("gal");
      setWeightUnit("lb");
      setTemperatureUnit("F");
    } else {
      // Switch to metric (or standardize mixed units)
      setVolumeUnit("L");
      setWeightUnit("kg");
      setTemperatureUnit("C");
    }
  };

  // Build display text
  const displayText = React.useMemo(() => {
    const units = `${preferences.volume} / ${preferences.weight} / °${preferences.temperature}`;

    if (!showLabels) {
      return units;
    }

    if (isMetric) {
      return `Metric: ${units}`;
    } else if (isImperial) {
      return `Imperial: ${units}`;
    } else {
      return `Mixed: ${units}`;
    }
  }, [preferences, showLabels, isMetric, isImperial]);

  // Determine button appearance based on current system
  const getButtonVariant = () => {
    if (isMetric || isImperial) {
      return "outline";
    }
    return "secondary"; // Mixed units get different styling
  };

  return (
    <Button
      variant={getButtonVariant()}
      size="sm"
      onClick={handleToggle}
      className={cn("font-mono text-xs", className)}
      aria-label={`Toggle units. Current: ${displayText}`}
      title="Click to toggle between metric and imperial units"
    >
      {displayText}
    </Button>
  );
}

/**
 * Compact version that shows only the unit symbols
 */
export function CompactUnitToggle({ className }: { className?: string }) {
  return <UnitToggle className={className} showLabels={false} />;
}
