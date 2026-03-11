import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Revert to 0 — this batch was fully distilled, physically empty
  const result = await db.execute(sql`
    UPDATE batches
    SET current_volume_liters = 0
    WHERE id = '1539d85e-299a-4e13-ae0e-ee2ca38b7ea6'
    RETURNING id, custom_name, current_volume_liters
  `);
  console.log('Reverted:', JSON.stringify(result.rows[0], null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
