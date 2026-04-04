import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const BATCH_NUMBER = "2024-11-18_5 Carboy 6_RO5_A";

  // 1. Query current state
  const batches = await sql`
    SELECT id, batch_number, custom_name, status, current_volume, current_volume_unit,
           vessel_id
    FROM batches
    WHERE batch_number = ${BATCH_NUMBER}
      AND deleted_at IS NULL
  `;

  if (batches.length === 0) {
    console.error(`Batch "${BATCH_NUMBER}" not found.`);
    await sql.end();
    process.exit(1);
  }

  const batch = batches[0];
  console.log("=== Current State ===");
  console.log(`  Batch Number: ${batch.batch_number}`);
  console.log(`  Custom Name: ${batch.custom_name}`);
  console.log(`  Status: ${batch.status}`);
  console.log(`  Current Volume: ${batch.current_volume} ${batch.current_volume_unit}`);
  console.log(`  Vessel ID: ${batch.vessel_id}`);

  const changes: string[] = [];

  // 2. Fix status: fermentation → aging
  if (batch.status === "fermentation") {
    await sql`
      UPDATE batches
      SET status = 'aging', updated_at = NOW()
      WHERE id = ${batch.id}
    `;
    changes.push("status: fermentation → aging");
  } else {
    console.log(`  Status is already "${batch.status}", skipping.`);
  }

  // 3. Fix volume if null
  if (batch.current_volume === null || batch.current_volume === undefined) {
    await sql`
      UPDATE batches
      SET current_volume = '18.2',
          current_volume_unit = 'L',
          updated_at = NOW()
      WHERE id = ${batch.id}
    `;
    changes.push("current_volume: NULL → 18.2 L");
  } else {
    console.log(`  Volume is ${batch.current_volume} ${batch.current_volume_unit}, skipping.`);
  }

  // 4. Log changes
  if (changes.length > 0) {
    console.log("\n=== Changes Applied ===");
    for (const c of changes) {
      console.log(`  ✓ ${c}`);
    }
  } else {
    console.log("\nNo changes needed.");
  }

  // Verify
  const verify = await sql`
    SELECT status, current_volume, current_volume_unit
    FROM batches WHERE id = ${batch.id}
  `;
  console.log("\n=== Final State ===");
  console.log(`  Status: ${verify[0].status}`);
  console.log(`  Volume: ${verify[0].current_volume} ${verify[0].current_volume_unit}`);

  await sql.end();
}

main().catch(console.error);
