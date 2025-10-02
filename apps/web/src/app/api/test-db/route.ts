import { NextResponse } from "next/server";
import { db } from "db";
import { users, vendors, vessels } from "db/src/schema";
import { isNull } from "drizzle-orm";

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