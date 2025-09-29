#!/usr/bin/env node
/**
 * Database Deprecation Management CLI
 *
 * Command-line interface for managing database deprecation migrations.
 * Provides safe operations for deprecating, monitoring, and rolling back
 * database elements.
 */

import { Command } from "commander";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

import {
  DeprecationSystem,
  createDeprecationSystem,
} from "../migrations/deprecation-system";
import {
  BackupValidator,
  createBackupValidator,
} from "../migrations/backup-validator";
import {
  RollbackManager,
  createRollbackManager,
} from "../migrations/rollback-manager";
import { performSafetyChecks } from "../migrations/safety-checks";
import {
  DeprecatedMonitor,
  createDeprecatedMonitor,
} from "../monitoring/deprecated-monitor";
import { TelemetryCollector } from "../monitoring/telemetry-collector";
import { AlertSystem } from "../monitoring/alert-system";

// CLI Configuration
interface CLIConfig {
  database: {
    url: string;
    ssl?: boolean;
  };
  backup: {
    directory: string;
    enabled: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertOnAccess: boolean;
  };
  safety: {
    strictMode: boolean;
    requireBackup: boolean;
  };
}

// CLI Context
interface CLIContext {
  db: any;
  deprecationSystem: DeprecationSystem;
  backupValidator: BackupValidator;
  rollbackManager: RollbackManager;
  monitor: DeprecatedMonitor;
  config: CLIConfig;
}

/**
 * Initialize CLI context and database connections
 */
async function initializeCLI(): Promise<CLIContext> {
  const config: CLIConfig = {
    database: {
      url: process.env.DATABASE_URL || "postgresql://localhost:5432/cidery",
      ssl: process.env.NODE_ENV === "production",
    },
    backup: {
      directory: process.env.DB_BACKUP_DIR || "./backups",
      enabled: process.env.BACKUP_ENABLED !== "false",
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== "false",
      alertOnAccess: process.env.ALERT_ON_ACCESS === "true",
    },
    safety: {
      strictMode: process.env.STRICT_MODE !== "false",
      requireBackup: process.env.REQUIRE_BACKUP === "true",
    },
  };

  // Initialize database connection
  const pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool);

  // Initialize components
  const telemetry = new TelemetryCollector();
  const alerts = new AlertSystem();
  const monitor = createDeprecatedMonitor(db, telemetry, alerts, {
    enabled: config.monitoring.enabled,
    alertOnAccess: config.monitoring.alertOnAccess,
  });

  const backupValidator = createBackupValidator(db, {
    enabled: config.backup.enabled,
    backupDirectory: config.backup.directory,
  });

  const rollbackManager = createRollbackManager(db, {
    validateBeforeRollback: config.safety.strictMode,
    createBackupBeforeRollback: config.safety.requireBackup,
  });

  const deprecationSystem = createDeprecationSystem(
    db,
    monitor,
    rollbackManager,
  );

  return {
    db,
    deprecationSystem,
    backupValidator,
    rollbackManager,
    monitor,
    config,
  };
}

/**
 * CLI Command Implementations
 */

/**
 * Plan a deprecation migration
 */
