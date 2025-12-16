"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";

// Conversion constants
const KG_TO_LB = 2.20462;
const LB_TO_KG = 1 / KG_TO_LB;

export type WeightUnit = "kg" | "lb" | "lbs";

interface WeightDisplayProps {
  /** Weight value in kg (internal standard unit) */
  weightKg: number;
  /** Original unit the weight was entered in */
  originalUnit?: WeightUnit;
  /** Number of decimal places to show */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
  /** If true, show the unit after the number */
  showUnit?: boolean;
  /** Callback when unit is toggled - useful for parent components tracking state */
  onToggle?: (newUnit: WeightUnit) => void;
  /** Externally controlled display unit (for row-level toggling) */
  displayUnit?: WeightUnit;
}

/**
 * Converts weight from kg to the target unit
 */
export function convertWeight(weightKg: number, targetUnit: WeightUnit): number {
  if (targetUnit === "lb" || targetUnit === "lbs") {
    return weightKg * KG_TO_LB;
  }
  return weightKg;
}

/**
 * Converts weight from any unit to kg
 */
export function toKg(weight: number, fromUnit: WeightUnit): number {
  if (fromUnit === "lb" || fromUnit === "lbs") {
    return weight * LB_TO_KG;
  }
  return weight;
}

/**
 * Normalizes unit string to standard format
 */
export function normalizeUnit(unit: string | undefined): WeightUnit {
  if (!unit) return "kg";
  const lower = unit.toLowerCase();
  if (lower === "lb" || lower === "lbs" || lower === "pound" || lower === "pounds") {
    return "lb";
  }
  return "kg";
}

/**
 * Formats unit for display (lb becomes "lbs" for readability)
 */
export function formatUnit(unit: WeightUnit): string {
  if (unit === "lb" || unit === "lbs") return "lbs";
  return "kg";
}

/**
 * WeightDisplay component - shows weight with hover-to-toggle functionality
 *
 * Features:
 * - Displays weight in original unit by default
 * - Hover shows toggle indicator
 * - Click toggles between kg and lb
 * - Can be controlled externally for row-level toggling
 */
export function WeightDisplay({
  weightKg,
  originalUnit = "kg",
  decimals = 1,
  className,
  showUnit = true,
  onToggle,
  displayUnit: externalDisplayUnit,
}: WeightDisplayProps) {
  const normalized = normalizeUnit(originalUnit);
  const [internalDisplayUnit, setInternalDisplayUnit] = useState<WeightUnit>(normalized);

  // Use external unit if provided, otherwise use internal state
  const displayUnit = externalDisplayUnit ?? internalDisplayUnit;

  const handleToggle = () => {
    const newUnit: WeightUnit = displayUnit === "kg" ? "lb" : "kg";
    if (onToggle) {
      onToggle(newUnit);
    } else {
      setInternalDisplayUnit(newUnit);
    }
  };

  const displayValue = convertWeight(weightKg, displayUnit);
  const formattedValue = displayValue.toFixed(decimals);
  const unitLabel = formatUnit(displayUnit);

  return (
    <span
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors group",
        className
      )}
      title={`Click to toggle between kg and lbs`}
    >
      <span>{formattedValue}</span>
      {showUnit && <span className="text-gray-500">{unitLabel}</span>}
      <ArrowLeftRight className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}

/**
 * Hook for managing weight unit toggle state at the row/group level
 * Returns the current display unit and a toggle function
 */
export function useWeightUnitToggle(initialUnit: WeightUnit = "kg") {
  const [displayUnit, setDisplayUnit] = useState<WeightUnit>(normalizeUnit(initialUnit));

  const toggle = () => {
    setDisplayUnit((prev) => (prev === "kg" ? "lb" : "kg"));
  };

  return { displayUnit, toggle, setDisplayUnit };
}
