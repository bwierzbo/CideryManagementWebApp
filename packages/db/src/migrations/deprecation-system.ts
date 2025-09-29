/**
 * Database Deprecation System - Core Framework
 *
 * Provides non-destructive migration capabilities for database elements.
 * Elements are renamed with deprecated naming convention rather than dropped.
 */

import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  generateDeprecatedName,
  validateNamingConvention,
} from "./naming-convention";
import { performSafetyChecks, SafetyCheckResult } from "./safety-checks";
import { createRollbackPlan, RollbackManager } from "./rollback-manager";
import { DeprecatedMonitor } from "../monitoring/deprecated-monitor";

// Types for deprecation system
export interface DeprecationMigration {
  id: string;
  timestamp: string;
  phase: "planning" | "executing" | "completed" | "rolled_back";
  elements: DeprecatedElement[];
  reason: string;
  rollbackPlan: RollbackPlan;
  safetyChecks: SafetyCheckResult[];
  metadata: MigrationMetadata;
}

export interface DeprecatedElement {
  type: ElementType;
  originalName: string;
  deprecatedName: string;
  schema: string;
  deprecationDate: string;
  reason: DeprecationReason;
  dependencies: ElementDependency[];
  usageData: UsageData;
  migrationSql: string;
  rollbackSql: string;
}

export interface ElementDependency {
  type:
    | "foreign_key"
    | "index"
    | "constraint"
    | "trigger"
    | "view"
    | "function";
  name: string;
  dependentObject: string;
  impact: "high" | "medium" | "low";
}

export interface UsageData {
  lastAccessed: string | null;
  accessCount: number;
  confidenceScore: number;
  analysisDate: string;
  accessSources: string[];
}

export interface MigrationMetadata {
  createdBy: string;
  environment: string;
  backupLocation: string;
  approvalRequired: boolean;
  estimatedDuration: number; // in seconds
  riskLevel: "low" | "medium" | "high";
}

export interface RollbackPlan {
  id: string;
  migrationId: string;
  steps: RollbackStep[];
  estimatedDuration: number;
  dependencies: string[];
  validationChecks: string[];
}

export interface RollbackStep {
  order: number;
  type: "rename" | "create_constraint" | "create_index" | "restore_data";
  sql: string;
  description: string;
  validation: string;
}

export type ElementType =
  | "table"
  | "column"
  | "index"
  | "constraint"
  | "enum"
  | "function"
  | "view";
export type DeprecationReason =
  | "unused"
  | "performance"
  | "migration"
  | "refactor"
  | "security"
  | "optimization";

/**
 * Main Deprecation System Class
 * Handles the complete lifecycle of database element deprecation
 */
export class DeprecationSystem {
  private db: NodePgDatabase<any>;
  private monitor: DeprecatedMonitor;
  private rollbackManager: RollbackManager;

  constructor(
    db: NodePgDatabase<any>,
    monitor: DeprecatedMonitor,
    rollbackManager: RollbackManager,
  ) {
    this.db = db;
    this.monitor = monitor;
    this.rollbackManager = rollbackManager;
  }

  /**
   * Plan a deprecation migration
   * Analyzes elements and creates a safe migration plan
   */
  async planDeprecation(
    elements: Array<{
      type: ElementType;
      name: string;
      schema?: string;
      reason: DeprecationReason;
    }>,
    metadata: Partial<MigrationMetadata>,
  ): Promise<DeprecationMigration> {
    const migrationId = this.generateMigrationId();
    const timestamp = new Date().toISOString();

    console.log(`🔍 Planning deprecation migration ${migrationId}`);

    // Analyze each element
    const deprecatedElements: DeprecatedElement[] = [];
    for (const element of elements) {
      const deprecatedElement = await this.analyzeElement(element);
      deprecatedElements.push(deprecatedElement);
    }

    // Perform safety checks
    console.log("🛡️ Performing safety checks...");
    const safetyChecks = await performSafetyChecks(this.db, deprecatedElements);

    // Check if any safety checks failed
    const failedChecks = safetyChecks.filter((check) => !check.passed);
    if (failedChecks.length > 0) {
      throw new Error(
        `Safety checks failed: ${failedChecks.map((c) => c.message).join(", ")}`,
      );
    }

    // Create rollback plan
    console.log("📋 Creating rollback plan...");
    const rollbackPlan = await createRollbackPlan(deprecatedElements);

    const migration: DeprecationMigration = {
      id: migrationId,
      timestamp,
      phase: "planning",
      elements: deprecatedElements,
      reason: metadata.reason || "Database optimization",
      rollbackPlan,
      safetyChecks,
      metadata: {
        createdBy: metadata.createdBy || "system",
        environment:
          metadata.environment || process.env.NODE_ENV || "development",
        backupLocation: metadata.backupLocation || "",
        approvalRequired:
          metadata.approvalRequired ||
          this.requiresApproval(deprecatedElements),
        estimatedDuration: this.estimateDuration(deprecatedElements),
        riskLevel: this.assessRiskLevel(deprecatedElements),
      },
    };

    // Store migration plan
    await this.storeMigrationPlan(migration);

    console.log(`✅ Migration plan created: ${migrationId}`);
    return migration;
  }

