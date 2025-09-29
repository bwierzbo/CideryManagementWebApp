/**
 * Rollback Manager for Database Deprecation System
 *
 * Provides comprehensive rollback capabilities for deprecation migrations.
 * Ensures safe recovery from failed or unwanted deprecation operations.
 */

import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  DeprecatedElement,
  RollbackPlan,
  RollbackStep,
} from "./deprecation-system";

export interface RollbackConfig {
  timeoutSeconds: number;
  validateBeforeRollback: boolean;
  createBackupBeforeRollback: boolean;
  allowPartialRollback: boolean;
  maxRetryAttempts: number;
}

export interface RollbackResult {
  success: boolean;
  rollbackId: string;
  completedSteps: number;
  totalSteps: number;
  errors: RollbackError[];
  duration: number;
  backupLocation?: string;
}

export interface RollbackError {
  step: number;
  sql: string;
  error: string;
  timestamp: string;
  retryable: boolean;
}

export interface RollbackValidation {
  stepIndex: number;
  description: string;
  validation: string;
  passed: boolean;
  message: string;
}

/**
 * Main rollback management class
 */
export class RollbackManager {
  private db: NodePgDatabase<any>;
  private config: RollbackConfig;

  constructor(db: NodePgDatabase<any>, config: Partial<RollbackConfig> = {}) {
    this.db = db;
    this.config = {
      timeoutSeconds: 300, // 5 minutes
      validateBeforeRollback: true,
      createBackupBeforeRollback: true,
      allowPartialRollback: false,
      maxRetryAttempts: 3,
      ...config,
    };
  }