async function planDeprecation(
  elements: string[],
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue("📋 Planning deprecation migration..."));

  try {
    const elementSpecs = elements.map(parseElementSpec);

    const migration = await context.deprecationSystem.planDeprecation(
      elementSpecs,
      {
        createdBy: process.env.USER || "cli",
        environment: process.env.NODE_ENV || "development",
        reason: options.reason || "Manual deprecation via CLI",
      },
    );

    console.log(chalk.green("✅ Migration plan created successfully"));
    console.log(chalk.cyan(`Migration ID: ${migration.id}`));
    console.log(chalk.cyan(`Elements: ${migration.elements.length}`));
    console.log(chalk.cyan(`Risk Level: ${migration.metadata.riskLevel}`));
    console.log(
      chalk.cyan(
        `Estimated Duration: ${migration.metadata.estimatedDuration}s`,
      ),
    );

    if (migration.metadata.approvalRequired) {
      console.log(
        chalk.yellow("⚠️  This migration requires approval before execution"),
      );
    }

    // Show element details
    console.log(chalk.blue("\nElements to deprecate:"));
    for (const element of migration.elements) {
      console.log(
        chalk.gray(
          `  - ${element.type}: ${element.originalName} -> ${element.deprecatedName}`,
        ),
      );
    }

    // Show safety check results
    console.log(chalk.blue("\nSafety check results:"));
    const passed = migration.safetyChecks.filter((c) => c.passed).length;
    const total = migration.safetyChecks.length;
    console.log(chalk.cyan(`  Passed: ${passed}/${total}`));

    const failed = migration.safetyChecks.filter((c) => !c.passed);
    if (failed.length > 0) {
      console.log(chalk.red("  Failed checks:"));
      for (const check of failed) {
        console.log(chalk.red(`    - ${check.name}: ${check.message}`));
      }
    }

    // Save plan to file
    if (options.save) {
      const filename = `migration-plan-${migration.id}.json`;
      fs.writeFileSync(filename, JSON.stringify(migration, null, 2));
      console.log(chalk.green(`📄 Plan saved to ${filename}`));
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to create migration plan:"),
      error.message,
    );
    process.exit(1);
  }
}

/**
 * Execute a deprecation migration
 */
async function executeDeprecation(
  migrationId: string,
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue(`🚀 Executing deprecation migration: ${migrationId}`));

  try {
    if (!options.force && !options.confirm) {
      console.log(
        chalk.yellow(
          "⚠️  This will modify your database. Use --confirm to proceed.",
        ),
      );
      return;
    }

    await context.deprecationSystem.executeDeprecation(migrationId);
    console.log(chalk.green("✅ Migration executed successfully"));
  } catch (error) {
    console.error(chalk.red("❌ Migration execution failed:"), error.message);
    process.exit(1);
  }
}

/**
 * Rollback a deprecation migration
 */
async function rollbackDeprecation(
  migrationId: string,
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue(`↩️  Rolling back migration: ${migrationId}`));

  try {
    if (!options.force && !options.confirm) {
      console.log(
        chalk.yellow(
          "⚠️  This will modify your database. Use --confirm to proceed.",
        ),
      );
      return;
    }

    await context.deprecationSystem.rollbackMigration(migrationId);
    console.log(chalk.green("✅ Migration rolled back successfully"));
  } catch (error) {
    console.error(chalk.red("❌ Rollback failed:"), error.message);
    process.exit(1);
  }
}

/**
 * Show deprecation status
 */
async function showStatus(options: any, context: CLIContext): Promise<void> {
  console.log(chalk.blue("📊 Deprecation Status Report"));

  try {
    const status = await context.deprecationSystem.getDeprecationStatus();
    const dashboard = await context.monitor.getDashboardData();

    console.log(chalk.cyan("\nOverview:"));
    console.log(
      chalk.gray(`  Total monitored: ${dashboard.overview.totalMonitored}`),
    );
    console.log(
      chalk.gray(`  Total access events: ${dashboard.overview.totalAccess}`),
    );
    console.log(
      chalk.gray(`  Recent alerts: ${dashboard.overview.recentAlerts}`),
    );
    console.log(
      chalk.gray(
        `  Ready for removal: ${dashboard.overview.removalCandidates}`,
      ),
    );

    console.log(chalk.cyan("\nDeprecated Elements:"));
    for (const element of dashboard.elements) {
      const statusColor =
        element.status === "safe"
          ? chalk.green
          : element.status === "warning"
            ? chalk.yellow
            : chalk.red;

      console.log(
        statusColor(`  ${element.status.toUpperCase()}: ${element.name}`),
      );
      console.log(chalk.gray(`    Type: ${element.type}`));
      console.log(chalk.gray(`    Access count: ${element.accessCount}`));
      console.log(
        chalk.gray(`    Last accessed: ${element.lastAccessed || "Never"}`),
      );
    }

    if (options.detailed) {
      console.log(chalk.cyan("\nAccess Trends:"));
      console.log(
        chalk.gray(
          `  Daily access: ${dashboard.trends.dailyAccess.slice(-7).join(", ")}`,
        ),
      );
      console.log(
        chalk.gray(
          `  Top sources: ${dashboard.trends.topSources
            .slice(0, 3)
            .map((s) => s.name)
            .join(", ")}`,
        ),
      );
    }
  } catch (error) {
    console.error(chalk.red("❌ Failed to get status:"), error.message);
    process.exit(1);
  }
}

