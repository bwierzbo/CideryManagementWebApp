import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load Vercel environment
dotenv.config({ path: '.env.vercel.test' });

async function testAuth() {
  const email = 'swierzbo@yahoo.com';
  const password = 'Fynnhaven24!';

  console.log('Testing Vercel database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 60) + '...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Query for user
    console.log(`\nQuerying for user: ${email}`);
    const result = await client.query(
      'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length === 0) {
      console.error('❌ User not found in database!');
      client.release();
      return;
    }

    const user = result.rows[0];
    console.log('✅ User found:', {
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      hasPasswordHash: !!user.password_hash,
    });

    // Test password
    console.log('\nTesting password...');
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValid);

    if (!isValid) {
      console.error('❌ Password does not match!');
    } else {
      console.log('✅ Password matches! Auth should work.');
    }

    client.release();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAuth();
