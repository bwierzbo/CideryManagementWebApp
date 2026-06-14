import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function main() {
  const v = await db.execute(sql`
    SELECT id, name, status FROM vessels WHERE UPPER(name)='CARBOY-5G-9'`);
  const vessel = (v.rows as any[])[0];
  console.log("Vessel:", vessel);
  if (!vessel) process.exit(0);

  const b = await db.execute(sql`
    SELECT id, custom_name, status, current_volume, current_volume_unit,
           current_volume_liters, destroyed_at, deleted_at
    FROM batches WHERE vessel_id = ${vessel.id}::uuid
    ORDER BY created_at DESC`);
  console.log(`\nBatches ever in CARBOY-5G-9 (${b.rows.length}):`);
  for (const r of b.rows as any[]) {
    console.log(`  "${r.custom_name}" status=${r.status} vol=${r.current_volume}${r.current_volume_unit} volL=${r.current_volume_liters} destroyed_at=${r.destroyed_at} deleted=${r.deleted_at ? "YES" : "no"}`);
  }

  // Replicate the liquidMap occupant selection (post-fix) to confirm none is chosen.
  const chosen = await db.execute(sql`
    SELECT b.id, b.custom_name, b.status FROM batches b
    WHERE b.vessel_id = ${vessel.id}::uuid
      AND b.deleted_at IS NULL
      AND b.status != 'discarded'
      AND b.destroyed_at IS NULL
      AND NOT (b.status = 'completed' AND COALESCE(b.current_volume_liters, 0) <= 0.01)
    ORDER BY
      CASE WHEN b.status != 'completed' THEN 0 ELSE 1 END,
      b.current_volume_liters DESC NULLS LAST,
      b.created_at DESC
    LIMIT 1`);
  console.log(`\nliquidMap occupant after fix: ${(chosen.rows as any[]).length ? JSON.stringify(chosen.rows[0]) : "NONE (vessel reads empty → cleaning shows yellow, no characteristics)"}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
