import { db } from "./index";
import { sql } from "drizzle-orm";

async function fixPressRun() {
  const fiveGalInLiters = 5 * 3.78541;
  const fourGalInLiters = 4 * 3.78541;

  console.log("Fixing batch volumes for press run 2025-11-10-03");
  console.log("5 Carboy 5: 5 -> " + fiveGalInLiters.toFixed(3) + " L");
  console.log("5 Carboy 9: 4 -> " + fourGalInLiters.toFixed(3) + " L");

  // Update 5 Carboy 5 batch
  await db.execute(sql`
    UPDATE batches
    SET
      current_volume = ${fiveGalInLiters.toFixed(3)},
      initial_volume = ${fiveGalInLiters.toFixed(3)},
      current_volume_liters = ${fiveGalInLiters.toFixed(3)},
      initial_volume_liters = ${fiveGalInLiters.toFixed(3)}
    WHERE id = 'a9ef8e43-4fa4-4505-bb14-2b65c858f574'
  `);
  console.log("Updated 5 Carboy 5 batch");

  // Update 5 Carboy 9 batch
  await db.execute(sql`
    UPDATE batches
    SET
      current_volume = ${fourGalInLiters.toFixed(3)},
      initial_volume = ${fourGalInLiters.toFixed(3)},
      current_volume_liters = ${fourGalInLiters.toFixed(3)},
      initial_volume_liters = ${fourGalInLiters.toFixed(3)}
    WHERE id = '2d7a8ea1-0434-4372-af8f-f2cf11ee75cc'
  `);
  console.log("Updated 5 Carboy 9 batch");

  // Verify the fix
  const result = await db.execute(sql`
    SELECT
      b.name as batch_name,
      b.current_volume,
      b.initial_volume,
      v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id IN ('a9ef8e43-4fa4-4505-bb14-2b65c858f574', '2d7a8ea1-0434-4372-af8f-f2cf11ee75cc')
  `);

  console.log("\nVerification:");
  console.log(JSON.stringify(result.rows, null, 2));
}

fixPressRun().then(() => process.exit(0)).catch(console.error);
