/**
 * Integration tests for the Phase 6 reconciliation checkpoint model (C2/C3).
 *
 * Runs against the REAL database (project policy: no mocks). Throwaway rows are
 * tagged with a unique name marker and removed in afterAll. Because finalized
 * checkpoints are immutable (trigger trg_checkpoint_immutable), cleanup disables
 * the trigger for the DELETE and re-enables it — the ONLY sanctioned bypass.
 *
 * Covers:
 *  - tolerance gate blocks an over-tolerance lock (no insert)
 *  - dryRun previews the payload and inserts nothing
 *  - immutability trigger fires on UPDATE and DELETE of a finalized row
 *  - amend chain: getLastReconciliation returns the amendment, the old row is
 *    intact, and double-amend is rejected
 *  - checkpoint-drift detection (C3): clean, then drifted after a backdated
 *    volume adjustment before the checkpoint date
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  db,
  ttbReconciliationSnapshots,
  ttbWaterfallAdjustments,
  batches,
  batchVolumeAdjustments,
  users,
} from "db";
import { and, eq, like, sql, inArray } from "drizzle-orm";
import { appRouter } from "../index";

const MARKER = `CKPT_TEST_${Math.random().toString(36).slice(2, 8)}`;
const cleanup = {
  snapshotNames: [] as string[],
  batchIds: [] as string[],
  adjustmentIds: [] as string[],
  waterfallAdjustmentIds: [] as string[],
};

let adminUserId: string;
let caller: ReturnType<typeof appRouter.createCaller>;

beforeAll(async () => {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) throw new Error("No users in database — cannot run checkpoint fixtures");
  adminUserId = user.id;
  const adminUser = { id: adminUserId, email: "checkpoint-test@example.com", role: "admin" as const };
  caller = appRouter.createCaller({
    session: { user: adminUser, expires: new Date(Date.now() + 86400000).toISOString() },
    user: adminUser,
  });
});

afterAll(async () => {
  // Finalized checkpoints are immutable — bypass the trigger only to clean up
  // our own throwaway rows (matched by the unique marker), then re-arm it.
  if (cleanup.snapshotNames.length > 0) {
    await db.execute(
      sql`ALTER TABLE ttb_reconciliation_snapshots DISABLE TRIGGER trg_checkpoint_immutable`,
    );
    try {
      await db
        .delete(ttbReconciliationSnapshots)
        .where(like(ttbReconciliationSnapshots.name, `${MARKER}%`));
    } finally {
      await db.execute(
        sql`ALTER TABLE ttb_reconciliation_snapshots ENABLE TRIGGER trg_checkpoint_immutable`,
      );
    }
  }
  // Backdated drift-test adjustments (applied to REAL batches — remove them so
  // reconstruction returns to its prior state).
  if (cleanup.adjustmentIds.length > 0) {
    await db.delete(batchVolumeAdjustments).where(inArray(batchVolumeAdjustments.id, cleanup.adjustmentIds));
  }
  if (cleanup.batchIds.length > 0) {
    await db.delete(batchVolumeAdjustments).where(inArray(batchVolumeAdjustments.batchId, cleanup.batchIds));
    await db.delete(batches).where(inArray(batches.id, cleanup.batchIds));
  }
  // Class-scoped waterfall adjustments created by the accept-unblocks test —
  // hard-delete our throwaway rows so real reconciliation returns to normal.
  if (cleanup.waterfallAdjustmentIds.length > 0) {
    await db
      .delete(ttbWaterfallAdjustments)
      .where(inArray(ttbWaterfallAdjustments.id, cleanup.waterfallAdjustmentIds));
  }
});

async function snapshotCount(): Promise<number> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ttbReconciliationSnapshots);
  return Number(c);
}

/** Insert a finalized checkpoint directly (bypasses the tolerance gate). */
async function insertFinalizedCheckpoint(opts: {
  name: string;
  reconciliationDate: string;
  periodEndDate?: string;
  amendsId?: string | null;
  finalizedAt?: Date;
  taxClassBreakdown?: unknown;
}) {
  const [row] = await db
    .insert(ttbReconciliationSnapshots)
    .values({
      reconciliationDate: opts.reconciliationDate,
      periodEndDate: opts.periodEndDate ?? opts.reconciliationDate,
      name: opts.name,
      ttbBalance: "0",
      ttbSourceType: "opening_balance",
      status: "finalized",
      finalizedAt: opts.finalizedAt ?? new Date(),
      finalizedBy: adminUserId,
      amendsId: opts.amendsId ?? null,
      taxClassBreakdown: opts.taxClassBreakdown ? JSON.stringify(opts.taxClassBreakdown) : null,
    })
    .returning();
  cleanup.snapshotNames.push(opts.name);
  return row;
}

