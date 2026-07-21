/**
 * Phase 0 reconciliation diagnostic (READ-ONLY).
 *
 * Deliverable of docs/reconciliation-robustness-plan.md §3 Phase 0:
 *  A. Run checkVolumeBalance (via batch.listForReconciliation) across ALL batches
 *     for 2024/2025/2026 — bucket by status, magnitude, and attributes.
 *  B. Pull the TTB engine's view (generateForm512017 + getReconciliationSummary)
 *     per year — SBD drift, parity warnings, waterfall totals.
 *  C. Diff the recomputed 2024/2025 annual forms against the OFFICIAL filed
 *     numbers (source: filed Form 5120.17, 1/13/2025 and 2/27/2026).
 *
 * Uses the REAL endpoints via appRouter.createCaller (same pattern as
 * ttb-golden-2025.test.ts) — no re-derivation. Makes NO writes.
 *
 * Run from repo root:
 *   pnpm --filter api exec tsx scripts/phase0-recon-diagnostic.ts [--json <outfile>]
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/api has no .env — load the db package's env before importing routers.
config({ path: path.resolve(__dirname, "../../db/.env") });

const YEARS = [2024, 2025, 2026];

// ============================================================
// Official filed numbers (Form 5120.17) — source of truth.
// 2024 filed 1/13/2025; 2025 filed 2/27/2026.
// ============================================================
const FILED: Record<number, any> = {
  2024: {
    sectionA: {
      hardCider: { line1_opening: 0, line2_produced: 1496, line13_bottled: 90, line16_distilling: 264, line20_blending: 42, line29_losses: 39, line31_ending: 1061, line32_total: 1496 },
      wineUnder16: { line1_opening: 0, line5_blending: 127, line13_bottled: 127, line29_losses: 0, line31_ending: 0, line32_total: 127 },
      wine16To21: { line1_opening: 0, line4_spirits: 60, line29_losses: 0, line31_ending: 60, line32_total: 60 },
    },
    totals: { bulkEnding: 1121, packagedEnding: 0, onPremisesEnding: 1121 },
  },
  2025: {
    sectionA: {
      hardCider: { line1_opening: 1061, line2_produced: 4808, line10_classIn: 5, line13_bottled: 149, line16_distilling: 758, line24_classOut: 675, line29_losses: 199, line31_ending: 4093, line32_total: 5874 },
      wineUnder16: { line1_opening: 0, line10_classIn: 675, line13_bottled: 628, line29_losses: 81, line31_ending: 17, line32_total: 731 },
      wine16To21: { line1_opening: 60, line4_spirits: 119, line13_bottled: 55, line24_classOut: 5, line29_losses: 1, line31_ending: 123, line32_total: 179 },
    },
    sectionB: {
      hardCider: { line2_bottled: 149, line8_taxpaid: 149, line20_ending: 0 },
      wineUnder16: { line2_bottled: 628, line8_taxpaid: 566, line20_ending: 62 },
      wine16To21: { line2_bottled: 55, line8_taxpaid: 55, line15_mislabel: 60, line20_ending: 0 },
    },
    totals: { bulkEnding: 4233, packagedEnding: 62, onPremisesEnding: 4295 },
  },
};

const L_PER_GAL = 3.78541;
const toGal = (l: number) => l / L_PER_GAL;
const r1 = (n: number) => Math.round(n * 10) / 10;

// Parse "(+12.3L / 4.5%)" out of the volume_balance details string
function parseDiscrepancyL(details?: string): number | null {
  if (!details) return null;
  const m = details.match(/\((\+?-?\d+(?:\.\d+)?)L/);
  return m ? parseFloat(m[1]) : null;
}

function magBucket(absL: number): string {
  if (absL < 2) return "<2L";
  if (absL < 20) return "2-20L";
  if (absL < 100) return "20-100L";
  if (absL < 500) return "100-500L";
  return ">=500L";
}

const out: any = { generatedFor: "Phase 0 diagnostic", years: {}, filedComparison: {} };

async function main() {
const { appRouter } = await import("../src/routers");

// Admin context — same pattern as ttb-parity/golden tests
const adminUser = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "phase0-diagnostic@example.com",
  role: "admin" as const,
};
const caller = appRouter.createCaller({
  session: { user: adminUser, expires: new Date(Date.now() + 86400000).toISOString() },
  user: adminUser,
});

// ============================================================
// A. Per-batch checkVolumeBalance sweep
// ============================================================
for (const year of YEARS) {
  console.log(`\n================ YEAR ${year} — per-batch validation ================`);
  const res: any = await caller.batch.listForReconciliation({ year });
  const batches: any[] = res.batches;

  const summary: any = {
    statusCounts: res.statusCounts,
    totalBatches: batches.length,
    byCheckFailure: {} as Record<string, number>,
    volumeBalance: {
      pass: 0, warning: 0, fail: 0, noCheck: 0,
      netDiscrepancyL: 0, absDiscrepancyL: 0,
      byMagnitude: {} as Record<string, number>,
      worst: [] as any[],
    },
    attributes: {
      failWithParent: 0, failWithoutParent: 0,
      failManuallyCorrected: 0,
      failByProductType: {} as Record<string, number>,
      failByCategory: {} as Record<string, number>,
    },
  };

  const details: any[] = [];
  for (const b of batches) {
    const checks: any[] = b.validation?.checks ?? [];
    for (const c of checks) {
      if (c.status !== "pass") {
        summary.byCheckFailure[`${c.id}:${c.status}`] = (summary.byCheckFailure[`${c.id}:${c.status}`] ?? 0) + 1;
      }
    }
    const vb = checks.find((c) => c.id === "volume_balance");
    if (!vb) { summary.volumeBalance.noCheck++; continue; }
    summary.volumeBalance[vb.status as "pass" | "warning" | "fail"]++;
    const d = parseDiscrepancyL(vb.details);
    if (d !== null) {
      summary.volumeBalance.netDiscrepancyL += d;
      summary.volumeBalance.absDiscrepancyL += Math.abs(d);
      const bucket = magBucket(Math.abs(d));
      summary.volumeBalance.byMagnitude[bucket] = (summary.volumeBalance.byMagnitude[bucket] ?? 0) + 1;
    }
    if (vb.status !== "pass") {
      const pt = b.productType ?? "cider";
      summary.attributes.failByProductType[pt] = (summary.attributes.failByProductType[pt] ?? 0) + 1;
      summary.attributes.failByCategory[b.category ?? "?"] = (summary.attributes.failByCategory[b.category ?? "?"] ?? 0) + 1;
      if (b.parentBatchId) summary.attributes.failWithParent++; else summary.attributes.failWithoutParent++;
      if (b.volumeManuallyCorrected) summary.attributes.failManuallyCorrected++;
      details.push({
        name: b.customName || b.name || b.batchNumber,
        batchNumber: b.batchNumber,
        status: vb.status,
        discrepancyL: d,
        details: vb.details,
        productType: b.productType,
        category: b.category,
        parentBatchId: !!b.parentBatchId,
        manuallyCorrected: !!b.volumeManuallyCorrected,
        verifiedForYear: !!b.verifiedForYear,
        currentVolumeLiters: b.currentVolumeLiters,
        initialVolumeLiters: b.initialVolumeLiters,
        otherFailedChecks: checks.filter((c) => c.status !== "pass" && c.id !== "volume_balance").map((c) => `${c.id}:${c.status}`),
      });
    }
  }
  details.sort((a, b) => Math.abs(b.discrepancyL ?? 0) - Math.abs(a.discrepancyL ?? 0));
  summary.volumeBalance.worst = details.slice(0, 15);
  summary.volumeBalance.netDiscrepancyL = r1(summary.volumeBalance.netDiscrepancyL);
  summary.volumeBalance.absDiscrepancyL = r1(summary.volumeBalance.absDiscrepancyL);
  summary.volumeBalance.netDiscrepancyGal = r1(toGal(summary.volumeBalance.netDiscrepancyL));
  summary.volumeBalance.absDiscrepancyGal = r1(toGal(summary.volumeBalance.absDiscrepancyL));

  console.log(JSON.stringify({ ...summary, volumeBalance: { ...summary.volumeBalance, worst: undefined } }, null, 2));
  console.log(`Worst offenders (${Math.min(15, details.length)} of ${details.length} non-pass):`);
  for (const d of details.slice(0, 15)) {
    console.log(`  ${d.status.toUpperCase().padEnd(7)} ${String(d.discrepancyL ?? "?").padStart(9)}L  ${d.name} [${d.batchNumber}] parent=${d.parentBatchId} corrected=${d.manuallyCorrected}`);
  }
  out.years[year] = { perBatch: summary, nonPassDetails: details };
}

// ============================================================
// B. TTB engine view per year (form + reconciliation summary)
// ============================================================
for (const year of YEARS) {
  console.log(`\n================ YEAR ${year} — TTB engine ================`);
  const yearOut: any = {};
  try {
    const formRes: any = await caller.ttb.generateForm512017({ periodType: "annual", year });
    const form = formRes.formData ?? formRes;
    yearOut.formTopLevelKeys = Object.keys(form);
    yearOut.form = form;
    console.log(`generateForm512017 OK — keys: ${Object.keys(form).join(", ")}`);
  } catch (e: any) {
    yearOut.formError = e.message;
    console.log(`generateForm512017 FAILED: ${e.message}`);
  }
  try {
    const recon: any = await caller.ttb.getReconciliationSummary({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
    yearOut.reconKeys = Object.keys(recon);
    yearOut.reconTotals = recon.totals;
    yearOut.parityWarnings = recon.parityWarnings ?? recon.warnings ?? null;
    // capture any per-batch SBD drift array if the endpoint exposes one
    for (const k of Object.keys(recon)) {
      const v = (recon as any)[k];
      if (v && typeof v === "object" && Array.isArray(v.batches) && v.batches[0]?.driftLiters !== undefined) {
        yearOut.sbdBatchDrift = v.batches
          .filter((b: any) => Math.abs(b.driftLiters) > 0.5)
          .sort((a: any, b: any) => Math.abs(b.driftLiters) - Math.abs(a.driftLiters));
      }
    }
    console.log(`getReconciliationSummary OK — keys: ${Object.keys(recon).join(", ")}`);
    console.log("totals:", JSON.stringify(recon.totals, null, 2));
    if (yearOut.parityWarnings) console.log("parityWarnings:", JSON.stringify(yearOut.parityWarnings, null, 2));
  } catch (e: any) {
    yearOut.reconError = e.message;
    console.log(`getReconciliationSummary FAILED: ${e.message}`);
  }
  out.years[year].ttb = yearOut;
}

// ============================================================
// C. Recomputed vs FILED (2024, 2025)
// ============================================================
// The form's internal structure is dumped above; here we do a best-effort
// automatic diff on Section A per tax class if the shape matches the golden
// test's (sectionA.<class>.<lineKey>). Anything unmatched is reported raw
// for manual comparison in the report.
for (const year of [2024, 2025]) {
  const form = out.years[year]?.ttb?.form;
  if (!form) continue;
  console.log(`\n================ YEAR ${year} — recomputed vs FILED ================`);
  const cmp: any = {};
  const sectionA = form.sectionA ?? form.partI?.sectionA;
  if (sectionA) {
    for (const [cls, filedLines] of Object.entries<any>(FILED[year].sectionA)) {
      const sys = sectionA[cls];
      if (!sys) { cmp[cls] = { error: `class ${cls} missing from system form` }; continue; }
      cmp[cls] = {};
      for (const [lineKey, filedVal] of Object.entries<any>(filedLines)) {
        // try exact key then the golden-test naming
        const sysVal = sys[lineKey] ?? sys[lineKey.replace(/_[a-zA-Z]+$/, "")] ?? null;
        cmp[cls][lineKey] = {
          filed: filedVal,
          system: typeof sysVal === "number" ? r1(sysVal) : sysVal,
          delta: typeof sysVal === "number" ? r1(sysVal - filedVal) : "n/a",
        };
      }
    }
  } else {
    cmp.note = "sectionA not found at form.sectionA — inspect form dump in JSON output";
  }
  out.filedComparison[year] = cmp;
  console.log(JSON.stringify(cmp, null, 2));
}

// ============================================================
// Write full JSON
// ============================================================
const jsonIdx = process.argv.indexOf("--json");
const outPath = jsonIdx >= 0 && process.argv[jsonIdx + 1]
  ? process.argv[jsonIdx + 1]
  : path.resolve(__dirname, "phase0-diagnostic-output.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nFull JSON written to ${outPath}`);
process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
