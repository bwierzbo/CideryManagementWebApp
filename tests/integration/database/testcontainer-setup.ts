/**
 * Integration test database setup using PostgreSQL testcontainers
 */
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cleanDatabase } from '../../utils/database'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from 'db/src/schema'

let globalContainer: StartedPostgreSqlContainer | null = null
let globalDb: NodePgDatabase | null = null
let globalClient: Client | null = null

/**
 * Start PostgreSQL container and run migrations
 */
export async function setupTestDatabase(): Promise<{
  container: StartedPostgreSqlContainer
  db: NodePgDatabase
  client: Client
  connectionString: string
}> {
  if (globalContainer && globalDb && globalClient) {
    // Clean the existing database for test isolation
    await cleanDatabase(globalDb)
    return {
      container: globalContainer,
      db: globalDb,
      client: globalClient,
      connectionString: globalContainer.getConnectionUri()
    }
  }

  console.log('Starting PostgreSQL testcontainer...')

  const container = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('cidery_test')
    .withUsername('test_user')
    .withPassword('test_password')
    .withExposedPorts(5432)
    .withStartupTimeout(120000) // 2 minutes
    .start()

  const connectionString = container.getConnectionUri()
  console.log(`PostgreSQL testcontainer started: ${connectionString}`)

  const client = new Client({ connectionString })
  await client.connect()

  const db = drizzle(client, { schema })

  // Run migrations to set up the schema
  console.log('Running database migrations...')
  try {
    await migrate(db, { migrationsFolder: './packages/db/migrations' })
    console.log('Database migrations completed successfully')
  } catch (error) {
    console.error('Migration error:', error)
    throw error
  }

  // Store globally for reuse
  globalContainer = container
  globalDb = db
  globalClient = client

  return { container, db, client, connectionString }
}

/**
 * Clean up the test database container
 */
export async function teardownTestDatabase(): Promise<void> {
  if (globalClient) {
    await globalClient.end()
    globalClient = null
  }

  if (globalContainer) {
    await globalContainer.stop()
    globalContainer = null
  }

  globalDb = null
  console.log('Test database container stopped')
}

/**
 * Get current test database connection (must call setupTestDatabase first)
 */
export function getTestDatabase(): {
  db: NodePgDatabase
  client: Client
  connectionString: string
} {
  if (!globalDb || !globalClient || !globalContainer) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }

  return {
    db: globalDb,
    client: globalClient,
    connectionString: globalContainer.getConnectionUri()
  }
}

/**
 * Create fresh test data for integration tests
 */
export async function seedTestData(db: NodePgDatabase): Promise<{
  vendorIds: string[]
  appleVarietyIds: string[]
  vesselIds: string[]
  userIds: string[]
}> {
  const { testVendors, testUsers, testRefValues, testBatches } = await import('../../fixtures/cidery-data')

  // Insert vendors
  const vendors = await db.insert(schema.vendors).values(
    testVendors.map(v => ({
      id: v.id,
      name: v.name,
      contactInfo: { email: v.contactInfo },
      isActive: v.isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  ).returning()

  // Insert apple varieties
  const appleVarieties = await db.insert(schema.appleVarieties).values([
    {
      id: 'variety-honeycrisp',
      name: 'Honeycrisp',
      description: 'Sweet and crisp apple variety',
      typicalBrix: '12.5',
      notes: 'High sugar content',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'variety-granny-smith',
      name: 'Granny Smith',
      description: 'Tart green apple',
      typicalBrix: '11.2',
      notes: 'Good for blending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]).returning()

  // Insert vessels
  const vessels = await db.insert(schema.vessels).values([
    {
      id: 'vessel-fermenter-1',
      name: 'Fermenter Tank 1',
      type: 'fermenter',
      capacityL: '1000',
      status: 'available',
      location: 'Cellar A',
      notes: 'Primary fermenter',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'vessel-conditioning-1',
      name: 'Conditioning Tank 1',
      type: 'conditioning_tank',
      capacityL: '800',
      status: 'available',
      location: 'Cellar B',
      notes: 'Secondary conditioning',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'vessel-bright-1',
      name: 'Bright Tank 1',
      type: 'bright_tank',
      capacityL: '500',
      status: 'available',
      location: 'Packaging Area',
      notes: 'Final conditioning before packaging',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]).returning()

  // Insert test users with proper password hashing
  const bcrypt = await import('bcryptjs')
  const hashedPassword = await bcrypt.hash('test123', 10)

  const users = await db.insert(schema.users).values([
    {
      id: 'user-admin',
      email: 'admin@cidery.com',
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'user-operator',
      email: 'operator@cidery.com',
      name: 'Operator User',
      passwordHash: hashedPassword,
      role: 'operator',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]).returning()

  return {
    vendorIds: vendors.map(v => v.id),
    appleVarietyIds: appleVarieties.map(av => av.id),
    vesselIds: vessels.map(v => v.id),
    userIds: users.map(u => u.id)
  }
}