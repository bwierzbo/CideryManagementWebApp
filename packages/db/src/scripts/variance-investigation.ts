import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();
  const od = "2024-12-31";
  const rd = "2025-12-31";
  const G = (l: number) => (l / 3.78541).toFixed(2);
  const P = (r: pg.QueryResult) => parseFloat((r.rows[0] as any).t);

  // 1. transfer_loss_l (TTB counts, recon does NOT)
  const tl = await c.query(
    `SELECT id, name, CAST(COALESCE(transfer_loss_l,'0') AS DECIMAL) as tl
     FROM batches WHERE deleted_at IS NULL
     AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND start_date::date > $1::date AND start_date::date <= $2::date
     AND CAST(COALESCE(transfer_loss_l,'0') AS DECIMAL) > 0
     ORDER BY CAST(transfer_loss_l AS DECIMAL) DESC`,
    [od, rd]
  );
  console.log("=== transfer_loss_l (TTB counts, recon does NOT) ===");
  let tlTotal = 0;
  for (const r of tl.rows) {
    const v = parseFloat(r.tl);
    tlTotal += v;
    console.log(`  ${r.name.padEnd(55)} ${v.toFixed(2)} L (${G(v)} gal)`);
  }
  console.log(`  TOTAL: ${tlTotal.toFixed(2)} L (${G(tlTotal)} gal)\n`);

  // 2. TTB transfer loss two sources
  const ttbA = await c.query(
    `SELECT COALESCE(SUM(CAST(COALESCE(transfer_loss_l,'0') AS DECIMAL)),0) as t
     FROM batches WHERE deleted_at IS NULL
     AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND start_date::date > $1::date AND start_date::date <= $2::date`,
    [od, rd]
  );
  const ttbB = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.loss AS DECIMAL)),0) as t
     FROM batch_transfers bt JOIN batches b ON bt.source_batch_id=b.id
     WHERE bt.deleted_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND bt.transferred_at::date > $1::date AND bt.transferred_at::date <= $2::date`,
    [od, rd]
  );
  console.log(`TTB Transfer A (batches.transfer_loss_l): ${G(P(ttbA))} gal`);
  console.log(`TTB Transfer B (batch_transfers.loss):    ${G(P(ttbB))} gal`);
  console.log(`TTB Total: ${G(P(ttbA) + P(ttbB))} gal | Recon uses ONLY B\n`);

  // 3. All TTB loss components
  const racking = await c.query(
    `SELECT COALESCE(SUM(CAST(ro.volume_loss AS DECIMAL)),0) as t
     FROM batch_racking_operations ro JOIN batches b ON ro.batch_id=b.id
     WHERE ro.deleted_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND ro.racked_at::date > $1::date AND ro.racked_at::date <= $2::date
     AND (ro.notes IS NULL OR ro.notes NOT LIKE '%Historical Record%')`,
    [od, rd]
  );
  const filter = await c.query(
    `SELECT COALESCE(SUM(CAST(fo.volume_loss AS DECIMAL)),0) as t
     FROM batch_filter_operations fo JOIN batches b ON fo.batch_id=b.id
     WHERE fo.deleted_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND fo.filtered_at::date > $1::date AND fo.filtered_at::date <= $2::date`,
    [od, rd]
  );
  const bottling = await c.query(
    `SELECT COALESCE(SUM(CAST(br.loss AS DECIMAL)),0) as t
     FROM bottle_runs br JOIN batches b ON br.batch_id=b.id
     WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND br.packaged_at::date > $1::date AND br.packaged_at::date <= $2::date`,
    [od, rd]
  );
  const negAdj = await c.query(
    `SELECT COALESCE(SUM(ABS(CAST(adjustment_amount AS DECIMAL))),0) as t
     FROM batch_volume_adjustments WHERE deleted_at IS NULL
     AND adjustment_date::date > $1::date AND adjustment_date::date <= $2::date
     AND CAST(adjustment_amount AS DECIMAL) < 0`,
    [od, rd]
  );
  const kegLoss = await c.query(
    `SELECT COALESCE(SUM(CAST(loss AS DECIMAL)),0) as t
     FROM keg_fills WHERE voided_at IS NULL AND deleted_at IS NULL
     AND loss IS NOT NULL
     AND filled_at::date > $1::date AND filled_at::date <= $2::date`,
    [od, rd]
  );

  console.log("=== TTB LOSS BREAKDOWN ===");
  console.log(`  Racking:    ${G(P(racking))} gal`);
  console.log(`  Filter:     ${G(P(filter))} gal`);
  console.log(`  Bottling:   ${G(P(bottling))} gal`);
  console.log(`  Transfer:   ${G(P(ttbA) + P(ttbB))} gal (A:${G(P(ttbA))} + B:${G(P(ttbB))})`);
  console.log(`  Neg Adj:    ${G(P(negAdj))} gal`);
  console.log(`  Keg fill:   ${G(P(kegLoss))} gal`);
  const totalLoss = P(racking) + P(filter) + P(bottling) + P(ttbA) + P(ttbB) + P(negAdj) + P(kegLoss);
  console.log(`  TOTAL TTB:  ${G(totalLoss)} gal`);
  console.log(`  Batch recon: ~107.3 gal`);
  console.log(`  LOSSES GAP:  ${(parseFloat(G(totalLoss)) - 107.3).toFixed(1)} gal\n`);

  // 4. TTB distributions
  const bDist = await c.query(
    `SELECT COALESCE(SUM(CAST(id.quantity_distributed AS DECIMAL)*CAST(ii.package_size_ml AS DECIMAL)/1000.0),0) as t
     FROM inventory_distributions id JOIN inventory_items ii ON id.inventory_item_id=ii.id
     WHERE id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [od, rd]
  );
  const kDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as t
     FROM keg_fills WHERE distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
     AND distributed_at::date > $1::date AND distributed_at::date <= $2::date`,
    [od, rd]
  );
  const bDistL = P(bDist) / 1000;
  const kDistL = P(kDist);
  console.log("=== TTB DISTRIBUTIONS ===");
  console.log(`  Bottle: ${G(bDistL)} gal, Keg: ${G(kDistL)} gal, Total: ${G(bDistL + kDistL)} gal`);

  // 5. SBD packaging (bottling + kegging taken)
  const bTaken = await c.query(
    `SELECT COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)),0) as t
     FROM bottle_runs br JOIN batches b ON br.batch_id=b.id
     WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND br.packaged_at::date > $1::date AND br.packaged_at::date <= $2::date`,
    [od, rd]
  );
  const kTaken = await c.query(
    `SELECT COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)),0) as t
     FROM keg_fills kf JOIN batches b ON kf.batch_id=b.id
     WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND kf.filled_at::date > $1::date AND kf.filled_at::date <= $2::date`,
    [od, rd]
  );
  console.log(`\n=== SBD PACKAGING ===`);
  console.log(`  Bottling taken: ${G(P(bTaken))} gal, Kegging taken: ${G(P(kTaken))} gal`);
  console.log(`  Total: ${G(P(bTaken) + P(kTaken))} gal`);
  console.log(`  REMOVALS GAP (TTB dist - SBD pkg): ${G(bDistL + kDistL - P(bTaken) - P(kTaken))} gal\n`);

  // 6. Production
  const newInit = await c.query(
    `SELECT COALESCE(SUM(CAST(initial_volume_liters AS DECIMAL)),0) as t
     FROM batches WHERE deleted_at IS NULL
     AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND start_date::date > $1::date AND start_date::date <= $2::date`,
    [od, rd]
  );
  const posAdj = await c.query(
    `SELECT COALESCE(SUM(CAST(adjustment_amount AS DECIMAL)),0) as t
     FROM batch_volume_adjustments WHERE deleted_at IS NULL
     AND adjustment_date::date > $1::date AND adjustment_date::date <= $2::date
     AND CAST(adjustment_amount AS DECIMAL) > 0`,
    [od, rd]
  );
  console.log("=== PRODUCTION ===");
  console.log(`  New batch initials: ${G(P(newInit))} gal`);
  console.log(`  Pos adjustments:    ${G(P(posAdj))} gal`);
  console.log(`  SBD prod (approx):  ${G(P(newInit) + P(posAdj))} gal`);
  console.log(`  TTB production: ~5104 gal (press+juice+brandy+posAdj)`);
  console.log(`  PRODUCTION GAP: ${(5104 - parseFloat(G(P(newInit) + P(posAdj)))).toFixed(1)} gal\n`);

  // 7. Juice batches
  const juice = await c.query(
    `SELECT b.name, CAST(b.current_volume_liters AS DECIMAL) as vol,
            CAST(b.initial_volume_liters AS DECIMAL) as init
     FROM batches b WHERE b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND b.juice_lot_id IS NOT NULL AND b.start_date::date <= $1::date`,
    [rd]
  );
  console.log("=== JUICE BATCHES (in SBD, excluded from batch recon) ===");
  for (const r of juice.rows) {
    console.log(`  ${r.name}: init=${G(parseFloat(r.init))} cur=${G(parseFloat(r.vol))} gal`);
  }

  // 8. Summary
  console.log("\n=== VARIANCE DECOMPOSITION ===");
  console.log("Opening:     TTB 1121.0, SBD ~1121.1 → gap ~-0.1");
  const sysProd = parseFloat(G(P(newInit) + P(posAdj)));
  console.log(`Production:  TTB ~5104, SBD ~${sysProd} → gap ~${(5104 - sysProd).toFixed(1)}`);
  const sysRemovals = parseFloat(G(P(bTaken) + P(kTaken)));
  const ttbRemovals = parseFloat(G(bDistL + kDistL));
  console.log(`Removals:    TTB ${ttbRemovals} (dist), SBD ${sysRemovals} (pkg) → gap ~${(sysRemovals - ttbRemovals).toFixed(1)}`);
  const ttbLoss = parseFloat(G(totalLoss));
  console.log(`Losses:      TTB ${ttbLoss}, Recon 107.3 → gap ~${(107.3 - ttbLoss).toFixed(1)}`);
  console.log("Distillation: both 779.8 → gap 0");
  console.log(`\nTransfer_loss_l contribution: ${G(tlTotal)} gal (biggest single fix)`);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
