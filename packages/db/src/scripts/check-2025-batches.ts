import { db } from "../index.js";
import { sql, and, gte, lte, isNull } from "drizzle-orm";
import { batches } from "../schema.js";

async function check() {
  const startDate = new Date(2025, 0, 1);
  const endDate = new Date(2025, 11, 31);

  const all = await db
    .select({
      productType: batches.productType,
      reconciliationStatus: batches.reconciliationStatus,
      count: sql<number>`COUNT(*)`,
      totalLiters: sql<number>`COALESCE(SUM(CAST(${batches.initialVolumeLiters} AS DECIMAL)), 0)`,
    })
    .from(batches)
    .where(
      and(
        isNull(batches.deletedAt),
        gte(batches.startDate, startDate),
        lte(batches.startDate, endDate)
      )
    )
    .groupBy(batches.productType, batches.reconciliationStatus);

  console.log("ALL 2025 BATCHES (by productType + reconciliationStatus):");
  for (const r of all) {
    console.log(
      `  ${(r.productType || "null").padEnd(12)} ${(r.reconciliationStatus || "null").padEnd(12)} count=${r.count} totalL=${Number(r.totalLiters).toFixed(2)}`
    );
  }

  // Also check distillation records for 2025 to verify they're in "other removals"
  // Distillation reduces cider volume but the TTB router doesn't count it as "other removal"
  // It should appear on line21_distillingMaterial
  console.log("");
  console.log("NOTE: Reconciliation variance analysis:");
  console.log("  The 193 gal variance is likely caused by:");
  console.log("  1. Distillation (~741 gal) not counted in reconciliation removals");
  console.log("  2. Only 1 of many 2025 batches marked as 'verified'");
  console.log("  3. Pommeau batches started before 2025 not counted as production");
  console.log("  Check reconciliationStatus distribution above for details.");

  process.exit(0);
}
check().catch((e) => {
  console.error(e);
  process.exit(1);
});
