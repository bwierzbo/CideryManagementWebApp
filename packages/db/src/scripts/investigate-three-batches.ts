import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(2);

async function investigateBatch(name: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`BATCH: ${name}`);
  console.log("=".repeat(70));

  // Find batch
  const batch = await c.query(
    `SELECT id, name, batch_number, initial_volume_liters, current_volume_liters,
            transfer_loss_l, parent_batch_id, start_date, product_type,
            reconciliation_status, vessel_id, is_racking_derivative
     FROM batches WHERE name LIKE $1 AND deleted_at IS NULL
     ORDER BY start_date DESC LIMIT 5`,
    [`%${name}%`]
  );
  if (batch.rows.length === 0) {
    console.log("  NOT FOUND");
    return;
  }

  for (const b of batch.rows) {
    const id = b.id;
    const init = parseFloat(b.initial_volume_liters || "0");
    const cur = parseFloat(b.current_volume_liters || "0");
    const tl = parseFloat(b.transfer_loss_l || "0");

    console.log(`\n  ID: ${id}`);
    console.log(`  Name: ${b.name}`);
    console.log(`  Product: ${b.product_type}`);
    console.log(`  Start: ${b.start_date}`);
    console.log(`  Status: ${b.reconciliation_status}`);
    console.log(`  Parent: ${b.parent_batch_id || "none"}`);
    console.log(`  Racking derivative: ${b.is_racking_derivative}`);
    console.log(`  Initial: ${init.toFixed(1)} L (${G(init)} gal)`);
    console.log(`  Current: ${cur.toFixed(1)} L (${G(cur)} gal)`);
    console.log(`  Transfer Loss L: ${tl.toFixed(2)} L (${G(tl)} gal)`);

    // Vessel
    if (b.vessel_id) {
      const v = await c.query(
        `SELECT name, capacity_liters FROM vessels WHERE id = $1`,
        [b.vessel_id]
      );
      if (v.rows[0]) {
        console.log(`  Vessel: ${v.rows[0].name} (cap: ${G(parseFloat(v.rows[0].capacity_liters))} gal)`);
      }
    }

    // Transfers IN
    const tIn = await c.query(
      `SELECT bt.id, bt.volume_transferred, bt.loss, bt.transferred_at, b2.name as source
       FROM batch_transfers bt JOIN batches b2 ON bt.source_batch_id = b2.id
       WHERE bt.destination_batch_id = $1 AND bt.deleted_at IS NULL
       ORDER BY bt.transferred_at`,
      [id]
    );
    if (tIn.rows.length > 0) {
      console.log(`\n  TRANSFERS IN (${tIn.rows.length}):`);
      for (const t of tIn.rows) {
        console.log(`    ${t.transferred_at} from "${t.source}" vol=${G(parseFloat(t.volume_transferred))} gal, loss=${G(parseFloat(t.loss || "0"))} gal`);
      }
    }

    // Transfers OUT
    const tOut = await c.query(
      `SELECT bt.id, bt.volume_transferred, bt.loss, bt.transferred_at, b2.name as dest
       FROM batch_transfers bt JOIN batches b2 ON bt.destination_batch_id = b2.id
       WHERE bt.source_batch_id = $1 AND bt.deleted_at IS NULL
       ORDER BY bt.transferred_at`,
      [id]
    );
    if (tOut.rows.length > 0) {
      console.log(`\n  TRANSFERS OUT (${tOut.rows.length}):`);
      for (const t of tOut.rows) {
        console.log(`    ${t.transferred_at} to "${t.dest}" vol=${G(parseFloat(t.volume_transferred))} gal, loss=${G(parseFloat(t.loss || "0"))} gal`);
      }
    }

    // Merges IN (as target) — LEFT JOIN to catch all source types (batch, press_run, juice_purchase)
    const mIn = await c.query(
      `SELECT bb.id, bb.volume_added, bb.merged_at, bb.source_type,
              COALESCE(b2.name, pr.press_run_name, 'juice purchase') as source
       FROM batch_merge_history bb
       LEFT JOIN batches b2 ON bb.source_batch_id = b2.id
       LEFT JOIN press_runs pr ON bb.source_press_run_id = pr.id
       WHERE bb.target_batch_id = $1 AND bb.deleted_at IS NULL
       ORDER BY bb.merged_at`,
      [id]
    );
    if (mIn.rows.length > 0) {
      console.log(`\n  MERGES IN (${mIn.rows.length}):`);
      for (const m of mIn.rows) {
        console.log(`    ${m.merged_at} from "${m.source}" (${m.source_type}) vol=${G(parseFloat(m.volume_added))} gal`);
      }
    }

    // Merges OUT (as source)
    const mOut = await c.query(
      `SELECT bb.id, bb.volume_added, bb.merged_at, b2.name as target
       FROM batch_merge_history bb JOIN batches b2 ON bb.target_batch_id = b2.id
       WHERE bb.source_batch_id = $1 AND bb.deleted_at IS NULL
       ORDER BY bb.merged_at`,
      [id]
    );
    if (mOut.rows.length > 0) {
      console.log(`\n  MERGES OUT (${mOut.rows.length}):`);
      for (const m of mOut.rows) {
        console.log(`    ${m.merged_at} to "${m.target}" vol=${G(parseFloat(m.volume_added))} gal`);
      }
    }

    // Bottling
    const bot = await c.query(
      `SELECT volume_taken_liters, loss, packaged_at FROM bottle_runs
       WHERE batch_id = $1 AND voided_at IS NULL ORDER BY packaged_at`,
      [id]
    );
    if (bot.rows.length > 0) {
      console.log(`\n  BOTTLE RUNS (${bot.rows.length}):`);
      for (const r of bot.rows) {
        console.log(`    ${r.packaged_at} taken=${G(parseFloat(r.volume_taken_liters))} gal, loss=${G(parseFloat(r.loss || "0"))} gal`);
      }
    }

    // Kegging
    const keg = await c.query(
      `SELECT volume_taken, loss, filled_at, distributed_at FROM keg_fills
       WHERE batch_id = $1 AND voided_at IS NULL AND deleted_at IS NULL ORDER BY filled_at`,
      [id]
    );
    if (keg.rows.length > 0) {
      console.log(`\n  KEG FILLS (${keg.rows.length}):`);
      for (const r of keg.rows) {
        console.log(`    ${r.filled_at} taken=${G(parseFloat(r.volume_taken))} gal, loss=${G(parseFloat(r.loss || "0"))} gal, dist=${r.distributed_at || "N/A"}`);
      }
    }

    // Racking
    const rack = await c.query(
      `SELECT volume_loss, racked_at, notes FROM batch_racking_operations
       WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY racked_at`,
      [id]
    );
    if (rack.rows.length > 0) {
      console.log(`\n  RACKING (${rack.rows.length}):`);
      for (const r of rack.rows) {
        console.log(`    ${r.racked_at} loss=${G(parseFloat(r.volume_loss))} gal ${r.notes || ""}`);
      }
    }

    // Adjustments
    const adj = await c.query(
      `SELECT adjustment_amount, adjustment_date, reason FROM batch_volume_adjustments
       WHERE batch_id = $1 AND deleted_at IS NULL ORDER BY adjustment_date`,
      [id]
    );
    if (adj.rows.length > 0) {
      console.log(`\n  ADJUSTMENTS (${adj.rows.length}):`);
      for (const r of adj.rows) {
        console.log(`    ${r.adjustment_date} amount=${G(parseFloat(r.adjustment_amount))} gal reason="${r.reason}"`);
      }
    }

    // Distillation
    const dist = await c.query(
      `SELECT source_volume_liters, sent_at, status FROM distillation_records
       WHERE source_batch_id = $1 AND deleted_at IS NULL ORDER BY sent_at`,
      [id]
    );
    if (dist.rows.length > 0) {
      console.log(`\n  DISTILLATION (${dist.rows.length}):`);
      for (const r of dist.rows) {
        console.log(`    ${r.sent_at} vol=${G(parseFloat(r.source_volume_liters))} gal status=${r.status}`);
      }
    }

    // Reconstruct volume
    const transfersInTotal = tIn.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_transferred), 0);
    const transfersOutTotal = tOut.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_transferred), 0);
    const transferLossTotal = tOut.rows.reduce((s: number, t: any) => s + parseFloat(t.loss || "0"), 0)
      + tIn.rows.reduce((s: number, t: any) => s + parseFloat(t.loss || "0"), 0);
    const mergesInTotal = mIn.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_liters), 0);
    const mergesOutTotal = mOut.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_liters), 0);
    const bottlingTotal = bot.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_taken_liters), 0);
    const bottlingLoss = bot.rows.reduce((s: number, t: any) => s + parseFloat(t.loss || "0"), 0);
    const keggingTotal = keg.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_taken), 0);
    const keggingLoss = keg.rows.reduce((s: number, t: any) => s + parseFloat(t.loss || "0"), 0);
    const rackingTotal = rack.rows.reduce((s: number, t: any) => s + parseFloat(t.volume_loss), 0);
    const adjTotal = adj.rows.reduce((s: number, t: any) => s + parseFloat(t.adjustment_amount), 0);
    const distTotal = dist.rows.filter((r: any) => r.status === 'sent' || r.status === 'received')
      .reduce((s: number, t: any) => s + parseFloat(t.source_volume_liters || "0"), 0);

    const isTransferCreated = b.parent_batch_id && transfersInTotal >= init * 0.9;
    const effectiveInitial = isTransferCreated ? 0 : init;

    const reconstructed = effectiveInitial + mergesInTotal - mergesOutTotal
      + transfersInTotal - transfersOutTotal - transferLossTotal
      - bottlingTotal - bottlingLoss - keggingTotal - keggingLoss
      - distTotal + adjTotal - rackingTotal;

    console.log(`\n  RECONSTRUCTION:`);
    console.log(`    effectiveInitial: ${G(effectiveInitial)} (isTransferCreated: ${isTransferCreated})`);
    console.log(`    + mergesIn: ${G(mergesInTotal)}`);
    console.log(`    - mergesOut: ${G(mergesOutTotal)}`);
    console.log(`    + transfersIn: ${G(transfersInTotal)}`);
    console.log(`    - transfersOut: ${G(transfersOutTotal)}`);
    console.log(`    - transferLoss: ${G(transferLossTotal)}`);
    console.log(`    - bottling: ${G(bottlingTotal)} (loss: ${G(bottlingLoss)})`);
    console.log(`    - kegging: ${G(keggingTotal)} (loss: ${G(keggingLoss)})`);
    console.log(`    - distillation: ${G(distTotal)}`);
    console.log(`    + adjustments: ${G(adjTotal)}`);
    console.log(`    - racking: ${G(rackingTotal)}`);
    console.log(`    = RECONSTRUCTED: ${G(reconstructed)} gal (${reconstructed.toFixed(1)} L)`);
    console.log(`    STORED (current): ${G(cur)} gal`);
    console.log(`    DELTA: ${G(reconstructed - cur)} gal`);
    console.log(`    batch.transfer_loss_l: ${G(tl)} gal (NOT included in reconstruction)`);
  }
}

