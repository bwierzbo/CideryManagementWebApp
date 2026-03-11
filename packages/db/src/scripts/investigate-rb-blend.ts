import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    UPDATE batches
    SET parent_batch_id = 'a1a0efb2-56a6-486e-9f88-48d7b8bc14b6'
    WHERE id = '430cdcd3-af47-4260-a26f-6aab040f5b3f'
    AND parent_batch_id IS NULL
    RETURNING id, name, parent_batch_id
  `);
  console.log("Updated:", JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

main().catch(console.error);
