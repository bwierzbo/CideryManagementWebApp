import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  // Find Somerset batches
  const somersets = await db.execute(sql`
    SELECT b.id, b.name, b.custom_name, b.status, b.current_volume, b.current_volume_unit,
           b.initial_volume_liters, b.start_date, b.end_date, b.deleted_at,
           v.name AS current_vessel
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.name ILIKE '%somerset%' OR b.custom_name ILIKE '%somerset%'
    ORDER BY b.start_date DESC NULLS LAST
  `);
  console.log(`Somerset batches (${somersets.rows.length}):`);
  for (const r of somersets.rows as any[]) {
    console.log(
      `  ${r.custom_name || r.name}  id=${r.id}  status=${r.status}, vol=${r.current_volume}${r.current_volume_unit}, init=${r.initial_volume_liters}L, vessel=${r.current_vessel ?? "—"}, start=${r.start_date}, end=${r.end_date}, deleted=${r.deleted_at ? "YES" : "no"}`,
    );
  }

  // For each, find all transfers (in/out) and keg/bottle runs
  for (const r of somersets.rows as any[]) {
    console.log(`\n--- Movements for "${r.custom_name || r.name}" (${r.id}) ---`);

    const ins = await db.execute(sql`
      SELECT bt.transferred_at, bt.volume_transferred, bt.volume_transferred_unit, bt.loss,
             src_v.name AS src_vessel, dst_v.name AS dst_vessel,
             src_b.name AS src_batch, src_b.custom_name AS src_batch_custom
      FROM batch_transfers bt
      LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
      LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
      LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
      WHERE bt.destination_batch_id = ${r.id}::uuid AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at
    `);
    console.log(`  Transfers IN (as destination): ${ins.rows.length}`);
    for (const t of ins.rows as any[]) {
      console.log(`    ${t.transferred_at}  ${t.src_vessel} → ${t.dst_vessel}  | src batch "${t.src_batch_custom || t.src_batch}"  | ${t.volume_transferred}${t.volume_transferred_unit}, loss=${t.loss}`);
    }

    const outs = await db.execute(sql`
      SELECT bt.transferred_at, bt.volume_transferred, bt.volume_transferred_unit, bt.loss,
             src_v.name AS src_vessel, dst_v.name AS dst_vessel,
             dst_b.name AS dst_batch, dst_b.custom_name AS dst_batch_custom
      FROM batch_transfers bt
      LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
      LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
      LEFT JOIN batches dst_b ON bt.destination_batch_id = dst_b.id
      WHERE bt.source_batch_id = ${r.id}::uuid AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at
    `);
    console.log(`  Transfers OUT (as source): ${outs.rows.length}`);
    for (const t of outs.rows as any[]) {
      console.log(`    ${t.transferred_at}  ${t.src_vessel} → ${t.dst_vessel}  | dst batch "${t.dst_batch_custom || t.dst_batch}"  | ${t.volume_transferred}${t.volume_transferred_unit}, loss=${t.loss}`);
    }

    // Keg fills tied to this batch
    const kegs = await db.execute(sql`
      SELECT kf.filled_at, kf.volume_taken, kf.volume_taken_unit, k.keg_number, v.name AS vessel
      FROM keg_fills kf
      LEFT JOIN kegs k ON kf.keg_id = k.id
      LEFT JOIN vessels v ON kf.vessel_id = v.id
      WHERE kf.batch_id = ${r.id}::uuid AND kf.deleted_at IS NULL AND kf.voided_at IS NULL
      ORDER BY kf.filled_at
    `);
    console.log(`  Keg fills: ${kegs.rows.length}`);
    for (const k of kegs.rows as any[]) {
      console.log(`    ${k.filled_at}  from ${k.vessel} → ${k.keg_number}  | ${k.volume_taken}${k.volume_taken_unit}`);
    }

    // Bottle runs tied to this batch (non-keg)
    const bottles = await db.execute(sql`
      SELECT br.packaged_at, br.package_type, br.units_produced, br.volume_taken, br.volume_taken_unit, v.name AS vessel
      FROM bottle_runs br
      LEFT JOIN vessels v ON br.vessel_id = v.id
      WHERE br.batch_id = ${r.id}::uuid
      ORDER BY br.packaged_at
    `);
    console.log(`  Bottle runs: ${bottles.rows.length}`);
    for (const b of bottles.rows as any[]) {
      console.log(`    ${b.packaged_at}  from ${b.vessel} | ${b.package_type} ${b.units_produced} units, ${b.volume_taken}${b.volume_taken_unit}`);
    }

    // Status history / vessel changes via audit_logs (if available)
    const audits = await db.execute(sql`
      SELECT created_at, action, changed_fields
      FROM audit_logs
      WHERE entity_type = 'batch' AND entity_id = ${r.id}::uuid
      ORDER BY created_at
    `).catch(() => ({ rows: [] }));
    if (audits.rows.length > 0) {
      console.log(`  Audit entries: ${audits.rows.length}`);
      for (const a of audits.rows as any[]) {
        console.log(`    ${a.created_at}  ${a.action}  fields=${JSON.stringify(a.changed_fields).slice(0, 200)}`);
      }
    }
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
