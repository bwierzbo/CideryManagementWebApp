/**
 * WA LIQ-774 golden tests.
 *
 * Fixture = Olympic Bluffs' FILED 2025 LIQ-774 (docs/ttb-liq774-form-spec.md).
 * We feed the FILED 2025 TTB Form 5120.17 numbers (from lib `FILED_2025`) plus
 * the 2025 channel-sales split (boxes 13/14 as filed) into `computeLIQ774` and
 * assert the computed boxes reproduce the filed LIQ-774 within tolerance.
 *
 * Filed LIQ-774 2025 anchors (spec):
 *   box 1  total net gallons ...... 6,762
 *   box 2/9 total removals ........ 770
 *   box 13 winery retail .......... 143 / 544 / 49  (Cider / NonFort / Fort)
 *   box 14 WA licensees ........... 6 / 22 / 6
 *   box 15 total taxable .......... 149 / 566 / 55   (= 770)
 *   box 20 total wine tax ......... 631.42
 *   box 23 wine commission ........ 49.68
 *
 * DOCUMENTED DEVIATIONS (pinned like the golden 5120.17 KNOWN_DELTA):
 *   - box 1: computed 6,751 vs filed 6,762 (delta −11). The filed box-1 basis is
 *     total wine handled (Section A line 12); our FILED_2025 constant was adjusted
 *     post-filing for perry reclassification, leaving ~11 gal of reconstruction
 *     drift. The spec's prose "net production" formula is provably wrong (its
 *     additions total only ~5,629 gal, below filed 6,762) and is flagged for
 *     owner correction — see computeLIQ774 box-1 note.
 */
import { describe, it, expect } from "vitest";
import { FILED_2025 } from "../ttb-filed";
import {
  computeLIQ774,
  type LIQ774ChannelSales,
  type LIQ774TTBInput,
} from "../liq774";
import type { TTBReportingPeriod } from "../ttb";

const REPORTING_PERIOD: TTBReportingPeriod = {
  type: "annual",
  startDate: new Date(2025, 0, 1),
  endDate: new Date(2025, 11, 31),
  year: 2025,
};

/**
 * Build the LIQ-774 TTB input from the FILED_2025 constant. Only the lines
 * computeLIQ774 reads are populated: Section A line12 (total available, for
 * box 1) and Section B line8/line12 (removals, for box 2/9).
 */
function buildFiledTTBInput(): LIQ774TTBInput {
  const a = FILED_2025.sectionA;
  const b = FILED_2025.sectionB;
  return {
    reportingPeriod: REPORTING_PERIOD,
    bulkWinesByTaxClass: {
      hardCider: { line12_total: a.hardCider.line12_totalIn },
      wineUnder16: { line12_total: a.wineUnder16.line12_totalIn },
      wine16To21: { line12_total: a.wine16To21.line12_totalIn },
    } as any,
    bottledWinesByTaxClass: {
      hardCider: { line8_removedTaxpaid: b.hardCider.line8_removedTaxPaid, line12_export: 0 },
      wineUnder16: { line8_removedTaxpaid: b.wineUnder16.line8_removedTaxPaid, line12_export: 0 },
      wine16To21: { line8_removedTaxpaid: b.wine16To21.line8_removedTaxPaid, line12_export: 0 },
    } as any,
  };
}

/** Filed 2025 channel-sales split (boxes 13/14 by category). */
const FILED_2025_CHANNEL_SALES: LIQ774ChannelSales = {
  byCategory: {
    cider: { retailGal: 143, licenseeGal: 6 },
    nonFortified: { retailGal: 544, licenseeGal: 22 },
    fortified: { retailGal: 49, licenseeGal: 6 },
  },
};

// Documented, owner-accepted deviations (computed − filed), keyed by box label.
const KNOWN_DELTA: Record<string, number> = {
  "box1 total net gallons": -11,
};

const TOLERANCE = 1.0;