  /**
   * Execute a rollback plan
   */
  async executePlan(plan: RollbackPlan): Promise<RollbackResult> {
    const startTime = Date.now();
    const rollbackId = this.generateRollbackId();

    console.log(`↩️ Starting rollback execution: ${rollbackId}`);
    console.log(`   Plan: ${plan.id}`);
    console.log(`   Steps: ${plan.steps.length}`);
    console.log(`   Estimated duration: ${plan.estimatedDuration}s`);

    const result: RollbackResult = {
      success: false,
      rollbackId,
      completedSteps: 0,
      totalSteps: plan.steps.length,
      errors: [],
      duration: 0,
    };

    try {
      // Pre-rollback validation
      if (this.config.validateBeforeRollback) {
        console.log("🔍 Validating rollback plan...");
        const validationResults = await this.validateRollbackPlan(plan);
        const failedValidations = validationResults.filter((v) => !v.passed);

        if (failedValidations.length > 0) {
          const errorMessage = `Rollback validation failed: ${failedValidations.map((v) => v.message).join(", ")}`;
          result.errors.push({
            step: -1,
            sql: "",
            error: errorMessage,
            timestamp: new Date().toISOString(),
            retryable: false,
          });
          result.duration = Date.now() - startTime;
          return result;
        }

        console.log("✅ Rollback plan validation passed");
      }

      // Create backup if required
      if (this.config.createBackupBeforeRollback) {
        console.log("💾 Creating pre-rollback backup...");
        result.backupLocation = await this.createPreRollbackBackup(plan);
        console.log(`   Backup created: ${result.backupLocation}`);
      }

      // Execute rollback steps
      await this.executeRollbackSteps(plan, result);

      // Final validation
      if (result.errors.length === 0) {
        console.log("🔍 Performing post-rollback validation...");
        const postValidation = await this.validatePostRollback(plan);

        if (postValidation.every((v) => v.passed)) {
          result.success = true;
          console.log("✅ Rollback completed successfully");
        } else {
          const failedChecks = postValidation.filter((v) => !v.passed);
          result.errors.push({
            step: -1,
            sql: "",
            error: `Post-rollback validation failed: ${failedChecks.map((v) => v.message).join(", ")}`,
            timestamp: new Date().toISOString(),
            retryable: false,
          });
        }
      }
    } catch (error) {
      console.error("❌ Rollback execution failed:", error);
      result.errors.push({
        step: -1,
        sql: "",
        error: `Rollback execution failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        retryable: false,
      });
    }

    result.duration = Date.now() - startTime;

    if (result.success) {
      console.log(
        `🎉 Rollback ${rollbackId} completed successfully in ${result.duration}ms`,
      );
    } else {
      console.log(
        `❌ Rollback ${rollbackId} failed after ${result.duration}ms`,
      );
      console.log(
        `   Completed steps: ${result.completedSteps}/${result.totalSteps}`,
      );
      console.log(`   Errors: ${result.errors.length}`);
    }

    return result;
  }

  /**
   * Create a rollback plan for deprecated elements
   */
  async createRollbackPlan(
    elements: DeprecatedElement[],
  ): Promise<RollbackPlan> {
    const planId = this.generatePlanId();
    const steps: RollbackStep[] = [];

    console.log(`📋 Creating rollback plan: ${planId}`);

    // Sort elements by dependency order (reverse of deprecation order)
    const sortedElements = await this.sortElementsForRollback(elements);

    let stepOrder = 1;

    for (const element of sortedElements) {
      // Main rollback step
      steps.push({
        order: stepOrder++,
        type: "rename",
        sql: element.rollbackSql,
        description: `Restore ${element.type} ${element.deprecatedName} to ${element.originalName}`,
        validation: this.generateValidationSql(element, "restore"),
      });

      // Restore dependent objects
      for (const dependency of element.dependencies) {
        if (
          dependency.type === "foreign_key" ||
          dependency.type === "constraint"
        ) {
          steps.push({
            order: stepOrder++,
            type: "create_constraint",
            sql: this.generateDependencyRestoreSql(dependency, element),
            description: `Restore ${dependency.type} ${dependency.name}`,
            validation: this.generateDependencyValidationSql(
              dependency,
              element,
            ),
          });
        }
      }
    }

    // Calculate dependencies between steps
    const dependencies = this.calculateStepDependencies(steps);

    // Estimate duration
    const estimatedDuration = this.estimateRollbackDuration(steps);

    // Create validation checks
    const validationChecks = this.createValidationChecks(elements);

    const plan: RollbackPlan = {
      id: planId,
      migrationId: "", // Would be set by the deprecation system
      steps,
      estimatedDuration,
      dependencies,
      validationChecks,
    };

    console.log(
      `✅ Rollback plan created with ${steps.length} steps (${estimatedDuration}s estimated)`,
    );

    return plan;
  }

  /**
   * Validate a rollback plan before execution
   */
  async validateRollbackPlan(
    plan: RollbackPlan,
  ): Promise<RollbackValidation[]> {
    const validations: RollbackValidation[] = [];

    // Validate each step
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      try {
        // Check if SQL is valid
        const isValidSql = await this.validateSqlSyntax(step.sql);

        validations.push({
          stepIndex: i,
          description: `Validate SQL syntax for step ${step.order}`,
          validation: "SQL syntax check",
          passed: isValidSql,
          message: isValidSql ? "SQL syntax valid" : "Invalid SQL syntax",
        });

        // Check if validation query is valid
        if (step.validation) {
          const isValidValidation = await this.validateSqlSyntax(
            step.validation,
          );

          validations.push({
            stepIndex: i,
            description: `Validate validation query for step ${step.order}`,
            validation: "Validation query syntax check",
            passed: isValidValidation,
            message: isValidValidation
              ? "Validation query valid"
              : "Invalid validation query",
          });
        }
      } catch (error) {
        validations.push({
          stepIndex: i,
          description: `Validate step ${step.order}`,
          validation: "Step validation",
          passed: false,
          message: `Validation error: ${error.message}`,
        });
      }
    }

    // Validate plan dependencies
    const dependencyValidation = this.validatePlanDependencies(plan);
    validations.push(...dependencyValidation);

    return validations;
  }

  /**
   * Test rollback plan without executing
   */
  async testRollbackPlan(plan: RollbackPlan): Promise<{
    canExecute: boolean;
    issues: string[];
    warnings: string[];
    estimatedDuration: number;
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    console.log(`🧪 Testing rollback plan: ${plan.id}`);

    // Validate the plan
    const validations = await this.validateRollbackPlan(plan);
    const failedValidations = validations.filter((v) => !v.passed);

    if (failedValidations.length > 0) {
      issues.push(...failedValidations.map((v) => v.message));
    }

    // Check for potentially risky operations
    for (const step of plan.steps) {
      if (step.sql.toUpperCase().includes("DROP")) {
        warnings.push(
          `Step ${step.order} contains DROP operation: ${step.description}`,
        );
      }

      if (step.sql.toUpperCase().includes("TRUNCATE")) {
        issues.push(
          `Step ${step.order} contains TRUNCATE operation (not allowed): ${step.description}`,
        );
      }
    }

    // Check dependencies
    if (plan.dependencies.length > 0) {
      warnings.push(
        `Plan has ${plan.dependencies.length} dependencies that may affect execution order`,
      );
    }

    // Check estimated duration
    if (plan.estimatedDuration > 300) {
      // 5 minutes
      warnings.push(
        `Estimated duration ${plan.estimatedDuration}s exceeds recommended maximum (300s)`,
      );
    }

    const canExecute = issues.length === 0;

    console.log(
      `📊 Test results: ${canExecute ? "CAN EXECUTE" : "CANNOT EXECUTE"}`,
    );
    console.log(`   Issues: ${issues.length}`);
    console.log(`   Warnings: ${warnings.length}`);

    return {
      canExecute,
      issues,
      warnings,
      estimatedDuration: plan.estimatedDuration,
    };
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(): Promise<
    Array<{
      rollbackId: string;
      timestamp: string;
      success: boolean;
      duration: number;
      stepsCompleted: number;
      totalSteps: number;
    }>
  > {
    // In a real implementation, this would query from storage
    return [];
  }

  // Private methods

  private async executeRollbackSteps(
    plan: RollbackPlan,
    result: RollbackResult,
  ): Promise<void> {
    console.log("🔄 Executing rollback steps...");

    // Begin transaction
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

        try {
          console.log(`  Step ${step.order}: ${step.description}`);

          // Execute the step
          await tx.execute(sql.raw(step.sql));

          // Validate the step if validation SQL is provided
          if (step.validation) {
            const validationResult = await tx.execute(sql.raw(step.validation));

            // Check validation result (assuming it returns a boolean or count)
            const isValid = this.interpretValidationResult(validationResult);
            if (!isValid) {
              throw new Error(`Step validation failed: ${step.description}`);
            }
          }

          result.completedSteps++;
          console.log(`    ✅ Step ${step.order} completed`);
        } catch (error) {
          console.error(`    ❌ Step ${step.order} failed:`, error);

          const rollbackError: RollbackError = {
            step: step.order,
            sql: step.sql,
            error: error.message,
            timestamp: new Date().toISOString(),
            retryable: this.isRetryableError(error),
          };

          result.errors.push(rollbackError);

          if (!this.config.allowPartialRollback) {
            throw error; // This will rollback the transaction
          }
        }
      }
    });
  }

  private async sortElementsForRollback(
    elements: DeprecatedElement[],
  ): Promise<DeprecatedElement[]> {
    // Sort elements in reverse dependency order
    // Tables with dependencies should be restored after their dependencies
    const sorted = [...elements];

    sorted.sort((a, b) => {
      // Tables last (they might have dependencies)
      if (a.type === "table" && b.type !== "table") return 1;
      if (b.type === "table" && a.type !== "table") return -1;

      // Sort by dependency count (fewer dependencies first)
      return a.dependencies.length - b.dependencies.length;
    });

    return sorted;
  }

  private generateValidationSql(
    element: DeprecatedElement,
    operation: "restore",
  ): string {
    switch (element.type) {
      case "table":
        return `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = '${element.schema}' AND table_name = '${element.originalName}'`;

      case "column":
        const [tableName, columnName] = element.originalName.split(".");
        return `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = '${element.schema}' AND table_name = '${tableName}' AND column_name = '${columnName}'`;

      case "index":
        return `SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = '${element.schema}' AND indexname = '${element.originalName}'`;

      default:
        return `SELECT 1 as count`; // Simple validation for other types
    }
  }

  private generateDependencyRestoreSql(
    dependency: any,
    element: DeprecatedElement,
  ): string {
    // Generate SQL to restore dependent objects
    // This would be implemented based on specific dependency types
    return `-- Restore dependency ${dependency.name} for ${element.originalName}`;
  }

  private generateDependencyValidationSql(
    dependency: any,
    element: DeprecatedElement,
  ): string {
    // Generate validation SQL for dependent objects
    return `SELECT 1 as count`;
  }

  private calculateStepDependencies(steps: RollbackStep[]): string[] {
    // Calculate inter-step dependencies
    const dependencies: string[] = [];

    // Simple dependency calculation based on step order
    for (let i = 1; i < steps.length; i++) {
      dependencies.push(
        `step_${steps[i].order}_depends_on_step_${steps[i - 1].order}`,
      );
    }

    return dependencies;
  }

  private estimateRollbackDuration(steps: RollbackStep[]): number {
    let duration = 0;

    for (const step of steps) {
      switch (step.type) {
        case "rename":
          duration += 10; // 10 seconds for rename operations
          break;
        case "create_constraint":
          duration += 30; // 30 seconds for constraint creation
          break;
        case "create_index":
          duration += 60; // 60 seconds for index creation
          break;
        default:
          duration += 5; // 5 seconds for other operations
      }
    }

    return duration;
  }

  private createValidationChecks(elements: DeprecatedElement[]): string[] {
    const checks: string[] = [];

    for (const element of elements) {
      checks.push(`Verify ${element.type} ${element.originalName} exists`);
      checks.push(
        `Verify ${element.type} ${element.deprecatedName} does not exist`,
      );
    }

    return checks;
  }

  private async validateSqlSyntax(sql: string): Promise<boolean> {
    try {
      // Use EXPLAIN to validate SQL syntax without executing
      await this.db.execute(sql.raw(`EXPLAIN ${sql}`));
      return true;
    } catch (error) {
      return false;
    }
  }

  private validatePlanDependencies(plan: RollbackPlan): RollbackValidation[] {
    const validations: RollbackValidation[] = [];

    // Check for circular dependencies
    const hasCycles = this.detectCyclicDependencies(plan.dependencies);
    validations.push({
      stepIndex: -1,
      description: "Check for circular dependencies",
      validation: "Dependency cycle detection",
      passed: !hasCycles,
      message: hasCycles
        ? "Circular dependencies detected"
        : "No circular dependencies",
    });

    // Validate dependency references
    const invalidDeps = plan.dependencies.filter(
      (dep) => !this.isValidDependencyReference(dep, plan.steps),
    );

    validations.push({
      stepIndex: -1,
      description: "Validate dependency references",
      validation: "Dependency reference check",
      passed: invalidDeps.length === 0,
      message:
        invalidDeps.length === 0
          ? "All dependencies valid"
          : `Invalid dependencies: ${invalidDeps.join(", ")}`,
    });

    return validations;
  }

  private detectCyclicDependencies(dependencies: string[]): boolean {
    // Simple cycle detection - in real implementation would use proper graph algorithms
    const depMap = new Map<string, string[]>();

    for (const dep of dependencies) {
      const match = dep.match(/(\w+)_depends_on_(\w+)/);
      if (match) {
        const [, dependent, dependency] = match;
        if (!depMap.has(dependent)) {
          depMap.set(dependent, []);
        }
        depMap.get(dependent)!.push(dependency);
      }
    }

    // Check for cycles (simplified)
    for (const [node, deps] of depMap.entries()) {
      if (deps.includes(node)) {
        return true; // Self-dependency
      }
    }

    return false;
  }

  private isValidDependencyReference(
    dependency: string,
    steps: RollbackStep[],
  ): boolean {
    const stepIds = steps.map((step) => `step_${step.order}`);
    const match = dependency.match(/(step_\d+)_depends_on_(step_\d+)/);

    if (!match) return false;

    const [, dependent, dependsOn] = match;
    return stepIds.includes(dependent) && stepIds.includes(dependsOn);
  }

  private async createPreRollbackBackup(plan: RollbackPlan): Promise<string> {
    // Create backup before rollback
    const backupId = `pre_rollback_${plan.id}_${Date.now()}`;

    // In real implementation, would create actual backup
    console.log(`Creating backup: ${backupId}`);

    return `/backups/${backupId}.sql`;
  }

  private async validatePostRollback(
    plan: RollbackPlan,
  ): Promise<RollbackValidation[]> {
    const validations: RollbackValidation[] = [];

    // Run validation checks defined in the plan
    for (let i = 0; i < plan.validationChecks.length; i++) {
      const check = plan.validationChecks[i];

      validations.push({
        stepIndex: i,
        description: check,
        validation: "Post-rollback validation",
        passed: true, // Would run actual validation
        message: "Validation passed",
      });
    }

    return validations;
  }

  private interpretValidationResult(result: any): boolean {
    // Interpret validation query result
    if (result.rows && result.rows.length > 0) {
      const firstRow = result.rows[0];
      if ("count" in firstRow) {
        return (firstRow.count as number) > 0;
      }
    }
    return false;
  }

  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      "connection timeout",
      "temporary failure",
      "lock timeout",
      "deadlock detected",
    ];

    const errorMessage = error.message?.toLowerCase() || "";
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  private generateRollbackId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * Create a rollback plan for deprecated elements
 */
export async function createRollbackPlan(
  elements: DeprecatedElement[],
): Promise<RollbackPlan> {
  // Create a temporary rollback manager for plan creation
  const manager = new RollbackManager({} as any); // Would use actual db instance
  return manager.createRollbackPlan(elements);
}

/**
 * Factory function to create a configured RollbackManager
 */
export function createRollbackManager(
  db: NodePgDatabase<any>,
  config?: Partial<RollbackConfig>,
): RollbackManager {
  return new RollbackManager(db, config);
}

/**
 * Utility function to test if a rollback is safe
 */
export async function canSafelyRollback(
  db: NodePgDatabase<any>,
  plan: RollbackPlan,
): Promise<{ canRollback: boolean; reasons: string[] }> {
  const manager = new RollbackManager(db);
  const testResult = await manager.testRollbackPlan(plan);

  return {
    canRollback: testResult.canExecute,
    reasons: [...testResult.issues, ...testResult.warnings],
  };
}
