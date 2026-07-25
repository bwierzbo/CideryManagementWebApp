/**
 * Filing-frequency determination for federal (TTB) and Washington State (WSLCB).
 *
 * This module is a PURE calculator: it takes already-computed numeric inputs
 * (prior/current-year tax liability, peak on-hand gallons, WA taxable gallons)
 * and returns the required filing cadence with plain-language reasons that cite
 * the governing regulation. It performs no I/O and knows nothing about the DB —
 * the API layer feeds it real numbers (see ttb.getFilingFrequencyDetermination).
 *
 * REGULATORY BASIS
 * ----------------
 * Tax RETURN periods — 27 CFR 24.271(b)(1):
 *   - Default: SEMIMONTHLY.
 *   - QUARTERLY: proprietor was NOT liable for more than $50,000 in wine excise
 *     tax in the preceding calendar year AND reasonably expects to be liable for
 *     not more than $50,000 during the current calendar year.
 *   - ANNUAL: not liable for more than $1,000 in the preceding calendar year AND
 *     reasonably expects to be liable for not more than $1,000 during the current
 *     calendar year.
 *   - The regs say "not more than", so a figure exactly AT the limit still
 *     qualifies (<=, not <).
 *   - Mid-year exceedance ends the quarterly/annual procedure immediately; the
 *     return for the period in which the limit was exceeded is due within 14 days
 *     of the close of that period.
 *
 * OPERATIONS REPORT (Form 5120.17) — 27 CFR 24.300(g):
 *   - Default: MONTHLY.
 *   - QUARTERLY: proprietor files quarterly tax returns AND does not expect the
 *     sum of bulk and bottled wine on hand (all tax classes) to exceed 60,000
 *     gallons in any one quarter.
 *   - ANNUAL: proprietor files annual tax returns AND does not expect the sum of
 *     bulk and bottled wine on hand to exceed 20,000 gallons in any one month.
 *   - "exceed" is a strict >, so a figure exactly at 60,000 / 20,000 gal still
 *     qualifies (<=).
 *
 * WA WSLCB Domestic Winery Summary Tax Report (LIQ-774):
 *   - Default: MONTHLY, due the 20th of the following month.
 *   - ANNUAL (due Jan 20): WA taxable sales are not more than 6,000 gallons per
 *     calendar year AND the Board has approved annual filing. Both conditions are
 *     required — being under the volume limit only makes a winery *eligible* to
 *     request approval; without approval on file the winery still files monthly.
 */

// --- Federal (TTB) thresholds ---------------------------------------------

/** Tax-return period thresholds, 27 CFR 24.271(b)(1). "Not more than", so <=. */
export const TTB_RETURN_ANNUAL_MAX_USD = 1000;
export const TTB_RETURN_QUARTERLY_MAX_USD = 50000;

/** Operations-report thresholds, 27 CFR 24.300(g). "Exceed" is strict >, so <=. */
export const TTB_REPORT_ANNUAL_MAX_GAL = 20000;
export const TTB_REPORT_QUARTERLY_MAX_GAL = 60000;

/** WA LIQ-774 annual-filing volume ceiling. "Not more than", so <=. */
export const WA_STATE_ANNUAL_MAX_GAL = 6000;

export type TtbReturnPeriod = "annual" | "quarterly" | "semimonthly";
export type TtbReportFrequency = "annual" | "quarterly" | "monthly";
export type WaStateFrequency = "monthly" | "annual";

export interface FilingFrequencyInput {
  /** Wine excise tax liability for the preceding calendar year, in USD. */
  priorYearTaxUsd: number;
  /** Reasonably-expected wine excise tax liability for the current year, USD. */
  expectedCurrentYearTaxUsd: number;
  /**
   * Peak sum of bulk + bottled wine on hand (all tax classes) in any single
   * month of the reporting horizon, in gallons. Gates the ANNUAL report.
   */
  maxMonthlyOnHandGal: number;
  /**
   * Peak sum of bulk + bottled wine on hand (all tax classes) in any single
   * quarter of the reporting horizon, in gallons. Gates the QUARTERLY report.
   */
  maxQuarterlyOnHandGal: number;
}

export interface FilingFrequencyLimits {
  returnAnnualMaxUsd: number;
  returnQuarterlyMaxUsd: number;
  reportAnnualMaxGal: number;
  reportQuarterlyMaxGal: number;
}

export interface FilingFrequencyResult {
  returnPeriod: TtbReturnPeriod;
  reportFrequency: TtbReportFrequency;
  reasons: string[];
  limits: FilingFrequencyLimits;
}

