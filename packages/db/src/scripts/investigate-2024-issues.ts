import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  const batches = [
    { id: "430cdcd3-af47-4260-a26f-6aab040f5b3f", name: "Raspberry Blackberry" },
    { id: "fe565ff0-b519-447e-966f-8bc6dcd0b8a6", name: "Lavender Salal Cider" },
    { id: "b11200f5-c24d-4450-a75d-8feae24dd122", name: "Calvados Barrel Aged" },
  ];

  for (const b of batches) {
    console.log("=== " + b.name + " (" + b.id.slice(0, 8) + ") ===");

    const batch = await db.execute(
      sql.raw(`
      SELECT custom_name, batch_number, product_type, status,
             CAST(initial_volume_liters AS NUMERIC) as init,
             CAST(current_volume_liters AS NUMERIC) as current,
             start_date::text, reconciliation_status,
             parent_batch_id, is_racking_derivative,
             vessel_id, deleted_at::text
      FROM batches WHERE id = '${b.id}'
    `)
    );
    const row = (batch.rows as any[])[0];
    console.log(
      `  Init: ${parseFloat(row.init).toFixed(1)}L (${(parseFloat(row.init) * GAL).toFixed(1)} gal)`
    );
    console.log(
      `  Current: ${parseFloat(row.current).toFixed(1)}L (${(parseFloat(row.current) * GAL).toFixed(1)} gal)`
    );
    console.log(`  Status: ${row.status}, Recon: ${row.reconciliation_status}`);
    console.log(`  Start: ${row.start_date}, Product: ${row.product_type}`);
    console.log(
      `  Parent: ${row.parent_batch_id || "NONE"}, IsRackingDeriv: ${row.is_racking_derivative}`
    );
    console.log(`  Vessel: ${row.vessel_id || "NONE"}`);

    // Transfers OUT
    const xOut = await db.execute(
      sql.raw(`
      SELECT bt.volume_transferred::numeric as vol, bt.loss::numeric as loss,
             bt.transferred_at::text, bt.deleted_at,
             bd.custom_name as dest
      FROM batch_transfers bt
      JOIN batches bd ON bt.destination_batch_id = bd.id
      WHERE bt.source_batch_id = '${b.id}'
      ORDER BY bt.transferred_at
    `)
    );
    console.log("  Transfers OUT:");
    if ((xOut.rows as any[]).length === 0) console.log("    (none)");
    for (const t of xOut.rows as any[]) {
      const del = t.deleted_at ? " [DELETED]" : "";
      console.log(
        `    -> ${t.dest}: ${parseFloat(t.vol).toFixed(1)}L ${t.transferred_at}${del}`
      );
    }

    // Transfers IN
    const xIn = await db.execute(
      sql.raw(`
      SELECT bt.volume_transferred::numeric as vol,
             bt.transferred_at::text, bt.deleted_at,
             bs.custom_name as src
      FROM batch_transfers bt
      JOIN batches bs ON bt.source_batch_id = bs.id
      WHERE bt.destination_batch_id = '${b.id}'
      ORDER BY bt.transferred_at
    `)
    );
    console.log("  Transfers IN:");
    if ((xIn.rows as any[]).length === 0) console.log("    (none)");
    for (const t of xIn.rows as any[]) {
      const del = t.deleted_at ? " [DELETED]" : "";
      console.log(
        `    <- ${t.src}: ${parseFloat(t.vol).toFixed(1)}L ${t.transferred_at}${del}`
      );
    }

    // Merges
    const merges = await db.execute(
      sql.raw(`
      SELECT bmh.volume_added::numeric as vol, bmh.merged_at::text, bmh.deleted_at,
             COALESCE(bs.custom_name, pr.press_run_name, 'juice purchase') as src
      FROM batch_merge_history bmh
      LEFT JOIN batches bs ON bmh.source_batch_id = bs.id
      LEFT JOIN press_runs pr ON bmh.source_press_run_id = pr.id
      WHERE bmh.target_batch_id = '${b.id}'
      ORDER BY bmh.merged_at
    `)
    );
    console.log("  Merges IN:");
    if ((merges.rows as any[]).length === 0) console.log("    (none)");
    for (const m of merges.rows as any[]) {
      const del = m.deleted_at ? " [DELETED]" : "";
      console.log(
        `    <- ${m.src}: ${parseFloat(m.vol).toFixed(1)}L ${m.merged_at}${del}`
      );
    }

    // Aggregates
    const bottles = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(volume_taken_liters::numeric), 0) as total
      FROM bottle_runs WHERE batch_id = '${b.id}' AND voided_at IS NULL
    `)
    );
    const kegs = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*3.78541
                               ELSE volume_taken::numeric END), 0) as total
      FROM keg_fills WHERE batch_id = '${b.id}' AND voided_at IS NULL AND deleted_at IS NULL
    `)
    );
    const racking = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_racking_operations WHERE batch_id = '${b.id}' AND deleted_at IS NULL
    `)
    );
    const filter = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(volume_loss::numeric), 0) as total
      FROM batch_filter_operations WHERE batch_id = '${b.id}' AND deleted_at IS NULL
    `)
    );
    const adj = await db.execute(
      sql.raw(`
      SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as total
      FROM batch_volume_adjustments WHERE batch_id = '${b.id}' AND deleted_at IS NULL
    `)
    );

    const bot = parseFloat((bottles.rows[0] as any).total);
    const keg = parseFloat((kegs.rows[0] as any).total);
    const rack = parseFloat((racking.rows[0] as any).total);
    const filt = parseFloat((filter.rows[0] as any).total);
    const adjVal = parseFloat((adj.rows[0] as any).total);

    console.log(
      `  Bottled: ${bot.toFixed(1)}L, Kegged: ${keg.toFixed(1)}L, Racking: ${rack.toFixed(1)}L, Filter: ${filt.toFixed(1)}L, Adj: ${adjVal.toFixed(1)}L`
    );

    // Reconstruction
    const init = parseFloat(row.init);
    const current = parseFloat(row.current);
    const xInTotal = (xIn.rows as any[])
      .filter((t: any) => !t.deleted_at)
      .reduce((s: number, t: any) => s + parseFloat(t.vol), 0);
    const mrgTotal = (merges.rows as any[])
      .filter((m: any) => !m.deleted_at)
      .reduce((s: number, m: any) => s + parseFloat(m.vol), 0);
    const xOutTotal = (xOut.rows as any[])
      .filter((t: any) => !t.deleted_at)
      .reduce(
        (s: number, t: any) =>
          s + parseFloat(t.vol) + parseFloat(t.loss || 0),
        0
      );

    const recon =
      init + xInTotal + mrgTotal - xOutTotal - bot - keg - rack - filt + adjVal;
    console.log(
      `  Recon: ${init.toFixed(1)} + ${xInTotal.toFixed(1)} + ${mrgTotal.toFixed(1)} - ${xOutTotal.toFixed(1)} - ${bot.toFixed(1)} - ${keg.toFixed(1)} - ${rack.toFixed(1)} - ${filt.toFixed(1)} + ${adjVal.toFixed(1)} = ${recon.toFixed(1)}L`
    );
    console.log(
      `  Current: ${current.toFixed(1)}L, Drift: ${(recon - current).toFixed(1)}L`
    );

    // Check init vs capacity — the "initial anomaly" check
    if (row.vessel_id) {
      const vessel = await db.execute(
        sql.raw(`
        SELECT name, CAST(capacity_liters AS NUMERIC) as cap
        FROM vessels WHERE id = '${row.vessel_id}'
      `)
      );
      const v = (vessel.rows as any[])[0];
      if (v) {
        const cap = parseFloat(v.cap);
        console.log(
          `  Vessel: ${v.name}, Capacity: ${cap.toFixed(1)}L (${(cap * GAL).toFixed(1)} gal)`
        );
        if (init > cap)
          console.log(`  ** INIT > CAPACITY (${init.toFixed(1)} > ${cap.toFixed(1)}) **`);
        if (current > cap)
          console.log(`  ** CURRENT > CAPACITY (${current.toFixed(1)} > ${cap.toFixed(1)}) **`);
      }
    } else {
      console.log("  Vessel: NONE (no vessel assigned)");
    }

    console.log();
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