async function main() {
  await c.connect();

  // Also get overall variance context
  const od = "2024-12-31";
  const rd = "2025-12-31";

  // Sum of all transfer_loss_l for eligible batches
  const tlTotal = await c.query(
    `SELECT COALESCE(SUM(CAST(COALESCE(transfer_loss_l,'0') AS DECIMAL)),0) as t
     FROM batches WHERE deleted_at IS NULL
     AND COALESCE(reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND start_date::date <= $1::date`,
    [rd]
  );
  console.log(`Total transfer_loss_l (all eligible): ${G(parseFloat(tlTotal.rows[0].t))} gal`);

  // Batch-scoped distributions (FULL HISTORY up to reconciliation date)
  const bDist = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as t
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     JOIN bottle_runs br ON ii.bottle_run_id = br.id
     JOIN batches b ON br.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND br.voided_at IS NULL
       AND b.start_date::date <= $1::date
       AND id.distribution_date::date <= $1::date`,
    [rd]
  );
  const kDist = await c.query(
    `SELECT COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)),0) as t
     FROM keg_fills kf
     JOIN batches b ON kf.batch_id = b.id
     WHERE b.deleted_at IS NULL
       AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
       AND kf.distributed_at IS NOT NULL
       AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
       AND b.start_date::date <= $1::date
       AND kf.distributed_at::date <= $1::date`,
    [rd]
  );

  // TTB aggregate distributions (for comparison)
  const ttbBDist = await c.query(
    `SELECT COALESCE(SUM(
       CAST(id.quantity_distributed AS DECIMAL) * CAST(ii.package_size_ml AS DECIMAL)
     ), 0) / 1000.0 as t
     FROM inventory_distributions id
     JOIN inventory_items ii ON id.inventory_item_id = ii.id
     WHERE id.distribution_date::date > $1::date AND id.distribution_date::date <= $2::date`,
    [od, rd]
  );
  const ttbKDist = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_taken AS DECIMAL)),0) as t
     FROM keg_fills
     WHERE distributed_at IS NOT NULL AND voided_at IS NULL AND deleted_at IS NULL
       AND distributed_at::date > $1::date AND distributed_at::date <= $2::date`,
    [od, rd]
  );

  const batchBottleDist = parseFloat(bDist.rows[0].t);
  const batchKegDist = parseFloat(kDist.rows[0].t);
  const ttbBottleDist = parseFloat(ttbBDist.rows[0].t);
  const ttbKegDist = parseFloat(ttbKDist.rows[0].t);

  console.log(`\nDISTRIBUTION COMPARISON (2025):`);
  console.log(`  Batch-scoped bottle dist: ${G(batchBottleDist)} gal (${batchBottleDist.toFixed(1)} L)`);
  console.log(`  TTB aggregate bottle dist: ${G(ttbBottleDist)} gal (${ttbBottleDist.toFixed(1)} L)`);
  console.log(`  Bottle diff: ${G(ttbBottleDist - batchBottleDist)} gal`);
  console.log(`  Batch-scoped keg dist: ${G(batchKegDist)} gal (${batchKegDist.toFixed(1)} L)`);
  console.log(`  TTB aggregate keg dist: ${G(ttbKegDist)} gal (${ttbKegDist.toFixed(1)} L)`);
  console.log(`  Keg diff: ${G(ttbKegDist - batchKegDist)} gal`);
  console.log(`  Total batch-scoped: ${G(batchBottleDist + batchKegDist)} gal`);
  console.log(`  Total TTB aggregate: ${G(ttbBottleDist + ttbKegDist)} gal`);

  // SBD packaging from eligible batches (FULL HISTORY up to reconciliation date)
  const bPkg = await c.query(
    `SELECT COALESCE(SUM(CAST(br.volume_taken_liters AS DECIMAL)),0) as taken,
            COALESCE(SUM(CAST(COALESCE(br.loss,'0') AS DECIMAL)),0) as loss
     FROM bottle_runs br JOIN batches b ON br.batch_id = b.id
     WHERE br.voided_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND b.start_date::date <= $1::date
     AND br.packaged_at::date <= $1::date`,
    [rd]
  );
  const kPkg = await c.query(
    `SELECT COALESCE(SUM(CAST(kf.volume_taken AS DECIMAL)),0) as taken,
            COALESCE(SUM(CAST(COALESCE(kf.loss,'0') AS DECIMAL)),0) as loss
     FROM keg_fills kf JOIN batches b ON kf.batch_id = b.id
     WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL AND b.deleted_at IS NULL
     AND COALESCE(b.reconciliation_status,'pending') NOT IN ('duplicate','excluded')
     AND b.start_date::date <= $1::date
     AND kf.filled_at::date <= $1::date`,
    [rd]
  );

  const bTaken = parseFloat(bPkg.rows[0].taken);
  const bLoss = parseFloat(bPkg.rows[0].loss);
  const kTaken = parseFloat(kPkg.rows[0].taken);
  const kLoss = parseFloat(kPkg.rows[0].loss);

  console.log(`\nPACKAGING vs DISTRIBUTIONS (eligible batches, 2025):`);
  console.log(`  Bottle: taken=${G(bTaken)} loss=${G(bLoss)} net=${G(bTaken - bLoss)}`);
  console.log(`  Keg:    taken=${G(kTaken)} loss=${G(kLoss)} net=${G(kTaken - kLoss)}`);
  console.log(`  Total net packaged: ${G((bTaken - bLoss) + (kTaken - kLoss))} gal`);
  console.log(`  Total batch-scoped dist: ${G(batchBottleDist + batchKegDist)} gal`);
  const packagedOnHand = (bTaken - bLoss) + (kTaken - kLoss) - (batchBottleDist + batchKegDist);
  console.log(`  Packaged on hand: ${G(packagedOnHand)} gal (${packagedOnHand.toFixed(1)} L)`);
  console.log(`  (positive = unsold packaged inventory still on premises)`);

  await investigateBatch("2025-11-16_6 Carboy 3_BLEND_A");
  await investigateBatch("2025-10-14_500 SS 1_BDBO_A");
  await investigateBatch("2025-10-20_120 Barrel 4_BIPE_A");

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
