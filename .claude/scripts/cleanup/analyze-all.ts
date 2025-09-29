#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AssetScanner } from './asset-scanner';
import { DatabaseScanner } from './database-scanner';
import { ReportConsolidator } from './report-consolidator';

const execAsync = promisify(exec);

interface AnalysisOptions {
  baseline?: boolean;
  outputDir?: string;
  verbose?: boolean;
  skipExternal?: boolean;
}

interface AnalysisResult {
  success: boolean;
  reportPath: string;
  timestamp: string;
  duration: number;
  errors: string[];
}

class ComprehensiveAnalyzer {
  private readonly rootDir: string;
  private readonly outputDir: string;
  private readonly verbose: boolean;
  private errors: string[] = [];

  constructor(options: AnalysisOptions = {}) {
    this.rootDir = process.cwd();
    this.outputDir = options.outputDir || join(this.rootDir, 'reports');
    this.verbose = options.verbose || false;
  }

  async runCompleteAnalysis(options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    console.log('🔬 Starting comprehensive codebase analysis...');

    try {
      // Create reports directory
      await this.ensureReportDirectory();

      // Run all analysis tools in parallel where possible
      const analysisResults = await this.runAllAnalysisTools(options);

      // Generate consolidated report
      const consolidatedReportPath = await this.generateConsolidatedReport(timestamp);

      // Create baseline if requested
      if (options.baseline) {
        await this.createBaseline(consolidatedReportPath);
      }

      const duration = Date.now() - startTime;

      console.log(`✅ Analysis completed in ${duration}ms`);
      console.log(`📊 Reports saved to: ${this.outputDir}`);

      return {
        success: true,
        reportPath: consolidatedReportPath,
        timestamp,
        duration,
        errors: this.errors
      };

    } catch (error) {
      this.errors.push(`Analysis failed: ${error}`);
      console.error('❌ Analysis failed:', error);

      return {
        success: false,
        reportPath: '',
        timestamp,
        duration: Date.now() - startTime,
        errors: this.errors
      };
    }
  }

