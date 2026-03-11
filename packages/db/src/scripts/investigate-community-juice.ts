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
  // ===== 1. Find the batch =====
  console.log("=== 1. BATCH DETAILS ===");
  const batchRes = await db.execute(sql.raw(`
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
    WHERE b.batch_number ILIKE '%Community%' AND b.product_type = 'juice'
    ORDER BY b.deleted_at NULLS FIRST, b.start_date
  `));
  const batches = batchRes.rows as any[];

  if (!batches.length) {
    // Try broader search
    console.log("No exact match. Trying broader search...");
    const broad = await db.execute(sql.raw(`
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
      WHERE (b.batch_number ILIKE '%Community%' OR b.custom_name ILIKE '%Community%')
      ORDER BY b.product_type, b.deleted_at NULLS FIRST, b.start_date
    `));
    for (const b of broad.rows as any[]) {
      console.log(`  ${b.batch_number} | ${b.custom_name} | type=${b.product_type} init=${lg(b.init_l)} curr=${lg(b.curr_l)} recon=${b.reconciliation_status} del=${b.deleted_at || "no"}`);
    }
    if (!(broad.rows as any[]).length) {
      console.log("No batches found with 'Community' in name. Exiting.");
      process.exit(0);
    }
    // Use all community batches for investigation
    batches.push(...(broad.rows as any[]).filter((b: any) => b.product_type === "juice"));
    if (!batches.length) {
      console.log("No juice-type community batches. Showing all above. Exiting.");
      process.exit(0);
    }
  }

  for (const b of batches) {
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

  const ids = batches.map((b: any) => b.id);
  const il = ids.map((id: string) => `'${id}'`).join(",");

  // ===== 2. Press run origin =====
  console.log("\n=== 2. PRESS RUN ORIGIN ===");
  for (const b of batches) {
    if (b.origin_press_run_id) {
      const pr = (
        await db.execute(sql.raw(`
        SELECT id, press_run_name, date_completed::text,
          CAST(total_juice_volume AS NUMERIC) AS yield_l, total_juice_volume_unit,
          CAST(total_juice_volume_liters AS NUMERIC) AS yield_liters,
          status, notes, deleted_at::text
        FROM press_runs WHERE id = '${b.origin_press_run_id}'
      `))
      ).rows as any[];
      if (pr.length) {
        const p = pr[0];
        console.log(`  Press Run: ${p.press_run_name} (${p.date_completed})`);
        console.log(`  Yield: ${f(p.yield_l)}${p.total_juice_volume_unit} (=${f(p.yield_liters)}L), Status: ${p.status}`);
        if (p.notes) console.log(`  Notes: ${p.notes}`);
        if (p.deleted_at) console.log(`  DELETED: ${p.deleted_at}`);
      }
    } else {
      console.log(`  Batch ${b.batch_number}: No origin_press_run_id`);
    }
  }

  // Also check batch_merge_history for press run sources
  console.log("\n  Merge history with press run sources:");
  const prMerges = (
    await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bt.batch_number AS target_bn, bt.custom_name AS target_cn,
      bmh.source_press_run_id, pr.press_run_name,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      bmh.merged_at::text, bmh.deleted_at::text, bmh.source_type
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
    WHERE bmh.target_batch_id IN (${il}) AND bmh.source_press_run_id IS NOT NULL
    ORDER BY bmh.merged_at
  `))
  ).rows as any[];
  if (!prMerges.length) console.log("  (none)");
  for (const m of prMerges) {
    const d = m.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${m.merged_at}: ${m.press_run_name} -> ${m.target_bn}: ${f(m.vol)}${m.volume_added_unit} type=${m.source_type}${d}`
    );
  }

  // ===== 3. All batch_merge_history (inflows) =====
  console.log("\n=== 3. MERGE HISTORY (all inflows) ===");
  const merges = (
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
    WHERE bmh.target_batch_id IN (${il})
    ORDER BY bmh.merged_at
  `))
  ).rows as any[];
  if (!merges.length) console.log("  (none)");
  let totalMergeIn = 0;
  for (const m of merges) {
    const d = m.deleted_at ? " [DEL]" : "";
    const src =
      m.source_bn || m.source_cn || m.press_run_name || "juice_purchase:" + m.source_juice_purchase_item_id || "unknown";
    const volL =
      m.volume_added_unit === "gal"
        ? parseFloat(m.vol) * 3.78541
        : parseFloat(m.vol);
    if (!m.deleted_at) totalMergeIn += volL;
    console.log(
      `  ${m.merged_at}: ${src} -> target: ${f(m.vol)}${m.volume_added_unit} (=${f(volL)}L) type=${m.source_type} abv=${f(m.sabv || 0)}%${d}`
    );
    if (m.notes) console.log(`    Notes: ${m.notes}`);
  }
  console.log(`  Total merge inflow (non-deleted, in L): ${f(totalMergeIn)}`);

  // ===== 4. Batch transfers OUT (source = this batch) =====
  console.log("\n=== 4. TRANSFERS OUT (source = this batch) ===");
  const xfOut = (
    await db.execute(sql.raw(`
    SELECT bt.id, bs.batch_number AS src_bn, bs.custom_name AS src_cn,
      bd.batch_number AS dst_bn, bd.custom_name AS dst_cn, bd.product_type AS dst_type,
      bd.id AS dst_id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
      bt.transferred_at::text, bt.deleted_at::text, bt.notes,
      bt.created_at::text
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id = bs.id
    JOIN batches bd ON bt.destination_batch_id = bd.id
    WHERE bt.source_batch_id IN (${il})
    ORDER BY bt.transferred_at
  `))
  ).rows as any[];
  if (!xfOut.length) console.log("  (none)");
  let totalXferOut = 0;
  for (const t of xfOut) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL =
      t.volume_transferred_unit === "gal"
        ? parseFloat(t.vol) * 3.78541
        : parseFloat(t.vol);
    const lossL =
      (t.loss_unit === "gal"
        ? parseFloat(t.loss || 0) * 3.78541
        : parseFloat(t.loss || 0));
    if (!t.deleted_at) totalXferOut += volL + lossL;
    console.log(
      `  ${t.transferred_at}: -> ${t.dst_bn || t.dst_cn}(${t.dst_type}): ${f(t.vol)}${t.volume_transferred_unit} (=${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit || "L"} (=${f(lossL)}L)${d}`
    );
    console.log(`    DstID: ${t.dst_id}, Created: ${t.created_at}`);
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }
  console.log(`  Total transfer outflow (non-deleted, in L): ${f(totalXferOut)}`);

  // ===== 5. Batch transfers IN (destination = this batch) =====
  console.log("\n=== 5. TRANSFERS IN (destination = this batch) ===");
  const xfIn = (
    await db.execute(sql.raw(`
    SELECT bt.id, bs.batch_number AS src_bn, bs.custom_name AS src_cn, bs.product_type AS src_type,
      bd.batch_number AS dst_bn, bd.custom_name AS dst_cn,
      CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
      bt.transferred_at::text, bt.deleted_at::text, bt.notes,
      bt.created_at::text
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id = bs.id
    JOIN batches bd ON bt.destination_batch_id = bd.id
    WHERE bt.destination_batch_id IN (${il})
    ORDER BY bt.transferred_at
  `))
  ).rows as any[];
  if (!xfIn.length) console.log("  (none)");
  let totalXferIn = 0;
  for (const t of xfIn) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL =
      t.volume_transferred_unit === "gal"
        ? parseFloat(t.vol) * 3.78541
        : parseFloat(t.vol);
    if (!t.deleted_at) totalXferIn += volL;
    console.log(
      `  ${t.transferred_at}: ${t.src_bn || t.src_cn}(${t.src_type}) -> this: ${f(t.vol)}${t.volume_transferred_unit} (=${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit || "L"}${d}`
    );
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }
  console.log(`  Total transfer inflow (non-deleted, in L): ${f(totalXferIn)}`);

  // ===== 6. Bottle runs =====
  console.log("\n=== 6. BOTTLE RUNS ===");
  const btl = (
    await db.execute(sql.raw(`
    SELECT br.id, b.custom_name, b.batch_number,
      CAST(br.volume_taken_liters AS NUMERIC) AS vol,
      CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
      br.units_produced, br.package_type, br.packaged_at::text,
      br.voided_at::text, br.status, br.distributed_at::text
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.batch_id IN (${il})
    ORDER BY br.packaged_at
  `))
  ).rows as any[];
  if (!btl.length) console.log("  (none)");
  for (const b of btl) {
    const v = b.voided_at ? " [VOID]" : "";
    console.log(
      `  ${b.packaged_at}: ${lg(b.vol)} loss=${f(b.loss || 0)}${b.loss_unit || "L"} (${b.units_produced} ${b.package_type}) status=${b.status} dist=${b.distributed_at || "no"}${v}`
    );
  }

  // ===== 7. Keg fills =====
  console.log("\n=== 7. KEG FILLS ===");
  const keg = (
    await db.execute(sql.raw(`
    SELECT kf.id, b.custom_name, b.batch_number,
      CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
      kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text,
      kf.status, kf.distributed_at::text, kf.production_notes
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.batch_id IN (${il})
    ORDER BY kf.filled_at
  `))
  ).rows as any[];
  if (!keg.length) console.log("  (none)");
  for (const k of keg) {
    const fl: string[] = [];
    if (k.deleted_at) fl.push("DEL");
    if (k.voided_at) fl.push("VOID");
    const fs = fl.length ? ` [${fl.join(",")}]` : "";
    console.log(
      `  ${k.filled_at}: ${f(k.vol)}${k.volume_taken_unit} loss=${f(k.loss || 0)}${k.loss_unit || "L"} status=${k.status} dist=${k.distributed_at || "no"}${fs}`
    );
    if (k.production_notes) console.log(`    Notes: ${k.production_notes}`);
  }

  // ===== 8. Volume adjustments =====
  console.log("\n=== 8. VOLUME ADJUSTMENTS ===");
  const adj = (
    await db.execute(sql.raw(`
    SELECT bva.id, b.custom_name, b.batch_number,
      CAST(bva.adjustment_amount AS NUMERIC) AS amt,
      CAST(bva.volume_before AS NUMERIC) AS vb,
      CAST(bva.volume_after AS NUMERIC) AS va,
      bva.reason, bva.adjustment_type,
      bva.created_at::text, bva.deleted_at::text, bva.notes
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.batch_id IN (${il})
    ORDER BY bva.created_at
  `))
  ).rows as any[];
  if (!adj.length) console.log("  (none)");
  for (const a of adj) {
    const d = a.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${a.created_at}: ${f(a.amt)}L (${f(a.vb)}L -> ${f(a.va)}L) type=${a.adjustment_type} reason=${a.reason}${d}`
    );
    if (a.notes) console.log(`    Notes: ${a.notes}`);
  }

  // ===== 9. Racking operations =====
  console.log("\n=== 9. RACKING OPERATIONS ===");
  const rack = (
    await db.execute(sql.raw(`
    SELECT bro.id, b.custom_name, b.batch_number,
      sv.name AS sv, dv.name AS dv,
      CAST(bro.volume_before AS NUMERIC) AS vb, bro.volume_before_unit,
      CAST(bro.volume_after AS NUMERIC) AS va, bro.volume_after_unit,
      CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
      bro.racked_at::text, bro.deleted_at::text, bro.notes
    FROM batch_racking_operations bro
    JOIN batches b ON bro.batch_id = b.id
    LEFT JOIN vessels sv ON bro.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bro.destination_vessel_id = dv.id
    WHERE bro.batch_id IN (${il})
    ORDER BY bro.racked_at
  `))
  ).rows as any[];
  if (!rack.length) console.log("  (none)");
  for (const r of rack) {
    const d = r.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${r.racked_at}: ${r.sv || "?"}->${r.dv || "?"} before=${f(r.vb)}${r.volume_before_unit} after=${f(r.va)}${r.volume_after_unit} loss=${f(r.vl)}${r.volume_loss_unit}${d}`
    );
    if (r.notes) console.log(`    Notes: ${r.notes}`);
  }

  // ===== 10. Children batches =====
  console.log("\n=== 10. CHILDREN BATCHES (parent_batch_id = this) ===");
  const children = (
    await db.execute(sql.raw(`
    SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      b.start_date::text, b.parent_batch_id,
      b.is_racking_derivative, b.deleted_at::text, b.reconciliation_status,
      v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.parent_batch_id IN (${il})
    ORDER BY b.start_date
  `))
  ).rows as any[];
  if (!children.length) console.log("  (none)");
  for (const c of children) {
    const fl: string[] = [];
    if (c.deleted_at) fl.push("DEL");
    if (c.is_racking_derivative) fl.push("RACK");
    if (c.reconciliation_status && c.reconciliation_status !== "pending")
      fl.push("recon=" + c.reconciliation_status);
    console.log(
      `  ${c.batch_number} / ${c.custom_name || "(none)"} [${fl.join(",")}] type=${c.product_type} init=${lg(c.init_l)} curr=${lg(c.curr_l)} vessel=${c.vessel_name || "NONE"}`
    );
  }

  // ===== 11. Compositions =====
  console.log("\n=== 11. BATCH COMPOSITIONS ===");
  const comp = (
    await db.execute(sql.raw(`
    SELECT bc.id, b.custom_name, b.batch_number,
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
    WHERE bc.batch_id IN (${il})
    ORDER BY bc.batch_id
  `))
  ).rows as any[];
  if (!comp.length) console.log("  (none)");
  for (const c of comp) {
    const d = c.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${c.source_type}: ${c.variety || "?"}(${c.fruit_type || "?"}) vol=${f(c.jv)}${c.juice_volume_unit || "L"} wt=${f(c.wt || 0)}kg vendor=${c.vendor_name || "?"}${d}`
    );
  }

  // ===== 12. Volume reconstruction =====
  console.log("\n=== 12. VOLUME RECONSTRUCTION ===");
  for (const batch of batches) {
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
    const to = parseFloat(qo[0].t);
    const tm = parseFloat(qm[0].t);
    const tb = parseFloat(qb[0].t);
    const tk = parseFloat(qk[0].t);
    const tr = parseFloat(qr[0].t);
    const ta = parseFloat(qa[0].t);
    const rc = initL + ti + tm - to - tb - tk - tr + ta;
    const diff = rc - currL;
    console.log(
      `\n  ${batch.batch_number} / ${batch.custom_name || "(none)"} ${batch.deleted_at ? "[DEL]" : ""}`
    );
    console.log(
      `  init=${f(initL)}L +xIn=${f(ti)}L +mrg=${f(tm)}L -xOut=${f(to)}L -btl=${f(tb)}L -keg=${f(tk)}L -rack=${f(tr)}L +adj=${f(ta)}L`
    );
    console.log(
      `  Reconstructed=${f(rc)}L (${f(rc * G)}gal) vs DB current=${f(currL)}L diff=${f(diff)}L ${Math.abs(diff) < 0.1 ? "OK" : "*** MISMATCH ***"}`
    );
  }

  // ===== 13. Check for outbound merge history (this batch as source) =====
  console.log("\n=== 13. MERGE HISTORY (this batch as SOURCE) ===");
  const mergeOut = (
    await db.execute(sql.raw(`
    SELECT bmh.id, bt.batch_number AS target_bn, bt.custom_name AS target_cn, bt.product_type AS target_type,
      bmh.source_type,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      bmh.merged_at::text, bmh.deleted_at::text, bmh.notes
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    WHERE bmh.source_batch_id IN (${il})
    ORDER BY bmh.merged_at
  `))
  ).rows as any[];
  if (!mergeOut.length) console.log("  (none)");
  for (const m of mergeOut) {
    const d = m.deleted_at ? " [DEL]" : "";
    console.log(
      `  ${m.merged_at}: this -> ${m.target_bn || m.target_cn}(${m.target_type}): ${f(m.vol)}${m.volume_added_unit} type=${m.source_type}${d}`
    );
    if (m.notes) console.log(`    Notes: ${m.notes}`);
  }

  // ===== 14. Check related press run batches =====
  console.log("\n=== 14. OTHER BATCHES FROM SAME PRESS RUN ===");
  const pressRunIds = batches
    .filter((b: any) => b.origin_press_run_id)
    .map((b: any) => `'${b.origin_press_run_id}'`)
    .join(",");
  if (pressRunIds) {
    const siblings = (
      await db.execute(sql.raw(`
      SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
        CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
        CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
        b.start_date::text, b.deleted_at::text, b.reconciliation_status,
        pr.press_run_name
      FROM batches b
      JOIN press_runs pr ON b.origin_press_run_id = pr.id
      WHERE b.origin_press_run_id IN (${pressRunIds})
      ORDER BY b.start_date
    `))
    ).rows as any[];
    for (const s of siblings) {
      const isSelf = ids.includes(s.id) ? " <-- THIS BATCH" : "";
      const d = s.deleted_at ? " [DEL]" : "";
      console.log(
        `  ${s.batch_number} / ${s.custom_name || "(none)"} type=${s.product_type} init=${lg(s.init_l)} curr=${lg(s.curr_l)} recon=${s.reconciliation_status}${d}${isSelf}`
      );
    }
  } else {
    console.log("  (no origin press run)");
  }

  // ===== 15. Check audit log for volume changes =====
  console.log("\n=== 15. AUDIT LOG (batch volume changes) ===");
  const audit = (
    await db.execute(sql.raw(`
    SELECT al.operation, al.table_name, al.record_id,
      al.diff_data::text, al.changed_at::text, al.reason
    FROM audit_logs al
    WHERE al.record_id IN (${il})
      AND al.table_name = 'batches'
    ORDER BY al.changed_at
    LIMIT 50
  `))
  ).rows as any[];
  if (!audit.length) console.log("  (none found)");
  for (const a of audit) {
    const diff = a.diff_data ? String(a.diff_data).substring(0, 300) : "no diff";
    console.log(`  ${a.changed_at}: ${a.operation} - ${diff}`);
    if (a.reason) console.log(`    Reason: ${a.reason}`);
  }

  // ===== 16. Full audit log (all operations, not just batches table) =====
  console.log("\n=== 16. FULL AUDIT LOG (all related changes) ===");
  const auditFull = (
    await db.execute(sql.raw(`
    SELECT al.operation, al.table_name, al.record_id,
      al.diff_data::text, al.changed_at::text, al.reason,
      al.old_data::text, al.new_data::text
    FROM audit_logs al
    WHERE al.record_id IN (${il})
    ORDER BY al.changed_at
    LIMIT 100
  `))
  ).rows as any[];
  if (!auditFull.length) console.log("  (none found)");
  for (const a of auditFull) {
    console.log(`  ${a.changed_at}: [${a.table_name}] ${a.operation}`);
    if (a.diff_data) {
      const diff = String(a.diff_data).substring(0, 500);
      console.log(`    Diff: ${diff}`);
    }
    if (a.reason) console.log(`    Reason: ${a.reason}`);
    // Check new_data for current_volume_liters
    if (a.new_data && String(a.new_data).includes("current_volume")) {
      const nd = String(a.new_data);
      const cvMatch = nd.match(/current_volume_liters['":\s]+([0-9.]+)/);
      if (cvMatch) console.log(`    >>> current_volume_liters set to: ${cvMatch[1]}`);
    }
  }

  // ===== 17. Check if volume was zeroed directly in DB =====
  console.log("\n=== 17. CHECK FOR DIRECT DB UPDATES (batch updated_at vs last audit) ===");
  for (const batch of batches) {
    console.log(`  Batch updated_at: ${batch.updated_at}`);
    const lastAudit = auditFull.length ? auditFull[auditFull.length - 1] : null;
    console.log(`  Last audit entry: ${lastAudit ? lastAudit.changed_at : "NONE"}`);
    if (lastAudit && new Date(batch.updated_at) > new Date(lastAudit.changed_at)) {
      console.log(`  *** Batch was updated AFTER last audit log entry -- possible direct DB update or unaudited mutation`);
    }
  }

  // ===== 18. Check for references in other batch compositions (used as component elsewhere) =====
  console.log("\n=== 18. BATCH COMPOSITIONS REFERENCING THIS BATCH (source_batch_id) ===");
  // batch_compositions doesn't have source_batch_id, but batch_merge_history does
  // Already checked in section 13. Let's also check if compositions on OTHER batches reference this press run
  const compOther = (
    await db.execute(sql.raw(`
    SELECT bc.id, b.batch_number, b.custom_name, b.product_type,
      bc.source_type,
      CAST(bc.juice_volume AS NUMERIC) AS jv, bc.juice_volume_unit,
      bc.deleted_at::text
    FROM batch_compositions bc
    JOIN batches b ON bc.batch_id = b.id
    WHERE bc.source_type = 'press_run_juice'
      AND b.id NOT IN (${il})
      AND EXISTS (
        SELECT 1 FROM batches b2
        WHERE b2.id IN (${il})
        AND b2.origin_press_run_id IS NOT NULL
      )
    ORDER BY b.start_date
    LIMIT 20
  `))
  ).rows as any[];
  if (!compOther.length) console.log("  (none found)");
  for (const c of compOther) {
    console.log(`  ${c.batch_number} / ${c.custom_name}: source_type=${c.source_type} vol=${f(c.jv)}${c.juice_volume_unit}${c.deleted_at ? " [DEL]" : ""}`);
  }

  // ===== 19. Check all audit logs for this batch ID across ALL tables =====
  console.log("\n=== 19. ALL AUDIT LOG ENTRIES MENTIONING BATCH ID ===");
  const batchId = batches[0]?.id;
  if (batchId) {
    const auditAll = (
      await db.execute(sql.raw(`
      SELECT al.operation, al.table_name, al.record_id,
        al.changed_at::text, al.reason,
        LEFT(al.new_data::text, 200) AS new_data_preview,
        LEFT(al.diff_data::text, 200) AS diff_preview
      FROM audit_logs al
      WHERE al.new_data::text LIKE '%${batchId}%'
        OR al.old_data::text LIKE '%${batchId}%'
        OR al.record_id = '${batchId}'
      ORDER BY al.changed_at
      LIMIT 50
    `))
    ).rows as any[];
    if (!auditAll.length) console.log("  (none found)");
    for (const a of auditAll) {
      console.log(`  ${a.changed_at}: [${a.table_name}] ${a.operation} record=${String(a.record_id).substring(0, 8)}...`);
      if (a.diff_preview) console.log(`    Diff: ${a.diff_preview}`);
      if (a.reason) console.log(`    Reason: ${a.reason}`);
    }
  }

  // ===== 20. Summary =====
  console.log("\n=== SUMMARY ===");
  for (const batch of batches) {
    const initL = parseFloat(batch.init_l) || 0;
    const currL = parseFloat(batch.curr_l) || 0;
    console.log(`\nBatch: ${batch.batch_number} / ${batch.custom_name || "(none)"}`);
    console.log(`  product_type=${batch.product_type}, recon=${batch.reconciliation_status}`);
    console.log(`  initial=${lg(initL)}, current=${lg(currL)}`);
    console.log(`  Question: Why does reconstruction show ~686.5L but current is 0?`);
    console.log(`  Check: Were there outbound transfers? volume adjustments? Was it zeroed manually?`);
  }

  console.log("\n=== DONE ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
