/**
 * Reconciliation health check (Phase 5 — automated-reconciliation PRD).
 *
 * A single read-only pass over the EXISTING reconciliation engines — no new
 * formulas:
 *   - per-batch validation counts via `buildReconciliationBatchList` (the
 *     reconciliation-page path);
 *   - `ttb.getReconciliationSummary` for the post-adjustment total unexplained
 *     variance and the Phase-6 checkpoint drift;
 *   - `ttb.generateForm512017` for each is_filed year to read its Phase-4
 *     filed-vs-recompute drift, and for the current year to read openingWarnings.
 *
 * Rolls the signals up into clean / attention / drift, compares against the
 * previous run (alert-on-change), then writes ONE `reconciliation_runs` row and
 * ONE summarizing `audit_logs` entry. Callable from the admin tRPC mutation and
 * the guarded cron route (both pass a ctx an in-process caller can use).
 */
import { db, reconciliationRuns, ttbPeriodSnapshots, auditLogs } from "db";
import { eq, and, desc } from "drizzle-orm";
import type { Context } from "../trpc";
import { buildReconciliationBatchList } from "./reconciliation-batch-list";

export type HealthStatus = "clean" | "attention" | "drift";

/** Per-year filed-drift readout persisted in `reconciliation_runs.filed_drift`. */
export interface FiledDriftReadout {
  status: "clean" | "expected_only" | "new_drift" | "error";
  newDriftCount: number;
  maxResidualGal: number;
}

const STATUS_RANK: Record<HealthStatus, number> = {
  clean: 0,
  attention: 1,
  drift: 2,
};

// Aggregate tolerance mirrors completeReconciliation's AGG_TOL — beyond it the
// numbers are not lock-clean, so the health check flags "attention".
const AGG_TOL_GAL = 1.0;

export interface HealthCheckRun {
  id: string;
  ranAt: Date;
  trigger: "cron" | "manual";
  status: HealthStatus;
  perBatchFailCount: number;
  perBatchWarnCount: number;
  totalUnexplainedGal: string | null;
  checkpointDriftStatus: string | null;
  filedDrift: Record<string, FiledDriftReadout>;
  details: Record<string, unknown>;
  durationMs: number | null;
}

export interface HealthCheckResult {
  run: HealthCheckRun;
  changedSinceLastRun: boolean;
  changes: string[];
}

