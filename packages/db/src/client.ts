import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Database configuration
// IMPORTANT: Only use DATABASE_URL, ignore POSTGRES_* and PG* variables
const connectionString =
  process.env.DATABASE_URL || "postgresql://localhost:5432/cidery_management";

// Clear conflicting environment variables that pg might use
if (process.env.DATABASE_URL) {
  // These variables can override DATABASE_URL if set
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_USER;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.POSTGRES_DATABASE;
}

// SSL configuration for production databases like Neon
const isProduction =
  connectionString.includes("neon.tech") ||
  connectionString.includes("sslmode=require");

// Create connection pool
const pool = new Pool({
  connectionString,
  max: 25, // Increased pool size for better concurrency
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000, // Increased from 2s to 8s for cloud databases
  query_timeout: 15000, // 15s query timeout
  keepAlive: true, // Enable TCP keepalive
  keepAliveInitialDelayMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Add connection pool monitoring
pool.on("connect", () => {
  console.log("✅ New database connection established");
});

pool.on("error", (err) => {
  console.error("❌ Database pool error:", err);
});

pool.on("remove", () => {
  console.log("🔄 Connection removed from pool");
});

// Create Drizzle client
export const db = drizzle(pool, { schema });

// Export schema for use in other files
export * from "./schema";

// Export types
export type Database = typeof db;
