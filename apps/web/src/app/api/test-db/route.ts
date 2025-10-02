import { NextResponse } from "next/server";
import { db } from "db";
import { users, vendors, vessels } from "db/src/schema";
import { isNull } from "drizzle-orm";

export async function GET() {
  const actualDbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  const response = {
    environment: {
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL ? "Set" : "Not set",
      NEON_DATABASE_HOST: process.env.NEON_DATABASE_URL?.split("@")[1]?.split("/")[0] || "Not set",
      DATABASE_URL: process.env.DATABASE_URL ? "Set" : "Not set",
      DATABASE_URL_HOST: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "Not set",
      ACTUAL_DB_HOST: actualDbUrl?.split("@")[1]?.split("/")[0] || "Not set",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "Set" : "Not set",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "Not set",
      // Additional debug info
      NODE_ENV: process.env.NODE_ENV || "Not set",
      VERCEL_ENV: process.env.VERCEL_ENV || "Not set",
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

  try {
    // Test queries using Drizzle
    const usersResult = await db
      .select()
      .from(users)
      .where(isNull(users.deletedAt));
    response.database.users = usersResult.length;

    const vendorsResult = await db
      .select()
      .from(vendors)
      .where(isNull(vendors.deletedAt));
    response.database.vendors = vendorsResult.length;

    const vesselsResult = await db
      .select()
      .from(vessels)
      .where(isNull(vessels.deletedAt));
    response.database.vessels = vesselsResult.length;

    response.database.connection = true;
  } catch (error: any) {
    response.database.error = {
      message: error.message,
      code: error.code,
      detail: error.detail,
    };
  }

  return NextResponse.json(response);
}