describe("completeReconciliation — tolerance gate", () => {
  it("blocks an over-tolerance lock and inserts nothing (dryRun preview)", async () => {
    const before = await snapshotCount();
    const res = await caller.ttb.completeReconciliation({
      asOfDate: "2025-12-31",
      name: `${MARKER}-should-not-persist`,
      dryRun: true,
    });
    const after = await snapshotCount();

    expect(after).toBe(before); // dryRun never inserts
    expect(res.dryRun).toBe(true);
    // Real 2025 data carries per-class + aggregate unexplained variance well over
    // tolerance, so the preview reports it would NOT lock.
    expect(res.ok).toBe(false);
    expect("blockers" in res && res.blockers.length).toBeGreaterThan(0);
    // The would-be payload is still returned for preview.
    expect("checkpoint" in res && res.checkpoint).toBeTruthy();
  }, 120000);

  it("blocks a real (non-dryRun) over-tolerance lock without inserting", async () => {
    const before = await snapshotCount();
    const res = await caller.ttb.completeReconciliation({
      asOfDate: "2025-12-31",
      name: `${MARKER}-blocked`,
    });
    const after = await snapshotCount();

    expect(res.ok).toBe(false);
    expect(after).toBe(before);
    expect("blockers" in res && res.blockers.length).toBeGreaterThan(0);
  }, 120000);
});

describe("checkpoint immutability trigger", () => {
  it("blocks UPDATE of a finalized checkpoint", async () => {
    const row = await insertFinalizedCheckpoint({
      name: `${MARKER}-immutable-update`,
      reconciliationDate: "2099-01-01",
    });
    await expect(
      db
        .update(ttbReconciliationSnapshots)
        .set({ name: `${MARKER}-changed` })
        .where(eq(ttbReconciliationSnapshots.id, row.id)),
    ).rejects.toThrow(/immutable/i);
  });

  it("blocks DELETE of a finalized checkpoint", async () => {
    const row = await insertFinalizedCheckpoint({
      name: `${MARKER}-immutable-delete`,
      reconciliationDate: "2099-01-02",
    });
    await expect(
      db.delete(ttbReconciliationSnapshots).where(eq(ttbReconciliationSnapshots.id, row.id)),
    ).rejects.toThrow(/immutable/i);
  });
});

describe("amend chain", () => {
  it("supersedes the old checkpoint; old row intact; double-amend rejected", async () => {
    // A = original (older), B = amendment pointing at A. Far-future finalizedAt
    // so B outranks the real finalized rows in getLastReconciliation.
    const a = await insertFinalizedCheckpoint({
      name: `${MARKER}-amend-A`,
      reconciliationDate: "2099-02-01",
      finalizedAt: new Date("2099-02-01T00:00:00Z"),
    });
    const b = await insertFinalizedCheckpoint({
      name: `${MARKER}-amend-B`,
      reconciliationDate: "2099-02-01",
      amendsId: a.id,
      finalizedAt: new Date("2099-02-02T00:00:00Z"),
    });

    // getLastReconciliation prefers the non-superseded amendment (B), not A.
    const last = await caller.ttb.getLastReconciliation();
    expect(last?.id).toBe(b.id);

    // The old row A is still present and unchanged.
    const [aStill] = await db
      .select({ id: ttbReconciliationSnapshots.id, status: ttbReconciliationSnapshots.status })
      .from(ttbReconciliationSnapshots)
      .where(eq(ttbReconciliationSnapshots.id, a.id));
    expect(aStill?.id).toBe(a.id);
    expect(aStill?.status).toBe("finalized");

    // amendCheckpoint(A) now rejects — A is already amended by B.
    await expect(caller.ttb.amendCheckpoint({ checkpointId: a.id })).rejects.toThrow(
      /already been amended/i,
    );

    // amendCheckpoint(B) is allowed (B is not yet amended) and prefills from B.
    const amend = await caller.ttb.amendCheckpoint({ checkpointId: b.id });
    expect(amend.amendsId).toBe(b.id);
    expect(amend.prefill.asOfDate).toBe("2099-02-01");
  }, 60000);
});