export async function runReconciliationHealthCheck(
  ctx: Context,
  opts: { trigger: "cron" | "manual" },
): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const currentYear = new Date().getFullYear();

  // Deferred dynamic import to avoid an import-time circular dependency
  // (appRouter mounts the routers, which import services). Dynamic import (not
  // require) goes through the same resolver as static imports, so it also works
  // under vitest's module runner where require() of a .ts source fails.
  const { appRouter } = await import("../routers/index");
  const caller = appRouter.createCaller(ctx);

  // ---- 1. Per-batch validation counts (same path as the reconciliation page) --
  const { validationMap } = await buildReconciliationBatchList({ year: currentYear });
  let perBatchFailCount = 0;
  let perBatchWarnCount = 0;
  for (const v of validationMap.values()) {
    if (v.status === "fail") perBatchFailCount++;
    else if (v.status === "warning") perBatchWarnCount++;
  }

  // ---- 2. Reconciliation summary (as-of today): unexplained + checkpoint drift -
  const summary: any = await caller.ttb.getReconciliationSummary({});
  const hasOpeningBalances = !!summary?.hasOpeningBalances;
  const totalUnexplainedGal = hasOpeningBalances
    ? Number(summary?.totals?.totalUnexplained ?? 0)
    : 0;
  const sbdDriftGal = hasOpeningBalances
    ? Number(summary?.totals?.sbdDriftGal ?? 0)
    : 0;
  const checkpointDriftStatus: "clean" | "drifted" | null =
    summary?.checkpointDrift?.status ?? null;
  const parityWarnings: unknown[] = hasOpeningBalances
    ? (summary?.parityDiagnostics?.warnings ?? [])
    : [];

  // ---- 3. Filed-vs-recompute drift for every filed annual year (Phase 4) ------
  const filedSnaps = await db
    .select({ year: ttbPeriodSnapshots.year })
    .from(ttbPeriodSnapshots)
    .where(
      and(
        eq(ttbPeriodSnapshots.periodType, "annual"),
        eq(ttbPeriodSnapshots.isFiled, true),
      ),
    );
  const filedYears = Array.from(new Set(filedSnaps.map((s) => s.year))).sort();

  const filedDrift: Record<string, FiledDriftReadout> = {};
  for (const year of filedYears) {
    try {
      const form: any = await caller.ttb.generateForm512017({
        periodType: "annual",
        year,
      });
      const fd = form?.formData?.filedDrift;
      filedDrift[String(year)] = fd
        ? {
            status: fd.status,
            newDriftCount: fd.newDriftCount ?? 0,
            maxResidualGal: fd.maxResidualGal ?? 0,
          }
        : { status: "clean", newDriftCount: 0, maxResidualGal: 0 };
    } catch (err) {
      console.error(`[recon-health] filed-drift generation failed for ${year}:`, err);
      filedDrift[String(year)] = { status: "error", newDriftCount: 0, maxResidualGal: 0 };
    }
  }

  // ---- 4. openingWarnings for the current year (opening-source consistency) ---
  let openingWarnings: unknown[] = [];
  try {
    const currentForm: any = await caller.ttb.generateForm512017({
      periodType: "annual",
      year: currentYear,
    });
    openingWarnings = currentForm?.formData?.openingWarnings ?? [];
  } catch (err) {
    console.error(`[recon-health] current-year opening check failed:`, err);
  }

  // ---- 5. Status roll-up ------------------------------------------------------
  const hasNewFiledDrift = Object.values(filedDrift).some((f) => f.status === "new_drift");
  const hasFiledError = Object.values(filedDrift).some((f) => f.status === "error");
  const hasCheckpointDrift = checkpointDriftStatus === "drifted";
  const hasBatchFails = perBatchFailCount > 0;
  const hasUnexplainedBeyondTol = Math.abs(totalUnexplainedGal) > AGG_TOL_GAL;
  const hasWarnings =
    perBatchWarnCount > 0 || openingWarnings.length > 0 || parityWarnings.length > 0;

  let status: HealthStatus;
  if (hasNewFiledDrift || hasCheckpointDrift || hasBatchFails) {
    status = "drift";
  } else if (hasUnexplainedBeyondTol || hasWarnings || hasFiledError) {
    status = "attention";
  } else {
    status = "clean";
  }

  // ---- 6. Alert-on-change: compare with the previous run ----------------------
  const [prev] = await db
    .select()
    .from(reconciliationRuns)
    .orderBy(desc(reconciliationRuns.ranAt))
    .limit(1);

  const changes: string[] = [];
  if (prev) {
    if (STATUS_RANK[status] > STATUS_RANK[prev.status as HealthStatus]) {
      changes.push(`Status worsened: ${prev.status} → ${status}`);
    }
    // New filed drift appeared on a year that wasn't drifting before.
    const prevFiled = (prev.filedDrift as Record<string, FiledDriftReadout> | null) ?? {};
    for (const [year, fd] of Object.entries(filedDrift)) {
      if (fd.status === "new_drift" && prevFiled[year]?.status !== "new_drift") {
        changes.push(`New filed drift on ${year} (${fd.newDriftCount} line(s))`);
      }
    }
    // Checkpoint newly drifted.
    if (checkpointDriftStatus === "drifted" && prev.checkpointDriftStatus !== "drifted") {
      changes.push("Checkpoint drift detected");
    }
    // Per-batch failures increased.
    if (perBatchFailCount > (prev.perBatchFailCount ?? 0)) {
      changes.push(
        `Per-batch failures increased: ${prev.perBatchFailCount} → ${perBatchFailCount}`,
      );
    }
  } else {
    // First-ever run: report only if it isn't clean, so a clean baseline is quiet.
    if (status !== "clean") changes.push(`Initial health check: ${status}`);
  }
  const changedSinceLastRun = changes.length > 0;

  const details = {
    currentYear,
    filedYears,
    openingWarnings,
    parityWarningCount: parityWarnings.length,
    sbdDriftGal,
    hasOpeningBalances,
    changedSinceLastRun,
    changes,
    previousRunId: prev?.id ?? null,
  };

  const durationMs = Date.now() - startedAt;

  // ---- 7. Persist the run + one summarizing audit entry -----------------------
  const [inserted] = await db
    .insert(reconciliationRuns)
    .values({
      trigger: opts.trigger,
      status,
      perBatchFailCount,
      perBatchWarnCount,
      totalUnexplainedGal: totalUnexplainedGal.toFixed(3),
      checkpointDriftStatus,
      filedDrift,
      details,
      durationMs,
    })
    .returning();

  await db.insert(auditLogs).values({
    tableName: "reconciliation_runs",
    recordId: inserted.id,
    operation: "create",
    newData: {
      trigger: opts.trigger,
      status,
      perBatchFailCount,
      perBatchWarnCount,
      totalUnexplainedGal: parseFloat(totalUnexplainedGal.toFixed(3)),
      checkpointDriftStatus,
      filedDrift,
      changedSinceLastRun,
      changes,
    },
    changedBy: ctx.session?.user?.id ?? null,
    reason: `reconciliation health check (${opts.trigger}): ${status}`,
  });

  return {
    run: inserted as unknown as HealthCheckRun,
    changedSinceLastRun,
    changes,
  };
}

/** Latest run + a short history for the dashboard card and reports drill-in. */
export async function getReconciliationHealth(limit = 10) {
  const runs = await db
    .select()
    .from(reconciliationRuns)
    .orderBy(desc(reconciliationRuns.ranAt))
    .limit(limit);
  return {
    latest: runs[0] ?? null,
    history: runs,
  };
}