  private async ensureReportDirectory(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  private async runAllAnalysisTools(options: AnalysisOptions): Promise<void> {
    console.log('🛠️ Running analysis tools...');

    const analysisPromises = [];

    // Run external tools
    if (!options.skipExternal) {
      analysisPromises.push(
        this.runKnipAnalysis(),
        this.runTsPruneAnalysis(),
        this.runDepcheckAnalysis(),
        this.runMadgeAnalysis()
      );
    }

    // Run custom scanners
    analysisPromises.push(
      this.runAssetAnalysis(),
      this.runDatabaseAnalysis()
    );

    // Wait for all analyses to complete
    const results = await Promise.allSettled(analysisPromises);

    // Log any failures
    results.forEach((result, index) => {
      const toolNames = ['knip', 'ts-prune', 'depcheck', 'madge', 'asset-scanner', 'database-scanner'];
      if (result.status === 'rejected') {
        this.errors.push(`${toolNames[index]} analysis failed: ${result.reason}`);
        if (this.verbose) {
          console.warn(`⚠️ ${toolNames[index]} analysis failed:`, result.reason);
        }
      }
    });
  }

  private async runKnipAnalysis(): Promise<void> {
    if (this.verbose) console.log('  📦 Running knip analysis...');

    try {
      const { stdout, stderr } = await execAsync('npx knip --config knip.json --reporter json', {
        cwd: this.rootDir,
        timeout: 120000 // 2 minutes
      });

      if (stderr && !stderr.includes('warn')) {
        this.errors.push(`Knip warnings: ${stderr}`);
      }

      // Parse and save knip results
      const knipResult = JSON.parse(stdout || '{}');
      await fs.writeFile(
        join(this.outputDir, 'knip-report.json'),
        JSON.stringify(knipResult, null, 2)
      );

    } catch (error) {
      // Knip might exit with non-zero code when finding issues
      if (error.stdout) {
        try {
          const knipResult = JSON.parse(error.stdout);
          await fs.writeFile(
            join(this.outputDir, 'knip-report.json'),
            JSON.stringify(knipResult, null, 2)
          );
        } catch (parseError) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  private async runTsPruneAnalysis(): Promise<void> {
    if (this.verbose) console.log('  🌲 Running ts-prune analysis...');

    try {
      const { stdout } = await execAsync('npx ts-prune --project tsconfig.base.json', {
        cwd: this.rootDir,
        timeout: 120000
      });

      // Parse ts-prune output
      const lines = stdout.split('\n').filter(line => line.trim());
      const unusedExports = lines.map(line => {
        const match = line.match(/^(.+):(\d+)\s*-\s*(.+)$/);
        if (match) {
          return {
            file: match[1],
            line: parseInt(match[2]),
            name: match[3]
          };
        }
        return null;
      }).filter(Boolean);

      const tsPruneResult = { unusedExports };
      await fs.writeFile(
        join(this.outputDir, 'ts-prune-report.json'),
        JSON.stringify(tsPruneResult, null, 2)
      );

    } catch (error) {
      // ts-prune might not find issues
      const tsPruneResult = { unusedExports: [] };
      await fs.writeFile(
        join(this.outputDir, 'ts-prune-report.json'),
        JSON.stringify(tsPruneResult, null, 2)
      );
    }
  }

  private async runDepcheckAnalysis(): Promise<void> {
    if (this.verbose) console.log('  📋 Running depcheck analysis...');

    try {
      const { stdout } = await execAsync('npx depcheck --json', {
        cwd: this.rootDir,
        timeout: 120000
      });

      const depcheckResult = JSON.parse(stdout);
      await fs.writeFile(
        join(this.outputDir, 'depcheck-report.json'),
        JSON.stringify(depcheckResult, null, 2)
      );

    } catch (error) {
      throw new Error(`Depcheck failed: ${error.message}`);
    }
  }

  private async runMadgeAnalysis(): Promise<void> {
    if (this.verbose) console.log('  🔄 Running madge analysis...');

    try {
      const { stdout } = await execAsync('npx madge --circular --json apps/web/src packages/*/src', {
        cwd: this.rootDir,
        timeout: 120000
      });

      const circular = JSON.parse(stdout || '[]');
      const madgeResult = {
        circular,
        summary: {
          totalFiles: 0, // Would need separate call to get this
          circularDependencies: circular.length
        }
      };

      await fs.writeFile(
        join(this.outputDir, 'madge-report.json'),
        JSON.stringify(madgeResult, null, 2)
      );

    } catch (error) {
      // Madge might exit with error code when finding circular deps
      if (error.stdout) {
        try {
          const circular = JSON.parse(error.stdout);
          const madgeResult = {
            circular,
            summary: {
              totalFiles: 0,
              circularDependencies: circular.length
            }
          };
          await fs.writeFile(
            join(this.outputDir, 'madge-report.json'),
            JSON.stringify(madgeResult, null, 2)
          );
        } catch (parseError) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  private async runAssetAnalysis(): Promise<void> {
    if (this.verbose) console.log('  🖼️ Running asset analysis...');

    const scanner = new AssetScanner(this.rootDir);
    await scanner.saveReport(join(this.outputDir, 'asset-analysis.json'));
  }

  private async runDatabaseAnalysis(): Promise<void> {
    if (this.verbose) console.log('  🗄️ Running database analysis...');

    const scanner = new DatabaseScanner(this.rootDir);
    await scanner.saveReport(join(this.outputDir, 'database-analysis.json'));
  }

  private async generateConsolidatedReport(timestamp: string): Promise<string> {
    if (this.verbose) console.log('  📊 Generating consolidated report...');

    const consolidator = new ReportConsolidator(this.outputDir);
    const reportPath = join(this.outputDir, `consolidated-analysis-${timestamp}.json`);
    await consolidator.saveReport(reportPath);

    // Also create a "latest" symlink for convenience
    const latestPath = join(this.outputDir, 'consolidated-analysis-latest.json');
    try {
      await fs.unlink(latestPath);
    } catch {
      // File might not exist
    }

    // Copy instead of symlink for Windows compatibility
    const reportContent = await fs.readFile(reportPath);
    await fs.writeFile(latestPath, reportContent);

    return reportPath;
  }

  private async createBaseline(reportPath: string): Promise<void> {
    if (this.verbose) console.log('  📋 Creating baseline...');

    const baselinePath = join(this.outputDir, 'baseline-analysis.json');
    const reportContent = await fs.readFile(reportPath);
    await fs.writeFile(baselinePath, reportContent);

    console.log(`📋 Baseline saved to: ${baselinePath}`);
  }

  async compareWithBaseline(currentReportPath?: string): Promise<void> {
    const baselinePath = join(this.outputDir, 'baseline-analysis.json');
    const currentPath = currentReportPath || join(this.outputDir, 'consolidated-analysis-latest.json');

    try {
      const [baseline, current] = await Promise.all([
        fs.readFile(baselinePath, 'utf-8').then(JSON.parse),
        fs.readFile(currentPath, 'utf-8').then(JSON.parse)
      ]);

      const comparison = {
        baseline: {
          date: baseline.analysisDate,
          totalIssues: baseline.summary.totalIssues,
          highRisk: baseline.summary.highRiskItems,
          mediumRisk: baseline.summary.mediumRiskItems,
          lowRisk: baseline.summary.lowRiskItems
        },
        current: {
          date: current.analysisDate,
          totalIssues: current.summary.totalIssues,
          highRisk: current.summary.highRiskItems,
          mediumRisk: current.summary.mediumRiskItems,
          lowRisk: current.summary.lowRiskItems
        },
        changes: {
          totalIssues: current.summary.totalIssues - baseline.summary.totalIssues,
          highRisk: current.summary.highRiskItems - baseline.summary.highRiskItems,
          mediumRisk: current.summary.mediumRiskItems - baseline.summary.mediumRiskItems,
          lowRisk: current.summary.lowRiskItems - baseline.summary.lowRiskItems
        }
      };

      const comparisonPath = join(this.outputDir, 'baseline-comparison.json');
      await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2));

      console.log(`📊 Baseline comparison saved to: ${comparisonPath}`);
      console.log(`📈 Changes: ${comparison.changes.totalIssues > 0 ? '+' : ''}${comparison.changes.totalIssues} total issues`);

    } catch (error) {
      console.warn('⚠️ Could not compare with baseline:', error.message);
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const options: AnalysisOptions = {
    baseline: args.includes('--baseline'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipExternal: args.includes('--skip-external')
  };

  const analyzer = new ComprehensiveAnalyzer(options);

  // Handle different commands
  if (args.includes('compare')) {
    await analyzer.compareWithBaseline();
    return;
  }

  const result = await analyzer.runCompleteAnalysis(options);

  if (result.success) {
    console.log(`\n✅ Analysis completed successfully!`);
    console.log(`📊 Report: ${result.reportPath}`);
    console.log(`⏱️ Duration: ${result.duration}ms`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️ Warnings (${result.errors.length}):`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    // Compare with baseline if it exists
    await analyzer.compareWithBaseline();
  } else {
    console.error('\n❌ Analysis failed!');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ComprehensiveAnalyzer, type AnalysisOptions, type AnalysisResult };