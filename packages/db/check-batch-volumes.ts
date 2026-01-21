import { db, batches } from "./src";
import { isNull, sql } from "drizzle-orm";

async function check() {
  console.log("🔗 Checking actual batch volumes...\n");

  // Get total current volume from all active batches
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
    })
    .from(batches)
    .where(isNull(batches.deletedAt));

  const totalGallons = Number(result.totalLiters) * 0.264172;
  
  console.log("Active Batches:", result.count);
  console.log("Total Current Volume:", Number(result.totalLiters).toFixed(1), "liters");
  console.log("Total Current Volume:", totalGallons.toFixed(1), "gallons");
  console.log("");
  console.log("TTB Opening Balance: 1,121 gallons");
  console.log("Difference:", (totalGallons - 1121).toFixed(1), "gallons");
  
  process.exit(0);
}

check().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
