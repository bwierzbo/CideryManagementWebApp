import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Database configuration
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/cidery_management'

// SSL configuration for production databases like Neon
const isProduction = connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')

// Create connection pool
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
})

// Create Drizzle client
export const db = drizzle(pool, { schema })

// Export schema for use in other files
export * from './schema'

// Export types
export type Database = typeof db