/**
 * Unit tests for filing-frequency determination (Phase 7 C1).
 *
 * Verbose by design: each case names the regulation and threshold it exercises
 * so a failure points straight at the rule that broke. Threshold edges are
 * tested at exactly the limit because the regs read "not more than" / "does not
 * exceed", so a figure AT the limit still qualifies (<=, not <).
 */
import { describe, it, expect } from "vitest";
import {
  determineFilingFrequency,
  determineWaStateFrequency,
  TTB_RETURN_ANNUAL_MAX_USD,
  TTB_RETURN_QUARTERLY_MAX_USD,
  TTB_REPORT_ANNUAL_MAX_GAL,
  TTB_REPORT_QUARTERLY_MAX_GAL,
  WA_STATE_ANNUAL_MAX_GAL,
} from "../filing-frequency";

// --- guard the encoded thresholds against silent drift --------------------

describe("filing-frequency thresholds (27 CFR 24.271 / 24.300)", () => {
  it("encodes the federal dollar and gallon limits verbatim", () => {
    expect(TTB_RETURN_ANNUAL_MAX_USD).toBe(1000);
    expect(TTB_RETURN_QUARTERLY_MAX_USD).toBe(50000);
    expect(TTB_REPORT_ANNUAL_MAX_GAL).toBe(20000);
    expect(TTB_REPORT_QUARTERLY_MAX_GAL).toBe(60000);
  });

  it("encodes the WA LIQ-774 annual-filing volume ceiling", () => {
    expect(WA_STATE_ANNUAL_MAX_GAL).toBe(6000);
  });
});

// --- federal: tax RETURN period (24.271(b)(1)) ----------------------------

describe("determineFilingFrequency — tax return period", () => {
  // Keep on-hand tiny so the report frequency never masks the return period.
  const smallOnHand = { maxMonthlyOnHandGal: 100, maxQuarterlyOnHandGal: 100 };

  it("ANNUAL when both prior and expected are exactly $1,000 (at the limit qualifies)", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 1000,
      expectedCurrentYearTaxUsd: 1000,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("annual");
  });

  it("drops from ANNUAL to QUARTERLY one dollar over the $1,000 limit", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 1001,
      expectedCurrentYearTaxUsd: 1001,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("quarterly");
  });

  it("requires BOTH years under $1,000 for ANNUAL (prior low, current high → quarterly)", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 2000,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("quarterly");
  });

  it("QUARTERLY when both prior and expected are exactly $50,000 (at the limit qualifies)", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 50000,
      expectedCurrentYearTaxUsd: 50000,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("quarterly");
  });

  it("drops from QUARTERLY to SEMIMONTHLY one dollar over the $50,000 limit", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 50001,
      expectedCurrentYearTaxUsd: 50001,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("semimonthly");
  });

  it("SEMIMONTHLY when prior year is under limit but current year is expected to blow past $50,000", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 40000,
      expectedCurrentYearTaxUsd: 80000,
      ...smallOnHand,
    });
    expect(r.returnPeriod).toBe("semimonthly");
  });

  it("includes a mid-year-exceedance / 14-day warning whenever on a reduced-frequency return", () => {
    const annual = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      ...smallOnHand,
    });
    expect(annual.reasons.some((s) => s.includes("14 days"))).toBe(true);

    const quarterly = determineFilingFrequency({
      priorYearTaxUsd: 10000,
      expectedCurrentYearTaxUsd: 10000,
      ...smallOnHand,
    });
    expect(quarterly.reasons.some((s) => s.includes("14 days"))).toBe(true);
  });

  it("does NOT include the 14-day warning when semimonthly (no reduced procedure to lose)", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 100000,
      expectedCurrentYearTaxUsd: 100000,
      ...smallOnHand,
    });
    expect(r.reasons.some((s) => s.includes("14 days"))).toBe(false);
  });

  it("every reason string carries a CFR citation", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      ...smallOnHand,
    });
    for (const reason of r.reasons) {
      expect(reason).toMatch(/27 CFR 24\.(271|300)/);
    }
  });

  it("echoes the encoded limits back in the result", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      ...smallOnHand,
    });
    expect(r.limits).toEqual({
      returnAnnualMaxUsd: 1000,
      returnQuarterlyMaxUsd: 50000,
      reportAnnualMaxGal: 20000,
      reportQuarterlyMaxGal: 60000,
    });
  });
});

