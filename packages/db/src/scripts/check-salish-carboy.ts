import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Find the Salish batch in CARBOY-5G-1
  const carboy = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.product_type, b.status,
           b.initial_volume_liters, b.current_volume_liters,
           b.parent_batch_id, b.is_racking_derivative,
           b.reconciliation_status, b.deleted_at, b.start_date,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE v.name = 'CARBOY-5G-1'
    AND b.deleted_at IS NULL
    ORDER BY b.start_date DESC
    LIMIT 5
  `));
  console.log("=== Batches in CARBOY-5G-1 ===");
  for (const r of carboy.rows) {
    console.log(JSON.stringify(r, null, 2));
  }

  // 2. Find the parent Salish (2024-11-28_120 Barrel 2_BLEND_A)
  const parent = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.product_type, b.status,
           b.initial_volume_liters, b.current_volume_liters,
           b.parent_batch_id, b.is_racking_derivative,
           b.reconciliation_status, b.deleted_at, b.start_date,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.name LIKE '2024-11-28_120 Barrel 2_BLEND_A%'
    AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `));
  console.log("\n=== Parent Salish and derivatives ===");
  for (const r of parent.rows) {
    console.log(`${r.name} | ${r.custom_name} | type=${r.product_type} | status=${r.status} | init=${r.initial_volume_liters} | curr=${r.current_volume_liters} | recon=${r.reconciliation_status} | parent=${r.parent_batch_id} | racking=${r.is_racking_derivative} | vessel=${r.vessel_name}`);
  }

  // 3. Find ALL children of the parent Salish
  if (parent.rows.length > 0) {
    const parentId = parent.rows[0].id;
    console.log("\n=== All children of parent Salish (" + parentId + ") ===");
    
    // Direct children
    const children = await db.execute(sql.raw(`
      SELECT b.id, b.name, b.custom_name, b.product_type, b.status,
             b.initial_volume_liters, b.current_volume_liters,
             b.parent_batch_id, b.is_racking_derivative,
             b.reconciliation_status, b.deleted_at,
             v.name as vessel_name
      FROM batches b
      LEFT JOIN vessels v ON b.vessel_id = v.id
      WHERE b.parent_batch_id = '${parentId}'
      ORDER BY b.start_date
    `));
    for (const r of children.rows) {
      console.log(`${r.name} | ${r.custom_name} | type=${r.product_type} | status=${r.status} | init=${r.initial_volume_liters} | curr=${r.current_volume_liters} | recon=${r.reconciliation_status} | deleted=${r.deleted_at || 'NO'} | racking=${r.is_racking_derivative} | vessel=${r.vessel_name}`);
    }

    // Also check grandchildren
    for (const child of children.rows) {
      const grandchildren = await db.execute(sql.raw(`
        SELECT b.id, b.name, b.custom_name, b.product_type, b.status,
               b.initial_volume_liters, b.current_volume_liters,
               b.parent_batch_id, b.is_racking_derivative,
               b.reconciliation_status, b.deleted_at,
               v.name as vessel_name
        FROM batches b
        LEFT JOIN vessels v ON b.vessel_id = v.id
        WHERE b.parent_batch_id = '${child.id}'
        ORDER BY b.start_date
      `));
      if (grandchildren.rows.length > 0) {
        console.log(`\n  Children of ${child.custom_name || child.name}:`);
        for (const gc of grandchildren.rows) {
          console.log(`    ${gc.name} | ${gc.custom_name} | type=${gc.product_type} | status=${gc.status} | init=${gc.initial_volume_liters} | curr=${gc.current_volume_liters} | recon=${gc.reconciliation_status} | deleted=${gc.deleted_at || 'NO'} | racking=${gc.is_racking_derivative} | vessel=${gc.vessel_name}`);
        }
      }
    }
  }

  // 4. Check eligibility criteria for reconciliation
  console.log("\n=== Reconciliation eligibility check ===");
  console.log("Eligible batches are: NOT deleted, NOT (excluded OR duplicate UNLESS racking_derivative OR has parent_batch_id), NOT juice product_type");
  
  // Find the specific Salish in CARBOY-5G-1 by custom_name
  const salishCarboy = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.product_type,
           b.initial_volume_liters, b.current_volume_liters,
           b.parent_batch_id, b.is_racking_derivative,
           b.reconciliation_status, b.deleted_at,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE (b.custom_name ILIKE '%Salish%' OR b.name ILIKE '%Salish%')
    AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `));
  console.log("\nAll non-deleted Salish batches:");
  for (const r of salishCarboy.rows) {
    const eligible = (r.reconciliation_status !== 'duplicate' && r.reconciliation_status !== 'excluded') 
      || r.is_racking_derivative === true 
      || r.parent_batch_id !== null;
    console.log(`${r.name} | ${r.custom_name} | init=${r.initial_volume_liters} | curr=${r.current_volume_liters} | recon=${r.reconciliation_status} | parent=${r.parent_batch_id ? 'YES' : 'NO'} | racking=${r.is_racking_derivative} | vessel=${r.vessel_name} | ELIGIBLE=${eligible}`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
