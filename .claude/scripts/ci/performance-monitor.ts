#!/usr/bin/env tsx

/**
 * Performance Monitoring Script for CI Pipeline
 *
 * Tracks build times, test execution, and other performance metrics
 * Generates trend reports and identifies performance regressions
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface PerformanceMetrics {
  timestamp: string;
  commit: string;
  branch: string;
  buildTime: number;
  testTime: number;
  lintTime: number;
  typecheckTime: number;
  installTime: number;
  totalTime: number;
  nodeVersion: string;
  pnpmVersion: string;
  cacheHit: boolean;
  warnings: string[];
  recommendations: string[];
}

interface PerformanceTrend {
  date: string;
  commit: string;
  branch: string;
  buildTime: number;
  testTime: number;
  totalTime: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
}

class PerformanceMonitor {
  private reportsDir: string;
  private trendsDir: string;
  private startTime: number;
  private metrics: Partial<PerformanceMetrics>;

  constructor() {
    this.reportsDir = path.resolve(process.cwd(), 'analysis/reports/ci');
    this.trendsDir = path.resolve(process.cwd(), 'analysis/reports/trends');
    this.startTime = Date.now();
    this.metrics = {
      timestamp: new Date().toISOString(),
      commit: this.getCommitHash(),
      branch: this.getCurrentBranch(),
      nodeVersion: process.version,
      pnpmVersion: this.getPnpmVersion(),
      warnings: [],
      recommendations: []
    };
  }

  async startMonitoring(): Promise<void> {
    console.log('🚀 Starting performance monitoring...');

    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.mkdir(this.trendsDir, { recursive: true });

    this.startTime = Date.now();
  }

  async measureInstall(): Promise<number> {
    console.log('📦 Measuring install time...');
    const start = Date.now();

    try {
      // Check if node_modules exists (cache hit)
      const nodeModulesExists = await this.pathExists('node_modules');
      this.metrics.cacheHit = nodeModulesExists;

      // Install dependencies
      execSync('pnpm install --frozen-lockfile', {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      const duration = Date.now() - start;
      this.metrics.installTime = Math.round(duration / 1000);

      console.log(`📦 Install completed in ${this.metrics.installTime}s (cache ${this.metrics.cacheHit ? 'hit' : 'miss'})`);
      return this.metrics.installTime;
    } catch (error) {
      console.error('❌ Install failed:', error);
      throw error;
    }
  }

  async measureBuild(): Promise<number> {
    console.log('🔨 Measuring build time...');
    const start = Date.now();

    try {
      execSync('pnpm build', {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      const duration = Date.now() - start;
      this.metrics.buildTime = Math.round(duration / 1000);

      console.log(`🔨 Build completed in ${this.metrics.buildTime}s`);
      return this.metrics.buildTime;
    } catch (error) {
      console.error('❌ Build failed:', error);
      throw error;
    }
  }

  async measureTests(): Promise<number> {
    console.log('🧪 Measuring test time...');
    const start = Date.now();

    try {
      execSync('pnpm test', {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      const duration = Date.now() - start;
      this.metrics.testTime = Math.round(duration / 1000);

      console.log(`🧪 Tests completed in ${this.metrics.testTime}s`);
      return this.metrics.testTime;
    } catch (error) {
      console.error('❌ Tests failed:', error);
      throw error;
    }
  }

  async measureLint(): Promise<number> {
    console.log('🔍 Measuring lint time...');
    const start = Date.now();

    try {
      execSync('pnpm lint', {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      const duration = Date.now() - start;
      this.metrics.lintTime = Math.round(duration / 1000);

      console.log(`🔍 Lint completed in ${this.metrics.lintTime}s`);
      return this.metrics.lintTime;
    } catch (error) {
      console.error('❌ Lint failed:', error);
      throw error;
    }
  }

  async measureTypecheck(): Promise<number> {
    console.log('📝 Measuring typecheck time...');
    const start = Date.now();

    try {
      execSync('pnpm typecheck', {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      const duration = Date.now() - start;
      this.metrics.typecheckTime = Math.round(duration / 1000);

      console.log(`📝 Typecheck completed in ${this.metrics.typecheckTime}s`);
      return this.metrics.typecheckTime;
    } catch (error) {
      console.error('❌ Typecheck failed:', error);
      throw error;
    }
  }

  finishMonitoring(): PerformanceMetrics {
    const totalDuration = Date.now() - this.startTime;
    this.metrics.totalTime = Math.round(totalDuration / 1000);

    // Generate insights
    this.generateInsights();

    console.log(`⏱️ Total monitoring time: ${this.metrics.totalTime}s`);
    return this.metrics as PerformanceMetrics;
  }

  private generateInsights(): void {
    const { buildTime = 0, testTime = 0, lintTime = 0, typecheckTime = 0, totalTime = 0 } = this.metrics;

    // Performance warnings
    if (buildTime > 120) {
      this.metrics.warnings!.push(`Build time (${buildTime}s) exceeds 2 minute threshold`);
    }

    if (testTime > 60) {
      this.metrics.warnings!.push(`Test time (${testTime}s) exceeds 1 minute threshold`);
    }

    if (totalTime > 300) {
      this.metrics.warnings!.push(`Total CI time (${totalTime}s) exceeds 5 minute threshold`);
    }

    // Performance recommendations
    if (buildTime > 60) {
      this.metrics.recommendations!.push('Consider enabling Next.js turbopack for faster builds');
    }

    if (testTime > 30) {
      this.metrics.recommendations!.push('Consider running tests in parallel or optimizing test suite');
    }

    if (!this.metrics.cacheHit) {
      this.metrics.recommendations!.push('Enable dependency caching to speed up builds');
    }

    if ((lintTime || 0) > 20) {
      this.metrics.recommendations!.push('Consider using ESLint cache to speed up linting');
    }

    if ((typecheckTime || 0) > 30) {
      this.metrics.recommendations!.push('Consider TypeScript project references for faster type checking');
    }

    // Check ratios
    const buildToTestRatio = testTime > 0 ? buildTime / testTime : 0;
    if (buildToTestRatio > 3) {
      this.metrics.recommendations!.push('Build time significantly exceeds test time - consider build optimization');
    }
  }

  async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    // Save JSON report
    const jsonPath = path.join(this.reportsDir, 'performance-metrics.json');
    await fs.writeFile(jsonPath, JSON.stringify(metrics, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(metrics);
    const mdPath = path.join(this.reportsDir, 'performance-report.md');
    await fs.writeFile(mdPath, markdownReport);

    // Update trends
    await this.updateTrends(metrics);

    console.log(`📄 Performance report saved to ${this.reportsDir}`);
  }

  private generateMarkdownReport(metrics: PerformanceMetrics): string {
    let report = `# Performance Analysis Report\n\n`;
    report += `**Generated:** ${new Date(metrics.timestamp).toUTCString()}\n`;
    report += `**Commit:** ${metrics.commit}\n`;
    report += `**Branch:** ${metrics.branch}\n`;
    report += `**Node:** ${metrics.nodeVersion}\n`;
    report += `**PNPM:** ${metrics.pnpmVersion}\n\n`;

    // Performance metrics table
    report += `## Performance Metrics\n\n`;
    report += `| Stage | Duration | Status |\n`;
    report += `|-------|----------|--------|\n`;
    report += `| Install | ${metrics.installTime || 0}s | ${metrics.cacheHit ? '💚 Cache Hit' : '🟡 Cache Miss'} |\n`;
    report += `| Typecheck | ${metrics.typecheckTime || 0}s | ${(metrics.typecheckTime || 0) > 30 ? '🟡 Slow' : '💚 Good'} |\n`;
    report += `| Lint | ${metrics.lintTime || 0}s | ${(metrics.lintTime || 0) > 20 ? '🟡 Slow' : '💚 Good'} |\n`;
    report += `| Build | ${metrics.buildTime || 0}s | ${(metrics.buildTime || 0) > 120 ? '🔴 Slow' : (metrics.buildTime || 0) > 60 ? '🟡 Moderate' : '💚 Fast'} |\n`;
    report += `| Tests | ${metrics.testTime || 0}s | ${(metrics.testTime || 0) > 60 ? '🔴 Slow' : (metrics.testTime || 0) > 30 ? '🟡 Moderate' : '💚 Fast'} |\n`;
    report += `| **Total** | **${metrics.totalTime}s** | ${metrics.totalTime > 300 ? '🔴 Slow' : metrics.totalTime > 180 ? '🟡 Moderate' : '💚 Fast'} |\n\n`;

    // Performance breakdown chart (ASCII)
    const total = metrics.totalTime;
    if (total > 0) {
      report += `## Time Breakdown\n\n`;
      report += `\`\`\`\n`;
      const stages = [
        { name: 'Install', time: metrics.installTime || 0 },
        { name: 'Typecheck', time: metrics.typecheckTime || 0 },
        { name: 'Lint', time: metrics.lintTime || 0 },
        { name: 'Build', time: metrics.buildTime || 0 },
        { name: 'Tests', time: metrics.testTime || 0 }
      ];

      for (const stage of stages) {
        const percentage = Math.round((stage.time / total) * 100);
        const barLength = Math.round(percentage / 2); // Scale to 50 chars max
        const bar = '█'.repeat(barLength) + '░'.repeat(25 - barLength);
        report += `${stage.name.padEnd(10)} │${bar}│ ${percentage}% (${stage.time}s)\n`;
      }
      report += `\`\`\`\n\n`;
    }

    // Warnings
    if (metrics.warnings.length > 0) {
      report += `## ⚠️ Performance Warnings\n\n`;
      for (const warning of metrics.warnings) {
        report += `- ${warning}\n`;
      }
      report += `\n`;
    }

    // Recommendations
    if (metrics.recommendations.length > 0) {
      report += `## 💡 Performance Recommendations\n\n`;
      for (const rec of metrics.recommendations) {
        report += `- ${rec}\n`;
      }
      report += `\n`;
    }

    return report;
  }

  private async updateTrends(metrics: PerformanceMetrics): Promise<void> {
    const trendFile = path.join(this.trendsDir, 'performance-trends.json');

    let trends: PerformanceTrend[] = [];

    try {
      const existing = await fs.readFile(trendFile, 'utf8');
      trends = JSON.parse(existing);
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Calculate change percentage and trend
    let changePercent = 0;
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';

    if (trends.length > 0) {
      const lastMetrics = trends[trends.length - 1];
      changePercent = ((metrics.totalTime - lastMetrics.totalTime) / lastMetrics.totalTime) * 100;

      if (Math.abs(changePercent) < 5) {
        trend = 'stable';
      } else if (changePercent < 0) {
        trend = 'improving';
      } else {
        trend = 'degrading';
      }
    }

    // Add new trend entry
    trends.push({
      date: metrics.timestamp,
      commit: metrics.commit,
      branch: metrics.branch,
      buildTime: metrics.buildTime || 0,
      testTime: metrics.testTime || 0,
      totalTime: metrics.totalTime,
      changePercent,
      trend
    });

    // Keep only last 50 entries
    if (trends.length > 50) {
      trends = trends.slice(-50);
    }

    await fs.writeFile(trendFile, JSON.stringify(trends, null, 2));

    const trendEmoji = trend === 'improving' ? '📈' : trend === 'degrading' ? '📉' : '➡️';
    console.log(`${trendEmoji} Performance trend: ${trend} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% change)`);
  }

  private getCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getPnpmVersion(): string {
    try {
      return execSync('pnpm --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  const monitor = new PerformanceMonitor();
  await monitor.startMonitoring();

  try {
    switch (command) {
      case 'install':
        await monitor.measureInstall();
        break;
      case 'build':
        await monitor.measureBuild();
        break;
      case 'test':
        await monitor.measureTests();
        break;
      case 'lint':
        await monitor.measureLint();
        break;
      case 'typecheck':
        await monitor.measureTypecheck();
        break;
      case 'full':
        // Full CI pipeline simulation
        await monitor.measureInstall();
        await monitor.measureTypecheck();
        await monitor.measureLint();
        await monitor.measureBuild();
        await monitor.measureTests();
        break;
      case 'analyze':
        // Just analyze existing data
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    const metrics = monitor.finishMonitoring();
    await monitor.saveMetrics(metrics);

    // Output for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::set-output name=total-time::${metrics.totalTime}`);
      console.log(`::set-output name=build-time::${metrics.buildTime || 0}`);
      console.log(`::set-output name=test-time::${metrics.testTime || 0}`);
      console.log(`::set-output name=cache-hit::${metrics.cacheHit}`);
      console.log(`::set-output name=warnings-count::${metrics.warnings.length}`);
    }

    console.log(`🎉 Performance monitoring complete: ${metrics.totalTime}s total`);
  } catch (error) {
    console.error('❌ Performance monitoring failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default PerformanceMonitor;