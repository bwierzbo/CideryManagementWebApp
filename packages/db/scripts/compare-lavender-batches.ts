import { db } from "../src/index";
import { sql } from "drizzle-orm";

// Compare the two candidate "Lavender Black Currant" batches in DRUM-120-1 to decide
// which is the real working batch and which is the duplicate.

const A = "71acc63b-181f-418c-a038-17d17ccd0752"; // dest of kept transfer 29c8d606 (created 14:12:27)
const B = "5b8fc827-d274-454b-9e80-46c6a7227e55"; // dest of dup transfer  bd5e9049 (created 14:12:32)

async function dump(id: string, label: string) {
  console.log(`\n===================== ${label}  (${id}) =====================`);
  const b = await db.execute(sql`
    SELECT name, custom_name, status, current_volume, current_volume_unit,
           initial_volume_liters, start_date, created_at, updated_at
    FROM batches WHERE id = ${id}::uuid`);
  console.log("batch:", JSON.stringify((b.rows as any[])[0], null, 2));

  const meas = await db.execute(sql`
    SELECT measurement_date, specific_gravity, abv, ph, temperature, notes, created_at
    FROM batch_measurements WHERE batch_id = ${id}::uuid AND deleted_at IS NULL
    ORDER BY measurement_date`);
  console.log(`\nmeasurements (${meas.rows.length}):`);
  for (const r of meas.rows as any[])
    console.log(`  ${r.measurement_date}  SG=${r.specific_gravity} abv=${r.abv} ph=${r.ph} temp=${r.temperature} notes=${r.notes ?? ""}  created=${r.created_at}`);

  const add = await db.execute(sql`
    SELECT added_at, additive_type, additive_name, amount, unit, notes, created_at
    FROM batch_additives WHERE batch_id = ${id}::uuid AND deleted_at IS NULL
    ORDER BY added_at`);
  console.log(`\nadditives (${add.rows.length}):`);
  for (const r of add.rows as any[])
    console.log(`  ${r.added_at}  ${r.additive_type}/${r.additive_name}  ${r.amount}${r.unit}  notes=${r.notes ?? ""}  created=${r.created_at}`);

  const comp = await db.execute(sql`
    SELECT COUNT(*)::int n FROM batch_compositions WHERE batch_id = ${id}::uuid`);
  console.log(`\ncompositions: ${(comp.rows[0] as any).n}`);

  const ledger = await db.execute(sql`
    SELECT * FROM batch_volume_ledger WHERE batch_id = ${id}::uuid ORDER BY created_at`);
  console.log(`\nvolume_ledger (${ledger.rows.length}):`);
  for (const r of ledger.rows as any[]) console.log("  " + JSON.stringify(r));
}

async function main() {
  await dump(A, "A = dest of KEPT transfer (29c8d606, 14:12:27)");
  await dump(B, "B = dest of DUP transfer (bd5e9049, 14:12:32)");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