export interface WaStateFrequencyInput {
  /** Total WA taxable sales for the calendar year, in gallons. */
  taxableGallonsPerYear: number;
  /** Whether the Board has approved annual filing for this winery. */
  boardApprovalOnFile: boolean;
}

export interface WaStateFrequencyResult {
  frequency: WaStateFrequency;
  /** True when volume qualifies for annual filing (ignoring approval). */
  eligible: boolean;
  reasons: string[];
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtGal(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} gal`;
}

/**
 * Determine the required federal tax-return period and operations-report
 * frequency from computed tax liability and peak on-hand volume.
 *
 * The report frequency is coupled to the return period per 27 CFR 24.300(g):
 * only a proprietor eligible for quarterly/annual returns may file
 * quarterly/annual reports, and even then only if peak on-hand stays under the
 * volume ceilings. Annual-return eligibility is a strict subset of quarterly
 * eligibility ($1,000 <= $50,000), so an annual filer whose on-hand exceeds the
 * 20,000-gal monthly ceiling can still drop to quarterly reports if under the
 * 60,000-gal quarterly ceiling before falling all the way to monthly.
 */
export function determineFilingFrequency(
  input: FilingFrequencyInput
): FilingFrequencyResult {
  const {
    priorYearTaxUsd,
    expectedCurrentYearTaxUsd,
    maxMonthlyOnHandGal,
    maxQuarterlyOnHandGal,
  } = input;

  const reasons: string[] = [];

  // --- Tax return period (27 CFR 24.271(b)(1)) ---------------------------
  let returnPeriod: TtbReturnPeriod;
  if (
    priorYearTaxUsd <= TTB_RETURN_ANNUAL_MAX_USD &&
    expectedCurrentYearTaxUsd <= TTB_RETURN_ANNUAL_MAX_USD
  ) {
    returnPeriod = "annual";
    reasons.push(
      `Tax returns: ANNUAL. Prior-year wine excise tax ${fmtUsd(priorYearTaxUsd)} and expected current-year ${fmtUsd(expectedCurrentYearTaxUsd)} are both not more than ${fmtUsd(TTB_RETURN_ANNUAL_MAX_USD)} (27 CFR 24.271(b)(1)).`
    );
  } else if (
    priorYearTaxUsd <= TTB_RETURN_QUARTERLY_MAX_USD &&
    expectedCurrentYearTaxUsd <= TTB_RETURN_QUARTERLY_MAX_USD
  ) {
    returnPeriod = "quarterly";
    reasons.push(
      `Tax returns: QUARTERLY. Prior-year wine excise tax ${fmtUsd(priorYearTaxUsd)} and expected current-year ${fmtUsd(expectedCurrentYearTaxUsd)} are both not more than ${fmtUsd(TTB_RETURN_QUARTERLY_MAX_USD)} (27 CFR 24.271(b)(1)).`
    );
  } else {
    returnPeriod = "semimonthly";
    const which =
      priorYearTaxUsd > TTB_RETURN_QUARTERLY_MAX_USD
        ? `Prior-year wine excise tax ${fmtUsd(priorYearTaxUsd)}`
        : `Expected current-year wine excise tax ${fmtUsd(expectedCurrentYearTaxUsd)}`;
    reasons.push(
      `Tax returns: SEMIMONTHLY (default). ${which} exceeds ${fmtUsd(TTB_RETURN_QUARTERLY_MAX_USD)}, so neither the annual nor quarterly procedure is available (27 CFR 24.271(b)(1)).`
    );
  }

  // Mid-year exceedance warning applies whenever on a reduced-frequency
  // procedure (27 CFR 24.271(b)(1)).
  if (returnPeriod !== "semimonthly") {
    reasons.push(
      `Note: if liability exceeds the ${returnPeriod === "annual" ? fmtUsd(TTB_RETURN_ANNUAL_MAX_USD) : fmtUsd(TTB_RETURN_QUARTERLY_MAX_USD)} limit mid-year, the reduced-frequency procedure ends immediately and the return for that period is due within 14 days of its close (27 CFR 24.271(b)(1)).`
    );
  }

  // --- Operations report frequency (27 CFR 24.300(g)) --------------------
  let reportFrequency: TtbReportFrequency;
  if (returnPeriod === "semimonthly") {
    reportFrequency = "monthly";
    reasons.push(
      `Operations reports: MONTHLY. Only proprietors filing quarterly or annual tax returns may file reduced-frequency reports (27 CFR 24.300(g)).`
    );
  } else if (
    returnPeriod === "annual" &&
    maxMonthlyOnHandGal <= TTB_REPORT_ANNUAL_MAX_GAL
  ) {
    reportFrequency = "annual";
    reasons.push(
      `Operations reports: ANNUAL. Filing annual tax returns and peak bulk+bottled wine on hand ${fmtGal(maxMonthlyOnHandGal)} does not exceed ${fmtGal(TTB_REPORT_ANNUAL_MAX_GAL)} in any one month (27 CFR 24.300(g)).`
    );
  } else if (maxQuarterlyOnHandGal <= TTB_REPORT_QUARTERLY_MAX_GAL) {
    reportFrequency = "quarterly";
    if (returnPeriod === "annual") {
      reasons.push(
        `Operations reports: QUARTERLY. Eligible for annual tax returns but peak bulk+bottled wine on hand ${fmtGal(maxMonthlyOnHandGal)} exceeds the ${fmtGal(TTB_REPORT_ANNUAL_MAX_GAL)} monthly ceiling for annual reports; peak quarterly on hand ${fmtGal(maxQuarterlyOnHandGal)} does not exceed ${fmtGal(TTB_REPORT_QUARTERLY_MAX_GAL)} (27 CFR 24.300(g)).`
      );
    } else {
      reasons.push(
        `Operations reports: QUARTERLY. Filing quarterly tax returns and peak bulk+bottled wine on hand ${fmtGal(maxQuarterlyOnHandGal)} does not exceed ${fmtGal(TTB_REPORT_QUARTERLY_MAX_GAL)} in any one quarter (27 CFR 24.300(g)).`
      );
    }
  } else {
    reportFrequency = "monthly";
    reasons.push(
      `Operations reports: MONTHLY (default). Peak bulk+bottled wine on hand ${fmtGal(maxQuarterlyOnHandGal)} exceeds the ${fmtGal(TTB_REPORT_QUARTERLY_MAX_GAL)} quarterly ceiling, so reduced-frequency reporting is unavailable (27 CFR 24.300(g)).`
    );
  }

  return {
    returnPeriod,
    reportFrequency,
    reasons,
    limits: {
      returnAnnualMaxUsd: TTB_RETURN_ANNUAL_MAX_USD,
      returnQuarterlyMaxUsd: TTB_RETURN_QUARTERLY_MAX_USD,
      reportAnnualMaxGal: TTB_REPORT_ANNUAL_MAX_GAL,
      reportQuarterlyMaxGal: TTB_REPORT_QUARTERLY_MAX_GAL,
    },
  };
}

/**
 * Determine the required WA WSLCB (LIQ-774) filing frequency.
 *
 * Annual filing (due Jan 20) requires BOTH WA taxable sales not more than
 * 6,000 gal for the calendar year AND Board approval on file. Being under the
 * volume limit only makes the winery *eligible*; without approval it still
 * files monthly and should request approval from the Board.
 */
export function determineWaStateFrequency(
  input: WaStateFrequencyInput
): WaStateFrequencyResult {
  const { taxableGallonsPerYear, boardApprovalOnFile } = input;
  const reasons: string[] = [];

  const eligible = taxableGallonsPerYear <= WA_STATE_ANNUAL_MAX_GAL;

  let frequency: WaStateFrequency;
  if (eligible && boardApprovalOnFile) {
    frequency = "annual";
    reasons.push(
      `WA state (LIQ-774): ANNUAL, due Jan 20. WA taxable sales ${fmtGal(taxableGallonsPerYear)} are not more than ${fmtGal(WA_STATE_ANNUAL_MAX_GAL)} and Board approval for annual filing is on file.`
    );
  } else if (eligible && !boardApprovalOnFile) {
    frequency = "monthly";
    reasons.push(
      `WA state (LIQ-774): MONTHLY, due the 20th. WA taxable sales ${fmtGal(taxableGallonsPerYear)} are within the ${fmtGal(WA_STATE_ANNUAL_MAX_GAL)} annual-filing limit, but Board approval for annual filing is not on file — request approval from the WSLCB to switch to annual filing.`
    );
  } else {
    frequency = "monthly";
    reasons.push(
      `WA state (LIQ-774): MONTHLY, due the 20th. WA taxable sales ${fmtGal(taxableGallonsPerYear)} exceed the ${fmtGal(WA_STATE_ANNUAL_MAX_GAL)} annual-filing limit.`
    );
  }

  return { frequency, eligible, reasons };
}
