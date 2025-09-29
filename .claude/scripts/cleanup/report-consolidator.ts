#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { AssetAnalysis } from './asset-scanner';
import { DatabaseAnalysis } from './database-scanner';

interface KnipResult {
  files: string[];
  dependencies: string[];
  devDependencies: string[];
  exports: string[];
  types: string[];
  nsExports: string[];
  nsTypes: string[];
}

interface TsPruneResult {
  unusedExports: {
    file: string;
    line: number;
    name: string;
  }[];
}

interface DepcheckResult {
  dependencies: string[];
  devDependencies: string[];
  missing: Record<string, string[]>;
  using: Record<string, string[]>;
  invalidFiles: Record<string, string>;
  invalidDirs: Record<string, string>;
}

interface MadgeResult {
  circular: string[][];
  summary: {
    totalFiles: number;
    circularDependencies: number;
  };
}

interface CleanupRisk {
  item: string;
  type: 'file' | 'dependency' | 'asset' | 'database' | 'export';
  risk: 'high' | 'medium' | 'low';
  reason: string;
  recommendation: string;
  relatedItems?: string[];
}

interface ConsolidatedReport {
  summary: {
    totalIssues: number;
    highRiskItems: number;
    mediumRiskItems: number;
    lowRiskItems: number;
    potentialSavings: {
      files: number;
      dependencies: number;
      assets: number;
      databaseEntities: number;
    };
  };
  risks: CleanupRisk[];
  deadCode: {
    files: string[];
    exports: string[];
    dependencies: string[];
    devDependencies: string[];
  };
  assets: {
    unused: string[];
    large: string[];
    potentiallyUnused: string[];
  };
  database: {
    unusedEntities: string[];
    orphanedQueries: string[];
    schemaDrift: string[];
  };
  circular: string[][];
  analysisDate: string;
  errors: string[];
}

class ReportConsolidator {
  private readonly reportDir: string;
  private errors: string[] = [];

  constructor(reportDir: string = join(process.cwd(), 'reports')) {
    this.reportDir = reportDir;
  }

  async consolidateReports(): Promise<ConsolidatedReport> {
    console.log('📊 Consolidating analysis reports...');

    try {
      // Load individual reports
      const [knipResult, tsPruneResult, depcheckResult, madgeResult, assetAnalysis, dbAnalysis] = await Promise.allSettled([
        this.loadKnipReport(),
        this.loadTsPruneReport(),
        this.loadDepcheckReport(),
        this.loadMadgeReport(),
        this.loadAssetReport(),
        this.loadDatabaseReport()
      ]);

      // Process results and calculate risks
      const risks = this.calculateRisks({
        knip: knipResult.status === 'fulfilled' ? knipResult.value : null,
        tsPrune: tsPruneResult.status === 'fulfilled' ? tsPruneResult.value : null,
        depcheck: depcheckResult.status === 'fulfilled' ? depcheckResult.value : null,
        madge: madgeResult.status === 'fulfilled' ? madgeResult.value : null,
        assets: assetAnalysis.status === 'fulfilled' ? assetAnalysis.value : null,
        database: dbAnalysis.status === 'fulfilled' ? dbAnalysis.value : null
      });

      return this.generateConsolidatedReport(risks, {
        knip: knipResult.status === 'fulfilled' ? knipResult.value : null,
        tsPrune: tsPruneResult.status === 'fulfilled' ? tsPruneResult.value : null,
        depcheck: depcheckResult.status === 'fulfilled' ? depcheckResult.value : null,
        madge: madgeResult.status === 'fulfilled' ? madgeResult.value : null,
        assets: assetAnalysis.status === 'fulfilled' ? assetAnalysis.value : null,
        database: dbAnalysis.status === 'fulfilled' ? dbAnalysis.value : null
      });

    } catch (error) {
      this.errors.push(`Consolidation failed: ${error}`);
      return this.generateEmptyReport();
    }
  }

