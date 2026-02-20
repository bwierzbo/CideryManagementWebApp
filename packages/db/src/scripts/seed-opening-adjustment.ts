import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Seed the initial TTB waterfall adjustment for the 2025 period.
 *
 * The SBD per-batch reconstruction computes 1,111.3 gal at 2024-12-31,
 * which is 9.6 gal below the configured TTB opening of 1,121 gal
 * (from physical inventory). This gap exists because the system was set up
 * after operations began, and the per-batch ledger cannot fully reconstruct
 * the exact physical inventory count from legacy data.
 *
 * This adjustment bridges the SBD reconstruction to the physical inventory count.
 */
async function main() {
  // Check if adjustment already exists
  const existing = await db.execute(sql.raw(`
    SELECT id FROM ttb_waterfall_adjustments
    WHERE period_year = 2025
      AND waterfall_line = 'opening'
      AND deleted_at IS NULL
  `));

  if ((existing.rows as any[]).length > 0) {
    console.log("Opening balance adjustment for 2025 already exists. Skipping.");
    process.exit(0);
  }

  await db.execute(sql.raw(`
    INSERT INTO ttb_waterfall_adjustments (
      period_year, waterfall_line, amount_gallons, reason, notes
    ) VALUES (
      2025,
      'opening',
      -9.6,
      'Opening balance correction: legacy data reconstruction gap',
      'The SBD per-batch reconstruction computes 1,111.3 gal at 2024-12-31, '
      || 'which is 9.6 gal below the configured TTB opening of 1,121 gal (from physical inventory). '
      || 'This gap exists because the system was set up mid-operations, and the per-batch ledger '
      || 'cannot fully reconstruct the exact physical inventory count from legacy data. '
      || 'The -9.6 gal adjustment bridges the SBD reconstruction to the physical inventory count. '
      || 'Created as part of the Feb 2026 TTB reconciliation fix that also resolved: '
      || '(1) phantom child batch "Legacy inventory - to be distilled" missing transfer record (370.3L), '
      || '(2) product type misclassification of Base Cider and Community Blend #1 parents (wine -> cider), '
      || '(3) waterfall variance from mergesIn/mergesOut asymmetry.'
    )
  `));

  console.log("Created opening balance adjustment for 2025: -9.6 gal");
  console.log("Reason: Opening balance correction — legacy data reconstruction gap");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
