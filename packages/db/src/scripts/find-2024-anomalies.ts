import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

async function findAnomalies() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log('Connected.\n');

  const result = await client.query(`
    SELECT
      b.id, b.name, b.start_date,
      b.parent_batch_id IS NOT NULL as has_parent,
      CAST(b.initial_volume_liters AS DECIMAL) as initial_l,
      CAST(b.current_volume_liters AS DECIMAL) as current_l,
      b.vessel_id, b.reconciliation_status,
      v.name as vessel_name,
      COALESCE(t_agg.total_in, 0) as transfers_in_l
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    LEFT JOIN LATERAL (
      SELECT SUM(CAST(t.volume_transferred AS DECIMAL)) as total_in
      FROM batch_transfers t
      WHERE t.destination_batch_id = b.id
    ) t_agg ON true
    WHERE b.deleted_at IS NULL
      AND b.start_date >= '2024-01-01' AND b.start_date <= '2024-12-31'
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
    ORDER BY b.start_date, b.name
  `);

  console.log(`${result.rows.length} batches in 2024:\n`);

  let anomalyCount = 0;
  for (const row of result.rows) {
    const init = parseFloat(row.initial_l || '0');
    const cur = parseFloat(row.current_l || '0');
    const xIn = parseFloat(row.transfers_in_l || '0');
    const ivAnomaly = row.has_parent && init > 0 && xIn >= init * 0.9;
    if (ivAnomaly) anomalyCount++;

    const flags = [];
    if (ivAnomaly) flags.push('IV-ANOMALY');
    if (!row.vessel_id && cur > 0) flags.push('NO-VESSEL');
    const f = flags.length ? `  *** ${flags.join(', ')} ***` : '';

    console.log(`${(row.name || '?').substring(0, 42).padEnd(42)} init=${init.toFixed(1).padStart(7)} cur=${cur.toFixed(1).padStart(7)} parent=${row.has_parent ? 'Y' : 'N'} xfr=${xIn.toFixed(1).padStart(7)} vessel=${(row.vessel_name || '-').padEnd(14)} ${(row.reconciliation_status || 'pending').padEnd(10)}${f}`);
  }

  console.log(`\nTotal anomalies: ${anomalyCount}`);
  client.release();
  await pool.end();
}

findAnomalies().catch(console.error);