// --- federal: operations REPORT frequency (24.300(g)) ---------------------

describe("determineFilingFrequency — operations report frequency", () => {
  it("ANNUAL report when filing annual returns and peak monthly on hand is exactly 20,000 gal", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      maxMonthlyOnHandGal: 20000,
      maxQuarterlyOnHandGal: 20000,
    });
    expect(r.returnPeriod).toBe("annual");
    expect(r.reportFrequency).toBe("annual");
  });

  it("annual filer just over 20,000 gal/month falls back to QUARTERLY report (still under 60,000/quarter)", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      maxMonthlyOnHandGal: 20001,
      maxQuarterlyOnHandGal: 45000,
    });
    expect(r.returnPeriod).toBe("annual");
    expect(r.reportFrequency).toBe("quarterly");
  });

  it("annual filer over 60,000 gal/quarter falls all the way to MONTHLY report", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 500,
      expectedCurrentYearTaxUsd: 500,
      maxMonthlyOnHandGal: 25000,
      maxQuarterlyOnHandGal: 60001,
    });
    expect(r.returnPeriod).toBe("annual");
    expect(r.reportFrequency).toBe("monthly");
  });

  it("QUARTERLY report when filing quarterly returns and peak quarterly on hand is exactly 60,000 gal", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 10000,
      expectedCurrentYearTaxUsd: 10000,
      maxMonthlyOnHandGal: 55000,
      maxQuarterlyOnHandGal: 60000,
    });
    expect(r.returnPeriod).toBe("quarterly");
    expect(r.reportFrequency).toBe("quarterly");
  });

  it("MONTHLY report when quarterly filer's peak quarterly on hand is one gallon over 60,000", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 10000,
      expectedCurrentYearTaxUsd: 10000,
      maxMonthlyOnHandGal: 55000,
      maxQuarterlyOnHandGal: 60001,
    });
    expect(r.returnPeriod).toBe("quarterly");
    expect(r.reportFrequency).toBe("monthly");
  });

  it("semimonthly filer always files MONTHLY reports regardless of tiny on-hand", () => {
    const r = determineFilingFrequency({
      priorYearTaxUsd: 100000,
      expectedCurrentYearTaxUsd: 100000,
      maxMonthlyOnHandGal: 1,
      maxQuarterlyOnHandGal: 1,
    });
    expect(r.returnPeriod).toBe("semimonthly");
    expect(r.reportFrequency).toBe("monthly");
  });
});

// --- WA state (LIQ-774) ---------------------------------------------------

describe("determineWaStateFrequency — approval matrix", () => {
  it("ANNUAL when at exactly 6,000 gal AND approval on file (at the limit qualifies)", () => {
    const r = determineWaStateFrequency({
      taxableGallonsPerYear: 6000,
      boardApprovalOnFile: true,
    });
    expect(r.eligible).toBe(true);
    expect(r.frequency).toBe("annual");
  });

  it("eligible but UNAPPROVED → MONTHLY with a reason to request Board approval", () => {
    const r = determineWaStateFrequency({
      taxableGallonsPerYear: 4000,
      boardApprovalOnFile: false,
    });
    expect(r.eligible).toBe(true);
    expect(r.frequency).toBe("monthly");
    expect(r.reasons.some((s) => /request approval|Board approval/i.test(s))).toBe(true);
  });

  it("over 6,000 gal with approval on file is still MONTHLY (volume disqualifies)", () => {
    const r = determineWaStateFrequency({
      taxableGallonsPerYear: 6001,
      boardApprovalOnFile: true,
    });
    expect(r.eligible).toBe(false);
    expect(r.frequency).toBe("monthly");
  });

  it("over 6,000 gal and unapproved is MONTHLY and NOT eligible", () => {
    const r = determineWaStateFrequency({
      taxableGallonsPerYear: 10000,
      boardApprovalOnFile: false,
    });
    expect(r.eligible).toBe(false);
    expect(r.frequency).toBe("monthly");
  });
});
