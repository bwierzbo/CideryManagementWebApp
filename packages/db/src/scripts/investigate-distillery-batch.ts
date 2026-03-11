import { db } from "..";
import { sql } from "drizzle-orm";

const G = (l: number) => (l / 3.78541).toFixed(2);
const num = (v: any) => parseFloat(v || "0") || 0;

const DISTILLERY = "1539d85e";

async function main() {
  // Find the full ID
  const batch = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number, product_type, start_date, created_at,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as current_l,
           parent_batch_id, reconciliation_status, vessel_id,
           is_racking_derivative, origin_press_run_id
    FROM batches WHERE CAST(id AS text) LIKE '${DISTILLERY}%' AND deleted_at IS NULL
  `));
  const b = (batch.rows as any[])[0];
  if (!b) { console.log("Batch not found"); process.exit(1); }
  const BID = b.id;

  console.log("=== FOR DISTILLERY BATCH ===");
  console.log(`  ${b.custom_name} [${b.id}]`);
  console.log(`  type=${b.product_type}, init=${b.init_l}L (${G(num(b.init_l))} gal), current=${b.current_l}L`);
  console.log(`  start=${b.start_date}, created=${b.created_at}`);
  console.log(`  parent=${b.parent_batch_id || "NULL"}, vessel=${b.vessel_id}`);
  console.log(`  status=${b.reconciliation_status}, racking=${b.is_racking_derivative}`);
  console.log(`  press_run=${b.origin_press_run_id || "NULL"}`);

  // Transfers IN
  console.log("\n=== TRANSFERS IN ===");
  const xferIn = await db.execute(sql.raw(`
    SELECT CAST(bt.volume_transferred AS float) as vol, bt.transferred_at, bt.deleted_at,
           CAST(COALESCE(bt.loss, '0') AS float) as loss,
           sb.custom_name as src_name, sb.id as src_id, sb.product_type as src_type
    FROM batch_transfers bt
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = '${BID}'
    ORDER BY bt.transferred_at
  `));
  let activeIn = 0;
  for (const t of xferIn.rows as any[]) {
    const del = t.deleted_at ? " [DELETED]" : " [ACTIVE]";
    if (!t.deleted_at) activeIn += num(t.vol);
    console.log(`  ${num(t.vol).toFixed(1)}L ← ${t.src_name || (t.src_id as string).slice(0,8)} (${t.src_type}) at ${t.transferred_at}${del}`);
  }
  console.log(`  Total active in: ${activeIn.toFixed(1)}L (${G(activeIn)} gal)`);

  // Transfers OUT
  console.log("\n=== TRANSFERS OUT ===");
  const xferOut = await db.execute(sql.raw(`
    SELECT CAST(bt.volume_transferred AS float) as vol, bt.transferred_at, bt.deleted_at,
           CAST(COALESCE(bt.loss, '0') AS float) as loss,
           db.custom_name as dest_name, db.id as dest_id, db.product_type as dest_type
    FROM batch_transfers bt
    LEFT JOIN batches db ON bt.destination_batch_id = db.id
    WHERE bt.source_batch_id = '${BID}'
    ORDER BY bt.transferred_at
  `));
  let activeOut = 0;
  for (const t of xferOut.rows as any[]) {
    const del = t.deleted_at ? " [DELETED]" : " [ACTIVE]";
    if (!t.deleted_at) activeOut += num(t.vol);
    console.log(`  ${num(t.vol).toFixed(1)}L → ${t.dest_name || (t.dest_id as string).slice(0,8)} (${t.dest_type}) at ${t.transferred_at}${del}`);
  }
  console.log(`  Total active out: ${activeOut.toFixed(1)}L (${G(activeOut)} gal)`);

  // Merges
  console.log("\n=== MERGES ===");
  const merges = await db.execute(sql.raw(`
    SELECT m.source_batch_id, m.source_press_run_id, m.source_juice_purchase_item_id,
           m.source_type, CAST(m.volume_added AS float) as vol, m.merged_at, m.deleted_at,
           pr.press_run_name, sb.custom_name as src_name
    FROM batch_merge_history m
    LEFT JOIN press_runs pr ON m.source_press_run_id = pr.id
    LEFT JOIN batches sb ON m.source_batch_id = sb.id
    WHERE m.target_batch_id = '${BID}'
    ORDER BY m.merged_at
  `));
  let activeMerges = 0;
  for (const m of merges.rows as any[]) {
    const del = m.deleted_at ? " [DELETED]" : " [ACTIVE]";
    const src = m.press_run_name || m.src_name || m.source_juice_purchase_item_id || "?";
    if (!m.deleted_at) activeMerges += num(m.vol);
    console.log(`  ${num(m.vol).toFixed(1)}L from ${src} type=${m.source_type} at ${m.merged_at}${del}`);
  }
  console.log(`  Total active merges: ${activeMerges.toFixed(1)}L (${G(activeMerges)} gal)`);

  // Adjustments
  console.log("\n=== ADJUSTMENTS ===");
  const adjs = await db.execute(sql.raw(`
    SELECT CAST(adjustment_amount AS float) as amt, adjustment_date, reason, deleted_at
    FROM batch_volume_adjustments WHERE batch_id = '${BID}'
    ORDER BY adjustment_date
  `));
  for (const a of adjs.rows as any[]) {
    const del = a.deleted_at ? " [DELETED]" : "";
    console.log(`  ${num(a.amt).toFixed(1)}L reason="${a.reason}" at ${a.adjustment_date}${del}`);
  }
  if ((adjs.rows as any[]).length === 0) console.log("  (none)");

  // Bottle runs
  console.log("\n=== BOTTLE RUNS ===");
  const btl = await db.execute(sql.raw(`
    SELECT id, CAST(volume_taken_liters AS float) as vol, packaged_at, voided_at, status
    FROM bottle_runs WHERE batch_id = '${BID}'
    ORDER BY packaged_at
  `));
  let totalBtl = 0;
  for (const r of btl.rows as any[]) {
    const v = r.voided_at ? " [VOIDED]" : "";
    if (!r.voided_at) totalBtl += num(r.vol);
    console.log(`  ${num(r.vol).toFixed(1)}L status=${r.status} at ${r.packaged_at}${v}`);
  }
  if ((btl.rows as any[]).length === 0) console.log("  (none)");
  console.log(`  Total active bottled: ${totalBtl.toFixed(1)}L (${G(totalBtl)} gal)`);

  // Keg fills
  console.log("\n=== KEG FILLS ===");
  const kegs = await db.execute(sql.raw(`
    SELECT CAST(volume_taken AS float) as vol, filled_at, voided_at, deleted_at, distributed_at
    FROM keg_fills WHERE batch_id = '${BID}'
    ORDER BY filled_at
  `));
  let totalKeg = 0;
  for (const k of kegs.rows as any[]) {
    const flags = [k.voided_at ? "VOIDED" : "", k.deleted_at ? "DELETED" : "", k.distributed_at ? "DISTRIBUTED" : ""].filter(Boolean).join(",") || "ACTIVE";
    if (!k.voided_at && !k.deleted_at) totalKeg += num(k.vol);
    console.log(`  ${num(k.vol).toFixed(1)}L at ${k.filled_at} [${flags}]`);
  }
  if ((kegs.rows as any[]).length === 0) console.log("  (none)");
  console.log(`  Total active kegged: ${totalKeg.toFixed(1)}L (${G(totalKeg)} gal)`);

  // Distillation records
  console.log("\n=== DISTILLATION RECORDS ===");
  const dist = await db.execute(sql.raw(`
    SELECT id, CAST(volume_distilled_liters AS float) as vol, distillation_date, deleted_at
    FROM distillation_records WHERE batch_id = '${BID}'
    ORDER BY distillation_date
  `));
  for (const d of dist.rows as any[]) {
    const del = d.deleted_at ? " [DELETED]" : "";
    console.log(`  ${num(d.vol).toFixed(1)}L at ${d.distillation_date}${del}`);
  }
  if ((dist.rows as any[]).length === 0) console.log("  (none)");

  // SBD reconstruction at opening
  console.log("\n=== SBD AT OPENING (2024-12-31) ===");
  const initEff = num(b.init_l); // no parent, so not TC

  const tiPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol
    FROM batch_transfers WHERE destination_batch_id = '${BID}' AND deleted_at IS NULL AND transferred_at < '2025-01-01'
  `));
  const toPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol,
           COALESCE(SUM(CAST(COALESCE(loss,'0') AS float)), 0) as loss
    FROM batch_transfers WHERE source_batch_id = '${BID}' AND deleted_at IS NULL AND transferred_at < '2025-01-01'
  `));
  const miPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
    FROM batch_merge_history WHERE target_batch_id = '${BID}' AND deleted_at IS NULL AND merged_at < '2025-01-01'
  `));
  const moPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
    FROM batch_merge_history WHERE source_batch_id = '${BID}' AND deleted_at IS NULL AND merged_at < '2025-01-01'
  `));
  const adjPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS float)), 0) as vol
    FROM batch_volume_adjustments WHERE batch_id = '${BID}' AND deleted_at IS NULL AND adjustment_date < '2025-01-01'
  `));
  const btlPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS float)), 0) as vol
    FROM bottle_runs WHERE batch_id = '${BID}' AND voided_at IS NULL AND packaged_at < '2025-01-01'
  `));
  const kegPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken AS float)), 0) as vol
    FROM keg_fills WHERE batch_id = '${BID}' AND voided_at IS NULL AND deleted_at IS NULL AND filled_at < '2025-01-01'
  `));
  const distPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_distilled_liters AS float)), 0) as vol
    FROM distillation_records WHERE batch_id = '${BID}' AND deleted_at IS NULL AND distillation_date < '2025-01-01'
  `));

  const ti = num((tiPre.rows as any[])[0].vol);
  const to = num((toPre.rows as any[])[0].vol);
  const tl = num((toPre.rows as any[])[0].loss);
  const mi = num((miPre.rows as any[])[0].vol);
  const mo = num((moPre.rows as any[])[0].vol);
  const ad = num((adjPre.rows as any[])[0].vol);
  const bl = num((btlPre.rows as any[])[0].vol);
  const kg = num((kegPre.rows as any[])[0].vol);
  const ds = num((distPre.rows as any[])[0].vol);

  const raw = initEff + ti - to - tl + mi - mo + ad - bl - kg - ds;
  const clamped = Math.max(0, raw);

  console.log(`  init=${initEff.toFixed(1)}L`);
  console.log(`  +xferIn=${ti.toFixed(1)}L  -xferOut=${to.toFixed(1)}L  -xferLoss=${tl.toFixed(1)}L`);
  console.log(`  +mergesIn=${mi.toFixed(1)}L  -mergesOut=${mo.toFixed(1)}L`);
  console.log(`  +adj=${ad.toFixed(1)}L  -btl=${bl.toFixed(1)}L  -keg=${kg.toFixed(1)}L  -distill=${ds.toFixed(1)}L`);
  console.log(`  RAW=${raw.toFixed(1)}L (${G(raw)} gal)  CLAMPED=${clamped.toFixed(1)}L (${G(clamped)} gal)`);

  // Also look at ALL batches with product_type that could be distillery-related
  console.log("\n=== ALL BRANDY/SPIRIT BATCHES ===");
  const brandyBatches = await db.execute(sql.raw(`
    SELECT id, custom_name, batch_number, product_type,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as current_l,
           reconciliation_status, start_date
    FROM batches
    WHERE deleted_at IS NULL AND product_type IN ('brandy', 'spirit', 'spirits')
    ORDER BY start_date
  `));
  for (const bb of brandyBatches.rows as any[]) {
    console.log(`  ${(bb.id as string).slice(0,8)} ${bb.custom_name || bb.batch_number} type=${bb.product_type} init=${num(bb.init_l).toFixed(1)}L current=${num(bb.current_l).toFixed(1)}L status=${bb.reconciliation_status}`);
  }
  if ((brandyBatches.rows as any[]).length === 0) console.log("  (none)");

  // What about the gap? How much do we need to move?
  console.log("\n=== GAP ANALYSIS ===");
  const ciderGap = 1088.3 - 1061; // 27.3 gal
  const gapLiters = ciderGap * 3.78541;
  console.log(`  Cider SBD opening: 1088.3 gal`);
  console.log(`  Cider configured: 1061 gal`);
  console.log(`  Gap: ${ciderGap.toFixed(1)} gal = ${gapLiters.toFixed(1)}L`);
  console.log(`  Need to remove ~${gapLiters.toFixed(0)}L from cider SBD opening`);
  console.log(`  For Distillery SBD opening: ${G(clamped)} gal (${clamped.toFixed(1)}L)`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
