/**
 * Tests for unit preferences store
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useUnitPreferences,
  useVolumeUnit,
  useWeightUnit,
  useTemperatureUnit,
  getLocaleDefaults,
} from "../useUnitPreferences";

// Setup navigator mock
Object.defineProperty(global, "navigator", {
  value: {
    language: "en-US",
    languages: ["en-US", "en"],
  },
  writable: true,
});

describe("getLocaleDefaults", () => {
  it("should return imperial units for US locale", () => {
    const defaults = getLocaleDefaults("en-US");
    expect(defaults).toEqual({
      volume: "gal",
      weight: "lb",
      temperature: "F",
    });
  });

  it("should return metric units for UK locale", () => {
    const defaults = getLocaleDefaults("en-GB");
    expect(defaults).toEqual({
      volume: "L",
      weight: "kg",
      temperature: "C",
    });
  });

  it("should return metric units for French locale", () => {
    const defaults = getLocaleDefaults("fr-FR");
    expect(defaults).toEqual({
      volume: "L",
      weight: "kg",
      temperature: "C",
    });
  });

  it("should return metric units for German locale", () => {
    const defaults = getLocaleDefaults("de-DE");
    expect(defaults).toEqual({
      volume: "L",
      weight: "kg",
      temperature: "C",
    });
  });

  it("should handle case-insensitive locale matching", () => {
    const defaults = getLocaleDefaults("EN-US");
    expect(defaults).toEqual({
      volume: "gal",
      weight: "lb",
      temperature: "F",
    });
  });
});

describe("useUnitPreferences", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store to initial state
    useUnitPreferences.setState({
      preferences: {
        volume: "gal",
        weight: "lb",
        temperature: "F",
      },
    });
  });

  describe("initial state", () => {
    it("should initialize with default preferences", () => {
      const { result } = renderHook(() => useUnitPreferences());
      expect(result.current.preferences).toBeDefined();
      expect(result.current.preferences.volume).toBeDefined();
      expect(result.current.preferences.weight).toBeDefined();
      expect(result.current.preferences.temperature).toBeDefined();
    });

    it("should detect US locale and set imperial units", () => {
      const { result } = renderHook(() => useUnitPreferences());
      // Default navigator.language is 'en-US' from our mock
      expect(result.current.preferences.volume).toBe("gal");
      expect(result.current.preferences.weight).toBe("lb");
      expect(result.current.preferences.temperature).toBe("F");
    });
  });

  describe("setVolumeUnit", () => {
    it("should update volume unit preference", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setVolumeUnit("L");
      });

      expect(result.current.preferences.volume).toBe("L");
    });

    it("should not affect other preferences", () => {
      const { result } = renderHook(() => useUnitPreferences());
      const initialWeight = result.current.preferences.weight;
      const initialTemp = result.current.preferences.temperature;

      act(() => {
        result.current.setVolumeUnit("mL");
      });

      expect(result.current.preferences.weight).toBe(initialWeight);
      expect(result.current.preferences.temperature).toBe(initialTemp);
    });

    it("should accept all valid volume units", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setVolumeUnit("L");
      });
      expect(result.current.preferences.volume).toBe("L");

      act(() => {
        result.current.setVolumeUnit("gal");
      });
      expect(result.current.preferences.volume).toBe("gal");

      act(() => {
        result.current.setVolumeUnit("mL");
      });
      expect(result.current.preferences.volume).toBe("mL");
    });
  });

  describe("setWeightUnit", () => {
    it("should update weight unit preference", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setWeightUnit("kg");
      });

      expect(result.current.preferences.weight).toBe("kg");
    });

    it("should not affect other preferences", () => {
      const { result } = renderHook(() => useUnitPreferences());
      const initialVolume = result.current.preferences.volume;
      const initialTemp = result.current.preferences.temperature;

      act(() => {
        result.current.setWeightUnit("kg");
      });

      expect(result.current.preferences.volume).toBe(initialVolume);
      expect(result.current.preferences.temperature).toBe(initialTemp);
    });

    it("should accept all valid weight units", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setWeightUnit("kg");
      });
      expect(result.current.preferences.weight).toBe("kg");

      act(() => {
        result.current.setWeightUnit("lb");
      });
      expect(result.current.preferences.weight).toBe("lb");
    });
  });

  describe("setTemperatureUnit", () => {
    it("should update temperature unit preference", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setTemperatureUnit("C");
      });

      expect(result.current.preferences.temperature).toBe("C");
    });

    it("should not affect other preferences", () => {
      const { result } = renderHook(() => useUnitPreferences());
      const initialVolume = result.current.preferences.volume;
      const initialWeight = result.current.preferences.weight;

      act(() => {
        result.current.setTemperatureUnit("C");
      });

      expect(result.current.preferences.volume).toBe(initialVolume);
      expect(result.current.preferences.weight).toBe(initialWeight);
    });

    it("should accept all valid temperature units", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setTemperatureUnit("C");
      });
      expect(result.current.preferences.temperature).toBe("C");

      act(() => {
        result.current.setTemperatureUnit("F");
      });
      expect(result.current.preferences.temperature).toBe("F");
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all preferences to locale defaults", () => {
      const { result } = renderHook(() => useUnitPreferences());

      // Change preferences
      act(() => {
        result.current.setVolumeUnit("mL");
        result.current.setWeightUnit("kg");
        result.current.setTemperatureUnit("C");
      });

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      // Should be back to US defaults
      expect(result.current.preferences.volume).toBe("gal");
      expect(result.current.preferences.weight).toBe("lb");
      expect(result.current.preferences.temperature).toBe("F");
    });
  });

  describe("setLocaleDefaults", () => {
    it("should set imperial defaults for US locale", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setLocaleDefaults("en-US");
      });

      expect(result.current.preferences.volume).toBe("gal");
      expect(result.current.preferences.weight).toBe("lb");
      expect(result.current.preferences.temperature).toBe("F");
    });

    it("should set metric defaults for UK locale", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setLocaleDefaults("en-GB");
      });

      expect(result.current.preferences.volume).toBe("L");
      expect(result.current.preferences.weight).toBe("kg");
      expect(result.current.preferences.temperature).toBe("C");
    });

    it("should set metric defaults for European locales", () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setLocaleDefaults("fr-FR");
      });

      expect(result.current.preferences.volume).toBe("L");
      expect(result.current.preferences.weight).toBe("kg");
      expect(result.current.preferences.temperature).toBe("C");
    });
  });

  describe("persistence", () => {
    it("should persist preferences to localStorage", async () => {
      const { result } = renderHook(() => useUnitPreferences());

      act(() => {
        result.current.setVolumeUnit("L");
      });

      // Wait for persist middleware to write to localStorage
      await waitFor(() => {
        const stored = localStorage.getItem("unit-preferences");
        expect(stored).not.toBeNull();
      });

      // Check that localStorage was updated
      const stored = localStorage.getItem("unit-preferences");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.preferences.volume).toBe("L");
      }
    });

    it("should restore preferences from localStorage", () => {
      // Set initial preferences
      const { result: result1 } = renderHook(() => useUnitPreferences());
      act(() => {
        result1.current.setVolumeUnit("mL");
        result1.current.setWeightUnit("kg");
        result1.current.setTemperatureUnit("C");
      });

      // Create a new hook instance (simulating page reload)
      const { result: result2 } = renderHook(() => useUnitPreferences());

      // Should have restored preferences
      expect(result2.current.preferences.volume).toBe("mL");
      expect(result2.current.preferences.weight).toBe("kg");
      expect(result2.current.preferences.temperature).toBe("C");
    });
  });
});

describe("Convenience Selectors", () => {
  beforeEach(() => {
    localStorage.clear();
    useUnitPreferences.setState({
      preferences: {
        volume: "gal",
        weight: "lb",
        temperature: "F",
      },
    });
  });

  describe("useVolumeUnit", () => {
    it("should return current volume unit", () => {
      const { result } = renderHook(() => useVolumeUnit());
      expect(result.current).toBe("gal");
    });

    it("should update when volume unit changes", () => {
      const { result: prefResult } = renderHook(() => useUnitPreferences());
      const { result: volumeResult } = renderHook(() => useVolumeUnit());

      act(() => {
        prefResult.current.setVolumeUnit("L");
      });

      expect(volumeResult.current).toBe("L");
    });
  });

  describe("useWeightUnit", () => {
    it("should return current weight unit", () => {
      const { result } = renderHook(() => useWeightUnit());
      expect(result.current).toBe("lb");
    });

    it("should update when weight unit changes", () => {
      const { result: prefResult } = renderHook(() => useUnitPreferences());
      const { result: weightResult } = renderHook(() => useWeightUnit());

      act(() => {
        prefResult.current.setWeightUnit("kg");
      });

      expect(weightResult.current).toBe("kg");
    });
  });

  describe("useTemperatureUnit", () => {
    it("should return current temperature unit", () => {
      const { result } = renderHook(() => useTemperatureUnit());
      expect(result.current).toBe("F");
    });

    it("should update when temperature unit changes", () => {
      const { result: prefResult } = renderHook(() => useUnitPreferences());
      const { result: tempResult } = renderHook(() => useTemperatureUnit());

      act(() => {
        prefResult.current.setTemperatureUnit("C");
      });

      expect(tempResult.current).toBe("C");
    });
  });
});

describe("Real-world Usage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should handle switching from imperial to metric", () => {
    const { result } = renderHook(() => useUnitPreferences());

    // Start with US defaults
    act(() => {
      result.current.setLocaleDefaults("en-US");
    });

    expect(result.current.preferences.volume).toBe("gal");
    expect(result.current.preferences.weight).toBe("lb");
    expect(result.current.preferences.temperature).toBe("F");

    // Switch to metric
    act(() => {
      result.current.setVolumeUnit("L");
      result.current.setWeightUnit("kg");
      result.current.setTemperatureUnit("C");
    });

    expect(result.current.preferences.volume).toBe("L");
    expect(result.current.preferences.weight).toBe("kg");
    expect(result.current.preferences.temperature).toBe("C");
  });

  it("should handle mixed unit preferences", () => {
    const { result } = renderHook(() => useUnitPreferences());

    // User might prefer gallons but metric for weight
    act(() => {
      result.current.setVolumeUnit("gal");
      result.current.setWeightUnit("kg");
      result.current.setTemperatureUnit("F");
    });

    expect(result.current.preferences.volume).toBe("gal");
    expect(result.current.preferences.weight).toBe("kg");
    expect(result.current.preferences.temperature).toBe("F");
  });
});
