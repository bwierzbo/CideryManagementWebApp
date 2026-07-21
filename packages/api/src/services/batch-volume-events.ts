/**
 * THE event fetcher/normalizer for batch volume reconstruction (Phase 1).
 *
 * One set of bulk queries feeds `computeBatchVolumeFromHistory` (packages/lib)
 * for every engine — per-batch validation, TTB SBD reconstruction, and the
 * batch-derived reconciliation. Scoping rules are the union of what the old
 * replicas each did, made explicit:
 *
 * - Soft-delete / void filters on every table.
 * - Transfers: self-transfers (source == destination) excluded on both sides.
 * - Merges IN and OUT both exclude source_type = 'batch_transfer' (those rows
 *   mirror batch_transfers and would double-count). For merge-OUT this equals
 *   the old `= 'batch'` filter because press_run/juice_purchase rows carry a
 *   NULL source_batch_id and can never match a source-side lookup (probe
 *   2026-07-20: 0 rows with other source_types and a non-null source batch).
 * - Racking rows flagged is_historical_record are excluded here (the old
 *   engines string-matched notes at reduction time; migration 0143 froze that
 *   verdict into the column).
 * - Distillation: status IN ('sent','received') AND deducted_from_batch —
 *   record-only sends (migration 0142) never debited the batch and must not
 *   be reconstructed as if they did (probe: 0 such rows today).
 * - Bottle runs carry loss_included_in_volume_taken (migration 0143) so the
 *   reducer never re-subtracts an included loss.
 *
 * ALL volumes are converted to liters HERE, applying every unit column
 * (probe 2026-07-20: all rows are 'L' today, so this is future-proofing, not
 * a behavior change). `adjustment_amount` has no unit column — stored in
 * liters by convention (see batch_volume_adjustments writers).
 */
import {
  db,
  batches,
  batchTransfers,
  batchMergeHistory,
  batchVolumeAdjustments,
  batchRackingOperations,
  batchFilterOperations,
} from "db";
import { bottleRuns, kegFills } from "db/src/schema/packaging";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  convertToLiters,
  type BatchVolumeEvent,
  type BatchVolumeInputs,
  type VolumeUnit,
} from "lib";

function toL(value: string | null | undefined, unit: string | null | undefined): number {
  const v = parseFloat(value || "0") || 0;
  if (!unit || unit === "L") return v;
  return convertToLiters(v, unit as VolumeUnit);
}

/**
 * Fetch and normalize the full volume-event history for a set of batches.
 * Returns one `BatchVolumeInputs` per requested batch id (including batches
 * with no events), ready for `computeBatchVolumeFromHistory` in either
 * all-time or as-of-date mode.
 */
