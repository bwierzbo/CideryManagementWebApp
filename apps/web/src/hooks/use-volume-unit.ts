"use client";

import { useState, useEffect, useCallback } from "react";

export type VolumeUnit = "L" | "gal";

const LITERS_PER_GALLON = 3.78541;
const STORAGE_KEY = "cidery-volume-unit";

/**
 * Hook for managing volume unit preference (liters vs gallons)
 * Persists preference to localStorage
 */
export function useVolumeUnit() {
  const [unit, setUnitState] = useState<VolumeUnit>("L");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "L" || stored === "gal") {
      setUnitState(stored);
    }
    setIsLoaded(true);
  }, []);

  // Save preference to localStorage
  const setUnit = useCallback((newUnit: VolumeUnit) => {
    setUnitState(newUnit);
    localStorage.setItem(STORAGE_KEY, newUnit);
  }, []);

  // Toggle between units
  const toggleUnit = useCallback(() => {
    setUnit(unit === "L" ? "gal" : "L");
  }, [unit, setUnit]);

  // Convert liters to current unit
  const convert = useCallback(
    (liters: number): number => {
      if (unit === "gal") {
        return liters / LITERS_PER_GALLON;
      }
      return liters;
    },
    [unit]
  );

  // Format volume with unit
  const format = useCallback(
    (liters: number, decimals: number = 1): string => {
      const value = convert(liters);
      return `${value.toFixed(decimals)} ${unit}`;
    },
    [convert, unit]
  );

  // Format volume value only (no unit suffix)
  const formatValue = useCallback(
    (liters: number, decimals: number = 1): string => {
      const value = convert(liters);
      return value.toFixed(decimals);
    },
    [convert]
  );

  return {
    unit,
    setUnit,
    toggleUnit,
    convert,
    format,
    formatValue,
    isLoaded,
  };
}
