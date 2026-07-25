/**
 * Integration tests for the Phase 5 reconciliation health check.
 *
 * Runs against the REAL database (project policy: no mocks). The check is
 * read-only over the reconciliation engines and writes into its OWN table
 * (reconciliation_runs) plus one audit_logs row per run. Both throwaway rows are
 * captured by id and removed in afterAll.
 *
 * Covers:
 *  - a manual run inserts a reconciliation_runs row with sane values and a
 *    filed-drift readout for every filed year;
 *  - an audit_logs entry is written for the run;
 *  - a second run over the identical state reports changedSinceLastRun === false.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, reconciliationRuns, auditLogs, ttbPeriodSnapshots, users } from "db";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "../index";

let caller: ReturnType<typeof appRouter.createCaller>;
const createdRunIds: string[] = [];

beforeAll(async () => {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) throw new Error("No users in database — cannot run health-check fixtures");
  const adminUser = { id: user.id, email: "recon-health-test@example.com", role: "admin" as const };
  caller = appRouter.createCaller({
    session: { user: adminUser, expires: new Date(Date.now() + 86400000).toISOString() },
    user: adminUser,
  });
});

afterAll(async () => {
  if (createdRunIds.length > 0) {
    await db.delete(auditLogs).where(
      and(eq(auditLogs.tableName, "reconciliation_runs"), inArray(auditLogs.recordId, createdRunIds)),
    );
    await db.delete(reconciliationRuns).where(inArray(reconciliationRuns.id, createdRunIds));
  }
});

describe("runReconciliationHealthCheck", () => {
  it("inserts a run with sane values + one audit entry, covering every filed year", async () => {
    const filedSnaps = await db
      .select({ year: ttbPeriodSnapshots.year })
      .from(ttbPeriodSnapshots)
      .where(and(eq(ttbPeriodSnapshots.periodType, "annual"), eq(ttbPeriodSnapshots.isFiled, true)));
    const filedYears = Array.from(new Set(filedSnaps.map((s) => s.year)));

    const res = await caller.ttb.runReconciliationHealthCheck({ trigger: "manual" });
    createdRunIds.push(res.run.id);

    // Row shape / sane values.
    expect(["clean", "attention", "drift"]).toContain(res.run.status);
    expect(res.run.trigger).toBe("manual");
    expect(res.run.perBatchFailCount).toBeGreaterThanOrEqual(0);
    expect(res.run.perBatchWarnCount).toBeGreaterThanOrEqual(0);
    expect(res.run.durationMs).toBeGreaterThanOrEqual(0);

    // Filed-drift readout has an entry for every filed year.
    for (const year of filedYears) {
      expect(res.run.filedDrift[String(year)]).toBeTruthy();
      expect(["clean", "expected_only", "new_drift", "error"]).toContain(
        res.run.filedDrift[String(year)].status,
      );
    }

    // Persisted to the table.
    const [persisted] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.id, res.run.id));
    expect(persisted).toBeTruthy();
    expect(persisted.status).toBe(res.run.status);

    // Exactly one audit entry summarizing the run.
    const audits = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(eq(auditLogs.tableName, "reconciliation_runs"), eq(auditLogs.recordId, res.run.id)));
    expect(audits.length).toBe(1);
  }, 300000);

  it("reports changedSinceLastRun === false on a second run over identical state", async () => {
    const res = await caller.ttb.runReconciliationHealthCheck({ trigger: "manual" });
    createdRunIds.push(res.run.id);

    expect(res.changedSinceLastRun).toBe(false);
    expect(res.changes).toEqual([]);
  }, 300000);
});
