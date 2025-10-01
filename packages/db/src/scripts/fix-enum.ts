import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../../.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    console.log('Checking current vessel_status enum values...');
    const currentResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'vessel_status'
      ORDER BY enumsortorder;
    `);

    console.log('Current enum values:');
    currentResult.rows.forEach(row => console.log('  -', row.enumlabel));

    console.log('\nCleaning up any previous migration attempts...');
    try {
      await client.query('DROP TYPE IF EXISTS vessel_status_new;');
      console.log('✓ Cleaned up vessel_status_new type');
    } catch (e) {
      console.log('No cleanup needed');
    }

    console.log('\nUpdating vessel data with deprecated statuses...');

    // Update any existing data that uses old enum values
    await client.query("UPDATE vessels SET status = 'fermenting' WHERE status = 'in_use'");
    await client.query("UPDATE vessels SET status = 'available' WHERE status = 'empty'");
    await client.query("UPDATE vessels SET status = 'aging' WHERE status = 'storing'");

    console.log('✓ Data migration complete');

    console.log('\nCreating new enum type...');
    await client.query(`
      CREATE TYPE vessel_status_new AS ENUM (
        'available',
        'fermenting',
        'cleaning',
        'maintenance',
        'aging'
      );
    `);

    console.log('Removing default constraint from status column...');
    await client.query(`
      ALTER TABLE vessels
        ALTER COLUMN status DROP DEFAULT;
    `);

    console.log('Updating column to use new type...');
    await client.query(`
      ALTER TABLE vessels
        ALTER COLUMN status TYPE vessel_status_new
        USING status::text::vessel_status_new;
    `);

    console.log('Restoring default value...');
    await client.query(`
      ALTER TABLE vessels
        ALTER COLUMN status SET DEFAULT 'available'::vessel_status_new;
    `);

    console.log('Dropping old type and renaming...');
    await client.query('DROP TYPE vessel_status;');
    await client.query('ALTER TYPE vessel_status_new RENAME TO vessel_status;');

    console.log('✓ Enum migration completed successfully!');

    // Verify the enum values
    console.log('\nVerifying new enum values...');
    const result = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'vessel_status'
      ORDER BY enumsortorder;
    `);

    console.log('New vessel_status enum values:');
    result.rows.forEach(row => console.log('  -', row.enumlabel));

    client.release();
  } catch (error) {
    console.error('Error running migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Failed:', error.message);
    process.exit(1);
  });
