import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Find children of 2024 parents that have start_date AFTER 2024-12-31
  const extraChildren = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.current_volume_liters, b.start_date,
           b.parent_batch_id, b.reconciliation_status,
           COALESCE(pb.custom_name, pb.name) as parent_name, pb.start_date as parent_start
    FROM batches b
    JOIN batches pb ON pb.id = b.parent_batch_id
    WHERE b.deleted_at IS NULL
      AND pb.deleted_at IS NULL
      AND pb.start_date <= '2024-12-31'::timestamptz
      AND b.start_date > '2024-12-31'::timestamptz
      AND b.reconciliation_status IN ('verified', 'pending')
    ORDER BY b.start_date
  `);
  
  console.log(`=== Children of 2024 parents with start_date > 2024-12-31 (${extraChildren.rows.length}) ===\n`);
  for (const r of extraChildren.rows) {
    console.log(`  ${r.name} (${r.product_type}): init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)} gal, start=${r.start_date}, parent=${r.parent_name}`);
  }
  
  // Also check: how does listForReconciliation handle children?
  // Check what the reconciliation query includes for period "2024"
  // Look for batches included via isTransferDerived or parentBatchId logic
  
  // Check for Community Blend #1 children specifically
  const cbChildren = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.start_date, b.reconciliation_status
    FROM batches b
    WHERE b.parent_batch_id = 'e58d6eeb-5168-44a0-914a-5d9a353c73b4'
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `);
  console.log(`\n=== Community Blend #1 children (${cbChildren.rows.length}) ===`);
  for (const r of cbChildren.rows) {
    console.log(`  ${r.name}: start=${r.start_date}, init=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)} gal, status=${r.reconciliation_status}`);
  }
  
  // Check ALL batches included in batchTaxClassMap for 2024
  // The listForReconciliation uses these criteria
  const allBatchesInRecon = await db.execute(sql`
    WITH parent_batches AS (
      SELECT id FROM batches 
      WHERE deleted_at IS NULL AND start_date <= '2024-12-31'::timestamptz
        AND reconciliation_status IN ('verified', 'pending')
    )
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.initial_volume_liters, b.current_volume_liters, b.start_date,
           b.parent_batch_id, b.reconciliation_status
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.reconciliation_status IN ('verified', 'pending')
      AND (
        b.start_date <= '2024-12-31'::timestamptz
        OR b.parent_batch_id IN (SELECT id FROM parent_batches)
      )
    ORDER BY b.start_date
  `);
  
  console.log(`\n=== ALL batches that could be in 2024 recon (parents + their children) ===`);
  console.log(`  Total: ${allBatchesInRecon.rows.length}`);
  let extraTotal = 0;
  for (const r of allBatchesInRecon.rows) {
    const startStr = new Date(r.start_date as string).toISOString().split('T')[0];
    if (startStr > '2024-12-31') {
      const initGal = (Number(r.initial_volume_liters) / 3.78541).toFixed(1);
      const curGal = (Number(r.current_volume_liters) / 3.78541).toFixed(1);
      console.log(`  POST-2024: ${r.name} (${r.product_type}): init=${initGal}, current=${curGal}, start=${startStr}, status=${r.reconciliation_status}`);
      extraTotal += Number(r.initial_volume_liters);
    }
  }
  console.log(`  Post-2024 batch initials: ${(extraTotal/3.78541).toFixed(1)} gal`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
