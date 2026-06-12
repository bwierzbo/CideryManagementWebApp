import { describe, it, expect } from "vitest";
import {
  computeRecipeBOM,
  aggregateRecipeBOMs,
  type RecipeBomInput,
} from "../../recipes/bom";

const bottlePackageStep = {
  kind: "package",
  label: "Package 750ml",
  packagingPath: "bottle",
  actionData: {
    containerVarietyId: "bottle-1",
    containerVarietyName: "750ml Glass Bottles",
    sizeML: 750,
    capVarietyId: "cap-1",
    capVarietyName: "750ml Bottle Caps",
  },
};

const labelStep = {
  kind: "label",
  label: "Label",
  packagingPath: "bottle",
  actionData: { labelVarietyId: "label-1", labelVarietyName: "Heritage Label" },
};

describe("computeRecipeBOM", () => {
  describe("additives", () => {
    it("scales an ingredient rate by the target volume", () => {
      const bom = computeRecipeBOM({
        ingredients: [
          { label: "Cascade Hops", additiveVarietyId: "v1", rateValue: 1.5, rateUnit: "g/L" },
        ],
        steps: [],
        targetVolumeL: 400,
      });
      // 1.5 g/L × 400 L = 600 g
      expect(bom.additives).toHaveLength(1);
      expect(bom.additives[0]).toMatchObject({
        category: "additive",
        varietyId: "v1",
        name: "Cascade Hops",
        quantity: 600,
        unit: "g",
      });
      expect(bom.warnings).toHaveLength(0);
    });

    it("warns when an ingredient isn't linked to inventory", () => {
      const bom = computeRecipeBOM({
        ingredients: [{ label: "Mystery Hops", rateValue: 1, rateUnit: "g/L" }],
        steps: [],
        targetVolumeL: 100,
      });
      expect(bom.additives[0].varietyId).toBeNull();
      expect(bom.warnings.some((w) => w.includes("Mystery Hops") && w.includes("inventory"))).toBe(true);
    });

    it("skips and warns on an ingredient with no rate", () => {
      const bom = computeRecipeBOM({
        ingredients: [{ label: "No Rate", additiveVarietyId: "v9", rateValue: null, rateUnit: "g/L" }],
        steps: [],
        targetVolumeL: 100,
      });
      expect(bom.additives).toHaveLength(0);
      expect(bom.warnings.some((w) => w.includes("No Rate") && w.includes("rate"))).toBe(true);
    });
  });

  describe("packaging — all bottled", () => {
    it("counts bottles, caps, and labels (ceil of volume ÷ size)", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [bottlePackageStep, labelStep],
        targetVolumeL: 400,
      });
      // 400 L / 0.75 L = 533.3 → 534
      const bottles = bom.packaging.find((p) => p.name === "750ml Glass Bottles");
      const caps = bom.packaging.find((p) => p.name === "750ml Bottle Caps");
      const labels = bom.packaging.find((p) => p.name === "Heritage Label");
      expect(bottles?.quantity).toBe(534);
      expect(caps?.quantity).toBe(534);
      expect(labels?.quantity).toBe(534);
      expect(bottles?.varietyId).toBe("bottle-1");
      expect(labels?.varietyId).toBe("label-1");
    });

    it("defaults the whole batch to bottled when no split is given", () => {
      const bom = computeRecipeBOM({ ingredients: [], steps: [bottlePackageStep], targetVolumeL: 750 });
      expect(bom.bottleL).toBe(750);
      expect(bom.kegL).toBe(0);
      expect(bom.packaging.find((p) => p.name === "750ml Glass Bottles")?.quantity).toBe(1000);
    });
  });

  describe("packaging — split batch (bottle + keg)", () => {
    const kegPackageStep = {
      kind: "package",
      label: "Package into kegs",
      packagingPath: "keg",
      actionData: { containerVarietyId: null, containerVarietyName: "19L Keg", sizeML: 19000 },
    };

    it("routes each package step to its portion and does not label kegs", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [bottlePackageStep, kegPackageStep, labelStep],
        targetVolumeL: 1000,
        bottleL: 400,
        kegL: 600,
      });
      // bottles: 400 L / 0.75 = 533.3 → 534
      expect(bom.packaging.find((p) => p.name === "750ml Glass Bottles")?.quantity).toBe(534);
      // kegs: 600 L / 19 L = 31.6 → 32
      expect(bom.packaging.find((p) => p.name === "19L Keg")?.quantity).toBe(32);
      // labels apply to bottles only → 534, not 534 + kegs
      expect(bom.packaging.find((p) => p.name === "Heritage Label")?.quantity).toBe(534);
    });

    it("warns when the split doesn't add up to the target", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [bottlePackageStep],
        targetVolumeL: 1000,
        bottleL: 400,
        kegL: 300,
      });
      expect(bom.warnings.some((w) => w.includes("doesn't match"))).toBe(true);
    });

    it("infers the remaining portion when only one side is given", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [],
        targetVolumeL: 1000,
        kegL: 600,
      });
      expect(bom.bottleL).toBe(400);
      expect(bom.kegL).toBe(600);
    });
  });

  describe("packaging — missing data", () => {
    it("warns when a package step has no container size", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [{ kind: "package", label: "Package", packagingPath: "bottle", actionData: {} }],
        targetVolumeL: 400,
      });
      expect(bom.packaging).toHaveLength(0);
      expect(bom.warnings.some((w) => w.includes("container size"))).toBe(true);
    });

    it("aggregates duplicate varieties across steps", () => {
      const bom = computeRecipeBOM({
        ingredients: [],
        steps: [bottlePackageStep, bottlePackageStep],
        targetVolumeL: 400,
      });
      // Two identical bottle steps each on the full bottle portion → 534 + 534
      expect(bom.packaging.find((p) => p.name === "750ml Glass Bottles")?.quantity).toBe(1068);
    });
  });
});

describe("aggregateRecipeBOMs", () => {
  const hopsBom = (qty: number) =>
    computeRecipeBOM({
      ingredients: [{ label: "Cascade Hops", additiveVarietyId: "v1", rateValue: qty, rateUnit: "g/L" }],
      steps: [
        {
          kind: "package",
          packagingPath: "bottle",
          actionData: { containerVarietyId: "b1", containerVarietyName: "750ml Glass Bottles", sizeML: 750 },
        },
      ],
      targetVolumeL: 1000,
    });

  it("sums same variety + period across batches", () => {
    const agg = aggregateRecipeBOMs([
      { period: "2026-03", bom: hopsBom(1) }, // 1000 g hops, 1334 bottles
      { period: "2026-03", bom: hopsBom(1) }, // another identical batch
    ]);
    const hops = agg.find((l) => l.varietyId === "v1" && l.period === "2026-03");
    const bottles = agg.find((l) => l.varietyId === "b1" && l.period === "2026-03");
    expect(hops?.quantity).toBe(2000); // kg-base: 1000 + 1000 g
    expect(hops?.sources).toBe(2);
    expect(bottles?.quantity).toBe(2668); // 1334 + 1334
  });

  it("keeps different periods as separate lines", () => {
    const agg = aggregateRecipeBOMs([
      { period: "2026-03", bom: hopsBom(1) },
      { period: "2026-Q2", bom: hopsBom(1) },
    ]);
    const periods = agg.filter((l) => l.varietyId === "v1").map((l) => l.period).sort();
    expect(periods).toEqual(["2026-03", "2026-Q2"]);
  });

  it("returns an empty array for no batches", () => {
    expect(aggregateRecipeBOMs([])).toEqual([]);
  });
});
