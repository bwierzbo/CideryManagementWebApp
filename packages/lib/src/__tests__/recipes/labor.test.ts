import { describe, it, expect } from "vitest";
import { computeRecipeLabor } from "../../recipes/labor";

describe("computeRecipeLabor", () => {
  it("sums per-task hours grouped by packaging path", () => {
    const labor = computeRecipeLabor([
      { packagingPath: "all", estimatedDurationHours: "0.2" },
      { packagingPath: "all", estimatedDurationHours: "0.3" },
      { packagingPath: "bottle", estimatedDurationHours: 1 },
      { packagingPath: "keg", estimatedDurationHours: 0.5 },
    ]);
    expect(labor.byPath).toEqual({ all: 0.5, bottle: 1, keg: 0.5 });
    expect(labor.totalHours).toBe(2);
    expect(labor.stepsCounted).toBe(4);
    expect(labor.stepsMissingEstimate).toBe(0);
  });

  it("treats missing/zero/non-numeric estimates as unmeasured (not zero-labor)", () => {
    const labor = computeRecipeLabor([
      { packagingPath: "all", estimatedDurationHours: null },
      { packagingPath: "bottle", estimatedDurationHours: 0 },
      { packagingPath: "keg", estimatedDurationHours: "" },
      { packagingPath: "all", estimatedDurationHours: "0.5" },
    ]);
    expect(labor.totalHours).toBe(0.5);
    expect(labor.stepsCounted).toBe(1);
    expect(labor.stepsMissingEstimate).toBe(3);
  });

  it("defaults an unknown/absent path to 'all'", () => {
    const labor = computeRecipeLabor([
      { estimatedDurationHours: 0.25 },
      { packagingPath: "weird", estimatedDurationHours: 0.25 },
    ]);
    expect(labor.byPath.all).toBe(0.5);
    expect(labor.totalHours).toBe(0.5);
  });

  it("returns zeros for an empty recipe", () => {
    const labor = computeRecipeLabor([]);
    expect(labor).toEqual({
      totalHours: 0,
      byPath: { all: 0, bottle: 0, keg: 0 },
      stepsCounted: 0,
      stepsMissingEstimate: 0,
    });
  });
});
