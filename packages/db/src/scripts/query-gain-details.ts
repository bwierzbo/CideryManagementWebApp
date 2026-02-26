import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // === BARREL 1 BLEND ===
  const b1 = await db.execute(sql.raw(`
    SELECT b.id, b.name, round(b.initial_volume_liters::numeric, 2) as initial_l,
      round(b.current_volume_liters::numeric, 2) as current_l
    FROM batches b WHERE b.name LIKE '2025-09-21_120 Barrel 1%'
  `));
  console.log("=== BARREL 1 BLEND ===");
  for (const r of b1.rows) {
    console.log("Name:", r.name, "| Init:", r.initial_l, "| Cur:", r.current_l, "| ID:", r.id);
    const id = r.id;

    const xfIn = await db.execute(sql.raw(`SELECT round(volume_transferred::numeric, 2) as vol, transferred_at::date as dt, source_batch_id as src FROM batch_transfers WHERE destination_batch_id = '${id}' AND deleted_at IS NULL ORDER BY transferred_at`));
    for (const o of xfIn.rows) console.log("  transfer_in:", o.vol, "L |", o.dt, "| from", o.src);

    const xfOut = await db.execute(sql.raw(`SELECT round(volume_transferred::numeric, 2) as vol, transferred_at::date as dt, destination_batch_id as dst FROM batch_transfers WHERE source_batch_id = '${id}' AND deleted_at IS NULL ORDER BY transferred_at`));
    for (const o of xfOut.rows) console.log("  transfer_out:", o.vol, "L |", o.dt, "| to", o.dst);

    const rack = await db.execute(sql.raw(`SELECT round(volume_loss::numeric, 2) as vol, racked_at::date as dt, notes FROM batch_racking_operations WHERE batch_id = '${id}' AND deleted_at IS NULL ORDER BY racked_at`));
    for (const o of rack.rows) console.log("  racking_loss:", o.vol, "L |", o.dt, "|", o.notes);

    const adj = await db.execute(sql.raw(`SELECT round(adjustment_amount::numeric, 2) as vol, adjustment_date::date as dt, reason, adjustment_type FROM batch_volume_adjustments WHERE batch_id = '${id}' AND deleted_at IS NULL ORDER BY adjustment_date`));
    for (const o of adj.rows) console.log("  adjustment:", o.vol, "L |", o.dt, "|", o.reason, "|", o.adjustment_type);

    const btl = await db.execute(sql.raw(`SELECT round(volume_taken_liters::numeric, 2) as vol, packaged_at::date as dt, round(CASE WHEN loss_unit = 'gal' THEN loss::numeric * 3.78541 ELSE loss::numeric END, 2) as loss_l FROM bottle_runs WHERE batch_id = '${id}' AND voided_at IS NULL ORDER BY packaged_at`));
    for (const o of btl.rows) console.log("  bottled:", o.vol, "L | loss:", o.loss_l, "L |", o.dt);

    const keg = await db.execute(sql.raw(`SELECT round(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END, 2) as vol, filled_at::date as dt, round(CASE WHEN loss_unit = 'gal' THEN loss::numeric * 3.78541 ELSE loss::numeric END, 2) as loss_l FROM keg_fills WHERE batch_id = '${id}' AND voided_at IS NULL AND deleted_at IS NULL ORDER BY filled_at`));
    for (const o of keg.rows) console.log("  kegged:", o.vol, "L | loss:", o.loss_l, "L |", o.dt);
  }

  // === APPLE BRANDY #2 ===
  console.log("\n=== APPLE BRANDY #2 ===");
  const ab = await db.execute(sql.raw(`
    SELECT b.id, b.name, round(b.initial_volume_liters::numeric, 2) as initial_l,
      round(b.current_volume_liters::numeric, 2) as current_l
    FROM batches b WHERE b.name LIKE '%Apple Brandy 2025 #2%' AND b.deleted_at IS NULL
  `));
  for (const r of ab.rows) {
    console.log("Name:", r.name, "| Init:", r.initial_l, "| Cur:", r.current_l, "| ID:", r.id);
    const id = r.id;

    const xfIn = await db.execute(sql.raw(`SELECT round(volume_transferred::numeric, 2) as vol, transferred_at::date as dt, source_batch_id as src FROM batch_transfers WHERE destination_batch_id = '${id}' AND deleted_at IS NULL ORDER BY transferred_at`));
    for (const o of xfIn.rows) console.log("  transfer_in:", o.vol, "L |", o.dt, "| from", o.src);

    const xfOut = await db.execute(sql.raw(`SELECT round(volume_transferred::numeric, 2) as vol, transferred_at::date as dt, destination_batch_id as dst FROM batch_transfers WHERE source_batch_id = '${id}' AND deleted_at IS NULL ORDER BY transferred_at`));
    for (const o of xfOut.rows) console.log("  transfer_out:", o.vol, "L |", o.dt, "| to", o.dst);

    const adj = await db.execute(sql.raw(`SELECT round(adjustment_amount::numeric, 2) as vol, adjustment_date::date as dt, reason, adjustment_type FROM batch_volume_adjustments WHERE batch_id = '${id}' AND deleted_at IS NULL ORDER BY adjustment_date`));
    for (const o of adj.rows) console.log("  adjustment:", o.vol, "L |", o.dt, "|", o.reason, "|", o.adjustment_type);
  }

  // === RASPBERRY BLACKBERRY (original) ===
  console.log("\n=== RASPBERRY BLACKBERRY (c2436e1d) ===");
  const rb = await db.execute(sql.raw(`
    SELECT b.id, b.name, round(b.initial_volume_liters::numeric, 2) as initial_l,
      round(b.current_volume_liters::numeric, 2) as current_l
    FROM batches b WHERE b.id = 'c2436e1d-2e14-4d04-a68a-2258fcd64b16'
  `));
  for (const r of rb.rows) {
    console.log("Name:", r.name, "| Init:", r.initial_l, "| Cur:", r.current_l);
    const id = r.id;

    const rack = await db.execute(sql.raw(`SELECT round(volume_loss::numeric, 2) as vol, racked_at::date as dt, notes FROM batch_racking_operations WHERE batch_id = '${id}' AND deleted_at IS NULL ORDER BY racked_at`));
    for (const o of rack.rows) console.log("  racking_loss:", o.vol, "L |", o.dt, "|", o.notes);

    const btl = await db.execute(sql.raw(`SELECT round(volume_taken_liters::numeric, 2) as vol, packaged_at::date as dt, round(CASE WHEN loss_unit = 'gal' THEN loss::numeric * 3.78541 ELSE loss::numeric END, 2) as loss_l FROM bottle_runs WHERE batch_id = '${id}' AND voided_at IS NULL ORDER BY packaged_at`));
    for (const o of btl.rows) console.log("  bottled:", o.vol, "L | loss:", o.loss_l, "L |", o.dt);

    const keg = await db.execute(sql.raw(`SELECT round(CASE WHEN volume_taken_unit = 'gal' THEN volume_taken::numeric * 3.78541 ELSE volume_taken::numeric END, 2) as vol, filled_at::date as dt, round(CASE WHEN loss_unit = 'gal' THEN loss::numeric * 3.78541 ELSE loss::numeric END, 2) as loss_l FROM keg_fills WHERE batch_id = '${id}' AND voided_at IS NULL AND deleted_at IS NULL ORDER BY filled_at`));
    for (const o of keg.rows) console.log("  kegged:", o.vol, "L | loss:", o.loss_l, "L |", o.dt);

    const adj = await db.execute(sql.raw(`SELECT round(adjustment_amount::numeric, 2) as vol, adjustment_date::date as dt, reason FROM batch_volume_adjustments WHERE batch_id = '${id}' AND deleted_at IS NULL ORDER BY adjustment_date`));
    for (const o of adj.rows) console.log("  adjustment:", o.vol, "L |", o.dt, "|", o.reason);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
