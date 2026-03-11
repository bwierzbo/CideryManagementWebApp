import { db } from "..";
import { sql } from "drizzle-orm";

const G = 0.264172;
function f(v: any, d = 1) {
  return v == null ? "null" : parseFloat(String(v)).toFixed(d);
}
function lg(l: any) {
  if (l == null) return "null";
  const v = parseFloat(String(l));
  return `${v.toFixed(1)}L (${(v * G).toFixed(1)}gal)`;
}

async function main() {
  // ===== 1. Find the parent batch =====
  console.log("=== 1. PARENT BATCH — Community Blend #1 ===");
  const parentRes = await db.execute(sql.raw(`
    SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      b.start_date::text, b.parent_batch_id, b.reconciliation_status,
      b.deleted_at::text, b.fermentation_stage,
      CAST(b.estimated_abv AS NUMERIC) AS est_abv,
      CAST(b.actual_abv AS NUMERIC) AS act_abv,
      b.is_racking_derivative, b.origin_press_run_id,
      CAST(b.transfer_loss_l AS NUMERIC) AS transfer_loss_l,
      v.name AS vessel_name, v.id AS vessel_id,
      b.created_at::text, b.updated_at::text
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.batch_number ILIKE '%Community%Blend%'
       OR b.custom_name ILIKE '%Community%Blend%'
       OR b.batch_number ILIKE '%UNKN_BLEND_A%'
       OR b.custom_name ILIKE '%UNKN_BLEND_A%')
    ORDER BY b.deleted_at NULLS FIRST, b.start_date
  `));
  const parents = parentRes.rows as any[];

  if (!parents.length) {
    console.log("No batches found matching 'Community Blend' or 'UNKN_BLEND_A'. Trying broader search...");
    const broad = await db.execute(sql.raw(`
      SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
        CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
        CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
        b.start_date::text, b.reconciliation_status, b.deleted_at::text
      FROM batches b
      WHERE b.batch_number ILIKE '%Community%' OR b.custom_name ILIKE '%Community%'
         OR b.batch_number ILIKE '%Blend%' OR b.custom_name ILIKE '%Blend%'
      ORDER BY b.start_date
    `));
    console.log("Broader results:");
    for (const b of broad.rows as any[]) {
      console.log(`  ${b.batch_number} | ${b.custom_name} | type=${b.product_type} init=${lg(b.init_l)} curr=${lg(b.curr_l)} recon=${b.reconciliation_status} del=${b.deleted_at || "no"}`);
    }
    if (!(broad.rows as any[]).length) {
      console.log("Nothing found. Exiting.");
    }
    process.exit(0);
  }

  // Display parent details
  for (const b of parents) {
    const fl: string[] = [];
    if (b.deleted_at) fl.push("DELETED");
    if (b.is_racking_derivative) fl.push("RACK_DERIV");
    if (b.reconciliation_status && b.reconciliation_status !== "pending")
      fl.push("recon=" + b.reconciliation_status);
    console.log(
      `\n  ${b.batch_number} / ${b.custom_name || "(no custom name)"} [${fl.join(",")}]`
    );
    console.log(`  ID: ${b.id}`);
    console.log(`  Type: ${b.product_type}, Status: ${b.status}, FermStage: ${b.fermentation_stage}`);
    console.log(`  Init: ${lg(b.init_l)}, Current: ${lg(b.curr_l)}`);
    console.log(`  TransferLoss: ${lg(b.transfer_loss_l)}`);
    console.log(`  Start: ${b.start_date}, Created: ${b.created_at}, Updated: ${b.updated_at}`);
    console.log(`  Vessel: ${b.vessel_name || "NONE"} (${b.vessel_id || "none"})`);
    console.log(`  Parent: ${b.parent_batch_id || "NONE"}`);
    console.log(`  EstABV: ${b.est_abv ? f(b.est_abv) + "%" : "null"}, ActABV: ${b.act_abv ? f(b.act_abv) + "%" : "null"}`);
    console.log(`  PressRunId: ${b.origin_press_run_id || "NONE"}`);
    console.log(`  ReconStatus: ${b.reconciliation_status}`);
  }

  const parentIds = parents.map((b: any) => b.id);
  const pil = parentIds.map((id: string) => `'${id}'`).join(",");

  // ===== 2. Child batches =====
  console.log("\n=== 2. CHILD BATCHES (parent_batch_id = parent) ===");
  const childRes = await db.execute(sql.raw(`
    SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      b.start_date::text, b.parent_batch_id, b.reconciliation_status,
      b.deleted_at::text, b.fermentation_stage,
      b.is_racking_derivative,
      CAST(b.transfer_loss_l AS NUMERIC) AS transfer_loss_l,
      v.name AS vessel_name, v.id AS vessel_id,
      b.created_at::text, b.updated_at::text
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.parent_batch_id IN (${pil})
    ORDER BY b.deleted_at NULLS FIRST, b.start_date
  `));
  const children = childRes.rows as any[];

  if (!children.length) {
    console.log("  (no children found)");
  }
  for (const c of children) {
    const fl: string[] = [];
    if (c.deleted_at) fl.push("DEL");
    if (c.is_racking_derivative) fl.push("RACK");
    if (c.reconciliation_status && c.reconciliation_status !== "pending")
      fl.push("recon=" + c.reconciliation_status);
    console.log(
      `\n  ${c.batch_number} / ${c.custom_name || "(no custom name)"} [${fl.join(",")}]`
    );
    console.log(`  ID: ${c.id}`);
    console.log(`  Type: ${c.product_type}, Status: ${c.status}, FermStage: ${c.fermentation_stage}`);
    console.log(`  Init: ${lg(c.init_l)}, Current: ${lg(c.curr_l)}`);
    console.log(`  TransferLoss: ${lg(c.transfer_loss_l)}`);
    console.log(`  Start: ${c.start_date}, ParentBatchId: ${c.parent_batch_id}`);
    console.log(`  Vessel: ${c.vessel_name || "NONE"} (${c.vessel_id || "none"})`);
    console.log(`  ReconStatus: ${c.reconciliation_status}`);
    console.log(`  Created: ${c.created_at}, Updated: ${c.updated_at}`);
    console.log(`  Deleted: ${c.deleted_at || "no"}`);
  }

  // Gather all batch IDs (parents + children) for subsequent queries
  const childIds = children.map((c: any) => c.id);
  const allIds = [...parentIds, ...childIds];
  const ail = allIds.map((id: string) => `'${id}'`).join(",");

  // ===== 3. Batch transfers FROM parent TO children =====
  console.log("\n=== 3. BATCH TRANSFERS FROM PARENT TO CHILDREN ===");
  const xfParentToChild = (
    await db.execute(sql.raw(`
    SELECT bt.id, bs.batch_number AS src_bn, bs.custom_name AS src_cn,
      bd.batch_number AS dst_bn, bd.custom_name AS dst_cn, bd.product_type AS dst_type,
      bd.id AS dst_id, bs.id AS src_id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
      bt.transferred_at::text, bt.deleted_at::text, bt.notes,
      bt.created_at::text
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id = bs.id
    JOIN batches bd ON bt.destination_batch_id = bd.id
    WHERE bt.source_batch_id IN (${pil})
    ORDER BY bt.transferred_at
  `))
  ).rows as any[];

  if (!xfParentToChild.length) console.log("  (none)");
  for (const t of xfParentToChild) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL =
      t.volume_transferred_unit === "gal"
        ? parseFloat(t.vol) * 3.78541
        : parseFloat(t.vol);
    const lossL =
      t.loss_unit === "gal"
        ? parseFloat(t.loss || 0) * 3.78541
        : parseFloat(t.loss || 0);
    console.log(
      `  ${t.transferred_at}: ${t.src_bn}(${t.src_cn}) -> ${t.dst_bn}(${t.dst_cn}) [${t.dst_type}]: ${f(t.vol)}${t.volume_transferred_unit} (=${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit || "L"} (=${f(lossL)}L)${d}`
    );
    console.log(`    TransferID: ${t.id}, DstID: ${t.dst_id}, Created: ${t.created_at}`);
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }

  // ===== 3b. ALL transfers involving any of these batches =====
  console.log("\n=== 3b. ALL BATCH TRANSFERS INVOLVING ANY PARENT OR CHILD ===");
  const xfAll = (
    await db.execute(sql.raw(`
    SELECT bt.id,
      bs.batch_number AS src_bn, bs.custom_name AS src_cn, bs.id AS src_id,
      bd.batch_number AS dst_bn, bd.custom_name AS dst_cn, bd.id AS dst_id,
      bd.product_type AS dst_type,
      CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
      bt.transferred_at::text, bt.deleted_at::text, bt.notes,
      bt.created_at::text
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id = bs.id
    JOIN batches bd ON bt.destination_batch_id = bd.id
    WHERE bt.source_batch_id IN (${ail}) OR bt.destination_batch_id IN (${ail})
    ORDER BY bt.transferred_at
  `))
  ).rows as any[];

  if (!xfAll.length) console.log("  (none)");
  for (const t of xfAll) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL =
      t.volume_transferred_unit === "gal"
        ? parseFloat(t.vol) * 3.78541
        : parseFloat(t.vol);
    const lossL =
      t.loss_unit === "gal"
        ? parseFloat(t.loss || 0) * 3.78541
        : parseFloat(t.loss || 0);
    const srcMark = parentIds.includes(t.src_id) ? " [PARENT]" : childIds.includes(t.src_id) ? " [CHILD]" : "";
    const dstMark = parentIds.includes(t.dst_id) ? " [PARENT]" : childIds.includes(t.dst_id) ? " [CHILD]" : "";
    console.log(
      `  ${t.transferred_at}: ${t.src_bn}(${t.src_cn})${srcMark} -> ${t.dst_bn}(${t.dst_cn})${dstMark} [${t.dst_type}]: ${f(t.vol)}${t.volume_transferred_unit} (=${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit || "L"} (=${f(lossL)}L)${d}`
    );
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }

  // ===== 4. Batch merge history for all batches =====
  console.log("\n=== 4. BATCH MERGE HISTORY (all batches as target) ===");
  const mergesIn = (
    await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bt.batch_number AS target_bn, bt.custom_name AS target_cn,
      bmh.source_batch_id, bs.batch_number AS source_bn, bs.custom_name AS source_cn,
      bmh.source_press_run_id, pr.press_run_name,
      bmh.source_juice_purchase_item_id,
      bmh.source_type,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      CAST(bmh.source_abv AS NUMERIC) AS sabv,
      bmh.merged_at::text, bmh.deleted_at::text, bmh.notes
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
    LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
    WHERE bmh.target_batch_id IN (${ail})
    ORDER BY bmh.merged_at
  `))
  ).rows as any[];
  if (!mergesIn.length) console.log("  (none)");
  for (const m of mergesIn) {
    const d = m.deleted_at ? " [DEL]" : "";
    const src =
      m.source_bn || m.source_cn || m.press_run_name || (m.source_juice_purchase_item_id ? "juice_purchase:" + m.source_juice_purchase_item_id : "unknown");
    const volL =
      m.volume_added_unit === "gal"
        ? parseFloat(m.vol) * 3.78541
        : parseFloat(m.vol);
    console.log(
      `  ${m.merged_at}: ${src} -> ${m.target_bn}/${m.target_cn}: ${f(m.vol)}${m.volume_added_unit} (=${f(volL)}L) type=${m.source_type} abv=${f(m.sabv || 0)}%${d}`
    );
    if (m.notes) console.log(`    Notes: ${m.notes}`);
  }

  console.log("\n=== 4b. BATCH MERGE HISTORY (all batches as source) ===");
  const mergesOut = (
    await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bt.batch_number AS target_bn, bt.custom_name AS target_cn,
      bmh.source_batch_id, bs.batch_number AS source_bn, bs.custom_name AS source_cn,
      bmh.source_type,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      bmh.merged_at::text, bmh.deleted_at::text, bmh.notes
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
    WHERE bmh.source_batch_id IN (${ail})
    ORDER BY bmh.merged_at
  `))
  ).rows as any[];
  if (!mergesOut.length) console.log("  (none)");
  for (const m of mergesOut) {
    const d = m.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${m.merged_at}: ${m.source_bn || m.source_cn} -> ${m.target_bn}/${m.target_cn}: ${f(m.vol)}${m.volume_added_unit} type=${m.source_type}${d}`
    );
    if (m.notes) console.log(`    Notes: ${m.notes}`);
  }

  // ===== 5. Racking operations for children =====
  console.log("\n=== 5. RACKING OPERATIONS (all batches) ===");
  const rack = (
    await db.execute(sql.raw(`
    SELECT bro.id, b.batch_number, b.custom_name, b.id AS batch_id,
      sv.name AS sv, dv.name AS dv,
      CAST(bro.volume_before AS NUMERIC) AS vb, bro.volume_before_unit,
      CAST(bro.volume_after AS NUMERIC) AS va, bro.volume_after_unit,
      CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
      bro.racked_at::text, bro.deleted_at::text, bro.notes
    FROM batch_racking_operations bro
    JOIN batches b ON bro.batch_id = b.id
    LEFT JOIN vessels sv ON bro.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bro.destination_vessel_id = dv.id
    WHERE bro.batch_id IN (${ail})
    ORDER BY bro.racked_at
  `))
  ).rows as any[];
  if (!rack.length) console.log("  (none)");
  for (const r of rack) {
    const d = r.deleted_at ? " [DEL]" : "";
    const mark = parentIds.includes(r.batch_id) ? " [PARENT]" : " [CHILD]";
    console.log(
      `  ${r.racked_at}: ${r.batch_number}/${r.custom_name}${mark}: ${r.sv || "?"}->${r.dv || "?"} before=${f(r.vb)}${r.volume_before_unit} after=${f(r.va)}${r.volume_after_unit} loss=${f(r.vl)}${r.volume_loss_unit}${d}`
    );
    if (r.notes) console.log(`    Notes: ${r.notes}`);
  }

  // ===== 6. Bottle runs for all batches =====
  console.log("\n=== 6. BOTTLE RUNS (all batches) ===");
  const btl = (
    await db.execute(sql.raw(`
    SELECT br.id, b.batch_number, b.custom_name, b.id AS batch_id,
      CAST(br.volume_taken_liters AS NUMERIC) AS vol,
      CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
      br.units_produced, br.package_type, br.packaged_at::text,
      br.voided_at::text, br.status, br.distributed_at::text,
      br.created_at::text
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.batch_id IN (${ail})
    ORDER BY br.packaged_at
  `))
  ).rows as any[];
  if (!btl.length) console.log("  (none)");
  for (const b of btl) {
    const v = b.voided_at ? " [VOID]" : "";
    const mark = parentIds.includes(b.batch_id) ? " [PARENT]" : " [CHILD]";
    console.log(
      `  ${b.packaged_at}: ${b.batch_number}/${b.custom_name}${mark}: ${lg(b.vol)} loss=${f(b.loss || 0)}${b.loss_unit || "L"} (${b.units_produced} ${b.package_type}) status=${b.status} dist=${b.distributed_at || "no"}${v}`
    );
  }

  // ===== 7. Keg fills for all batches =====
  console.log("\n=== 7. KEG FILLS (all batches) ===");
  const keg = (
    await db.execute(sql.raw(`
    SELECT kf.id, b.batch_number, b.custom_name, b.id AS batch_id,
      CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
      kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text,
      kf.status, kf.distributed_at::text, kf.production_notes,
      kf.keg_id,
      kf.created_at::text
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.batch_id IN (${ail})
    ORDER BY kf.filled_at
  `))
  ).rows as any[];
  if (!keg.length) console.log("  (none)");
  for (const k of keg) {
    const fl: string[] = [];
    if (k.deleted_at) fl.push("DEL");
    if (k.voided_at) fl.push("VOID");
    const fs = fl.length ? ` [${fl.join(",")}]` : "";
    const mark = parentIds.includes(k.batch_id) ? " [PARENT]" : " [CHILD]";
    const volL =
      k.volume_taken_unit === "gal"
        ? parseFloat(k.vol) * 3.78541
        : parseFloat(k.vol);
    console.log(
      `  ${k.filled_at}: ${k.batch_number}/${k.custom_name}${mark}: ${f(k.vol)}${k.volume_taken_unit} (=${f(volL)}L) loss=${f(k.loss || 0)}${k.loss_unit || "L"} keg=${k.keg_id || "?"} status=${k.status} dist=${k.distributed_at || "no"}${fs}`
    );
    if (k.production_notes) console.log(`    Notes: ${k.production_notes}`);
  }

  // ===== 8. Volume adjustments for all batches =====
  console.log("\n=== 8. VOLUME ADJUSTMENTS (all batches) ===");
  const adj = (
    await db.execute(sql.raw(`
    SELECT bva.id, b.batch_number, b.custom_name, b.id AS batch_id,
      CAST(bva.adjustment_amount AS NUMERIC) AS amt,
      CAST(bva.volume_before AS NUMERIC) AS vb,
      CAST(bva.volume_after AS NUMERIC) AS va,
      bva.reason, bva.adjustment_type,
      bva.created_at::text, bva.deleted_at::text, bva.notes
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.batch_id IN (${ail})
    ORDER BY bva.created_at
  `))
  ).rows as any[];
  if (!adj.length) console.log("  (none)");
  for (const a of adj) {
    const d = a.deleted_at ? " [DEL]" : "";
    const mark = parentIds.includes(a.batch_id) ? " [PARENT]" : " [CHILD]";
    console.log(
      `  ${a.created_at}: ${a.batch_number}/${a.custom_name}${mark}: ${f(a.amt)}L (${f(a.vb)}L -> ${f(a.va)}L) type=${a.adjustment_type} reason=${a.reason}${d}`
    );
    if (a.notes) console.log(`    Notes: ${a.notes}`);
  }

  // ===== 9. Volume reconstruction for all batches =====
  console.log("\n=== 9. VOLUME RECONSTRUCTION ===");
  for (const batch of [...parents, ...children]) {
    const bId = batch.id;
    const initL = parseFloat(batch.init_l) || 0;
    const currL = parseFloat(batch.curr_l) || 0;

    const qi = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_transferred_unit='gal' THEN volume_transferred::numeric*3.78541
        ELSE volume_transferred::numeric END
      ),0) AS t
      FROM batch_transfers WHERE destination_batch_id='${bId}' AND deleted_at IS NULL
    `))
    ).rows as any[];
    const qo = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_transferred_unit='gal' THEN volume_transferred::numeric*3.78541
        ELSE volume_transferred::numeric END
        + CASE WHEN loss_unit='gal' THEN COALESCE(loss::numeric,0)*3.78541
        ELSE COALESCE(loss::numeric,0) END
      ),0) AS t
      FROM batch_transfers WHERE source_batch_id='${bId}' AND deleted_at IS NULL
    `))
    ).rows as any[];
    const qm = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_added_unit='gal' THEN volume_added::numeric*3.78541
        ELSE volume_added::numeric END
      ),0) AS t
      FROM batch_merge_history WHERE target_batch_id='${bId}' AND deleted_at IS NULL
    `))
    ).rows as any[];
    const qb = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(volume_taken_liters::numeric),0) AS t
      FROM bottle_runs WHERE batch_id='${bId}' AND voided_at IS NULL
    `))
    ).rows as any[];
    const qk = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*3.78541
        ELSE volume_taken::numeric END
      ),0) AS t
      FROM keg_fills WHERE batch_id='${bId}' AND voided_at IS NULL AND deleted_at IS NULL
    `))
    ).rows as any[];
    const qr = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(
        CASE WHEN volume_loss_unit='gal' THEN volume_loss::numeric*3.78541
        ELSE volume_loss::numeric END
      ),0) AS t
      FROM batch_racking_operations WHERE batch_id='${bId}' AND deleted_at IS NULL
    `))
    ).rows as any[];
    const qa = (
      await db.execute(sql.raw(`
      SELECT COALESCE(SUM(adjustment_amount::numeric),0) AS t
      FROM batch_volume_adjustments WHERE batch_id='${bId}' AND deleted_at IS NULL
    `))
    ).rows as any[];

    const ti = parseFloat(qi[0].t);
    const to_ = parseFloat(qo[0].t);
    const tm = parseFloat(qm[0].t);
    const tb = parseFloat(qb[0].t);
    const tk = parseFloat(qk[0].t);
    const tr = parseFloat(qr[0].t);
    const ta = parseFloat(qa[0].t);
    const rc = initL + ti + tm - to_ - tb - tk - tr + ta;
    const diff = rc - currL;
    const mark = parentIds.includes(bId) ? "[PARENT]" : "[CHILD]";
    console.log(
      `\n  ${batch.batch_number} / ${batch.custom_name || "(none)"} ${mark} ${batch.deleted_at ? "[DEL]" : ""}`
    );
    console.log(
      `  init=${f(initL)}L +xIn=${f(ti)}L +mrg=${f(tm)}L -xOut=${f(to_)}L -btl=${f(tb)}L -keg=${f(tk)}L -rack=${f(tr)}L +adj=${f(ta)}L`
    );
    console.log(
      `  Reconstructed=${f(rc)}L (${f(rc * G)}gal) vs DB current=${f(currL)}L (${f(currL * G)}gal) diff=${f(diff)}L ${Math.abs(diff) < 0.1 ? "OK" : "*** MISMATCH ***"}`
    );
  }

  // ===== 10. Compositions =====
  console.log("\n=== 10. BATCH COMPOSITIONS ===");
  const comp = (
    await db.execute(sql.raw(`
    SELECT bc.id, b.batch_number, b.custom_name,
      bc.source_type, bfv.name AS variety, bfv.fruit_type,
      CAST(bc.juice_volume AS NUMERIC) AS jv, bc.juice_volume_unit,
      CAST(bc.input_weight_kg AS NUMERIC) AS wt,
      bc.deleted_at::text,
      bc.purchase_item_id, bc.juice_purchase_item_id, bc.vendor_id,
      v.name AS vendor_name
    FROM batch_compositions bc
    JOIN batches b ON bc.batch_id = b.id
    LEFT JOIN base_fruit_varieties bfv ON bc.variety_id = bfv.id
    LEFT JOIN vendors v ON bc.vendor_id = v.id
    WHERE bc.batch_id IN (${ail})
    ORDER BY bc.batch_id
  `))
  ).rows as any[];
  if (!comp.length) console.log("  (none)");
  for (const c of comp) {
    const d = c.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${c.batch_number}/${c.custom_name}: ${c.source_type}: ${c.variety || "?"}(${c.fruit_type || "?"}) vol=${f(c.jv)}${c.juice_volume_unit || "L"} wt=${f(c.wt || 0)}kg vendor=${c.vendor_name || "?"}${d}`
    );
  }

  // ===== 11. Summary =====
  console.log("\n=== SUMMARY ===");
  console.log(`\nParent batch(es): ${parents.length}`);
  for (const p of parents) {
    console.log(`  ${p.batch_number} / ${p.custom_name}: init=${lg(p.init_l)} curr=${lg(p.curr_l)} recon=${p.reconciliation_status} del=${p.deleted_at || "no"}`);
  }
  console.log(`\nChild batches: ${children.length}`);
  for (const c of children) {
    console.log(`  ${c.batch_number} / ${c.custom_name}: init=${lg(c.init_l)} curr=${lg(c.curr_l)} recon=${c.reconciliation_status} del=${c.deleted_at || "no"} rack=${c.is_racking_derivative}`);
  }
  console.log(`\nTransfers from parent: ${xfParentToChild.length}`);
  console.log(`All transfers involving family: ${xfAll.length}`);
  console.log(`Merge history (as target): ${mergesIn.length}`);
  console.log(`Merge history (as source): ${mergesOut.length}`);
  console.log(`Racking operations: ${rack.length}`);
  console.log(`Bottle runs: ${btl.length}`);
  console.log(`Keg fills: ${keg.length}`);
  console.log(`Volume adjustments: ${adj.length}`);

  console.log("\n=== DONE ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
