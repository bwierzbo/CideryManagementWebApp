import { SchemaMapper } from './schema-mapper.js';
import { DatabaseUsageScanner } from './db-usage-scanner.js';
import { UnusedElementsAnalyzer } from './unused-elements-analyzer.js';
import { DriftAnalyzer } from './drift-analyzer.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface PerformanceMetric {
  metric: string;
  currentValue: number;
  unit: string;
  impact: 'positive' | 'negative' | 'neutral';
  trend: 'improving' | 'degrading' | 'stable';
  recommendation: string;
}

interface OptimizationOpportunity {
  type: 'index_removal' | 'index_addition' | 'query_optimization' | 'schema_cleanup' | 'data_archival';
  description: string;
  elements: string[];
  estimatedImpact: {
    storageReduction?: number; // bytes
    querySpeedImprovement?: number; // percentage
    writePerformanceImprovement?: number; // percentage
    maintenanceReduction?: number; // percentage
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
    reversible: boolean;
    estimatedTime: string;
  };
  prerequisites: string[];
  validation: {
    checks: string[];
    rollbackPlan: string;
    monitoringRequirements: string[];
  };
}

interface PerformanceProjection {
  timeframe: '1_month' | '3_months' | '6_months' | '1_year';
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
  metrics: {
    storageSize: number;
    queryPerformance: number; // average response time
    indexCount: number;
    maintenanceEffort: number; // hours per month
  };
  assumptions: string[];
}

interface PerformanceAssessmentReport {
  timestamp: string;
  tool: 'performance-assessor';
  summary: {
    overallHealthScore: number; // 0-100
    criticalIssues: number;
    optimizationPotential: number; // 0-100
    estimatedSavings: {
      storage: number; // bytes
      performance: number; // percentage improvement
      maintenance: number; // hours per month
    };
  };
  currentMetrics: PerformanceMetric[];
  optimizationOpportunities: OptimizationOpportunity[];
  projections: PerformanceProjection[];
  detailedAnalysis: {
    indexAnalysis: {
      totalIndexes: number;
      usedIndexes: number;
      redundantIndexes: string[];
      missingIndexes: Array<{
        table: string;
        columns: string[];
        justification: string;
        estimatedBenefit: string;
      }>;
    };
    queryAnalysis: {
      totalQueries: number;
      complexQueries: number;
      slowQueries: Array<{
        pattern: string;
        complexity: number;
        frequency: number;
        optimization: string;
      }>;
    };
    schemaAnalysis: {
      bloatScore: number; // 0-100, higher is worse
      unusedElements: number;
      migrationComplexity: 'low' | 'medium' | 'high';
      technicalDebt: number; // 0-100
    };
  };
  actionPlan: {
    quickWins: OptimizationOpportunity[];
    mediumTerm: OptimizationOpportunity[];
    longTerm: OptimizationOpportunity[];
    continuousImprovement: string[];
  };
}