  private async loadKnipReport(): Promise<KnipResult | null> {
    try {
      const reportPath = join(this.reportDir, 'knip-report.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load knip report: ${error}`);
      return null;
    }
  }

  private async loadTsPruneReport(): Promise<TsPruneResult | null> {
    try {
      const reportPath = join(this.reportDir, 'ts-prune-report.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load ts-prune report: ${error}`);
      return null;
    }
  }

  private async loadDepcheckReport(): Promise<DepcheckResult | null> {
    try {
      const reportPath = join(this.reportDir, 'depcheck-report.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load depcheck report: ${error}`);
      return null;
    }
  }

  private async loadMadgeReport(): Promise<MadgeResult | null> {
    try {
      const reportPath = join(this.reportDir, 'madge-report.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load madge report: ${error}`);
      return null;
    }
  }

  private async loadAssetReport(): Promise<AssetAnalysis | null> {
    try {
      const reportPath = join(this.reportDir, 'asset-analysis.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load asset analysis: ${error}`);
      return null;
    }
  }

  private async loadDatabaseReport(): Promise<DatabaseAnalysis | null> {
    try {
      const reportPath = join(this.reportDir, 'database-analysis.json');
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load database analysis: ${error}`);
      return null;
    }
  }

  private calculateRisks(reports: {
    knip: KnipResult | null;
    tsPrune: TsPruneResult | null;
    depcheck: DepcheckResult | null;
    madge: MadgeResult | null;
    assets: AssetAnalysis | null;
    database: DatabaseAnalysis | null;
  }): CleanupRisk[] {
    const risks: CleanupRisk[] = [];

    // Analyze knip results
    if (reports.knip) {
      // Unused files - high risk for removal
      for (const file of reports.knip.files) {
        risks.push({
          item: file,
          type: 'file',
          risk: 'high',
          reason: 'File is not imported or referenced anywhere',
          recommendation: 'Safe to delete if confirmed unused'
        });
      }

      // Unused dependencies - medium risk
      for (const dep of reports.knip.dependencies) {
        risks.push({
          item: dep,
          type: 'dependency',
          risk: 'medium',
          reason: 'Dependency is installed but not imported',
          recommendation: 'Review usage and remove if truly unused'
        });
      }

      // Unused dev dependencies - low risk
      for (const devDep of reports.knip.devDependencies) {
        risks.push({
          item: devDep,
          type: 'dependency',
          risk: 'low',
          reason: 'Dev dependency might be used by build tools',
          recommendation: 'Review build scripts before removing'
        });
      }
    }

    // Analyze asset results
    if (reports.assets) {
      for (const asset of reports.assets.unusedAssets) {
        const sizeMB = (asset.size || 0) / (1024 * 1024);
        risks.push({
          item: asset.path,
          type: 'asset',
          risk: sizeMB > 1 ? 'high' : sizeMB > 0.1 ? 'medium' : 'low',
          reason: `Asset is ${sizeMB.toFixed(2)}MB and not referenced`,
          recommendation: 'Safe to delete if not used by external systems'
        });
      }

      for (const asset of reports.assets.potentiallyUnused) {
        risks.push({
          item: asset.path,
          type: 'asset',
          risk: 'low',
          reason: 'Asset has minimal references',
          recommendation: 'Review references before removing',
          relatedItems: asset.referencedBy
        });
      }
    }

    // Analyze database results
    if (reports.database) {
      for (const entity of reports.database.unusedEntities) {
        risks.push({
          item: entity.name,
          type: 'database',
          risk: entity.type === 'table' ? 'high' : 'medium',
          reason: `${entity.type} is defined but never used`,
          recommendation: entity.type === 'table' ? 'Consider dropping table' : 'Safe to remove definition'
        });
      }

      for (const drift of reports.database.schemaCodeDrift) {
        risks.push({
          item: drift.entity,
          type: 'database',
          risk: drift.severity,
          reason: drift.description,
          recommendation: 'Review and align schema with code usage'
        });
      }
    }

    // Analyze circular dependencies
    if (reports.madge && reports.madge.circular.length > 0) {
      for (const cycle of reports.madge.circular) {
        risks.push({
          item: cycle.join(' → '),
          type: 'file',
          risk: 'medium',
          reason: 'Circular dependency detected',
          recommendation: 'Refactor to break circular dependency',
          relatedItems: cycle
        });
      }
    }

    return risks.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 };
      return riskOrder[b.risk] - riskOrder[a.risk];
    });
  }

  private generateConsolidatedReport(risks: CleanupRisk[], reports: any): ConsolidatedReport {
    const highRisk = risks.filter(r => r.risk === 'high');
    const mediumRisk = risks.filter(r => r.risk === 'medium');
    const lowRisk = risks.filter(r => r.risk === 'low');

    return {
      summary: {
        totalIssues: risks.length,
        highRiskItems: highRisk.length,
        mediumRiskItems: mediumRisk.length,
        lowRiskItems: lowRisk.length,
        potentialSavings: {
          files: reports.knip?.files?.length || 0,
          dependencies: (reports.knip?.dependencies?.length || 0) + (reports.knip?.devDependencies?.length || 0),
          assets: reports.assets?.unusedAssets?.length || 0,
          databaseEntities: reports.database?.unusedEntities?.length || 0
        }
      },
      risks,
      deadCode: {
        files: reports.knip?.files || [],
        exports: reports.knip?.exports || [],
        dependencies: reports.knip?.dependencies || [],
        devDependencies: reports.knip?.devDependencies || []
      },
      assets: {
        unused: reports.assets?.unusedAssets?.map((a: any) => a.path) || [],
        large: reports.assets?.largeAssets?.map((a: any) => a.path) || [],
        potentiallyUnused: reports.assets?.potentiallyUnused?.map((a: any) => a.path) || []
      },
      database: {
        unusedEntities: reports.database?.unusedEntities?.map((e: any) => e.name) || [],
        orphanedQueries: reports.database?.orphanedQueries || [],
        schemaDrift: reports.database?.schemaCodeDrift?.map((d: any) => d.entity) || []
      },
      circular: reports.madge?.circular || [],
      analysisDate: new Date().toISOString(),
      errors: this.errors
    };
  }

  private generateEmptyReport(): ConsolidatedReport {
    return {
      summary: {
        totalIssues: 0,
        highRiskItems: 0,
        mediumRiskItems: 0,
        lowRiskItems: 0,
        potentialSavings: {
          files: 0,
          dependencies: 0,
          assets: 0,
          databaseEntities: 0
        }
      },
      risks: [],
      deadCode: {
        files: [],
        exports: [],
        dependencies: [],
        devDependencies: []
      },
      assets: {
        unused: [],
        large: [],
        potentiallyUnused: []
      },
      database: {
        unusedEntities: [],
        orphanedQueries: [],
        schemaDrift: []
      },
      circular: [],
      analysisDate: new Date().toISOString(),
      errors: this.errors
    };
  }

  async saveReport(outputPath: string): Promise<void> {
    const report = await this.consolidateReports();

    // Create output directory if it doesn't exist
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Save JSON report
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

    // Generate markdown summary
    const markdownPath = outputPath.replace('.json', '.md');
    const markdown = this.generateMarkdownReport(report);
    await fs.writeFile(markdownPath, markdown);

    // Generate action plan
    const actionPlanPath = outputPath.replace('.json', '-action-plan.md');
    const actionPlan = this.generateActionPlan(report);
    await fs.writeFile(actionPlanPath, actionPlan);

    console.log(`📊 Consolidated report saved to ${outputPath}`);
    console.log(`📝 Markdown summary saved to ${markdownPath}`);
    console.log(`🎯 Action plan saved to ${actionPlanPath}`);
  }

  private generateMarkdownReport(report: ConsolidatedReport): string {
    const { summary, risks, deadCode, assets, database, circular } = report;

    return `# Codebase Cleanup Analysis

Generated: ${new Date(report.analysisDate).toLocaleString()}

## 📊 Executive Summary

- **Total Issues Found**: ${summary.totalIssues}
- **High Risk Items**: ${summary.highRiskItems} 🔴
- **Medium Risk Items**: ${summary.mediumRiskItems} 🟡
- **Low Risk Items**: ${summary.lowRiskItems} 🟢

### Potential Cleanup Savings
- **Files**: ${summary.potentialSavings.files}
- **Dependencies**: ${summary.potentialSavings.dependencies}
- **Assets**: ${summary.potentialSavings.assets}
- **Database Entities**: ${summary.potentialSavings.databaseEntities}

## 🔥 High Risk Items (Immediate Action)

${risks.filter(r => r.risk === 'high').map(risk =>
  `### ${risk.item} (${risk.type})
- **Reason**: ${risk.reason}
- **Recommendation**: ${risk.recommendation}
${risk.relatedItems ? `- **Related**: ${risk.relatedItems.join(', ')}` : ''}`
).join('\n\n') || 'No high-risk items found.'}

## ⚠️ Medium Risk Items (Review Required)

${risks.filter(r => r.risk === 'medium').slice(0, 10).map(risk =>
  `- **${risk.item}** (${risk.type}): ${risk.reason}`
).join('\n') || 'No medium-risk items found.'}

${risks.filter(r => r.risk === 'medium').length > 10 ? `\n*... and ${risks.filter(r => r.risk === 'medium').length - 10} more medium-risk items*` : ''}

## 🔗 Circular Dependencies

${circular.length === 0 ? 'No circular dependencies detected.' : circular.map(cycle =>
  `- ${cycle.join(' → ')}`
).join('\n')}

## 📂 Dead Code Summary

### Unused Files (${deadCode.files.length})
${deadCode.files.slice(0, 5).map(file => `- \`${file}\``).join('\n')}
${deadCode.files.length > 5 ? `\n*... and ${deadCode.files.length - 5} more files*` : ''}

### Unused Dependencies (${deadCode.dependencies.length})
${deadCode.dependencies.slice(0, 5).map(dep => `- \`${dep}\``).join('\n')}
${deadCode.dependencies.length > 5 ? `\n*... and ${deadCode.dependencies.length - 5} more dependencies*` : ''}

## 🖼️ Asset Cleanup

- **Unused Assets**: ${assets.unused.length}
- **Large Assets**: ${assets.large.length}
- **Potentially Unused**: ${assets.potentiallyUnused.length}

## 🗄️ Database Cleanup

- **Unused Entities**: ${database.unusedEntities.length}
- **Orphaned Queries**: ${database.orphanedQueries.length}
- **Schema Drift Issues**: ${database.schemaDrift.length}

${report.errors.length > 0 ? `## ⚠️ Analysis Errors
${report.errors.map(error => `- ${error}`).join('\n')}` : ''}
`;
  }

  private generateActionPlan(report: ConsolidatedReport): string {
    const highRiskItems = report.risks.filter(r => r.risk === 'high');
    const mediumRiskItems = report.risks.filter(r => r.risk === 'medium');

    return `# Codebase Cleanup Action Plan

Generated: ${new Date(report.analysisDate).toLocaleString()}

## 🎯 Phase 1: Critical Cleanup (High Risk - Safe to Remove)

${highRiskItems.length === 0 ? 'No critical cleanup items identified.' : `
### Files to Delete (${highRiskItems.filter(r => r.type === 'file').length})
\`\`\`bash
${highRiskItems.filter(r => r.type === 'file').map(r => `rm "${r.item}"`).join('\n')}
\`\`\`

### Dependencies to Remove (${highRiskItems.filter(r => r.type === 'dependency').length})
\`\`\`bash
${highRiskItems.filter(r => r.type === 'dependency').map(r => `pnpm remove ${r.item}`).join('\n')}
\`\`\`

### Assets to Delete (${highRiskItems.filter(r => r.type === 'asset').length})
\`\`\`bash
${highRiskItems.filter(r => r.type === 'asset').map(r => `rm "apps/web/public${r.item}"`).join('\n')}
\`\`\``}

## 🔍 Phase 2: Review and Validate (Medium Risk)

### Items Requiring Manual Review
${mediumRiskItems.slice(0, 10).map((risk, index) =>
  `${index + 1}. **${risk.item}** (${risk.type})
   - Reason: ${risk.reason}
   - Action: ${risk.recommendation}
   ${risk.relatedItems ? `- Check: ${risk.relatedItems.join(', ')}` : ''}`
).join('\n\n')}

## 🧪 Phase 3: Testing Protocol

1. **Run full test suite**: \`pnpm test\`
2. **Check build**: \`pnpm build\`
3. **Verify functionality**: \`pnpm dev\` and test key features
4. **Review runtime logs**: Check for missing asset/dependency errors

## 📋 Validation Checklist

- [ ] All tests passing
- [ ] Application builds successfully
- [ ] No console errors in development
- [ ] Key user flows working
- [ ] No missing asset 404s
- [ ] Database queries execute correctly

## 🔄 Automation Scripts

Create these scripts for automated cleanup:

### cleanup-dead-code.sh
\`\`\`bash
#!/bin/bash
# Remove unused files identified by knip
${highRiskItems.filter(r => r.type === 'file').map(r => `rm -f "${r.item}"`).join('\n')}
\`\`\`

### cleanup-dependencies.sh
\`\`\`bash
#!/bin/bash
# Remove unused dependencies
${highRiskItems.filter(r => r.type === 'dependency').map(r => `pnpm remove ${r.item}`).join('\n')}
\`\`\`

### cleanup-assets.sh
\`\`\`bash
#!/bin/bash
# Remove unused assets
${highRiskItems.filter(r => r.type === 'asset').map(r => `rm -f "apps/web/public${r.item}"`).join('\n')}
\`\`\`

## 📊 Expected Impact

- **Disk Space Saved**: ~${Math.round(report.summary.potentialSavings.files * 0.05 + report.summary.potentialSavings.assets * 0.1)}MB
- **Dependencies Removed**: ${report.summary.potentialSavings.dependencies}
- **Build Time Improvement**: ~${Math.round(report.summary.potentialSavings.dependencies * 0.1)}s
- **Maintenance Overhead Reduced**: ${report.summary.potentialSavings.files + report.summary.potentialSavings.databaseEntities} items
`;
  }
}

// CLI usage
if (require.main === module) {
  const consolidator = new ReportConsolidator();
  const outputPath = join(process.cwd(), 'reports/consolidated-analysis.json');

  consolidator.saveReport(outputPath).catch(error => {
    console.error('Report consolidation failed:', error);
    process.exit(1);
  });
}

export { ReportConsolidator, type ConsolidatedReport, type CleanupRisk };