/**
 * List migrations
 */
async function listMigrations(
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue("📋 Migration History"));

  try {
    const migrations = await context.deprecationSystem.listMigrations();

    if (migrations.length === 0) {
      console.log(chalk.gray("No migrations found"));
      return;
    }

    for (const migration of migrations) {
      const statusColor =
        migration.phase === "completed"
          ? chalk.green
          : migration.phase === "rolled_back"
            ? chalk.yellow
            : migration.phase === "executing"
              ? chalk.blue
              : chalk.gray;

      console.log(
        statusColor(`${migration.phase.toUpperCase()}: ${migration.id}`),
      );
      console.log(chalk.gray(`  Timestamp: ${migration.timestamp}`));
      console.log(chalk.gray(`  Elements: ${migration.elements.length}`));
      console.log(chalk.gray(`  Reason: ${migration.reason}`));

      if (options.verbose) {
        console.log(
          chalk.gray(`  Risk Level: ${migration.metadata.riskLevel}`),
        );
        console.log(
          chalk.gray(`  Duration: ${migration.metadata.estimatedDuration}s`),
        );
      }
    }
  } catch (error) {
    console.error(chalk.red("❌ Failed to list migrations:"), error.message);
    process.exit(1);
  }
}

/**
 * Validate backup
 */
async function validateBackup(
  backupId: string,
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue(`🔍 Validating backup: ${backupId}`));

  try {
    const result = await context.backupValidator.validateBackup(backupId);

    console.log(
      chalk.cyan(`Validation Result: ${result.passed ? "PASSED" : "FAILED"}`),
    );
    console.log(chalk.gray(`Score: ${result.score}/100`));
    console.log(chalk.gray(`Duration: ${result.duration}ms`));
    console.log(chalk.gray(`Checks: ${result.checks.length}`));

    if (options.detailed) {
      console.log(chalk.cyan("\nDetailed Results:"));
      for (const check of result.checks) {
        const checkColor = check.passed ? chalk.green : chalk.red;
        console.log(checkColor(`  ${check.passed ? "✓" : "✗"} ${check.name}`));
        console.log(chalk.gray(`    ${check.message}`));
      }
    }

    if (!result.passed) {
      const failedChecks = result.checks.filter((c) => !c.passed);
      console.log(chalk.red(`\n❌ ${failedChecks.length} checks failed`));
    }
  } catch (error) {
    console.error(chalk.red("❌ Backup validation failed:"), error.message);
    process.exit(1);
  }
}

/**
 * Monitor deprecated elements
 */
