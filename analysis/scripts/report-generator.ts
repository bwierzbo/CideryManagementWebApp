import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { AssetScanner } from './asset-scanner';
import { DatabaseScanner } from './db-scanner';
import { SchemaMapper } from './schema-mapper.js';
import { DatabaseUsageScanner } from './db-usage-scanner.js';
import { UnusedElementsAnalyzer } from './unused-elements-analyzer.js';
import { DriftAnalyzer } from './drift-analyzer.js';
import { PerformanceAssessor } from './performance-assessor.js';

interface AnalysisReport {
  timestamp: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
    schemaHealthScore: number;
    performanceScore: number;
    optimizationPotential: number;
  };
  deadCode: any;
  dependencies: any;
  assets: any;
  database: any;
  circularDeps: any;
  // Enhanced database analysis
  schemaMapping: any;
  usageAnalysis: any;
  unusedElements: any;
  driftAnalysis: any;
  performanceAssessment: any;
}

interface ReportOptions {
  outputDir: string;
  format: 'json' | 'markdown' | 'both';
  baseline?: boolean;
}

export class ReportGenerator {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async generateReport(options: ReportOptions): Promise<void> {
    const timestamp = new Date().toISOString();
    const outputDir = options.baseline ?
      join(options.outputDir, 'baseline') :
      join(options.outputDir, 'latest');

    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    console.log('🔄 Running comprehensive analysis...');

    // Run all analysis tools
    const results = await this.runAllAnalysis();

    // Generate consolidated report
    const report: AnalysisReport = {
      timestamp,
      summary: this.generateSummary(results),
      ...results
    };

    // Output in requested formats
    if (options.format === 'json' || options.format === 'both') {
      await this.generateJsonReport(report, outputDir);
    }

    if (options.format === 'markdown' || options.format === 'both') {
      await this.generateMarkdownReport(report, outputDir);
    }

    console.log(`✅ Reports generated in ${outputDir}`);
  }

  private async runAllAnalysis(): Promise<any> {
    const results: any = {};

    try {
      // Run Knip
      console.log('📝 Running Knip analysis...');
      results.deadCode = await this.runKnip();
    } catch (error) {
      console.warn('Knip analysis failed:', error);
      results.deadCode = { error: String(error) };
    }

    try {
      // Run Depcheck
      console.log('📦 Running dependency analysis...');
      results.dependencies = await this.runDepcheck();
    } catch (error) {
      console.warn('Dependency analysis failed:', error);
      results.dependencies = { error: String(error) };
    }

    try {
      // Run circular dependency check
      console.log('🔄 Running circular dependency analysis...');
      results.circularDeps = await this.runMadge();
    } catch (error) {
      console.warn('Circular dependency analysis failed:', error);
      results.circularDeps = { error: String(error) };
    }

    try {
      // Run asset scanner
      console.log('🖼️  Running asset analysis...');
      const assetScanner = new AssetScanner(this.rootDir);
      results.assets = await assetScanner.scan();
    } catch (error) {
      console.warn('Asset analysis failed:', error);
      results.assets = { error: String(error) };
    }

    try {
      // Run database scanner
      console.log('🗄️  Running database analysis...');
      const dbScanner = new DatabaseScanner(this.rootDir);
      results.database = await dbScanner.scan();
    } catch (error) {
      console.warn('Database analysis failed:', error);
      results.database = { error: String(error) };
    }

    try {
      // Run schema mapping analysis
      console.log('🗺️  Running schema mapping analysis...');
      const schemaMapper = new SchemaMapper(this.rootDir);
      results.schemaMapping = await schemaMapper.analyze();
    } catch (error) {
      console.warn('Schema mapping analysis failed:', error);
      results.schemaMapping = { error: String(error) };
    }

    try {
      // Run usage analysis
      console.log('🔍 Running database usage analysis...');
      const usageScanner = new DatabaseUsageScanner(this.rootDir);
      results.usageAnalysis = await usageScanner.scan();
    } catch (error) {
      console.warn('Database usage analysis failed:', error);
      results.usageAnalysis = { error: String(error) };
    }

    try {
      // Run unused elements analysis
      console.log('🎯 Running unused elements analysis...');
      const unusedAnalyzer = new UnusedElementsAnalyzer(this.rootDir);
      results.unusedElements = await unusedAnalyzer.analyze();
    } catch (error) {
      console.warn('Unused elements analysis failed:', error);
      results.unusedElements = { error: String(error) };
    }

    try {
      // Run drift analysis
      console.log('📊 Running drift analysis...');
      const driftAnalyzer = new DriftAnalyzer(this.rootDir);
      results.driftAnalysis = await driftAnalyzer.analyze();
    } catch (error) {
      console.warn('Drift analysis failed:', error);
      results.driftAnalysis = { error: String(error) };
    }

    try {
      // Run performance assessment
      console.log('⚡ Running performance assessment...');
      const performanceAssessor = new PerformanceAssessor(this.rootDir);
      results.performanceAssessment = await performanceAssessor.assess();
    } catch (error) {
      console.warn('Performance assessment failed:', error);
      results.performanceAssessment = { error: String(error) };
    }

    return results;
  }

