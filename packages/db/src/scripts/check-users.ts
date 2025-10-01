import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

async function checkUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();

    console.log('Checking users table...');
    const usersResult = await client.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    console.log(`Total users: ${usersResult.rows[0].count}`);

    const activeUsers = await client.query('SELECT email, role, is_active FROM users WHERE deleted_at IS NULL LIMIT 5');
    console.log('\nActive users:');
    activeUsers.rows.forEach(user =>
      console.log(`  - ${user.email} (${user.role}) - Active: ${user.is_active}`)
    );

    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();
