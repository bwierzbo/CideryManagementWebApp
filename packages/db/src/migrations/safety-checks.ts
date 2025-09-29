/**
 * Database Safety Checks System
 *
 * Comprehensive safety validation before deprecating database elements.
 * Prevents accidental data loss and ensures safe operations.
 */

import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DeprecatedElement, ElementType } from "./deprecation-system";

export interface SafetyCheckResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: any;
  timestamp: string;
}

export interface SafetyCheckConfig {
  skipChecks?: string[];
  strictMode?: boolean;
  allowRiskyOperations?: boolean;
  minimumConfidenceScore?: number;
  requireBackup?: boolean;
}

/**
 * Perform comprehensive safety checks before deprecation
 */
export async function performSafetyChecks(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig = {},
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  console.log("🛡️ Running safety checks...");

  // Define all available checks
  const checks = [
    { id: "element-exists", fn: checkElementExists },
    { id: "confidence-score", fn: checkConfidenceScore },
    { id: "no-recent-access", fn: checkNoRecentAccess },
    { id: "dependency-analysis", fn: checkDependencies },
    { id: "data-integrity", fn: checkDataIntegrity },
    { id: "foreign-key-safety", fn: checkForeignKeySafety },
    { id: "index-safety", fn: checkIndexSafety },
    { id: "constraint-safety", fn: checkConstraintSafety },
    { id: "naming-collision", fn: checkNamingCollision },
    { id: "environment-safety", fn: checkEnvironmentSafety },
    { id: "backup-validation", fn: checkBackupValidation },
    { id: "transaction-safety", fn: checkTransactionSafety },
    { id: "rollback-feasibility", fn: checkRollbackFeasibility },
  ];

  // Run checks
  for (const check of checks) {
    if (config.skipChecks?.includes(check.id)) {
      console.log(`⏭️ Skipping check: ${check.id}`);
      continue;
    }

    try {
      const result = await check.fn(db, elements, config);
      results.push(...result);
    } catch (error) {
      results.push({
        id: check.id,
        name: `Check ${check.id}`,
        description: `Safety check execution failed`,
        passed: false,
        severity: "critical",
        message: `Failed to execute safety check: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Analyze overall results
  const criticalFailures = results.filter(
    (r) => !r.passed && r.severity === "critical",
  );
  const highSeverityFailures = results.filter(
    (r) => !r.passed && r.severity === "high",
  );

  console.log(
    `✅ Safety checks completed: ${results.filter((r) => r.passed).length} passed, ${results.filter((r) => !r.passed).length} failed`,
  );

  if (criticalFailures.length > 0) {
    console.log(`❌ Critical failures: ${criticalFailures.length}`);
  }

  if (highSeverityFailures.length > 0) {
    console.log(`⚠️ High severity failures: ${highSeverityFailures.length}`);
  }

  return results;
}

/**
 * Check that all elements exist in the database
 */
async function checkElementExists(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    let exists = false;
    let errorMessage = "";

    try {
      switch (element.type) {
        case "table":
          const tableQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
          `;
          const tableResult = await db.execute(sql.raw(tableQuery), [
            element.schema,
            element.originalName,
          ]);
          exists = (tableResult.rows[0]?.count as number) > 0;
          break;

        case "column":
          const [tableName, columnName] = element.originalName.split(".");
          const columnQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
          `;
          const columnResult = await db.execute(sql.raw(columnQuery), [
            element.schema,
            tableName,
            columnName,
          ]);
          exists = (columnResult.rows[0]?.count as number) > 0;
          break;

        case "index":
          const indexQuery = `
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE schemaname = $1 AND indexname = $2
          `;
          const indexResult = await db.execute(sql.raw(indexQuery), [
            element.schema,
            element.originalName,
          ]);
          exists = (indexResult.rows[0]?.count as number) > 0;
          break;

        case "constraint":
          const [constraintTable, constraintName] =
            element.originalName.split(".");
          const constraintQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.table_constraints
            WHERE table_schema = $1 AND table_name = $2 AND constraint_name = $3
          `;
          const constraintResult = await db.execute(sql.raw(constraintQuery), [
            element.schema,
            constraintTable,
            constraintName,
          ]);
          exists = (constraintResult.rows[0]?.count as number) > 0;
          break;

        default:
          errorMessage = `Unsupported element type: ${element.type}`;
      }
    } catch (error) {
      errorMessage = `Error checking existence: ${error.message}`;
    }

    results.push({
      id: `element-exists-${element.type}-${element.originalName}`,
      name: "Element Existence Check",
      description: `Verify that ${element.type} ${element.originalName} exists`,
      passed: exists && !errorMessage,
      severity: "critical",
      message:
        exists && !errorMessage
          ? `Element exists and can be deprecated`
          : errorMessage ||
            `Element does not exist: ${element.type} ${element.originalName}`,
      details: { element: element.originalName, type: element.type, exists },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check confidence scores for unused elements
 */
async function checkConfidenceScore(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];
  const minimumConfidence = config.minimumConfidenceScore || 0.9;

  for (const element of elements) {
    const confidence = element.usageData.confidenceScore;
    const passed = confidence >= minimumConfidence;

    results.push({
      id: `confidence-score-${element.originalName}`,
      name: "Confidence Score Check",
      description: `Verify confidence score meets minimum threshold (${minimumConfidence})`,
      passed,
      severity: passed ? "low" : "high",
      message: passed
        ? `Confidence score ${confidence} meets threshold`
        : `Confidence score ${confidence} below threshold ${minimumConfidence}`,
      details: {
        confidence,
        threshold: minimumConfidence,
        element: element.originalName,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check for recent access to elements
 */
async function checkNoRecentAccess(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];
  const daysSinceAccess = 30; // Configurable threshold

  for (const element of elements) {
    const lastAccessed = element.usageData.lastAccessed;
    const daysSince = lastAccessed
      ? Math.floor(
          (Date.now() - new Date(lastAccessed).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : Infinity;

    const passed = daysSince >= daysSinceAccess;

    results.push({
      id: `no-recent-access-${element.originalName}`,
      name: "Recent Access Check",
      description: `Verify element hasn't been accessed recently (${daysSinceAccess} days)`,
      passed,
      severity: passed ? "low" : "medium",
      message: passed
        ? lastAccessed
          ? `Last accessed ${daysSince} days ago`
          : "Never accessed"
        : `Last accessed ${daysSince} days ago (too recent)`,
      details: { lastAccessed, daysSince, threshold: daysSinceAccess },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check dependencies and foreign key relationships
 */
async function checkDependencies(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    const highImpactDeps = element.dependencies.filter(
      (dep) => dep.impact === "high",
    );
    const passed = highImpactDeps.length === 0 || config.allowRiskyOperations;

    results.push({
      id: `dependencies-${element.originalName}`,
      name: "Dependency Check",
      description: "Verify no high-impact dependencies exist",
      passed,
      severity: passed ? "low" : "high",
      message: passed
        ? `No high-impact dependencies found`
        : `High-impact dependencies: ${highImpactDeps.map((d) => d.name).join(", ")}`,
      details: {
        dependencies: element.dependencies,
        highImpact: highImpactDeps,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check data integrity constraints
 */
async function checkDataIntegrity(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    if (element.type !== "table") {
      results.push({
        id: `data-integrity-${element.originalName}`,
        name: "Data Integrity Check",
        description: "Verify data integrity for non-table elements",
        passed: true,
        severity: "low",
        message: "Non-table element, no data integrity concerns",
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // For tables, check for data existence
    try {
      const rowCountQuery = `SELECT COUNT(*) as count FROM "${element.schema}"."${element.originalName}"`;
      const result = await db.execute(sql.raw(rowCountQuery));
      const rowCount = result.rows[0]?.count as number;

      const passed = rowCount === 0 || config.allowRiskyOperations;

      results.push({
        id: `data-integrity-${element.originalName}`,
        name: "Data Integrity Check",
        description: "Verify table is empty or operation is approved",
        passed,
        severity: passed ? "low" : "critical",
        message: passed
          ? rowCount === 0
            ? "Table is empty"
            : "Risky operation approved"
          : `Table contains ${rowCount} rows`,
        details: { rowCount, tableName: element.originalName },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        id: `data-integrity-${element.originalName}`,
        name: "Data Integrity Check",
        description: "Verify data integrity",
        passed: false,
        severity: "critical",
        message: `Error checking table data: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Check foreign key safety
 */
async function checkForeignKeySafety(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    if (element.type !== "table") {
      results.push({
        id: `fk-safety-${element.originalName}`,
        name: "Foreign Key Safety Check",
        description: "Check foreign key constraints",
        passed: true,
        severity: "low",
        message: "Non-table element, no foreign key concerns",
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    try {
      // Check for foreign keys referencing this table
      const fkQuery = `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = $1
          AND ccu.table_schema = $2
      `;

      const fkResult = await db.execute(sql.raw(fkQuery), [
        element.originalName,
        element.schema,
      ]);
      const referencingTables = fkResult.rows;

      const passed =
        referencingTables.length === 0 || config.allowRiskyOperations;

      results.push({
        id: `fk-safety-${element.originalName}`,
        name: "Foreign Key Safety Check",
        description: "Check for foreign key references",
        passed,
        severity: passed ? "low" : "high",
        message: passed
          ? referencingTables.length === 0
            ? "No foreign key references found"
            : "Foreign key references exist but operation approved"
          : `${referencingTables.length} foreign key references found`,
        details: { referencingTables },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        id: `fk-safety-${element.originalName}`,
        name: "Foreign Key Safety Check",
        description: "Check foreign key constraints",
        passed: false,
        severity: "high",
        message: `Error checking foreign keys: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Check index safety (simple implementation)
 */
async function checkIndexSafety(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  const indexElements = elements.filter((e) => e.type === "index");

  for (const element of indexElements) {
    // For now, consider index deprecation safe if confidence is high
    const passed = element.usageData.confidenceScore >= 0.9;

    results.push({
      id: `index-safety-${element.originalName}`,
      name: "Index Safety Check",
      description: "Verify index deprecation safety",
      passed,
      severity: "medium",
      message: passed
        ? "Index can be safely deprecated"
        : "Index deprecation requires manual review",
      details: { confidence: element.usageData.confidenceScore },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check constraint safety
 */
async function checkConstraintSafety(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  const constraintElements = elements.filter((e) => e.type === "constraint");

  for (const element of constraintElements) {
    // Constraints generally safe to rename if unused
    const passed = element.usageData.confidenceScore >= 0.95;

    results.push({
      id: `constraint-safety-${element.originalName}`,
      name: "Constraint Safety Check",
      description: "Verify constraint deprecation safety",
      passed,
      severity: "medium",
      message: passed
        ? "Constraint can be safely deprecated"
        : "Constraint deprecation requires review",
      details: { confidence: element.usageData.confidenceScore },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check for naming collisions with deprecated names
 */
async function checkNamingCollision(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    let hasCollision = false;
    let errorMessage = "";

    try {
      // Check if deprecated name already exists
      switch (element.type) {
        case "table":
          const tableQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
          `;
          const tableResult = await db.execute(sql.raw(tableQuery), [
            element.schema,
            element.deprecatedName,
          ]);
          hasCollision = (tableResult.rows[0]?.count as number) > 0;
          break;

        case "index":
          const indexQuery = `
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE schemaname = $1 AND indexname = $2
          `;
          const indexResult = await db.execute(sql.raw(indexQuery), [
            element.schema,
            element.deprecatedName,
          ]);
          hasCollision = (indexResult.rows[0]?.count as number) > 0;
          break;

        // Add other types as needed
      }
    } catch (error) {
      errorMessage = `Error checking naming collision: ${error.message}`;
    }

    results.push({
      id: `naming-collision-${element.originalName}`,
      name: "Naming Collision Check",
      description: "Verify deprecated name is available",
      passed: !hasCollision && !errorMessage,
      severity: hasCollision ? "high" : "low",
      message:
        !hasCollision && !errorMessage
          ? "No naming collision detected"
          : errorMessage ||
            `Deprecated name already exists: ${element.deprecatedName}`,
      details: { deprecatedName: element.deprecatedName, hasCollision },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check environment-specific safety rules
 */
async function checkEnvironmentSafety(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];
  const environment = process.env.NODE_ENV || "development";

  // Production requires extra safety
  const isProduction = environment === "production";
  const requiresBackup = isProduction || config.requireBackup;

  for (const element of elements) {
    const riskLevel = assessElementRisk(element);
    const passed =
      !isProduction || riskLevel === "low" || config.allowRiskyOperations;

    results.push({
      id: `environment-safety-${element.originalName}`,
      name: "Environment Safety Check",
      description: `Verify operation safety for ${environment} environment`,
      passed,
      severity: passed ? "low" : "critical",
      message: passed
        ? `Operation safe for ${environment} environment`
        : `Operation too risky for ${environment} environment (${riskLevel} risk)`,
      details: { environment, riskLevel, requiresBackup },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check backup validation requirements
 */
async function checkBackupValidation(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];
  const environment = process.env.NODE_ENV || "development";
  const requiresBackup = environment === "production" || config.requireBackup;

  if (requiresBackup) {
    // Check if backup system is available (simplified check)
    const backupAvailable =
      process.env.DATABASE_BACKUP_URL || process.env.PGDUMP_PATH;

    results.push({
      id: "backup-validation",
      name: "Backup Validation Check",
      description: "Verify backup system is available",
      passed: !!backupAvailable,
      severity: "critical",
      message: backupAvailable
        ? "Backup system available"
        : "Backup system not configured but required",
      details: { requiresBackup, backupAvailable: !!backupAvailable },
      timestamp: new Date().toISOString(),
    });
  } else {
    results.push({
      id: "backup-validation",
      name: "Backup Validation Check",
      description: "Check backup requirements",
      passed: true,
      severity: "low",
      message: "Backup not required for this environment",
      details: { requiresBackup },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Check transaction safety
 */
async function checkTransactionSafety(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  // Check if all operations can be done in a single transaction
  const hasLongOperations = elements.some(
    (e) => e.type === "table" && e.dependencies.length > 5,
  );

  const passed = !hasLongOperations;

  results.push({
    id: "transaction-safety",
    name: "Transaction Safety Check",
    description: "Verify operations can be done safely in transaction",
    passed,
    severity: passed ? "low" : "medium",
    message: passed
      ? "All operations can be done in single transaction"
      : "Some operations may require special handling",
    details: { hasLongOperations, elementCount: elements.length },
    timestamp: new Date().toISOString(),
  });

  return results;
}

/**
 * Check rollback feasibility
 */
async function checkRollbackFeasibility(
  db: NodePgDatabase<any>,
  elements: DeprecatedElement[],
  config: SafetyCheckConfig,
): Promise<SafetyCheckResult[]> {
  const results: SafetyCheckResult[] = [];

  for (const element of elements) {
    // Check if rollback SQL is valid and feasible
    const hasRollbackSql = !!element.rollbackSql;
    const rollbackComplexity = element.dependencies.length;

    const passed = hasRollbackSql && rollbackComplexity < 10; // Arbitrary threshold

    results.push({
      id: `rollback-feasibility-${element.originalName}`,
      name: "Rollback Feasibility Check",
      description: "Verify rollback is possible",
      passed,
      severity: passed ? "low" : "high",
      message: passed
        ? "Rollback is feasible"
        : "Rollback may be complex or impossible",
      details: { hasRollbackSql, rollbackComplexity },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * Assess risk level for an element
 */
function assessElementRisk(
  element: DeprecatedElement,
): "low" | "medium" | "high" {
  if (element.type === "table") return "high";
  if (element.dependencies.some((d) => d.impact === "high")) return "high";
  if (element.usageData.confidenceScore < 0.9) return "medium";
  return "low";
}

/**
 * Generate safety check summary
 */
export function generateSafetyCheckSummary(results: SafetyCheckResult[]): {
  overallPassed: boolean;
  summary: string;
  criticalIssues: SafetyCheckResult[];
  recommendations: string[];
} {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const criticalIssues = failed.filter((r) => r.severity === "critical");
  const highSeverity = failed.filter((r) => r.severity === "high");

  const overallPassed = criticalIssues.length === 0;

  const summary = `
Safety Check Results:
- Total checks: ${results.length}
- Passed: ${passed.length}
- Failed: ${failed.length}
- Critical failures: ${criticalIssues.length}
- High severity failures: ${highSeverity.length}

Overall status: ${overallPassed ? "✅ PASSED" : "❌ FAILED"}
  `.trim();

  const recommendations: string[] = [];

  if (criticalIssues.length > 0) {
    recommendations.push("Address all critical issues before proceeding");
  }

  if (highSeverity.length > 0) {
    recommendations.push("Review high severity issues carefully");
  }

  if (failed.length > 0) {
    recommendations.push(
      "Consider using strictMode: false for non-critical issues",
    );
  }

  return {
    overallPassed,
    summary,
    criticalIssues,
    recommendations,
  };
}
