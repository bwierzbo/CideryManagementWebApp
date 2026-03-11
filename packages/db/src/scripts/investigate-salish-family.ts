import { db } from "../client";
import { sql } from "drizzle-orm";

const G = (l: number) => (l / 3.78541).toFixed(2);
const fmt = (l: number) => `${l.toFixed(2)} L (${G(l)} gal)`;
const dateFmt = (d: any) =>
  d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) : "(null)";

async function main() {
  console.log("=".repeat(100));
  console.log("  SALISH POMMEAU FAMILY — DEEP INVESTIGATION");
  console.log("=".repeat(100));

  // ── 1. FIND THE PARENT BATCH ──────────────────────────────────────────────
  console.log("\n\n=== 1. FIND PARENT BATCH ===\n");

  const parentResult = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.product_type, b.start_date,
           CAST(b.initial_volume_liters AS NUMERIC) AS initial_l,
           CAST(b.current_volume_liters AS NUMERIC) AS current_l,
           b.parent_batch_id, b.reconciliation_status, b.vessel_id,
           b.is_racking_derivative, b.status, b.deleted_at,
           b.estimated_abv, b.actual_abv,
           v.name AS vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.name LIKE '%120 Barrel 2%' OR b.custom_name ILIKE '%Salish%')
      AND b.parent_batch_id IS NULL
      AND b.product_type = 'pommeau'
    ORDER BY b.start_date
    LIMIT 5
  `));

  if (parentResult.rows.length === 0) {
    // Broader search
    console.log("No exact parent match. Trying broader search...");
    const broader = await db.execute(sql.raw(`
      SELECT b.id, b.name, b.custom_name, b.product_type, b.start_date,
             CAST(b.initial_volume_liters AS NUMERIC) AS initial_l,
             CAST(b.current_volume_liters AS NUMERIC) AS current_l,
             b.parent_batch_id, b.reconciliation_status, b.vessel_id,
             b.is_racking_derivative, b.status, b.deleted_at,
             b.estimated_abv, b.actual_abv,
             v.name AS vessel_name
      FROM batches b
      LEFT JOIN vessels v ON b.vessel_id = v.id
      WHERE (b.name LIKE '%120 Barrel 2%' OR b.custom_name ILIKE '%Salish%')
      ORDER BY b.start_date
    `));
    console.log(`Broader search found ${broader.rows.length} results:`);
    for (const r of broader.rows as any[]) {
      console.log(
        `  ${r.name} | ${r.custom_name} | type=${r.product_type} | parent=${r.parent_batch_id || "NONE"} | init=${fmt(parseFloat(r.initial_l))} | curr=${fmt(parseFloat(r.current_l))}`
      );
    }
    if (broader.rows.length === 0) {
      console.log("No Salish batches found at all. Exiting.");
      process.exit(0);
    }
  }

  const parents = parentResult.rows as any[];
  for (const p of parents) {
    printBatch(p, 0);
  }

  // Use first parent
  const parentId = (parents[0] as any).id;
  console.log(`\nUsing parent ID: ${parentId}`);

  // ── 2. RECURSIVE CHILDREN + GRANDCHILDREN ─────────────────────────────────
  console.log("\n\n=== 2. ALL DESCENDANTS (recursive) ===\n");

  const descendantsResult = await db.execute(sql.raw(`
    WITH RECURSIVE family AS (
      -- Base: the parent
      SELECT b.id, b.name, b.custom_name, b.product_type, b.start_date,
             CAST(b.initial_volume_liters AS NUMERIC) AS initial_l,
             CAST(b.current_volume_liters AS NUMERIC) AS current_l,
             b.parent_batch_id, b.reconciliation_status, b.vessel_id,
             b.is_racking_derivative, b.status, b.deleted_at,
             b.estimated_abv, b.actual_abv,
             0 AS depth
      FROM batches b
      WHERE b.id = '${parentId}'

      UNION ALL

      -- Recursive: children
      SELECT c.id, c.name, c.custom_name, c.product_type, c.start_date,
             CAST(c.initial_volume_liters AS NUMERIC) AS initial_l,
             CAST(c.current_volume_liters AS NUMERIC) AS current_l,
             c.parent_batch_id, c.reconciliation_status, c.vessel_id,
             c.is_racking_derivative, c.status, c.deleted_at,
             c.estimated_abv, c.actual_abv,
             f.depth + 1 AS depth
      FROM batches c
      INNER JOIN family f ON c.parent_batch_id = f.id
    )
    SELECT f.*, v.name AS vessel_name
    FROM family f
    LEFT JOIN vessels v ON f.vessel_id = v.id
    ORDER BY f.depth, f.start_date
  `));

  const allBatches = descendantsResult.rows as any[];
  const allBatchIds = allBatches.map((b: any) => b.id);

  console.log(`Found ${allBatches.length} batches in family tree:\n`);

  for (const b of allBatches) {
    const indent = "  ".repeat(b.depth);
    const depthLabel = b.depth === 0 ? "ROOT" : `depth=${b.depth}`;
    const deletedTag = b.deleted_at ? " [DELETED]" : "";
    console.log(
      `${indent}[${depthLabel}]${deletedTag} ${b.custom_name || b.name}`
    );
    console.log(
      `${indent}  ID:          ${b.id}`
    );
    console.log(
      `${indent}  Name:        ${b.name}`
    );
    console.log(
      `${indent}  CustomName:  ${b.custom_name || "(none)"}`
    );
    console.log(
      `${indent}  ProductType: ${b.product_type}`
    );
    console.log(
      `${indent}  Status:      ${b.status}`
    );
    console.log(
      `${indent}  StartDate:   ${dateFmt(b.start_date)}`
    );
    console.log(
      `${indent}  Initial:     ${fmt(parseFloat(b.initial_l))}`
    );
    console.log(
      `${indent}  Current:     ${fmt(parseFloat(b.current_l))}`
    );
    console.log(
      `${indent}  ParentID:    ${b.parent_batch_id || "(none)"}`
    );
    console.log(
      `${indent}  ReconStatus: ${b.reconciliation_status}`
    );
    console.log(
      `${indent}  Vessel:      ${b.vessel_name || "(none)"} (${b.vessel_id || "no vessel"})`
    );
    console.log(
      `${indent}  RackingDeriv:${b.is_racking_derivative}`
    );
    console.log(
      `${indent}  EstABV:      ${b.estimated_abv || "(none)"}  ActABV: ${b.actual_abv || "(none)"}`
    );
    if (b.deleted_at) {
      console.log(`${indent}  DeletedAt:   ${dateFmt(b.deleted_at)}`);
    }
    console.log("");
  }

  // Summary table
  console.log("--- Family Summary ---");
  console.log(
    `${"Depth".padEnd(6)} ${"Name".padEnd(45)} ${"Type".padEnd(12)} ${"Status".padEnd(12)} ${"Recon".padEnd(12)} ${"Initial(gal)".padEnd(14)} ${"Current(gal)".padEnd(14)} ${"Deleted?".padEnd(10)}`
  );
  for (const b of allBatches) {
    const name = (b.custom_name || b.name || "").slice(0, 44);
    console.log(
      `${String(b.depth).padEnd(6)} ${name.padEnd(45)} ${(b.product_type || "").padEnd(12)} ${(b.status || "").padEnd(12)} ${(b.reconciliation_status || "").padEnd(12)} ${G(parseFloat(b.initial_l)).padEnd(14)} ${G(parseFloat(b.current_l)).padEnd(14)} ${b.deleted_at ? "YES" : "no"}`
    );
  }

  // Totals
  const activeDescendants = allBatches.filter((b: any) => !b.deleted_at);
  const deletedDescendants = allBatches.filter((b: any) => b.deleted_at);
  const totalInitial = allBatches.reduce(
    (s: number, b: any) => s + parseFloat(b.initial_l),
    0
  );
  const totalCurrent = allBatches.reduce(
    (s: number, b: any) => s + parseFloat(b.current_l),
    0
  );
  const activeInitial = activeDescendants.reduce(
    (s: number, b: any) => s + parseFloat(b.initial_l),
    0
  );
  const activeCurrent = activeDescendants.reduce(
    (s: number, b: any) => s + parseFloat(b.current_l),
    0
  );
  console.log(
    `\nTotal batches: ${allBatches.length} (${activeDescendants.length} active, ${deletedDescendants.length} deleted)`
  );
  console.log(`Total initial (all):    ${fmt(totalInitial)}`);
  console.log(`Total current (all):    ${fmt(totalCurrent)}`);
  console.log(`Active initial:         ${fmt(activeInitial)}`);
  console.log(`Active current:         ${fmt(activeCurrent)}`);

  // ── Build IN clause for all batch IDs ──
  const idList = allBatchIds.map((id: string) => `'${id}'`).join(",");

  // ── 3. BATCH TRANSFERS ──────────────────────────────────────────────────
  console.log("\n\n=== 3. ALL BATCH TRANSFERS INVOLVING FAMILY ===\n");

  const transfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.source_batch_id, bt.destination_batch_id,
           CAST(bt.volume_transferred AS NUMERIC) AS vol,
           CAST(bt.loss AS NUMERIC) AS loss,
           bt.transferred_at, bt.deleted_at, bt.notes,
           sb.name AS src_name, sb.custom_name AS src_custom,
           db2.name AS dst_name, db2.custom_name AS dst_custom
    FROM batch_transfers bt
    LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    LEFT JOIN batches db2 ON bt.destination_batch_id = db2.id
    WHERE bt.source_batch_id IN (${idList})
       OR bt.destination_batch_id IN (${idList})
    ORDER BY bt.transferred_at
  `));

  const transferRows = transfers.rows as any[];
  console.log(`Found ${transferRows.length} transfers:\n`);

  for (const t of transferRows) {
    const vol = parseFloat(t.vol || "0");
    const loss = parseFloat(t.loss || "0");
    const deletedTag = t.deleted_at ? " [DELETED]" : "";
    const srcName = t.src_custom || t.src_name || t.source_batch_id;
    const dstName = t.dst_custom || t.dst_name || t.destination_batch_id;
    const inFamily = (id: string) =>
      allBatchIds.includes(id) ? "(FAMILY)" : "(EXTERNAL)";

    console.log(`Transfer ${t.id}${deletedTag}`);
    console.log(`  Date:    ${dateFmt(t.transferred_at)}`);
    console.log(
      `  From:    ${srcName} ${inFamily(t.source_batch_id)}`
    );
    console.log(
      `  To:      ${dstName} ${inFamily(t.destination_batch_id)}`
    );
    console.log(`  Volume:  ${fmt(vol)}`);
    console.log(`  Loss:    ${fmt(loss)}`);
    console.log(`  Notes:   ${t.notes || "(none)"}`);
    if (t.deleted_at) console.log(`  Deleted: ${dateFmt(t.deleted_at)}`);
    console.log("");
  }

  // ── 4. BATCH MERGE HISTORY ──────────────────────────────────────────────
  console.log("\n\n=== 4. ALL BATCH MERGE HISTORY INVOLVING FAMILY ===\n");

  const merges = await db.execute(sql.raw(`
    SELECT bmh.id, bmh.source_batch_id, bmh.source_press_run_id,
           bmh.source_juice_purchase_item_id, bmh.target_batch_id,
           CAST(bmh.volume_added AS NUMERIC) AS volume_added,
           bmh.merged_at, bmh.deleted_at, bmh.notes,
           bmh.source_type,
           CAST(bmh.source_abv AS NUMERIC) AS source_abv,
           CAST(bmh.resulting_abv AS NUMERIC) AS resulting_abv,
           CAST(bmh.target_volume_before AS NUMERIC) AS vol_before,
           CAST(bmh.target_volume_after AS NUMERIC) AS vol_after,
           sb.name AS src_batch_name, sb.custom_name AS src_batch_custom,
           sb.product_type AS src_batch_type,
           tb.name AS tgt_batch_name, tb.custom_name AS tgt_batch_custom
    FROM batch_merge_history bmh
    LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    LEFT JOIN batches tb ON bmh.target_batch_id = tb.id
    WHERE bmh.source_batch_id IN (${idList})
       OR bmh.target_batch_id IN (${idList})
    ORDER BY bmh.merged_at
  `));

  const mergeRows = merges.rows as any[];
  console.log(`Found ${mergeRows.length} merge records:\n`);

  for (const m of mergeRows) {
    const vol = parseFloat(m.volume_added || "0");
    const deletedTag = m.deleted_at ? " [DELETED]" : "";
    const tgtName = m.tgt_batch_custom || m.tgt_batch_name || m.target_batch_id;
    const inFamily = (id: string | null) =>
      id && allBatchIds.includes(id) ? "(FAMILY)" : "(EXTERNAL)";

    console.log(`Merge ${m.id}${deletedTag}`);
    console.log(`  Date:          ${dateFmt(m.merged_at)}`);
    console.log(`  Source Type:   ${m.source_type}`);

    if (m.source_batch_id) {
      const srcName =
        m.src_batch_custom || m.src_batch_name || m.source_batch_id;
      console.log(
        `  Source Batch:  ${srcName} (${m.src_batch_type || "?"}) ${inFamily(m.source_batch_id)}`
      );
    }
    if (m.source_press_run_id) {
      console.log(`  Source PressRun: ${m.source_press_run_id}`);
    }
    if (m.source_juice_purchase_item_id) {
      console.log(
        `  Source JuicePurchase: ${m.source_juice_purchase_item_id}`
      );
    }

    console.log(
      `  Target Batch:  ${tgtName} ${inFamily(m.target_batch_id)}`
    );
    console.log(`  Volume Added:  ${fmt(vol)}`);
    if (m.vol_before !== null) {
      console.log(
        `  Target Before: ${fmt(parseFloat(m.vol_before || "0"))}`
      );
    }
    if (m.vol_after !== null) {
      console.log(
        `  Target After:  ${fmt(parseFloat(m.vol_after || "0"))}`
      );
    }
    if (m.source_abv !== null) {
      console.log(`  Source ABV:    ${m.source_abv}%`);
    }
    if (m.resulting_abv !== null) {
      console.log(`  Resulting ABV: ${m.resulting_abv}%`);
    }
    console.log(`  Notes:         ${m.notes || "(none)"}`);
    if (m.deleted_at) console.log(`  Deleted:       ${dateFmt(m.deleted_at)}`);
    console.log("");
  }

  // ── 5. BATCH RACKING OPERATIONS ─────────────────────────────────────────
  console.log("\n\n=== 5. ALL RACKING OPERATIONS FOR FAMILY ===\n");

  const rackings = await db.execute(sql.raw(`
    SELECT bro.id, bro.batch_id,
           CAST(bro.volume_before AS NUMERIC) AS vol_before,
           CAST(bro.volume_after AS NUMERIC) AS vol_after,
           CAST(bro.volume_loss AS NUMERIC) AS vol_loss,
           bro.racked_at, bro.notes, bro.deleted_at,
           b.name AS batch_name, b.custom_name AS batch_custom
    FROM batch_racking_operations bro
    JOIN batches b ON bro.batch_id = b.id
    WHERE bro.batch_id IN (${idList})
    ORDER BY bro.racked_at
  `));

  const rackingRows = rackings.rows as any[];
  console.log(`Found ${rackingRows.length} racking operations:\n`);

  for (const r of rackingRows) {
    const before = parseFloat(r.vol_before || "0");
    const after = parseFloat(r.vol_after || "0");
    const loss = parseFloat(r.vol_loss || "0");
    const deletedTag = r.deleted_at ? " [DELETED]" : "";
    const bName = r.batch_custom || r.batch_name;

    console.log(`Racking ${r.id}${deletedTag}`);
    console.log(`  Batch:   ${bName}`);
    console.log(`  Date:    ${dateFmt(r.racked_at)}`);
    console.log(`  Before:  ${fmt(before)}`);
    console.log(`  After:   ${fmt(after)}`);
    console.log(`  Loss:    ${fmt(loss)}`);
    console.log(`  Notes:   ${r.notes || "(none)"}`);
    if (r.deleted_at) console.log(`  Deleted: ${dateFmt(r.deleted_at)}`);
    console.log("");
  }

  // ── 6. BOTTLE RUNS ──────────────────────────────────────────────────────
  console.log("\n\n=== 6. ALL BOTTLE RUNS FOR FAMILY ===\n");

  const bottleRuns = await db.execute(sql.raw(`
    SELECT br.id, br.batch_id,
           br.packaged_at,
           CAST(br.volume_taken_liters AS NUMERIC) AS vol_taken_l,
           CAST(br.loss AS NUMERIC) AS loss,
           br.loss_unit,
           br.units_produced,
           br.voided_at, br.status,
           b.name AS batch_name, b.custom_name AS batch_custom
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.batch_id IN (${idList})
    ORDER BY br.packaged_at
  `));

  const bottleRows = bottleRuns.rows as any[];
  console.log(`Found ${bottleRows.length} bottle runs:\n`);

  for (const br of bottleRows) {
    const volTaken = parseFloat(br.vol_taken_l || "0");
    const loss = parseFloat(br.loss || "0");
    const lossL =
      br.loss_unit === "gal" ? loss * 3.78541 : loss;
    const voidedTag = br.voided_at ? " [VOIDED]" : "";
    const bName = br.batch_custom || br.batch_name;

    console.log(`BottleRun ${br.id}${voidedTag}`);
    console.log(`  Batch:       ${bName}`);
    console.log(`  PackagedAt:  ${dateFmt(br.packaged_at)}`);
    console.log(`  VolTaken:    ${fmt(volTaken)}`);
    console.log(
      `  Loss:        ${loss} ${br.loss_unit || "L"} (= ${fmt(lossL)})`
    );
    console.log(`  UnitsProduced: ${br.units_produced}`);
    console.log(`  Status:      ${br.status}`);
    if (br.voided_at) console.log(`  VoidedAt:    ${dateFmt(br.voided_at)}`);
    console.log("");
  }

  // ── 7. KEG FILLS ───────────────────────────────────────────────────────
  console.log("\n\n=== 7. ALL KEG FILLS FOR FAMILY ===\n");

  const kegFills = await db.execute(sql.raw(`
    SELECT kf.id, kf.batch_id,
           kf.filled_at,
           CAST(kf.volume_taken AS NUMERIC) AS vol_taken,
           kf.volume_taken_unit,
           CAST(kf.loss AS NUMERIC) AS loss,
           kf.loss_unit,
           kf.voided_at, kf.deleted_at,
           kf.distributed_at,
           b.name AS batch_name, b.custom_name AS batch_custom
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.batch_id IN (${idList})
    ORDER BY kf.filled_at
  `));

  const kegRows = kegFills.rows as any[];
  console.log(`Found ${kegRows.length} keg fills:\n`);

  for (const kf of kegRows) {
    const volTaken = parseFloat(kf.vol_taken || "0");
    const volTakenL =
      kf.volume_taken_unit === "gal" ? volTaken * 3.78541 : volTaken;
    const loss = parseFloat(kf.loss || "0");
    const lossL = kf.loss_unit === "gal" ? loss * 3.78541 : loss;
    const voidedTag = kf.voided_at ? " [VOIDED]" : "";
    const deletedTag = kf.deleted_at ? " [DELETED]" : "";
    const bName = kf.batch_custom || kf.batch_name;

    console.log(`KegFill ${kf.id}${voidedTag}${deletedTag}`);
    console.log(`  Batch:        ${bName}`);
    console.log(`  FilledAt:     ${dateFmt(kf.filled_at)}`);
    console.log(
      `  VolTaken:     ${volTaken} ${kf.volume_taken_unit || "L"} (= ${fmt(volTakenL)})`
    );
    console.log(
      `  Loss:         ${loss} ${kf.loss_unit || "L"} (= ${fmt(lossL)})`
    );
    console.log(`  DistributedAt:${dateFmt(kf.distributed_at)}`);
    if (kf.voided_at)
      console.log(`  VoidedAt:     ${dateFmt(kf.voided_at)}`);
    if (kf.deleted_at)
      console.log(`  DeletedAt:    ${dateFmt(kf.deleted_at)}`);
    console.log("");
  }

  // ── 8. BATCH VOLUME ADJUSTMENTS ─────────────────────────────────────────
  console.log("\n\n=== 8. ALL VOLUME ADJUSTMENTS FOR FAMILY ===\n");

  const adjustments = await db.execute(sql.raw(`
    SELECT bva.id, bva.batch_id,
           bva.adjustment_date,
           CAST(bva.adjustment_amount AS NUMERIC) AS adj_amount,
           bva.reason,
           bva.deleted_at,
           CAST(bva.volume_before AS NUMERIC) AS vol_before,
           CAST(bva.volume_after AS NUMERIC) AS vol_after,
           b.name AS batch_name, b.custom_name AS batch_custom
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.batch_id IN (${idList})
    ORDER BY bva.adjustment_date
  `));

  const adjRows = adjustments.rows as any[];
  console.log(`Found ${adjRows.length} volume adjustments:\n`);

  for (const a of adjRows) {
    const amount = parseFloat(a.adj_amount || "0");
    const before = parseFloat(a.vol_before || "0");
    const after = parseFloat(a.vol_after || "0");
    const deletedTag = a.deleted_at ? " [DELETED]" : "";
    const bName = a.batch_custom || a.batch_name;

    console.log(`Adjustment ${a.id}${deletedTag}`);
    console.log(`  Batch:       ${bName}`);
    console.log(`  Date:        ${dateFmt(a.adjustment_date)}`);
    console.log(`  Amount:      ${fmt(amount)}`);
    console.log(`  Before:      ${fmt(before)}`);
    console.log(`  After:       ${fmt(after)}`);
    console.log(`  Reason:      ${a.reason || "(none)"}`);
    if (a.deleted_at) console.log(`  Deleted:     ${dateFmt(a.deleted_at)}`);
    console.log("");
  }

  // ── 9. TIMELINE (all events merged chronologically) ─────────────────────
  console.log("\n\n=== 9. CHRONOLOGICAL TIMELINE ===\n");

  type Event = {
    date: Date;
    type: string;
    detail: string;
  };
  const events: Event[] = [];

  // Batch creation
  for (const b of allBatches) {
    events.push({
      date: new Date(b.start_date),
      type: "BATCH_CREATED",
      detail: `${b.custom_name || b.name} | type=${b.product_type} | init=${fmt(parseFloat(b.initial_l))} | vessel=${b.vessel_name || "none"} | depth=${b.depth}`,
    });
    if (b.deleted_at) {
      events.push({
        date: new Date(b.deleted_at),
        type: "BATCH_DELETED",
        detail: `${b.custom_name || b.name}`,
      });
    }
  }

  // Transfers
  for (const t of transferRows) {
    const vol = parseFloat(t.vol || "0");
    const loss = parseFloat(t.loss || "0");
    const srcName = t.src_custom || t.src_name || "?";
    const dstName = t.dst_custom || t.dst_name || "?";
    const tag = t.deleted_at ? " [DELETED]" : "";
    events.push({
      date: new Date(t.transferred_at),
      type: `TRANSFER${tag}`,
      detail: `${srcName} -> ${dstName} | ${fmt(vol)} | loss=${fmt(loss)} | ${t.notes || ""}`,
    });
  }

  // Merges
  for (const m of mergeRows) {
    const vol = parseFloat(m.volume_added || "0");
    const tgtName = m.tgt_batch_custom || m.tgt_batch_name || "?";
    let srcLabel = "?";
    if (m.source_batch_id) {
      srcLabel = `batch:${m.src_batch_custom || m.src_batch_name || m.source_batch_id} (${m.src_batch_type || "?"})`;
    } else if (m.source_press_run_id) {
      srcLabel = `pressRun:${m.source_press_run_id}`;
    } else if (m.source_juice_purchase_item_id) {
      srcLabel = `juicePurchase:${m.source_juice_purchase_item_id}`;
    }
    const tag = m.deleted_at ? " [DELETED]" : "";
    events.push({
      date: new Date(m.merged_at),
      type: `MERGE${tag}`,
      detail: `${srcLabel} -> ${tgtName} | ${fmt(vol)} | srcABV=${m.source_abv || "?"} | resABV=${m.resulting_abv || ""} | ${m.notes || ""}`,
    });
  }

  // Rackings
  for (const r of rackingRows) {
    const loss = parseFloat(r.vol_loss || "0");
    const bName = r.batch_custom || r.batch_name;
    const tag = r.deleted_at ? " [DELETED]" : "";
    events.push({
      date: new Date(r.racked_at),
      type: `RACKING${tag}`,
      detail: `${bName} | before=${fmt(parseFloat(r.vol_before || "0"))} | after=${fmt(parseFloat(r.vol_after || "0"))} | loss=${fmt(loss)}`,
    });
  }

  // Bottle runs
  for (const br of bottleRows) {
    const volTaken = parseFloat(br.vol_taken_l || "0");
    const bName = br.batch_custom || br.batch_name;
    const tag = br.voided_at ? " [VOIDED]" : "";
    events.push({
      date: new Date(br.packaged_at),
      type: `BOTTLING${tag}`,
      detail: `${bName} | taken=${fmt(volTaken)} | units=${br.units_produced} | status=${br.status}`,
    });
  }

  // Keg fills
  for (const kf of kegRows) {
    const volTaken = parseFloat(kf.vol_taken || "0");
    const volTakenL =
      kf.volume_taken_unit === "gal" ? volTaken * 3.78541 : volTaken;
    const bName = kf.batch_custom || kf.batch_name;
    const tags = [
      kf.voided_at ? "VOIDED" : "",
      kf.deleted_at ? "DELETED" : "",
    ]
      .filter(Boolean)
      .join(",");
    const tagStr = tags ? ` [${tags}]` : "";
    events.push({
      date: new Date(kf.filled_at),
      type: `KEG_FILL${tagStr}`,
      detail: `${bName} | taken=${fmt(volTakenL)} | distributed=${dateFmt(kf.distributed_at)}`,
    });
  }

  // Adjustments
  for (const a of adjRows) {
    const amount = parseFloat(a.adj_amount || "0");
    const bName = a.batch_custom || a.batch_name;
    const tag = a.deleted_at ? " [DELETED]" : "";
    events.push({
      date: new Date(a.adjustment_date),
      type: `ADJUSTMENT${tag}`,
      detail: `${bName} | ${amount >= 0 ? "+" : ""}${fmt(amount)} | reason=${a.reason || ""}`,
    });
  }

  // Sort and print
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const e of events) {
    console.log(
      `${dateFmt(e.date)}  ${e.type.padEnd(22)} ${e.detail}`
    );
  }

  // ── 10. VOLUME BALANCE SUMMARY ──────────────────────────────────────────
  console.log("\n\n=== 10. VOLUME BALANCE SUMMARY ===\n");

  // Active transfers in from external
  const extTransfersIn = transferRows.filter(
    (t: any) =>
      !t.deleted_at &&
      allBatchIds.includes(t.destination_batch_id) &&
      !allBatchIds.includes(t.source_batch_id)
  );
  const extTransInVol = extTransfersIn.reduce(
    (s: number, t: any) => s + parseFloat(t.vol || "0"),
    0
  );

  // Active transfers out to external
  const extTransfersOut = transferRows.filter(
    (t: any) =>
      !t.deleted_at &&
      allBatchIds.includes(t.source_batch_id) &&
      !allBatchIds.includes(t.destination_batch_id)
  );
  const extTransOutVol = extTransfersOut.reduce(
    (s: number, t: any) => s + parseFloat(t.vol || "0"),
    0
  );

  // Active merges in from external
  const extMergesIn = mergeRows.filter(
    (m: any) =>
      !m.deleted_at &&
      allBatchIds.includes(m.target_batch_id) &&
      !allBatchIds.includes(m.source_batch_id)
  );
  const extMergeInVol = extMergesIn.reduce(
    (s: number, m: any) => s + parseFloat(m.volume_added || "0"),
    0
  );

  // Active racking losses
  const activeRackingLoss = rackingRows
    .filter((r: any) => !r.deleted_at)
    .reduce((s: number, r: any) => s + parseFloat(r.vol_loss || "0"), 0);

  // Active bottle runs
  const activeBottling = bottleRows
    .filter((br: any) => !br.voided_at)
    .reduce(
      (s: number, br: any) => s + parseFloat(br.vol_taken_l || "0"),
      0
    );

  // Active keg fills
  const activeKegVol = kegRows
    .filter((kf: any) => !kf.voided_at && !kf.deleted_at)
    .reduce((s: number, kf: any) => {
      const v = parseFloat(kf.vol_taken || "0");
      return s + (kf.volume_taken_unit === "gal" ? v * 3.78541 : v);
    }, 0);

  // Active adjustments
  const activeAdjVol = adjRows
    .filter((a: any) => !a.deleted_at)
    .reduce(
      (s: number, a: any) => s + parseFloat(a.adj_amount || "0"),
      0
    );

  // Root initial
  const rootInitial = parseFloat(parents[0].initial_l);

  console.log(`Root initial volume:       ${fmt(rootInitial)}`);
  console.log(`External merges IN:        ${fmt(extMergeInVol)}`);
  console.log(`External transfers IN:     ${fmt(extTransInVol)}`);
  console.log(`External transfers OUT:    ${fmt(extTransOutVol)}`);
  console.log(`Racking losses:            ${fmt(activeRackingLoss)}`);
  console.log(`Bottling (taken):          ${fmt(activeBottling)}`);
  console.log(`Keg fills (taken):         ${fmt(activeKegVol)}`);
  console.log(`Adjustments (net):         ${fmt(activeAdjVol)}`);
  console.log("");

  const expectedCurrent =
    rootInitial +
    extMergeInVol +
    extTransInVol -
    extTransOutVol -
    activeRackingLoss -
    activeBottling -
    activeKegVol +
    activeAdjVol;
  console.log(`Expected current (root + in - out): ${fmt(expectedCurrent)}`);
  console.log(`Actual sum current (active):        ${fmt(activeCurrent)}`);
  console.log(
    `Delta:                              ${fmt(activeCurrent - expectedCurrent)}`
  );

  console.log("\n=== INVESTIGATION COMPLETE ===");
  process.exit(0);
}

