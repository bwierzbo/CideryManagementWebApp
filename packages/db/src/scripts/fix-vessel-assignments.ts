import { db } from '../';
import { sql } from 'drizzle-orm';

async function main() {
  // Clear vessel_id on all completed/archived/empty batches still pointing to vessels
  const result = await db.execute(sql`
    UPDATE batches
    SET vessel_id = NULL, updated_at = NOW()
    WHERE deleted_at IS NULL
    AND vessel_id IS NOT NULL
    AND (
      (status = 'completed' AND is_archived = true)
      OR (status = 'completed' AND COALESCE(current_volume_liters, 0) <= 0.01)
    )
    RETURNING id, name, custom_name, status, current_volume_liters
  `);
  console.log(`Cleared vessel_id on ${result.rows.length} stale batches:`);
  for (const r of result.rows as any[]) {
    console.log(`  "${r.custom_name || r.name}" (status=${r.status}, vol=${r.current_volume_liters}L)`);
  }

  // Special case: Raspberry Blackberry on CARBOY-5G-7 is completed with 18.93L
  // It's completed but has stale volume - clear its vessel assignment
  const rb = await db.execute(sql`
    UPDATE batches
    SET vessel_id = NULL, updated_at = NOW()
    WHERE id = '430cdcd3-af47-4260-a26f-6aab040f5b3f'
    AND status = 'completed'
    RETURNING id, custom_name
  `);
  if (rb.rows.length > 0) {
    console.log(`\nCleared "Raspberry Blackberry" from CARBOY-5G-7`);
  }

  // Verify CARBOY-5G-7 is now clear
  const verify = await db.execute(sql`
    SELECT b.id, b.custom_name, b.status, b.current_volume_liters
    FROM batches b
    JOIN vessels v ON v.id = b.vessel_id
    WHERE v.name ILIKE '%CARBOY-5G-7%'
    AND b.deleted_at IS NULL
  `);
  console.log(`\nBatches remaining on CARBOY-5G-7: ${verify.rows.length}`);

  process.exit(0);
}
main();
