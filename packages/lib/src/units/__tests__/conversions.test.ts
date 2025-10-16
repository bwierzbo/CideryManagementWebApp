/**
 * Tests for unit conversion utilities
 */

import { describe, it, expect } from "vitest";
import {
  convertToLiters,
  convertFromLiters,
  convertToKg,
  convertFromKg,
  convertToCelsius,
  convertFromCelsius,
  formatVolume,
  formatWeight,
  formatTemperature,
  isValidVolume,
  isValidWeight,
} from "../conversions";

describe("Volume Conversions", () => {
  describe("convertToLiters", () => {
    it("should convert liters to liters (identity)", () => {
      expect(convertToLiters(5, "L")).toBe(5);
    });

    it("should convert gallons to liters", () => {
      expect(convertToLiters(1, "gal")).toBeCloseTo(3.78541, 5);
      expect(convertToLiters(10, "gal")).toBeCloseTo(37.8541, 4);
    });

    it("should convert milliliters to liters", () => {
      expect(convertToLiters(1000, "mL")).toBe(1);
      expect(convertToLiters(500, "mL")).toBe(0.5);
    });
  });

  describe("convertFromLiters", () => {
    it("should convert liters to liters (identity)", () => {
      expect(convertFromLiters(5, "L")).toBe(5);
    });

    it("should convert liters to gallons", () => {
      expect(convertFromLiters(3.78541, "gal")).toBeCloseTo(1, 5);
      expect(convertFromLiters(37.8541, "gal")).toBeCloseTo(10, 4);
    });

    it("should convert liters to milliliters", () => {
      expect(convertFromLiters(1, "mL")).toBe(1000);
      expect(convertFromLiters(0.5, "mL")).toBe(500);
    });
  });

  describe("round-trip conversions", () => {
    it("should handle gal -> L -> gal round-trip", () => {
      const original = 5;
      const liters = convertToLiters(original, "gal");
      const backToGal = convertFromLiters(liters, "gal");
      expect(backToGal).toBeCloseTo(original, 10);
    });

    it("should handle mL -> L -> mL round-trip", () => {
      const original = 750;
      const liters = convertToLiters(original, "mL");
      const backToML = convertFromLiters(liters, "mL");
      expect(backToML).toBeCloseTo(original, 10);
    });
  });
});

describe("Weight Conversions", () => {
  describe("convertToKg", () => {
    it("should convert kg to kg (identity)", () => {
      expect(convertToKg(5, "kg")).toBe(5);
    });

    it("should convert pounds to kilograms", () => {
      expect(convertToKg(1, "lb")).toBeCloseTo(0.453592, 6);
      expect(convertToKg(10, "lb")).toBeCloseTo(4.53592, 5);
    });
  });

  describe("convertFromKg", () => {
    it("should convert kg to kg (identity)", () => {
      expect(convertFromKg(5, "kg")).toBe(5);
    });

    it("should convert kilograms to pounds", () => {
      expect(convertFromKg(0.453592, "lb")).toBeCloseTo(1, 5);
      expect(convertFromKg(4.53592, "lb")).toBeCloseTo(10, 4);
    });
  });

  describe("round-trip conversions", () => {
    it("should handle lb -> kg -> lb round-trip", () => {
      const original = 150;
      const kg = convertToKg(original, "lb");
      const backToLb = convertFromKg(kg, "lb");
      expect(backToLb).toBeCloseTo(original, 10);
    });
  });
});

describe("Temperature Conversions", () => {
  describe("convertToCelsius", () => {
    it("should convert Celsius to Celsius (identity)", () => {
      expect(convertToCelsius(20, "C")).toBe(20);
    });

    it("should convert Fahrenheit to Celsius", () => {
      expect(convertToCelsius(32, "F")).toBeCloseTo(0, 10);
      expect(convertToCelsius(212, "F")).toBeCloseTo(100, 10);
      expect(convertToCelsius(68, "F")).toBeCloseTo(20, 10);
    });
  });

  describe("convertFromCelsius", () => {
    it("should convert Celsius to Celsius (identity)", () => {
      expect(convertFromCelsius(20, "C")).toBe(20);
    });

    it("should convert Celsius to Fahrenheit", () => {
      expect(convertFromCelsius(0, "F")).toBeCloseTo(32, 10);
      expect(convertFromCelsius(100, "F")).toBeCloseTo(212, 10);
      expect(convertFromCelsius(20, "F")).toBeCloseTo(68, 10);
    });
  });

  describe("round-trip conversions", () => {
    it("should handle F -> C -> F round-trip", () => {
      const original = 72;
      const celsius = convertToCelsius(original, "F");
      const backToF = convertFromCelsius(celsius, "F");
      expect(backToF).toBeCloseTo(original, 10);
    });
  });
});

