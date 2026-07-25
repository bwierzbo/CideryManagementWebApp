/**
 * LIQ-774 generator integration test (Phase 7 C6).
 *
 * Runs `ttb.generateLIQ774` for 2025 annual against the REAL production DB. It
 * asserts SHAPE + the box16≡box9 identity BEHAVIOR only — it does NOT pin
 * live-data box values. The lib golden fixture (packages/lib .../liq774.test.ts)
 * is the regression guard for the numbers; here we verify the generator wires
 * the federal form + channel-sales query together and surfaces the identity.
 *
 * The live recompute is EXPECTED to diverge from the filed LIQ-774 for the same
 * documented reason as the 5120.17 golden deltas (the fall-2025 data-entry
 * backlog booked with 2026 dates). We log the comparison for audit but do not
 * assert on it.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "..";
import {
  LIQ774_CIDER_TAX_RATE_PER_GAL,
  LIQ774_WINE_COMMISSION_RATE_PER_GAL,
} from "lib";

const testContext = {
  session: {
    user: {
      id: "00000000-0000-0000-0000-000000000099",
      email: "liq774-test@example.com",
      role: "admin" as const,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  },
  user: {
    id: "00000000-0000-0000-0000-000000000099",
    email: "liq774-test@example.com",
    role: "admin" as const,
  },
};

// Filed 2025 LIQ-774 anchors (for the audit log only — NOT asserted here).
const FILED_LIQ774_2025 = {
  box1: 6762,
  box2: 770,
  box20: 631.42,
  box23: 49.68,
};

describe("LIQ-774 generator — 2025 annual (live)", () => {
  let result: any;

  beforeAll(async () => {
    const caller = appRouter.createCaller(testContext);
    result = await caller.ttb.generateLIQ774({ periodType: "annual", year: 2025 });
  }, 90000);

  it("returns a fully-shaped LIQ774Data", () => {
    const d = result.liq774;
    expect(d).toBeDefined();
    // Category-value boxes present with the three columns + total.
    for (const box of [
      "box1_totalNetGallons",
      "box2_totalAtWinery",
      "box9_totalRemovals",
      "box13_wineryRetail",
      "box14_waRetailLicensees",
      "box15_totalTaxable",
      "box16_reconciliation",
    ]) {
      expect(d[box], box).toBeDefined();
      expect(typeof d[box].cider).toBe("number");
      expect(typeof d[box].nonFortified).toBe("number");
      expect(typeof d[box].fortified).toBe("number");
      expect(d[box].total).toBe(
        d[box].cider + d[box].nonFortified + d[box].fortified,
      );
    }
    // Tax scalars present.
    expect(typeof d.box20_totalWineTax).toBe("number");
    expect(typeof d.box23_wineCommission).toBe("number");
    expect(typeof d.box24_totalDue).toBe("number");
    expect(d.taxLines).toHaveLength(3);
  });

  it("box 15 = box 13 + box 14 per category (channel-sales identity)", () => {
    const d = result.liq774;
    for (const cat of ["cider", "nonFortified", "fortified"] as const) {
      expect(
        d.box15_totalTaxable[cat],
        `box15 ${cat} = box13 + box14`,
      ).toBe(d.box13_wineryRetail[cat] + d.box14_waRetailLicensees[cat]);
    }
  });

  it("surfaces the box16 ≡ box9 identity as a 3-state flag (never plugged)", () => {
    const d = result.liq774;
    expect(d.identity).toBeDefined();
    expect(["match", "channelExceedsRemovals", "removalsExceedChannel"]).toContain(
      d.identity.state,
    );
    // variance is exactly box16 − box9, and the state agrees with it.
    expect(d.identity.variance).toBe(d.identity.box16 - d.identity.box9);
    if (Math.abs(d.identity.variance) <= d.identity.toleranceGal) {
      expect(d.identity.state).toBe("match");
    } else if (d.identity.variance > 0) {
      expect(d.identity.state).toBe("channelExceedsRemovals");
    } else {
      expect(d.identity.state).toBe("removalsExceedChannel");
    }
  });

  it("tax boxes derive from box15 at the spec rates", () => {
    const d = result.liq774;
    const cider = d.taxLines.find((l: any) => l.category === "cider");
    expect(cider.taxRate).toBe(LIQ774_CIDER_TAX_RATE_PER_GAL);
    // box 23 = $0.08/gal on Non-Fortified + Fortified box15 only (cider excluded).
    const expectedCommission =
      Math.round(
        (d.box15_totalTaxable.nonFortified + d.box15_totalTaxable.fortified) *
          LIQ774_WINE_COMMISSION_RATE_PER_GAL *
          100,
      ) / 100;
    expect(d.box23_wineCommission).toBeCloseTo(expectedCommission, 2);
  });

  it("reports channel-attribution diagnostics", () => {
    expect(result.channelAttribution).toBeDefined();
    expect(typeof result.channelAttribution.distributionsCount).toBe("number");
    expect(typeof result.channelAttribution.uncategorizedGal).toBe("number");
  });

  it("logs live-recompute vs filed LIQ-774 for audit (not asserted)", () => {
    const d = result.liq774;
    console.log(
      `[LIQ774-LIVE] box1 net=${d.box1_totalNetGallons.total} (filed ${FILED_LIQ774_2025.box1}), ` +
        `box2/9 removals=${d.box2_totalAtWinery.total}/${d.box9_totalRemovals.total} (filed ${FILED_LIQ774_2025.box2}), ` +
        `box15 taxable=${d.box15_totalTaxable.cider}/${d.box15_totalTaxable.nonFortified}/${d.box15_totalTaxable.fortified} (=${d.box15_totalTaxable.total}), ` +
        `box20 tax=${d.box20_totalWineTax} (filed ${FILED_LIQ774_2025.box20}), ` +
        `box23 commission=${d.box23_wineCommission} (filed ${FILED_LIQ774_2025.box23}), ` +
        `box24 due=${d.box24_totalDue}`,
    );
    console.log(
      `[LIQ774-LIVE] identity: box16=${d.identity.box16} vs box9=${d.identity.box9}, ` +
        `variance=${d.identity.variance.toFixed(1)} gal, state=${d.identity.state}; ` +
        `distributions=${result.channelAttribution.distributionsCount}, ` +
        `uncategorized=${result.channelAttribution.uncategorizedGal} gal`,
    );
    expect(true).toBe(true);
  });
});
