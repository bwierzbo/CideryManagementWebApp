import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  // Step 1: Get all positive correction adjustments (the ones we want to replace with transfers)
  console.log("=== POSITIVE CORRECTION ADJUSTMENTS TO FIX ===\n");
  const adjRows = await db.execute(
    sql.raw(`
    SELECT bva.id as adj_id, bva.batch_id as dest_batch_id,
           bva.adjustment_amount::numeric as amt,
           bva.adjustment_type, bva.reason, bva.adjustment_date::text,
           b.custom_name as dest_name, b.batch_number as dest_batch_number,
           b.vessel_id as dest_vessel_id, v.name as dest_vessel_name
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_amount::numeric > 0
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
    ORDER BY bva.adjustment_date
  `)
  );

  for (const r of adjRows.rows as any[]) {
    console.log(`ADJ ${(r.adj_id as string).slice(0, 8)}: +${(parseFloat(r.amt) * GAL).toFixed(2)} gal → "${r.dest_name}" (${r.dest_vessel_name || "no vessel"})`);
    console.log(`  Date: ${r.adjustment_date}, Type: ${r.adjustment_type}`);
    console.log(`  Reason: "${r.reason}"`);
    console.log(`  Dest batch: ${r.dest_batch_id}`);
    console.log();
  }

  // Step 2: Find deleted batches that could be the sources
  console.log("\n=== DELETED BATCHES (potential sources) ===\n");
  const deleted = await db.execute(
    sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l,
           CAST(b.current_volume_liters AS NUMERIC) as cur_l,
           b.deleted_at::text, b.reconciliation_status,
           b.vessel_id, v.name as vessel_name,
           b.start_date::text, b.parent_batch_id
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NOT NULL
      AND COALESCE(b.product_type, 'cider') != 'juice'
    ORDER BY b.deleted_at
  `)
  );

  for (const r of deleted.rows as any[]) {
    const init = parseFloat(r.init_l || "0");
    const cur = parseFloat(r.cur_l || "0");
    console.log(`"${r.custom_name || r.batch_number}" [${r.product_type}]`);
    console.log(`  ID: ${r.id}`);
    console.log(`  Start: ${r.start_date}, Deleted: ${r.deleted_at}`);
    console.log(`  Init: ${(init * GAL).toFixed(1)} gal (${init.toFixed(1)}L), Current: ${(cur * GAL).toFixed(1)} gal (${cur.toFixed(1)}L)`);
    console.log(`  Vessel: ${r.vessel_name || "NONE"}, Recon: ${r.reconciliation_status}`);
    console.log(`  ParentBatch: ${r.parent_batch_id || "NONE"}`);

    // Check transfers from this deleted batch
    const xfers = await db.execute(
      sql.raw(`
      SELECT bt.volume_transferred::numeric as vol, bt.loss::numeric as loss,
             bt.transferred_at::text, bt.deleted_at,
             bd.custom_name as dest_name, bd.batch_number as dest_batch_number,
             bd.id as dest_id
      FROM batch_transfers bt
      JOIN batches bd ON bt.destination_batch_id = bd.id
      WHERE bt.source_batch_id = '${r.id}'
      ORDER BY bt.transferred_at
    `)
    );
    if ((xfers.rows as any[]).length > 0) {
      console.log("  TRANSFERS OUT:");
      for (const x of xfers.rows as any[]) {
        const del = x.deleted_at ? " [DELETED]" : "";
        console.log(`    → "${x.dest_name || x.dest_batch_number}" ${(parseFloat(x.vol) * GAL).toFixed(1)} gal, ${x.transferred_at}${del}`);
      }
    }

    // Check transfers TO this deleted batch
    const xfersIn = await db.execute(
      sql.raw(`
      SELECT bt.volume_transferred::numeric as vol,
             bt.transferred_at::text, bt.deleted_at,
             bs.custom_name as src_name, bs.batch_number as src_batch_number
      FROM batch_transfers bt
      JOIN batches bs ON bt.source_batch_id = bs.id
      WHERE bt.destination_batch_id = '${r.id}'
      ORDER BY bt.transferred_at
    `)
    );
    if ((xfersIn.rows as any[]).length > 0) {
      console.log("  TRANSFERS IN:");
      for (const x of xfersIn.rows as any[]) {
        const del = x.deleted_at ? " [DELETED]" : "";
        console.log(`    ← "${x.src_name || x.src_batch_number}" ${(parseFloat(x.vol) * GAL).toFixed(1)} gal, ${x.transferred_at}${del}`);
      }
    }

    // Check merges
    const merges = await db.execute(
      sql.raw(`
      SELECT bmh.volume_added::numeric as vol, bmh.merged_at::text, bmh.deleted_at,
             COALESCE(bs.custom_name, pr.press_run_name, 'juice purchase') as src_name
      FROM batch_merge_history bmh
      LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
      LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
      WHERE bmh.target_batch_id = '${r.id}'
    `)
    );
    if ((merges.rows as any[]).length > 0) {
      console.log("  MERGES IN:");
      for (const m of merges.rows as any[]) {
        const del = m.deleted_at ? " [DELETED]" : "";
        console.log(`    ← "${m.src_name}" ${(parseFloat(m.vol) * GAL).toFixed(1)} gal, ${m.merged_at}${del}`);
      }
    }

    // Check adjustments on this deleted batch
    const adjs = await db.execute(
      sql.raw(`
      SELECT adjustment_amount::numeric as amt, adjustment_type, reason,
             adjustment_date::text, deleted_at
      FROM batch_volume_adjustments
      WHERE batch_id = '${r.id}'
      ORDER BY adjustment_date
    `)
    );
    if ((adjs.rows as any[]).length > 0) {
      console.log("  ADJUSTMENTS:");
      for (const a of adjs.rows as any[]) {
        const del = a.deleted_at ? " [DELETED]" : "";
        console.log(`    ${(parseFloat(a.amt) * GAL).toFixed(1)} gal, ${a.adjustment_type}, "${a.reason}", ${a.adjustment_date}${del}`);
      }
    }

    console.log();
  }

  // Step 3: For the Perry #1 and Apple Brandy adjustments, show context
  console.log("\n=== NON-RECLASSIFICATION ADJUSTMENTS ===\n");
  console.log("Perry #1: +5.00 gal — reconciliation fix for outflow > inflow");
  console.log("Apple Brandy #2: +1.61 gal — inter-barrel top-up (our fix from earlier)");
  console.log("These are NOT from deleted batches and require different handling.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
