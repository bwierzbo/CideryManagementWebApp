import { DataValidationReport } from './data-validation';
import { SeededDataInventory } from './seeded-data-discovery';
import { CalculationValidationReport } from './calculation-validators';
import { RelationshipValidationReport } from './relationship-validators';

/**
 * Comprehensive validation summary report
 */
export interface ComprehensiveValidationReport {
  timestamp: string;
  issueNumber: string;
  testSuite: string;
  environment: {
    nodeVersion: string;
    playwrightVersion: string;
    databaseUrl?: string;
    testRunId: string;
  };
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  overallScore: number; // 0-100
  summary: {
    requirementsMet: {
      dataVisibility95Percent: boolean;
      dataConsistency: boolean;
      relationshipIntegrity: boolean;
      calculationAccuracy: boolean;
      workflowCompleteness: boolean;
      performanceTargets: boolean;
    };
    metrics: {
      totalEntitiesValidated: number;
      totalRecordsValidated: number;
      totalCalculationsValidated: number;
      totalRelationshipsValidated: number;
      averageDataVisibility: number;
      averageCalculationAccuracy: number;
      dataIntegrityScore: number;
      workflowContinuityScore: number;
    };
    issues: {
      critical: number;
      warnings: number;
      info: number;
    };
  };
  detailedResults: {
    dataValidation: DataValidationReport;
    seededInventory: SeededDataInventory;
    calculationValidation: CalculationValidationReport;
    relationshipValidation: RelationshipValidationReport;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  cicdIntegration: {
    exitCode: number;
    slackMessage?: string;
    prComment?: string;
    jiraUpdate?: string;
  };
  exportedFiles: string[];
}

/**
 * Performance metrics for data-heavy pages
 */
export interface PerformanceMetrics {
  timestamp: string;
  pageMetrics: {
    [pagePath: string]: {
      loadTime: number;
      passed: boolean;
      threshold: number;
      dataRecords: number;
    };
  };
  summary: {
    averageLoadTime: number;
    pagesPassingThreshold: number;
    slowestPage: string;
    fastestPage: string;
  };
}

/**
 * Validation reporter class for comprehensive demo data validation reporting
 */
export class ValidationReporter {
  private testRunId: string;
  private startTime: Date;

  constructor(testRunId?: string) {
    this.testRunId = testRunId || `test-run-${Date.now()}`;
    this.startTime = new Date();
  }

  /**
   * Generate comprehensive validation report
   */
  async generateComprehensiveReport(
    dataReport: DataValidationReport,
    seededInventory: SeededDataInventory,
    calculationReport: CalculationValidationReport,
    relationshipReport: RelationshipValidationReport,
    performanceMetrics?: PerformanceMetrics
  ): Promise<ComprehensiveValidationReport> {

    // Calculate overall score (weighted)
    const scores = [
      { name: 'dataVisibility', score: dataReport.summary.overallVisibilityPercentage, weight: 0.3 },
      { name: 'calculationAccuracy', score: calculationReport.summary.averageAccuracy, weight: 0.25 },
      { name: 'dataIntegrity', score: relationshipReport.dataIntegrityScore, weight: 0.25 },
      { name: 'workflowContinuity', score: relationshipReport.summary.workflowContinuity, weight: 0.2 }
    ];

    const overallScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);

    // Determine requirements status
    const requirementsMet = {
      dataVisibility95Percent: dataReport.summary.overallVisibilityPercentage >= 95,
      dataConsistency: dataReport.summary.criticalIssues === 0,
      relationshipIntegrity: relationshipReport.summary.criticalIssues === 0,
      calculationAccuracy: calculationReport.summary.criticalFailures === 0 && calculationReport.summary.averageAccuracy >= 95,
      workflowCompleteness: relationshipReport.summary.workflowContinuity >= 60,
      performanceTargets: performanceMetrics ? performanceMetrics.summary.pagesPassingThreshold >= 0.8 : true
    };

    // Calculate overall status
    const criticalIssues = dataReport.summary.criticalIssues + calculationReport.summary.criticalFailures + relationshipReport.summary.criticalIssues;
    const allRequirementsMet = Object.values(requirementsMet).every(met => met);
    const overallStatus: 'PASSED' | 'FAILED' | 'WARNING' =
      criticalIssues > 0 ? 'FAILED' :
      !allRequirementsMet ? 'WARNING' :
      'PASSED';

    // Categorize recommendations
    const allRecommendations = [
      ...dataReport.recommendations,
      ...calculationReport.recommendations,
      ...relationshipReport.recommendations,
      ...seededInventory.recommendations
    ];

    const recommendations = this.categorizeRecommendations(allRecommendations, criticalIssues);