function printBatch(b: any, depth: number) {
  const indent = "  ".repeat(depth);
  console.log(`${indent}Batch: ${b.custom_name || b.name}`);
  console.log(`${indent}  ID:          ${b.id}`);
  console.log(`${indent}  Name:        ${b.name}`);
  console.log(`${indent}  CustomName:  ${b.custom_name || "(none)"}`);
  console.log(`${indent}  ProductType: ${b.product_type}`);
  console.log(`${indent}  Status:      ${b.status}`);
  console.log(`${indent}  StartDate:   ${dateFmt(b.start_date)}`);
  console.log(
    `${indent}  Initial:     ${fmt(parseFloat(b.initial_l))}`
  );
  console.log(
    `${indent}  Current:     ${fmt(parseFloat(b.current_l))}`
  );
  console.log(`${indent}  ParentID:    ${b.parent_batch_id || "(none)"}`);
  console.log(`${indent}  ReconStatus: ${b.reconciliation_status}`);
  console.log(
    `${indent}  Vessel:      ${b.vessel_name || "(none)"} (${b.vessel_id || "no vessel"})`
  );
  console.log(`${indent}  RackingDeriv:${b.is_racking_derivative}`);
  console.log(
    `${indent}  EstABV:      ${b.estimated_abv || "(none)"}  ActABV: ${b.actual_abv || "(none)"}`
  );
  if (b.deleted_at) {
    console.log(`${indent}  DeletedAt:   ${dateFmt(b.deleted_at)}`);
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