  /**
   * Execute a planned deprecation migration
   */
  async executeDeprecation(migrationId: string): Promise<void> {
    console.log(`🚀 Executing deprecation migration ${migrationId}`);

    const migration = await this.getMigrationPlan(migrationId);
    if (!migration) {
      throw new Error(`Migration plan not found: ${migrationId}`);
    }

    if (migration.phase !== "planning") {
      throw new Error(
        `Migration ${migrationId} is not in planning phase: ${migration.phase}`,
      );
    }

    try {
      // Update phase to executing
      await this.updateMigrationPhase(migrationId, "executing");

      // Create backup if required
      if (migration.metadata.backupLocation) {
        console.log("💾 Creating backup...");
        await this.createBackup(migration);
      }

      // Begin transaction
      await this.db.transaction(async (tx) => {
        // Execute each element deprecation
        for (const element of migration.elements) {
          console.log(
            `  📝 Deprecating ${element.type}: ${element.originalName} -> ${element.deprecatedName}`,
          );

          // Execute migration SQL
          await tx.execute(sql.raw(element.migrationSql));

          // Start monitoring the deprecated element
          await this.monitor.startMonitoring(element);
        }

        console.log("✅ All deprecation operations completed successfully");
      });

      // Update phase to completed
      await this.updateMigrationPhase(migrationId, "completed");

      console.log(`🎉 Migration ${migrationId} executed successfully`);
    } catch (error) {
      console.error(`❌ Migration ${migrationId} failed:`, error);

      // Attempt rollback
      try {
        await this.rollbackMigration(migrationId);
      } catch (rollbackError) {
        console.error(`💥 Rollback also failed:`, rollbackError);
        throw new Error(
          `Migration failed and rollback failed: ${error.message}. Rollback error: ${rollbackError.message}`,
        );
      }

      throw error;
    }
  }

  /**
   * Rollback a deprecation migration
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    console.log(`↩️ Rolling back migration ${migrationId}`);

    const migration = await this.getMigrationPlan(migrationId);
    if (!migration) {
      throw new Error(`Migration plan not found: ${migrationId}`);
    }

    try {
      await this.rollbackManager.executePlan(migration.rollbackPlan);

      // Stop monitoring deprecated elements
      for (const element of migration.elements) {
        await this.monitor.stopMonitoring(element);
      }

      // Update phase to rolled back
      await this.updateMigrationPhase(migrationId, "rolled_back");

      console.log(`✅ Migration ${migrationId} rolled back successfully`);
    } catch (error) {
      console.error(`❌ Rollback failed for migration ${migrationId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of all migrations
   */
  async listMigrations(): Promise<DeprecationMigration[]> {
    // Implementation would query from migration storage
    // For now, return empty array
    return [];
  }

  /**
   * Get status of deprecated elements
   */
  async getDeprecationStatus(): Promise<{
    totalDeprecated: number;
    byType: Record<ElementType, number>;
    recentActivity: Array<{ element: string; lastAccessed: string }>;
    readyForRemoval: string[];
  }> {
    // Implementation would query monitoring data
    return {
      totalDeprecated: 0,
      byType: {
        table: 0,
        column: 0,
        index: 0,
        constraint: 0,
        enum: 0,
        function: 0,
        view: 0,
      },
      recentActivity: [],
      readyForRemoval: [],
    };
  }

