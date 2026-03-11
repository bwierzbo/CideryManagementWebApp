import { db } from "..";
import { sql } from "drizzle-orm";

const L = 3.78541;

async function main() {
  // Find all Perry #1 and Perry #2 batches
  const perrys = await db.execute(sql`
    SELECT b.id, b.custom_name, b.batch_number, b.parent_batch_id,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           CAST(b.current_volume_liters AS TEXT) as current_vol,
           b.start_date, b.is_racking_derivative
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.custom_name IN ('Perry #1', 'Perry #2')
    ORDER BY b.start_date, b.custom_name
  `);

  for (const p of perrys.rows as any[]) {
    console.log(`\n======== ${p.custom_name} [${p.id.slice(0, 8)}] ========`);
    console.log(`  init: ${p.init_vol}L | current: ${p.current_vol}L`);
    console.log(`  parent: ${p.parent_batch_id ? p.parent_batch_id.slice(0, 8) : "NONE"}`);
    console.log(`  started: ${p.start_date} | isRackingDerivative: ${p.is_racking_derivative}`);

    // All transfers TO this batch (including soft-deleted)
    const tIn = await db.execute(sql`
      SELECT t.id, t.source_batch_id,
             CAST(t.volume_transferred AS TEXT) as vol,
             t.transferred_at, t.deleted_at as transfer_deleted,
             sb.custom_name as src_name, sb.deleted_at as src_batch_deleted,
             sb.is_racking_derivative as src_racking
      FROM batch_transfers t
      LEFT JOIN batches sb ON t.source_batch_id = sb.id
      WHERE t.destination_batch_id = ${p.id}
      ORDER BY t.transferred_at
    `);

    console.log(`\n  ALL transfers IN (including soft-deleted):`);
    let activeTotal = 0;
    for (const t of tIn.rows as any[]) {
      const vol = parseFloat(t.vol);
      const tDel = t.transfer_deleted ? " [TRANSFER DELETED]" : "";
      const sDel = t.src_batch_deleted ? " [SOURCE BATCH DELETED]" : "";
      console.log(`    ${t.src_name || "unknown"} → ${p.custom_name} | ${vol}L (${(vol / L).toFixed(1)} gal) | ${t.transferred_at}${tDel}${sDel}`);
      if (!t.transfer_deleted) activeTotal += vol;
    }

    console.log(`\n  Active (non-deleted) transfers IN: ${activeTotal.toFixed(1)}L (${(activeTotal / L).toFixed(1)} gal)`);
    const init = parseFloat(p.init_vol) || 0;
    const hasParent = !!p.parent_batch_id;
    const threshold = init * 0.9;
    const isTC = hasParent && activeTotal >= threshold;
    console.log(`  isTransferCreated: parent=${hasParent} && ${activeTotal.toFixed(1)} >= ${threshold.toFixed(1)} → ${isTC}`);
    if (isTC) {
      console.log(`  → effectiveInitial = 0 (init of ${init}L is NOT counted as production)`);
    } else {
      console.log(`  → effectiveInitial = ${init}L (counted as production)`);
    }
  }

  // Show the Nourish Perry and Perry Pear batches
  console.log("\n\n======== SOURCE BATCHES (Nourish Perry, Perry Pear) ========");
  const sources = await db.execute(sql`
    SELECT b.id, b.custom_name,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           CAST(b.current_volume_liters AS TEXT) as current_vol,
           b.start_date, b.deleted_at, b.product_type
    FROM batches b
    WHERE b.custom_name LIKE '%Nourish%' OR b.custom_name LIKE '%Perry Pear%'
    ORDER BY b.start_date
  `);
  for (const n of sources.rows as any[]) {
    console.log(`  ${n.custom_name} | type=${n.product_type} | init=${n.init_vol}L | current=${n.current_vol}L | deleted=${n.deleted_at ? n.deleted_at : "NO"}`);
  }

  // Show the parent batches of Perry #1 and Perry #2
  console.log("\n\n======== PARENT BATCHES ========");
  for (const p of perrys.rows as any[]) {
    if (p.parent_batch_id) {
      const parent = await db.execute(sql`
        SELECT id, custom_name, CAST(initial_volume_liters AS TEXT) as init_vol,
               CAST(current_volume_liters AS TEXT) as current_vol,
               deleted_at, product_type
        FROM batches WHERE id = ${p.parent_batch_id}
      `);
      const par = (parent.rows as any[])[0];
      if (par) {
        console.log(`  ${p.custom_name}'s parent: ${par.custom_name} [${par.id.slice(0, 8)}] | init=${par.init_vol}L | current=${par.current_vol}L | deleted=${par.deleted_at ? "YES" : "NO"}`);
      }
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
