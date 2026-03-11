import { db } from "..";
import { sql } from "drizzle-orm";

const G = 0.264172; // liters to gallons
function f(v: any, d = 1) { return v == null ? "null" : parseFloat(String(v)).toFixed(d); }
function lg(l: any) { if (l == null) return "null"; const v = parseFloat(String(l)); return `${v.toFixed(1)}L (${(v * G).toFixed(1)}gal)`; }
function toL(val: any, unit: string) {
  const v = parseFloat(String(val)) || 0;
  return unit === "gal" ? v * 3.78541 : v;
}

async function investigateBatch(batchSearch: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`INVESTIGATING: ${batchSearch}`);
  console.log(`${"=".repeat(80)}`);

  // Find the batch
  const bResult = await db.execute(sql.raw(`
    SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      CAST(b.initial_volume AS NUMERIC) AS init_raw,
      b.initial_volume_unit,
      CAST(b.current_volume AS NUMERIC) AS curr_raw,
      b.current_volume_unit,
      b.start_date::text, b.parent_batch_id, b.reconciliation_status,
      b.deleted_at::text, b.fermentation_stage,
      b.is_racking_derivative, b.origin_press_run_id,
      b.ttb_origin_year, b.is_archived,
      v.name AS vessel_name, v.id AS vessel_id,
      pb.custom_name AS parent_name, pb.batch_number AS parent_batch_number
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    LEFT JOIN batches pb ON b.parent_batch_id = pb.id
    WHERE b.batch_number ILIKE '%${batchSearch}%'
       OR b.custom_name ILIKE '%${batchSearch}%'
       OR b.name ILIKE '%${batchSearch}%'
    ORDER BY b.deleted_at NULLS FIRST
    LIMIT 5
  `));
  const batches = bResult.rows as any[];
  if (!batches.length) {
    console.log("  NO BATCH FOUND!");
    return;
  }

  for (const batch of batches) {
    const bId = batch.id;
    const initL = parseFloat(batch.init_l) || 0;
    const currL = parseFloat(batch.curr_l) || 0;
    const flags: string[] = [];
    if (batch.deleted_at) flags.push("DELETED");
    if (batch.is_racking_derivative) flags.push("RACK_DERIV");
    if (batch.is_archived) flags.push("ARCHIVED");
    if (batch.reconciliation_status && batch.reconciliation_status !== "pending") flags.push("recon=" + batch.reconciliation_status);

    console.log(`\n--- BATCH: ${batch.custom_name || batch.batch_number} [${flags.join(",")}] ---`);
    console.log(`  ID: ${bId}`);
    console.log(`  Type: ${batch.product_type}, Status: ${batch.status}`);
    console.log(`  Init: ${lg(initL)} (raw: ${f(batch.init_raw)}${batch.initial_volume_unit})`);
    console.log(`  Current: ${lg(currL)} (raw: ${f(batch.curr_raw)}${batch.current_volume_unit})`);
    console.log(`  Start: ${batch.start_date}, TTB Origin Year: ${batch.ttb_origin_year || "null"}`);
    console.log(`  Vessel: ${batch.vessel_name || "NONE"} (${batch.vessel_id || "null"})`);
    console.log(`  Parent: ${batch.parent_name || batch.parent_batch_number || "NONE"} (${batch.parent_batch_id || "null"})`);
    console.log(`  Press Run: ${batch.origin_press_run_id || "NONE"}`);

    // === MERGES IN (all 3 source types) ===
    console.log(`\n  == MERGES IN ==`);
    const mergesIn = (await db.execute(sql.raw(`
      SELECT bmh.id, bmh.source_type,
        CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
        CAST(bmh.target_volume_before AS NUMERIC) AS vbefore, bmh.target_volume_before_unit,
        CAST(bmh.target_volume_after AS NUMERIC) AS vafter, bmh.target_volume_after_unit,
        CAST(bmh.source_abv AS NUMERIC) AS sabv,
        bmh.merged_at::text, bmh.deleted_at::text, bmh.notes,
        bs.custom_name AS src_batch_name, bs.batch_number AS src_batch_num,
        pr.press_run_name AS src_press_name,
        jpi.id AS src_juice_id
      FROM batch_merge_history bmh
      LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
      LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
      LEFT JOIN juice_purchase_items jpi ON bmh.source_juice_purchase_item_id = jpi.id
      WHERE bmh.target_batch_id = '${bId}'
      ORDER BY bmh.merged_at
    `))).rows as any[];

    let totalMergesInL = 0;
    if (!mergesIn.length) console.log("    (none)");
    for (const m of mergesIn) {
      const del = m.deleted_at ? " [DELETED]" : "";
      const volL = toL(m.vol, m.volume_added_unit);
      const srcName = m.src_batch_name || m.src_press_name || (m.src_juice_id ? "juice_purchase" : "unknown");
      console.log(`    ${m.merged_at}: ${srcName} -> this batch: ${f(m.vol)}${m.volume_added_unit} (${f(volL)}L) type=${m.source_type} abv=${f(m.sabv || 0)}%${del}`);
      if (m.notes) console.log(`      Notes: ${m.notes}`);
      if (!m.deleted_at) totalMergesInL += volL;
    }
    console.log(`    TOTAL merges in (active): ${f(totalMergesInL)}L (${f(totalMergesInL * G)}gal)`);

    // === MERGES OUT (this batch as source) ===
    console.log(`\n  == MERGES OUT (this batch as source) ==`);
    const mergesOut = (await db.execute(sql.raw(`
      SELECT bmh.id, bmh.source_type,
        CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
        bmh.merged_at::text, bmh.deleted_at::text, bmh.notes,
        bt.custom_name AS target_name, bt.batch_number AS target_batch_num
      FROM batch_merge_history bmh
      LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
      WHERE bmh.source_batch_id = '${bId}'
      ORDER BY bmh.merged_at
    `))).rows as any[];

    let totalMergesOutL = 0;
    if (!mergesOut.length) console.log("    (none)");
    for (const m of mergesOut) {
      const del = m.deleted_at ? " [DELETED]" : "";
      const volL = toL(m.vol, m.volume_added_unit);
      console.log(`    ${m.merged_at}: this batch -> ${m.target_name || m.target_batch_num}: ${f(m.vol)}${m.volume_added_unit} (${f(volL)}L) type=${m.source_type}${del}`);
      if (m.notes) console.log(`      Notes: ${m.notes}`);
      if (!m.deleted_at) totalMergesOutL += volL;
    }
    console.log(`    TOTAL merges out (active): ${f(totalMergesOutL)}L (${f(totalMergesOutL * G)}gal)`);

    // === TRANSFERS IN ===
    console.log(`\n  == TRANSFERS IN ==`);
    const xfIn = (await db.execute(sql.raw(`
      SELECT bt.id,
        CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
        CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
        bt.transferred_at::text, bt.deleted_at::text, bt.notes,
        bs.custom_name AS src_name, bs.batch_number AS src_batch_num,
        bs.product_type AS src_type
      FROM batch_transfers bt
      JOIN batches bs ON bt.source_batch_id = bs.id
      WHERE bt.destination_batch_id = '${bId}'
      ORDER BY bt.transferred_at
    `))).rows as any[];

    let totalXfInL = 0;
    if (!xfIn.length) console.log("    (none)");
    for (const t of xfIn) {
      const del = t.deleted_at ? " [DELETED]" : "";
      const volL = toL(t.vol, t.volume_transferred_unit);
      console.log(`    ${t.transferred_at}: ${t.src_name || t.src_batch_num}(${t.src_type}) -> this: ${f(t.vol)}${t.volume_transferred_unit} (${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit}${del}`);
      if (t.notes) console.log(`      Notes: ${t.notes}`);
      if (!t.deleted_at) totalXfInL += volL;
    }
    console.log(`    TOTAL transfers in (active): ${f(totalXfInL)}L (${f(totalXfInL * G)}gal)`);

    // === TRANSFERS OUT ===
    console.log(`\n  == TRANSFERS OUT ==`);
    const xfOut = (await db.execute(sql.raw(`
      SELECT bt.id,
        CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
        CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
        bt.transferred_at::text, bt.deleted_at::text, bt.notes,
        bd.custom_name AS dst_name, bd.batch_number AS dst_batch_num,
        bd.product_type AS dst_type
      FROM batch_transfers bt
      JOIN batches bd ON bt.destination_batch_id = bd.id
      WHERE bt.source_batch_id = '${bId}'
      ORDER BY bt.transferred_at
    `))).rows as any[];

    let totalXfOutVolL = 0;
    let totalXfOutLossL = 0;
    if (!xfOut.length) console.log("    (none)");
    for (const t of xfOut) {
      const del = t.deleted_at ? " [DELETED]" : "";
      const volL = toL(t.vol, t.volume_transferred_unit);
      const lossL = toL(t.loss || 0, t.loss_unit);
      console.log(`    ${t.transferred_at}: this -> ${t.dst_name || t.dst_batch_num}(${t.dst_type}): ${f(t.vol)}${t.volume_transferred_unit} (${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit} (${f(lossL)}L)${del}`);
      if (t.notes) console.log(`      Notes: ${t.notes}`);
      if (!t.deleted_at) {
        totalXfOutVolL += volL;
        totalXfOutLossL += lossL;
      }
    }
    console.log(`    TOTAL transfers out (active): vol=${f(totalXfOutVolL)}L loss=${f(totalXfOutLossL)}L combined=${f(totalXfOutVolL + totalXfOutLossL)}L`);

    // === BOTTLE RUNS ===
    console.log(`\n  == BOTTLE RUNS ==`);
    const btlRuns = (await db.execute(sql.raw(`
      SELECT br.id, CAST(br.volume_taken_liters AS NUMERIC) AS vol,
        CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
        br.units_produced, br.package_type, br.packaged_at::text, br.voided_at::text,
        br.status, br.distributed_at::text
      FROM bottle_runs br
      WHERE br.batch_id = '${bId}'
      ORDER BY br.packaged_at
    `))).rows as any[];

    let totalBtlL = 0;
    if (!btlRuns.length) console.log("    (none)");
    for (const b of btlRuns) {
      const voided = b.voided_at ? " [VOIDED]" : "";
      const volL = parseFloat(b.vol) || 0;
      console.log(`    ${b.packaged_at}: ${f(volL)}L (${b.units_produced} ${b.package_type}) loss=${f(b.loss || 0)}${b.loss_unit || "L"} status=${b.status} dist=${b.distributed_at || "no"}${voided}`);
      if (!b.voided_at) totalBtlL += volL;
    }
    console.log(`    TOTAL bottle runs (active): ${f(totalBtlL)}L (${f(totalBtlL * G)}gal)`);

    // === KEG FILLS ===
    console.log(`\n  == KEG FILLS ==`);
    const kegFills = (await db.execute(sql.raw(`
      SELECT kf.id, CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
        CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
        kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text,
        kf.status, kf.distributed_at::text
      FROM keg_fills kf
      WHERE kf.batch_id = '${bId}'
      ORDER BY kf.filled_at
    `))).rows as any[];

    let totalKegL = 0;
    if (!kegFills.length) console.log("    (none)");
    for (const k of kegFills) {
      const flags2: string[] = [];
      if (k.deleted_at) flags2.push("DEL");
      if (k.voided_at) flags2.push("VOID");
      const fs = flags2.length ? ` [${flags2.join(",")}]` : "";
      const volL = toL(k.vol, k.volume_taken_unit);
      const lossL = toL(k.loss || 0, k.loss_unit || "L");
      console.log(`    ${k.filled_at}: ${f(k.vol)}${k.volume_taken_unit} (${f(volL)}L) loss=${f(k.loss || 0)}${k.loss_unit || "L"} (${f(lossL)}L) status=${k.status} dist=${k.distributed_at || "no"}${fs}`);
      if (!k.voided_at && !k.deleted_at) totalKegL += volL;
    }
    console.log(`    TOTAL keg fills (active): ${f(totalKegL)}L (${f(totalKegL * G)}gal)`);

    // === ADJUSTMENTS ===
    console.log(`\n  == ADJUSTMENTS ==`);
    const adjs = (await db.execute(sql.raw(`
      SELECT bva.id, bva.adjustment_type,
        CAST(bva.volume_before AS NUMERIC) AS vb,
        CAST(bva.volume_after AS NUMERIC) AS va,
        CAST(bva.adjustment_amount AS NUMERIC) AS amt,
        bva.reason, bva.notes,
        bva.adjustment_date::text, bva.deleted_at::text
      FROM batch_volume_adjustments bva
      WHERE bva.batch_id = '${bId}'
      ORDER BY bva.adjustment_date
    `))).rows as any[];

    let totalAdjL = 0;
    if (!adjs.length) console.log("    (none)");
    for (const a of adjs) {
      const del = a.deleted_at ? " [DELETED]" : "";
      const amt = parseFloat(a.amt) || 0;
      console.log(`    ${a.adjustment_date}: ${a.adjustment_type} ${f(a.vb)}L -> ${f(a.va)}L (${amt >= 0 ? "+" : ""}${f(amt)}L) reason=${a.reason}${del}`);
      if (a.notes) console.log(`      Notes: ${a.notes}`);
      if (!a.deleted_at) totalAdjL += amt;
    }
    console.log(`    TOTAL adjustments (active): ${totalAdjL >= 0 ? "+" : ""}${f(totalAdjL)}L`);

    // === RACKING OPERATIONS ===
    console.log(`\n  == RACKING OPERATIONS ==`);
    const rackOps = (await db.execute(sql.raw(`
      SELECT bro.id,
        CAST(bro.volume_before AS NUMERIC) AS vb, bro.volume_before_unit,
        CAST(bro.volume_after AS NUMERIC) AS va, bro.volume_after_unit,
        CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
        sv.name AS src_vessel, dv.name AS dst_vessel,
        bro.racked_at::text, bro.deleted_at::text, bro.notes
      FROM batch_racking_operations bro
      LEFT JOIN vessels sv ON bro.source_vessel_id = sv.id
      LEFT JOIN vessels dv ON bro.destination_vessel_id = dv.id
      WHERE bro.batch_id = '${bId}'
      ORDER BY bro.racked_at
    `))).rows as any[];

    let totalRackLossL = 0;
    if (!rackOps.length) console.log("    (none)");
    for (const r of rackOps) {
      const del = r.deleted_at ? " [DELETED]" : "";
      const lossL = toL(r.vl, r.volume_loss_unit);
      console.log(`    ${r.racked_at}: ${r.src_vessel} -> ${r.dst_vessel}: before=${f(r.vb)}${r.volume_before_unit} after=${f(r.va)}${r.volume_after_unit} loss=${f(r.vl)}${r.volume_loss_unit} (${f(lossL)}L)${del}`);
      if (r.notes) console.log(`      Notes: ${r.notes}`);
      if (!r.deleted_at) totalRackLossL += lossL;
    }
    console.log(`    TOTAL racking loss (active): ${f(totalRackLossL)}L`);

    // === FILTER OPERATIONS ===
    console.log(`\n  == FILTER OPERATIONS ==`);
    const filterOps = (await db.execute(sql.raw(`
      SELECT bfo.id,
        CAST(bfo.volume_before AS NUMERIC) AS vb, bfo.volume_before_unit,
        CAST(bfo.volume_after AS NUMERIC) AS va, bfo.volume_after_unit,
        CAST(bfo.volume_loss AS NUMERIC) AS vl,
        bfo.filter_type, bfo.filtered_at::text, bfo.deleted_at::text, bfo.notes
      FROM batch_filter_operations bfo
      WHERE bfo.batch_id = '${bId}'
      ORDER BY bfo.filtered_at
    `))).rows as any[];

    let totalFilterLossL = 0;
    if (!filterOps.length) console.log("    (none)");
    for (const fo of filterOps) {
      const del = fo.deleted_at ? " [DELETED]" : "";
      const lossL = parseFloat(fo.vl) || 0; // filter ops volume_loss has no unit column, assumed L
      console.log(`    ${fo.filtered_at}: ${fo.filter_type} before=${f(fo.vb)}${fo.volume_before_unit} after=${f(fo.va)}${fo.volume_after_unit} loss=${f(fo.vl)}L${del}`);
      if (!fo.deleted_at) totalFilterLossL += lossL;
    }
    console.log(`    TOTAL filter loss (active): ${f(totalFilterLossL)}L`);

    // === DISTILLATION RECORDS ===
    console.log(`\n  == DISTILLATION RECORDS ==`);
    const distRecs = (await db.execute(sql.raw(`
      SELECT dr.id, dr.status,
        CAST(dr.source_volume_liters AS NUMERIC) AS src_vol_l,
        CAST(dr.received_volume_liters AS NUMERIC) AS rcv_vol_l,
        dr.distillery_name, dr.sent_at::text, dr.received_at::text, dr.deleted_at::text,
        rb.custom_name AS result_batch_name
      FROM distillation_records dr
      LEFT JOIN batches rb ON dr.result_batch_id = rb.id
      WHERE dr.source_batch_id = '${bId}'
      ORDER BY dr.sent_at
    `))).rows as any[];

    let totalDistL = 0;
    if (!distRecs.length) console.log("    (none)");
    for (const d of distRecs) {
      const del = d.deleted_at ? " [DELETED]" : "";
      const srcL = parseFloat(d.src_vol_l) || 0;
      console.log(`    ${d.sent_at}: sent ${f(srcL)}L to ${d.distillery_name} (status=${d.status}) result=${d.result_batch_name || "none"} received=${d.rcv_vol_l ? f(d.rcv_vol_l) + "L" : "pending"}${del}`);
      if (!d.deleted_at && d.status !== "cancelled") totalDistL += srcL;
    }
    console.log(`    TOTAL distillation out (active): ${f(totalDistL)}L`);

    // === CHILDREN (batches with parent_batch_id = this) ===
    console.log(`\n  == CHILD BATCHES ==`);
    const children = (await db.execute(sql.raw(`
      SELECT b.id, b.custom_name, b.batch_number, b.product_type, b.status,
        CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
        CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
        b.is_racking_derivative, b.deleted_at::text, b.reconciliation_status
      FROM batches b
      WHERE b.parent_batch_id = '${bId}'
      ORDER BY b.start_date
    `))).rows as any[];

    if (!children.length) console.log("    (none)");
    for (const c of children) {
      const cFlags: string[] = [];
      if (c.deleted_at) cFlags.push("DEL");
      if (c.is_racking_derivative) cFlags.push("RACK");
      if (c.reconciliation_status && c.reconciliation_status !== "pending") cFlags.push("recon=" + c.reconciliation_status);
      console.log(`    ${c.custom_name || c.batch_number} [${cFlags.join(",")}] type=${c.product_type} init=${lg(c.init_l)} curr=${lg(c.curr_l)}`);
    }

    // === DELETED TRANSFERS (involving this batch) ===
    console.log(`\n  == DELETED TRANSFERS (involving this batch) ==`);
    const delXf = (await db.execute(sql.raw(`
      SELECT bt.id, bt.transferred_at::text, bt.deleted_at::text,
        CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
        CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
        bt.notes,
        bs.custom_name AS src_name, bs.batch_number AS src_num,
        bd.custom_name AS dst_name, bd.batch_number AS dst_num,
        CASE WHEN bt.source_batch_id = '${bId}' THEN 'OUT' ELSE 'IN' END AS direction
      FROM batch_transfers bt
      JOIN batches bs ON bt.source_batch_id = bs.id
      JOIN batches bd ON bt.destination_batch_id = bd.id
      WHERE (bt.source_batch_id = '${bId}' OR bt.destination_batch_id = '${bId}')
        AND bt.deleted_at IS NOT NULL
      ORDER BY bt.transferred_at
    `))).rows as any[];

    if (!delXf.length) console.log("    (none)");
    for (const t of delXf) {
      const volL = toL(t.vol, t.volume_transferred_unit);
      console.log(`    ${t.transferred_at} [DEL ${t.deleted_at}]: ${t.direction} ${t.src_name || t.src_num} -> ${t.dst_name || t.dst_num}: ${f(t.vol)}${t.volume_transferred_unit} (${f(volL)}L) loss=${f(t.loss || 0)}${t.loss_unit}`);
      if (t.notes) console.log(`      Notes: ${t.notes}`);
    }

    // === DELETED MERGES (involving this batch) ===
    console.log(`\n  == DELETED MERGES (involving this batch) ==`);
    const delMrg = (await db.execute(sql.raw(`
      SELECT bmh.id, bmh.merged_at::text, bmh.deleted_at::text,
        CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
        bmh.source_type, bmh.notes,
        bt2.custom_name AS target_name, bt2.batch_number AS target_num,
        bs.custom_name AS src_name, bs.batch_number AS src_num,
        pr.press_run_name AS pr_name,
        CASE WHEN bmh.target_batch_id = '${bId}' THEN 'IN' ELSE 'OUT' END AS direction
      FROM batch_merge_history bmh
      LEFT JOIN batches bt2 ON bmh.target_batch_id = bt2.id
      LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
      LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
      WHERE (bmh.target_batch_id = '${bId}' OR bmh.source_batch_id = '${bId}')
        AND bmh.deleted_at IS NOT NULL
      ORDER BY bmh.merged_at
    `))).rows as any[];

    if (!delMrg.length) console.log("    (none)");
    for (const m of delMrg) {
      const volL = toL(m.vol, m.volume_added_unit);
      const srcName = m.src_name || m.pr_name || "juice";
      console.log(`    ${m.merged_at} [DEL ${m.deleted_at}]: ${m.direction} ${srcName} -> ${m.target_name || m.target_num}: ${f(m.vol)}${m.volume_added_unit} (${f(volL)}L) type=${m.source_type}`);
      if (m.notes) console.log(`      Notes: ${m.notes}`);
    }

    // === COMPOSITIONS ===
    console.log(`\n  == COMPOSITIONS ==`);
    const comps = (await db.execute(sql.raw(`
      SELECT bc.source_type, bfv.name AS variety, bfv.fruit_type,
        CAST(bc.juice_volume AS NUMERIC) AS jv, bc.juice_volume_unit,
        CAST(bc.input_weight_kg AS NUMERIC) AS wt, bc.deleted_at::text
      FROM batch_compositions bc
      LEFT JOIN base_fruit_varieties bfv ON bc.variety_id = bfv.id
      WHERE bc.batch_id = '${bId}'
      ORDER BY bc.created_at
    `))).rows as any[];

    if (!comps.length) console.log("    (none)");
    for (const c of comps) {
      const del = c.deleted_at ? " [DELETED]" : "";
      console.log(`    ${c.source_type} ${c.variety || "?"}(${c.fruit_type || "?"}) vol=${f(c.jv)}${c.juice_volume_unit || "L"} wt=${f(c.wt || 0)}kg${del}`);
    }

    // === VOLUME WATERFALL ===
    console.log(`\n  == VOLUME WATERFALL ==`);
    const reconstructed = initL + totalXfInL + totalMergesInL + totalAdjL
      - (totalXfOutVolL + totalXfOutLossL) - totalMergesOutL
      - totalBtlL - totalKegL - totalRackLossL - totalFilterLossL - totalDistL;
    const gap = reconstructed - currL;

    console.log(`    Initial:          ${f(initL, 1)}L (${f(initL * G, 1)}gal)`);
    console.log(`    + Merges in:      ${f(totalMergesInL, 1)}L (${f(totalMergesInL * G, 1)}gal)`);
    console.log(`    + Transfers in:   ${f(totalXfInL, 1)}L (${f(totalXfInL * G, 1)}gal)`);
    console.log(`    + Adjustments:    ${f(totalAdjL, 1)}L`);
    console.log(`    - Merges out:     ${f(totalMergesOutL, 1)}L (${f(totalMergesOutL * G, 1)}gal)`);
    console.log(`    - Transfers out:  ${f(totalXfOutVolL + totalXfOutLossL, 1)}L (vol=${f(totalXfOutVolL, 1)} + loss=${f(totalXfOutLossL, 1)})`);
    console.log(`    - Bottle runs:    ${f(totalBtlL, 1)}L (${f(totalBtlL * G, 1)}gal)`);
    console.log(`    - Keg fills:      ${f(totalKegL, 1)}L (${f(totalKegL * G, 1)}gal)`);
    console.log(`    - Racking loss:   ${f(totalRackLossL, 1)}L`);
    console.log(`    - Filter loss:    ${f(totalFilterLossL, 1)}L`);
    console.log(`    - Distillation:   ${f(totalDistL, 1)}L`);
    console.log(`    = Reconstructed:  ${f(reconstructed, 1)}L (${f(reconstructed * G, 1)}gal)`);
    console.log(`      Stored:         ${f(currL, 1)}L (${f(currL * G, 1)}gal)`);
    console.log(`      Gap:            ${f(gap, 1)}L (${f(gap * G, 1)}gal) ${Math.abs(gap) < 0.5 ? "OK" : "*** MISMATCH ***"}`);
  }
}

async function main() {
  console.log("=== GAP BATCH INVESTIGATION ===");
  console.log("Investigating 3 batches with significant volume gaps\n");

  // Batch 1: blend-2024-12-20-1000 IBC 4-024554 (cider) +45.4 gal gap
  await investigateBatch("IBC 4-024554");

  // Batch 2: 2025-11-26_IBC-1000-10_JONA_A (cider) -40.9 gal gap
  await investigateBatch("2025-11-26_IBC-1000-10_JONA_A");

  // Batch 3: 2025-12-16_UNKN_BLEND_A (wine, Plum Wine second vessel)
  await investigateBatch("2025-12-16_UNKN_BLEND_A");

  console.log("\n\n=== INVESTIGATION COMPLETE ===");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
