/**
 * Self-healing batch volume recompute (Phase 2 of the reconciliation plan).
 *
 * `recomputeBatchVolume` recomputes a batch's live volume from its full event
 * history via THE authoritative reducer (Phase 1) and overwrites
 * `current_volume`/`current_volume_liters` when they have drifted. Called at
 * the END of every volume-mutating transaction (after all event rows are
 * inserted), it makes delta-driven live volume self-healing: a missed,
 * double-applied, or deleted event can no longer desync a batch permanently —
 * the next operation snaps it back to what the history says.
 *
 * Rules:
 * - `volume_manually_corrected` batches are SKIPPED (the owner pinned the
 *   value; reconstruction must not fight them). Clearing the flag re-enables.
 * - Every overwrite gets an audit_logs row — volume writes without an audit
 *   trail are how the 0113 clobber went unnoticed for months.
 * - EPSILON 0.05 L: don't churn rows (or audit noise) over float dust.
 * - Deleted batches are skipped.
 */
import { batches, auditLogs } from "db";
import { eq } from "drizzle-orm";
import { computeBatchVolumeFromHistory } from "lib";
import { fetchBatchVolumeEvents } from "./batch-volume-events";

/** Minimum drift (liters) worth overwriting + auditing. */
const RECOMPUTE_EPSILON_L = 0.05;

/** Anything with .select/.update/.insert — a Drizzle tx or the root db. */
type DbLike = any;

export interface RecomputeResult {
  batchId: string;
  skipped: "deleted" | "manually_corrected" | "not_found" | null;
  changed: boolean;
  storedL: number;
  expectedL: number;
  driftL: number;
}

export async function recomputeBatchVolume(
  tx: DbLike,
  batchId: string,
  opts?: { reason?: string },
): Promise<RecomputeResult> {
  const [batch] = await tx
    .select({
      id: batches.id,
      currentVolumeLiters: batches.currentVolumeLiters,
      volumeManuallyCorrected: batches.volumeManuallyCorrected,
      deletedAt: batches.deletedAt,
    })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  const base: Omit<RecomputeResult, "skipped" | "changed"> = {
    batchId,
    storedL: batch ? parseFloat(batch.currentVolumeLiters || "0") || 0 : 0,
    expectedL: 0,
    driftL: 0,
  };

  if (!batch) return { ...base, skipped: "not_found", changed: false };
  if (batch.deletedAt) return { ...base, skipped: "deleted", changed: false };
  if (batch.volumeManuallyCorrected) {
    return { ...base, skipped: "manually_corrected", changed: false };
  }

  // The event fetch MUST run on the caller's transaction: rows inserted
  // earlier in this tx are not visible to the shared `db` pool under read
  // committed isolation. fetchBatchVolumeEvents takes the executor for this.
  const inputs = (await fetchBatchVolumeEvents([batchId], tx)).get(batchId);
  if (!inputs) return { ...base, skipped: "not_found", changed: false };

  const { volumeL: expectedL } = computeBatchVolumeFromHistory(inputs);
  const storedL = base.storedL;
  const driftL = storedL - expectedL;

  if (Math.abs(driftL) <= RECOMPUTE_EPSILON_L) {
    return { batchId, skipped: null, changed: false, storedL, expectedL, driftL };
  }

  await tx
    .update(batches)
    .set({
      currentVolume: expectedL.toFixed(3),
      currentVolumeUnit: "L",
      currentVolumeLiters: expectedL.toFixed(3),
      updatedAt: new Date(),
    })
    .where(eq(batches.id, batchId));

  await tx.insert(auditLogs).values({
    tableName: "batches",
    recordId: batchId,
    operation: "update",
    oldData: { currentVolumeLiters: storedL.toFixed(3) },
    newData: { currentVolumeLiters: expectedL.toFixed(3) },
    diffData: {
      currentVolumeLiters: { old: storedL.toFixed(3), new: expectedL.toFixed(3) },
    },
    changedAt: new Date(),
    reason:
      opts?.reason ??
      `Self-heal recompute from event history (drift ${driftL > 0 ? "+" : ""}${driftL.toFixed(3)}L)`,
  });

  return { batchId, skipped: null, changed: true, storedL, expectedL, driftL };
}
