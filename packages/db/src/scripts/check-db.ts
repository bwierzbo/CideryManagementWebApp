import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../../.env') });

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log('✓ Connected successfully!\n');

    // Check vendors table
    console.log('Checking vendors table...');
    const vendorResult = await client.query('SELECT COUNT(*) FROM vendors WHERE deleted_at IS NULL');
    console.log(`  - Vendors: ${vendorResult.rows[0].count}`);

    // Check vessels table
    console.log('Checking vessels table...');
    const vesselResult = await client.query('SELECT COUNT(*), status FROM vessels WHERE deleted_at IS NULL GROUP BY status');
    console.log('  - Vessels by status:');
    vesselResult.rows.forEach(row => console.log(`    - ${row.status}: ${row.count}`));

    // Check press runs
    console.log('Checking apple_press_runs table...');
    const pressRunResult = await client.query('SELECT COUNT(*) FROM apple_press_runs WHERE deleted_at IS NULL');
    console.log(`  - Press runs: ${pressRunResult.rows[0].count}`);

    // Check database connection settings
    console.log('\nDatabase info:');
    const dbInfo = await client.query('SELECT current_database(), current_user');
    console.log(`  - Database: ${dbInfo.rows[0].current_database}`);
    console.log(`  - User: ${dbInfo.rows[0].current_user}`);

    // Test a simple vendor list query (same as API)
    console.log('\nTesting vendor list query (like API does)...');
    const testQuery = await client.query(`
      SELECT
        id,
        name,
        contact_info as "contactInfo",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM vendors
      WHERE deleted_at IS NULL
      ORDER BY name ASC
      LIMIT 10
    `);
    console.log(`  - Query returned ${testQuery.rows.length} vendors`);
    if (testQuery.rows.length > 0) {
      console.log('  - First vendor:', testQuery.rows[0].name);
      console.log('  - Contact info:', testQuery.rows[0].contactInfo);
    }

    client.release();
  } catch (error) {
    console.error('✗ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkDatabase()
  .then(() => {
    console.log('\n✓ Database check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Database check failed:', error.message);
    process.exit(1);
  });