  private async runKnip(): Promise<any> {
    const { execSync } = require('child_process');
    try {
      const output = execSync('npx knip --config analysis/config/knip.json --reporter json', {
        cwd: this.rootDir,
        encoding: 'utf-8'
      });
      return JSON.parse(output);
    } catch (error: any) {
      // Knip might exit with code 1 if issues found
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          return { rawOutput: error.stdout };
        }
      }
      throw error;
    }
  }

  private async runDepcheck(): Promise<any> {
    const { execSync } = require('child_process');
    try {
      const output = execSync('npx depcheck --config analysis/config/depcheck.json --json', {
        cwd: this.rootDir,
        encoding: 'utf-8'
      });
      return JSON.parse(output);
    } catch (error: any) {
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          return { rawOutput: error.stdout };
        }
      }
      throw error;
    }
  }

  private async runMadge(): Promise<any> {
    const { execSync } = require('child_process');
    try {
      const output = execSync('npx madge --circular --json apps/web/src packages/*/src', {
        cwd: this.rootDir,
        encoding: 'utf-8'
      });
      return JSON.parse(output);
    } catch (error: any) {
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          return { rawOutput: error.stdout };
        }
      }
      throw error;
    }
  }

  private generateSummary(results: any): AnalysisReport['summary'] {
    let totalIssues = 0;
    let criticalIssues = 0;
    let warningIssues = 0;
    let infoIssues = 0;
    let schemaHealthScore = 100;
    let performanceScore = 100;
    let optimizationPotential = 0;

    // Count issues from each analysis tool
    if (results.deadCode && !results.deadCode.error) {
      const issues = this.countKnipIssues(results.deadCode);
      totalIssues += issues.total;
      criticalIssues += issues.critical;
      warningIssues += issues.warning;
    }

    if (results.dependencies && !results.dependencies.error) {
      const issues = this.countDepcheckIssues(results.dependencies);
      totalIssues += issues.total;
      warningIssues += issues.warning;
    }

    if (results.assets && !results.assets.error) {
      const unusedCount = results.assets.summary?.unusedCount || 0;
      totalIssues += unusedCount;
      infoIssues += unusedCount;
    }

    if (results.database && !results.database.error) {
      const unusedTables = results.database.summary?.unusedTables || 0;
      const unusedIndexes = results.database.summary?.unusedIndexes || 0;
      totalIssues += unusedTables + unusedIndexes;
      warningIssues += unusedTables + unusedIndexes;
    }

    if (results.circularDeps && Array.isArray(results.circularDeps)) {
      criticalIssues += results.circularDeps.length;
      totalIssues += results.circularDeps.length;
    }

    // Enhanced database analysis metrics
    if (results.unusedElements && !results.unusedElements.error) {
      const unusedCount = results.unusedElements.summary?.unusedElements || 0;
      const highConfidenceUnused = results.unusedElements.summary?.highConfidenceUnused || 0;
      totalIssues += unusedCount;
      warningIssues += unusedCount;
      criticalIssues += highConfidenceUnused;
    }

    if (results.driftAnalysis && !results.driftAnalysis.error) {
      schemaHealthScore = results.driftAnalysis.summary?.schemaHealth || 100;
      const driftIssues = results.driftAnalysis.summary?.criticalDrifts || 0;
      criticalIssues += driftIssues;
      totalIssues += driftIssues;
    }

    if (results.performanceAssessment && !results.performanceAssessment.error) {
      performanceScore = results.performanceAssessment.summary?.overallHealthScore || 100;
      optimizationPotential = results.performanceAssessment.summary?.optimizationPotential || 0;
      const perfCritical = results.performanceAssessment.summary?.criticalIssues || 0;
      criticalIssues += perfCritical;
      totalIssues += perfCritical;
    }

    return {
      totalIssues,
      criticalIssues,
      warningIssues,
      infoIssues,
      schemaHealthScore,
      performanceScore,
      optimizationPotential
    };
  }

  private countKnipIssues(knipResult: any): { total: number; critical: number; warning: number } {
    let total = 0;
    let critical = 0;
    let warning = 0;

    // Count different types of knip issues
    if (knipResult.files) total += knipResult.files.length;
    if (knipResult.dependencies) total += knipResult.dependencies.length;
    if (knipResult.devDependencies) total += knipResult.devDependencies.length;
    if (knipResult.exports) {
      total += knipResult.exports.length;
      warning += knipResult.exports.length;
    }

    critical += (knipResult.files?.length || 0) + (knipResult.dependencies?.length || 0);

    return { total, critical, warning };
  }

  private countDepcheckIssues(depcheckResult: any): { total: number; warning: number } {
    let total = 0;
    let warning = 0;

    if (depcheckResult.dependencies) {
      total += depcheckResult.dependencies.length;
      warning += depcheckResult.dependencies.length;
    }

    if (depcheckResult.devDependencies) {
      total += depcheckResult.devDependencies.length;
      warning += depcheckResult.devDependencies.length;
    }

    return { total, warning };
  }

  private async generateJsonReport(report: AnalysisReport, outputDir: string): Promise<void> {
    const filePath = join(outputDir, 'analysis-report.json');
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📄 JSON report: ${filePath}`);
  }

  private async generateMarkdownReport(report: AnalysisReport, outputDir: string): Promise<void> {
    const markdown = this.generateMarkdownContent(report);
    const filePath = join(outputDir, 'analysis-report.md');
    await writeFile(filePath, markdown, 'utf-8');
    console.log(`📄 Markdown report: ${filePath}`);
  }

  private generateMarkdownContent(report: AnalysisReport): string {
    const { summary } = report;

    return `# Comprehensive Codebase Analysis Report

Generated: ${new Date(report.timestamp).toLocaleString()}

## 📊 Executive Summary

- **Total Issues**: ${summary.totalIssues}
- **Critical**: ${summary.criticalIssues} 🔴
- **Warning**: ${summary.warningIssues} 🟡
- **Info**: ${summary.infoIssues} 🔵

### 🏥 Health Scores

- **Schema Health**: ${summary.schemaHealthScore}/100 ${this.getHealthIcon(summary.schemaHealthScore)}
- **Performance Score**: ${summary.performanceScore}/100 ${this.getHealthIcon(summary.performanceScore)}
- **Optimization Potential**: ${summary.optimizationPotential}% 🚀

## 🗑️ Dead Code Analysis

${this.formatDeadCodeSection(report.deadCode)}

## 📦 Dependency Analysis

${this.formatDependencySection(report.dependencies)}

## 🔄 Circular Dependencies

${this.formatCircularDepsSection(report.circularDeps)}

## 🖼️ Asset Analysis

${this.formatAssetSection(report.assets)}

## 🗄️ Basic Database Analysis

${this.formatDatabaseSection(report.database)}

## 🗺️ Schema Mapping Analysis

${this.formatSchemaMappingSection(report.schemaMapping)}

## 🔍 Database Usage Analysis

${this.formatUsageAnalysisSection(report.usageAnalysis)}

## 🎯 Unused Elements Analysis

${this.formatUnusedElementsSection(report.unusedElements)}

## 📊 Schema Drift Analysis

${this.formatDriftAnalysisSection(report.driftAnalysis)}

## ⚡ Performance Assessment

${this.formatPerformanceAssessmentSection(report.performanceAssessment)}

## 💡 Strategic Recommendations

${this.generateEnhancedRecommendations(report)}

## 📋 Action Plan

${this.generateActionPlan(report)}

---
*Generated by Cidery Management App Enhanced Analysis Infrastructure*
`;
  }

  private formatDeadCodeSection(deadCode: any): string {
    if (deadCode?.error) {
      return `❌ **Error**: ${deadCode.error}`;
    }

    if (!deadCode) {
      return '✅ No dead code analysis data available.';
    }

    let content = '';

    if (deadCode.files?.length > 0) {
      content += `### Unused Files (${deadCode.files.length})\n\n`;
      deadCode.files.slice(0, 10).forEach((file: string) => {
        content += `- \`${file}\`\n`;
      });
      if (deadCode.files.length > 10) {
        content += `- ... and ${deadCode.files.length - 10} more\n`;
      }
      content += '\n';
    }

    if (deadCode.dependencies?.length > 0) {
      content += `### Unused Dependencies (${deadCode.dependencies.length})\n\n`;
      deadCode.dependencies.slice(0, 10).forEach((dep: string) => {
        content += `- \`${dep}\`\n`;
      });
      if (deadCode.dependencies.length > 10) {
        content += `- ... and ${deadCode.dependencies.length - 10} more\n`;
      }
      content += '\n';
    }

    return content || '✅ No dead code detected.';
  }

  private formatDependencySection(dependencies: any): string {
    if (dependencies?.error) {
      return `❌ **Error**: ${dependencies.error}`;
    }

    if (!dependencies) {
      return '✅ No dependency analysis data available.';
    }

    let content = '';

    if (dependencies.dependencies?.length > 0) {
      content += `### Unused Dependencies (${dependencies.dependencies.length})\n\n`;
      dependencies.dependencies.forEach((dep: string) => {
        content += `- \`${dep}\`\n`;
      });
      content += '\n';
    }

    if (dependencies.missing?.length > 0) {
      content += `### Missing Dependencies (${dependencies.missing.length})\n\n`;
      Object.entries(dependencies.missing).forEach(([dep, files]: [string, any]) => {
        content += `- \`${dep}\` (used in ${Array.isArray(files) ? files.length : 'unknown'} files)\n`;
      });
      content += '\n';
    }

    return content || '✅ All dependencies are properly managed.';
  }

  private formatCircularDepsSection(circularDeps: any): string {
    if (circularDeps?.error) {
      return `❌ **Error**: ${circularDeps.error}`;
    }

    if (!Array.isArray(circularDeps) || circularDeps.length === 0) {
      return '✅ No circular dependencies detected.';
    }

    let content = `### Circular Dependencies (${circularDeps.length})\n\n`;

    circularDeps.forEach((cycle: string[], index: number) => {
      content += `#### Cycle ${index + 1}\n\n`;
      cycle.forEach((file: string, i: number) => {
        const arrow = i < cycle.length - 1 ? ' →' : ' → (back to start)';
        content += `${i + 1}. \`${file}\`${arrow}\n`;
      });
      content += '\n';
    });

    return content;
  }

  private formatAssetSection(assets: any): string {
    if (assets?.error) {
      return `❌ **Error**: ${assets.error}`;
    }

    if (!assets?.summary) {
      return '✅ No asset analysis data available.';
    }

    const { summary } = assets;

    let content = `### Asset Summary\n\n`;
    content += `- **Total Assets**: ${summary.totalAssets || 0}\n`;
    content += `- **Unused Assets**: ${summary.unusedCount || 0}\n`;
    content += `- **Total Size**: ${((summary.totalSize || 0) / 1024 / 1024).toFixed(2)} MB\n`;
    content += `- **Potential Savings**: ${((summary.potentialSavings || 0) / 1024 / 1024).toFixed(2)} MB\n\n`;

    if (assets.unusedAssets?.length > 0) {
      content += `### Unused Assets (${assets.unusedAssets.length})\n\n`;
      assets.unusedAssets.slice(0, 15).forEach((asset: any) => {
        const sizeKB = (asset.size / 1024).toFixed(1);
        content += `- \`${asset.path}\` (${sizeKB} KB)\n`;
      });
      if (assets.unusedAssets.length > 15) {
        content += `- ... and ${assets.unusedAssets.length - 15} more\n`;
      }
      content += '\n';
    }

    return content;
  }

  private formatDatabaseSection(database: any): string {
    if (database?.error) {
      return `❌ **Error**: ${database.error}`;
    }

    if (!database?.summary) {
      return '✅ No database analysis data available.';
    }

    const { summary } = database;

    let content = `### Database Summary\n\n`;
    content += `- **Total Tables**: ${summary.totalTables || 0}\n`;
    content += `- **Unused Tables**: ${summary.unusedTables || 0}\n`;
    content += `- **Total Indexes**: ${summary.totalIndexes || 0}\n`;
    content += `- **Unused Indexes**: ${summary.unusedIndexes || 0}\n\n`;

    if (database.tables?.filter((t: any) => !t.isUsed).length > 0) {
      content += `### Unused Tables\n\n`;
      database.tables
        .filter((t: any) => !t.isUsed)
        .forEach((table: any) => {
          content += `- \`${table.name}\` (${table.path})\n`;
        });
      content += '\n';
    }

    return content;
  }

  private getHealthIcon(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  private formatSchemaMappingSection(schemaMapping: any): string {
    if (schemaMapping?.error) {
      return `❌ **Error**: ${schemaMapping.error}`;
    }

    if (!schemaMapping?.analysis) {
      return '✅ No schema mapping data available.';
    }

    const { analysis } = schemaMapping;

    let content = `### Schema Mapping Summary\n\n`;
    content += `- **Total Elements**: ${analysis.totalElements || 0}\n`;
    content += `- **Used Elements**: ${analysis.usedElements || 0}\n`;
    content += `- **Usage Confidence**: ${((analysis.usageConfidence || 0) * 100).toFixed(1)}%\n\n`;

    if (analysis.driftIndicators?.length > 0) {
      content += `### 🚨 Drift Indicators\n\n`;
      analysis.driftIndicators.forEach((indicator: string) => {
        content += `- ${indicator}\n`;
      });
      content += '\n';
    }

    return content;
  }

  private formatUsageAnalysisSection(usageAnalysis: any): string {
    if (usageAnalysis?.error) {
      return `❌ **Error**: ${usageAnalysis.error}`;
    }

    if (!usageAnalysis?.summary) {
      return '✅ No usage analysis data available.';
    }

    const { summary } = usageAnalysis;

    let content = `### Usage Analysis Summary\n\n`;
    content += `- **Total Usages**: ${summary.totalUsages || 0}\n`;
    content += `- **High Confidence**: ${summary.highConfidenceUsages || 0}\n`;
    content += `- **Dynamic Queries**: ${summary.dynamicQueries || 0}\n\n`;

    if (summary.potentialOptimizations?.length > 0) {
      content += `### 💡 Optimization Opportunities\n\n`;
      summary.potentialOptimizations.forEach((opt: string) => {
        content += `- ${opt}\n`;
      });
      content += '\n';
    }

    return content;
  }

  private formatUnusedElementsSection(unusedElements: any): string {
    if (unusedElements?.error) {
      return `❌ **Error**: ${unusedElements.error}`;
    }

    if (!unusedElements?.summary) {
      return '✅ No unused elements analysis data available.';
    }

    const { summary } = unusedElements;

    let content = `### Unused Elements Summary\n\n`;
    content += `- **Total Elements**: ${summary.totalElements || 0}\n`;
    content += `- **Unused Elements**: ${summary.unusedElements || 0}\n`;
    content += `- **High Confidence Unused**: ${summary.highConfidenceUnused || 0}\n`;
    content += `- **Storage Savings**: ${((summary.potentialSavings?.storageBytes || 0) / 1000000).toFixed(1)}MB\n\n`;

    if (unusedElements.recommendations?.immediate?.length > 0) {
      content += `### 🚀 Immediate Actions\n\n`;
      unusedElements.recommendations.immediate.slice(0, 5).forEach((item: any) => {
        content += `- **${item.name}** (${item.type}): ${item.recommendations.action}\n`;
      });
      content += '\n';
    }

    return content;
  }

  private formatDriftAnalysisSection(driftAnalysis: any): string {
    if (driftAnalysis?.error) {
      return `❌ **Error**: ${driftAnalysis.error}`;
    }

    if (!driftAnalysis?.summary) {
      return '✅ No drift analysis data available.';
    }

    const { summary } = driftAnalysis;

    let content = `### Schema Drift Summary\n\n`;
    content += `- **Schema Health**: ${summary.schemaHealth || 100}/100\n`;
    content += `- **Total Drifts**: ${summary.totalDrifts || 0}\n`;
    content += `- **Critical Drifts**: ${summary.criticalDrifts || 0}\n`;
    content += `- **Evolution Velocity**: ${(summary.evolutionVelocity || 0).toFixed(1)} changes/month\n`;
    content += `- **Maintenance Burden**: ${summary.maintenanceBurden || 'low'}\n\n`;

    if (driftAnalysis.drifts?.filter((d: any) => d.severity === 'critical').length > 0) {
      content += `### 🚨 Critical Drifts\n\n`;
      driftAnalysis.drifts
        .filter((d: any) => d.severity === 'critical')
        .slice(0, 5)
        .forEach((drift: any) => {
          content += `- **${drift.elementName}** (${drift.elementType}): ${drift.description}\n`;
        });
      content += '\n';
    }

    return content;
  }

  private formatPerformanceAssessmentSection(performanceAssessment: any): string {
    if (performanceAssessment?.error) {
      return `❌ **Error**: ${performanceAssessment.error}`;
    }

    if (!performanceAssessment?.summary) {
      return '✅ No performance assessment data available.';
    }

    const { summary } = performanceAssessment;

    let content = `### Performance Assessment Summary\n\n`;
    content += `- **Overall Health**: ${summary.overallHealthScore || 100}/100\n`;
    content += `- **Critical Issues**: ${summary.criticalIssues || 0}\n`;
    content += `- **Optimization Potential**: ${summary.optimizationPotential || 0}%\n\n`;

    content += `### 💾 Estimated Savings\n\n`;
    content += `- **Storage**: ${((summary.estimatedSavings?.storage || 0) / 1000000).toFixed(1)}MB\n`;
    content += `- **Performance**: ${(summary.estimatedSavings?.performance || 0).toFixed(1)}% improvement\n`;
    content += `- **Maintenance**: ${(summary.estimatedSavings?.maintenance || 0).toFixed(1)} hours/month\n\n`;

    if (performanceAssessment.actionPlan?.quickWins?.length > 0) {
      content += `### 🚀 Quick Wins\n\n`;
      performanceAssessment.actionPlan.quickWins.slice(0, 3).forEach((win: any) => {
        content += `- **${win.description}**: ${win.implementation.effort} effort, ${win.implementation.risk} risk\n`;
      });
      content += '\n';
    }

    return content;
  }

  private generateEnhancedRecommendations(report: AnalysisReport): string {
    const recommendations: string[] = [];

    // Critical issues first
    if (report.summary.criticalIssues > 0) {
      recommendations.push('🔴 **Critical**: Address circular dependencies and critical drifts immediately');
    }

    // Schema health issues
    if (report.summary.schemaHealthScore < 70) {
      recommendations.push('🏥 **Schema Health**: Schema health is below acceptable levels - implement cleanup strategy');
    }

    // Performance issues
    if (report.summary.performanceScore < 70) {
      recommendations.push('⚡ **Performance**: Performance score indicates need for optimization');
    }

    // High optimization potential
    if (report.summary.optimizationPotential > 30) {
      recommendations.push('🚀 **Optimization**: High optimization potential detected - prioritize performance improvements');
    }

    // Traditional recommendations
    if (report.assets?.summary?.unusedCount > 0) {
      recommendations.push('🖼️ **Assets**: Remove unused assets to reduce bundle size');
    }

    if (report.database?.summary?.unusedTables > 0) {
      recommendations.push('🗄️ **Database**: Review unused tables for potential removal');
    }

    if (report.deadCode?.files?.length > 0) {
      recommendations.push('🗑️ **Dead Code**: Remove unused files to improve maintainability');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ **Excellent!** System is in good health across all metrics.');
    }

    return recommendations.map(rec => `- ${rec}`).join('\n');
  }

  private generateActionPlan(report: AnalysisReport): string {
    let content = '';

    // Immediate actions
    const immediateActions: string[] = [];

    if (report.summary.criticalIssues > 0) {
      immediateActions.push('Address critical schema drifts and circular dependencies');
    }

    if (report.performanceAssessment?.actionPlan?.quickWins?.length > 0) {
      immediateActions.push(`Implement ${report.performanceAssessment.actionPlan.quickWins.length} quick performance wins`);
    }

    if (immediateActions.length > 0) {
      content += '### 🚨 Immediate (1-2 weeks)\n\n';
      immediateActions.forEach(action => {
        content += `- ${action}\n`;
      });
      content += '\n';
    }

    // Medium-term actions
    const mediumActions: string[] = [];

    if (report.unusedElements?.recommendations?.investigate?.length > 0) {
      mediumActions.push(`Investigate ${report.unusedElements.recommendations.investigate.length} potentially unused elements`);
    }

    if (report.summary.schemaHealthScore < 80) {
      mediumActions.push('Implement schema health improvement plan');
    }

    if (mediumActions.length > 0) {
      content += '### 📋 Medium-term (1-3 months)\n\n';
      mediumActions.forEach(action => {
        content += `- ${action}\n`;
      });
      content += '\n';
    }

    // Long-term actions
    const longTermActions = [
      'Establish continuous monitoring and analysis',
      'Create automated cleanup processes',
      'Implement performance regression testing'
    ];

    content += '### 🎯 Long-term (3-6 months)\n\n';
    longTermActions.forEach(action => {
      content += `- ${action}\n`;
    });

    return content;
  }

  private generateRecommendations(report: AnalysisReport): string {
    // Keep the old method for backward compatibility
    return this.generateEnhancedRecommendations(report);
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const generator = new ReportGenerator(rootDir);

    const outputDir = join(rootDir, 'analysis', 'reports');
    const isBaseline = process.argv.includes('--baseline');
    const format = process.argv.includes('--json') ? 'json' :
                   process.argv.includes('--markdown') ? 'markdown' : 'both';

    try {
      await generator.generateReport({
        outputDir,
        format: format as any,
        baseline: isBaseline
      });

      console.log('✅ Analysis complete!');
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }

  main();
}