/**
 * Shared reconciliation batch-list + validation (Phase 5).
 *
 * Extracted from `batch.listForReconciliation` so the automated health check and
 * the reconciliation page run the SAME batch selection + `validateBatches` pass
 * (no duplicated formula). Returns the parent batch rows and the per-batch
 * validation map; the router adds child rows on top for the UI.
 */
import { db, batches, vessels } from "db";
import { eq, and, isNull, asc, sql, or, ilike } from "drizzle-orm";
import { validateBatches, type BatchValidation } from "../validation/batch-validation";

export interface ReconciliationBatchListInput {
  year?: number;
  productType?:
    | "juice"
    | "cider"
    | "perry"
    | "wine"
    | "cyser"
    | "brandy"
    | "pommeau"
    | "other";
  reconciliationStatus?: "verified" | "pending";
  search?: string;
}

export async function buildReconciliationBatchList(
  input: ReconciliationBatchListInput = {},
) {
  const conditions: any[] = [
    isNull(batches.deletedAt),
    // Auto-exclude brandy and juice (not reportable on TTB wine form)
    sql`(${batches.productType} IS NULL OR ${batches.productType} NOT IN ('brandy', 'juice'))`,
    // Auto-exclude racking derivatives (tracked under parent batch)
    sql`${batches.isRackingDerivative} IS NOT TRUE`,
    // Auto-exclude transfer-destination batches with 0 initial volume
    // (but NOT pommeau — they're first-class products built entirely via blending transfers)
    sql`NOT (${batches.parentBatchId} IS NOT NULL AND CAST(COALESCE(${batches.initialVolumeLiters}, '1') AS DECIMAL) = 0 AND COALESCE(${batches.productType}, 'cider') != 'pommeau')`,
    // Auto-exclude fully-transferred source batches: depleted batches that transferred all
    // volume to other batches with no packaging and no children. These are intermediate staging
    // batches (e.g., pressed juice immediately transferred to a blending tank). They remain in
    // the SBD computation for transfer matching but are hidden from the UI list.
    sql`NOT (
      CAST(COALESCE(${batches.currentVolumeLiters}, '0') AS DECIMAL) = 0
      AND CAST(COALESCE(${batches.initialVolumeLiters}, '0') AS DECIMAL) > 0
      AND NOT EXISTS (
        SELECT 1 FROM bottle_runs br2 WHERE br2.batch_id = ${batches.id} AND br2.voided_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM keg_fills kf2 WHERE kf2.batch_id = ${batches.id} AND kf2.voided_at IS NULL AND kf2.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM batches child WHERE child.parent_batch_id = ${batches.id} AND child.deleted_at IS NULL
      )
      AND (
        SELECT COALESCE(SUM(bt2.volume_transferred), 0)
        FROM batch_transfers bt2
        WHERE bt2.source_batch_id = ${batches.id} AND bt2.deleted_at IS NULL
      ) >= CAST(COALESCE(${batches.initialVolumeLiters}, '0') AS DECIMAL) * 0.9
    )`,
  ];

  if (input.year) {
    // Show ALL batches "in bond" during this year:
    // 1. Started this year (new production), OR
    // 2. Started before this year AND still has volume (aging/carrying forward), OR
    // 3. Started before this year AND had activity during this year
    const yearStart = `${input.year}-01-01`;
    const yearEnd = `${input.year}-12-31`;
    conditions.push(sql`(
      EXTRACT(YEAR FROM ${batches.startDate}) = ${input.year}
      OR (
        ${batches.startDate} < ${yearStart}::date
        AND (
          CAST(COALESCE(${batches.currentVolumeLiters}, '0') AS DECIMAL) > 0
          OR EXISTS (
            SELECT 1 FROM batch_transfers bt
            WHERE (bt.source_batch_id = ${batches.id} OR bt.destination_batch_id = ${batches.id})
              AND bt.deleted_at IS NULL
              AND bt.transferred_at >= ${yearStart}::date AND bt.transferred_at < (${yearEnd}::date + INTERVAL '1 day')
          )
          OR EXISTS (
            SELECT 1 FROM bottle_runs br
            WHERE br.batch_id = ${batches.id} AND br.voided_at IS NULL
              AND br.packaged_at >= ${yearStart}::date AND br.packaged_at < (${yearEnd}::date + INTERVAL '1 day')
          )
          OR EXISTS (
            SELECT 1 FROM keg_fills kf
            WHERE kf.batch_id = ${batches.id} AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
              AND kf.filled_at >= ${yearStart}::date AND kf.filled_at < (${yearEnd}::date + INTERVAL '1 day')
          )
          OR EXISTS (
            SELECT 1 FROM batch_volume_adjustments bva
            WHERE bva.batch_id = ${batches.id} AND bva.deleted_at IS NULL
              AND bva.adjustment_date >= ${yearStart}::date AND bva.adjustment_date <= ${yearEnd}::date
          )
          OR EXISTS (
            SELECT 1 FROM batch_merge_history bmh
            WHERE bmh.target_batch_id = ${batches.id} AND bmh.deleted_at IS NULL
              AND bmh.merged_at >= ${yearStart}::date AND bmh.merged_at < (${yearEnd}::date + INTERVAL '1 day')
          )
          OR EXISTS (
            SELECT 1 FROM distillation_records dr
            WHERE dr.source_batch_id = ${batches.id} AND dr.deleted_at IS NULL AND dr.status IN ('sent', 'received')
              AND dr.sent_at >= ${yearStart}::date AND dr.sent_at < (${yearEnd}::date + INTERVAL '1 day')
          )
        )
      )
    )`);
  }
  if (input.productType) {
    conditions.push(eq(batches.productType, input.productType));
  }
  if (input.reconciliationStatus) {
    conditions.push(eq(batches.reconciliationStatus, input.reconciliationStatus));
  }
  if (input.search) {
    conditions.push(
      or(
        ilike(batches.name, `%${input.search}%`),
        ilike(batches.customName, `%${input.search}%`),
        ilike(batches.batchNumber, `%${input.search}%`),
      ),
    );
  }

  const batchesList = await db
    .select({
      id: batches.id,
      name: batches.name,
      customName: batches.customName,
      batchNumber: batches.batchNumber,
      status: batches.status,
      productType: batches.productType,
      startDate: batches.startDate,
      vesselName: vessels.name,
      initialVolumeLiters: batches.initialVolumeLiters,
      currentVolumeLiters: batches.currentVolumeLiters,
      reconciliationStatus: batches.reconciliationStatus,
      reconciliationNotes: batches.reconciliationNotes,
      parentBatchId: batches.parentBatchId,
      isRackingDerivative: batches.isRackingDerivative,
      isArchived: batches.isArchived,
      vesselId: batches.vesselId,
      actualAbv: batches.actualAbv,
      estimatedAbv: batches.estimatedAbv,
      reconciliationVerifiedForYear: batches.reconciliationVerifiedForYear,
      volumeManuallyCorrected: batches.volumeManuallyCorrected,
    })
    .from(batches)
    .leftJoin(vessels, eq(batches.vesselId, vessels.id))
    .where(and(...conditions))
    .orderBy(asc(batches.startDate));

  // Run validation on all batches
  const validationYear = input.year || new Date().getFullYear();
  let validationMap = new Map<string, BatchValidation>();
  try {
    validationMap = await validateBatches(batchesList, validationYear);
  } catch (err) {
    console.error("Batch validation failed:", err);
  }

  return { batchesList, validationMap };
}
