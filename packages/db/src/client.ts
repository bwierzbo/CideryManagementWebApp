import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Database configuration
const connectionString =
  process.env.DATABASE_URL || "postgresql://localhost:5432/cidery_management";

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