function expectClose(actual: number, filed: number, label: string, tol = TOLERANCE) {
  const delta = KNOWN_DELTA[label] ?? 0;
  const target = filed + delta;
  const diff = Math.abs(actual - target);
  if (diff > tol) {
    console.log(
      `[LIQ774] ${label}: actual=${actual}, target=${target} (filed=${filed}, knownDelta=${delta}), diff=${diff.toFixed(2)}`,
    );
  }
  expect(
    diff,
    `${label}: expected ~${target} (filed ${filed} + delta ${delta}), got ${actual} (diff ${diff.toFixed(2)})`,
  ).toBeLessThanOrEqual(tol);
}

describe("WA LIQ-774 — filed 2025 golden", () => {
  const result = computeLIQ774(buildFiledTTBInput(), FILED_2025_CHANNEL_SALES);

  describe("Box 1 — Total NET Gallons", () => {
    it("reproduces filed 6,762 within documented drift", () => {
      expectClose(result.box1_totalNetGallons.total, 6762, "box1 total net gallons");
    });
  });

  describe("Box 2 / 9 — Total Removals", () => {
    it("box 2 total = filed 770", () => {
      expectClose(result.box2_totalAtWinery.total, 770, "box2 total");
    });
    it("box 9 total = filed 770", () => {
      expectClose(result.box9_totalRemovals.total, 770, "box9 total");
    });
    it("box 2 per-category matches filed Section B line 8 (149/566/55)", () => {
      expectClose(result.box2_totalAtWinery.cider, 149, "box2 cider");
      expectClose(result.box2_totalAtWinery.nonFortified, 566, "box2 nonFortified");
      expectClose(result.box2_totalAtWinery.fortified, 55, "box2 fortified");
    });
  });

  describe("Boxes 13/14/15 — Taxable Sales", () => {
    it("box 13 winery retail = 143/544/49 (total 736)", () => {
      expectClose(result.box13_wineryRetail.cider, 143, "box13 cider");
      expectClose(result.box13_wineryRetail.nonFortified, 544, "box13 nonFortified");
      expectClose(result.box13_wineryRetail.fortified, 49, "box13 fortified");
      expectClose(result.box13_wineryRetail.total, 736, "box13 total");
    });
    it("box 14 WA licensees = 6/22/6 (total 34)", () => {
      expectClose(result.box14_waRetailLicensees.cider, 6, "box14 cider");
      expectClose(result.box14_waRetailLicensees.nonFortified, 22, "box14 nonFortified");
      expectClose(result.box14_waRetailLicensees.fortified, 6, "box14 fortified");
      expectClose(result.box14_waRetailLicensees.total, 34, "box14 total");
    });
    it("box 15 total taxable = 149/566/55 (total 770)", () => {
      expectClose(result.box15_totalTaxable.cider, 149, "box15 cider");
      expectClose(result.box15_totalTaxable.nonFortified, 566, "box15 nonFortified");
      expectClose(result.box15_totalTaxable.fortified, 55, "box15 fortified");
      expectClose(result.box15_totalTaxable.total, 770, "box15 total");
    });
  });

  describe("Box 16 ≡ Box 9 identity", () => {
    it("reconciles (box16 == box9 == 770, state match)", () => {
      expect(result.identity.box16).toBe(770);
      expect(result.identity.box9).toBe(770);
      expect(result.identity.variance).toBe(0);
      expect(result.identity.state).toBe("match");
    });
  });

  describe("Tax computation (boxes 17–24)", () => {
    it("box 17 cider tax = 45.91", () => {
      const cider = result.taxLines.find((l) => l.category === "cider")!;
      expect(cider.tax).toBeCloseTo(45.91, 2);
    });
    it("box 18 non-fortified tax = 491.07", () => {
      const nf = result.taxLines.find((l) => l.category === "nonFortified")!;
      expect(nf.tax).toBeCloseTo(491.07, 2);
    });
    it("box 19 fortified tax = 94.44", () => {
      const f = result.taxLines.find((l) => l.category === "fortified")!;
      expect(f.tax).toBeCloseTo(94.44, 2);
    });
    it("box 20 total wine tax = 631.42", () => {
      expect(result.box20_totalWineTax).toBeCloseTo(631.42, 2);
    });
    it("box 23 wine commission = 49.68 (Non-Fort + Fort only, cider excluded)", () => {
      expect(result.box23_wineCommission).toBeCloseTo(49.68, 2);
    });
    it("box 24 total due = box20 + box21 + box23 = 681.10", () => {
      expect(result.box24_totalDue).toBeCloseTo(681.1, 2);
    });
  });
});