  // Private helper methods
  private generateMigrationId(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .split(".")[0];
    const random = Math.random().toString(36).substring(2, 8);
    return `dep_${timestamp}_${random}`;
  }

  private async analyzeElement(element: {
    type: ElementType;
    name: string;
    schema?: string;
    reason: DeprecationReason;
  }): Promise<DeprecatedElement> {
    const schema = element.schema || "public";
    const deprecatedName = generateDeprecatedName(element.name, element.reason);

    // Validate naming convention
    if (!validateNamingConvention(deprecatedName)) {
      throw new Error(
        `Generated deprecated name violates naming convention: ${deprecatedName}`,
      );
    }

    // Analyze dependencies
    const dependencies = await this.analyzeDependencies(
      element.type,
      element.name,
      schema,
    );

    // Get usage data (would integrate with analysis from Task #88)
    const usageData: UsageData = {
      lastAccessed: null,
      accessCount: 0,
      confidenceScore: 0.95, // High confidence for now
      analysisDate: new Date().toISOString(),
      accessSources: [],
    };

    // Generate migration SQL
    const migrationSql = this.generateMigrationSql(
      element.type,
      element.name,
      deprecatedName,
      schema,
    );
    const rollbackSql = this.generateRollbackSql(
      element.type,
      deprecatedName,
      element.name,
      schema,
    );

    return {
      type: element.type,
      originalName: element.name,
      deprecatedName,
      schema,
      deprecationDate: new Date().toISOString().split("T")[0],
      reason: element.reason,
      dependencies,
      usageData,
      migrationSql,
      rollbackSql,
    };
  }

  private async analyzeDependencies(
    type: ElementType,
    name: string,
    schema: string,
  ): Promise<ElementDependency[]> {
    const dependencies: ElementDependency[] = [];

    if (type === "table") {
      // Find foreign keys, indexes, constraints
      const foreignKeyQuery = `
        SELECT
          tc.constraint_name,
          kcu.table_name as dependent_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1
          AND (tc.table_name = $2 OR kcu.table_name = $2)
          AND tc.constraint_type = 'FOREIGN KEY'
      `;

      const fkResults = await this.db.execute(sql.raw(foreignKeyQuery), [
        schema,
        name,
      ]);

      // Convert to dependencies (simplified for now)
      for (const row of fkResults.rows) {
        dependencies.push({
          type: "foreign_key",
          name: row.constraint_name as string,
          dependentObject: row.dependent_table as string,
          impact: "high",
        });
      }
    }

    return dependencies;
  }

  private generateMigrationSql(
    type: ElementType,
    originalName: string,
    deprecatedName: string,
    schema: string,
  ): string {
    switch (type) {
      case "table":
        return `ALTER TABLE "${schema}"."${originalName}" RENAME TO "${deprecatedName}";`;
      case "column":
        const [tableName, columnName] = originalName.split(".");
        return `ALTER TABLE "${schema}"."${tableName}" RENAME COLUMN "${columnName}" TO "${deprecatedName}";`;
      case "index":
        return `ALTER INDEX "${schema}"."${originalName}" RENAME TO "${deprecatedName}";`;
      case "constraint":
        const [constraintTable, constraintName] = originalName.split(".");
        return `ALTER TABLE "${schema}"."${constraintTable}" RENAME CONSTRAINT "${constraintName}" TO "${deprecatedName}";`;
      default:
        throw new Error(`Unsupported element type for deprecation: ${type}`);
    }
  }

  private generateRollbackSql(
    type: ElementType,
    deprecatedName: string,
    originalName: string,
    schema: string,
  ): string {
    switch (type) {
      case "table":
        return `ALTER TABLE "${schema}"."${deprecatedName}" RENAME TO "${originalName}";`;
      case "column":
        const [tableName, columnName] = originalName.split(".");
        return `ALTER TABLE "${schema}"."${tableName}" RENAME COLUMN "${deprecatedName}" TO "${columnName}";`;
      case "index":
        return `ALTER INDEX "${schema}"."${deprecatedName}" RENAME TO "${originalName}";`;
      case "constraint":
        const [constraintTable, constraintName] = originalName.split(".");
        return `ALTER TABLE "${schema}"."${constraintTable}" RENAME CONSTRAINT "${deprecatedName}" TO "${constraintName}";`;
      default:
        throw new Error(`Unsupported element type for rollback: ${type}`);
    }
  }