    const report: ComprehensiveValidationReport = {
      timestamp: new Date().toISOString(),
      issueNumber: '#9',
      testSuite: 'Demo Data Validation System',
      environment: {
        nodeVersion: process.version,
        playwrightVersion: require('@playwright/test/package.json').version,
        databaseUrl: process.env.DATABASE_URL ? '[REDACTED]' : 'Not configured',
        testRunId: this.testRunId
      },
      overallStatus,
      overallScore,
      summary: {
        requirementsMet,
        metrics: {
          totalEntitiesValidated: dataReport.entityValidation.length,
          totalRecordsValidated: seededInventory.totalRecords,
          totalCalculationsValidated: calculationReport.summary.totalCalculations,
          totalRelationshipsValidated: relationshipReport.summary.totalRelationships,
          averageDataVisibility: dataReport.summary.overallVisibilityPercentage,
          averageCalculationAccuracy: calculationReport.summary.averageAccuracy,
          dataIntegrityScore: relationshipReport.dataIntegrityScore,
          workflowContinuityScore: relationshipReport.summary.workflowContinuity
        },
        issues: {
          critical: criticalIssues,
          warnings: dataReport.summary.warnings + calculationReport.summary.warnings,
          info: 0 // Could be calculated from detailed validations
        }
      },
      detailedResults: {
        dataValidation: dataReport,
        seededInventory: seededInventory,
        calculationValidation: calculationReport,
        relationshipValidation: relationshipReport
      },
      recommendations,
      cicdIntegration: {
        exitCode: overallStatus === 'FAILED' ? 1 : 0,
        slackMessage: this.generateSlackMessage(overallStatus, overallScore, requirementsMet),
        prComment: this.generatePRComment(overallStatus, overallScore, requirementsMet, criticalIssues),
        jiraUpdate: this.generateJiraUpdate(overallStatus, overallScore)
      },
      exportedFiles: []
    };

    return report;
  }

