import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  const toGal = (l: number) => (l / 3.78541).toFixed(1);
  const openingDate = "2024-12-31";
  const endingDate = "2025-12-31";

  // Racking losses by product type
  const racking = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(r.volume_loss::numeric), 0) AS total_liters
    FROM batch_racking_operations r
    JOIN batches b ON r.batch_id = b.id
    WHERE r.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND r.racked_at::date > '${openingDate}'::date
      AND r.racked_at::date <= '${endingDate}'::date
      AND (r.notes IS NULL OR r.notes NOT LIKE '%Historical Record%')
    GROUP BY b.product_type
  `));

  // Filter losses by product type
  const filtering = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(f.volume_loss::numeric), 0) AS total_liters
    FROM batch_filter_operations f
    JOIN batches b ON f.batch_id = b.id
    WHERE f.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND f.filtered_at::date > '${openingDate}'::date
      AND f.filtered_at::date <= '${endingDate}'::date
    GROUP BY b.product_type
  `));

  // Bottling losses by product type (ALL bottle runs in period)
  const bottling = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(
      CASE WHEN br.loss_unit = 'gal' THEN COALESCE(br.loss::numeric, 0) * 3.78541
           ELSE COALESCE(br.loss::numeric, 0) END
    ), 0) AS total_liters
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL
      AND b.deleted_at IS NULL
      AND br.packaged_at::date > '${openingDate}'::date
      AND br.packaged_at::date <= '${endingDate}'::date
    GROUP BY b.product_type
  `));

  // Kegging losses by product type
  const kegging = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(
      CASE WHEN kf.loss_unit = 'gal' THEN COALESCE(kf.loss::numeric, 0) * 3.78541
           ELSE COALESCE(kf.loss::numeric, 0) END
    ), 0) AS total_liters
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.voided_at IS NULL
      AND kf.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND kf.filled_at::date > '${openingDate}'::date
      AND kf.filled_at::date <= '${endingDate}'::date
    GROUP BY b.product_type
  `));

  // Transfer losses by product type (batches created in period)
  const transfer = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(b.transfer_loss_l::numeric), 0) AS total_liters
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.transfer_loss_l::numeric > 0
      AND b.created_at::date > '${openingDate}'::date
      AND b.created_at::date <= '${endingDate}'::date
    GROUP BY b.product_type
  `));

  // Adjustment losses by product type (negative adjustments only)
  const adjustments = await db.execute(sql.raw(`
    SELECT b.product_type, COALESCE(SUM(ABS(a.adjustment_amount::numeric)), 0) AS total_liters
    FROM batch_volume_adjustments a
    JOIN batches b ON a.batch_id = b.id
    WHERE a.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND a.adjustment_amount::numeric < 0
      AND a.adjustment_date::date > '${openingDate}'::date
      AND a.adjustment_date::date <= '${endingDate}'::date
    GROUP BY b.product_type
  `));

  // Build combined table
  type Row = { racking: number; filter: number; bottling: number; kegging: number; transfer: number; adjustments: number };
  const combined: Record<string, Row> = {};
  const ensure = (pt: string) => {
    if (!combined[pt]) combined[pt] = { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, adjustments: 0 };
  };

  for (const r of racking.rows as any[]) { ensure(r.product_type); combined[r.product_type].racking = Number(r.total_liters); }
  for (const r of filtering.rows as any[]) { ensure(r.product_type); combined[r.product_type].filter = Number(r.total_liters); }
  for (const r of bottling.rows as any[]) { ensure(r.product_type); combined[r.product_type].bottling = Number(r.total_liters); }
  for (const r of kegging.rows as any[]) { ensure(r.product_type); combined[r.product_type].kegging = Number(r.total_liters); }
  for (const r of transfer.rows as any[]) { ensure(r.product_type); combined[r.product_type].transfer = Number(r.total_liters); }
  for (const r of adjustments.rows as any[]) { ensure(r.product_type); combined[r.product_type].adjustments = Number(r.total_liters); }

  console.log("=== 2025 Losses by Tax Class — ALL batches (gal) ===\n");
  console.log("Type           Racking  Filter  Bottling  Kegging  Transfer  Adjust   TOTAL");
  console.log("─".repeat(80));

  let gt = { racking: 0, filter: 0, bottling: 0, kegging: 0, transfer: 0, adjustments: 0 };

  for (const [type, d] of Object.entries(combined).sort()) {
    const total = d.racking + d.filter + d.bottling + d.kegging + d.transfer + d.adjustments;
    console.log(
      `${type.padEnd(15)}${toGal(d.racking).padStart(7)}  ${toGal(d.filter).padStart(6)}  ${toGal(d.bottling).padStart(8)}  ${toGal(d.kegging).padStart(7)}  ${toGal(d.transfer).padStart(8)}  ${toGal(d.adjustments).padStart(6)}  ${toGal(total).padStart(6)}`
    );
    gt.racking += d.racking; gt.filter += d.filter; gt.bottling += d.bottling;
    gt.kegging += d.kegging; gt.transfer += d.transfer; gt.adjustments += d.adjustments;
  }

  const total = gt.racking + gt.filter + gt.bottling + gt.kegging + gt.transfer + gt.adjustments;
  console.log("─".repeat(80));
  console.log(
    `${"TOTAL".padEnd(15)}${toGal(gt.racking).padStart(7)}  ${toGal(gt.filter).padStart(6)}  ${toGal(gt.bottling).padStart(8)}  ${toGal(gt.kegging).padStart(7)}  ${toGal(gt.transfer).padStart(8)}  ${toGal(gt.adjustments).padStart(6)}  ${toGal(total).padStart(6)}`
  );

  console.log(`\n\nReconciliation page breakdown: Racking 45.8, Filter 2.7, Bottling 10.9, Kegging 0.0, Transfer 35.2, Adj 12.6 = 107.2`);
  console.log(`Reconciliation total line: 112.7 gal (includes SBD clamping adjustment of +5.5 gal)`);
  console.log(`\nNote: Reconciliation losses are from SBD per-batch reconstruction (verified/pending batches only).`);
  console.log(`This query includes ALL non-deleted batches to match how distributions are now counted.`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