describe("checkpoint drift detection (C3)", () => {
  it("reports clean, then drifted after a backdated adjustment before the checkpoint date", async () => {
    // Far-future so our checkpoint outranks the real ones for the queried dates.
    const ckptDate = "2099-06-30";

    // 1. Recompute per-class endings as-of the checkpoint date (before locking).
    const before: any = await caller.ttb.getReconciliationSummary({ endDate: ckptDate });
    const lockedTcb = (before.waterfall.byTaxClass ?? []).map((w: any) => ({
      key: w.taxClass,
      label: w.label,
      physical: w.physical,
      currentInventory: w.physical,
      calculatedEnding: w.calculatedEnding,
      bulkEnding: w.bulkEnding, // drift baseline (C3)
    }));
    expect(lockedTcb.length).toBeGreaterThan(0);

    // 2. Lock a checkpoint whose taxClassBreakdown == the current recompute.
    const ckpt = await insertFinalizedCheckpoint({
      name: `${MARKER}-drift`,
      reconciliationDate: ckptDate,
      taxClassBreakdown: lockedTcb,
      finalizedAt: new Date("2099-06-30T00:00:00Z"),
    });

    // 3. Same-date query → drift compares locked vs current recompute → clean.
    const clean: any = await caller.ttb.getReconciliationSummary({ endDate: ckptDate });
    expect(clean.checkpointDrift).toBeTruthy();
    expect(clean.checkpointDrift.checkpointId).toBe(ckpt.id);
    expect(clean.checkpointDrift.status).toBe("clean");

    // 4. Insert a backdated (2099-01-01 ≤ ckptDate) volume adjustment on a real,
    //    contributing batch — this changes the as-of reconstruction underneath
    //    the locked checkpoint.
    const contributing = (before.batchReconciliation?.batches ?? []).filter(
      (b: any) =>
        b.reconciliationStatus !== "duplicate" &&
        b.reconciliationStatus !== "excluded" &&
        b.productType !== "juice" && // must be a taxable class so bulk moves
        typeof b.ending === "number" &&
        b.ending > 5,
    );
    expect(contributing.length).toBeGreaterThan(0);
    const target = contributing.sort((a: any, b: any) => b.ending - a.ending)[0];
    const [adj] = await db
      .insert(batchVolumeAdjustments)
      .values({
        batchId: target.batchId,
        adjustmentType: "correction_up",
        adjustmentAmount: "100.000",
        volumeBefore: "0.000",
        volumeAfter: "100.000",
        adjustmentDate: new Date("2099-01-01"),
        reason: `${MARKER} drift fixture`,
        adjustedBy: adminUserId,
      })
      .returning();
    cleanup.adjustmentIds.push(adj.id);

    // 5. Same-date query → recompute now differs from locked → drifted.
    const drifted: any = await caller.ttb.getReconciliationSummary({ endDate: ckptDate });
    expect(drifted.checkpointDrift.status).toBe("drifted");
    const driftedLines = drifted.checkpointDrift.lines.filter(
      (l: any) => Math.abs(l.deltaGal) > 0.5,
    );
    expect(driftedLines.length).toBeGreaterThan(0);

    // 6. Later-date query exercises the recursive as-of recompute path
    //    (checkpointDate !== asOfDate) — still drifted.
    const driftedLater: any = await caller.ttb.getReconciliationSummary({ endDate: "2099-12-31" });
    expect(driftedLater.checkpointDrift.checkpointId).toBe(ckpt.id);
    expect(driftedLater.checkpointDrift.status).toBe("drifted");
  }, 180000);
});