  /**
   * Generate detailed HTML report
   */
  async generateHTMLReport(report: ComprehensiveValidationReport): Promise<string> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Data Validation Report - Issue ${report.issueNumber}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            margin: 10px 0;
        }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-warning { background: #ffc107; color: #212529; }
        .score {
            font-size: 2.5em;
            font-weight: bold;
            margin: 20px 0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
        }
        .card h3 {
            margin-top: 0;
            color: #333;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-weight: bold;
        }
        .requirements {
            margin: 30px 0;
        }
        .requirement {
            display: flex;
            align-items: center;
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
        }
        .requirement.met {
            background: #d4edda;
            color: #155724;
        }
        .requirement.not-met {
            background: #f8d7da;
            color: #721c24;
        }
        .icon {
            margin-right: 10px;
            font-size: 1.2em;
        }
        .recommendations {
            margin: 30px 0;
        }
        .recommendation-category {
            margin: 20px 0;
        }
        .recommendation {
            background: #fff;
            border-left: 4px solid #007bff;
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 0 4px 4px 0;
        }
        .recommendation.immediate {
            border-left-color: #dc3545;
        }
        .recommendation.short-term {
            border-left-color: #ffc107;
        }
        .recommendation.long-term {
            border-left-color: #28a745;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Demo Data Validation Report</h1>
            <p><strong>Issue ${report.issueNumber}</strong> - ${report.testSuite}</p>
            <div class="status-badge status-${report.overallStatus.toLowerCase()}">${report.overallStatus}</div>
            <div class="score" style="color: ${report.overallScore >= 90 ? '#28a745' : report.overallScore >= 70 ? '#ffc107' : '#dc3545'}">${report.overallScore.toFixed(1)}%</div>
            <p><small>Generated: ${new Date(report.timestamp).toLocaleString()}</small></p>
        </div>

        <div class="requirements">
            <h2>Requirements Status</h2>
            ${Object.entries(report.summary.requirementsMet).map(([req, met]) => `
                <div class="requirement ${met ? 'met' : 'not-met'}">
                    <span class="icon">${met ? '✅' : '❌'}</span>
                    <span>${this.formatRequirementName(req)}</span>
                </div>
            `).join('')}
        </div>

        <div class="grid">
            <div class="card">
                <h3>Data Visibility</h3>
                <div class="metric">
                    <span>Overall Visibility</span>
                    <span class="metric-value">${report.summary.metrics.averageDataVisibility.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span>Entities Validated</span>
                    <span class="metric-value">${report.summary.metrics.totalEntitiesValidated}</span>
                </div>
                <div class="metric">
                    <span>Records Validated</span>
                    <span class="metric-value">${report.summary.metrics.totalRecordsValidated.toLocaleString()}</span>
                </div>
            </div>

            <div class="card">
                <h3>Calculation Accuracy</h3>
                <div class="metric">
                    <span>Average Accuracy</span>
                    <span class="metric-value">${report.summary.metrics.averageCalculationAccuracy.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span>Calculations Validated</span>
                    <span class="metric-value">${report.summary.metrics.totalCalculationsValidated}</span>
                </div>
                <div class="metric">
                    <span>Failed Calculations</span>
                    <span class="metric-value">${report.detailedResults.calculationValidation.summary.failedCalculations}</span>
                </div>
            </div>

            <div class="card">
                <h3>Data Integrity</h3>
                <div class="metric">
                    <span>Integrity Score</span>
                    <span class="metric-value">${report.summary.metrics.dataIntegrityScore.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span>Relationships Validated</span>
                    <span class="metric-value">${report.summary.metrics.totalRelationshipsValidated}</span>
                </div>
                <div class="metric">
                    <span>Orphaned Records</span>
                    <span class="metric-value">${report.detailedResults.relationshipValidation.summary.orphanedRecords}</span>
                </div>
            </div>

            <div class="card">
                <h3>Workflow Continuity</h3>
                <div class="metric">
                    <span>Continuity Score</span>
                    <span class="metric-value">${report.summary.metrics.workflowContinuityScore.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span>Complete Workflows</span>
                    <span class="metric-value">${report.detailedResults.seededInventory.businessWorkflowCoverage.completeWorkflowExamples}</span>
                </div>
            </div>
        </div>

        ${report.summary.issues.critical > 0 ? `
        <div class="card" style="border-color: #dc3545; background: #f8d7da;">
            <h3 style="color: #721c24;">🚨 Critical Issues</h3>
            <p>Found <strong>${report.summary.issues.critical}</strong> critical issues that must be resolved immediately.</p>
        </div>
        ` : ''}

        <div class="recommendations">
            <h2>Recommendations</h2>

            ${report.recommendations.immediate.length > 0 ? `
            <div class="recommendation-category">
                <h3>🚨 Immediate Actions Required</h3>
                ${report.recommendations.immediate.map(rec => `
                    <div class="recommendation immediate">${rec}</div>
                `).join('')}
            </div>
            ` : ''}

            ${report.recommendations.shortTerm.length > 0 ? `
            <div class="recommendation-category">
                <h3>⚠️ Short-term Improvements</h3>
                ${report.recommendations.shortTerm.map(rec => `
                    <div class="recommendation short-term">${rec}</div>
                `).join('')}
            </div>
            ` : ''}

            ${report.recommendations.longTerm.length > 0 ? `
            <div class="recommendation-category">
                <h3>📈 Long-term Enhancements</h3>
                ${report.recommendations.longTerm.map(rec => `
                    <div class="recommendation long-term">${rec}</div>
                `).join('')}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Test Run ID: ${report.environment.testRunId}</p>
            <p>Generated by Demo Data Validation System - Issue ${report.issueNumber}</p>
        </div>
    </div>
</body>
</html>`;

    return htmlContent;
  }

  /**
   * Export comprehensive report to multiple formats
   */
  async exportReport(report: ComprehensiveValidationReport, baseDir: string = './test-results'): Promise<string[]> {
    const fs = require('fs');
    const path = require('path');

    // Ensure directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `demo-data-validation-${timestamp}`;
    const exportedFiles: string[] = [];

    // JSON report
    const jsonPath = path.join(baseDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    exportedFiles.push(jsonPath);

    // HTML report
    const htmlContent = await this.generateHTMLReport(report);
    const htmlPath = path.join(baseDir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
    exportedFiles.push(htmlPath);

    // CSV summary for spreadsheet analysis
    const csvContent = this.generateCSVSummary(report);
    const csvPath = path.join(baseDir, `${baseName}-summary.csv`);
    fs.writeFileSync(csvPath, csvContent);
    exportedFiles.push(csvPath);

    // CI/CD friendly summary
    const cicdContent = this.generateCICDSummary(report);
    const cicdPath = path.join(baseDir, `${baseName}-cicd.txt`);
    fs.writeFileSync(cicdPath, cicdContent);
    exportedFiles.push(cicdPath);

    console.log(`📊 Comprehensive validation report exported:`);
    exportedFiles.forEach(file => {
      console.log(`   - ${file}`);
    });

    return exportedFiles;
  }

  /**
   * Categorize recommendations by urgency
   */
  private categorizeRecommendations(recommendations: string[], criticalIssues: number): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    recommendations.forEach(rec => {
      const lower = rec.toLowerCase();

      if (criticalIssues > 0 || lower.includes('critical') || lower.includes('fix') || lower.includes('address')) {
        immediate.push(rec);
      } else if (lower.includes('review') || lower.includes('investigate') || lower.includes('improve')) {
        shortTerm.push(rec);
      } else {
        longTerm.push(rec);
      }
    });

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Format requirement names for display
   */
  private formatRequirementName(req: string): string {
    const formatMap: { [key: string]: string } = {
      'dataVisibility95Percent': '≥95% Demo Data Visibility',
      'dataConsistency': 'Database-UI Data Consistency',
      'relationshipIntegrity': 'Entity Relationship Integrity',
      'calculationAccuracy': 'Business Calculation Accuracy',
      'workflowCompleteness': 'Production Workflow Completeness',
      'performanceTargets': 'Data-Heavy Page Performance'
    };

    return formatMap[req] || req.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  /**
   * Generate Slack message for CI/CD integration
   */
  private generateSlackMessage(status: string, score: number, requirements: any): string {
    const emoji = status === 'PASSED' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
    const color = status === 'PASSED' ? 'good' : status === 'WARNING' ? 'warning' : 'danger';

    return `${emoji} *Demo Data Validation - Issue #9*
Status: *${status}* (${score.toFixed(1)}%)
Requirements Met: ${Object.values(requirements).filter(Boolean).length}/${Object.values(requirements).length}
Test Run: ${this.testRunId}`;
  }

  /**
   * Generate PR comment for GitHub integration
   */
  private generatePRComment(status: string, score: number, requirements: any, criticalIssues: number): string {
    const emoji = status === 'PASSED' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';

    return `## ${emoji} Demo Data Validation Report - Issue #9

**Overall Status:** ${status} (${score.toFixed(1)}%)

### Requirements Status
${Object.entries(requirements).map(([req, met]) =>
  `- ${met ? '✅' : '❌'} ${this.formatRequirementName(req)}`
).join('\n')}

### Summary
- **Critical Issues:** ${criticalIssues}
- **Requirements Met:** ${Object.values(requirements).filter(Boolean).length}/${Object.values(requirements).length}
- **Test Run:** ${this.testRunId}

${criticalIssues > 0 ? '\n⚠️ **Action Required:** Critical issues found that must be resolved before merging.' : ''}

<details>
<summary>View detailed test results</summary>

Full validation report available in test artifacts.
</details>`;
  }

  /**
   * Generate JIRA update message
   */
  private generateJiraUpdate(status: string, score: number): string {
    return `Demo Data Validation completed with ${status} status (${score.toFixed(1)}% overall score).

Test run ID: ${this.testRunId}
Completed: ${new Date().toISOString()}

${status === 'PASSED' ?
  'All requirements met. Issue #9 validation criteria satisfied.' :
  'Some requirements not met. Review detailed report for next steps.'
}`;
  }

  /**
   * Generate CSV summary for spreadsheet analysis
   */
  private generateCSVSummary(report: ComprehensiveValidationReport): string {
    const headers = [
      'Timestamp',
      'Status',
      'Overall Score',
      'Data Visibility',
      'Calculation Accuracy',
      'Data Integrity',
      'Workflow Continuity',
      'Critical Issues',
      'Warnings'
    ];

    const row = [
      report.timestamp,
      report.overallStatus,
      report.overallScore.toFixed(1),
      report.summary.metrics.averageDataVisibility.toFixed(1),
      report.summary.metrics.averageCalculationAccuracy.toFixed(1),
      report.summary.metrics.dataIntegrityScore.toFixed(1),
      report.summary.metrics.workflowContinuityScore.toFixed(1),
      report.summary.issues.critical,
      report.summary.issues.warnings
    ];

    return headers.join(',') + '\n' + row.join(',');
  }

  /**
   * Generate CI/CD friendly summary
   */
  private generateCICDSummary(report: ComprehensiveValidationReport): string {
    return `DEMO_DATA_VALIDATION_RESULT=${report.overallStatus}
OVERALL_SCORE=${report.overallScore.toFixed(1)}
DATA_VISIBILITY=${report.summary.metrics.averageDataVisibility.toFixed(1)}
CALCULATION_ACCURACY=${report.summary.metrics.averageCalculationAccuracy.toFixed(1)}
DATA_INTEGRITY=${report.summary.metrics.dataIntegrityScore.toFixed(1)}
WORKFLOW_CONTINUITY=${report.summary.metrics.workflowContinuityScore.toFixed(1)}
CRITICAL_ISSUES=${report.summary.issues.critical}
WARNINGS=${report.summary.issues.warnings}
EXIT_CODE=${report.cicdIntegration.exitCode}
TEST_RUN_ID=${report.environment.testRunId}
TIMESTAMP=${report.timestamp}`;
  }
}