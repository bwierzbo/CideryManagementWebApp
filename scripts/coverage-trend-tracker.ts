#!/usr/bin/env tsx

/**
 * Coverage Trend Tracker
 *
 * Tracks coverage trends over time and provides analysis for quality gates.
 * Stores historical coverage data and generates trend reports.
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface CoverageMetrics {
  timestamp: string
  branch: string
  commit: string
  coverage: {
    lines: number
    branches: number
    functions: number
    statements: number
  }
  packages: Record<string, {
    lines: number
    branches: number
    functions: number
    statements: number
  }>
  testDuration: number
  testCount: number
}

interface CoverageTrend {
  direction: 'up' | 'down' | 'stable'
  change: number
  previousValue: number
  currentValue: number
}

interface TrendAnalysis {
  overall: CoverageTrend
  packages: Record<string, CoverageTrend>
  recommendations: string[]
  alerts: string[]
}

class CoverageTrendTracker {
  private historyDir = path.join(process.cwd(), '.coverage-history')
  private currentFile = path.join(this.historyDir, 'current.json')
  private trendsFile = path.join(this.historyDir, 'trends.json')

  async init() {
    await fs.mkdir(this.historyDir, { recursive: true })
  }

  async getCurrentCoverage(): Promise<CoverageMetrics | null> {
    try {
      const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json')
      const summaryData = await fs.readFile(summaryPath, 'utf-8')
      const summary = JSON.parse(summaryData)

      const branch = this.getCurrentBranch()
      const commit = this.getCurrentCommit()
      const testResults = await this.getTestResults()

      const metrics: CoverageMetrics = {
        timestamp: new Date().toISOString(),
        branch,
        commit,
        coverage: {
          lines: summary.total.lines.pct,
          branches: summary.total.branches.pct,
          functions: summary.total.functions.pct,
          statements: summary.total.statements.pct
        },
        packages: this.extractPackageCoverage(summary),
        testDuration: testResults.duration,
        testCount: testResults.count
      }

      return metrics
    } catch (error) {
      console.error('Failed to get current coverage:', error)
      return null
    }
  }

  async storeCoverage(metrics: CoverageMetrics) {
    await this.init()

    // Store current metrics
    await fs.writeFile(this.currentFile, JSON.stringify(metrics, null, 2))

    // Append to history
    const historyFile = path.join(this.historyDir, `${metrics.branch}.jsonl`)
    const historyLine = JSON.stringify(metrics) + '\n'

    try {
      await fs.appendFile(historyFile, historyLine)
    } catch {
      await fs.writeFile(historyFile, historyLine)
    }

    console.log(`Coverage metrics stored for ${metrics.branch} at ${metrics.timestamp}`)
  }

  async analyzeTrends(branch: string = 'main', lookbackDays: number = 30): Promise<TrendAnalysis> {
    const historyFile = path.join(this.historyDir, `${branch}.jsonl`)

    try {
      const historyData = await fs.readFile(historyFile, 'utf-8')
      const entries = historyData
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as CoverageMetrics)
        .filter(entry => {
          const entryDate = new Date(entry.timestamp)
          const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
          return entryDate >= cutoffDate
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      if (entries.length < 2) {
        return {
          overall: { direction: 'stable', change: 0, previousValue: 0, currentValue: 0 },
          packages: {},
          recommendations: ['Not enough historical data for trend analysis'],
          alerts: []
        }
      }

      const latest = entries[entries.length - 1]
      const previous = entries[entries.length - 2]

      return this.calculateTrends(previous, latest, entries)
    } catch (error) {
      console.error('Failed to analyze trends:', error)
      return {
        overall: { direction: 'stable', change: 0, previousValue: 0, currentValue: 0 },
        packages: {},
        recommendations: ['Failed to load historical data'],
        alerts: ['Coverage history unavailable']
      }
    }
  }

  private calculateTrends(previous: CoverageMetrics, current: CoverageMetrics, history: CoverageMetrics[]): TrendAnalysis {
    const recommendations: string[] = []
    const alerts: string[] = []

    // Overall coverage trend
    const overallTrend = this.calculateMetricTrend(
      previous.coverage.lines,
      current.coverage.lines
    )

    // Package-specific trends
    const packageTrends: Record<string, CoverageTrend> = {}
    Object.keys(current.packages).forEach(pkg => {
      if (previous.packages[pkg]) {
        packageTrends[pkg] = this.calculateMetricTrend(
          previous.packages[pkg].lines,
          current.packages[pkg].lines
        )
      }
    })

    // Generate recommendations
    if (overallTrend.direction === 'down' && overallTrend.change < -2) {
      alerts.push(`Coverage dropped by ${Math.abs(overallTrend.change).toFixed(1)}% - immediate attention required`)
      recommendations.push('Review recent changes and add missing tests')
    }

    if (overallTrend.direction === 'up') {
      recommendations.push('Great job improving coverage! Consider maintaining this trend')
    }

    // Check for stagnant packages
    Object.entries(packageTrends).forEach(([pkg, trend]) => {
      if (trend.currentValue < 90) {
        recommendations.push(`Package ${pkg} has low coverage (${trend.currentValue.toFixed(1)}%) - needs attention`)
      }
      if (trend.direction === 'down' && trend.change < -5) {
        alerts.push(`Package ${pkg} coverage dropped significantly (${trend.change.toFixed(1)}%)`)
      }
    })

    // Performance analysis
    const avgDuration = history.slice(-5).reduce((sum, entry) => sum + entry.testDuration, 0) / Math.min(5, history.length)
    if (current.testDuration > avgDuration * 1.5) {
      alerts.push('Test suite performance has degraded significantly')
      recommendations.push('Review test performance and optimize slow tests')
    }

    return {
      overall: overallTrend,
      packages: packageTrends,
      recommendations,
      alerts
    }
  }

  private calculateMetricTrend(previous: number, current: number): CoverageTrend {
    const change = current - previous
    const direction = Math.abs(change) < 0.1 ? 'stable' : change > 0 ? 'up' : 'down'

    return {
      direction,
      change,
      previousValue: previous,
      currentValue: current
    }
  }

  async generateReport(branch: string = 'main'): Promise<string> {
    const trends = await this.analyzeTrends(branch)
    const current = await this.getCurrentCoverage()

    let report = `# Coverage Trend Report\n\n`
    report += `**Branch:** ${branch}\n`
    report += `**Generated:** ${new Date().toISOString()}\n\n`

    if (current) {
      report += `## Current Coverage\n\n`
      report += `| Metric | Coverage | Trend |\n`
      report += `|--------|------------|-------|\n`
      report += `| Lines | ${current.coverage.lines.toFixed(1)}% | ${this.getTrendEmoji(trends.overall.direction)} ${trends.overall.change.toFixed(1)}% |\n`
      report += `| Branches | ${current.coverage.branches.toFixed(1)}% | - |\n`
      report += `| Functions | ${current.coverage.functions.toFixed(1)}% | - |\n`
      report += `| Statements | ${current.coverage.statements.toFixed(1)}% | - |\n\n`

      report += `**Test Performance:** ${current.testDuration}s (${current.testCount} tests)\n\n`
    }

    if (trends.alerts.length > 0) {
      report += `## 🚨 Alerts\n\n`
      trends.alerts.forEach(alert => {
        report += `- ${alert}\n`
      })
      report += `\n`
    }

    if (trends.recommendations.length > 0) {
      report += `## 💡 Recommendations\n\n`
      trends.recommendations.forEach(rec => {
        report += `- ${rec}\n`
      })
      report += `\n`
    }

    if (Object.keys(trends.packages).length > 0) {
      report += `## Package Coverage Trends\n\n`
      report += `| Package | Coverage | Trend |\n`
      report += `|---------|------------|-------|\n`
      Object.entries(trends.packages).forEach(([pkg, trend]) => {
        report += `| ${pkg} | ${trend.currentValue.toFixed(1)}% | ${this.getTrendEmoji(trend.direction)} ${trend.change.toFixed(1)}% |\n`
      })
    }

    return report
  }

  private getTrendEmoji(direction: 'up' | 'down' | 'stable'): string {
    switch (direction) {
      case 'up': return '📈'
      case 'down': return '📉'
      case 'stable': return '➡️'
    }
  }

  private extractPackageCoverage(summary: any): Record<string, any> {
    const packages: Record<string, any> = {}

    Object.keys(summary).forEach(key => {
      if (key.startsWith('packages/')) {
        const pkgName = key.split('/')[1]
        packages[pkgName] = {
          lines: summary[key].lines.pct,
          branches: summary[key].branches.pct,
          functions: summary[key].functions.pct,
          statements: summary[key].statements.pct
        }
      }
    })

    return packages
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

  private async getTestResults(): Promise<{ duration: number; count: number }> {
    try {
      const resultsPath = path.join(process.cwd(), 'test-results.json')
      const resultsData = await fs.readFile(resultsPath, 'utf-8')
      const results = JSON.parse(resultsData)

      return {
        duration: results.testResults?.reduce((sum: number, suite: any) => sum + (suite.endTime - suite.startTime), 0) / 1000 || 0,
        count: results.numTotalTests || 0
      }
    } catch {
      return { duration: 0, count: 0 }
    }
  }
}

// CLI interface
async function main() {
  const tracker = new CoverageTrendTracker()
  const command = process.argv[2]
  const branch = process.argv[3] || 'main'

  switch (command) {
    case 'store':
      const current = await tracker.getCurrentCoverage()
      if (current) {
        await tracker.storeCoverage(current)
        console.log('Coverage metrics stored successfully')
      } else {
        console.error('Failed to get current coverage metrics')
        process.exit(1)
      }
      break

    case 'analyze':
      const trends = await tracker.analyzeTrends(branch)
      console.log(JSON.stringify(trends, null, 2))
      break

    case 'report':
      const report = await tracker.generateReport(branch)
      console.log(report)
      break

    default:
      console.log('Usage: tsx coverage-trend-tracker.ts <store|analyze|report> [branch]')
      process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { CoverageTrendTracker }