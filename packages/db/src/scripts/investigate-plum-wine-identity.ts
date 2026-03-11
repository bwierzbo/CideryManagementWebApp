import { db } from "..";
import { sql } from "drizzle-orm";

const G = 0.264172; // liters to gallons
function f(v: any, d = 2) { return v == null ? "null" : parseFloat(String(v)).toFixed(d); }
function lg(l: any) { if (l == null) return "null"; const v = parseFloat(String(l)); return `${v.toFixed(2)}L (${(v * G).toFixed(2)}gal)`; }

async function main() {
  // ==========================================
  // 1. FIND BOTH PLUM WINE BATCHES
  // ==========================================
  console.log("=== BOTH PLUM WINE BATCHES ===");
  const batches = (await db.execute(sql.raw(`
    SELECT b.id, b.name, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      b.start_date::text, b.parent_batch_id, b.reconciliation_status,
      b.deleted_at::text, b.fermentation_stage,
      b.is_racking_derivative,
      CAST(b.transfer_loss_l AS NUMERIC) AS xfer_loss_l,
      v.name AS vessel_name
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.name LIKE '%UNKN_BLEND_A%' OR b.batch_number LIKE '%UNKN_BLEND_A%'
    ORDER BY b.start_date
  `))).rows as any[];

  for (const b of batches) {
    const fl: string[] = [];
    if (b.deleted_at) fl.push("DELETED");
    if (b.is_racking_derivative) fl.push("RACK_DERIV");
    if (b.reconciliation_status && b.reconciliation_status !== "pending") fl.push("recon=" + b.reconciliation_status);
    console.log(`\n${b.name || b.custom_name || b.batch_number} [${fl.join(",")}]`);
    console.log(`  ID: ${b.id}`);
    console.log(`  Type: ${b.product_type}, Status: ${b.status}, FermStage: ${b.fermentation_stage}`);
    console.log(`  Init: ${lg(b.init_l)}, Current: ${lg(b.curr_l)}`);
    console.log(`  Start: ${b.start_date}, Vessel: ${b.vessel_name || "NONE"}`);
    console.log(`  Parent: ${b.parent_batch_id || "NONE"}`);
    console.log(`  TransferLoss: ${lg(b.xfer_loss_l)}`);
  }

  const allIds = batches.map((b: any) => b.id);
  if (!allIds.length) { console.log("No plum batches found!"); process.exit(0); }
  const il = allIds.map((id: string) => `'${id}'`).join(",");

  // Focus on the specific batch
  const targetBatch = batches.find((b: any) => (b.name || "").includes("2025-12-21_UNKN_BLEND_A") && !(b.name || "").includes("Tmk8"));
  const targetId = targetBatch?.id;
  console.log(`\n=== TARGET BATCH: ${targetBatch?.name} (ID: ${targetId}) ===`);

  // ==========================================
  // 2. TRANSFERS OUT FROM TARGET BATCH
  // ==========================================
  console.log("\n=== TRANSFERS OUT FROM TARGET BATCH ===");
  const xfOut = (await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol,
      bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss,
      bt.loss_unit,
      bt.transferred_at::text,
      bt.deleted_at::text,
      bt.notes,
      db.name AS dest_name, db.custom_name AS dest_custom,
      CAST(db.initial_volume_liters AS NUMERIC) AS dest_init_l,
      CAST(db.current_volume_liters AS NUMERIC) AS dest_curr_l
    FROM batch_transfers bt
    LEFT JOIN batches db ON bt.destination_batch_id = db.id
    WHERE bt.source_batch_id = '${targetId}'
    ORDER BY bt.transferred_at
  `))).rows as any[];
  let totalXfOutL = 0, totalXfLossL = 0;
  for (const t of xfOut) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL = t.volume_transferred_unit === 'gal' ? parseFloat(t.vol) * 3.78541 : parseFloat(t.vol);
    const lossL = (t.loss_unit === 'gal' ? parseFloat(t.loss || 0) * 3.78541 : parseFloat(t.loss || 0));
    if (!t.deleted_at) { totalXfOutL += volL; totalXfLossL += lossL; }
    console.log(`  ${t.transferred_at}: ${f(volL)}L (${f(volL * G)}gal) loss=${f(lossL)}L -> ${t.dest_name || t.dest_custom} (init=${lg(t.dest_init_l)}, curr=${lg(t.dest_curr_l)})${d}`);
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }
  console.log(`  TOTAL active xfOut: ${f(totalXfOutL)}L (${f(totalXfOutL * G)}gal), loss: ${f(totalXfLossL)}L (${f(totalXfLossL * G)}gal)`);

  // ==========================================
  // 3. TRANSFERS IN TO TARGET BATCH
  // ==========================================
  console.log("\n=== TRANSFERS IN TO TARGET BATCH ===");
  const xfIn = (await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
      CAST(bt.volume_transferred AS NUMERIC) AS vol,
      bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss,
      bt.loss_unit,
      bt.transferred_at::text,
      bt.deleted_at::text,
      bt.notes,
      sb.name AS src_name, sb.custom_name AS src_custom
    FROM batch_transfers bt
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = '${targetId}'
    ORDER BY bt.transferred_at
  `))).rows as any[];
  let totalXfInL = 0;
  for (const t of xfIn) {
    const d = t.deleted_at ? " [DEL]" : "";
    const volL = t.volume_transferred_unit === 'gal' ? parseFloat(t.vol) * 3.78541 : parseFloat(t.vol);
    if (!t.deleted_at) totalXfInL += volL;
    console.log(`  ${t.transferred_at}: ${f(volL)}L from ${t.src_name || t.src_custom}${d}`);
    if (t.notes) console.log(`    Notes: ${t.notes}`);
  }
  console.log(`  TOTAL active xfIn: ${f(totalXfInL)}L (${f(totalXfInL * G)}gal)`);

  // ==========================================
  // 4. BOTTLE RUNS FROM TARGET BATCH
  // ==========================================
  console.log("\n=== BOTTLE RUNS FROM TARGET BATCH ===");
  const bottles = (await db.execute(sql.raw(`
    SELECT br.id, br.batch_id,
      CAST(br.volume_taken_liters AS NUMERIC) AS vol_taken_l,
      CAST(br.loss AS NUMERIC) AS loss,
      br.loss_unit,
      br.units_produced, br.package_type,
      CAST(br.package_size_ml AS NUMERIC) AS pkg_ml,
      br.packaged_at::text,
      br.voided_at::text,
      br.status,
      br.distributed_at::text
    FROM bottle_runs br
    WHERE br.batch_id = '${targetId}'
    ORDER BY br.packaged_at
  `))).rows as any[];
  let totalBottleTakenL = 0, totalBottleLossL = 0;
  for (const b of bottles) {
    const v = b.voided_at ? " [VOID]" : "";
    const lossL = b.loss_unit === 'gal' ? parseFloat(b.loss || 0) * 3.78541 : parseFloat(b.loss || 0);
    const productL = (parseFloat(b.units_produced || 0) * parseFloat(b.pkg_ml || 0)) / 1000;
    const volTaken = parseFloat(b.vol_taken_l || 0);
    // Same logic as SBD: if volTaken ≈ product + loss, loss is included; else add it
    const lossIncluded = Math.abs(volTaken - (productL + lossL)) < 2;
    const effectiveTaken = volTaken + (lossIncluded ? 0 : lossL);
    if (!b.voided_at) { totalBottleTakenL += effectiveTaken; totalBottleLossL += lossL; }
    console.log(`  ${b.packaged_at}: vol_taken=${f(volTaken)}L loss=${f(lossL)}L (${b.loss_unit}) product=${f(productL)}L (${b.units_produced} x ${f(b.pkg_ml)}ml) lossIncluded=${lossIncluded} effectiveTaken=${f(effectiveTaken)}L status=${b.status} dist=${b.distributed_at || "no"}${v}`);
  }
  console.log(`  TOTAL active bottleTaken: ${f(totalBottleTakenL)}L (${f(totalBottleTakenL * G)}gal), loss: ${f(totalBottleLossL)}L (${f(totalBottleLossL * G)}gal)`);

  // ==========================================
  // 5. KEG FILLS FROM TARGET BATCH
  // ==========================================
  console.log("\n=== KEG FILLS FROM TARGET BATCH ===");
  const kegs = (await db.execute(sql.raw(`
    SELECT kf.id, kf.batch_id,
      CAST(kf.volume_taken AS NUMERIC) AS vol_taken,
      kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss,
      kf.loss_unit,
      kf.filled_at::text,
      kf.voided_at::text,
      kf.deleted_at::text,
      kf.status,
      kf.distributed_at::text,
      k.keg_number AS keg_name
    FROM keg_fills kf
    LEFT JOIN kegs k ON kf.keg_id = k.id
    WHERE kf.batch_id = '${targetId}'
    ORDER BY kf.filled_at
  `))).rows as any[];
  let totalKegTakenL = 0, totalKegLossL = 0;
  for (const k of kegs) {
    const fl: string[] = [];
    if (k.deleted_at) fl.push("DEL");
    if (k.voided_at) fl.push("VOID");
    const fs = fl.length ? ` [${fl.join(",")}]` : "";
    const volL = k.volume_taken_unit === 'gal' ? parseFloat(k.vol_taken) * 3.78541 : parseFloat(k.vol_taken);
    const lossL = k.loss_unit === 'gal' ? parseFloat(k.loss || 0) * 3.78541 : parseFloat(k.loss || 0);
    if (!k.deleted_at && !k.voided_at) { totalKegTakenL += volL + lossL; totalKegLossL += lossL; }
    console.log(`  ${k.filled_at}: ${k.keg_name || "?"} vol=${f(volL)}L (${k.volume_taken_unit}) loss=${f(lossL)}L (${k.loss_unit}) status=${k.status} dist=${k.distributed_at || "no"}${fs}`);
  }
  console.log(`  TOTAL active kegTaken (vol+loss): ${f(totalKegTakenL)}L (${f(totalKegTakenL * G)}gal), loss: ${f(totalKegLossL)}L (${f(totalKegLossL * G)}gal)`);

  // ==========================================
  // 6. RACKING OPERATIONS
  // ==========================================
  console.log("\n=== RACKING OPS FROM TARGET BATCH ===");
  const racks = (await db.execute(sql.raw(`
    SELECT bro.id, bro.batch_id,
      CAST(bro.volume_before AS NUMERIC) AS vb, bro.volume_before_unit,
      CAST(bro.volume_after AS NUMERIC) AS va, bro.volume_after_unit,
      CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
      bro.racked_at::text, bro.deleted_at::text, bro.notes
    FROM batch_racking_operations bro
    WHERE bro.batch_id = '${targetId}'
    ORDER BY bro.racked_at
  `))).rows as any[];
  let totalRackLossL = 0;
  for (const r of racks) {
    const d = r.deleted_at ? " [DEL]" : "";
    const lossL = r.volume_loss_unit === 'gal' ? parseFloat(r.vl) * 3.78541 : parseFloat(r.vl);
    if (!r.deleted_at) totalRackLossL += lossL;
    console.log(`  ${r.racked_at}: before=${f(r.vb)}${r.volume_before_unit} after=${f(r.va)}${r.volume_after_unit} loss=${f(lossL)}L${d}`);
    if (r.notes) console.log(`    Notes: ${r.notes}`);
  }
  console.log(`  TOTAL active rackLoss: ${f(totalRackLossL)}L (${f(totalRackLossL * G)}gal)`);

  // ==========================================
  // 7. VOLUME ADJUSTMENTS
  // ==========================================
  console.log("\n=== VOLUME ADJUSTMENTS FOR TARGET BATCH ===");
  const adjs = (await db.execute(sql.raw(`
    SELECT va.id, va.batch_id,
      CAST(va.adjustment_amount AS NUMERIC) AS amt,
      va.adjustment_date::text, va.reason, va.deleted_at::text
    FROM batch_volume_adjustments va
    WHERE va.batch_id = '${targetId}'
    ORDER BY va.adjustment_date
  `))).rows as any[];
  let totalAdjL = 0;
  for (const a of adjs) {
    const d = a.deleted_at ? " [DEL]" : "";
    if (!a.deleted_at) totalAdjL += parseFloat(a.amt);
    console.log(`  ${a.adjustment_date}: ${f(a.amt)}L reason="${a.reason}"${d}`);
  }
  console.log(`  TOTAL active adj: ${f(totalAdjL)}L (${f(totalAdjL * G)}gal)`);

  // ==========================================
  // 8. MERGE HISTORY (into and out of target)
  // ==========================================
  console.log("\n=== MERGE HISTORY FOR TARGET BATCH ===");
  const merges = (await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bmh.source_batch_id, bmh.source_press_run_id,
      bmh.source_juice_purchase_item_id, bmh.source_type,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      bmh.merged_at::text, bmh.deleted_at::text,
      bt.name AS target_name, bs.name AS source_name,
      pr.press_run_name AS press_name
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
    LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
    WHERE bmh.target_batch_id = '${targetId}' OR bmh.source_batch_id = '${targetId}'
    ORDER BY bmh.merged_at
  `))).rows as any[];
  for (const m of merges) {
    const d = m.deleted_at ? " [DEL]" : "";
    const dir = m.target_batch_id === targetId ? "IN" : "OUT";
    const volL = m.volume_added_unit === 'gal' ? parseFloat(m.vol) * 3.78541 : parseFloat(m.vol);
    console.log(`  ${m.merged_at}: ${dir} ${f(volL)}L type=${m.source_type} from=${m.source_name || m.press_name || "juice"} to=${m.target_name}${d}`);
  }

  // Check mergesOUT (where target batch's ID appears as source in another batch's merge)
  console.log("\n=== MERGES OUT (target batch as source) ===");
  const mergesOut = (await db.execute(sql.raw(`
    SELECT bmh.id, bmh.target_batch_id, bmh.source_batch_id, bmh.source_type,
      CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      bmh.merged_at::text, bmh.deleted_at::text,
      bt.name AS target_name
    FROM batch_merge_history bmh
    LEFT JOIN batches bt ON bmh.target_batch_id = bt.id
    WHERE bmh.source_batch_id = '${targetId}'
    ORDER BY bmh.merged_at
  `))).rows as any[];
  if (!mergesOut.length) console.log("  (none)");
  for (const m of mergesOut) {
    const d = m.deleted_at ? " [DEL]" : "";
    const volL = m.volume_added_unit === 'gal' ? parseFloat(m.vol) * 3.78541 : parseFloat(m.vol);
    console.log(`  ${m.merged_at}: ${f(volL)}L -> ${m.target_name} type=${m.source_type}${d}`);
  }

  // ==========================================
  // 9. FILTER OPERATIONS
  // ==========================================
  console.log("\n=== FILTER OPERATIONS FOR TARGET BATCH ===");
  const filters = (await db.execute(sql.raw(`
    SELECT fo.id, fo.batch_id,
      CAST(fo.volume_loss AS NUMERIC) AS vl,
      fo.volume_before_unit,
      fo.filtered_at::text, fo.deleted_at::text
    FROM batch_filter_operations fo
    WHERE fo.batch_id = '${targetId}'
    ORDER BY fo.filtered_at
  `))).rows as any[];
  if (!filters.length) console.log("  (none)");
  let totalFilterLossL = 0;
  for (const fo of filters) {
    const d = fo.deleted_at ? " [DEL]" : "";
    // volume_loss is in same unit as volume_before_unit
    const lossL = fo.volume_before_unit === 'gal' ? parseFloat(fo.vl) * 3.78541 : parseFloat(fo.vl);
    if (!fo.deleted_at) totalFilterLossL += lossL;
    console.log(`  ${fo.filtered_at}: loss=${f(lossL)}L (unit=${fo.volume_before_unit})${d}`);
  }

  // ==========================================
  // 10. DISTILLATION RECORDS
  // ==========================================
  console.log("\n=== DISTILLATION RECORDS FOR TARGET BATCH ===");
  const dists = (await db.execute(sql.raw(`
    SELECT dr.id, dr.source_batch_id,
      CAST(dr.source_volume_liters AS NUMERIC) AS vol_l,
      dr.sent_at::text, dr.deleted_at::text
    FROM distillation_records dr
    WHERE dr.source_batch_id = '${targetId}'
    ORDER BY dr.sent_at
  `))).rows as any[];
  if (!dists.length) console.log("  (none)");

  // ==========================================
  // 11. BOTTLE DISTRIBUTIONS (from bottle_runs)
  // ==========================================
  console.log("\n=== BOTTLE DISTRIBUTIONS (distributed bottle runs) ===");
  const bottleDist = (await db.execute(sql.raw(`
    SELECT br.id, br.batch_id,
      CAST(br.volume_taken_liters AS NUMERIC) AS vol_taken_l,
      CAST(br.loss AS NUMERIC) AS loss,
      br.loss_unit,
      br.packaged_at::text,
      br.distributed_at::text,
      br.voided_at::text,
      br.status
    FROM bottle_runs br
    WHERE br.batch_id = '${targetId}'
      AND br.voided_at IS NULL
      AND (br.status IN ('distributed', 'completed') OR br.distributed_at IS NOT NULL)
    ORDER BY br.distributed_at
  `))).rows as any[];
  if (!bottleDist.length) console.log("  (none)");
  for (const b of bottleDist) {
    console.log(`  packaged=${b.packaged_at} dist=${b.distributed_at} vol=${f(b.vol_taken_l)}L loss=${f(b.loss || 0)}${b.loss_unit || "L"} status=${b.status}`);
  }

  // ==========================================
  // 12. KEG DISTRIBUTIONS
  // ==========================================
  console.log("\n=== KEG DISTRIBUTIONS (distributed keg fills) ===");
  const kegDist = (await db.execute(sql.raw(`
    SELECT kf.id, kf.batch_id,
      CAST(kf.volume_taken AS NUMERIC) AS vol,
      kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss,
      kf.loss_unit,
      kf.filled_at::text,
      kf.distributed_at::text,
      kf.voided_at::text,
      kf.deleted_at::text,
      kf.status
    FROM keg_fills kf
    WHERE kf.batch_id = '${targetId}'
      AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
      AND kf.distributed_at IS NOT NULL
    ORDER BY kf.distributed_at
  `))).rows as any[];
  if (!kegDist.length) console.log("  (none)");
  for (const k of kegDist) {
    const volL = k.volume_taken_unit === 'gal' ? parseFloat(k.vol) * 3.78541 : parseFloat(k.vol);
    const lossL = k.loss_unit === 'gal' ? parseFloat(k.loss || 0) * 3.78541 : parseFloat(k.loss || 0);
    console.log(`  filled=${k.filled_at} dist=${k.distributed_at} vol=${f(volL)}L loss=${f(lossL)}L status=${k.status}`);
  }

  // ==========================================
  // 13. RECONSTRUCTION FOR TARGET BATCH
  // ==========================================
  console.log("\n\n========================================");
  console.log("=== VOLUME RECONSTRUCTION: TARGET BATCH ===");
  console.log("========================================");
  if (targetBatch) {
    const initL = parseFloat(targetBatch.init_l) || 0;
    const currL = parseFloat(targetBatch.curr_l) || 0;
    const pressLossL = parseFloat(targetBatch.xfer_loss_l) || 0;

    console.log(`  Initial: ${f(initL)}L (${f(initL * G)}gal)`);
    console.log(`  PressTransferLoss: ${f(pressLossL)}L (${f(pressLossL * G)}gal)`);
    console.log(`  TransfersIn: ${f(totalXfInL)}L (${f(totalXfInL * G)}gal)`);
    console.log(`  TransfersOut (vol only): ${f(totalXfOutL)}L (${f(totalXfOutL * G)}gal)`);
    console.log(`  TransferLoss: ${f(totalXfLossL)}L (${f(totalXfLossL * G)}gal)`);
    console.log(`  BottleTaken (effective): ${f(totalBottleTakenL)}L (${f(totalBottleTakenL * G)}gal)`);
    console.log(`  BottleLoss (subset of taken): ${f(totalBottleLossL)}L (${f(totalBottleLossL * G)}gal)`);
    console.log(`  KegTaken (vol+loss): ${f(totalKegTakenL)}L (${f(totalKegTakenL * G)}gal)`);
    console.log(`  KegLoss (subset of taken): ${f(totalKegLossL)}L (${f(totalKegLossL * G)}gal)`);
    console.log(`  RackingLoss: ${f(totalRackLossL)}L (${f(totalRackLossL * G)}gal)`);
    console.log(`  FilterLoss: ${f(totalFilterLossL)}L (${f(totalFilterLossL * G)}gal)`);
    console.log(`  Adjustments: ${f(totalAdjL)}L (${f(totalAdjL * G)}gal)`);

    // SBD ending formula: init + xfIn + mergesIn - xfOut - xfLoss - bottleTaken - kegTaken - rackLoss - mergesOut - filterLoss - distillation + adj
    const reconstructed = initL + totalXfInL - totalXfOutL - totalXfLossL - totalBottleTakenL - totalKegTakenL - totalRackLossL - totalFilterLossL + totalAdjL;
    const clamped = Math.max(0, reconstructed);
    const identity = reconstructed - clamped;

    console.log(`\n  Reconstructed ending: ${f(reconstructed)}L (${f(reconstructed * G)}gal)`);
    console.log(`  Clamped ending: ${f(clamped)}L (${f(clamped * G)}gal)`);
    console.log(`  Identity (unclamped - clamped): ${f(identity)}L (${f(identity * G)}gal)`);
    console.log(`  DB currentVolumeLiters: ${f(currL)}L (${f(currL * G)}gal)`);
    console.log(`  Drift (reconstructed - db): ${f(reconstructed - currL)}L`);

    // SBD reported fields mapping:
    // production = initL + pressLossL (for new batches)
    // packaging = bottleTaken + kegTaken - bottleLoss - kegLoss
    // losses = bottleLoss + kegLoss + rackLoss + filterLoss + negAdj
    const prodGal = (initL + pressLossL) * G;
    const packagingGal = (totalBottleTakenL + totalKegTakenL - totalBottleLossL - totalKegLossL) * G;
    const lossesGal = (totalBottleLossL + totalKegLossL + totalRackLossL + totalFilterLossL + Math.abs(Math.min(0, totalAdjL))) * G;
    const xfOutGal = totalXfOutL * G;
    const xfLossGal = totalXfLossL * G;

    console.log(`\n  === SBD REPORTED FIELDS (gal) ===`);
    console.log(`  production: ${f(prodGal)}`);
    console.log(`  packaging: ${f(packagingGal)}`);
    console.log(`  losses: ${f(lossesGal)}`);
    console.log(`  xfOut: ${f(xfOutGal)}`);
    console.log(`  xfLoss: ${f(xfLossGal)}`);
    console.log(`  ending: ${f(clamped * G)}`);
    console.log(`  identity: ${f(identity * G)}`);

    // Show what formula gives
    const formulaCheck = prodGal - pressLossL * G - packagingGal - lossesGal - xfOutGal - xfLossGal + clamped * G;
    console.log(`\n  Formula check: prod(${f(prodGal)}) - pressLoss(${f(pressLossL * G)}) - pkg(${f(packagingGal)}) - losses(${f(lossesGal)}) - xfOut(${f(xfOutGal)}) - xfLoss(${f(xfLossGal)}) + ending(${f(clamped * G)}) = ${f(formulaCheck)} (should ~= 0 if no identity gap)`);
  }

  // ==========================================
  // 14. SAME FOR THE OTHER PLUM WINE BATCH
  // ==========================================
  const otherBatch = batches.find((b: any) => (b.name || "").includes("Tmk8"));
  if (otherBatch) {
    const otherId = otherBatch.id;
    console.log(`\n\n========================================`);
    console.log(`=== OTHER PLUM WINE BATCH: ${otherBatch.name} ===`);
    console.log(`========================================`);

    // Transfers out
    const oXfOut = (await db.execute(sql.raw(`
      SELECT bt.id, CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
        CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
        bt.transferred_at::text, bt.deleted_at::text, db.name AS dest_name
      FROM batch_transfers bt LEFT JOIN batches db ON bt.destination_batch_id = db.id
      WHERE bt.source_batch_id = '${otherId}' ORDER BY bt.transferred_at
    `))).rows as any[];
    console.log("\n  Transfers OUT:");
    let oXfOutL = 0, oXfLossL = 0;
    for (const t of oXfOut) {
      const d = t.deleted_at ? " [DEL]" : "";
      const volL = t.volume_transferred_unit === 'gal' ? parseFloat(t.vol) * 3.78541 : parseFloat(t.vol);
      const lossL = t.loss_unit === 'gal' ? parseFloat(t.loss || 0) * 3.78541 : parseFloat(t.loss || 0);
      if (!t.deleted_at) { oXfOutL += volL; oXfLossL += lossL; }
      console.log(`    ${t.transferred_at}: ${f(volL)}L -> ${t.dest_name}${d}`);
    }

    // Transfers in
    const oXfIn = (await db.execute(sql.raw(`
      SELECT bt.id, CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
        bt.transferred_at::text, bt.deleted_at::text, sb.name AS src_name
      FROM batch_transfers bt LEFT JOIN batches sb ON bt.source_batch_id = sb.id
      WHERE bt.destination_batch_id = '${otherId}' ORDER BY bt.transferred_at
    `))).rows as any[];
    console.log("  Transfers IN:");
    let oXfInL = 0;
    for (const t of oXfIn) {
      const d = t.deleted_at ? " [DEL]" : "";
      const volL = t.volume_transferred_unit === 'gal' ? parseFloat(t.vol) * 3.78541 : parseFloat(t.vol);
      if (!t.deleted_at) oXfInL += volL;
      console.log(`    ${t.transferred_at}: ${f(volL)}L from ${t.src_name}${d}`);
    }

    // Bottle runs
    const oBottles = (await db.execute(sql.raw(`
      SELECT br.id, CAST(br.volume_taken_liters AS NUMERIC) AS vol_taken_l,
        CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
        br.units_produced, CAST(br.package_size_ml AS NUMERIC) AS pkg_ml,
        br.packaged_at::text, br.voided_at::text, br.status, br.distributed_at::text
      FROM bottle_runs br WHERE br.batch_id = '${otherId}' ORDER BY br.packaged_at
    `))).rows as any[];
    console.log("  Bottles:");
    let oBottleTakenL = 0, oBottleLossL = 0;
    for (const b of oBottles) {
      const v = b.voided_at ? " [VOID]" : "";
      const lossL = b.loss_unit === 'gal' ? parseFloat(b.loss || 0) * 3.78541 : parseFloat(b.loss || 0);
      const productL = (parseFloat(b.units_produced || 0) * parseFloat(b.pkg_ml || 0)) / 1000;
      const volTaken = parseFloat(b.vol_taken_l || 0);
      const lossIncluded = Math.abs(volTaken - (productL + lossL)) < 2;
      const effectiveTaken = volTaken + (lossIncluded ? 0 : lossL);
      if (!b.voided_at) { oBottleTakenL += effectiveTaken; oBottleLossL += lossL; }
      console.log(`    ${b.packaged_at}: vol=${f(volTaken)}L loss=${f(lossL)}L effective=${f(effectiveTaken)}L status=${b.status} dist=${b.distributed_at}${v}`);
    }

    // Keg fills
    const oKegs = (await db.execute(sql.raw(`
      SELECT kf.id, CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
        CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
        kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text,
        kf.distributed_at::text, k.keg_number AS keg_name
      FROM keg_fills kf LEFT JOIN kegs k ON kf.keg_id = k.id
      WHERE kf.batch_id = '${otherId}' ORDER BY kf.filled_at
    `))).rows as any[];
    console.log("  Kegs:");
    let oKegTakenL = 0, oKegLossL = 0;
    for (const k of oKegs) {
      const fl: string[] = [];
      if (k.deleted_at) fl.push("DEL");
      if (k.voided_at) fl.push("VOID");
      const fs = fl.length ? ` [${fl.join(",")}]` : "";
      const volL = k.volume_taken_unit === 'gal' ? parseFloat(k.vol) * 3.78541 : parseFloat(k.vol);
      const lossL = k.loss_unit === 'gal' ? parseFloat(k.loss || 0) * 3.78541 : parseFloat(k.loss || 0);
      if (!k.deleted_at && !k.voided_at) { oKegTakenL += volL + lossL; oKegLossL += lossL; }
      console.log(`    ${k.filled_at}: ${k.keg_name} vol=${f(volL)}L loss=${f(lossL)}L dist=${k.distributed_at}${fs}`);
    }

    // Racking ops
    const oRacks = (await db.execute(sql.raw(`
      SELECT bro.id, CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
        bro.racked_at::text, bro.deleted_at::text
      FROM batch_racking_operations bro WHERE bro.batch_id = '${otherId}' ORDER BY bro.racked_at
    `))).rows as any[];
    console.log("  Racking:");
    let oRackLossL = 0;
    for (const r of oRacks) {
      const d = r.deleted_at ? " [DEL]" : "";
      const lossL = r.volume_loss_unit === 'gal' ? parseFloat(r.vl) * 3.78541 : parseFloat(r.vl);
      if (!r.deleted_at) oRackLossL += lossL;
      console.log(`    ${r.racked_at}: loss=${f(lossL)}L${d}`);
    }

    // Adjustments
    const oAdjs = (await db.execute(sql.raw(`
      SELECT va.id, CAST(va.adjustment_amount AS NUMERIC) AS amt, va.adjustment_date::text, va.reason, va.deleted_at::text
      FROM batch_volume_adjustments va WHERE va.batch_id = '${otherId}' ORDER BY va.adjustment_date
    `))).rows as any[];
    console.log("  Adjustments:");
    let oAdjL = 0;
    for (const a of oAdjs) {
      const d = a.deleted_at ? " [DEL]" : "";
      if (!a.deleted_at) oAdjL += parseFloat(a.amt);
      console.log(`    ${a.adjustment_date}: ${f(a.amt)}L reason="${a.reason}"${d}`);
    }

    // Reconstruction
    const oInitL = parseFloat(otherBatch.init_l) || 0;
    const oCurrL = parseFloat(otherBatch.curr_l) || 0;
    const oRecon = oInitL + oXfInL - oXfOutL - oXfLossL - oBottleTakenL - oKegTakenL - oRackLossL + oAdjL;
    console.log(`\n  Reconstruction: ${f(oInitL)}L + xfIn(${f(oXfInL)}) - xfOut(${f(oXfOutL)}) - xfLoss(${f(oXfLossL)}) - btl(${f(oBottleTakenL)}) - keg(${f(oKegTakenL)}) - rack(${f(oRackLossL)}) + adj(${f(oAdjL)}) = ${f(oRecon)}L`);
    console.log(`  DB currentVolumeLiters: ${f(oCurrL)}L, diff: ${f(oRecon - oCurrL)}L`);
  }

  // ==========================================
  // 15. COMBINED PLUM WINE SUMMARY
  // ==========================================
  console.log("\n\n========================================");
  console.log("=== COMBINED PLUM WINE SUMMARY ===");
  console.log("========================================");

  // Total packaging across both batches
  const allBottles = (await db.execute(sql.raw(`
    SELECT b.name, CAST(br.volume_taken_liters AS NUMERIC) AS vol_l,
      CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
      br.units_produced, CAST(br.package_size_ml AS NUMERIC) AS pkg_ml,
      br.packaged_at::text, br.voided_at::text, br.status, br.distributed_at::text
    FROM bottle_runs br JOIN batches b ON br.batch_id = b.id
    WHERE br.batch_id IN (${il}) AND br.voided_at IS NULL
    ORDER BY br.packaged_at
  `))).rows as any[];

  const allKegs = (await db.execute(sql.raw(`
    SELECT b.name, CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
      kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text,
      kf.distributed_at::text, k.keg_number AS keg_name
    FROM keg_fills kf JOIN batches b ON kf.batch_id = b.id
    LEFT JOIN kegs k ON kf.keg_id = k.id
    WHERE kf.batch_id IN (${il}) AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
    ORDER BY kf.filled_at
  `))).rows as any[];

  let combinedBottleProductL = 0, combinedKegVolL = 0;
  for (const b of allBottles) {
    const productL = (parseFloat(b.units_produced || 0) * parseFloat(b.pkg_ml || 0)) / 1000;
    combinedBottleProductL += productL;
  }
  for (const k of allKegs) {
    const volL = k.volume_taken_unit === 'gal' ? parseFloat(k.vol) * 3.78541 : parseFloat(k.vol);
    combinedKegVolL += volL;
  }

  const totalInitL = batches.reduce((s: number, b: any) => s + (parseFloat(b.init_l) || 0), 0);
  const totalCurrL = batches.reduce((s: number, b: any) => s + (parseFloat(b.curr_l) || 0), 0);

  console.log(`  Total initial (both batches): ${lg(totalInitL)}`);
  console.log(`  Total current (both batches): ${lg(totalCurrL)}`);
  console.log(`  Bottle product: ${lg(combinedBottleProductL)}`);
  console.log(`  Keg volume: ${lg(combinedKegVolL)}`);
  console.log(`  Total packaged: ${lg(combinedBottleProductL + combinedKegVolL)}`);

  // Known from memory: 175L plum juice + 85L cider = 260L in. 234L packaged. 11L remaining. ~15L lees/loss.

  console.log("\n=== DONE ===");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
