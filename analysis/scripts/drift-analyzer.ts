import { SchemaMapper } from './schema-mapper';
import { DatabaseUsageScanner } from './db-usage-scanner';
import { UnusedElementsAnalyzer } from './unused-elements-analyzer';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface SchemaDrift {
  elementName: string;
  elementType: 'table' | 'column' | 'index' | 'enum';
  driftType: 'added' | 'removed' | 'modified' | 'unused' | 'misaligned';
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  impact: string;
  recommendation: string;
  detectedAt: string;
  confidence: number; // 0-1
}

interface EvolutionPattern {
  pattern: 'table_growth' | 'column_addition' | 'index_proliferation' | 'enum_expansion' | 'schema_bloat';
  trend: 'increasing' | 'decreasing' | 'stable';
  frequency: number;
  examples: string[];
  recommendation: string;
}

interface PerformanceAnalysis {
  queryComplexity: {
    simple: number;
    medium: number;
    complex: number;
    averageComplexity: number;
  };
  indexEfficiency: {
    wellUtilized: string[];
    underUtilized: string[];
    overIndexed: string[];
    missing: Array<{
      table: string;
      columns: string[];
      reason: string;
      estimatedImprovement: string;
    }>;
  };
  schemaSize: {
    tables: number;
    columns: number;
    indexes: number;
    estimatedStorage: number;
    growthRate: number;
  };
  maintenanceOverhead: {
    unusedElements: number;
    redundantIndexes: number;
    complexQueries: number;
    migrationComplexity: 'low' | 'medium' | 'high';
  };
}

interface DriftAnalysisReport {
  timestamp: string;
  tool: 'drift-analyzer';
  summary: {
    totalDrifts: number;
    criticalDrifts: number;
    schemaHealth: number; // 0-100 score
    evolutionVelocity: number; // changes per month
    maintenanceBurden: 'low' | 'medium' | 'high';
  };
  drifts: SchemaDrift[];
  evolutionPatterns: EvolutionPattern[];
  performanceAnalysis: PerformanceAnalysis;
  recommendations: {
    immediate: Array<{
      action: string;
      reason: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
    }>;
    mediumTerm: Array<{
      action: string;
      reason: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
    }>;
    longTerm: Array<{
      action: string;
      reason: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
    }>;
  };
  trends: {
    schemaGrowth: Array<{
      month: string;
      tables: number;
      columns: number;
      indexes: number;
    }>;
    usagePatterns: Array<{
      element: string;
      usageCount: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };
}

export class DriftAnalyzer {
  private rootDir: string;
  private schemaMapper: SchemaMapper;
  private usageScanner: DatabaseUsageScanner;
  private unusedAnalyzer: UnusedElementsAnalyzer;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.schemaMapper = new SchemaMapper(rootDir);
    this.usageScanner = new DatabaseUsageScanner(rootDir);
    this.unusedAnalyzer = new UnusedElementsAnalyzer(rootDir);
  }

  async analyze(): Promise<DriftAnalysisReport> {
    console.log('🔍 Analyzing database schema drift...');

    // Step 1: Get current state analysis
    console.log('  📊 Getting current schema state...');
    const schemaMapping = await this.schemaMapper.analyze();
    const usageReport = await this.usageScanner.scan();
    const unusedReport = await this.unusedAnalyzer.analyze();

    // Step 2: Analyze historical trends
    console.log('  📈 Analyzing historical trends...');
    const evolutionPatterns = await this.analyzeEvolutionPatterns();

    // Step 3: Detect schema drifts
    console.log('  🎯 Detecting schema drifts...');
    const drifts = await this.detectSchemaDrifts(schemaMapping, usageReport, unusedReport);

    // Step 4: Analyze performance implications
    console.log('  ⚡ Analyzing performance impact...');
    const performanceAnalysis = await this.analyzePerformanceImpact(schemaMapping, usageReport);

    // Step 5: Generate recommendations
    console.log('  💡 Generating recommendations...');
    const recommendations = this.generateRecommendations(drifts, performanceAnalysis);

    // Step 6: Calculate schema health score
    const schemaHealth = this.calculateSchemaHealth(drifts, performanceAnalysis);

    return {
      timestamp: new Date().toISOString(),
      tool: 'drift-analyzer',
      summary: {
        totalDrifts: drifts.length,
        criticalDrifts: drifts.filter(d => d.severity === 'critical').length,
        schemaHealth,
        evolutionVelocity: this.calculateEvolutionVelocity(evolutionPatterns),
        maintenanceBurden: this.assessMaintenanceBurden(performanceAnalysis)
      },
      drifts,
      evolutionPatterns,
      performanceAnalysis,
      recommendations,
      trends: {
        schemaGrowth: await this.analyzeSchemaGrowthTrends(),
        usagePatterns: this.analyzeUsageTrends(usageReport)
      }
    };
  }

