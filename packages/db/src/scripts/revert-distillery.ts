import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Find all batches that are for distillery/brandy and were incorrectly reclassified as wine
  const distilleryBatches = await pool.query(`
    SELECT id, name FROM batches
    WHERE product_type = 'wine'
      AND (
        name ILIKE '%distill%'
        OR name ILIKE '%brandy%'
        OR name ILIKE 'legacy%'
        OR name ILIKE 'blend-2025-10-31%'
      )
  `);

  // Also find "For Distillery" batch
  const forDist = await pool.query(`
    SELECT id, name FROM batches
    WHERE product_type = 'wine'
      AND name ILIKE '%blend-2024-12-20-1000 IBC 4%'
  `);

  const allIds = [
    ...distilleryBatches.rows.map((r: any) => r.id),
    ...forDist.rows.map((r: any) => r.id),
  ];
  const uniqueIds = [...new Set(allIds)];

  if (uniqueIds.length === 0) {
    console.log("No distillery batches to revert");
    await pool.end();
    return;
  }

  const result = await pool.query(
    `UPDATE batches SET product_type = 'cider', updated_at = NOW()
     WHERE id = ANY($1) RETURNING id, name`,
    [uniqueIds]
  );

  console.log(`Reverted ${result.rowCount} distillery batches to cider:`);
  result.rows.forEach((r: any) => console.log("  ", r.name));

  // Show remaining wine count
  const count = await pool.query(
    `SELECT COUNT(*) as cnt FROM batches WHERE product_type = 'wine' AND deleted_at IS NULL`
  );
  console.log("\nRemaining wine batches:", count.rows[0].cnt);

  await pool.end();
}

main().catch(console.error);