export async function fetchBatchVolumeEvents(
  batchIds: string[],
): Promise<Map<string, BatchVolumeInputs>> {
  const result = new Map<string, BatchVolumeInputs>();
  if (batchIds.length === 0) return result;

  const [
    cores,
    transfersOut,
    transfersIn,
    mergesIn,
    mergesOut,
    bottles,
    kegs,
    adjustments,
    rackings,
    filters,
    distillations,
  ] = await Promise.all([
    db
      .select({
        id: batches.id,
        initialVolumeLiters: batches.initialVolumeLiters,
        transferCreated: batches.transferCreated,
        startDate: batches.startDate,
      })
      .from(batches)
      .where(inArray(batches.id, batchIds)),

    db
      .select({
        batchId: batchTransfers.sourceBatchId,
        volume: batchTransfers.volumeTransferred,
        volumeUnit: batchTransfers.volumeTransferredUnit,
        loss: batchTransfers.loss,
        lossUnit: batchTransfers.lossUnit,
        at: batchTransfers.transferredAt,
      })
      .from(batchTransfers)
      .where(
        and(
          inArray(batchTransfers.sourceBatchId, batchIds),
          sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
          isNull(batchTransfers.deletedAt),
        ),
      ),

    db
      .select({
        batchId: batchTransfers.destinationBatchId,
        volume: batchTransfers.volumeTransferred,
        volumeUnit: batchTransfers.volumeTransferredUnit,
        at: batchTransfers.transferredAt,
      })
      .from(batchTransfers)
      .where(
        and(
          inArray(batchTransfers.destinationBatchId, batchIds),
          sql`${batchTransfers.sourceBatchId} != ${batchTransfers.destinationBatchId}`,
          isNull(batchTransfers.deletedAt),
        ),
      ),

    db
      .select({
        batchId: batchMergeHistory.targetBatchId,
        volume: batchMergeHistory.volumeAdded,
        volumeUnit: batchMergeHistory.volumeAddedUnit,
        sourceType: batchMergeHistory.sourceType,
        at: batchMergeHistory.mergedAt,
      })
      .from(batchMergeHistory)
      .where(
        and(
          inArray(batchMergeHistory.targetBatchId, batchIds),
          isNull(batchMergeHistory.deletedAt),
          sql`${batchMergeHistory.sourceType} != 'batch_transfer'`,
        ),
      ),

    db
      .select({
        batchId: batchMergeHistory.sourceBatchId,
        volume: batchMergeHistory.volumeAdded,
        volumeUnit: batchMergeHistory.volumeAddedUnit,
        at: batchMergeHistory.mergedAt,
      })
      .from(batchMergeHistory)
      .where(
        and(
          inArray(batchMergeHistory.sourceBatchId, batchIds),
          isNull(batchMergeHistory.deletedAt),
          sql`${batchMergeHistory.sourceType} != 'batch_transfer'`,
        ),
      ),

    db
      .select({
        batchId: bottleRuns.batchId,
        volumeTakenLiters: bottleRuns.volumeTakenLiters,
        loss: bottleRuns.loss,
        lossUnit: bottleRuns.lossUnit,
        lossIncluded: bottleRuns.lossIncludedInVolumeTaken,
        at: bottleRuns.packagedAt,
      })
      .from(bottleRuns)
      .where(and(inArray(bottleRuns.batchId, batchIds), isNull(bottleRuns.voidedAt))),

    db
      .select({
        batchId: kegFills.batchId,
        volume: kegFills.volumeTaken,
        volumeUnit: kegFills.volumeTakenUnit,
        loss: kegFills.loss,
        lossUnit: kegFills.lossUnit,
        at: kegFills.filledAt,
      })
      .from(kegFills)
      .where(
        and(
          inArray(kegFills.batchId, batchIds),
          isNull(kegFills.voidedAt),
          isNull(kegFills.deletedAt),
        ),
      ),

    db
      .select({
        batchId: batchVolumeAdjustments.batchId,
        amount: batchVolumeAdjustments.adjustmentAmount, // liters by convention (no unit column)
        at: batchVolumeAdjustments.adjustmentDate,
      })
      .from(batchVolumeAdjustments)
      .where(
        and(
          inArray(batchVolumeAdjustments.batchId, batchIds),
          isNull(batchVolumeAdjustments.deletedAt),
        ),
      ),

    db
      .select({
        batchId: batchRackingOperations.batchId,
        loss: batchRackingOperations.volumeLoss,
        lossUnit: batchRackingOperations.volumeLossUnit,
        at: batchRackingOperations.rackedAt,
      })
      .from(batchRackingOperations)
      .where(
        and(
          inArray(batchRackingOperations.batchId, batchIds),
          isNull(batchRackingOperations.deletedAt),
          eq(batchRackingOperations.isHistoricalRecord, false),
        ),
      ),

    db
      .select({
        batchId: batchFilterOperations.batchId,
        loss: batchFilterOperations.volumeLoss,
        at: batchFilterOperations.filteredAt,
      })
      .from(batchFilterOperations)
      .where(
        and(
          inArray(batchFilterOperations.batchId, batchIds),
          isNull(batchFilterOperations.deletedAt),
        ),
      ),

    db.execute(sql`
      SELECT source_batch_id, source_volume_liters, sent_at
      FROM distillation_records
      WHERE source_batch_id IN (${sql.join(batchIds.map((id) => sql`${id}`), sql`, `)})
        AND deleted_at IS NULL
        AND status IN ('sent', 'received')
        AND deducted_from_batch = true
    `),
  ]);

  for (const core of cores) {
    result.set(core.id, {
      initialVolumeL: parseFloat(core.initialVolumeLiters || "0") || 0,
      transferCreated: !!core.transferCreated,
      startDate: core.startDate ? new Date(core.startDate) : null,
      events: [],
    });
  }
  // Requested ids missing from batches (shouldn't happen) get empty inputs so
  // callers never crash on .get().
  for (const id of batchIds) {
    if (!result.has(id)) {
      result.set(id, { initialVolumeL: 0, transferCreated: false, startDate: null, events: [] });
    }
  }

  const push = (batchId: string | null, e: BatchVolumeEvent) => {
    if (!batchId) return;
    result.get(batchId)?.events.push(e);
  };

  for (const r of transfersOut) {
    push(r.batchId, {
      type: "transfer_out",
      volumeL: toL(r.volume, r.volumeUnit),
      lossL: toL(r.loss, r.lossUnit),
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of transfersIn) {
    push(r.batchId, {
      type: "transfer_in",
      volumeL: toL(r.volume, r.volumeUnit),
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of mergesIn) {
    push(r.batchId, {
      type: "merge_in",
      volumeL: toL(r.volume, r.volumeUnit),
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
      mergeSourceType: r.sourceType ?? undefined,
    });
  }
  for (const r of mergesOut) {
    push(r.batchId, {
      type: "merge_out",
      volumeL: toL(r.volume, r.volumeUnit),
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of bottles) {
    push(r.batchId, {
      type: "bottle_run",
      volumeL: parseFloat(r.volumeTakenLiters || "0") || 0, // trigger-maintained liters
      lossL: toL(r.loss, r.lossUnit),
      at: r.at ? new Date(r.at) : null,
      lossIncludedInVolume: !!r.lossIncluded,
    });
  }
  for (const r of kegs) {
    push(r.batchId, {
      type: "keg_fill",
      volumeL: toL(r.volume, r.volumeUnit),
      lossL: toL(r.loss, r.lossUnit),
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of adjustments) {
    push(r.batchId, {
      type: "adjustment",
      volumeL: parseFloat(r.amount || "0") || 0, // signed; liters by convention
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of rackings) {
    push(r.batchId, {
      type: "racking_loss",
      volumeL: toL(r.loss, r.lossUnit),
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
    });
  }
  for (const r of filters) {
    push(r.batchId, {
      type: "filter_loss",
      volumeL: parseFloat(r.loss || "0") || 0, // no unit column; liters
      lossL: 0,
      at: r.at ? new Date(r.at) : null,
    });
  }
  const distRows = ((distillations as any).rows ?? distillations) as Array<{
    source_batch_id: string;
    source_volume_liters: string | null;
    sent_at: string | Date | null;
  }>;
  for (const r of distRows) {
    push(r.source_batch_id, {
      type: "distillation",
      volumeL: parseFloat(r.source_volume_liters || "0") || 0,
      lossL: 0,
      at: r.sent_at ? new Date(r.sent_at) : null,
    });
  }

  return result;
}
