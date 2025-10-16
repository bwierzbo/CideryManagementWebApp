/**
 * Unit Preferences Store
 *
 * Manages user preferences for volume, weight, and temperature units with:
 * - Automatic locale detection on first load
 * - Persistence to localStorage
 * - Imperial/metric defaults based on user locale
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  VolumeUnit,
  WeightUnit,
  TemperatureUnit,
} from "../units/conversions";

// ============================================================
// Type Definitions
// ============================================================

/**
 * User preferences for unit display across the application
 */
export interface UnitPreferences {
  /** Preferred volume unit (L, gal, mL) */
  volume: VolumeUnit;
  /** Preferred weight unit (kg, lb) */
  weight: WeightUnit;
  /** Preferred temperature unit (C, F) */
  temperature: TemperatureUnit;
}

/**
 * Store state and actions for unit preferences
 */
interface UnitPreferencesStore {
  // State
  preferences: UnitPreferences;

  // Actions
  setVolumeUnit: (unit: VolumeUnit) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  resetToDefaults: () => void;
  setLocaleDefaults: (locale: string) => void;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Detect the user's locale from the browser
 *
 * @returns User's locale string (e.g., 'en-US', 'en-GB', 'fr-FR')
 */
function detectUserLocale(): string {
  if (typeof window === "undefined") {
    return "en-US"; // Default for SSR
  }

  return (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    "en-US"
  );
}

/**
 * Determine if a locale uses imperial units
 *
 * @param locale - Locale string (e.g., 'en-US')
 * @returns True if locale typically uses imperial units
 */
function usesImperialUnits(locale: string): boolean {
  // US, Liberia, and Myanmar are the primary imperial unit users
  // For simplicity, we'll check for US locales
  return locale.toLowerCase().includes("us");
}

/**
 * Get appropriate unit defaults based on user locale
 *
 * @param locale - User's locale string
 * @returns Unit preferences appropriate for the locale
 *
 * @example
 * ```typescript
 * getLocaleDefaults('en-US') // { volume: 'gal', weight: 'lb', temperature: 'F' }
 * getLocaleDefaults('en-GB') // { volume: 'L', weight: 'kg', temperature: 'C' }
 * ```
 */
export function getLocaleDefaults(locale: string): UnitPreferences {
  if (usesImperialUnits(locale)) {
    return {
      volume: "gal",
      weight: "lb",
      temperature: "F",
    };
  }

  return {
    volume: "L",
    weight: "kg",
    temperature: "C",
  };
}

/**
 * Get initial defaults with automatic locale detection
 *
 * @returns Initial unit preferences based on detected locale
 */
function getInitialDefaults(): UnitPreferences {
  const locale = detectUserLocale();
  return getLocaleDefaults(locale);
}

// ============================================================
// Store Definition
// ============================================================

/**
 * Zustand store for managing user unit preferences
 *
 * Automatically detects user locale on first load and sets appropriate
 * imperial or metric defaults. Persists preferences to localStorage.
 *
 * @example
 * ```typescript
 * // In a component
 * function VolumeDisplay({ liters }: { liters: number }) {
 *   const volumeUnit = useUnitPreferences((state) => state.preferences.volume);
 *   const setVolumeUnit = useUnitPreferences((state) => state.setVolumeUnit);
 *
 *   const displayValue = convertFromLiters(liters, volumeUnit);
 *
 *   return (
 *     <div>
 *       {displayValue.toFixed(2)} {volumeUnit}
 *       <button onClick={() => setVolumeUnit('gal')}>Switch to gallons</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useUnitPreferences = create<UnitPreferencesStore>()(
  persist(
    (set) => ({
      // Initial state with locale-based defaults
      preferences: getInitialDefaults(),

      // Set volume unit preference
      setVolumeUnit: (unit: VolumeUnit) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            volume: unit,
          },
        })),

      // Set weight unit preference
      setWeightUnit: (unit: WeightUnit) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            weight: unit,
          },
        })),

      // Set temperature unit preference
      setTemperatureUnit: (unit: TemperatureUnit) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            temperature: unit,
          },
        })),

      // Reset to locale-based defaults
      resetToDefaults: () =>
        set(() => ({
          preferences: getInitialDefaults(),
        })),

      // Set defaults based on a specific locale
      setLocaleDefaults: (locale: string) =>
        set(() => ({
          preferences: getLocaleDefaults(locale),
        })),
    }),
    {
      name: "unit-preferences", // localStorage key
      version: 1,
    },
  ),
);

// ============================================================
// Convenience Selectors
// ============================================================

/**
 * Hook to get the current volume unit preference
 *
 * @example
 * ```typescript
 * const volumeUnit = useVolumeUnit();
 * ```
 */
export const useVolumeUnit = () =>
  useUnitPreferences((state) => state.preferences.volume);

/**
 * Hook to get the current weight unit preference
 *
 * @example
 * ```typescript
 * const weightUnit = useWeightUnit();
 * ```
 */
export const useWeightUnit = () =>
  useUnitPreferences((state) => state.preferences.weight);

/**
 * Hook to get the current temperature unit preference
 *
 * @example
 * ```typescript
 * const temperatureUnit = useTemperatureUnit();
 * ```
 */
export const useTemperatureUnit = () =>
  useUnitPreferences((state) => state.preferences.temperature);
