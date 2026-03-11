import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Trace ALL connections and dependencies of the Raspberry Blackberry batch (c2436e1d)
 * to understand the full impact of deleting it.
 */

const RB = "c2436e1d-2e14-4d04-a68a-2258fcd64b16";
const G = (l: number) => (l / 3.78541).toFixed(2);
const num = (v: any) => parseFloat(v || "0") || 0;

async function main() {
  // 1. Batch basic info
  console.log("=== RB BATCH INFO ===");
  const info = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number, product_type, start_date, created_at,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as current_l,
           parent_batch_id, reconciliation_status, vessel_id,
           is_racking_derivative, origin_press_run_id
    FROM batches WHERE id = '${RB}'
  `));
  const b = (info.rows as any[])[0];
  console.log(`  ${b.custom_name} [${b.id.slice(0, 8)}]`);
  console.log(`  type=${b.product_type}, init=${b.init_l}L, current=${b.current_l}L`);
  console.log(`  start=${b.start_date}, created=${b.created_at}`);
  console.log(`  parent=${b.parent_batch_id || "NULL"}, vessel=${b.vessel_id}`);
  console.log(`  status=${b.reconciliation_status}, racking=${b.is_racking_derivative}`);
  console.log(`  press_run=${b.origin_press_run_id || "NULL"}`);

  // 2. Children batches (batches with parent_batch_id = RB)
  console.log("\n=== CHILD BATCHES ===");
  const children = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number, product_type,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as current_l,
           reconciliation_status, deleted_at
    FROM batches WHERE parent_batch_id = '${RB}'
    ORDER BY start_date
  `));
  if ((children.rows as any[]).length === 0) console.log("  (none)");
  for (const c of children.rows as any[]) {
    const del = c.deleted_at ? " [DELETED]" : "";
    console.log(`  ${(c.id as string).slice(0, 8)} ${c.custom_name || c.batch_number} init=${num(c.init_l).toFixed(1)}L current=${num(c.current_l).toFixed(1)}L status=${c.reconciliation_status}${del}`);
  }

  // 3. Transfers OUT (RB as source)
  console.log("\n=== TRANSFERS OUT (RB as source) ===");
  const xferOut = await db.execute(sql.raw(`
    SELECT bt.id, CAST(bt.volume_transferred AS float) as vol, bt.transferred_at,
           bt.deleted_at, CAST(COALESCE(bt.loss, '0') AS float) as loss,
           b.custom_name as dest_name, b.id as dest_id
    FROM batch_transfers bt
    LEFT JOIN batches b ON bt.destination_batch_id = b.id
    WHERE bt.source_batch_id = '${RB}'
    ORDER BY bt.transferred_at
  `));
  let totalOut = 0;
  for (const t of xferOut.rows as any[]) {
    const del = t.deleted_at ? " [DELETED]" : " [ACTIVE]";
    if (!t.deleted_at) totalOut += num(t.vol);
    console.log(`  ${num(t.vol).toFixed(1)}L (+${num(t.loss).toFixed(1)}L loss) → ${t.dest_name || (t.dest_id as string).slice(0, 8)} at ${t.transferred_at}${del}`);
  }
  console.log(`  Total active out: ${totalOut.toFixed(1)}L (${G(totalOut)} gal)`);

  // 4. Transfers IN (RB as destination)
  console.log("\n=== TRANSFERS IN (RB as destination) ===");
  const xferIn = await db.execute(sql.raw(`
    SELECT bt.id, CAST(bt.volume_transferred AS float) as vol, bt.transferred_at,
           bt.deleted_at, b.custom_name as src_name, b.id as src_id
    FROM batch_transfers bt
    LEFT JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.destination_batch_id = '${RB}'
    ORDER BY bt.transferred_at
  `));
  let totalIn = 0;
  for (const t of xferIn.rows as any[]) {
    const del = t.deleted_at ? " [DELETED]" : " [ACTIVE]";
    if (!t.deleted_at) totalIn += num(t.vol);
    console.log(`  ${num(t.vol).toFixed(1)}L ← ${t.src_name || (t.src_id as string).slice(0, 8)} at ${t.transferred_at}${del}`);
  }
  console.log(`  Total active in: ${totalIn.toFixed(1)}L (${G(totalIn)} gal)`);

  // 5. Merge history (RB as target or source)
  console.log("\n=== MERGE HISTORY (target or source) ===");
  const merges = await db.execute(sql.raw(`
    SELECT m.id, m.target_batch_id, m.source_batch_id, m.source_press_run_id,
           CAST(m.volume_added AS float) as vol, m.merged_at, m.deleted_at, m.source_type,
           tb.custom_name as target_name, sb.custom_name as src_name
    FROM batch_merge_history m
    LEFT JOIN batches tb ON m.target_batch_id = tb.id
    LEFT JOIN batches sb ON m.source_batch_id = sb.id
    WHERE m.target_batch_id = '${RB}' OR m.source_batch_id = '${RB}'
    ORDER BY m.merged_at
  `));
  if ((merges.rows as any[]).length === 0) console.log("  (none)");
  for (const m of merges.rows as any[]) {
    const del = m.deleted_at ? " [DELETED]" : " [ACTIVE]";
    const dir = m.target_batch_id === RB ? "INTO RB" : "FROM RB";
    const other = dir === "INTO RB"
      ? (m.src_name || m.source_press_run_id || "?")
      : (m.target_name || "?");
    console.log(`  ${num(m.vol).toFixed(1)}L ${dir} ← ${other} type=${m.source_type} at ${m.merged_at}${del}`);
  }

  // 6. Bottle runs
  console.log("\n=== BOTTLE RUNS ===");
  const bottles = await db.execute(sql.raw(`
    SELECT id, CAST(volume_taken_liters AS float) as vol, packaged_at, voided_at,
           status, CAST(COALESCE(loss, '0') AS float) as loss
    FROM bottle_runs WHERE batch_id = '${RB}'
    ORDER BY packaged_at
  `));
  let totalBottled = 0;
  for (const br of bottles.rows as any[]) {
    const voided = br.voided_at ? " [VOIDED]" : "";
    if (!br.voided_at) totalBottled += num(br.vol);
    console.log(`  ${num(br.vol).toFixed(1)}L (loss=${num(br.loss).toFixed(1)}L) status=${br.status} at ${br.packaged_at}${voided}`);
  }
  console.log(`  Total active bottled: ${totalBottled.toFixed(1)}L (${G(totalBottled)} gal)`);

  // 7. Keg fills
  console.log("\n=== KEG FILLS ===");
  const kegs = await db.execute(sql.raw(`
    SELECT id, CAST(volume_taken AS float) as vol, filled_at, voided_at, deleted_at,
           distributed_at
    FROM keg_fills WHERE batch_id = '${RB}'
    ORDER BY filled_at
  `));
  if ((kegs.rows as any[]).length === 0) console.log("  (none)");
  for (const k of kegs.rows as any[]) {
    const flags = [k.voided_at ? "VOIDED" : "", k.deleted_at ? "DELETED" : "", k.distributed_at ? "DISTRIBUTED" : ""].filter(Boolean).join(",");
    console.log(`  ${num(k.vol).toFixed(1)}L at ${k.filled_at} [${flags || "ACTIVE"}]`);
  }

  // 8. Volume adjustments
  console.log("\n=== VOLUME ADJUSTMENTS ===");
  const adjs = await db.execute(sql.raw(`
    SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_date, reason, deleted_at
    FROM batch_volume_adjustments WHERE batch_id = '${RB}'
    ORDER BY adjustment_date
  `));
  if ((adjs.rows as any[]).length === 0) console.log("  (none)");
  for (const a of adjs.rows as any[]) {
    const del = a.deleted_at ? " [DELETED]" : "";
    console.log(`  ${num(a.amt).toFixed(1)}L reason="${a.reason}" at ${a.adjustment_date}${del}`);
  }

  // 9. Measurements
  console.log("\n=== MEASUREMENTS ===");
  const meas = await db.execute(sql.raw(`
    SELECT id, measurement_date, measurement_type,
           CAST(specific_gravity AS float) as sg,
           CAST(temperature_celsius AS float) as temp
    FROM measurements WHERE batch_id = '${RB}'
    ORDER BY measurement_date
  `));
  console.log(`  ${(meas.rows as any[]).length} measurements`);

  // 10. Audit logs referencing this batch
  console.log("\n=== AUDIT LOG ENTRIES ===");
  const audits = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM audit_logs WHERE entity_id = '${RB}'
  `));
  console.log(`  ${(audits.rows as any[])[0].cnt} audit log entries`);

  // 11. Inventory items / distributions
  console.log("\n=== INVENTORY ITEMS ===");
  const inv = await db.execute(sql.raw(`
    SELECT id, status, CAST(quantity AS int) as qty
    FROM inventory_items WHERE batch_id = '${RB}'
  `));
  if ((inv.rows as any[]).length === 0) console.log("  (none)");
  for (const i of inv.rows as any[]) {
    console.log(`  ${i.id.slice(0, 8)} status=${i.status} qty=${i.qty}`);
  }

  // 12. Press run linkage
  console.log("\n=== PRESS RUN LINKAGE ===");
  if (b.origin_press_run_id) {
    const pr = await db.execute(sql.raw(`
      SELECT id, press_run_name, CAST(total_juice_volume_liters AS float) as juice_l,
             date_completed
      FROM press_runs WHERE id = '${b.origin_press_run_id}'
    `));
    const p = (pr.rows as any[])[0];
    console.log(`  Press run: ${p?.press_run_name} juice=${num(p?.juice_l).toFixed(1)}L date=${p?.date_completed}`);

    // Other batches from same press run
    const siblings = await db.execute(sql.raw(`
      SELECT id, custom_name, batch_number, CAST(initial_volume_liters AS float) as init_l
      FROM batches
      WHERE origin_press_run_id = '${b.origin_press_run_id}' AND id != '${RB}' AND deleted_at IS NULL
    `));
    console.log(`  Other batches from same press run:`);
    for (const s of siblings.rows as any[]) {
      console.log(`    ${(s.id as string).slice(0, 8)} ${s.custom_name || s.batch_number} init=${num(s.init_l).toFixed(1)}L`);
    }
  }

  // 13. Impact on other batches (transfers where RB is source)
  console.log("\n=== IMPACT SUMMARY ===");
  console.log(`  Deleting RB would:`);
  console.log(`  - Remove ${b.init_l}L (${G(num(b.init_l))} gal) from SBD opening`);
  console.log(`  - Remove ${totalOut.toFixed(1)}L transferred OUT to other batches`);
  console.log(`  - Remove ${totalIn.toFixed(1)}L transferred IN from other batches`);
  console.log(`  - Remove ${totalBottled.toFixed(1)}L of bottled product (distributions)`);

  // Check if any destination batches depend on RB transfers for their volume
  if (totalOut > 0) {
    console.log(`\n  Destination batches that received volume from RB:`);
    for (const t of xferOut.rows as any[]) {
      if (t.deleted_at) continue;
      const destInfo = await db.execute(sql.raw(`
        SELECT id, custom_name, CAST(initial_volume_liters AS float) as init_l,
               CAST(current_volume_liters AS float) as current_l,
               parent_batch_id
        FROM batches WHERE id = '${t.dest_id}'
      `));
      const d = (destInfo.rows as any[])[0];
      if (d) {
        const isChild = d.parent_batch_id === RB;
        console.log(`    ${(d.id as string).slice(0, 8)} ${d.custom_name} init=${num(d.init_l).toFixed(1)}L current=${num(d.current_l).toFixed(1)}L isChild=${isChild}`);
      }
    }
  }

  // Check if any source batches would have their transfersOut orphaned
  if (totalIn > 0) {
    console.log(`\n  Source batches that transferred volume TO RB:`);
    for (const t of xferIn.rows as any[]) {
      if (t.deleted_at) continue;
      const srcInfo = await db.execute(sql.raw(`
        SELECT id, custom_name, CAST(current_volume_liters AS float) as current_l
        FROM batches WHERE id = '${t.src_id}'
      `));
      const s = (srcInfo.rows as any[])[0];
      if (s) {
        console.log(`    ${(s.id as string).slice(0, 8)} ${s.custom_name} current=${num(s.current_l).toFixed(1)}L (transferred ${num(t.vol).toFixed(1)}L to RB)`);
      }
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
