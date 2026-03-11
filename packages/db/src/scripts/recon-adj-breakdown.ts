import { db } from '../client';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql.raw(`
    SELECT b.id, COALESCE(b.custom_name, b.name) as name, b.product_type,
           b.reconciliation_status, b.is_racking_derivative,
           round(b.initial_volume_liters::numeric, 2) as init_l,
           round(b.current_volume_liters::numeric, 2) as curr_l,
           b.parent_batch_id,
           v.name as vessel
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.deleted_at IS NULL
      AND b.product_type NOT IN ('brandy', 'juice')
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND round(b.current_volume_liters::numeric, 2) > 0
    ORDER BY b.product_type, b.name
  `));

  console.log('=== Active batches with volume (eligible for reconciliation) ===');
  console.log('Count:', result.rows.length);

  // Group by product type
  const byType: Record<string, { count: number; totalCurr: number; batches: any[] }> = {};
  for (const r of result.rows) {
    const pt = (r as any).product_type || 'unknown';
    if (byType[pt] === undefined) {
      byType[pt] = { count: 0, totalCurr: 0, batches: [] };
    }
    byType[pt].count++;
    byType[pt].totalCurr += Number((r as any).curr_l);
    byType[pt].batches.push(r);
  }

  for (const [pt, data] of Object.entries(byType)) {
    console.log(`\n--- ${pt} (${data.count} batches, ${(data.totalCurr / 3.78541).toFixed(1)} gal total) ---`);
    for (const b of data.batches) {
      console.log(`  ${b.name}: ${Number(b.curr_l).toFixed(1)}L (${(Number(b.curr_l) / 3.78541).toFixed(1)} gal) [${b.reconciliation_status || 'pending'}] ${b.vessel || 'no vessel'}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
