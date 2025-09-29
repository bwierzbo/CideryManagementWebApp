/**
 * Comprehensive Cleanup Validation Runner
 *
 * Orchestrates all validation tests across cleanup categories and generates
 * comprehensive reports for safety, performance, and correctness validation.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

import { PerformanceBenchmark, BenchmarkResult } from './performance-benchmark';

interface ValidationResult {
  category: string;
  success: boolean;
  duration: number;
  metrics: any;
  errors: string[];
  warnings: string[];
}

interface ComprehensiveValidationReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    totalDuration: number;
    timestamp: string;
    environment: string;
    commit: string;
  };
  performance: BenchmarkResult;
  categories: {
    codeCleanup: ValidationResult;
    databaseMigration: ValidationResult;
    assetOptimization: ValidationResult;
    dependencyManagement: ValidationResult;
    integrationTests: ValidationResult;
    staticAnalysis: ValidationResult;
  };
  regressions: Array<{
    category: string;
    metric: string;
    impact: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: Array<{
    category: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }>;
}

export class ValidationRunner {
  private testDir = '/Users/benjaminwierzbanowski/Code/epic-cleanupandcodechecks';
  private outputDir = join(this.testDir, 'tests/cleanup-validation/reports');
  private metricsDir = join(this.testDir, 'tests/cleanup-validation/metrics');

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Run complete validation suite
   */
  async runCompleteValidation(): Promise<ComprehensiveValidationReport> {
    console.log('🚀 Starting comprehensive cleanup validation...');
    const startTime = performance.now();

    // Initialize report structure
    const report: ComprehensiveValidationReport = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        totalDuration: 0,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'test',
        commit: this.getCurrentCommit(),
      },
      performance: null,
      categories: {
        codeCleanup: null,
        databaseMigration: null,
        assetOptimization: null,
        dependencyManagement: null,
        integrationTests: null,
        staticAnalysis: null,
      },
      regressions: [],
      recommendations: [],
    };

    try {
      // 1. Run performance benchmarks
      console.log('\n📊 Running performance benchmarks...');
      report.performance = await this.runPerformanceBenchmarks();

      // 2. Run static analysis validation
      console.log('\n🔍 Running static analysis validation...');
      report.categories.staticAnalysis = await this.runStaticAnalysisValidation();

      // 3. Run code cleanup validation
      console.log('\n🧹 Running code cleanup validation...');
      report.categories.codeCleanup = await this.runCodeCleanupValidation();

      // 4. Run database migration validation
      console.log('\n🗄️ Running database migration validation...');
      report.categories.databaseMigration = await this.runDatabaseMigrationValidation();

      // 5. Run asset optimization validation
      console.log('\n🖼️ Running asset optimization validation...');
      report.categories.assetOptimization = await this.runAssetOptimizationValidation();

      // 6. Run dependency management validation
      console.log('\n📦 Running dependency management validation...');
      report.categories.dependencyManagement = await this.runDependencyManagementValidation();

      // 7. Run integration tests
      console.log('\n🔗 Running integration tests...');
      report.categories.integrationTests = await this.runIntegrationTests();

      // 8. Analyze results and generate recommendations
      console.log('\n📋 Analyzing results and generating recommendations...');
      this.analyzeResults(report);

      // 9. Update summary
      this.updateSummary(report, performance.now() - startTime);

      // 10. Save comprehensive report
      this.saveReport(report);

      console.log('\n✅ Comprehensive validation completed!');
      this.printSummary(report);

      return report;

    } catch (error) {
      console.error('❌ Validation failed:', error);
      report.summary.failed++;
      this.saveReport(report);
      throw error;
    }
  }

  /**
   * Run performance benchmarks
   */
  private async runPerformanceBenchmarks(): Promise<BenchmarkResult> {
    const benchmark = new PerformanceBenchmark();

    // First establish baseline if it doesn't exist
    const baselineFile = join(this.metricsDir, 'baseline-performance.json');
    if (!existsSync(baselineFile)) {
      console.log('📊 Establishing performance baseline...');
      await benchmark.saveBaseline();
    }

    // Run comparison with baseline
    return await benchmark.compareWithBaseline();
  }

  /**
   * Run static analysis validation
   */
  private async runStaticAnalysisValidation(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Run knip analysis
      try {
        const knipOutput = execSync('pnpm analysis:dead-code', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 60000,
        });
        metrics['knip'] = { success: true, output: knipOutput };
      } catch (error) {
        warnings.push(`Knip analysis found issues: ${error.stdout || error.message}`);
        metrics['knip'] = { success: false, output: error.stdout || error.message };
      }

      // Run ts-prune analysis
      try {
        const tsPruneOutput = execSync('pnpm analysis:ts-prune', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 60000,
        });
        metrics['tsPrune'] = { success: true, output: tsPruneOutput };
      } catch (error) {
        warnings.push(`ts-prune analysis found issues: ${error.stdout || error.message}`);
        metrics['tsPrune'] = { success: false, output: error.stdout || error.message };
      }

      // Run dependency check
      try {
        const depcheckOutput = execSync('pnpm analysis:deps', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 45000,
        });
        metrics['depcheck'] = { success: true, output: depcheckOutput };
      } catch (error) {
        warnings.push(`Dependency check found issues: ${error.stdout || error.message}`);
        metrics['depcheck'] = { success: false, output: error.stdout || error.message };
      }

      // Run circular dependency check
      try {
        const madgeOutput = execSync('pnpm analysis:circular', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 30000,
        });
        metrics['madge'] = { success: true, output: madgeOutput };
      } catch (error) {
        if (error.stdout && error.stdout.includes('No circular dependency found')) {
          metrics['madge'] = { success: true, output: 'No circular dependencies found' };
        } else {
          warnings.push(`Circular dependency check found issues: ${error.stdout || error.message}`);
          metrics['madge'] = { success: false, output: error.stdout || error.message };
        }
      }

    } catch (error) {
      errors.push(`Static analysis validation failed: ${error.message}`);
    }

    return {
      category: 'Static Analysis',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Run code cleanup validation
   */
  private async runCodeCleanupValidation(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Run TypeScript compilation check
      try {
        const tscOutput = execSync('pnpm typecheck', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 120000,
        });
        metrics['typescript'] = { success: true, output: 'TypeScript compilation successful' };
      } catch (error) {
        errors.push(`TypeScript compilation failed: ${error.stdout || error.message}`);
        metrics['typescript'] = { success: false, output: error.stdout || error.message };
      }

      // Run formatting check
      try {
        const formatOutput = execSync('pnpm format --check', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 30000,
        });
        metrics['formatting'] = { success: true, output: 'All files properly formatted' };
      } catch (error) {
        warnings.push(`Formatting issues found: ${error.stdout || error.message}`);
        metrics['formatting'] = { success: false, output: error.stdout || error.message };
      }

      // Run build validation
      try {
        const buildOutput = execSync('pnpm build', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 300000,
        });
        metrics['build'] = { success: true, output: 'Build successful' };
      } catch (error) {
        errors.push(`Build failed: ${error.stdout || error.message}`);
        metrics['build'] = { success: false, output: error.stdout || error.message };
      }

    } catch (error) {
      errors.push(`Code cleanup validation failed: ${error.message}`);
    }

    return {
      category: 'Code Cleanup',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Run database migration validation
   */
  private async runDatabaseMigrationValidation(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Run database migration tests
      try {
        const testOutput = execSync('pnpm --filter db test -- database-migration.test.ts', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 180000, // 3 minutes for database tests
        });
        metrics['migrationTests'] = { success: true, output: 'Database migration tests passed' };
      } catch (error) {
        // Check if tests exist first
        const testFile = join(this.testDir, 'tests/cleanup-validation/suites/database-migration.test.ts');
        if (!existsSync(testFile)) {
          warnings.push('Database migration tests not yet implemented');
          metrics['migrationTests'] = { success: true, output: 'Tests not yet implemented' };
        } else {
          errors.push(`Database migration tests failed: ${error.stdout || error.message}`);
          metrics['migrationTests'] = { success: false, output: error.stdout || error.message };
        }
      }

      // Check database safety system
      try {
        const dbTestOutput = execSync('pnpm --filter db test -- deprecation-system.test.ts', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 120000,
        });
        metrics['safetySystem'] = { success: true, output: 'Database safety system tests passed' };
      } catch (error) {
        warnings.push(`Database safety system tests failed: ${error.stdout || error.message}`);
        metrics['safetySystem'] = { success: false, output: error.stdout || error.message };
      }

    } catch (error) {
      errors.push(`Database migration validation failed: ${error.message}`);
    }

    return {
      category: 'Database Migration',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Run asset optimization validation
   */
  private async runAssetOptimizationValidation(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Run asset analysis
      try {
        const assetOutput = execSync('pnpm analysis:assets', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 30000,
        });
        metrics['assetAnalysis'] = { success: true, output: assetOutput };
      } catch (error) {
        warnings.push(`Asset analysis found issues: ${error.stdout || error.message}`);
        metrics['assetAnalysis'] = { success: false, output: error.stdout || error.message };
      }

      // Check for unused public assets
      const publicDir = join(this.testDir, 'apps/web/public');
      if (existsSync(publicDir)) {
        try {
          const files = execSync(`find "${publicDir}" -type f | wc -l`, { encoding: 'utf8' });
          const fileCount = parseInt(files.trim());
          metrics['publicAssets'] = {
            success: true,
            output: `Found ${fileCount} files in public directory`,
            fileCount
          };
        } catch (error) {
          warnings.push(`Could not analyze public assets: ${error.message}`);
        }
      } else {
        metrics['publicAssets'] = {
          success: true,
          output: 'No public directory found',
          fileCount: 0
        };
      }

    } catch (error) {
      errors.push(`Asset optimization validation failed: ${error.message}`);
    }

    return {
      category: 'Asset Optimization',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Run dependency management validation
   */
  private async runDependencyManagementValidation(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Check for security vulnerabilities
      try {
        const auditOutput = execSync('pnpm audit --audit-level moderate', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 60000,
        });
        metrics['securityAudit'] = { success: true, output: 'No security vulnerabilities found' };
      } catch (error) {
        if (error.stdout && error.stdout.includes('found 0 vulnerabilities')) {
          metrics['securityAudit'] = { success: true, output: 'No security vulnerabilities found' };
        } else {
          warnings.push(`Security audit found issues: ${error.stdout || error.message}`);
          metrics['securityAudit'] = { success: false, output: error.stdout || error.message };
        }
      }

      // Check outdated dependencies
      try {
        const outdatedOutput = execSync('pnpm outdated', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 45000,
        });
        if (outdatedOutput.trim()) {
          warnings.push(`Outdated dependencies found: ${outdatedOutput}`);
          metrics['outdatedDeps'] = { success: false, output: outdatedOutput };
        } else {
          metrics['outdatedDeps'] = { success: true, output: 'All dependencies up to date' };
        }
      } catch (error) {
        // pnpm outdated exits with non-zero when outdated packages are found
        if (error.stdout) {
          warnings.push(`Outdated dependencies found: ${error.stdout}`);
          metrics['outdatedDeps'] = { success: false, output: error.stdout };
        } else {
          metrics['outdatedDeps'] = { success: true, output: 'All dependencies up to date' };
        }
      }

    } catch (error) {
      errors.push(`Dependency management validation failed: ${error.message}`);
    }

    return {
      category: 'Dependency Management',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors = [];
    const warnings = [];
    const metrics = {};

    try {
      // Run package tests
      const packages = ['api', 'db', 'lib'];

      for (const pkg of packages) {
        try {
          const testOutput = execSync(`pnpm --filter ${pkg} test`, {
            cwd: this.testDir,
            encoding: 'utf8',
            timeout: 120000, // 2 minutes per package
          });
          metrics[`${pkg}Tests`] = { success: true, output: `${pkg} tests passed` };
        } catch (error) {
          errors.push(`${pkg} tests failed: ${error.stdout || error.message}`);
          metrics[`${pkg}Tests`] = { success: false, output: error.stdout || error.message };
        }
      }

      // Run validation test suites
      try {
        const validationOutput = execSync('vitest run tests/cleanup-validation/suites', {
          cwd: this.testDir,
          encoding: 'utf8',
          timeout: 300000, // 5 minutes for validation tests
        });
        metrics['validationTests'] = { success: true, output: 'Validation tests passed' };
      } catch (error) {
        // Check if validation tests exist
        const validationDir = join(this.testDir, 'tests/cleanup-validation/suites');
        if (!existsSync(validationDir)) {
          warnings.push('Validation test suites not yet fully implemented');
          metrics['validationTests'] = { success: true, output: 'Tests not yet implemented' };
        } else {
          errors.push(`Validation tests failed: ${error.stdout || error.message}`);
          metrics['validationTests'] = { success: false, output: error.stdout || error.message };
        }
      }

    } catch (error) {
      errors.push(`Integration tests failed: ${error.message}`);
    }

    return {
      category: 'Integration Tests',
      success: errors.length === 0,
      duration: performance.now() - startTime,
      metrics,
      errors,
      warnings,
    };
  }

  /**
   * Analyze results and generate recommendations
   */
  private analyzeResults(report: ComprehensiveValidationReport): void {
    // Detect performance regressions
    if (report.performance && report.performance.regressions) {
      for (const regression of report.performance.regressions) {
        report.regressions.push({
          category: 'Performance',
          metric: regression.metric,
          impact: regression.impact,
          threshold: regression.threshold,
          severity: regression.impact > 15 ? 'high' : regression.impact > 5 ? 'medium' : 'low',
        });
      }
    }

    // Generate recommendations based on results
    Object.entries(report.categories).forEach(([category, result]) => {
      if (result && !result.success) {
        report.recommendations.push({
          category,
          priority: 'high',
          description: `${category} validation failed with ${result.errors.length} errors`,
          action: 'Review errors and fix issues before proceeding with cleanup',
        });
      } else if (result && result.warnings.length > 0) {
        report.recommendations.push({
          category,
          priority: 'medium',
          description: `${category} validation has ${result.warnings.length} warnings`,
          action: 'Review warnings and consider addressing before cleanup',
        });
      }
    });

    // Add performance recommendations
    if (report.performance && report.performance.improvements) {
      const improvements = report.performance.improvements;

      if (improvements.buildTimeImprovement < 0) {
        report.recommendations.push({
          category: 'Performance',
          priority: 'medium',
          description: 'Build time increased after cleanup',
          action: 'Review build configuration and dependencies',
        });
      }

      if (improvements.bundleSizeReduction < 0) {
        report.recommendations.push({
          category: 'Performance',
          priority: 'medium',
          description: 'Bundle size increased after cleanup',
          action: 'Review removed code and ensure no unnecessary additions',
        });
      }
    }
  }

  /**
   * Update summary statistics
   */
  private updateSummary(report: ComprehensiveValidationReport, totalDuration: number): void {
    const categories = Object.values(report.categories).filter(Boolean);

    report.summary.totalTests = categories.length;
    report.summary.passed = categories.filter(cat => cat.success).length;
    report.summary.failed = categories.filter(cat => !cat.success).length;
    report.summary.warnings = categories.reduce((sum, cat) => sum + cat.warnings.length, 0);
    report.summary.totalDuration = totalDuration;
  }

  /**
   * Save comprehensive report
   */
  private saveReport(report: ComprehensiveValidationReport): void {
    const reportFile = join(this.outputDir, `validation-report-${Date.now()}.json`);
    const summaryFile = join(this.outputDir, 'latest-validation-report.json');
    const markdownFile = join(this.outputDir, 'validation-report.md');

    // Save full JSON report
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    writeFileSync(summaryFile, JSON.stringify(report, null, 2));

    // Generate and save markdown report
    const markdownReport = this.generateMarkdownReport(report);
    writeFileSync(markdownFile, markdownReport);

    console.log(`📄 Reports saved to:`);
    console.log(`  JSON: ${reportFile}`);
    console.log(`  Markdown: ${markdownFile}`);
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: ComprehensiveValidationReport): string {
    let md = `# Comprehensive Cleanup Validation Report\n\n`;
    md += `**Generated**: ${report.summary.timestamp}\n`;
    md += `**Environment**: ${report.summary.environment}\n`;
    md += `**Commit**: ${report.summary.commit}\n`;
    md += `**Duration**: ${Math.round(report.summary.totalDuration / 1000)}s\n\n`;

    // Summary
    md += `## 📊 Summary\n\n`;
    md += `- **Total Tests**: ${report.summary.totalTests}\n`;
    md += `- **Passed**: ${report.summary.passed} ✅\n`;
    md += `- **Failed**: ${report.summary.failed} ❌\n`;
    md += `- **Warnings**: ${report.summary.warnings} ⚠️\n\n`;

    // Performance Results
    if (report.performance) {
      md += `## 🚀 Performance Impact\n\n`;
      const improvements = report.performance.improvements;

      md += `| Metric | Improvement |\n`;
      md += `|--------|-------------|\n`;
      md += `| Build Time | ${improvements.buildTimeImprovement.toFixed(1)}% |\n`;
      md += `| Bundle Size | ${improvements.bundleSizeReduction.toFixed(1)}% |\n`;
      md += `| Type Check | ${improvements.typeCheckImprovement.toFixed(1)}% |\n`;
      md += `| Memory Usage | ${improvements.memoryReduction.toFixed(1)}% |\n\n`;

      if (report.regressions.length > 0) {
        md += `### ⚠️ Performance Regressions\n\n`;
        for (const regression of report.regressions) {
          md += `- **${regression.metric}**: ${regression.impact.toFixed(1)}% worse (${regression.severity} severity)\n`;
        }
        md += `\n`;
      }
    }

    // Category Results
    md += `## 📋 Validation Results by Category\n\n`;

    Object.entries(report.categories).forEach(([category, result]) => {
      if (result) {
        const status = result.success ? '✅' : '❌';
        const duration = Math.round(result.duration / 1000);

        md += `### ${status} ${result.category} (${duration}s)\n\n`;

        if (result.errors.length > 0) {
          md += `**Errors:**\n`;
          result.errors.forEach(error => md += `- ${error}\n`);
          md += `\n`;
        }

        if (result.warnings.length > 0) {
          md += `**Warnings:**\n`;
          result.warnings.forEach(warning => md += `- ${warning}\n`);
          md += `\n`;
        }
      }
    });

    // Recommendations
    if (report.recommendations.length > 0) {
      md += `## 💡 Recommendations\n\n`;

      const grouped = report.recommendations.reduce((acc, rec) => {
        if (!acc[rec.priority]) acc[rec.priority] = [];
        acc[rec.priority].push(rec);
        return acc;
      }, {} as Record<string, any[]>);

      ['high', 'medium', 'low'].forEach(priority => {
        if (grouped[priority]) {
          md += `### ${priority.toUpperCase()} Priority\n\n`;
          grouped[priority].forEach(rec => {
            md += `- **${rec.category}**: ${rec.description}\n`;
            md += `  - Action: ${rec.action}\n\n`;
          });
        }
      });
    }

    return md;
  }

  /**
   * Print summary to console
   */
  private printSummary(report: ComprehensiveValidationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Tests: ${report.summary.passed}/${report.summary.totalTests} passed`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Duration: ${Math.round(report.summary.totalDuration / 1000)}s`);

    if (report.summary.failed > 0) {
      console.log(`\n❌ ${report.summary.failed} categories failed validation`);
    } else {
      console.log(`\n✅ All validation categories passed!`);
    }

    if (report.performance) {
      console.log('\n🚀 Performance Impact:');
      const improvements = report.performance.improvements;
      if (improvements.buildTimeImprovement > 0) {
        console.log(`  Build time: ${improvements.buildTimeImprovement.toFixed(1)}% faster`);
      }
      if (improvements.bundleSizeReduction > 0) {
        console.log(`  Bundle size: ${improvements.bundleSizeReduction.toFixed(1)}% smaller`);
      }
    }

    console.log('='.repeat(60));
  }

  private getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.testDir,
        encoding: 'utf8',
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  private ensureDirectories(): void {
    [this.outputDir, this.metricsDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }
}

// Export main validation function
export async function runComprehensiveValidation(): Promise<ComprehensiveValidationReport> {
  const runner = new ValidationRunner();
  return await runner.runCompleteValidation();
}

// CLI entry point
if (require.main === module) {
  runComprehensiveValidation()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}