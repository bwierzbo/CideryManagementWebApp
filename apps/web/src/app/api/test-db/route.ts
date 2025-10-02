import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const response = {
    environment: {
      DATABASE_URL: process.env.DATABASE_URL ? "Set" : "Not set",
      DATABASE_URL_preview: process.env.DATABASE_URL?.substring(0, 60) + "...",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "Set" : "Not set",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "Not set",
      // Check for conflicting variables
      POSTGRES_HOST: process.env.POSTGRES_HOST || "Not set",
      POSTGRES_URL: process.env.POSTGRES_URL || "Not set",
      PGHOST: process.env.PGHOST || "Not set",
    },
    database: {
      connection: false,
      error: null as any,
      users: 0,
      vendors: 0,
      vessels: 0,
    },
  };

  if (!process.env.DATABASE_URL) {
    response.database.error = "DATABASE_URL not set";
    return NextResponse.json(response);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    const client = await pool.connect();
    response.database.connection = true;

    // Test queries
    const usersResult = await client.query(
      "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL"
    );
    response.database.users = parseInt(usersResult.rows[0].count);

    const vendorsResult = await client.query(
      "SELECT COUNT(*) FROM vendors WHERE deleted_at IS NULL"
    );
    response.database.vendors = parseInt(vendorsResult.rows[0].count);

    const vesselsResult = await client.query(
      "SELECT COUNT(*) FROM vessels WHERE deleted_at IS NULL"
    );
    response.database.vessels = parseInt(vesselsResult.rows[0].count);

    client.release();
  } catch (error: any) {
    response.database.error = {
      message: error.message,
      code: error.code,
      detail: error.detail,
    };
  } finally {
    await pool.end();
  }

  return NextResponse.json(response);
}