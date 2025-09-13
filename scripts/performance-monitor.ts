#!/usr/bin/env tsx

/**
 * Performance Monitor for Test Suite
 *
 * Monitors test performance, identifies slow tests, and enforces performance benchmarks.
 * Provides detailed analysis and recommendations for test optimization.
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface TestPerformanceMetrics {
  timestamp: string
  branch: string
  commit: string
  totalDuration: number
  testCount: number
  averageTestDuration: number
  slowTests: SlowTest[]
  packagePerformance: Record<string, PackagePerformance>
  memoryUsage: MemoryMetrics
  environmentInfo: EnvironmentInfo
}

interface SlowTest {
  name: string
  file: string
  duration: number
  threshold: number
  slowRatio: number
}

interface PackagePerformance {
  testCount: number
  totalDuration: number
  averageDuration: number
  slowestTest: string
  slowestDuration: number
}

interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
}

interface EnvironmentInfo {
  nodeVersion: string
  platform: string
  cpuCount: number
  totalMemory: number
  freeMemory: number
}

interface PerformanceBenchmarks {
  maxTotalDuration: number
  maxAverageTestDuration: number
  maxSlowTestRatio: number
  maxMemoryUsage: number
  warningThresholds: {
    totalDuration: number
    averageTestDuration: number
    memoryUsage: number
  }
}

const DEFAULT_BENCHMARKS: PerformanceBenchmarks = {
  maxTotalDuration: 60, // 60 seconds
  maxAverageTestDuration: 1.0, // 1 second per test
  maxSlowTestRatio: 0.1, // 10% of tests can be slow
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  warningThresholds: {
    totalDuration: 45, // Warning at 45 seconds
    averageTestDuration: 0.8, // Warning at 0.8 seconds per test
    memoryUsage: 384 * 1024 * 1024 // Warning at 384MB
  }
}

class PerformanceMonitor {
  private benchmarks: PerformanceBenchmarks
  private resultsDir = path.join(process.cwd(), '.performance-history')

  constructor(customBenchmarks?: Partial<PerformanceBenchmarks>) {
    this.benchmarks = { ...DEFAULT_BENCHMARKS, ...customBenchmarks }
  }

  async init() {
    await fs.mkdir(this.resultsDir, { recursive: true })
  }

  async analyzeTestResults(): Promise<TestPerformanceMetrics> {
    const testResults = await this.loadTestResults()
    const environmentInfo = await this.getEnvironmentInfo()

    const slowTests = this.identifySlowTests(testResults)
    const packagePerformance = this.analyzePackagePerformance(testResults)
    const memoryUsage = this.getMemoryMetrics()

    const totalDuration = testResults.reduce((sum, test) => sum + test.duration, 0) / 1000
    const testCount = testResults.length
    const averageTestDuration = totalDuration / testCount

    return {
      timestamp: new Date().toISOString(),
      branch: this.getCurrentBranch(),
      commit: this.getCurrentCommit(),
      totalDuration,
      testCount,
      averageTestDuration,
      slowTests,
      packagePerformance,
      memoryUsage,
      environmentInfo
    }
  }

  async validatePerformance(metrics: TestPerformanceMetrics): Promise<{
    passed: boolean
    violations: string[]
    warnings: string[]
    recommendations: string[]
  }> {
    const violations: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check total duration
    if (metrics.totalDuration > this.benchmarks.maxTotalDuration) {
      violations.push(`Total test duration ${metrics.totalDuration.toFixed(1)}s exceeds maximum ${this.benchmarks.maxTotalDuration}s`)
      recommendations.push('Optimize slow tests or run tests in parallel')
    } else if (metrics.totalDuration > this.benchmarks.warningThresholds.totalDuration) {
      warnings.push(`Total test duration ${metrics.totalDuration.toFixed(1)}s approaching maximum ${this.benchmarks.maxTotalDuration}s`)
    }

    // Check average test duration
    if (metrics.averageTestDuration > this.benchmarks.maxAverageTestDuration) {
      violations.push(`Average test duration ${metrics.averageTestDuration.toFixed(3)}s exceeds maximum ${this.benchmarks.maxAverageTestDuration}s`)
      recommendations.push('Review and optimize individual test performance')
    } else if (metrics.averageTestDuration > this.benchmarks.warningThresholds.averageTestDuration) {
      warnings.push(`Average test duration ${metrics.averageTestDuration.toFixed(3)}s approaching maximum ${this.benchmarks.maxAverageTestDuration}s`)
    }

    // Check slow test ratio
    const slowTestRatio = metrics.slowTests.length / metrics.testCount
    if (slowTestRatio > this.benchmarks.maxSlowTestRatio) {
      violations.push(`${(slowTestRatio * 100).toFixed(1)}% of tests are slow, exceeding maximum ${(this.benchmarks.maxSlowTestRatio * 100).toFixed(1)}%`)
      recommendations.push('Focus on optimizing the slowest tests first')
    }

    // Check memory usage
    if (metrics.memoryUsage.heapUsed > this.benchmarks.maxMemoryUsage) {
      violations.push(`Memory usage ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB exceeds maximum ${(this.benchmarks.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`)
      recommendations.push('Review tests for memory leaks and excessive allocations')
    } else if (metrics.memoryUsage.heapUsed > this.benchmarks.warningThresholds.memoryUsage) {
      warnings.push(`Memory usage ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB approaching maximum ${(this.benchmarks.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`)
    }

    // Specific recommendations for slow tests
    if (metrics.slowTests.length > 0) {
      const slowestTest = metrics.slowTests[0]
      recommendations.push(`Slowest test: ${slowestTest.name} (${slowestTest.duration.toFixed(1)}s) - consider optimization`)
    }

    // Package-specific recommendations
    Object.entries(metrics.packagePerformance).forEach(([pkg, perf]) => {
      if (perf.averageDuration > 2.0) {
        recommendations.push(`Package ${pkg} has high average test duration (${perf.averageDuration.toFixed(1)}s)`)
      }
    })

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      recommendations
    }
  }

  async storeMetrics(metrics: TestPerformanceMetrics) {
    await this.init()

    const filename = `performance_${metrics.branch}_${Date.now()}.json`
    const filepath = path.join(this.resultsDir, filename)

    await fs.writeFile(filepath, JSON.stringify(metrics, null, 2))

    // Also store in history file for trending
    const historyFile = path.join(this.resultsDir, `${metrics.branch}.jsonl`)
    const historyLine = JSON.stringify(metrics) + '\n'

    try {
      await fs.appendFile(historyFile, historyLine)
    } catch {
      await fs.writeFile(historyFile, historyLine)
    }

    console.log(`Performance metrics stored: ${filename}`)
  }

  async generateReport(metrics: TestPerformanceMetrics): Promise<string> {
    const validation = await this.validatePerformance(metrics)
    const trends = await this.analyzeTrends(metrics.branch)

    let report = `# Test Performance Report\n\n`
    report += `**Branch:** ${metrics.branch}\n`
    report += `**Timestamp:** ${metrics.timestamp}\n`
    report += `**Commit:** ${metrics.commit.substring(0, 8)}\n\n`

    // Overall metrics
    report += `## Performance Summary\n\n`
    report += `| Metric | Value | Status |\n`
    report += `|--------|-------|--------|\n`
    report += `| Total Duration | ${metrics.totalDuration.toFixed(1)}s | ${this.getStatusIcon(metrics.totalDuration <= this.benchmarks.maxTotalDuration)} |\n`
    report += `| Test Count | ${metrics.testCount} | - |\n`
    report += `| Average Duration | ${metrics.averageTestDuration.toFixed(3)}s | ${this.getStatusIcon(metrics.averageTestDuration <= this.benchmarks.maxAverageTestDuration)} |\n`
    report += `| Memory Usage | ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB | ${this.getStatusIcon(metrics.memoryUsage.heapUsed <= this.benchmarks.maxMemoryUsage)} |\n`
    report += `| Slow Tests | ${metrics.slowTests.length} (${((metrics.slowTests.length / metrics.testCount) * 100).toFixed(1)}%) | ${this.getStatusIcon((metrics.slowTests.length / metrics.testCount) <= this.benchmarks.maxSlowTestRatio)} |\n\n`

    // Environment info
    report += `## Environment\n\n`
    report += `- **Node.js:** ${metrics.environmentInfo.nodeVersion}\n`
    report += `- **Platform:** ${metrics.environmentInfo.platform}\n`
    report += `- **CPU Cores:** ${metrics.environmentInfo.cpuCount}\n`
    report += `- **Total Memory:** ${(metrics.environmentInfo.totalMemory / 1024 / 1024 / 1024).toFixed(1)}GB\n`
    report += `- **Free Memory:** ${(metrics.environmentInfo.freeMemory / 1024 / 1024 / 1024).toFixed(1)}GB\n\n`

    // Violations and warnings
    if (validation.violations.length > 0) {
      report += `## 🚨 Performance Violations\n\n`
      validation.violations.forEach(violation => {
        report += `- ${violation}\n`
      })
      report += `\n`
    }

    if (validation.warnings.length > 0) {
      report += `## ⚠️ Performance Warnings\n\n`
      validation.warnings.forEach(warning => {
        report += `- ${warning}\n`
      })
      report += `\n`
    }

    // Slow tests
    if (metrics.slowTests.length > 0) {
      report += `## 🐌 Slowest Tests\n\n`
      report += `| Test | File | Duration | Threshold | Ratio |\n`
      report += `|------|------|----------|-----------|-------|\n`
      metrics.slowTests.slice(0, 10).forEach(test => {
        report += `| ${test.name} | ${test.file} | ${test.duration.toFixed(1)}s | ${test.threshold.toFixed(1)}s | ${test.slowRatio.toFixed(1)}x |\n`
      })
      report += `\n`
    }

    // Package performance
    if (Object.keys(metrics.packagePerformance).length > 0) {
      report += `## Package Performance\n\n`
      report += `| Package | Tests | Total Duration | Avg Duration | Slowest Test |\n`
      report += `|---------|-------|----------------|--------------|----------------|\n`
      Object.entries(metrics.packagePerformance).forEach(([pkg, perf]) => {
        report += `| ${pkg} | ${perf.testCount} | ${perf.totalDuration.toFixed(1)}s | ${perf.averageDuration.toFixed(3)}s | ${perf.slowestTest} (${perf.slowestDuration.toFixed(1)}s) |\n`
      })
      report += `\n`
    }

    // Trends
    if (trends.length > 0) {
      report += `## Performance Trends (Last 10 runs)\n\n`
      const trendSummary = this.summarizeTrends(trends)
      report += `- **Duration Trend:** ${trendSummary.durationTrend}\n`
      report += `- **Test Count Trend:** ${trendSummary.testCountTrend}\n`
      report += `- **Memory Trend:** ${trendSummary.memoryTrend}\n\n`
    }

    // Recommendations
    if (validation.recommendations.length > 0) {
      report += `## 💡 Recommendations\n\n`
      validation.recommendations.forEach(rec => {
        report += `- ${rec}\n`
      })
    }

    return report
  }

  private async loadTestResults(): Promise<any[]> {
    try {
      const resultsPath = path.join(process.cwd(), 'test-results.json')
      const resultsData = await fs.readFile(resultsPath, 'utf-8')
      const results = JSON.parse(resultsData)

      return results.testResults?.flatMap((suite: any) =>
        suite.assertionResults?.map((test: any) => ({
          name: test.title,
          file: suite.name,
          duration: test.duration || 0,
          status: test.status
        })) || []
      ) || []
    } catch (error) {
      console.warn('Could not load test results, using empty array')
      return []
    }
  }

  private identifySlowTests(testResults: any[], threshold: number = 1000): SlowTest[] {
    return testResults
      .filter(test => test.duration > threshold)
      .map(test => ({
        name: test.name,
        file: test.file,
        duration: test.duration / 1000,
        threshold: threshold / 1000,
        slowRatio: test.duration / threshold
      }))
      .sort((a, b) => b.duration - a.duration)
  }

  private analyzePackagePerformance(testResults: any[]): Record<string, PackagePerformance> {
    const packageGroups: Record<string, any[]> = {}

    testResults.forEach(test => {
      const packageMatch = test.file.match(/packages\/([^\/]+)\//)
      if (packageMatch) {
        const packageName = packageMatch[1]
        if (!packageGroups[packageName]) {
          packageGroups[packageName] = []
        }
        packageGroups[packageName].push(test)
      }
    })

    const performance: Record<string, PackagePerformance> = {}

    Object.entries(packageGroups).forEach(([pkg, tests]) => {
      const durations = tests.map(t => t.duration / 1000)
      const totalDuration = durations.reduce((sum, d) => sum + d, 0)
      const slowest = tests.reduce((prev, curr) => prev.duration > curr.duration ? prev : curr)

      performance[pkg] = {
        testCount: tests.length,
        totalDuration,
        averageDuration: totalDuration / tests.length,
        slowestTest: slowest.name,
        slowestDuration: slowest.duration / 1000
      }
    })

    return performance
  }

  private getMemoryMetrics(): MemoryMetrics {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    }
  }

  private async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    const os = await import('os')
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    }
  }

  private async analyzeTrends(branch: string): Promise<TestPerformanceMetrics[]> {
    try {
      const historyFile = path.join(this.resultsDir, `${branch}.jsonl`)
      const historyData = await fs.readFile(historyFile, 'utf-8')

      return historyData
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as TestPerformanceMetrics)
        .slice(-10) // Last 10 entries
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    } catch {
      return []
    }
  }

  private summarizeTrends(trends: TestPerformanceMetrics[]): any {
    if (trends.length < 2) return { durationTrend: 'N/A', testCountTrend: 'N/A', memoryTrend: 'N/A' }

    const first = trends[0]
    const last = trends[trends.length - 1]

    const durationChange = ((last.totalDuration - first.totalDuration) / first.totalDuration) * 100
    const testCountChange = last.testCount - first.testCount
    const memoryChange = ((last.memoryUsage.heapUsed - first.memoryUsage.heapUsed) / first.memoryUsage.heapUsed) * 100

    return {
      durationTrend: `${durationChange > 0 ? '+' : ''}${durationChange.toFixed(1)}%`,
      testCountTrend: `${testCountChange > 0 ? '+' : ''}${testCountChange} tests`,
      memoryTrend: `${memoryChange > 0 ? '+' : ''}${memoryChange.toFixed(1)}%`
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf-8' }).trim()
    } catch {
      return process.env.GITHUB_REF_NAME || 'unknown'
    }
  }

  private getCurrentCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    } catch {
      return process.env.GITHUB_SHA || 'unknown'
    }
  }

  private getStatusIcon(passed: boolean): string {
    return passed ? '✅' : '❌'
  }
}

// CLI interface
async function main() {
  const monitor = new PerformanceMonitor()
  const command = process.argv[2]

  switch (command) {
    case 'analyze':
      const metrics = await monitor.analyzeTestResults()
      await monitor.storeMetrics(metrics)

      const validation = await monitor.validatePerformance(metrics)
      if (!validation.passed) {
        console.error('Performance benchmarks failed:')
        validation.violations.forEach(v => console.error(`  - ${v}`))
        process.exit(1)
      }

      if (validation.warnings.length > 0) {
        console.warn('Performance warnings:')
        validation.warnings.forEach(w => console.warn(`  - ${w}`))
      }

      console.log('Performance analysis completed successfully')
      break

    case 'report':
      const reportMetrics = await monitor.analyzeTestResults()
      const report = await monitor.generateReport(reportMetrics)
      console.log(report)
      break

    case 'validate':
      const validateMetrics = await monitor.analyzeTestResults()
      const result = await monitor.validatePerformance(validateMetrics)

      console.log(JSON.stringify(result, null, 2))
      process.exit(result.passed ? 0 : 1)

    default:
      console.log('Usage: tsx performance-monitor.ts <analyze|report|validate>')
      process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { PerformanceMonitor }