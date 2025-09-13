import { beforeAll, afterAll, vi } from 'vitest'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'path'

let pgContainer: StartedPostgreSqlContainer
let testDb: ReturnType<typeof drizzle>
let dbClient: Client

declare global {
  var __TEST_DB__: ReturnType<typeof drizzle>
  var __TEST_DB_CLIENT__: Client
}

beforeAll(async () => {
  // Start PostgreSQL test container
  pgContainer = await new PostgreSqlContainer()
    .withDatabase('test_cidery')
    .withUsername('test_user')
    .withPassword('test_password')
    .start()

  // Create database client
  dbClient = new Client({
    host: pgContainer.getHost(),
    port: pgContainer.getPort(),
    database: pgContainer.getDatabase(),
    username: pgContainer.getUsername(),
    password: pgContainer.getPassword(),
  })

  await dbClient.connect()

  // Initialize Drizzle
  testDb = drizzle(dbClient)

  // Run migrations
  const migrationsPath = path.join(__dirname, '../migrations')
  try {
    await migrate(testDb, { migrationsFolder: migrationsPath })
  } catch (error) {
    // If no migrations exist yet, that's okay for initial setup
    console.warn('No migrations found or migration failed:', error)
  }

  // Make test database available globally
  global.__TEST_DB__ = testDb
  global.__TEST_DB_CLIENT__ = dbClient

  // Set test environment
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = pgContainer.getConnectionUri()
}, 60000)

afterAll(async () => {
  // Cleanup
  await dbClient?.end()
  await pgContainer?.stop()
  vi.restoreAllMocks()
}, 30000)