import { chromium, FullConfig } from '@playwright/test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { config } from 'dotenv';
import * as schema from '../../packages/db/src/schema';

// Load environment variables
config({ path: '.env.local' });

/**
 * Global setup for E2E tests
 * - Sets up test database with migrations
 * - Seeds initial test data
 * - Ensures fresh state for each test run
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting E2E test global setup...');

  // Use test database
  const testDbUrl = process.env.TEST_DATABASE_URL ||
    'postgresql://localhost:5432/cidery_management_test';

  // Create connection pool for test database
  const pool = new Pool({
    connectionString: testDbUrl,
    max: 5,
    ssl: false
  });

  const db = drizzle(pool, { schema });

  try {
    console.log('📦 Setting up test database...');

    // Run migrations to ensure schema is up to date
    await migrate(db, { migrationsFolder: './packages/db/migrations' });
    console.log('✅ Database migrations completed');

    // Clean any existing test data
    await cleanDatabase(db);
    console.log('🧹 Database cleaned');

    // Seed test data
    await seedTestData(db);
    console.log('🌱 Test data seeded');

    // Start the dev server if not already running
    if (!process.env.CI) {
      console.log('🌐 Dev server will be started by Playwright web server config');
    }

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }

  console.log('✅ E2E test global setup completed');
}

/**
 * Clean the database by truncating all tables
 */
async function cleanDatabase(db: any): Promise<void> {
  // Note: In a real implementation, we'd want to truncate tables in the correct order
  // to handle foreign key constraints. For now, we'll use CASCADE.
  await db.execute(`
    TRUNCATE TABLE
      users, vendors, apple_varieties, purchases, purchase_items,
      press_runs, press_items, vessels, batches, batch_ingredients,
      batch_measurements, packages, inventory, inventory_transactions,
      batch_costs, cogs_items
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Seed minimal test data for E2E tests
 */
async function seedTestData(db: any): Promise<void> {
  const {
    users,
    vendors,
    appleVarieties
  } = schema;

  // Create test users
  const testUsers = await db.insert(users).values([
    {
      email: 'test-admin@example.com',
      name: 'Test Admin',
      passwordHash: '$2a$10$K7L/VxwjVQj5r0Y8qXqZ8eJVV3Z3rB9uJ5P5YzL2oQNKxS6vZ3rGa', // 'password'
      role: 'admin'
    },
    {
      email: 'test-operator@example.com',
      name: 'Test Operator',
      passwordHash: '$2a$10$K7L/VxwjVQj5r0Y8qXqZ8eJVV3Z3rB9uJ5P5YzL2oQNKxS6vZ3rGa', // 'password'
      role: 'operator'
    },
    {
      email: 'test-viewer@example.com',
      name: 'Test Viewer',
      passwordHash: '$2a$10$K7L/VxwjVQj5r0Y8qXqZ8eJVV3Z3rB9uJ5P5YzL2oQNKxS6vZ3rGa', // 'password'
      role: 'viewer'
    }
  ]).returning();

  // Create test vendors
  await db.insert(vendors).values([
    {
      name: 'Test Orchard',
      contactInfo: {
        phone: '555-0001',
        email: 'test@orchard.com',
        address: '123 Test Street'
      },
      isActive: true
    }
  ]);

  // Create test apple varieties
  await db.insert(appleVarieties).values([
    {
      name: 'Test Apple',
      description: 'Test variety for E2E testing',
      typicalBrix: '14.0',
      notes: 'Used for testing purposes'
    }
  ]);

  console.log(`Seeded ${testUsers.length} test users and basic reference data`);
}

export default globalSetup;