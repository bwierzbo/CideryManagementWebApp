import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Fix two data issues:
 *
 * 1. PHANTOM CHILD: "Legacy inventory - to be distilled" has initial_volume_liters = 370.3L
 *    and parent_batch_id pointing to "For Distillery" (blend-2024-12-20-1000 IBC 4-024554),
 *    but NO batch_transfers record. This causes double-counting in SBD (~97.8 gal).
 *    Fix: Create the missing batch_transfers record.
 *
 * 2. PRODUCT TYPE: Two parent batches are incorrectly classified as "wine" when they have
 *    NO non-apple/pear fruit additives. Their children that also lack fruit should be "cider".
 *    - "Community Blend #1" (2024-10-05_UNKN_BLEND_A) — no additives on parent → cider
 *    - "Base Cider" (2024-10-20_UNKN_BLEND_A-R) — no additives at all → cider
 *    - Children of "Base Cider" have only non-fruit additives → cider
 *    Note: Children of "Community Blend #1" that DO have fruit should stay "wine".
 */
async function main() {
  console.log("=== Fix 1: Create batch_transfers for phantom child ===\n");

  // Find the phantom child
  const phantom = await db.execute(sql.raw(`
    SELECT child.id AS child_id, child.name AS child_name,
           child.initial_volume_liters, child.parent_batch_id,
           child.start_date,
           parent.name AS parent_name, parent.vessel_id AS parent_vessel_id,
           child.vessel_id AS child_vessel_id
    FROM batches child
    JOIN batches parent ON child.parent_batch_id = parent.id
    WHERE child.name = 'Legacy inventory - to be distilled'
      AND child.deleted_at IS NULL
      AND parent.deleted_at IS NULL
  `));

  const phantomRows = phantom.rows as any[];
  if (phantomRows.length === 0) {
    console.log("Phantom child not found. Skipping.");
  } else {
    const p = phantomRows[0];
    console.log(`Found: ${p.child_name}`);
    console.log(`  Child ID: ${p.child_id}`);
    console.log(`  Parent: ${p.parent_name} (${p.parent_batch_id})`);
    console.log(`  Initial: ${p.initial_volume_liters}L`);
    console.log(`  Parent vessel: ${p.parent_vessel_id}`);
    console.log(`  Child vessel: ${p.child_vessel_id}`);

    // Check if batch_transfers already exists
    const existing = await db.execute(sql`
      SELECT id FROM batch_transfers
      WHERE source_batch_id = ${p.parent_batch_id}
        AND destination_batch_id = ${p.child_id}
        AND deleted_at IS NULL
    `);

    if ((existing.rows as any[]).length > 0) {
      console.log("\n  batch_transfers record already exists. Skipping.");
    } else {
      // Create the missing batch_transfers record
      await db.execute(sql`
        INSERT INTO batch_transfers (
          source_batch_id, source_vessel_id,
          destination_batch_id, destination_vessel_id,
          volume_transferred, volume_transferred_unit,
          loss, loss_unit,
          total_volume_processed, total_volume_processed_unit,
          remaining_volume, remaining_volume_unit,
          transferred_at, transferred_by,
          created_at, updated_at
        ) VALUES (
          ${p.parent_batch_id}, ${p.parent_vessel_id},
          ${p.child_id}, ${p.child_vessel_id},
          ${p.initial_volume_liters}, 'L',
          '0', 'L',
          ${p.initial_volume_liters}, 'L',
          '0', 'L',
          ${p.start_date}, NULL,
          NOW(), NOW()
        )
      `);
      console.log(`\n  Created batch_transfers: ${p.parent_name} → ${p.child_name} (${p.initial_volume_liters}L)`);
    }
  }

  console.log("\n=== Fix 2: Correct product_type for mis-classified batches ===\n");

  // Fix "Community Blend #1" parent (no additives → should be cider)
  const cb1 = await db.execute(sql.raw(`
    UPDATE batches SET product_type = 'cider', updated_at = NOW()
    WHERE batch_number = '2024-10-05_UNKN_BLEND_A'
      AND product_type = 'wine'
      AND deleted_at IS NULL
    RETURNING id, name, batch_number
  `));
  for (const r of cb1.rows as any[]) {
    console.log(`Fixed: ${r.name} (${r.batch_number}) → cider`);
  }

  // Fix "Base Cider" parent (no additives → should be cider)
  const bc = await db.execute(sql.raw(`
    UPDATE batches SET product_type = 'cider', updated_at = NOW()
    WHERE batch_number = '2024-10-20_UNKN_BLEND_A-R'
      AND product_type = 'wine'
      AND deleted_at IS NULL
    RETURNING id, name, batch_number
  `));
  for (const r of bc.rows as any[]) {
    console.log(`Fixed: ${r.name} (${r.batch_number}) → cider`);
  }

  // Fix "Base Cider" children — none have non-apple/pear fruit, all should be cider
  // These are children of 2024-10-20_UNKN_BLEND_A-R that have product_type = 'wine'
  // but NO "Fruit / Fruit Product" additives
  const bcChildren = await db.execute(sql.raw(`
    UPDATE batches SET product_type = 'cider', updated_at = NOW()
    WHERE parent_batch_id = (
      SELECT id FROM batches WHERE batch_number = '2024-10-20_UNKN_BLEND_A-R' AND deleted_at IS NULL LIMIT 1
    )
    AND product_type = 'wine'
    AND deleted_at IS NULL
    AND id NOT IN (
      SELECT DISTINCT ba.batch_id FROM batch_additives ba
      WHERE ba.additive_type = 'Fruit / Fruit Product'
        AND ba.deleted_at IS NULL
    )
    RETURNING id, name, batch_number
  `));
  for (const r of bcChildren.rows as any[]) {
    console.log(`Fixed child: ${r.name} (${r.batch_number}) → cider`);
  }

  // Also fix racking derivatives that inherited wine from Base Cider but shouldn't be wine
  // These are batches like the Remaining chains
  const bcDerivatives = await db.execute(sql.raw(`
    WITH RECURSIVE descendants AS (
      SELECT id FROM batches
      WHERE batch_number = '2024-10-20_UNKN_BLEND_A-R' AND deleted_at IS NULL
      UNION ALL
      SELECT b.id FROM batches b
      JOIN descendants d ON b.parent_batch_id = d.id
      WHERE b.deleted_at IS NULL
    )
    UPDATE batches SET product_type = 'cider', updated_at = NOW()
    WHERE id IN (SELECT id FROM descendants)
      AND product_type = 'wine'
      AND deleted_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT ba.batch_id FROM batch_additives ba
        WHERE ba.additive_type = 'Fruit / Fruit Product'
          AND ba.deleted_at IS NULL
      )
    RETURNING id, name, batch_number
  `));
  for (const r of bcDerivatives.rows as any[]) {
    console.log(`Fixed descendant: ${r.name} (${r.batch_number}) → cider`);
  }

  console.log("\nDone. Refresh the reconciliation page to verify changes.");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
