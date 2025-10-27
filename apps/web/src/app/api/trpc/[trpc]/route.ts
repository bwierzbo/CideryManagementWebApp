import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getServerSession } from "next-auth/next";
import { appRouter } from "api";
import { authOptions } from "../../../../lib/auth";
import { initializeAuditSystem } from "api/src/middleware/audit";
import { db } from "db";

// Initialize audit system once
initializeAuditSystem(db, {
  enabled: true,
  excludedTables: ["audit_logs", "audit_metadata", "sessions"],
  includeRequestInfo: true,
});

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getServerSession(authOptions);
      return {
        session,
        user: session?.user || null,
      };
    },
  });

export { handler as GET, handler as POST };
