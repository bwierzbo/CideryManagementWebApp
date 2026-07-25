/**
 * Nightly reconciliation health check (Phase 5 — automated-reconciliation PRD).
 *
 * Triggered by the Vercel cron entry in apps/web/vercel.json. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; we reject anything else so the endpoint
 * can't be run by the public. Runs the SAME read-only health check as the admin
 * "Run check now" button, attributed to an admin user, with trigger "cron".
 *
 * Locally there is no cron — use the dashboard "Run check now" button instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, users } from "db";
import { eq } from "drizzle-orm";
import { runReconciliationHealthCheck } from "api/src/services/reconciliation-health";
import type { Context } from "api/src/trpc";

// Reconciliation replays the full event history — give it room.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reconciliation-health] CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Attribute the run to a real admin user so the audit FK is satisfied.
  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) {
    console.error("[cron/reconciliation-health] no admin user to attribute the run to");
    return NextResponse.json({ error: "No admin user" }, { status: 500 });
  }

  const adminUser = { id: admin.id, email: admin.email, role: "admin" as const };
  const ctx: Context = {
    session: {
      user: adminUser,
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    user: adminUser,
  };

  try {
    const result = await runReconciliationHealthCheck(ctx, { trigger: "cron" });
    return NextResponse.json({
      ok: true,
      status: result.run.status,
      changedSinceLastRun: result.changedSinceLastRun,
      changes: result.changes,
    });
  } catch (error: any) {
    console.error("[cron/reconciliation-health] check failed:", error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Health check failed" },
      { status: 500 },
    );
  }
}
