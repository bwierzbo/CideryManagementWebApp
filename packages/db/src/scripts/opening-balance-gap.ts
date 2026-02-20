import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const L_PER_GAL = 3.78541;

// The 17 batch numbers shown on the reconciliation page as "Carried Forward"
const CARRIED_FORWARD_BATCH_NUMBERS = [
  "2024-10-02_UNKN_VHCR_A",
  "2024-10-05_UNKN_ASKE_A",
  "2024-10-05_UNKN_BLEND_A",
  "2024-10-20_UNKN_BLEND_A-R",
  "2024-10-20_UNKN_BLEND_A",
  "2024-11-18_5 Carboy 6_RO5_A",
  "2024-11-28_120 Barrel 2_BLEND_A",
  "2024-11-28_5 Carboy 3_BLEND_A",
  "2024-11-28_5 Carboy 4_KIBL_A",
  "2024-11-28_5 Carboy 5_KIBL_A",
  "2024-12-20_LEGACY_20P2_PERRY",
  "2024-12-20_LEGACY_25P1_PERRY",
  "2024-12-20_LEGACY_BRITE_T2302",
  "blend-2024-12-20-1000 IBC 4-024554",
  "blend-2024-12-20-225 Barrel 2-571423",
  "2024-12-21_TANK-500-1_COMMUNITY_CIDER",
  "blend-2025-01-01-10 Barrel 1-415875",
];

async function main() {
  // Get IDs and product types for these batches
  const batchRows = await pool.query(`
    SELECT id, name, batch_number, product_type,
           CAST(initial_volume_liters AS float) as init_l,
           CAST(current_volume_liters AS float) as cur_l
    FROM batches
    WHERE batch_number = ANY($1) AND deleted_at IS NULL
    ORDER BY start_date
  `, [CARRIED_FORWARD_BATCH_NUMBERS]);

  console.log(`Found ${batchRows.rowCount} of ${CARRIED_FORWARD_BATCH_NUMBERS.length} expected batches\n`);

  // Show which are missing
  const foundBatchNumbers = new Set(batchRows.rows.map((r: any) => r.batch_number));
  for (const bn of CARRIED_FORWARD_BATCH_NUMBERS) {
    if (!foundBatchNumbers.has(bn)) {
      console.log(`  MISSING: ${bn}`);
    }
  }

  // Tax class determination
  function taxClass(pt: string): string {
    if (pt === "wine") return "wineUnder16";
    if (pt === "pommeau") return "wine16To21";
    if (pt === "brandy") return "appleBrandy";
    return "hardCider"; // cider, perry
  }

  // List batches by tax class
  const byClass: Record<string, Array<{ id: string; name: string; batchNumber: string; productType: string; initL: number }>> = {};
  for (const b of batchRows.rows as any[]) {
    const cls = taxClass(b.product_type || "cider");
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push({
      id: b.id,
      name: b.name,
      batchNumber: b.batch_number,
      productType: b.product_type,
      initL: b.init_l,
    });
  }

  console.log("\n=== Carried-Forward Batches by Tax Class ===\n");
  for (const [cls, batches] of Object.entries(byClass)) {
    console.log(`${cls} (${batches.length} batches):`);
    for (const b of batches) {
      console.log(`  ${b.name} [${b.productType}] init=${b.initL}L (${(b.initL / L_PER_GAL).toFixed(1)} gal)`);
    }
  }

  // Now check: which of these batches DON'T appear in computeReconciliationFromBatches?
  // The batch recon uses all eligible batches where startDate <= endDate.
  // Let me also check if there are OTHER batches in the recon that aren't in our 17.
  const reconBatches = await pool.query(`
    SELECT id, name, batch_number, product_type, start_date,
           CAST(initial_volume_liters AS float) as init_l,
           reconciliation_status
    FROM batches
    WHERE deleted_at IS NULL
      AND COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND COALESCE(product_type, 'cider') != 'juice'
      AND start_date::date <= '2024-12-31'::date
    ORDER BY start_date
  `);

  const pageIds = new Set(batchRows.rows.map((r: any) => r.id));
  const extraInRecon: any[] = [];
  for (const b of reconBatches.rows as any[]) {
    if (!pageIds.has(b.id)) {
      extraInRecon.push(b);
    }
  }

  if (extraInRecon.length > 0) {
    console.log(`\n=== ${extraInRecon.length} Extra batches in computeReconciliationFromBatches (not in page view) ===\n`);
    for (const b of extraInRecon) {
      console.log(`  ${b.name} [${b.product_type}] status=${b.reconciliation_status} init=${b.init_l}L start=${b.start_date}`);
    }
    console.log("\nThese batches affect the batch recon totals but aren't shown on the page.");
    console.log("Their opening volumes may be contributing to the 1115.8 vs 1121 gap.");
  }

  // Check existing adjustments on the opening date
  const existingAdjs = await pool.query(`
    SELECT ba.batch_id, b.name, b.batch_number,
           CAST(ba.adjustment_amount AS float) as amt,
           ba.reason, ba.adjustment_date
    FROM batch_volume_adjustments ba
    JOIN batches b ON b.id = ba.batch_id
    WHERE ba.batch_id = ANY($1::uuid[]) AND ba.deleted_at IS NULL
      AND ba.adjustment_date::date <= '2024-12-31'::date
    ORDER BY ba.adjustment_date
  `, [batchRows.rows.map((r: any) => r.id)]);

  if (existingAdjs.rowCount && existingAdjs.rowCount > 0) {
    console.log(`\n=== Existing adjustments on or before 2024-12-31 ===\n`);
    for (const a of existingAdjs.rows as any[]) {
      console.log(`  ${a.name}: ${a.amt > 0 ? "+" : ""}${a.amt}L "${a.reason}" @ ${a.adjustment_date}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