  private requiresApproval(elements: DeprecatedElement[]): boolean {
    // Require approval for tables or high-risk operations
    return elements.some(
      (el) =>
        el.type === "table" ||
        el.dependencies.some((dep) => dep.impact === "high"),
    );
  }

  private estimateDuration(elements: DeprecatedElement[]): number {
    // Estimate duration based on element types and dependencies
    let duration = 0;
    for (const element of elements) {
      switch (element.type) {
        case "table":
          duration += 30; // 30 seconds per table
          break;
        case "index":
          duration += 10; // 10 seconds per index
          break;
        default:
          duration += 5; // 5 seconds for other elements
      }
      duration += element.dependencies.length * 5; // 5 seconds per dependency
    }
    return duration;
  }

  private assessRiskLevel(
    elements: DeprecatedElement[],
  ): "low" | "medium" | "high" {
    // Assess risk based on element types and confidence scores
    const hasTable = elements.some((el) => el.type === "table");
    const lowConfidence = elements.some(
      (el) => el.usageData.confidenceScore < 0.8,
    );
    const hasHighImpactDeps = elements.some((el) =>
      el.dependencies.some((dep) => dep.impact === "high"),
    );

    if (hasTable || lowConfidence || hasHighImpactDeps) {
      return "high";
    }
    if (elements.length > 5) {
      return "medium";
    }
    return "low";
  }

  // Storage methods (would be implemented with actual storage)
  private async storeMigrationPlan(
    migration: DeprecationMigration,
  ): Promise<void> {
    // Store in database or file system
    console.log(`Storing migration plan: ${migration.id}`);
  }

  private async getMigrationPlan(
    migrationId: string,
  ): Promise<DeprecationMigration | null> {
    // Retrieve from storage
    console.log(`Retrieving migration plan: ${migrationId}`);
    return null;
  }

  private async updateMigrationPhase(
    migrationId: string,
    phase: DeprecationMigration["phase"],
  ): Promise<void> {
    // Update phase in storage
    console.log(`Updating migration ${migrationId} phase to: ${phase}`);
  }

  private async createBackup(migration: DeprecationMigration): Promise<void> {
    // Create backup implementation
    console.log(`Creating backup for migration: ${migration.id}`);
  }
}

/**
 * Factory function to create a configured DeprecationSystem
 */
export function createDeprecationSystem(
  db: NodePgDatabase<any>,
  monitor: DeprecatedMonitor,
  rollbackManager: RollbackManager,
): DeprecationSystem {
  return new DeprecationSystem(db, monitor, rollbackManager);
}

/**
 * Utility function to validate if element can be safely deprecated
 */
export async function canDeprecateElement(
  db: NodePgDatabase<any>,
  type: ElementType,
  name: string,
  schema: string = "public",
): Promise<{ canDeprecate: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // Check if element exists
  let exists = false;
  try {
    switch (type) {
      case "table":
        const tableQuery = `
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        `;
        const tableResult = await db.execute(sql.raw(tableQuery), [
          schema,
          name,
        ]);
        exists = (tableResult.rows[0]?.count as number) > 0;
        break;

      case "column":
        const [tableName, columnName] = name.split(".");
        const columnQuery = `
          SELECT COUNT(*) as count
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
        `;
        const columnResult = await db.execute(sql.raw(columnQuery), [
          schema,
          tableName,
          columnName,
        ]);
        exists = (columnResult.rows[0]?.count as number) > 0;
        break;

      // Add other element types as needed
    }
  } catch (error) {
    reasons.push(`Error checking element existence: ${error.message}`);
    return { canDeprecate: false, reasons };
  }

  if (!exists) {
    reasons.push(`Element does not exist: ${type} ${name}`);
    return { canDeprecate: false, reasons };
  }

  // Additional safety checks would be implemented here

  return { canDeprecate: true, reasons: [] };
}