async function monitorElements(
  options: any,
  context: CLIContext,
): Promise<void> {
  console.log(chalk.blue("👁️  Monitoring deprecated elements..."));

  if (!context.config.monitoring.enabled) {
    console.log(
      chalk.yellow(
        "⚠️  Monitoring is disabled. Enable with MONITORING_ENABLED=true",
      ),
    );
    return;
  }

  try {
    const stats = await context.monitor.getAllStats();

    console.log(chalk.cyan(`Monitoring ${stats.length} deprecated elements`));

    if (options.realtime) {
      console.log(
        chalk.blue("Real-time monitoring active (Ctrl+C to stop)..."),
      );

      // Simple real-time monitoring loop
      setInterval(async () => {
        const currentStats = await context.monitor.getAllStats();
        const recentActivity = currentStats.filter(
          (s) =>
            s.lastAccessed &&
            new Date(s.lastAccessed) > new Date(Date.now() - 60000), // Last minute
        );

        if (recentActivity.length > 0) {
          console.log(
            chalk.yellow(
              `🚨 Recent activity detected on ${recentActivity.length} elements`,
            ),
          );
          for (const activity of recentActivity) {
            console.log(
              chalk.gray(
                `  - ${activity.elementName}: ${activity.totalAccess} total accesses`,
              ),
            );
          }
        }
      }, 10000); // Check every 10 seconds
    } else {
      // Show current monitoring summary
      for (const stat of stats) {
        console.log(chalk.gray(`${stat.elementName}:`));
        console.log(chalk.gray(`  Total access: ${stat.totalAccess}`));
        console.log(
          chalk.gray(`  Last accessed: ${stat.lastAccessed || "Never"}`),
        );
        console.log(chalk.gray(`  Peak hour: ${stat.peakAccessHour}:00`));
      }
    }
  } catch (error) {
    console.error(chalk.red("❌ Monitoring failed:"), error.message);
    process.exit(1);
  }
}

/**
 * Utility Functions
 */

function parseElementSpec(spec: string): any {
  const [type, name] = spec.split(":");
  if (!type || !name) {
    throw new Error(
      `Invalid element specification: ${spec}. Use format 'type:name'`,
    );
  }

  return {
    type: type as any,
    name,
    schema: "public",
    reason: "unused",
  };
}

/**
 * Main CLI Setup
 */
async function main() {
  const program = new Command();

  // Initialize CLI context
  let context: CLIContext;

  try {
    context = await initializeCLI();
  } catch (error) {
    console.error(chalk.red("❌ Failed to initialize CLI:"), error.message);
    console.error(
      chalk.gray("Check your database connection and configuration"),
    );
    process.exit(1);
  }

  program
    .name("deprecation-cli")
    .description("Database deprecation management CLI")
    .version("1.0.0");

  // Plan command
  program
    .command("plan")
    .description("Plan a deprecation migration")
    .argument("<elements...>", "Elements to deprecate (format: type:name)")
    .option("-r, --reason <reason>", "Reason for deprecation", "unused")
    .option("-s, --save", "Save plan to file")
    .action((elements, options) => planDeprecation(elements, options, context));

  // Execute command
  program
    .command("execute")
    .description("Execute a planned migration")
    .argument("<migration-id>", "Migration ID to execute")
    .option("-c, --confirm", "Confirm execution")
    .option("-f, --force", "Force execution (skip confirmations)")
    .action((migrationId, options) =>
      executeDeprecation(migrationId, options, context),
    );

  // Rollback command
  program
    .command("rollback")
    .description("Rollback a migration")
    .argument("<migration-id>", "Migration ID to rollback")
    .option("-c, --confirm", "Confirm rollback")
    .option("-f, --force", "Force rollback (skip confirmations)")
    .action((migrationId, options) =>
      rollbackDeprecation(migrationId, options, context),
    );

  // Status command
  program
    .command("status")
    .description("Show deprecation status")
    .option("-d, --detailed", "Show detailed information")
    .action((options) => showStatus(options, context));

  // List command
  program
    .command("list")
    .description("List all migrations")
    .option("-v, --verbose", "Show detailed information")
    .action((options) => listMigrations(options, context));

  // Validate command
  program
    .command("validate")
    .description("Validate a backup")
    .argument("<backup-id>", "Backup ID to validate")
    .option("-d, --detailed", "Show detailed validation results")
    .action((backupId, options) => validateBackup(backupId, options, context));

  // Monitor command
  program
    .command("monitor")
    .description("Monitor deprecated elements")
    .option("-r, --realtime", "Real-time monitoring")
    .action((options) => monitorElements(options, context));

  // Parse and execute
  program.parse(process.argv);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(chalk.red("💥 Uncaught exception:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("💥 Unhandled rejection:"), reason);
  process.exit(1);
});

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red("💥 CLI failed:"), error.message);
    process.exit(1);
  });
}

export { main as runDeprecationCLI };
