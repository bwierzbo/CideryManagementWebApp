#!/usr/bin/env tsx

/**
 * Quality Gates Manager
 *
 * Reads configuration and validates CI results against quality thresholds
 * Supports dynamic threshold management and override mechanisms
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

interface QualityGatesConfig {
  performance: {
    max_build_time_seconds: number;
    max_total_ci_time_seconds: number;
    max_install_time_seconds: number;
    max_test_time_seconds: number;
    max_lint_time_seconds: number;
    max_typecheck_time_seconds: number;
  };
  bundle: {
    max_total_size_kb: number;
    max_gzipped_ratio: number;
    max_individual_file_kb: number;
    max_vendor_chunk_kb: number;
    max_css_size_kb: number;
    warn_if_files_exceed: number;
  };
  code_quality: {
    max_dead_code_files: number;
    max_unused_dependencies: number;
    max_circular_dependencies: number;
    max_duplicated_code_blocks: number;
    max_complexity_score: number;
  };
  test_coverage: {
    min_line_coverage_percent: number;
    min_branch_coverage_percent: number;
    min_function_coverage_percent: number;
    enforce_coverage_on_new_code: boolean;
  };
  security: {
    max_high_vulnerabilities: number;
    max_medium_vulnerabilities: number;
    max_low_vulnerabilities: number;
    fail_on_license_issues: boolean;
  };
  notifications: {
    performance_degradation_threshold_percent: number;
    bundle_size_increase_threshold_percent: number;
    send_slack_notifications: boolean;
    send_email_notifications: boolean;
  };
  behavior: {
    fail_fast: boolean;
    allow_override_on_emergency: boolean;
    require_approval_for_threshold_increase: boolean;
    auto_create_issues_for_violations: boolean;
  };
  analysis: {
    enable_trend_tracking: boolean;
    retention_days: number;
    baseline_update_strategy: string;
    comparison_branches: string[];
  };
  reporting: {
    generate_markdown_reports: boolean;
    generate_json_reports: boolean;
    include_recommendations: boolean;
    include_trend_charts: boolean;
    verbose_output: boolean;
  };
}

interface ValidationResult {
  passed: boolean;
  violations: Array<{
    category: string;
    metric: string;
    actual: number | string;
    threshold: number | string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  warnings: string[];
  recommendations: string[];
}

interface MetricsInput {
  performance?: {
    build_time?: number;
    total_time?: number;
    install_time?: number;
    test_time?: number;
    lint_time?: number;
    typecheck_time?: number;
    cache_hit?: boolean;
  };
  bundle?: {
    total_size_kb?: number;
    gzipped_size_kb?: number;
    file_count?: number;
    largest_file_kb?: number;
    css_size_kb?: number;
    vendor_size_kb?: number;
  };
  code_quality?: {
    dead_code_files?: number;
    unused_dependencies?: number;
    circular_dependencies?: number;
    duplicated_blocks?: number;
    complexity_score?: number;
  };
  test_coverage?: {
    line_coverage?: number;
    branch_coverage?: number;
    function_coverage?: number;
  };
  security?: {
    high_vulnerabilities?: number;
    medium_vulnerabilities?: number;
    low_vulnerabilities?: number;
    license_issues?: number;
  };
}

class QualityGatesManager {
  private config: QualityGatesConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.resolve(process.cwd(), '.github/quality-gates.yml');
  }

  async loadConfig(): Promise<QualityGatesConfig> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      this.config = yaml.load(configContent) as QualityGatesConfig;
      return this.config;
    } catch (error) {
      console.warn(`Warning: Could not load quality gates config from ${this.configPath}`);
      console.warn('Using default configuration...');
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): QualityGatesConfig {
    return {
      performance: {
        max_build_time_seconds: 120,
        max_total_ci_time_seconds: 600,
        max_install_time_seconds: 60,
        max_test_time_seconds: 60,
        max_lint_time_seconds: 20,
        max_typecheck_time_seconds: 30
      },
      bundle: {
        max_total_size_kb: 1000,
        max_gzipped_ratio: 0.4,
        max_individual_file_kb: 100,
        max_vendor_chunk_kb: 300,
        max_css_size_kb: 50,
        warn_if_files_exceed: 10
      },
      code_quality: {
        max_dead_code_files: 5,
        max_unused_dependencies: 3,
        max_circular_dependencies: 0,
        max_duplicated_code_blocks: 5,
        max_complexity_score: 10
      },
      test_coverage: {
        min_line_coverage_percent: 80,
        min_branch_coverage_percent: 70,
        min_function_coverage_percent: 85,
        enforce_coverage_on_new_code: true
      },
      security: {
        max_high_vulnerabilities: 0,
        max_medium_vulnerabilities: 2,
        max_low_vulnerabilities: 10,
        fail_on_license_issues: true
      },
      notifications: {
        performance_degradation_threshold_percent: 15,
        bundle_size_increase_threshold_percent: 10,
        send_slack_notifications: false,
        send_email_notifications: false
      },
      behavior: {
        fail_fast: false,
        allow_override_on_emergency: false,
        require_approval_for_threshold_increase: true,
        auto_create_issues_for_violations: true
      },
      analysis: {
        enable_trend_tracking: true,
        retention_days: 30,
        baseline_update_strategy: 'auto',
        comparison_branches: ['main', 'develop']
      },
      reporting: {
        generate_markdown_reports: true,
        generate_json_reports: true,
        include_recommendations: true,
        include_trend_charts: false,
        verbose_output: false
      }
    };
  }

  async validateMetrics(metrics: MetricsInput): Promise<ValidationResult> {
    if (!this.config) {
      await this.loadConfig();
    }

    const result: ValidationResult = {
      passed: true,
      violations: [],
      warnings: [],
      recommendations: []
    };

    // Validate performance metrics
    if (metrics.performance) {
      this.validatePerformance(metrics.performance, result);
    }

    // Validate bundle metrics
    if (metrics.bundle) {
      this.validateBundle(metrics.bundle, result);
    }

    // Validate code quality metrics
    if (metrics.code_quality) {
      this.validateCodeQuality(metrics.code_quality, result);
    }

    // Validate test coverage
    if (metrics.test_coverage) {
      this.validateTestCoverage(metrics.test_coverage, result);
    }

    // Validate security metrics
    if (metrics.security) {
      this.validateSecurity(metrics.security, result);
    }

    // Generate recommendations
    this.generateRecommendations(metrics, result);

    // Determine overall pass/fail
    result.passed = result.violations.filter(v => v.severity === 'error').length === 0;

    return result;
  }

  private validatePerformance(perf: NonNullable<MetricsInput['performance']>, result: ValidationResult): void {
    const config = this.config.performance;

    if (perf.build_time !== undefined && perf.build_time > config.max_build_time_seconds) {
      result.violations.push({
        category: 'performance',
        metric: 'build_time',
        actual: perf.build_time,
        threshold: config.max_build_time_seconds,
        severity: 'error',
        message: `Build time ${perf.build_time}s exceeds threshold of ${config.max_build_time_seconds}s`,
        suggestion: 'Consider enabling caching, optimizing webpack config, or using Next.js Turbopack'
      });
    }

    if (perf.total_time !== undefined && perf.total_time > config.max_total_ci_time_seconds) {
      result.violations.push({
        category: 'performance',
        metric: 'total_time',
        actual: perf.total_time,
        threshold: config.max_total_ci_time_seconds,
        severity: 'error',
        message: `Total CI time ${perf.total_time}s exceeds threshold of ${config.max_total_ci_time_seconds}s`,
        suggestion: 'Consider parallelizing jobs or optimizing CI pipeline'
      });
    }

    if (perf.test_time !== undefined && perf.test_time > config.max_test_time_seconds) {
      result.violations.push({
        category: 'performance',
        metric: 'test_time',
        actual: perf.test_time,
        threshold: config.max_test_time_seconds,
        severity: 'warning',
        message: `Test time ${perf.test_time}s exceeds threshold of ${config.max_test_time_seconds}s`,
        suggestion: 'Consider running tests in parallel or optimizing test suite'
      });
    }

    if (perf.cache_hit === false) {
      result.warnings.push('CI cache miss detected - consider optimizing caching strategy');
    }
  }

  private validateBundle(bundle: NonNullable<MetricsInput['bundle']>, result: ValidationResult): void {
    const config = this.config.bundle;

    if (bundle.total_size_kb !== undefined && bundle.total_size_kb > config.max_total_size_kb) {
      result.violations.push({
        category: 'bundle',
        metric: 'total_size',
        actual: bundle.total_size_kb,
        threshold: config.max_total_size_kb,
        severity: 'error',
        message: `Bundle size ${bundle.total_size_kb}KB exceeds threshold of ${config.max_total_size_kb}KB`,
        suggestion: 'Consider code splitting, tree shaking, or removing unused dependencies'
      });
    }

    if (bundle.total_size_kb && bundle.gzipped_size_kb) {
      const ratio = bundle.gzipped_size_kb / bundle.total_size_kb;
      if (ratio > config.max_gzipped_ratio) {
        result.violations.push({
          category: 'bundle',
          metric: 'compression_ratio',
          actual: Math.round(ratio * 100),
          threshold: Math.round(config.max_gzipped_ratio * 100),
          severity: 'warning',
          message: `Poor compression ratio: ${Math.round(ratio * 100)}% (threshold: ${Math.round(config.max_gzipped_ratio * 100)}%)`,
          suggestion: 'Bundle contains files that compress poorly - check for binary data or already compressed assets'
        });
      }
    }

    if (bundle.css_size_kb !== undefined && bundle.css_size_kb > config.max_css_size_kb) {
      result.violations.push({
        category: 'bundle',
        metric: 'css_size',
        actual: bundle.css_size_kb,
        threshold: config.max_css_size_kb,
        severity: 'warning',
        message: `CSS size ${bundle.css_size_kb}KB exceeds threshold of ${config.max_css_size_kb}KB`,
        suggestion: 'Consider CSS optimization, unused CSS removal, or critical CSS extraction'
      });
    }
  }

  private validateCodeQuality(quality: NonNullable<MetricsInput['code_quality']>, result: ValidationResult): void {
    const config = this.config.code_quality;

    if (quality.dead_code_files !== undefined && quality.dead_code_files > config.max_dead_code_files) {
      result.violations.push({
        category: 'code_quality',
        metric: 'dead_code',
        actual: quality.dead_code_files,
        threshold: config.max_dead_code_files,
        severity: 'error',
        message: `Dead code files (${quality.dead_code_files}) exceed threshold of ${config.max_dead_code_files}`,
        suggestion: 'Remove unused files and functions identified by knip'
      });
    }

    if (quality.unused_dependencies !== undefined && quality.unused_dependencies > config.max_unused_dependencies) {
      result.violations.push({
        category: 'code_quality',
        metric: 'unused_deps',
        actual: quality.unused_dependencies,
        threshold: config.max_unused_dependencies,
        severity: 'error',
        message: `Unused dependencies (${quality.unused_dependencies}) exceed threshold of ${config.max_unused_dependencies}`,
        suggestion: 'Remove unused dependencies from package.json'
      });
    }

    if (quality.circular_dependencies !== undefined && quality.circular_dependencies > config.max_circular_dependencies) {
      result.violations.push({
        category: 'code_quality',
        metric: 'circular_deps',
        actual: quality.circular_dependencies,
        threshold: config.max_circular_dependencies,
        severity: 'error',
        message: `Circular dependencies (${quality.circular_dependencies}) exceed threshold of ${config.max_circular_dependencies}`,
        suggestion: 'Refactor imports to eliminate circular dependencies'
      });
    }
  }

  private validateTestCoverage(coverage: NonNullable<MetricsInput['test_coverage']>, result: ValidationResult): void {
    const config = this.config.test_coverage;

    if (coverage.line_coverage !== undefined && coverage.line_coverage < config.min_line_coverage_percent) {
      result.violations.push({
        category: 'test_coverage',
        metric: 'line_coverage',
        actual: coverage.line_coverage,
        threshold: config.min_line_coverage_percent,
        severity: 'warning',
        message: `Line coverage ${coverage.line_coverage}% below threshold of ${config.min_line_coverage_percent}%`,
        suggestion: 'Add tests to improve code coverage'
      });
    }

    if (coverage.branch_coverage !== undefined && coverage.branch_coverage < config.min_branch_coverage_percent) {
      result.violations.push({
        category: 'test_coverage',
        metric: 'branch_coverage',
        actual: coverage.branch_coverage,
        threshold: config.min_branch_coverage_percent,
        severity: 'warning',
        message: `Branch coverage ${coverage.branch_coverage}% below threshold of ${config.min_branch_coverage_percent}%`,
        suggestion: 'Add tests for conditional logic and edge cases'
      });
    }
  }

  private validateSecurity(security: NonNullable<MetricsInput['security']>, result: ValidationResult): void {
    const config = this.config.security;

    if (security.high_vulnerabilities !== undefined && security.high_vulnerabilities > config.max_high_vulnerabilities) {
      result.violations.push({
        category: 'security',
        metric: 'high_vulnerabilities',
        actual: security.high_vulnerabilities,
        threshold: config.max_high_vulnerabilities,
        severity: 'error',
        message: `High severity vulnerabilities (${security.high_vulnerabilities}) exceed threshold of ${config.max_high_vulnerabilities}`,
        suggestion: 'Update dependencies with high severity vulnerabilities immediately'
      });
    }

    if (security.medium_vulnerabilities !== undefined && security.medium_vulnerabilities > config.max_medium_vulnerabilities) {
      result.violations.push({
        category: 'security',
        metric: 'medium_vulnerabilities',
        actual: security.medium_vulnerabilities,
        threshold: config.max_medium_vulnerabilities,
        severity: 'warning',
        message: `Medium severity vulnerabilities (${security.medium_vulnerabilities}) exceed threshold of ${config.max_medium_vulnerabilities}`,
        suggestion: 'Plan to update dependencies with medium severity vulnerabilities'
      });
    }
  }

  private generateRecommendations(metrics: MetricsInput, result: ValidationResult): void {
    // Performance recommendations
    if (metrics.performance?.build_time && metrics.performance.build_time > 60) {
      result.recommendations.push('Consider enabling Next.js Turbopack for faster builds');
    }

    if (metrics.performance?.cache_hit === false) {
      result.recommendations.push('Implement CI dependency caching to speed up builds');
    }

    // Bundle recommendations
    if (metrics.bundle?.total_size_kb && metrics.bundle.total_size_kb > 500) {
      result.recommendations.push('Consider implementing code splitting and lazy loading');
    }

    // Code quality recommendations
    if (metrics.code_quality?.dead_code_files && metrics.code_quality.dead_code_files > 0) {
      result.recommendations.push('Regular cleanup of unused code improves maintainability');
    }
  }

  async generateReport(validation: ValidationResult): Promise<string> {
    let report = '# Quality Gates Validation Report\n\n';

    // Overall status
    const status = validation.passed ? '✅ PASSED' : '❌ FAILED';
    const emoji = validation.passed ? '🎉' : '⚠️';
    report += `**Status:** ${status} ${emoji}\n\n`;

    // Violations summary
    const errors = validation.violations.filter(v => v.severity === 'error');
    const warnings = validation.violations.filter(v => v.severity === 'warning');

    if (errors.length > 0 || warnings.length > 0) {
      report += '## Quality Gate Violations\n\n';

      if (errors.length > 0) {
        report += '### ❌ Errors (Must Fix)\n\n';
        for (const error of errors) {
          report += `- **${error.metric}:** ${error.message}\n`;
          if (error.suggestion) {
            report += `  - *Suggestion:* ${error.suggestion}\n`;
          }
        }
        report += '\n';
      }

      if (warnings.length > 0) {
        report += '### ⚠️ Warnings (Should Fix)\n\n';
        for (const warning of warnings) {
          report += `- **${warning.metric}:** ${warning.message}\n`;
          if (warning.suggestion) {
            report += `  - *Suggestion:* ${warning.suggestion}\n`;
          }
        }
        report += '\n';
      }
    }

    // Recommendations
    if (validation.recommendations.length > 0) {
      report += '## 💡 Recommendations\n\n';
      for (const rec of validation.recommendations) {
        report += `- ${rec}\n`;
      }
      report += '\n';
    }

    // Configuration info
    report += '## 📋 Configuration\n\n';
    report += `Quality gates configuration loaded from: \`${this.configPath}\`\n\n`;

    return report;
  }

  getThresholds(): QualityGatesConfig {
    return this.config;
  }

  async saveReport(validation: ValidationResult, outputPath: string): Promise<void> {
    const report = await this.generateReport(validation);
    await fs.writeFile(outputPath, report);
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'validate';

  const manager = new QualityGatesManager();
  await manager.loadConfig();

  try {
    switch (command) {
      case 'validate': {
        // Read metrics from stdin or file
        const metricsFile = args[1] || 'analysis/reports/ci/metrics.json';
        let metrics: MetricsInput = {};

        try {
          const content = await fs.readFile(metricsFile, 'utf8');
          metrics = JSON.parse(content);
        } catch {
          console.warn(`Could not read metrics from ${metricsFile}, using empty metrics`);
        }

        const validation = await manager.validateMetrics(metrics);
        console.log(await manager.generateReport(validation));

        // Save report
        await manager.saveReport(validation, 'analysis/reports/ci/quality-gates-report.md');

        // Exit with error code if validation failed
        process.exit(validation.passed ? 0 : 1);
        break;
      }
      case 'config': {
        console.log('Current Quality Gates Configuration:');
        console.log(JSON.stringify(manager.getThresholds(), null, 2));
        break;
      }
      case 'thresholds': {
        const thresholds = manager.getThresholds();
        // Output in format suitable for GitHub Actions
        console.log(`MAX_BUILD_TIME_SECONDS=${thresholds.performance.max_build_time_seconds}`);
        console.log(`MAX_BUNDLE_SIZE_KB=${thresholds.bundle.max_total_size_kb}`);
        console.log(`MAX_DEAD_CODE_FILES=${thresholds.code_quality.max_dead_code_files}`);
        console.log(`MAX_UNUSED_DEPS=${thresholds.code_quality.max_unused_dependencies}`);
        console.log(`MAX_CIRCULAR_DEPS=${thresholds.code_quality.max_circular_dependencies}`);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: quality-gates-manager.ts [validate|config|thresholds] [metrics-file]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Quality gates validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default QualityGatesManager;