import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Health Check Router
 * Provides system status verification and database health checks
 * Uses public procedures to bypass authentication for system access
 */
export const healthRouter = router({
  /**
   * Basic health check endpoint
   * Fast response for basic liveness checks
   */
  ping: publicProcedure.query(() => {
    return {
      status: "healthy",
      message: "API is operational",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }),

  /**
   * Database connectivity and performance check
   * Tests database connection and query performance
   */
  database: publicProcedure.query(async () => {
    const startTime = Date.now();

    try {
      // Test basic database connectivity
      const connectivityTest = await db.execute(sql`SELECT 1 as test`);
      const connectivityTime = Date.now() - startTime;

      // Test database version and info
      const versionResult = await db.execute(sql`SELECT version() as version`);
      const version = (versionResult.rows?.[0] as any)?.version || "Unknown";

      // Test connection pool status (if available)
      let poolStatus: any = null;
      try {
        const poolInfo = await db.execute(sql`
          SELECT
            count(*) as total_connections,
            count(*) filter (where state = 'active') as active_connections,
            count(*) filter (where state = 'idle') as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
        `);
        poolStatus = poolInfo.rows?.[0] || null;
      } catch (error) {
        // Pool info query might fail on some databases, continue without it
        poolStatus = { error: "Pool status unavailable" };
      }

      // Test table access with a simple count query
      const tableTestStartTime = Date.now();
      const tableTest = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM vendors WHERE deleted_at IS NULL) as vendor_count,
          (SELECT count(*) FROM users WHERE deleted_at IS NULL) as user_count
      `);
      const tableTestTime = Date.now() - tableTestStartTime;

      return {
        status: "healthy",
        database: {
          connected: true,
          version: version,
          connectivity_ms: connectivityTime,
          table_query_ms: tableTestTime,
          pool_status: poolStatus,
          test_results: {
            basic_query: (versionResult.rows?.length || 0) > 0,
            table_access: (tableTest.rows?.length || 0) > 0,
            records: tableTest.rows?.[0] || null,
          },
        },
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error("Database health check failed:", error);

      return {
        status: "unhealthy",
        database: {
          connected: false,
          error:
            error instanceof Error ? error.message : "Unknown database error",
          response_time_ms: errorTime,
        },
        timestamp: new Date().toISOString(),
        response_time_ms: errorTime,
      };
    }
  }),

  /**
   * System resource monitoring
   * Basic memory and CPU usage indicators
   */
  system: publicProcedure.query(() => {
    const startTime = Date.now();

    try {
      // Get Node.js memory usage
      const memoryUsage = process.memoryUsage();

      // Get system uptime
      const systemUptime = process.uptime();

      // Get CPU usage (approximation using process.cpuUsage)
      const cpuUsage = process.cpuUsage();

      // Convert bytes to MB for readability
      const memoryMB = {
        rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotal:
          Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
      };

      // Calculate heap utilization percentage
      const heapUtilization = Math.round(
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      );

      return {
        status: "healthy",
        system: {
          uptime_seconds: Math.round(systemUptime),
          memory: {
            ...memoryMB,
            heap_utilization_percent: heapUtilization,
          },
          cpu: {
            user_microseconds: cpuUsage.user,
            system_microseconds: cpuUsage.system,
          },
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error("System health check failed:", error);

      return {
        status: "unhealthy",
        system: {
          error:
            error instanceof Error ? error.message : "Unknown system error",
        },
        timestamp: new Date().toISOString(),
        response_time_ms: errorTime,
      };
    }
  }),

  /**
   * Comprehensive health check
   * Combines all health checks into a single endpoint
   */
  status: publicProcedure.query(async () => {
    const startTime = Date.now();

    try {
      // Run all health checks in parallel for faster response
      const [databaseCheck, systemCheck] = await Promise.allSettled([
        // Database check (inline to avoid recursion)
        (async () => {
          try {
            const dbStartTime = Date.now();
            const connectivityTest = await db.execute(sql`SELECT 1 as test`);
            const connectivityTime = Date.now() - dbStartTime;

            const versionResult = await db.execute(
              sql`SELECT version() as version`,
            );
            const version =
              (versionResult.rows?.[0] as any)?.version || "Unknown";

            return {
              status: "healthy" as const,
              connected: true,
              version,
              response_time_ms: connectivityTime,
            };
          } catch (error) {
            return {
              status: "unhealthy" as const,
              connected: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Database connection failed",
            };
          }
        })(),

        // System check (inline to avoid recursion)
        (async () => {
          try {
            const memoryUsage = process.memoryUsage();
            const heapUtilization = Math.round(
              (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            );

            return {
              status: "healthy" as const,
              uptime_seconds: Math.round(process.uptime()),
              heap_utilization_percent: heapUtilization,
              memory_mb:
                Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
            };
          } catch (error) {
            return {
              status: "unhealthy" as const,
              error:
                error instanceof Error ? error.message : "System check failed",
            };
          }
        })(),
      ]);

      // Extract results from Promise.allSettled
      const databaseResult =
        databaseCheck.status === "fulfilled"
          ? databaseCheck.value
          : { status: "unhealthy", error: "Database check failed" };
      const systemResult =
        systemCheck.status === "fulfilled"
          ? systemCheck.value
          : { status: "unhealthy", error: "System check failed" };

      // Determine overall status
      const isHealthy =
        databaseResult.status === "healthy" &&
        systemResult.status === "healthy";

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        checks: {
          database: databaseResult,
          system: systemResult,
        },
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        api_version: process.env.npm_package_version || "unknown",
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error("Comprehensive health check failed:", error);

      return {
        status: "unhealthy" as const,
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
        response_time_ms: errorTime,
      };
    }
  }),

  /**
   * Detailed diagnostics endpoint
   * Provides extensive system information for debugging
   */
  diagnostics: publicProcedure.query(async () => {
    const startTime = Date.now();

    try {
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: {
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          uptime_seconds: Math.round(process.uptime()),
        },
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        database: {
          url_configured: !!process.env.DATABASE_URL,
          connection_string_prefix:
            process.env.DATABASE_URL?.substring(0, 20) + "..." ||
            "not configured",
        },
      };

      // Test database with detailed diagnostics
      try {
        const dbTestStart = Date.now();

        // Test basic connectivity
        await db.execute(sql`SELECT 1`);
        diagnostics.database.connectivity_test_ms = Date.now() - dbTestStart;

        // Test database info
        const dbInfo = await db.execute(sql`
          SELECT
            current_database() as database_name,
            current_user as current_user,
            version() as version
        `);
        diagnostics.database.info = dbInfo.rows?.[0] || null;

        // Test table existence and structure
        const tableInfo = await db.execute(sql`
          SELECT
            schemaname,
            tablename,
            hasindexes,
            hasrules,
            hastriggers
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename
          LIMIT 10
        `);
        diagnostics.database.tables = tableInfo.rows || [];

        diagnostics.database.status = "healthy";
      } catch (dbError) {
        diagnostics.database.status = "unhealthy";
        diagnostics.database.error =
          dbError instanceof Error
            ? dbError.message
            : "Database diagnostic failed";
      }

      return {
        status: "healthy",
        diagnostics,
        response_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error("Diagnostics failed:", error);

      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Diagnostics failed",
        timestamp: new Date().toISOString(),
        response_time_ms: errorTime,
      };
    }
  }),
});

export type HealthRouter = typeof healthRouter;
