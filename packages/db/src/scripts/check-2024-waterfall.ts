import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Check distillation records in 2024
  const distillation = await db.execute(sql`
    SELECT dr.source_batch_id, b.name, b.custom_name, b.product_type,
           dr.source_volume_liters, dr.sent_at, dr.status
    FROM distillation_records dr
    JOIN batches b ON b.id = dr.source_batch_id
    WHERE dr.deleted_at IS NULL AND dr.status IN ('sent', 'received')
      AND dr.sent_at::date <= '2024-12-31'
    ORDER BY dr.sent_at
  `);
  console.log("=== Distillation records in 2024 ===");
  for (const r of distillation.rows) {
    const gal = (Number(r.source_volume_liters) / 3.78541).toFixed(1);
    console.log(`  ${r.custom_name || r.name} (${r.product_type}): ${gal} gal on ${r.sent_at}`);
  }
  const distTotal = distillation.rows.reduce((s: number, r: any) => s + Number(r.source_volume_liters), 0);
  console.log(`  Total: ${distTotal.toFixed(1)} L = ${(distTotal / 3.78541).toFixed(1)} gal\n`);

  // Check what SBD opening/ending looks like for batches at 2024-12-31
  const batchSummary = await db.execute(sql`
    SELECT b.product_type, 
           COUNT(*) as batch_count,
           SUM(b.initial_volume_liters) as total_initial_l,
           SUM(b.current_volume_liters) as total_current_l
    FROM batches b
    WHERE b.deleted_at IS NULL 
      AND b.start_date <= '2024-12-31'
      AND b.reconciliation_status IN ('verified', 'pending')
    GROUP BY b.product_type
    ORDER BY b.product_type
  `);
  console.log("=== Batches started by 2024-12-31 (verified/pending) ===");
  for (const r of batchSummary.rows) {
    const initialGal = (Number(r.total_initial_l) / 3.78541).toFixed(1);
    const currentGal = (Number(r.total_current_l) / 3.78541).toFixed(1);
    console.log(`  ${r.product_type}: ${r.batch_count} batches, initial=${initialGal} gal, current=${currentGal} gal`);
  }

  // Check the "For Distillery" batch specifically
  const forDistillery = await db.execute(sql`
    SELECT b.id, b.name, b.custom_name, b.product_type, b.start_date,
           b.initial_volume_liters, b.current_volume_liters, b.reconciliation_status
    FROM batches b
    WHERE (b.name ILIKE '%distillery%' OR b.custom_name ILIKE '%distillery%')
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `);
  console.log("\n=== 'For Distillery' batches ===");
  for (const r of forDistillery.rows) {
    console.log(`  ${r.custom_name || r.name}: type=${r.product_type}, start=${r.start_date}, initial=${(Number(r.initial_volume_liters)/3.78541).toFixed(1)} gal, current=${(Number(r.current_volume_liters)/3.78541).toFixed(1)} gal, status=${r.reconciliation_status}`);
  }

  // Check transfers INTO "For Distillery" batches in 2024
  const forDistilleryTransfers = await db.execute(sql`
    SELECT bt.destination_batch_id, bt.source_batch_id, bt.volume_transferred, bt.transferred_at,
           sb.name as source_name, sb.custom_name as source_custom_name,
           db2.name as dest_name, db2.custom_name as dest_custom_name
    FROM batch_transfers bt
    JOIN batches db2 ON db2.id = bt.destination_batch_id
    JOIN batches sb ON sb.id = bt.source_batch_id
    WHERE bt.deleted_at IS NULL
      AND (db2.name ILIKE '%distillery%' OR db2.custom_name ILIKE '%distillery%')
      AND bt.transferred_at::date <= '2024-12-31'
    ORDER BY bt.transferred_at
  `);
  console.log("\n=== Transfers INTO 'For Distillery' in 2024 ===");
  for (const r of forDistilleryTransfers.rows) {
    const gal = (Number(r.volume_transferred) / 3.78541).toFixed(1);
    console.log(`  From ${r.source_custom_name || r.source_name} → ${r.dest_custom_name || r.dest_name}: ${gal} gal on ${r.transferred_at}`);
  }

  // What was the configured 2024 ending / 2025 opening?
  const settings = await db.execute(sql`
    SELECT ttb_opening_balances, ttb_opening_balance_date
    FROM organization_settings LIMIT 1
  `);
  console.log("\n=== Configured TTB Opening Balance ===");
  const balances = settings.rows[0]?.ttb_opening_balances as any;
  console.log(`  Date: ${settings.rows[0]?.ttb_opening_balance_date}`);
  console.log(`  Bulk HC: ${balances?.bulk?.hardCider} gal`);
  console.log(`  Bulk W<16: ${balances?.bulk?.wineUnder16} gal`);
  console.log(`  Bulk W16-21: ${balances?.bulk?.wine16To21} gal`);
  console.log(`  Bottled W16-21: ${balances?.bottled?.wine16To21} gal`);
  console.log(`  Spirits: ${balances?.spirits?.appleBrandy} gal`);
  const totalConfigured = Number(balances?.bulk?.hardCider || 0) + Number(balances?.bulk?.wineUnder16 || 0) + Number(balances?.bulk?.wine16To21 || 0) + Number(balances?.bottled?.wine16To21 || 0) + Number(balances?.spirits?.appleBrandy || 0);
  console.log(`  Total configured: ${totalConfigured} gal`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
