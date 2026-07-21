/**
 * Integration tests for recomputeBatchVolume (Phase 2 self-heal).
 *
 * Runs against the REAL database (project policy: no mocks) using throwaway
 * rows that are removed in afterAll. Uses batch_volume_adjustments as the
 * event vehicle because it has no FK requirements beyond the batch.
 *
 * Covers: drift correction + audit row, in-transaction event visibility,
 * volume_manually_corrected skip, epsilon no-op, deleted-batch skip.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, batches, batchVolumeAdjustments, auditLogs, users } from "db";
import { and, eq, inArray } from "drizzle-orm";
import { recomputeBatchVolume } from "../batch-volume-recompute";

const cleanup = {
  batchIds: [] as string[],
};

// batch_volume_adjustments.adjusted_by is NOT NULL — use any existing user
// (the suite runs against the real DB, which always has users).
let adjustedByUserId: string;

beforeAll(async () => {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) throw new Error("No users in database — cannot run adjustment fixtures");
  adjustedByUserId = user.id;
});

async function createTestBatch(opts: {
  name: string;
  initialL: number;
  currentL: number;
  manuallyCorrected?: boolean;
}) {
  const [batch] = await db
    .insert(batches)
    .values({
      name: opts.name,
      batchNumber: `${opts.name}-${Math.random().toString(36).slice(2, 8)}`,
      initialVolume: opts.initialL.toFixed(3),
      initialVolumeUnit: "L",
      initialVolumeLiters: opts.initialL.toFixed(3),
      currentVolume: opts.currentL.toFixed(3),
      currentVolumeUnit: "L",
      currentVolumeLiters: opts.currentL.toFixed(3),
      status: "fermentation",
      startDate: new Date("2026-07-01"),
      volumeManuallyCorrected: opts.manuallyCorrected ?? false,
    })
    .returning();
  cleanup.batchIds.push(batch.id);
  return batch;
}

async function addAdjustment(batchId: string, amountL: number, baseL = 100) {
  await db.insert(batchVolumeAdjustments).values({
    batchId,
    adjustmentType: amountL >= 0 ? "correction_up" : "correction_down",
    adjustmentAmount: amountL.toFixed(3),
    volumeBefore: baseL.toFixed(3),
    volumeAfter: (baseL + amountL).toFixed(3),
    adjustmentDate: new Date("2026-07-02"),
    reason: "recompute test fixture",
    adjustedBy: adjustedByUserId,
  });
}

async function readCurrentL(batchId: string): Promise<number> {
  const [b] = await db
    .select({ v: batches.currentVolumeLiters })
    .from(batches)
    .where(eq(batches.id, batchId));
  return parseFloat(b.v || "0");
}

afterAll(async () => {
  if (cleanup.batchIds.length === 0) return;
  await db
    .delete(auditLogs)
    .where(and(eq(auditLogs.tableName, "batches"), inArray(auditLogs.recordId, cleanup.batchIds)));
  await db
    .delete(batchVolumeAdjustments)
    .where(inArray(batchVolumeAdjustments.batchId, cleanup.batchIds));
  await db.delete(batches).where(inArray(batches.id, cleanup.batchIds));
});

describe("recomputeBatchVolume", () => {
  it("corrects a drifted stored volume and writes an audit row", async () => {
    // History says 100 - 20 = 80; stored is a stale 90 (simulated missed delta).
    const batch = await createTestBatch({ name: "recompute-drift", initialL: 100, currentL: 90 });
    await addAdjustment(batch.id, -20);

    const result = await recomputeBatchVolume(db, batch.id);

    expect(result.skipped).toBeNull();
    expect(result.changed).toBe(true);
    expect(result.expectedL).toBeCloseTo(80, 3);
    expect(result.driftL).toBeCloseTo(10, 3);
    expect(await readCurrentL(batch.id)).toBeCloseTo(80, 3);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tableName, "batches"), eq(auditLogs.recordId, batch.id)));
    expect(audits.length).toBe(1);
    expect(audits[0].reason).toContain("Self-heal recompute");
    expect((audits[0].diffData as any).currentVolumeLiters.new).toBe("80.000");
  });

  it("sees events written earlier in the SAME transaction", async () => {
    const batch = await createTestBatch({ name: "recompute-tx", initialL: 100, currentL: 100 });

    const result = await db.transaction(async (tx) => {
      await tx.insert(batchVolumeAdjustments).values({
        batchId: batch.id,
        adjustmentType: "correction_down",
        adjustmentAmount: "-25.000",
        volumeBefore: "100.000",
        volumeAfter: "75.000",
        adjustmentDate: new Date("2026-07-03"),
        reason: "recompute tx-visibility fixture",
        adjustedBy: adjustedByUserId,
      });
      return recomputeBatchVolume(tx, batch.id);
    });

    expect(result.changed).toBe(true);
    expect(result.expectedL).toBeCloseTo(75, 3);
    expect(await readCurrentL(batch.id)).toBeCloseTo(75, 3);
  });

  it("skips volume_manually_corrected batches without touching the volume", async () => {
    const batch = await createTestBatch({
      name: "recompute-manual",
      initialL: 100,
      currentL: 42, // pinned by the owner; history says 100
      manuallyCorrected: true,
    });

    const result = await recomputeBatchVolume(db, batch.id);

    expect(result.skipped).toBe("manually_corrected");
    expect(result.changed).toBe(false);
    expect(await readCurrentL(batch.id)).toBeCloseTo(42, 3);
  });

  it("does not churn on sub-epsilon drift", async () => {
    const batch = await createTestBatch({ name: "recompute-eps", initialL: 100, currentL: 100.03 });

    const result = await recomputeBatchVolume(db, batch.id);

    expect(result.skipped).toBeNull();
    expect(result.changed).toBe(false);
    expect(await readCurrentL(batch.id)).toBeCloseTo(100.03, 3);
  });

  it("skips deleted batches", async () => {
    const batch = await createTestBatch({ name: "recompute-del", initialL: 100, currentL: 50 });
    await db.update(batches).set({ deletedAt: new Date() }).where(eq(batches.id, batch.id));

    const result = await recomputeBatchVolume(db, batch.id);

    expect(result.skipped).toBe("deleted");
    expect(result.changed).toBe(false);
  });
});
