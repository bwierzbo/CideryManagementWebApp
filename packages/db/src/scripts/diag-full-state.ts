import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  // Check all relevant batches and their states
  const tankBatchId = '90b37943-6cb4-4759-b9a8-fe93e877f58d'; // TANK-1000-1 batch
  const ibcBatchId = '2031feb0-4a0f-435a-9623-08270987a564'; // IBC-1000-1 batch

  // 1. All transfers from TANK-1000-1 with destination details
  console.log("=== TANK-1000-1 OUTGOING TRANSFERS ===");
  const tankTransfers = await db.execute(sql.raw(`
    SELECT bt.id, bt.volume_transferred, bt.volume_transferred_unit, bt.transferred_at,
           db.name as dest_batch_name, db.custom_name as dest_custom_name,
           dv.name as dest_vessel, db.status as dest_status,
           db.current_volume as dest_current_vol, db.current_volume_unit as dest_vol_unit,
           db.id as dest_batch_id
    FROM batch_transfers bt
    LEFT JOIN batches db ON db.id = bt.destination_batch_id
    LEFT JOIN vessels dv ON dv.id = bt.destination_vessel_id
    WHERE bt.source_batch_id = '${tankBatchId}' AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at
  `));
  for (const t of tankTransfers.rows as any[]) {
    console.log(`${t.transferred_at} | ${t.volume_transferred}${t.volume_transferred_unit} -> ${t.dest_custom_name || t.dest_batch_name} in ${t.dest_vessel} | status: ${t.dest_status} | vol: ${t.dest_current_vol}${t.dest_vol_unit}`);
  }

  // 2. Check Lavender Salal batch
  console.log("\n=== LAVENDER SALAL BATCHES ===");
  const lavender = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.status, b.current_volume, b.current_volume_unit,
           v.name as vessel_name, b.product_type
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE (b.name ILIKE '%lavender%' OR b.custom_name ILIKE '%lavender%')
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `));
  for (const b of lavender.rows as any[]) {
    console.log(`${b.name} | ${b.custom_name} | vessel: ${b.vessel_name} | vol: ${b.current_volume}${b.current_volume_unit} | status: ${b.status} | type: ${b.product_type} | id: ${b.id}`);
  }

  // 3. Check Strawberry Rhubarb batch
  console.log("\n=== STRAWBERRY RHUBARB BATCHES ===");
  const strawberry = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.status, b.current_volume, b.current_volume_unit,
           v.name as vessel_name, b.product_type
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE (b.name ILIKE '%strawberry%' OR b.custom_name ILIKE '%strawberry%'
           OR b.name ILIKE '%rhubarb%' OR b.custom_name ILIKE '%rhubarb%')
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `));
  for (const b of strawberry.rows as any[]) {
    console.log(`${b.name} | ${b.custom_name} | vessel: ${b.vessel_name} | vol: ${b.current_volume}${b.current_volume_unit} | status: ${b.status} | type: ${b.product_type} | id: ${b.id}`);
  }

  // 4. Check Raspberry Blackberry batch
  console.log("\n=== RASPBERRY BLACKBERRY BATCHES ===");
  const rb = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.status, b.current_volume, b.current_volume_unit,
           v.name as vessel_name, b.product_type
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE (b.name ILIKE '%raspberry%' OR b.custom_name ILIKE '%raspberry%'
           OR b.name ILIKE '%blackberry%' OR b.custom_name ILIKE '%blackberry%')
      AND b.deleted_at IS NULL
    ORDER BY b.start_date
  `));
  for (const b of rb.rows as any[]) {
    console.log(`${b.name} | ${b.custom_name} | vessel: ${b.vessel_name} | vol: ${b.current_volume}${b.current_volume_unit} | status: ${b.status} | type: ${b.product_type} | id: ${b.id}`);
  }

  // 5. Check TANK-120-MIX batches
  console.log("\n=== ALL BATCHES THAT WERE IN TANK-120-MIX ===");
  const mixVessel = await db.execute(sql.raw(`
    SELECT v.id FROM vessels v WHERE v.name = 'TANK-120-MIX'
  `));
  if (mixVessel.rows.length > 0) {
    const mixVesselId = (mixVessel.rows[0] as any).id;
    const mixBatches = await db.execute(sql.raw(`
      SELECT b.id, b.name, b.custom_name, b.status, b.current_volume, b.current_volume_unit,
             v.name as vessel_name, b.product_type, b.start_date
      FROM batches b
      LEFT JOIN vessels v ON v.id = b.vessel_id
      WHERE b.id IN (
        -- Current batches
        SELECT id FROM batches WHERE vessel_id = '${mixVesselId}' AND deleted_at IS NULL
        UNION
        -- Batches that were transferred from this vessel
        SELECT bt.source_batch_id FROM batch_transfers bt
        WHERE bt.source_vessel_id = '${mixVesselId}' AND bt.deleted_at IS NULL
        UNION
        -- Batches that were transferred TO this vessel
        SELECT bt.destination_batch_id FROM batch_transfers bt
        WHERE bt.destination_vessel_id = '${mixVesselId}' AND bt.deleted_at IS NULL
      )
      AND b.deleted_at IS NULL
      ORDER BY b.start_date
    `));
    for (const b of mixBatches.rows as any[]) {
      console.log(`${b.start_date} | ${b.name} | ${b.custom_name} | vessel: ${b.vessel_name} | vol: ${b.current_volume}${b.current_volume_unit} | status: ${b.status} | type: ${b.product_type}`);
    }
  }

  // 6. Check packaging (bottle_runs) for these batches
  console.log("\n=== BOTTLE RUNS FOR RELEVANT BATCHES ===");
  const relevantNames = ['%lavender%', '%strawberry%', '%rhubarb%', '%raspberry%', '%blackberry%'];
  const bottleRuns = await db.execute(sql.raw(`
    SELECT br.id, br.batch_id, br.packaged_at, br.units_produced, br.package_size_ml,
           br.volume_taken, br.volume_taken_unit, br.status,
           b.name as batch_name, b.custom_name as batch_custom_name,
           v.name as vessel_name
    FROM bottle_runs br
    JOIN batches b ON b.id = br.batch_id
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE (b.name ILIKE '%lavender%' OR b.custom_name ILIKE '%lavender%'
           OR b.name ILIKE '%strawberry%' OR b.custom_name ILIKE '%strawberry%'
           OR b.name ILIKE '%rhubarb%' OR b.custom_name ILIKE '%rhubarb%'
           OR b.name ILIKE '%raspberry%' OR b.custom_name ILIKE '%raspberry%'
           OR b.name ILIKE '%blackberry%' OR b.custom_name ILIKE '%blackberry%')
    ORDER BY br.packaged_at
  `));
  console.log(`Found ${bottleRuns.rows.length} bottle runs`);
  for (const br of bottleRuns.rows as any[]) {
    console.log(`${br.packaged_at} | ${br.batch_custom_name || br.batch_name} | ${br.units_produced} units @ ${br.package_size_ml}ml | vol: ${br.volume_taken}${br.volume_taken_unit} | status: ${br.status}`);
  }

  // 7. Check keg fills for these batches
  console.log("\n=== KEG FILLS FOR RELEVANT BATCHES ===");
  const kegFills = await db.execute(sql.raw(`
    SELECT kf.id, kf.batch_id, kf.filled_at, kf.volume_taken, kf.volume_taken_unit,
           kf.status, k.keg_number, k.keg_type,
           b.name as batch_name, b.custom_name as batch_custom_name
    FROM keg_fills kf
    JOIN batches b ON b.id = kf.batch_id
    LEFT JOIN kegs k ON k.id = kf.keg_id
    WHERE (b.name ILIKE '%lavender%' OR b.custom_name ILIKE '%lavender%'
           OR b.name ILIKE '%strawberry%' OR b.custom_name ILIKE '%strawberry%'
           OR b.name ILIKE '%rhubarb%' OR b.custom_name ILIKE '%rhubarb%'
           OR b.name ILIKE '%raspberry%' OR b.custom_name ILIKE '%raspberry%'
           OR b.name ILIKE '%blackberry%' OR b.custom_name ILIKE '%blackberry%')
      AND kf.deleted_at IS NULL
    ORDER BY kf.filled_at
  `));
  console.log(`Found ${kegFills.rows.length} keg fills`);
  for (const kf of kegFills.rows as any[]) {
    console.log(`${kf.filled_at} | ${kf.batch_custom_name || kf.batch_name} | keg ${kf.keg_number} (${kf.keg_type}) | vol: ${kf.volume_taken}${kf.volume_taken_unit} | status: ${kf.status}`);
  }

  // 8. IBC-1000-1 current state
  console.log("\n=== IBC-1000-1 STATE ===");
  const ibcState = await db.execute(sql.raw(`
    SELECT b.id, b.name, b.custom_name, b.initial_volume, b.initial_volume_unit,
           b.current_volume, b.current_volume_unit, b.current_volume_liters,
           b.status, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id = '${ibcBatchId}'
  `));
  const ibc = ibcState.rows[0] as any;
  console.log(`${ibc.name} | ${ibc.custom_name} | vessel: ${ibc.vessel_name}`);
  console.log(`  initial: ${ibc.initial_volume}${ibc.initial_volume_unit} | current: ${ibc.current_volume}${ibc.current_volume_unit} | liters: ${ibc.current_volume_liters}`);

  // Check IBC vessel shows which batch
  const ibcVessel = await db.execute(sql.raw(`
    SELECT v.id, v.name FROM vessels v WHERE v.name = 'IBC-1000-1'
  `));
  if (ibcVessel.rows.length > 0) {
    const ibcVid = (ibcVessel.rows[0] as any).id;
    const ibcActiveBatches = await db.execute(sql.raw(`
      SELECT b.id, b.name, b.custom_name, b.current_volume, b.status
      FROM batches b
      WHERE b.vessel_id = '${ibcVid}' AND b.deleted_at IS NULL AND b.status != 'completed'
    `));
    console.log(`\nActive batches in IBC-1000-1 vessel:`);
    for (const b of ibcActiveBatches.rows as any[]) {
      console.log(`  ${b.name} | ${b.custom_name} | vol: ${b.current_volume} | status: ${b.status}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
