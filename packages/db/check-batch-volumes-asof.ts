import { db, batches } from "./src";
import { isNull, lte, or, gte, and, sql } from "drizzle-orm";

async function check() {
  console.log("🔗 Checking batch volumes as of 2024-12-31...\n");

  const asOfDate = new Date("2024-12-31");

  // Get batches that existed as of the opening balance date
  // (started before or on that date, and not ended before that date)
  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.currentVolumeLiters} AS DECIMAL)), 0)`,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        lte(batches.startDate, asOfDate),
        or(
          isNull(batches.endDate),
          gte(batches.endDate, asOfDate)
        )
      )
    );

  const totalGallons = Number(result.totalLiters) * 0.264172;
  
  console.log("Batches active as of 2024-12-31:", result.count);
  console.log("Total Volume (current):", Number(result.totalLiters).toFixed(1), "liters");
  console.log("Total Volume (current):", totalGallons.toFixed(1), "gallons");
  console.log("");
  console.log("TTB Opening Balance:    1,121.0 gallons");
  console.log("System Sources:         1,141.9 gallons (press runs + juice purchases)");
  console.log("Batch Current Volumes:", totalGallons.toFixed(1), "gallons");
  console.log("");
  console.log("Gap (Batches - TTB):", (totalGallons - 1121).toFixed(1), "gallons");
  
  process.exit(0);
}

check().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
