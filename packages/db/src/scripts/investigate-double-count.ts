import { db } from "..";
import { sql } from "drizzle-orm";

const G = (l: number) => (l / 3.78541).toFixed(2);
const num = (v: any) => parseFloat(v || "0") || 0;

const BASE_CIDER = "298c081d-72bd-403a-8a28-bc62fef2716a";
const BATCH_RB = "c2436e1d-2e14-4d04-a68a-2258fcd64b16";
const SALISH = "0639e21d-63c8-4b5d-94b4-bdd7823dee49";

async function main() {
  // === BASE CIDER: How was 975L composed? ===
  console.log("=== BASE CIDER (298c081d) MERGE HISTORY ===");
  const bcMerges = await db.execute(sql.raw(`
    SELECT m.source_press_run_id, m.source_batch_id, m.source_juice_purchase_item_id,
           m.source_type, CAST(m.volume_added AS float) as vol, m.merged_at, m.deleted_at,
           pr.press_run_name, sb.custom_name as src_name
    FROM batch_merge_history m
    LEFT JOIN press_runs pr ON m.source_press_run_id = pr.id
    LEFT JOIN batches sb ON m.source_batch_id = sb.id
    WHERE m.target_batch_id = '${BASE_CIDER}'
    ORDER BY m.merged_at
  `));
  let totalActive = 0;
  for (const m of bcMerges.rows as any[]) {
    const del = m.deleted_at ? " [DELETED]" : "";
    const src =
      m.press_run_name ||
      m.src_name ||
      m.source_juice_purchase_item_id ||
      "unknown";
    if (m.deleted_at === null) totalActive += num(m.vol);
    console.log(
      `  ${num(m.vol).toFixed(1)}L (${G(num(m.vol))} gal) from ${src} type=${m.source_type} at=${m.merged_at}${del}`,
    );
  }
  console.log(`  Total active merges: ${totalActive.toFixed(1)}L`);
  console.log(`  Base Cider initial: 975.0L`);
  console.log(
    `  Press run contribution to initial = ${(975 - totalActive).toFixed(1)}L`,
  );

  // === BASE CIDER: transfers IN ===
  console.log("\n=== BASE CIDER TRANSFERS IN ===");
  const bcXfer = await db.execute(sql.raw(`
    SELECT CAST(bt.volume_transferred AS float) as vol, bt.transferred_at, bt.deleted_at,
           b.custom_name as src_name, b.batch_number as src_bn
    FROM batch_transfers bt
    LEFT JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.destination_batch_id = '${BASE_CIDER}'
    ORDER BY bt.transferred_at
  `));
  if ((bcXfer.rows as any[]).length === 0) console.log("  (none)");
  for (const x of bcXfer.rows as any[]) {
    const del = x.deleted_at ? " [DELETED]" : "";
    console.log(
      `  ${num(x.vol).toFixed(1)}L from ${x.src_name || x.src_bn} at ${x.transferred_at}${del}`,
    );
  }

  // === Check: do RB and Base Cider share the same press run merges? ===
  console.log("\n=== SHARED PRESS RUNS: RB vs BASE CIDER ===");
  const rbMerges = await db.execute(sql.raw(`
    SELECT m.source_press_run_id, CAST(m.volume_added AS float) as vol, m.merged_at, m.deleted_at,
           pr.press_run_name
    FROM batch_merge_history m
    LEFT JOIN press_runs pr ON m.source_press_run_id = pr.id
    WHERE m.target_batch_id = '${BATCH_RB}'
    ORDER BY m.merged_at
  `));
  console.log("  RB merges from press runs:");
  for (const m of rbMerges.rows as any[]) {
    const del = m.deleted_at ? " [DELETED]" : "";
    console.log(
      `    ${num(m.vol).toFixed(1)}L from ${m.press_run_name || "?"} (${(m.source_press_run_id || "").slice(0, 8)})${del}`,
    );
  }

  console.log("  Base Cider merges from press runs:");
  for (const m of bcMerges.rows as any[]) {
    if (m.source_press_run_id) {
      const del = m.deleted_at ? " [DELETED]" : "";
      console.log(
        `    ${num(m.vol).toFixed(1)}L from ${m.press_run_name || "?"} (${(m.source_press_run_id || "").slice(0, 8)})${del}`,
      );
    }
  }

  // === RB: SBD opening breakdown ===
  console.log("\n=== RB SBD AT OPENING (2024-12-31) ===");
  const rbBatch = await db.execute(sql.raw(`
    SELECT CAST(initial_volume_liters AS float) as init_l, parent_batch_id
    FROM batches WHERE id = '${BATCH_RB}'
  `));
  const rbInfo = (rbBatch.rows as any[])[0];
  // transfersIn
  const rbTiAll = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as total
    FROM batch_transfers WHERE destination_batch_id = '${BATCH_RB}' AND deleted_at IS NULL
  `));
  const rbTiAllVal = num((rbTiAll.rows as any[])[0].total);
  const isTC = rbInfo.parent_batch_id && rbTiAllVal >= num(rbInfo.init_l) * 0.9;
  const effInit = isTC ? 0 : num(rbInfo.init_l);
  console.log(
    `  init=${num(rbInfo.init_l).toFixed(1)}L  parent=${rbInfo.parent_batch_id || "NULL"}  tiAll=${rbTiAllVal.toFixed(1)}L  isTC=${isTC}  effInit=${effInit.toFixed(1)}L`,
  );

  // pre-opening transfers
  const rbTiPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol
    FROM batch_transfers WHERE destination_batch_id = '${BATCH_RB}' AND deleted_at IS NULL AND transferred_at < '2025-01-01'
  `));
  const rbToPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) as vol,
           COALESCE(SUM(CAST(COALESCE(loss,'0') AS float)), 0) as loss
    FROM batch_transfers WHERE source_batch_id = '${BATCH_RB}' AND deleted_at IS NULL AND transferred_at < '2025-01-01'
  `));
  const rbMiPre = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_added AS float)), 0) as vol
    FROM batch_merge_history WHERE target_batch_id = '${BATCH_RB}' AND deleted_at IS NULL AND merged_at < '2025-01-01'
  `));
  const rbAdj = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(adjustment_amount AS float)), 0) as vol
    FROM batch_volume_adjustments WHERE batch_id = '${BATCH_RB}' AND deleted_at IS NULL AND adjustment_date < '2025-01-01'
  `));
  const rbBtl = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken_liters AS float)), 0) as vol
    FROM bottle_runs WHERE batch_id = '${BATCH_RB}' AND voided_at IS NULL AND packaged_at < '2025-01-01'
  `));
  const rbKeg = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(volume_taken AS float)), 0) as vol
    FROM keg_fills WHERE batch_id = '${BATCH_RB}' AND voided_at IS NULL AND deleted_at IS NULL AND filled_at < '2025-01-01'
  `));

  const tiPre = num((rbTiPre.rows as any[])[0].vol);
  const toPre = num((rbToPre.rows as any[])[0].vol);
  const toLoss = num((rbToPre.rows as any[])[0].loss);
  const miPre = num((rbMiPre.rows as any[])[0].vol);
  const adjPre = num((rbAdj.rows as any[])[0].vol);
  const btlPre = num((rbBtl.rows as any[])[0].vol);
  const kegPre = num((rbKeg.rows as any[])[0].vol);

  const raw =
    effInit + tiPre - toPre - toLoss + miPre + adjPre - btlPre - kegPre;
  const clamped = Math.max(0, raw);
  console.log(
    `  +xferIn=${tiPre.toFixed(1)}  -xferOut=${toPre.toFixed(1)}  -xferLoss=${toLoss.toFixed(1)}`,
  );
  console.log(
    `  +mergesIn=${miPre.toFixed(1)}  +adj=${adjPre.toFixed(1)}  -btl=${btlPre.toFixed(1)}  -keg=${kegPre.toFixed(1)}`,
  );
  console.log(
    `  RAW=${raw.toFixed(1)}L  CLAMPED=${clamped.toFixed(1)}L = ${G(clamped)} gal`,
  );

  // === SALISH: transfers IN ===
  console.log("\n=== SALISH TRANSFERS IN (incl deleted) ===");
  const salXfer = await db.execute(sql.raw(`
    SELECT CAST(bt.volume_transferred AS float) as vol, bt.transferred_at, bt.deleted_at,
           b.custom_name as src_name, b.batch_number as src_bn, b.product_type as src_type
    FROM batch_transfers bt
    LEFT JOIN batches b ON bt.source_batch_id = b.id
    WHERE bt.destination_batch_id = '${SALISH}'
    ORDER BY bt.transferred_at
  `));
  let salActiveIn = 0;
  for (const t of salXfer.rows as any[]) {
    const del = t.deleted_at ? " [DELETED]" : " [ACTIVE]";
    if (t.deleted_at === null) salActiveIn += num(t.vol);
    console.log(
      `  ${num(t.vol).toFixed(1)}L from ${t.src_name || t.src_bn} (${t.src_type || "?"}) at ${t.transferred_at}${del}`,
    );
  }
  console.log(`  Total ACTIVE transfers in: ${salActiveIn.toFixed(1)}L`);

  // === SALISH: merges IN ===
  console.log("\n=== SALISH MERGES IN (incl deleted) ===");
  const salMerges = await db.execute(sql.raw(`
    SELECT m.source_press_run_id, m.source_batch_id, m.source_juice_purchase_item_id,
           m.source_type, CAST(m.volume_added AS float) as vol, m.merged_at, m.deleted_at,
           pr.press_run_name, sb.custom_name as src_name
    FROM batch_merge_history m
    LEFT JOIN press_runs pr ON m.source_press_run_id = pr.id
    LEFT JOIN batches sb ON m.source_batch_id = sb.id
    WHERE m.target_batch_id = '${SALISH}'
    ORDER BY m.merged_at
  `));
  for (const m of salMerges.rows as any[]) {
    const del = m.deleted_at ? " [DELETED]" : " [ACTIVE]";
    const src =
      m.press_run_name || m.src_name || "juice_purchase:" + m.source_juice_purchase_item_id;
    console.log(
      `  ${num(m.vol).toFixed(1)}L from ${src} type=${m.source_type} at=${m.merged_at}${del}`,
    );
  }

  // === SALISH: origin press run details ===
  console.log("\n=== SALISH ORIGIN PRESS RUN ===");
  const salPr = await db.execute(sql.raw(`
    SELECT b.origin_press_run_id, pr.press_run_name,
           CAST(pr.total_juice_volume_liters AS float) as juice_l,
           pr.date_completed
    FROM batches b
    LEFT JOIN press_runs pr ON b.origin_press_run_id = pr.id
    WHERE b.id = '${SALISH}'
  `));
  const sp = (salPr.rows as any[])[0];
  console.log(`  Press run: ${sp?.press_run_name} | juice: ${num(sp?.juice_l).toFixed(1)}L | date: ${sp?.date_completed}`);

  console.log("\n=== SALISH CONCLUSION ===");
  console.log(`  initial = 225L`);
  console.log(
    `  active transfers in = ${salActiveIn.toFixed(1)}L (brandy/blend)`,
  );
  console.log(
    `  origin press run juice = ${num(sp?.juice_l).toFixed(1)}L`,
  );
  console.log(
    `  If 225L = press_juice(${num(sp?.juice_l).toFixed(0)}L?) + brandy/blend(${salActiveIn.toFixed(0)}L):`,
  );
  console.log(
    `    That would mean initial was inflated by ${salActiveIn.toFixed(0)}L`,
  );
  const correctedInit = 225 - salActiveIn;
  const correctedParent = correctedInit + salActiveIn - 206.1;
  console.log(
    `    Correct initial = ${correctedInit.toFixed(1)}L`,
  );
  console.log(
    `    Parent SBD = ${correctedInit.toFixed(1)} + ${salActiveIn.toFixed(1)} - 206.1 = ${correctedParent.toFixed(1)}L (${G(correctedParent)} gal)`,
  );
  console.log(
    `    Total pommeau = ${G(correctedParent + 18.9 + 187.1)} gal (should match ~60 configured)`,
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
