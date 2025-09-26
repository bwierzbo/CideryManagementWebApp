/**
 * Database connection configuration optimized for packaging operations
 *
 * This module provides optimized connection pooling and query configuration
 * for high-performance packaging operations that involve frequent reads and writes.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../schema'

// Connection pool configuration optimized for packaging workload
export const connectionConfig = {
  // Connection pool settings
  max: 20, // Maximum connections in pool
  idle_timeout: 20, // Seconds to wait before closing idle connections
  connect_timeout: 10, // Seconds to wait for connection

  // Query optimization settings
  prepare: true, // Use prepared statements for better performance
  transform: postgres.camel, // Convert snake_case to camelCase

  // Performance settings for packaging operations
  keep_alive: 30, // Keep connections alive for 30 seconds
  max_lifetime: 60 * 30, // Maximum connection lifetime (30 minutes)

  // Packaging-specific optimizations
  application_name: 'cidery-packaging', // For monitoring
  search_path: 'public', // Default schema

  // Connection retry settings
  connection: {
    options: '--lock_timeout=5000 --statement_timeout=30000' // 30 second query timeout
  }
}

/**
 * Create optimized database connection for packaging operations
 */
export function createPackagingConnection(connectionString: string) {
  const sql = postgres(connectionString, connectionConfig)

  return drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === 'development'
  })
}

/**
 * Query hints for PostgreSQL optimization
 * These can be used with sql templates for fine-tuned performance
 */
export const queryHints = {
  // Force index usage for packaging runs queries
  usePackagingRunsIndex: 'SET enable_seqscan = off',

  // Optimize for fast cursor pagination
  optimizeForCursor: 'SET work_mem = "64MB"',

  // Settings for large result sets
  optimizeForLargeResults: 'SET effective_cache_size = "1GB"',

  // Reset to defaults
  resetHints: 'RESET enable_seqscan; RESET work_mem; RESET effective_cache_size'
}

/**
 * Connection health check for monitoring
 */
export async function checkConnectionHealth(db: any): Promise<{
  healthy: boolean
  latency: number
  poolStats?: any
}> {
  const start = Date.now()

  try {
    // Simple query to test connection
    await db.execute(sql`SELECT 1`)

    const latency = Date.now() - start

    return {
      healthy: true,
      latency,
      // Pool stats would need to be implemented based on the postgres client
    }
  } catch (error) {
    console.error('Database health check failed:', error)
    return {
      healthy: false,
      latency: Date.now() - start
    }
  }
}

/**
 * Query performance monitoring
 */
export interface QueryPerformanceLog {
  query: string
  duration: number
  rowCount?: number
  indexesUsed?: string[]
  timestamp: Date
}

const queryPerformanceLogs: QueryPerformanceLog[] = []
const MAX_LOG_ENTRIES = 1000

export function logQueryPerformance(log: QueryPerformanceLog) {
  queryPerformanceLogs.push(log)

  // Keep only recent entries
  if (queryPerformanceLogs.length > MAX_LOG_ENTRIES) {
    queryPerformanceLogs.shift()
  }

  // Log slow queries
  if (log.duration > 1000) {
    console.warn(`Slow query detected: ${log.query} took ${log.duration}ms`)
  }
}

export function getQueryPerformanceStats() {
  const recent = queryPerformanceLogs.slice(-100) // Last 100 queries

  if (recent.length === 0) {
    return { avgDuration: 0, slowQueries: [], totalQueries: 0 }
  }

  const avgDuration = recent.reduce((sum, log) => sum + log.duration, 0) / recent.length
  const slowQueries = recent.filter(log => log.duration > 500)

  return {
    avgDuration: Math.round(avgDuration),
    slowQueries: slowQueries.map(log => ({
      query: log.query,
      duration: log.duration,
      timestamp: log.timestamp
    })),
    totalQueries: queryPerformanceLogs.length
  }
}

/**
 * Transaction wrapper with performance monitoring
 */
export async function withMonitoredTransaction<T>(
  db: any,
  operation: string,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  const start = Date.now()

  try {
    const result = await db.transaction(fn)

    const duration = Date.now() - start
    logQueryPerformance({
      query: `TRANSACTION: ${operation}`,
      duration,
      timestamp: new Date()
    })

    return result
  } catch (error) {
    const duration = Date.now() - start
    logQueryPerformance({
      query: `TRANSACTION FAILED: ${operation}`,
      duration,
      timestamp: new Date()
    })

    throw error
  }
}