describe("WA LIQ-774 — identity variance flag (never plugged)", () => {
  it("flags channelExceedsRemovals when channel sales exceed TTB removals", () => {
    const ttb: LIQ774TTBInput = {
      reportingPeriod: REPORTING_PERIOD,
      bulkWinesByTaxClass: { hardCider: { line12_total: 1000 } } as any,
      bottledWinesByTaxClass: { hardCider: { line8_removedTaxpaid: 100, line12_export: 0 } } as any,
    };
    const channel: LIQ774ChannelSales = {
      byCategory: {
        cider: { retailGal: 150, licenseeGal: 0 },
        nonFortified: { retailGal: 0, licenseeGal: 0 },
        fortified: { retailGal: 0, licenseeGal: 0 },
      },
    };
    const r = computeLIQ774(ttb, channel);
    expect(r.identity.box9).toBe(100);
    expect(r.identity.box16).toBe(150);
    expect(r.identity.variance).toBe(50);
    expect(r.identity.state).toBe("channelExceedsRemovals");
  });

  it("flags removalsExceedChannel when TTB removals exceed channel sales", () => {
    const ttb: LIQ774TTBInput = {
      reportingPeriod: REPORTING_PERIOD,
      bulkWinesByTaxClass: { hardCider: { line12_total: 1000 } } as any,
      bottledWinesByTaxClass: { hardCider: { line8_removedTaxpaid: 200, line12_export: 0 } } as any,
    };
    const channel: LIQ774ChannelSales = {
      byCategory: {
        cider: { retailGal: 50, licenseeGal: 0 },
        nonFortified: { retailGal: 0, licenseeGal: 0 },
        fortified: { retailGal: 0, licenseeGal: 0 },
      },
    };
    const r = computeLIQ774(ttb, channel);
    expect(r.identity.state).toBe("removalsExceedChannel");
    expect(r.identity.variance).toBe(-150);
  });

  it("non-taxable channels (box 11/12) count toward box 16 identity", () => {
    const ttb: LIQ774TTBInput = {
      reportingPeriod: REPORTING_PERIOD,
      bulkWinesByTaxClass: { hardCider: { line12_total: 1000 } } as any,
      bottledWinesByTaxClass: { hardCider: { line8_removedTaxpaid: 100, line12_export: 0 } } as any,
    };
    const channel: LIQ774ChannelSales = {
      byCategory: {
        cider: { retailGal: 60, licenseeGal: 20, waDistributorGal: 15, wslcbMilitaryExportGal: 5 },
        nonFortified: { retailGal: 0, licenseeGal: 0 },
        fortified: { retailGal: 0, licenseeGal: 0 },
      },
    };
    const r = computeLIQ774(ttb, channel);
    // box16 = box11(15) + box12(5) + box15(60+20=80) = 100 == box9(100)
    expect(r.box15_totalTaxable.total).toBe(80);
    expect(r.box11_waDistributors.total).toBe(15);
    expect(r.box12_wslcbMilitaryExport.total).toBe(5);
    expect(r.identity.box16).toBe(100);
    expect(r.identity.state).toBe("match");
  });
});
