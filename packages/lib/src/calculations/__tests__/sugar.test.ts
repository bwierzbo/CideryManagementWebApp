import { describe, it, expect } from "vitest";
import {
  calculateGravityIncrease,
  calculateEstimatedSGAfterAddition,
  sgToBrix,
  sugarGramsPerLiterFromSG,
  sugarGramsFromJuiceAddition,
  addedSugarGramsPerLiter,
} from "../sugar";

describe("sgToBrix", () => {
  it("converts water (SG 1.000) to ~0 Brix", () => {
    const brix = sgToBrix(1.0);
    console.log(`SG 1.000 → ${brix} Brix`);
    expect(brix).toBeCloseTo(0, 1);
  });

  it("converts typical apple juice SG 1.050 to ~12.4 Brix", () => {
    const brix = sgToBrix(1.05);
    console.log(`SG 1.050 → ${brix} Brix`);
    expect(brix).toBeGreaterThan(12.0);
    expect(brix).toBeLessThan(12.8);
  });

  it("converts SG 1.090 (dessert must) to ~21.5 Brix", () => {
    const brix = sgToBrix(1.09);
    console.log(`SG 1.090 → ${brix} Brix`);
    expect(brix).toBeGreaterThan(21.0);
    expect(brix).toBeLessThan(22.0);
  });

  it("clamps below-water SG to 0 rather than going negative", () => {
    expect(sgToBrix(0.995)).toBe(0);
    expect(sgToBrix(0)).toBe(0);
  });
});

describe("sugarGramsPerLiterFromSG", () => {
  it("returns ~130 g/L for SG 1.050 apple juice", () => {
    const gPerL = sugarGramsPerLiterFromSG(1.05);
    console.log(`SG 1.050 → ${gPerL} g/L sugar`);
    expect(gPerL).toBeGreaterThan(126);
    expect(gPerL).toBeLessThan(134);
  });

  it("returns 0 at or below SG 1.000", () => {
    expect(sugarGramsPerLiterFromSG(1.0)).toBe(0);
    expect(sugarGramsPerLiterFromSG(0.998)).toBe(0);
  });

  it("increases monotonically with SG across the juice range", () => {
    let prev = 0;
    for (let sg = 1.005; sg <= 1.1; sg += 0.005) {
      const cur = sugarGramsPerLiterFromSG(sg);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
});

describe("sugarGramsFromJuiceAddition", () => {
  it("scales linearly with volume", () => {
    const perLiter = sugarGramsFromJuiceAddition(1.05, 1);
    const thirtyTwo = sugarGramsFromJuiceAddition(1.05, 32);
    console.log(`1L: ${perLiter}g, 32L: ${thirtyTwo}g`);
    expect(thirtyTwo).toBeCloseTo(perLiter * 32, 6);
  });

  it("returns 0 for zero or negative volume", () => {
    expect(sugarGramsFromJuiceAddition(1.05, 0)).toBe(0);
    expect(sugarGramsFromJuiceAddition(1.05, -5)).toBe(0);
  });
});

describe("addedSugarGramsPerLiter", () => {
  it("computes ~4.3 g/L for 34 mL/L of SG 1.050 juice", () => {
    const gPerL = addedSugarGramsPerLiter(1.05, 34);
    console.log(`34 mL/L of SG 1.050 juice → ${gPerL} g/L added sugar`);
    expect(gPerL).toBeGreaterThan(4.0);
    expect(gPerL).toBeLessThan(4.6);
  });

  it("accounts for the juice's own volume (denominator 1000 + dose)", () => {
    const naive = (sugarGramsPerLiterFromSG(1.05) * 34) / 1000;
    const corrected = addedSugarGramsPerLiter(1.05, 34);
    console.log(`naive: ${naive}, corrected: ${corrected}`);
    expect(corrected).toBeLessThan(naive);
    expect(corrected).toBeCloseTo(naive * (1000 / 1034), 6);
  });

  it("returns 0 for zero dose", () => {
    expect(addedSugarGramsPerLiter(1.05, 0)).toBe(0);
  });
});

describe("round-trip: juice dose → batch SG estimate", () => {
  it("a 34 mL/L SG 1.050 dose bumps a 943L batch at SG 1.000 by a few points", () => {
    const batchVolumeL = 943;
    const doseMlPerL = 34;
    const juiceVolumeL = (batchVolumeL * doseMlPerL) / 1000;
    const sugarGrams = sugarGramsFromJuiceAddition(1.05, juiceVolumeL);
    const newSG = calculateEstimatedSGAfterAddition(
      1.0,
      sugarGrams,
      batchVolumeL + juiceVolumeL,
    );
    console.log(
      `${juiceVolumeL.toFixed(1)}L juice, ${sugarGrams.toFixed(0)}g sugar → SG ${newSG.toFixed(4)}`,
    );
    expect(newSG).toBeGreaterThan(1.0005);
    expect(newSG).toBeLessThan(1.01);
    // Sanity: the gravity increase helper agrees in isolation
    expect(
      calculateGravityIncrease(sugarGrams, batchVolumeL + juiceVolumeL),
    ).toBeCloseTo(newSG - 1.0, 6);
  });
});