describe("Formatting Functions", () => {
  describe("formatVolume", () => {
    it("should format liters", () => {
      expect(formatVolume(5.5, "L", 2)).toBe("5.50 L");
      expect(formatVolume(10, "L", 0)).toBe("10 L");
    });

    it("should format gallons", () => {
      expect(formatVolume(3.78541, "gal", 1)).toBe("1.0 gal");
      expect(formatVolume(37.8541, "gal", 2)).toBe("10.00 gal");
    });

    it("should format milliliters", () => {
      expect(formatVolume(0.75, "mL", 0)).toBe("750 mL");
      expect(formatVolume(1, "mL", 1)).toBe("1000.0 mL");
    });
  });

  describe("formatWeight", () => {
    it("should format kilograms", () => {
      expect(formatWeight(5.5, "kg", 2)).toBe("5.50 kg");
      expect(formatWeight(10, "kg", 0)).toBe("10 kg");
    });

    it("should format pounds", () => {
      expect(formatWeight(0.453592, "lb", 1)).toBe("1.0 lb");
      expect(formatWeight(4.53592, "lb", 2)).toBe("10.00 lb");
    });
  });

  describe("formatTemperature", () => {
    it("should format Celsius", () => {
      expect(formatTemperature(20, "C", 1)).toBe("20.0°C");
      expect(formatTemperature(0, "C", 0)).toBe("0°C");
    });

    it("should format Fahrenheit", () => {
      expect(formatTemperature(0, "F", 0)).toBe("32°F");
      expect(formatTemperature(20, "F", 1)).toBe("68.0°F");
    });
  });
});

describe("Validation Functions", () => {
  describe("isValidVolume", () => {
    it("should accept positive finite numbers", () => {
      expect(isValidVolume(1)).toBe(true);
      expect(isValidVolume(0.1)).toBe(true);
      expect(isValidVolume(1000)).toBe(true);
    });

    it("should reject zero", () => {
      expect(isValidVolume(0)).toBe(false);
    });

    it("should reject negative numbers", () => {
      expect(isValidVolume(-1)).toBe(false);
      expect(isValidVolume(-0.1)).toBe(false);
    });

    it("should reject infinity", () => {
      expect(isValidVolume(Infinity)).toBe(false);
      expect(isValidVolume(-Infinity)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(isValidVolume(NaN)).toBe(false);
    });
  });

  describe("isValidWeight", () => {
    it("should accept positive finite numbers", () => {
      expect(isValidWeight(1)).toBe(true);
      expect(isValidWeight(0.1)).toBe(true);
      expect(isValidWeight(1000)).toBe(true);
    });

    it("should reject zero", () => {
      expect(isValidWeight(0)).toBe(false);
    });

    it("should reject negative numbers", () => {
      expect(isValidWeight(-1)).toBe(false);
      expect(isValidWeight(-0.1)).toBe(false);
    });

    it("should reject infinity", () => {
      expect(isValidWeight(Infinity)).toBe(false);
      expect(isValidWeight(-Infinity)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(isValidWeight(NaN)).toBe(false);
    });
  });
});

describe("Real-world Scenarios", () => {
  it("should handle typical cidery batch volumes", () => {
    // 50 gallon batch
    const batchGallons = 50;
    const batchLiters = convertToLiters(batchGallons, "gal");
    expect(batchLiters).toBeCloseTo(189.271, 2);
    expect(formatVolume(batchLiters, "gal", 1)).toBe("50.0 gal");
  });

  it("should handle typical apple weights", () => {
    // 1000 lb of apples
    const applesLbs = 1000;
    const applesKg = convertToKg(applesLbs, "lb");
    expect(applesKg).toBeCloseTo(453.592, 2);
    expect(formatWeight(applesKg, "lb", 0)).toBe("1000 lb");
  });

  it("should handle fermentation temperature conversions", () => {
    // Typical fermentation temp: 68°F
    const tempF = 68;
    const tempC = convertToCelsius(tempF, "F");
    expect(tempC).toBeCloseTo(20, 1);
    expect(formatTemperature(tempC, "F", 0)).toBe("68°F");
    expect(formatTemperature(tempC, "C", 1)).toBe("20.0°C");
  });

  it("should handle bottle volumes", () => {
    // 750mL bottle
    const bottleML = 750;
    const bottleLiters = convertToLiters(bottleML, "mL");
    expect(bottleLiters).toBe(0.75);
    expect(formatVolume(bottleLiters, "mL", 0)).toBe("750 mL");
  });
});
