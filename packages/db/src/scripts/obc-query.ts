import { db } from '../';
import { sql } from 'drizzle-orm';

async function main() {
  const obcBatches = await db.execute(sql`
    SELECT id, custom_name, name, origin_press_run_id,
           initial_volume_liters, current_volume_liters, status
    FROM batches WHERE custom_name ILIKE '%OBC%'
    ORDER BY custom_name
  `);

  for (const obc of obcBatches.rows as any[]) {
    console.log(`\n=== ${obc.custom_name} ===`);
    console.log(`  Status: ${obc.status}, Volume: ${obc.initial_volume_liters}L → ${obc.current_volume_liters}L`);

    if (!obc.origin_press_run_id) {
      console.log('  No press run linked');
      continue;
    }

    // Get press run loads with fruit variety info via purchase items
    const loads = await db.execute(sql`
      SELECT
        prl.apple_weight_kg,
        prl.load_sequence,
        bfv.name AS variety_name,
        bpi_variety.name AS purchase_variety_name
      FROM press_run_loads prl
      LEFT JOIN base_fruit_varieties bfv ON bfv.id = prl.fruit_variety_id
      LEFT JOIN basefruit_purchase_items bpi ON bpi.id = prl.purchase_item_id
      LEFT JOIN base_fruit_varieties bpi_variety ON bpi_variety.id = bpi.fruit_variety_id
      WHERE prl.press_run_id = ${obc.origin_press_run_id}
      ORDER BY prl.apple_weight_kg DESC
    `);

    if (loads.rows.length > 0) {
      console.log('  Fruit composition (from press loads):');
      let totalKg = 0;
      for (const l of loads.rows as any[]) {
        totalKg += parseFloat(l.apple_weight_kg || '0');
      }
      for (const l of loads.rows as any[]) {
        const kg = parseFloat(l.apple_weight_kg || '0');
        const pct = totalKg > 0 ? ((kg / totalKg) * 100).toFixed(1) : '?';
        const variety = l.variety_name || l.purchase_variety_name || 'Unknown';
        console.log(`    ${variety}: ${kg.toFixed(1)} kg (${pct}%)`);
      }
      console.log(`    Total: ${totalKg.toFixed(1)} kg`);
    } else {
      // Try purchase items linked via depleted_in_press_run
      const items = await db.execute(sql`
        SELECT bpi.quantity_kg, bfv.name AS variety_name
        FROM basefruit_purchase_items bpi
        LEFT JOIN base_fruit_varieties bfv ON bfv.id = bpi.fruit_variety_id
        WHERE bpi.depleted_in_press_run = ${obc.origin_press_run_id}
        ORDER BY bpi.quantity_kg DESC
      `);
      if (items.rows.length > 0) {
        console.log('  Fruit composition (from depleted purchases):');
        let totalKg = 0;
        for (const i of items.rows as any[]) {
          totalKg += parseFloat(i.quantity_kg || '0');
        }
        for (const i of items.rows as any[]) {
          const kg = parseFloat(i.quantity_kg || '0');
          const pct = totalKg > 0 ? ((kg / totalKg) * 100).toFixed(1) : '?';
          console.log(`    ${i.variety_name || 'Unknown'}: ${kg.toFixed(1)} kg (${pct}%)`);
        }
      } else {
        console.log('  No fruit data found for this press run');
      }
    }
  }

  process.exit(0);
}
main();
