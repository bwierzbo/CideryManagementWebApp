import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;
const G = (l: number) => (l * GAL).toFixed(2);

async function investigateBatch(id: string, label: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${label}`);
  console.log("=".repeat(70));

  const batch = await db.execute(
    sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type, b.status,
           CAST(b.initial_volume_liters AS NUMERIC) as init_l,
           CAST(b.current_volume_liters AS NUMERIC) as cur_l,
           b.reconciliation_status, b.vessel_id, b.parent_batch_id,
           b.is_racking_derivative, b.start_date::text,
           v.name as vessel_name
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id = '${id}'
  `)
  );
  const b = (batch.rows[0] as any) || {};
  console.log(`  Name: ${b.custom_name || b.batch_number}`);
  console.log(`  Type: ${b.product_type}, Status: ${b.status}, Recon: ${b.reconciliation_status}`);
  console.log(`  Vessel: ${b.vessel_name || "NONE"}`);
  console.log(`  Initial: ${G(parseFloat(b.init_l || "0"))} gal (${parseFloat(b.init_l || "0").toFixed(1)}L)`);
  console.log(`  Current: ${G(parseFloat(b.cur_l || "0"))} gal (${parseFloat(b.cur_l || "0").toFixed(1)}L)`);

  // Transfers IN
  const tIn = await db.execute(
    sql.raw(`
    SELECT bt.volume_transferred::numeric as vol, bt.loss::numeric as loss,
           bt.transferred_at::text, bt.deleted_at,
           bs.custom_name as src_name, bs.batch_number as src_batch,
           dv.name as dest_vessel
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id = bs.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE bt.destination_batch_id = '${id}' ORDER BY bt.transferred_at
  `)
  );
  if ((tIn.rows as any[]).length > 0) {
    console.log(`\n  TRANSFERS IN:`);
    for (const t of tIn.rows as any[]) {
      const del = t.deleted_at ? " [DELETED]" : "";
      console.log(`    ${t.transferred_at} from "${t.src_name || t.src_batch}" → ${t.dest_vessel || "?"}, vol=${G(parseFloat(t.vol))} gal, loss=${G(parseFloat(t.loss || "0"))} gal${del}`);
    }
  }

  // Transfers OUT
  const tOut = await db.execute(
    sql.raw(`
    SELECT bt.volume_transferred::numeric as vol, bt.loss::numeric as loss,
           bt.transferred_at::text, bt.deleted_at,
           bd.custom_name as dest_name, bd.batch_number as dest_batch,
           dv.name as dest_vessel
    FROM batch_transfers bt
    JOIN batches bd ON bt.destination_batch_id = bd.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE bt.source_batch_id = '${id}' ORDER BY bt.transferred_at
  `)
  );
  if ((tOut.rows as any[]).length > 0) {
    console.log(`\n  TRANSFERS OUT:`);
    for (const t of tOut.rows as any[]) {
      const del = t.deleted_at ? " [DELETED]" : "";
      console.log(`    ${t.transferred_at} to "${t.dest_name || t.dest_batch}" (${t.dest_vessel || "?"}), vol=${G(parseFloat(t.vol))} gal, loss=${G(parseFloat(t.loss || "0"))} gal${del}`);
    }
  }

  // Merges IN
  const mIn = await db.execute(
    sql.raw(`
    SELECT bmh.volume_added::numeric as vol, bmh.merged_at::text,
           bmh.source_batch_id, bmh.source_press_run_id, bmh.source_juice_purchase_item_id,
           bmh.deleted_at,
           COALESCE(bs.custom_name, pr.press_run_name, 'juice purchase') as src_name
    FROM batch_merge_history bmh
    LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
    LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
    WHERE bmh.target_batch_id = '${id}' ORDER BY bmh.merged_at
  `)
  );
  if ((mIn.rows as any[]).length > 0) {
    console.log(`\n  MERGES IN:`);
    for (const m of mIn.rows as any[]) {
      const del = m.deleted_at ? " [DELETED]" : "";
      console.log(`    ${m.merged_at} from "${m.src_name}", vol=${G(parseFloat(m.vol))} gal${del}`);
    }
  }

  // Bottle runs (including voided)
  const bot = await db.execute(
    sql.raw(`
    SELECT volume_taken_liters::numeric as vol, loss::numeric as loss_val, loss_unit,
           units_produced, packaged_at::text, voided_at, status
    FROM bottle_runs WHERE batch_id = '${id}' ORDER BY packaged_at
  `)
  );
  if ((bot.rows as any[]).length > 0) {
    console.log(`\n  BOTTLE RUNS:`);
    for (const r of bot.rows as any[]) {
      const v = r.voided_at ? " [VOIDED]" : "";
      console.log(`    ${r.packaged_at} taken=${G(parseFloat(r.vol))} gal, loss=${parseFloat(r.loss_val || "0").toFixed(1)}${r.loss_unit || "L"}, units=${r.units_produced}, status=${r.status}${v}`);
    }
  }

  // Keg fills (including voided/deleted)
  const keg = await db.execute(
    sql.raw(`
    SELECT volume_taken::numeric as vol, volume_taken_unit, loss::numeric as loss_val, loss_unit,
           filled_at::text, distributed_at::text as dist, voided_at, deleted_at, status
    FROM keg_fills WHERE batch_id = '${id}' ORDER BY filled_at
  `)
  );
  if ((keg.rows as any[]).length > 0) {
    console.log(`\n  KEG FILLS:`);
    for (const r of keg.rows as any[]) {
      const v = r.voided_at ? " [VOIDED]" : "";
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    ${r.filled_at} taken=${parseFloat(r.vol).toFixed(1)} ${r.volume_taken_unit}, dist=${r.dist || "N/A"}, status=${r.status}${v}${d}`);
    }
  }

  // Racking
  const rack = await db.execute(
    sql.raw(`
    SELECT ro.volume_loss::numeric as loss, ro.racked_at::text, ro.notes, ro.deleted_at,
           sv.name as src_v, dv.name as dst_v
    FROM batch_racking_operations ro
    LEFT JOIN vessels sv ON ro.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON ro.destination_vessel_id = dv.id
    WHERE ro.batch_id = '${id}' ORDER BY ro.racked_at
  `)
  );
  if ((rack.rows as any[]).length > 0) {
    console.log(`\n  RACKING:`);
    for (const r of rack.rows as any[]) {
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    ${r.racked_at} loss=${G(parseFloat(r.loss))} gal, ${r.src_v} → ${r.dst_v} ${r.notes || ""}${d}`);
    }
  }

  // Filter
  const filt = await db.execute(
    sql.raw(`
    SELECT volume_loss::numeric as loss, filtered_at::text, filter_type, deleted_at
    FROM batch_filter_operations WHERE batch_id = '${id}' ORDER BY filtered_at
  `)
  );
  if ((filt.rows as any[]).length > 0) {
    console.log(`\n  FILTER OPS:`);
    for (const r of filt.rows as any[]) {
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    ${r.filtered_at} loss=${G(parseFloat(r.loss))} gal, type=${r.filter_type}${d}`);
    }
  }

  // Adjustments
  const adj = await db.execute(
    sql.raw(`
    SELECT adjustment_amount::numeric as amt, adjustment_type, reason,
           adjustment_date::text, deleted_at
    FROM batch_volume_adjustments WHERE batch_id = '${id}' ORDER BY adjustment_date
  `)
  );
  if ((adj.rows as any[]).length > 0) {
    console.log(`\n  ADJUSTMENTS:`);
    for (const r of adj.rows as any[]) {
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    ${r.adjustment_date} amt=${G(parseFloat(r.amt))} gal (${parseFloat(r.amt).toFixed(1)}L), type=${r.adjustment_type}, "${r.reason}"${d}`);
    }
  }

  // Distillation
  const dist = await db.execute(
    sql.raw(`
    SELECT source_volume_liters::numeric as vol, sent_at::text, status, deleted_at,
           received_volume_liters::numeric as brandy_vol, received_at::text
    FROM distillation_records WHERE source_batch_id = '${id}' ORDER BY sent_at
  `)
  );
  if ((dist.rows as any[]).length > 0) {
    console.log(`\n  DISTILLATION:`);
    for (const r of dist.rows as any[]) {
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    sent=${r.sent_at} vol=${G(parseFloat(r.vol))} gal, brandy=${G(parseFloat(r.brandy_vol || "0"))} gal, rcvd=${r.received_at || "N/A"}, status=${r.status}${d}`);
    }
  }

  // Children
  const children = await db.execute(
    sql.raw(`
    SELECT id, custom_name, batch_number, product_type,
           initial_volume_liters::numeric as init_l, current_volume_liters::numeric as cur_l,
           reconciliation_status, is_racking_derivative, deleted_at
    FROM batches WHERE parent_batch_id = '${id}' ORDER BY start_date
  `)
  );
  if ((children.rows as any[]).length > 0) {
    console.log(`\n  CHILDREN:`);
    for (const r of children.rows as any[]) {
      const d = r.deleted_at ? " [DELETED]" : "";
      console.log(`    ${r.custom_name || r.batch_number} (${r.product_type}) init=${G(parseFloat(r.init_l || "0"))} cur=${G(parseFloat(r.cur_l || "0"))} recon=${r.reconciliation_status} racking=${r.is_racking_derivative}${d}`);
    }
  }
}

async function findVessels(pattern: string) {
  const vessels = await db.execute(
    sql.raw(`
    SELECT v.id, v.name, v.capacity_liters::numeric as cap, v.is_barrel, v.status, v.material,
           (SELECT COUNT(*) FROM batches b WHERE b.vessel_id = v.id AND b.deleted_at IS NULL) as batch_count,
           (SELECT string_agg(COALESCE(b.custom_name, b.batch_number) || ' [' || COALESCE(b.product_type::text,'?') || ', cur=' || COALESCE(CAST(b.current_volume_liters AS text),'0') || 'L, ' || COALESCE(b.reconciliation_status,'pending') || ']', '; ')
            FROM batches b WHERE b.vessel_id = v.id AND b.deleted_at IS NULL) as batches
    FROM vessels v
    WHERE v.name ILIKE '${pattern}'
    ORDER BY v.name
  `)
  );
  for (const v of vessels.rows as any[]) {
    console.log(`  ${v.name} (cap=${G(parseFloat(v.cap || "0"))} gal, barrel=${v.is_barrel}, ${v.material || "?"}, ${v.status})`);
    console.log(`    Batches: ${v.batches || "NONE"}`);
  }
  return vessels.rows as any[];
}

async function main() {
  console.log("### VESSEL SEARCH: Apple Brandy Barrels ###");
  await findVessels("%10G%");
  await findVessels("%10-gal%");
  await findVessels("%10 Barrel%");

  console.log("\n### VESSEL SEARCH: Salish/Pommeau Barrels ###");
  await findVessels("%225%");
  await findVessels("%60G%");
  await findVessels("%Barrel-225%");

  // Investigate each batch
  await investigateBatch("cf5b8a7b-33b4-407c-9011-1e4a2068d1da", "APPLE BRANDY [excluded]");
  await investigateBatch("ef9febe3-29be-4b71-a3bb-6421c4127654", "RASPBERRY BLACKBERRY [pending]");
  await investigateBatch("91bb8d67-5b56-406e-889e-1bf10638d99b", "SALISH POMMEAU [pending]");
  await investigateBatch("4ac91b9d-562a-4e8e-85f8-1b6dd3ce3ffa", "PERRY PEAR [verified]");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