export class PerformanceAssessor {
  private rootDir: string;
  private schemaMapper: SchemaMapper;
  private usageScanner: DatabaseUsageScanner;
  private unusedAnalyzer: UnusedElementsAnalyzer;
  private driftAnalyzer: DriftAnalyzer;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.schemaMapper = new SchemaMapper(rootDir);
    this.usageScanner = new DatabaseUsageScanner(rootDir);
    this.unusedAnalyzer = new UnusedElementsAnalyzer(rootDir);
    this.driftAnalyzer = new DriftAnalyzer(rootDir);
  }

  async assess(): Promise<PerformanceAssessmentReport> {
    console.log('⚡ Assessing database performance impact...');

    // Step 1: Gather all analysis data
    console.log('  📊 Gathering analysis data...');
    const [schemaMapping, usageReport, unusedReport, driftReport] = await Promise.all([
      this.schemaMapper.analyze(),
      this.usageScanner.scan(),
      this.unusedAnalyzer.analyze(),
      this.driftAnalyzer.analyze()
    ]);

    // Step 2: Calculate current performance metrics
    console.log('  📈 Calculating performance metrics...');
    const currentMetrics = this.calculateCurrentMetrics(schemaMapping, usageReport, unusedReport);

    // Step 3: Identify optimization opportunities
    console.log('  🎯 Identifying optimization opportunities...');
    const optimizationOpportunities = this.identifyOptimizationOpportunities(
      schemaMapping, usageReport, unusedReport, driftReport
    );

    // Step 4: Generate performance projections
    console.log('  🔮 Generating performance projections...');
    const projections = this.generatePerformanceProjections(currentMetrics, optimizationOpportunities);

    // Step 5: Perform detailed analysis
    console.log('  🔍 Performing detailed analysis...');
    const detailedAnalysis = this.performDetailedAnalysis(schemaMapping, usageReport, unusedReport);

    // Step 6: Create action plan
    console.log('  📋 Creating action plan...');
    const actionPlan = this.createActionPlan(optimizationOpportunities);

    // Step 7: Calculate summary metrics
    const summary = this.calculateSummaryMetrics(currentMetrics, optimizationOpportunities, detailedAnalysis);

    return {
      timestamp: new Date().toISOString(),
      tool: 'performance-assessor',
      summary,
      currentMetrics,
      optimizationOpportunities,
      projections,
      detailedAnalysis,
      actionPlan
    };
  }

  private calculateCurrentMetrics(
    schemaMapping: any,
    usageReport: any,
    unusedReport: any
  ): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];

    // Index utilization rate
    const totalIndexes = schemaMapping.indexes.size;
    const usedIndexes = totalIndexes - schemaMapping.unused.indexes.length;
    const indexUtilization = totalIndexes > 0 ? (usedIndexes / totalIndexes) * 100 : 100;

    metrics.push({
      metric: 'Index Utilization Rate',
      currentValue: indexUtilization,
      unit: '%',
      impact: indexUtilization > 80 ? 'positive' : 'negative',
      trend: 'stable', // Would need historical data
      recommendation: indexUtilization < 80 ? 'Remove unused indexes' : 'Good index utilization'
    });

    // Schema bloat factor
    const totalElements = schemaMapping.tables.size + schemaMapping.columns.size + schemaMapping.indexes.size;
    const unusedElements = unusedReport.unusedElements.length;
    const bloatFactor = totalElements > 0 ? (unusedElements / totalElements) * 100 : 0;

    metrics.push({
      metric: 'Schema Bloat Factor',
      currentValue: bloatFactor,
      unit: '%',
      impact: bloatFactor < 10 ? 'positive' : 'negative',
      trend: 'stable',
      recommendation: bloatFactor > 15 ? 'Significant cleanup needed' : 'Acceptable bloat level'
    });

    // Query complexity score
    const patterns = usageReport.patterns || [];
    const complexQueries = patterns.filter((p: any) => p.queryComplexity === 'complex').length;
    const totalQueries = patterns.length;
    const complexityScore = totalQueries > 0 ? (complexQueries / totalQueries) * 100 : 0;

    metrics.push({
      metric: 'Query Complexity Score',
      currentValue: complexityScore,
      unit: '%',
      impact: complexityScore < 20 ? 'positive' : 'negative',
      trend: 'stable',
      recommendation: complexityScore > 30 ? 'Optimize complex queries' : 'Good query complexity'
    });

    // Storage efficiency
    const estimatedWaste = this.estimateStorageWaste(unusedReport);
    const totalEstimatedStorage = this.estimateTotalStorage(schemaMapping);
    const storageEfficiency = totalEstimatedStorage > 0 ?
      ((totalEstimatedStorage - estimatedWaste) / totalEstimatedStorage) * 100 : 100;

    metrics.push({
      metric: 'Storage Efficiency',
      currentValue: storageEfficiency,
      unit: '%',
      impact: storageEfficiency > 90 ? 'positive' : 'negative',
      trend: 'stable',
      recommendation: storageEfficiency < 85 ? 'Clean up unused elements' : 'Good storage efficiency'
    });

    return metrics;
  }

  private identifyOptimizationOpportunities(
    schemaMapping: any,
    usageReport: any,
    unusedReport: any,
    driftReport: any
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Index removal opportunities
    const unusedIndexes = schemaMapping.unused.indexes;
    if (unusedIndexes.length > 0) {
      opportunities.push({
        type: 'index_removal',
        description: `Remove ${unusedIndexes.length} unused indexes`,
        elements: unusedIndexes,
        estimatedImpact: {
          storageReduction: unusedIndexes.length * 50000, // 50KB per index estimate
          writePerformanceImprovement: Math.min(unusedIndexes.length * 2, 15), // 2% per index, max 15%
          maintenanceReduction: unusedIndexes.length * 0.5 // 0.5 hours per index per month
        },
        implementation: {
          effort: 'low',
          risk: 'low',
          reversible: true,
          estimatedTime: `${unusedIndexes.length * 15} minutes`
        },
        prerequisites: ['Database backup', 'Performance baseline'],
        validation: {
          checks: ['Monitor query performance', 'Check for performance regressions'],
          rollbackPlan: 'Recreate indexes from saved definitions',
          monitoringRequirements: ['Query execution times', 'Resource utilization']
        }
      });
    }

    // Schema cleanup opportunities
    const unusedTables = unusedReport.unusedElements.filter(e => e.type === 'table');
    if (unusedTables.length > 0) {
      opportunities.push({
        type: 'schema_cleanup',
        description: `Remove ${unusedTables.length} unused tables`,
        elements: unusedTables.map(t => t.name),
        estimatedImpact: {
          storageReduction: unusedTables.length * 100000, // 100KB per table estimate
          maintenanceReduction: unusedTables.length * 1 // 1 hour per table per month
        },
        implementation: {
          effort: 'medium',
          risk: 'medium',
          reversible: false,
          estimatedTime: `${unusedTables.length * 2} hours`
        },
        prerequisites: ['Complete usage verification', 'Stakeholder approval', 'Data backup'],
        validation: {
          checks: ['Application functionality tests', 'Data integrity checks'],
          rollbackPlan: 'Restore from backup (data loss possible)',
          monitoringRequirements: ['Application errors', 'Missing table errors']
        }
      });
    }

    // Query optimization opportunities
    const complexQueries = usageReport.patterns?.filter((p: any) => p.queryComplexity === 'complex') || [];
    if (complexQueries.length > 0) {
      opportunities.push({
        type: 'query_optimization',
        description: `Optimize ${complexQueries.length} complex queries`,
        elements: complexQueries.map((q: any) => q.context.slice(0, 50)),
        estimatedImpact: {
          querySpeedImprovement: Math.min(complexQueries.length * 5, 40) // 5% per query, max 40%
        },
        implementation: {
          effort: 'high',
          risk: 'medium',
          reversible: true,
          estimatedTime: `${complexQueries.length * 4} hours`
        },
        prerequisites: ['Query performance profiling', 'Test environment setup'],
        validation: {
          checks: ['Performance benchmarks', 'Result correctness verification'],
          rollbackPlan: 'Revert to original query implementations',
          monitoringRequirements: ['Query execution times', 'Result accuracy']
        }
      });
    }

    // Missing index opportunities
    const frequentlyQueriedColumns = this.identifyFrequentlyQueriedColumns(usageReport);
    if (frequentlyQueriedColumns.length > 0) {
      opportunities.push({
        type: 'index_addition',
        description: `Add indexes for ${frequentlyQueriedColumns.length} frequently queried columns`,
        elements: frequentlyQueriedColumns,
        estimatedImpact: {
          querySpeedImprovement: Math.min(frequentlyQueriedColumns.length * 10, 50), // 10% per index, max 50%
          storageReduction: -frequentlyQueriedColumns.length * 30000 // Negative because indexes use storage
        },
        implementation: {
          effort: 'low',
          risk: 'low',
          reversible: true,
          estimatedTime: `${frequentlyQueriedColumns.length * 30} minutes`
        },
        prerequisites: ['Query pattern analysis', 'Storage capacity check'],
        validation: {
          checks: ['Query performance improvement', 'Index usage verification'],
          rollbackPlan: 'Drop newly created indexes',
          monitoringRequirements: ['Index usage statistics', 'Query performance']
        }
      });
    }

    return opportunities.sort((a, b) => {
      // Sort by potential impact and ease of implementation
      const impactA = (a.estimatedImpact.querySpeedImprovement || 0) +
                     (a.estimatedImpact.writePerformanceImprovement || 0);
      const impactB = (b.estimatedImpact.querySpeedImprovement || 0) +
                     (b.estimatedImpact.writePerformanceImprovement || 0);

      const effortScore = { low: 1, medium: 2, high: 3 };
      const effortA = effortScore[a.implementation.effort];
      const effortB = effortScore[b.implementation.effort];

      // Higher impact / lower effort is better
      return (impactB / effortB) - (impactA / effortA);
    });
  }

  private generatePerformanceProjections(
    currentMetrics: PerformanceMetric[],
    opportunities: OptimizationOpportunity[]
  ): PerformanceProjection[] {
    const projections: PerformanceProjection[] = [];

    const baselineStorage = 1000000000; // 1GB baseline
    const baselineQueryTime = 100; // 100ms baseline
    const baselineIndexCount = 50;
    const baselineMaintenanceHours = 10;

    // Calculate potential improvements
    const storageReduction = opportunities.reduce((sum, opp) =>
      sum + (opp.estimatedImpact.storageReduction || 0), 0);
    const queryImprovement = opportunities.reduce((sum, opp) =>
      sum + (opp.estimatedImpact.querySpeedImprovement || 0), 0);
    const maintenanceReduction = opportunities.reduce((sum, opp) =>
      sum + (opp.estimatedImpact.maintenanceReduction || 0), 0);

    // Optimistic scenario (all optimizations implemented)
    projections.push({
      timeframe: '3_months',
      scenario: 'optimistic',
      metrics: {
        storageSize: Math.max(baselineStorage - storageReduction, baselineStorage * 0.5),
        queryPerformance: Math.max(baselineQueryTime * (1 - queryImprovement / 100), baselineQueryTime * 0.3),
        indexCount: Math.max(baselineIndexCount - opportunities.filter(o => o.type === 'index_removal').length, 10),
        maintenanceEffort: Math.max(baselineMaintenanceHours - maintenanceReduction, 2)
      },
      assumptions: [
        'All optimization opportunities implemented',
        'No new schema additions',
        'Optimal execution of changes'
      ]
    });

    // Realistic scenario (70% of optimizations implemented)
    projections.push({
      timeframe: '6_months',
      scenario: 'realistic',
      metrics: {
        storageSize: baselineStorage - (storageReduction * 0.7),
        queryPerformance: baselineQueryTime * (1 - (queryImprovement * 0.7) / 100),
        indexCount: baselineIndexCount - Math.floor(opportunities.filter(o => o.type === 'index_removal').length * 0.7),
        maintenanceEffort: baselineMaintenanceHours - (maintenanceReduction * 0.7)
      },
      assumptions: [
        '70% of optimizations implemented',
        'Some new features added',
        'Normal development pace'
      ]
    });

    // Pessimistic scenario (only easy wins implemented)
    projections.push({
      timeframe: '1_year',
      scenario: 'pessimistic',
      metrics: {
        storageSize: baselineStorage - (storageReduction * 0.3),
        queryPerformance: baselineQueryTime * (1 - (queryImprovement * 0.3) / 100),
        indexCount: baselineIndexCount - Math.floor(opportunities.filter(o => o.type === 'index_removal').length * 0.3),
        maintenanceEffort: baselineMaintenanceHours - (maintenanceReduction * 0.3)
      },
      assumptions: [
        'Only low-effort optimizations implemented',
        'Significant new features added',
        'Limited optimization resources'
      ]
    });

    return projections;
  }

  private performDetailedAnalysis(
    schemaMapping: any,
    usageReport: any,
    unusedReport: any
  ) {
    const indexAnalysis = {
      totalIndexes: schemaMapping.indexes.size,
      usedIndexes: schemaMapping.indexes.size - schemaMapping.unused.indexes.length,
      redundantIndexes: schemaMapping.unused.indexes,
      missingIndexes: this.identifyMissingIndexes(usageReport)
    };

    const queryAnalysis = {
      totalQueries: usageReport.patterns?.length || 0,
      complexQueries: usageReport.patterns?.filter((p: any) => p.queryComplexity === 'complex').length || 0,
      slowQueries: this.identifySlowQueries(usageReport)
    };

    const unusedElementCount = unusedReport.unusedElements.length;
    const totalElementCount = schemaMapping.tables.size + schemaMapping.columns.size + schemaMapping.indexes.size;
    const bloatScore = totalElementCount > 0 ? (unusedElementCount / totalElementCount) * 100 : 0;

    const schemaAnalysis = {
      bloatScore,
      unusedElements: unusedElementCount,
      migrationComplexity: this.assessMigrationComplexity(unusedReport),
      technicalDebt: Math.min(bloatScore + (queryAnalysis.complexQueries / queryAnalysis.totalQueries) * 50, 100)
    };

    return {
      indexAnalysis,
      queryAnalysis,
      schemaAnalysis
    };
  }

  private createActionPlan(opportunities: OptimizationOpportunity[]) {
    const quickWins = opportunities.filter(opp =>
      opp.implementation.effort === 'low' && opp.implementation.risk === 'low');

    const mediumTerm = opportunities.filter(opp =>
      opp.implementation.effort === 'medium' || opp.implementation.risk === 'medium');

    const longTerm = opportunities.filter(opp =>
      opp.implementation.effort === 'high' || opp.implementation.risk === 'high');

    const continuousImprovement = [
      'Monitor query performance regularly',
      'Review new index requirements monthly',
      'Analyze schema growth trends quarterly',
      'Conduct performance audits bi-annually'
    ];

    return {
      quickWins,
      mediumTerm,
      longTerm,
      continuousImprovement
    };
  }

  private calculateSummaryMetrics(
    currentMetrics: PerformanceMetric[],
    opportunities: OptimizationOpportunity[],
    detailedAnalysis: any
  ) {
    // Calculate overall health score
    const indexHealth = detailedAnalysis.indexAnalysis.usedIndexes / detailedAnalysis.indexAnalysis.totalIndexes * 100;
    const schemaHealth = 100 - detailedAnalysis.schemaAnalysis.bloatScore;
    const queryHealth = 100 - (detailedAnalysis.queryAnalysis.complexQueries / Math.max(detailedAnalysis.queryAnalysis.totalQueries, 1)) * 100;

    const overallHealthScore = (indexHealth + schemaHealth + queryHealth) / 3;

    // Count critical issues
    const criticalIssues = opportunities.filter(opp =>
      opp.implementation.risk === 'high' ||
      (opp.estimatedImpact.querySpeedImprovement || 0) > 30
    ).length;

    // Calculate optimization potential
    const maxPossibleImprovement = opportunities.reduce((sum, opp) =>
      sum + (opp.estimatedImpact.querySpeedImprovement || 0) +
            (opp.estimatedImpact.writePerformanceImprovement || 0), 0);
    const optimizationPotential = Math.min(maxPossibleImprovement, 100);

    // Estimate savings
    const estimatedSavings = {
      storage: opportunities.reduce((sum, opp) => sum + (opp.estimatedImpact.storageReduction || 0), 0),
      performance: opportunities.reduce((sum, opp) => sum + (opp.estimatedImpact.querySpeedImprovement || 0), 0),
      maintenance: opportunities.reduce((sum, opp) => sum + (opp.estimatedImpact.maintenanceReduction || 0), 0)
    };

    return {
      overallHealthScore: Math.round(overallHealthScore),
      criticalIssues,
      optimizationPotential: Math.round(optimizationPotential),
      estimatedSavings
    };
  }

  private estimateStorageWaste(unusedReport: any): number {
    return unusedReport.summary.potentialSavings.storageBytes || 0;
  }

  private estimateTotalStorage(schemaMapping: any): number {
    // Rough estimation based on schema elements
    return (schemaMapping.tables.size * 100000) +
           (schemaMapping.columns.size * 1000) +
           (schemaMapping.indexes.size * 50000);
  }

  private identifyFrequentlyQueriedColumns(usageReport: any): string[] {
    const wherePatterns = usageReport.patterns?.filter((p: any) => p.usageType === 'where') || [];
    const frequency = new Map<string, number>();

    for (const pattern of wherePatterns) {
      const count = frequency.get(pattern.element) || 0;
      frequency.set(pattern.element, count + 1);
    }

    return Array.from(frequency.entries())
      .filter(([_, count]) => count > 5) // Frequently used threshold
      .map(([element, _]) => element);
  }

  private identifyMissingIndexes(usageReport: any): Array<{
    table: string;
    columns: string[];
    justification: string;
    estimatedBenefit: string;
  }> {
    // This would require more sophisticated analysis
    // For now, return a simplified analysis
    return [];
  }

  private identifySlowQueries(usageReport: any): Array<{
    pattern: string;
    complexity: number;
    frequency: number;
    optimization: string;
  }> {
    const complexPatterns = usageReport.patterns?.filter((p: any) => p.queryComplexity === 'complex') || [];

    return complexPatterns.map((pattern: any) => ({
      pattern: pattern.context?.slice(0, 100) || 'Unknown pattern',
      complexity: 3, // Complex queries have complexity 3
      frequency: 1, // Would need historical data
      optimization: 'Consider query restructuring or adding indexes'
    }));
  }

  private assessMigrationComplexity(unusedReport: any): 'low' | 'medium' | 'high' {
    const highRiskElements = unusedReport.unusedElements.filter((e: any) =>
      e.recommendations.action === 'investigate' || e.confidence === 'low').length;

    if (highRiskElements > 10) return 'high';
    if (highRiskElements > 5) return 'medium';
    return 'low';
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const assessor = new PerformanceAssessor(rootDir);

    try {
      const result = await assessor.assess();

      console.log('\n⚡ Database Performance Assessment Results:');
      console.log(`Overall Health Score: ${result.summary.overallHealthScore}/100`);
      console.log(`Critical Issues: ${result.summary.criticalIssues}`);
      console.log(`Optimization Potential: ${result.summary.optimizationPotential}%`);

      console.log('\n💾 Estimated Savings:');
      console.log(`  Storage: ${(result.summary.estimatedSavings.storage / 1000000).toFixed(1)}MB`);
      console.log(`  Performance: ${result.summary.estimatedSavings.performance.toFixed(1)}% improvement`);
      console.log(`  Maintenance: ${result.summary.estimatedSavings.maintenance.toFixed(1)} hours/month`);

      if (result.actionPlan.quickWins.length > 0) {
        console.log('\n🚀 Quick Wins Available:');
        result.actionPlan.quickWins.forEach((opp, index) => {
          console.log(`  ${index + 1}. ${opp.description}`);
          console.log(`     Effort: ${opp.implementation.effort}, Risk: ${opp.implementation.risk}`);
        });
      }

      console.log('\n📊 Current Performance Metrics:');
      result.currentMetrics.forEach(metric => {
        const icon = metric.impact === 'positive' ? '✅' : metric.impact === 'negative' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${metric.metric}: ${metric.currentValue.toFixed(1)}${metric.unit}`);
      });

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Performance assessment failed:', error);
      process.exit(1);
    }
  }

  main();
}