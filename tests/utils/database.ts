/**
 * Database test utilities
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Clean all tables in the test database
 */
export async function cleanDatabase(db: NodePgDatabase): Promise<void> {
  // Get all table names from the schema
  const tables = await db.execute(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'drizzle__migrations'
  `)

  // Truncate all tables with CASCADE to handle foreign key constraints
  if (tables.length > 0) {
    const tableNames = tables.map(t => `"${t.tablename}"`).join(', ')
    await db.execute(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`)
  }
}

/**
 * Create a fresh test database connection
 */
export function createTestDbConnection(connectionString: string) {
  const client = new Client({ connectionString })
  return drizzle(client)
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  maxWaitTime = 5000,
  checkInterval = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  throw new Error(`Condition not met within ${maxWaitTime}ms`)
}