describe("class-scoped accepted variances (migration 0150)", () => {
  it("is data-neutral with no class-scoped rows, then a class-scoped accept nets the class down and unblocks the lock", async () => {
    const asOfDate = "2025-12-31";
    const periodYear = 2025;

    // 1. Data-neutrality: with zero class-scoped rows, every waterfall row's NET
    //    equals its RAW and acceptedGal is 0 (net gating collapses to raw).
    const base: any = await caller.ttb.getReconciliationSummary({ endDate: asOfDate });
    const baseRows: any[] = base.waterfall.byTaxClass ?? [];
    expect(baseRows.length).toBeGreaterThan(0);
    for (const w of baseRows) {
      expect(w.acceptedGal).toBe(0);
      expect(w.netUnexplainedVariance).toBe(w.unexplainedVariance);
    }

    // 2. The real 2025 lock is blocked (per-class and/or aggregate over tolerance).
    const blockedPreview = await caller.ttb.completeReconciliation({
      asOfDate,
      name: `${MARKER}-classscope-preview`,
      dryRun: true,
    });
    expect(blockedPreview.ok).toBe(false);
    expect("blockers" in blockedPreview && blockedPreview.blockers.length).toBeGreaterThan(0);

    // 3. Accept EVERY class with a non-trivial raw residual via a class-scoped
    //    'other' row whose amount == the class's raw (effect of 'other' == amount,
    //    so net = raw − amount ≈ 0). This also drives the aggregate to ≈ 0.
    const toAccept = baseRows.filter((w) => Math.abs(w.unexplainedVariance) > 0.05);
    expect(toAccept.length).toBeGreaterThan(0);
    for (const w of toAccept) {
      const row = await caller.ttb.createWaterfallAdjustment({
        periodYear,
        waterfallLine: "other",
        amountGallons: w.unexplainedVariance,
        reason: `${MARKER} class-scoped accept for ${w.taxClass}`,
        taxClass: w.taxClass,
        scope: "both",
      });
      cleanup.waterfallAdjustmentIds.push(row.id);
    }

    // 4. Re-query: raw is UNCHANGED (honest), acceptedGal reflects the row, and
    //    net collapses to ≈ 0 for each accepted class.
    const after: any = await caller.ttb.getReconciliationSummary({ endDate: asOfDate });
    const afterById = new Map<string, any>(
      (after.waterfall.byTaxClass ?? []).map((w: any) => [w.taxClass, w]),
    );
    for (const w of toAccept) {
      const now = afterById.get(w.taxClass);
      expect(now).toBeTruthy();
      expect(now.unexplainedVariance).toBe(w.unexplainedVariance); // raw preserved
      expect(Math.abs(now.acceptedGal - w.unexplainedVariance)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(now.netUnexplainedVariance)).toBeLessThanOrEqual(0.5);
    }

    // 5. The lock is now unblocked (per-class net + aggregate within tolerance).
    const unblocked = await caller.ttb.completeReconciliation({
      asOfDate,
      name: `${MARKER}-classscope-unblocked`,
      dryRun: true,
    });
    expect("blockers" in unblocked && unblocked.blockers.length).toBe(0);
    expect(unblocked.ok).toBe(true);

    // 6. listWaterfallAdjustments returns the taxClass on the new rows.
    const listed = await caller.ttb.listWaterfallAdjustments({ periodYear });
    const mine = listed.filter((r) => cleanup.waterfallAdjustmentIds.includes(r.id));
    expect(mine.length).toBe(toAccept.length);
    expect(mine.every((r) => r.taxClass != null)).toBe(true);
  }, 180000);
});