  private async detectSchemaDrifts(
    schemaMapping: any,
    usageReport: any,
    unusedReport: any
  ): Promise<SchemaDrift[]> {
    const drifts: SchemaDrift[] = [];

    // Detect unused elements drift
    for (const unused of unusedReport.unusedElements) {
      drifts.push({
        elementName: unused.name,
        elementType: unused.type,
        driftType: 'unused',
        severity: this.mapConfidenceToSeverity(unused.confidence),
        description: `${unused.type} '${unused.name}' appears to be unused`,
        impact: `Maintenance overhead and potential performance impact`,
        recommendation: unused.recommendations.action,
        detectedAt: new Date().toISOString(),
        confidence: this.mapConfidenceToNumber(unused.confidence)
      });
    }

    // Detect schema-code misalignment
    const misalignments = await this.detectSchemaCodeMisalignment(schemaMapping, usageReport);
    drifts.push(...misalignments);

    // Detect over-indexing
    const overIndexing = await this.detectOverIndexing(schemaMapping, usageReport);
    drifts.push(...overIndexing);

    // Detect missing indexes
    const missingIndexes = await this.detectMissingIndexes(usageReport);
    drifts.push(...missingIndexes);

    // Detect enum value drift
    const enumDrifts = await this.detectEnumValueDrift(schemaMapping, usageReport);
    drifts.push(...enumDrifts);

    return drifts.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async detectSchemaCodeMisalignment(
    schemaMapping: any,
    usageReport: any
  ): Promise<SchemaDrift[]> {
    const drifts: SchemaDrift[] = [];

    // Check for tables defined but never used
    for (const [tableName, table] of schemaMapping.tables.entries()) {
      if (table.usage.length === 0) {
        const usageInPatterns = usageReport.patterns.filter((p: any) => p.element === tableName);

        if (usageInPatterns.length === 0) {
          drifts.push({
            elementName: tableName,
            elementType: 'table',
            driftType: 'misaligned',
            severity: 'major',
            description: `Table '${tableName}' is defined in schema but never used in code`,
            impact: 'Unnecessary schema complexity and maintenance overhead',
            recommendation: 'Consider removing if truly unused',
            detectedAt: new Date().toISOString(),
            confidence: 0.8
          });
        }
      }
    }

    // Check for columns that are selected but never filtered/joined
    for (const [columnKey, column] of schemaMapping.columns.entries()) {
      const selectUsage = column.usage.filter((u: any) => u.type === 'select').length;
      const filterUsage = column.usage.filter((u: any) => ['where', 'join', 'orderby'].includes(u.type)).length;

      if (selectUsage > 0 && filterUsage === 0 && !column.metadata.isPrimaryKey) {
        drifts.push({
          elementName: columnKey,
          elementType: 'column',
          driftType: 'misaligned',
          severity: 'minor',
          description: `Column '${columnKey}' is selected but never used for filtering or joining`,
          impact: 'Potential for data over-fetching',
          recommendation: 'Review if this column is necessary in SELECT statements',
          detectedAt: new Date().toISOString(),
          confidence: 0.6
        });
      }
    }

    return drifts;
  }

  private async detectOverIndexing(
    schemaMapping: any,
    usageReport: any
  ): Promise<SchemaDrift[]> {
    const drifts: SchemaDrift[] = [];

    // Find indexes that are never used in queries
    for (const [indexName, index] of schemaMapping.indexes.entries()) {
      if (index.usage.length === 0) {
        drifts.push({
          elementName: indexName,
          elementType: 'index',
          driftType: 'unused',
          severity: 'minor',
          description: `Index '${indexName}' appears to be unused`,
          impact: 'Unnecessary storage and write performance overhead',
          recommendation: 'Consider removing if query patterns confirm it is unused',
          detectedAt: new Date().toISOString(),
          confidence: 0.7
        });
      }
    }

    return drifts;
  }

  private async detectMissingIndexes(usageReport: any): Promise<SchemaDrift[]> {
    const drifts: SchemaDrift[] = [];

    // Analyze query patterns to suggest missing indexes
    const wherePatterns = usageReport.patterns.filter((p: any) => p.usageType === 'where');
    const joinPatterns = usageReport.patterns.filter((p: any) => p.usageType === 'join');

    // Group by element to find frequently filtered columns
    const frequentlyFiltered = new Map<string, number>();

    for (const pattern of wherePatterns) {
      const count = frequentlyFiltered.get(pattern.element) || 0;
      frequentlyFiltered.set(pattern.element, count + 1);
    }

    // Suggest indexes for frequently filtered columns
    for (const [element, count] of frequentlyFiltered.entries()) {
      if (count > 5) { // Threshold for "frequently used"
        drifts.push({
          elementName: element,
          elementType: 'column',
          driftType: 'misaligned',
          severity: 'minor',
          description: `Column '${element}' is frequently used in WHERE clauses but may lack proper indexing`,
          impact: 'Potential query performance degradation',
          recommendation: 'Consider adding an index for this column',
          detectedAt: new Date().toISOString(),
          confidence: 0.6
        });
      }
    }

    return drifts;
  }

  private async detectEnumValueDrift(
    schemaMapping: any,
    usageReport: any
  ): Promise<SchemaDrift[]> {
    const drifts: SchemaDrift[] = [];

    // This would require analyzing actual data usage vs enum definitions
    // For now, we'll do a basic check for unused enums
    for (const [enumName, enumDef] of schemaMapping.enums.entries()) {
      if (enumDef.usage.length === 0) {
        drifts.push({
          elementName: enumName,
          elementType: 'enum',
          driftType: 'unused',
          severity: 'minor',
          description: `Enum '${enumName}' is defined but not referenced in code`,
          impact: 'Schema bloat and maintenance overhead',
          recommendation: 'Remove if no longer needed',
          detectedAt: new Date().toISOString(),
          confidence: 0.8
        });
      }
    }

    return drifts;
  }

  private async analyzeEvolutionPatterns(): Promise<EvolutionPattern[]> {
    const patterns: EvolutionPattern[] = [];

    // Analyze migration history
    const migrationFiles = await this.findMigrationFiles();
    const migrationAnalysis = await this.analyzeMigrationPatterns(migrationFiles);

    patterns.push(...migrationAnalysis);

    return patterns;
  }

  private async findMigrationFiles(): Promise<string[]> {
    const patterns = [
      'packages/db/drizzle/**/*.sql',
      'packages/db/migrations/**/*.sql'
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return files.sort(); // Sort chronologically
  }

  private async analyzeMigrationPatterns(migrationFiles: string[]): Promise<EvolutionPattern[]> {
    const patterns: EvolutionPattern[] = [];

    let tableAdditions = 0;
    let columnAdditions = 0;
    let indexAdditions = 0;

    for (const file of migrationFiles) {
      try {
        const content = await readFile(join(this.rootDir, file), 'utf-8');

        // Count different types of changes
        const createTableMatches = content.match(/CREATE TABLE/gi);
        const addColumnMatches = content.match(/ADD COLUMN/gi);
        const createIndexMatches = content.match(/CREATE.*INDEX/gi);

        if (createTableMatches) tableAdditions += createTableMatches.length;
        if (addColumnMatches) columnAdditions += addColumnMatches.length;
        if (createIndexMatches) indexAdditions += createIndexMatches.length;
      } catch (error) {
        // Ignore read errors
      }
    }

    if (tableAdditions > 0) {
      patterns.push({
        pattern: 'table_growth',
        trend: 'increasing',
        frequency: tableAdditions,
        examples: [`${tableAdditions} tables added across migrations`],
        recommendation: 'Monitor for schema bloat and consider consolidation opportunities'
      });
    }

    if (indexAdditions > columnAdditions * 0.5) {
      patterns.push({
        pattern: 'index_proliferation',
        trend: 'increasing',
        frequency: indexAdditions,
        examples: [`${indexAdditions} indexes vs ${columnAdditions} columns`],
        recommendation: 'Review index necessity and remove unused indexes'
      });
    }

    return patterns;
  }

  private async analyzePerformanceImpact(
    schemaMapping: any,
    usageReport: any
  ): Promise<PerformanceAnalysis> {
    // Analyze query complexity distribution
    const complexities = usageReport.patterns.map((p: any) => p.queryComplexity);
    const complexityDistribution = {
      simple: complexities.filter((c: string) => c === 'simple').length,
      medium: complexities.filter((c: string) => c === 'medium').length,
      complex: complexities.filter((c: string) => c === 'complex').length,
      averageComplexity: 0
    };

    const complexityScore = {
      simple: 1,
      medium: 2,
      complex: 3
    };

    complexityDistribution.averageComplexity = complexities.length > 0
      ? complexities.reduce((sum: number, c: string) => sum + (complexityScore[c as keyof typeof complexityScore] || 2), 0) / complexities.length
      : 0;

    // Analyze index efficiency
    const usedIndexes = new Set(
      usageReport.patterns
        .filter((p: any) => p.elementType === 'index')
        .map((p: any) => p.element)
    );

    const allIndexes = Array.from(schemaMapping.indexes.keys());
    const indexEfficiency = {
      wellUtilized: Array.from(usedIndexes),
      underUtilized: [], // Would need query execution statistics
      overIndexed: allIndexes.filter(idx => !usedIndexes.has(idx)),
      missing: [] // Would need query execution plan analysis
    };

    // Calculate schema size metrics
    const schemaSize = {
      tables: schemaMapping.tables.size,
      columns: schemaMapping.columns.size,
      indexes: schemaMapping.indexes.size,
      estimatedStorage: this.estimateSchemaStorage(schemaMapping),
      growthRate: 0 // Would need historical data
    };

    // Assess maintenance overhead
    const maintenanceOverhead = {
      unusedElements: schemaMapping.unused.tables.length +
                     schemaMapping.unused.columns.length +
                     schemaMapping.unused.indexes.length,
      redundantIndexes: indexEfficiency.overIndexed.length,
      complexQueries: complexityDistribution.complex,
      migrationComplexity: this.assessMigrationComplexity(schemaMapping) as 'low' | 'medium' | 'high'
    };

    return {
      queryComplexity: complexityDistribution,
      indexEfficiency,
      schemaSize,
      maintenanceOverhead
    };
  }

  private generateRecommendations(
    drifts: SchemaDrift[],
    performanceAnalysis: PerformanceAnalysis
  ) {
    const immediate: any[] = [];
    const mediumTerm: any[] = [];
    const longTerm: any[] = [];

    // Critical and major drifts need immediate attention
    const criticalDrifts = drifts.filter(d => d.severity === 'critical');
    const majorDrifts = drifts.filter(d => d.severity === 'major');

    if (criticalDrifts.length > 0) {
      immediate.push({
        action: 'Address critical schema drifts',
        reason: `${criticalDrifts.length} critical issues found`,
        impact: 'High - potential data integrity or performance issues',
        effort: 'high'
      });
    }

    if (performanceAnalysis.indexEfficiency.overIndexed.length > 5) {
      immediate.push({
        action: 'Remove unused indexes',
        reason: `${performanceAnalysis.indexEfficiency.overIndexed.length} unused indexes found`,
        impact: 'Medium - improved write performance and reduced storage',
        effort: 'low'
      });
    }

    if (performanceAnalysis.queryComplexity.complex > 10) {
      mediumTerm.push({
        action: 'Optimize complex queries',
        reason: `${performanceAnalysis.queryComplexity.complex} complex queries detected`,
        impact: 'High - improved query performance',
        effort: 'medium'
      });
    }

    if (performanceAnalysis.maintenanceOverhead.unusedElements > 20) {
      longTerm.push({
        action: 'Schema cleanup initiative',
        reason: `${performanceAnalysis.maintenanceOverhead.unusedElements} unused elements`,
        impact: 'Medium - reduced maintenance burden',
        effort: 'high'
      });
    }

    return {
      immediate,
      mediumTerm,
      longTerm
    };
  }

  private calculateSchemaHealth(
    drifts: SchemaDrift[],
    performanceAnalysis: PerformanceAnalysis
  ): number {
    let score = 100;

    // Deduct points for drifts by severity
    const severityPenalties = { critical: 20, major: 10, minor: 5, info: 1 };
    for (const drift of drifts) {
      score -= severityPenalties[drift.severity];
    }

    // Deduct points for maintenance overhead
    score -= performanceAnalysis.maintenanceOverhead.unusedElements * 0.5;
    score -= performanceAnalysis.maintenanceOverhead.redundantIndexes * 1;
    score -= performanceAnalysis.maintenanceOverhead.complexQueries * 0.3;

    // Bonus points for good practices
    const indexUtilization = performanceAnalysis.indexEfficiency.wellUtilized.length /
      (performanceAnalysis.schemaSize.indexes || 1);
    if (indexUtilization > 0.8) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateEvolutionVelocity(patterns: EvolutionPattern[]): number {
    // Calculate changes per month based on patterns
    return patterns.reduce((sum, p) => sum + p.frequency, 0) / 12; // Assuming 1 year of data
  }

  private assessMaintenanceBurden(performanceAnalysis: PerformanceAnalysis): 'low' | 'medium' | 'high' {
    const overhead = performanceAnalysis.maintenanceOverhead;
    const totalIssues = overhead.unusedElements + overhead.redundantIndexes + overhead.complexQueries;

    if (totalIssues < 10) return 'low';
    if (totalIssues < 30) return 'medium';
    return 'high';
  }

  private async analyzeSchemaGrowthTrends(): Promise<Array<{
    month: string;
    tables: number;
    columns: number;
    indexes: number;
  }>> {
    // This would require historical schema snapshots
    // For now, return current state
    return [{
      month: new Date().toISOString().slice(0, 7),
      tables: 0, // Would be populated from actual data
      columns: 0,
      indexes: 0
    }];
  }

  private analyzeUsageTrends(usageReport: any): Array<{
    element: string;
    usageCount: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    // Count usage frequency for each element
    const usageFrequency = new Map<string, number>();

    for (const pattern of usageReport.patterns) {
      const current = usageFrequency.get(pattern.element) || 0;
      usageFrequency.set(pattern.element, current + 1);
    }

    return Array.from(usageFrequency.entries()).map(([element, count]) => ({
      element,
      usageCount: count,
      trend: 'stable' as const // Would need historical data for real trends
    }));
  }

  private mapConfidenceToSeverity(confidence: string): SchemaDrift['severity'] {
    switch (confidence) {
      case 'high': return 'major';
      case 'medium': return 'minor';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private mapConfidenceToNumber(confidence: string): number {
    switch (confidence) {
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.3;
      default: return 0.5;
    }
  }

  private estimateSchemaStorage(schemaMapping: any): number {
    // Rough estimation based on element counts
    const tableSize = schemaMapping.tables.size * 100000; // 100KB per table estimate
    const columnSize = schemaMapping.columns.size * 1000; // 1KB per column estimate
    const indexSize = schemaMapping.indexes.size * 50000; // 50KB per index estimate

    return tableSize + columnSize + indexSize;
  }

  private assessMigrationComplexity(schemaMapping: any): string {
    const unusedCount = schemaMapping.unused.tables.length +
                       schemaMapping.unused.columns.length +
                       schemaMapping.unused.indexes.length;

    if (unusedCount < 5) return 'low';
    if (unusedCount < 15) return 'medium';
    return 'high';
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const analyzer = new DriftAnalyzer(rootDir);

    try {
      const result = await analyzer.analyze();

      console.log('\n📊 Database Drift Analysis Results:');
      console.log(`Schema Health Score: ${result.summary.schemaHealth}/100`);
      console.log(`Total Drifts: ${result.summary.totalDrifts}`);
      console.log(`Critical Drifts: ${result.summary.criticalDrifts}`);
      console.log(`Evolution Velocity: ${result.summary.evolutionVelocity.toFixed(1)} changes/month`);
      console.log(`Maintenance Burden: ${result.summary.maintenanceBurden}`);

      if (result.recommendations.immediate.length > 0) {
        console.log('\n🚨 Immediate Actions Required:');
        result.recommendations.immediate.forEach(rec => {
          console.log(`  - ${rec.action}: ${rec.reason}`);
        });
      }

      if (result.drifts.filter(d => d.severity === 'critical').length > 0) {
        console.log('\n⚠️  Critical Schema Drifts:');
        result.drifts
          .filter(d => d.severity === 'critical')
          .forEach(drift => {
            console.log(`  - ${drift.elementName} (${drift.elementType}): ${drift.description}`);
          });
      }

      console.log(`\n📈 Performance Analysis:`);
      console.log(`  Query Complexity: ${result.performanceAnalysis.queryComplexity.averageComplexity.toFixed(1)}/3`);
      console.log(`  Unused Indexes: ${result.performanceAnalysis.indexEfficiency.overIndexed.length}`);
      console.log(`  Schema Size: ${(result.performanceAnalysis.schemaSize.estimatedStorage / 1000000).toFixed(1)}MB`);

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Drift analysis failed:', error);
      process.exit(1);
    }
  }

  main();
}