/**
 * Auto-fixes batches with missing initialVolumeLiters where the volume can
 * be reconstructed unambiguously. Conservative by design — only touches
 * batches where bottling is the SOLE outflow (no transfers OUT, no merges
 * OUT, no manual adjustments). Inflows are fine — by conservation of
 * volume, `bottled + loss + current` still equals the total volume the
 * batch ever held, which is the correct denominator for COGS proration.
 *
 * For each candidate:
 *   inferred_initial = SUM(bottle_runs.volume_taken_liters + loss) + currentVolumeLiters
 *
 * Skipped (printed for manual review):
 *   - Batches with batch_transfers OUT (volume left for another batch)
 *   - Batches with batch_merge_history OUT (volume merged into another batch)
 *   - Batches with batch_volume_adjustments (manual changes muddy the math)
 *   - Batches where currentVolumeLiters > 0 (still active, more bottling possible)
 *   - Inferred values <= 0 or > 10,000L (sanity)
 *
 * Run dry (default):
 *   pnpm --filter db exec tsx src/scripts/fix-missing-initial-volume.ts
 *
 * Apply changes:
 *   pnpm --filter db exec tsx src/scripts/fix-missing-initial-volume.ts --apply
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

interface BatchRow {
  id: string;
  name: string;
  custom_name: string | null;
  product_type: string;
  status: string;
  current_volume_liters: string | null;
  bottle_drawn_l: string;
  bottle_loss_l: string;
  transfers_in_count: number;
  transfers_out_count: number;
  merges_in_count: number;
  merges_out_count: number;
  adjustments_count: number;
}

const APPLY = process.argv.includes("--apply");
const SANITY_MAX_L = 10000;

async function main() {
  console.log(APPLY ? "🔧 APPLY mode — will UPDATE the database\n" : "🔍 DRY RUN — no changes (pass --apply to commit)\n");

  // Pull every candidate batch with all the metadata we need to decide
  // auto-fix vs manual review in one query.
  const result = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.product_type::text  AS product_type,
      b.status::text        AS status,
      b.current_volume_liters,
      COALESCE((
        SELECT SUM(CAST(COALESCE(br.volume_taken_liters, br.volume_taken) AS NUMERIC))
        FROM bottle_runs br
        WHERE br.batch_id = b.id AND br.status <> 'voided'
      ), 0)
      + COALESCE((
        SELECT SUM(CAST(kf.volume_taken AS NUMERIC))
        FROM keg_fills kf
        WHERE kf.batch_id = b.id AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
      ), 0) AS bottle_drawn_l,
      COALESCE((
        SELECT SUM(CAST(br.loss AS NUMERIC))
        FROM bottle_runs br
        WHERE br.batch_id = b.id AND br.status <> 'voided'
      ), 0)
      + COALESCE((
        SELECT SUM(CAST(COALESCE(kf.loss, '0') AS NUMERIC))
        FROM keg_fills kf
        WHERE kf.batch_id = b.id AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
      ), 0) AS bottle_loss_l,
      COALESCE((
        SELECT COUNT(*) FROM batch_transfers bt
        WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
      ), 0) AS transfers_in_count,
      COALESCE((
        SELECT COUNT(*) FROM batch_transfers bt
        WHERE bt.source_batch_id = b.id AND bt.deleted_at IS NULL
      ), 0) AS transfers_out_count,
      COALESCE((
        SELECT COUNT(*) FROM batch_merge_history bmh
        WHERE bmh.target_batch_id = b.id AND bmh.deleted_at IS NULL
      ), 0) AS merges_in_count,
      COALESCE((
        SELECT COUNT(*) FROM batch_merge_history bmh
        WHERE bmh.source_batch_id = b.id AND bmh.deleted_at IS NULL
      ), 0) AS merges_out_count,
      COALESCE((
        SELECT COUNT(*) FROM batch_volume_adjustments bva
        WHERE bva.batch_id = b.id AND bva.deleted_at IS NULL
      ), 0) AS adjustments_count
    FROM batches b
    WHERE
      (b.initial_volume_liters IS NULL OR CAST(b.initial_volume_liters AS NUMERIC) <= 0)
      AND (
        EXISTS (SELECT 1 FROM bottle_runs br WHERE br.batch_id = b.id AND br.status <> 'voided')
        OR EXISTS (SELECT 1 FROM keg_fills kf WHERE kf.batch_id = b.id AND kf.voided_at IS NULL AND kf.deleted_at IS NULL)
      )
    ORDER BY b.start_date
  `);

  const rows = result.rows as unknown as BatchRow[];

  const autoFixable: Array<{ id: string; name: string; inferred: number; bottled: number; loss: number; current: number }> = [];
  const needsReview: Array<{ row: BatchRow; reason: string }> = [];

  for (const r of rows) {
    const bottled = Number(r.bottle_drawn_l);
    const loss = Number(r.bottle_loss_l);
    const current = Number(r.current_volume_liters ?? 0);

    // Only OUT-flows + adjustments + active state make a batch unsafe to
    // auto-fix. Inflows don't matter — conservation of volume still holds:
    // bottled + loss + current = total volume the batch ever processed.
    const reasons: string[] = [];
    if (Number(r.transfers_out_count) > 0) reasons.push(`${r.transfers_out_count} transfer(s) out`);
    if (Number(r.merges_out_count)    > 0) reasons.push(`${r.merges_out_count} merge(s) out`);
    if (Number(r.adjustments_count)   > 0) reasons.push(`${r.adjustments_count} adjustment(s)`);
    if (current > 0)                       reasons.push(`current=${current}L (still active)`);

    if (reasons.length > 0) {
      needsReview.push({ row: r, reason: reasons.join(", ") });
      continue;
    }

    const inferred = bottled + loss + current;
    if (inferred <= 0 || inferred > SANITY_MAX_L) {
      needsReview.push({
        row: r,
        reason: `inferred initial ${inferred.toFixed(1)}L outside sane range (0, ${SANITY_MAX_L}]`,
      });
      continue;
    }

    autoFixable.push({
      id: r.id,
      name: r.custom_name || r.name,
      inferred,
      bottled,
      loss,
      current,
    });
  }

  console.log(`Total candidates: ${rows.length}`);
  console.log(`  Auto-fixable:  ${autoFixable.length}`);
  console.log(`  Needs review:  ${needsReview.length}\n`);

  if (autoFixable.length > 0) {
    console.log("=".repeat(110));
    console.log("AUTO-FIXABLE — clean batches (only bottle_runs, no transfers/merges/adjustments)");
    console.log("=".repeat(110));
    console.log(
      "name".padEnd(50) +
        "  bottled".padStart(10) +
        " + loss".padStart(8) +
        " + current".padStart(11) +
        " = inferred".padStart(13),
    );
    console.log("-".repeat(110));
    for (const f of autoFixable) {
      console.log(
        f.name.substring(0, 48).padEnd(50) +
          `  ${f.bottled.toFixed(1)}L`.padStart(10) +
          ` + ${f.loss.toFixed(1)}L`.padStart(8) +
          ` + ${f.current.toFixed(1)}L`.padStart(11) +
          `   ${f.inferred.toFixed(1)}L`.padStart(13),
      );
    }
    console.log();
  }

  if (needsReview.length > 0) {
    console.log("=".repeat(110));
    console.log("NEEDS MANUAL REVIEW — has transfers/merges/adjustments or inferred value out of range");
    console.log("=".repeat(110));
    for (const { row: r, reason } of needsReview) {
      const display = (r.custom_name || r.name).substring(0, 50);
      console.log(`  ${display.padEnd(52)} → ${reason}`);
    }
    console.log();
  }

  if (autoFixable.length === 0) {
    console.log("Nothing to auto-fix.");
    process.exit(0);
  }

  if (!APPLY) {
    console.log("DRY RUN complete. Re-run with --apply to commit these changes.");
    process.exit(0);
  }

  // APPLY: wrap all updates in a single transaction so partial failure
  // leaves the data in its original state.
  console.log("Applying updates in a single transaction...");
  await db.transaction(async (tx) => {
    for (const f of autoFixable) {
      await tx.execute(sql`
        UPDATE batches
           SET initial_volume_liters = ${f.inferred.toFixed(3)},
               initial_volume        = ${f.inferred.toFixed(3)},
               initial_volume_unit   = 'L',
               updated_at            = NOW()
         WHERE id = ${f.id}
      `);
    }
  });
  console.log(`✅ Updated ${autoFixable.length} batch(es).`);
  console.log("Re-run audit-missing-initial-volume.ts to verify the remaining count.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
