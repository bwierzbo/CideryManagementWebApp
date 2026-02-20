import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

async function fixAnomalies() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  console.log('Connected.\n');

  // Find transfer-derived batches with initial volume anomaly
  const anomalies = await client.query(`
    SELECT b.id, b.name, CAST(b.initial_volume_liters AS DECIMAL) as init_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.parent_batch_id IS NOT NULL
      AND CAST(b.initial_volume_liters AS DECIMAL) > 0
      AND b.start_date >= '2024-01-01' AND b.start_date <= '2024-12-31'
      AND EXISTS (
        SELECT 1 FROM batch_transfers t
        WHERE t.destination_batch_id = b.id
        GROUP BY t.destination_batch_id
        HAVING SUM(CAST(t.volume_transferred AS DECIMAL)) >= CAST(b.initial_volume_liters AS DECIMAL) * 0.9
      )
  `);

  console.log(`Found ${anomalies.rows.length} anomaly batches:\n`);
  for (const row of anomalies.rows) {
    console.log(`  ${row.name} (init=${row.init_l}L) → setting initial_volume_liters = 0`);
  }

  if (anomalies.rows.length === 0) {
    console.log('Nothing to fix.');
    client.release();
    await pool.end();
    return;
  }

  const ids = anomalies.rows.map(r => r.id);
  const result = await client.query(`
    UPDATE batches
    SET initial_volume_liters = '0'
    WHERE id = ANY($1::uuid[])
  `, [ids]);

  console.log(`\nUpdated ${result.rowCount} batches.`);

  client.release();
  await pool.end();
}

fixAnomalies().catch(console.error);
