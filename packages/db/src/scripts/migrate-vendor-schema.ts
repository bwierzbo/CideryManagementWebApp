import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../../.env') });

async function migrateVendorSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log('✓ Connected successfully!\n');

    // Check if migration is needed
    console.log('Checking current vendor table structure...');
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'vendors'
      ORDER BY ordinal_position;
    `);

    const columns = columnsResult.rows.map(row => row.column_name);
    console.log('Current columns:', columns.join(', '));

    if (columns.includes('contact_info')) {
      console.log('\n✓ Vendor table already has contact_info column. No migration needed.');
      client.release();
      return;
    }

    if (!columns.includes('contact_name')) {
      console.log('\n✓ Vendor table has neither old nor new schema. Skipping migration.');
      client.release();
      return;
    }

    console.log('\nMigration needed. Starting...\n');

    // Add the contact_info column
    console.log('Adding contact_info JSONB column...');
    await client.query(`
      ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS contact_info jsonb;
    `);
    console.log('✓ Column added');

    // Migrate data from individual columns to JSONB
    console.log('\nMigrating data to JSONB format...');
    await client.query(`
      UPDATE vendors
      SET contact_info = jsonb_build_object(
        'name', COALESCE(contact_name, ''),
        'email', COALESCE(email, ''),
        'phone', COALESCE(phone, ''),
        'address', COALESCE(address, ''),
        'city', COALESCE(city, ''),
        'stateProvince', COALESCE(state_province, ''),
        'postalCode', COALESCE(postal_code, ''),
        'country', COALESCE(country, ''),
        'notes', COALESCE(notes, '')
      )
      WHERE contact_info IS NULL;
    `);
    console.log('✓ Data migrated');

    // Drop old columns
    console.log('\nDropping old columns...');
    const oldColumns = [
      'contact_name',
      'email',
      'phone',
      'address',
      'city',
      'state_province',
      'postal_code',
      'country',
      'notes'
    ];

    for (const col of oldColumns) {
      if (columns.includes(col)) {
        await client.query(`ALTER TABLE vendors DROP COLUMN IF EXISTS ${col};`);
        console.log(`  ✓ Dropped ${col}`);
      }
    }

    console.log('\n✓ Schema migration completed successfully!');

    // Verify the new structure
    console.log('\nVerifying new structure...');
    const newColumnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'vendors'
      ORDER BY ordinal_position;
    `);

    console.log('New vendor table columns:');
    newColumnsResult.rows.forEach(row =>
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    );

    // Test query
    console.log('\nTesting vendor query...');
    const testQuery = await client.query(`
      SELECT id, name, contact_info, is_active
      FROM vendors
      WHERE deleted_at IS NULL
      LIMIT 3;
    `);
    console.log(`✓ Query returned ${testQuery.rows.length} vendors`);
    if (testQuery.rows.length > 0) {
      console.log('Sample vendor:', JSON.stringify(testQuery.rows[0], null, 2));
    }

    client.release();
  } catch (error) {
    console.error('✗ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateVendorSchema()
  .then(() => {
    console.log('\n✓ Vendor schema migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Vendor schema migration failed:', error.message);
    process.exit(1);
  });
