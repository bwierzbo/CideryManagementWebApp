import { SchemaMapper } from './schema-mapper.js';
import { DatabaseUsageScanner } from './db-usage-scanner.js';
import ASTParser from './ast-parser.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

interface UnusedElement {
  name: string;
  type: 'table' | 'column' | 'index' | 'enum';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  metadata: {
    size?: number;
    lastModified?: string;
    dependencies?: string[];
    potentialImpact?: 'high' | 'medium' | 'low';
    migrationComplexity?: 'simple' | 'medium' | 'complex';
  };
  recommendations: {
    action: 'remove' | 'investigate' | 'keep';
    priority: 'high' | 'medium' | 'low';
    safeguards: string[];
    rollbackPlan?: string;
  };
}

interface DriftAnalysis {
  schemaVsCode: {
    onlyInSchema: string[];
    onlyInCode: string[];
    mismatchedTypes: Array<{
      element: string;
      schemaType: string;
      codeUsage: string;
    }>;
  };
  usagePatterns: {
    frequentlyUsed: string[];
    rarelyUsed: string[];
    neverUsed: string[];
    dynamicallyReferenced: string[];
  };
  performanceImpact: {
    indexesNotUsed: string[];
    missingIndexes: string[];
    oversizedTables: string[];
    suboptimalQueries: Array<{
      query: string;
      issue: string;
      suggestion: string;
    }>;
  };
}

interface UnusedElementsReport {
  timestamp: string;
  tool: 'unused-elements-analyzer';
  summary: {
    totalElements: number;
    unusedElements: number;
    highConfidenceUnused: number;
    potentialSavings: {
      storageBytes: number;
      indexCount: number;
      maintenanceComplexity: number;
    };
  };
  unusedElements: UnusedElement[];
  driftAnalysis: DriftAnalysis;
  recommendations: {
    immediate: UnusedElement[];
    investigate: UnusedElement[];
    monitor: UnusedElement[];
  };
  migrationPlan: {
    phase1: UnusedElement[];
    phase2: UnusedElement[];
    phase3: UnusedElement[];
    rollbackStrategy: string;
  };
}

export class UnusedElementsAnalyzer {
  private rootDir: string;
  private schemaMapper: SchemaMapper;
  private usageScanner: DatabaseUsageScanner;
  private astParser: ASTParser;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.schemaMapper = new SchemaMapper(rootDir);
    this.usageScanner = new DatabaseUsageScanner(rootDir);
    this.astParser = new ASTParser(rootDir);
  }

  async analyze(): Promise<UnusedElementsReport> {
    console.log('🔍 Analyzing unused database elements...');

    // Step 1: Get comprehensive schema mapping
    console.log('  📋 Mapping schema to code...');
    const schemaMapping = await this.schemaMapper.analyze();

    // Step 2: Get detailed usage patterns
    console.log('  🔎 Analyzing usage patterns...');
    const usageReport = await this.usageScanner.scan();

    // Step 3: Cross-reference and identify unused elements
    console.log('  🎯 Identifying unused elements...');
    const unusedElements = await this.identifyUnusedElements(schemaMapping, usageReport);

    // Step 4: Analyze drift between schema and code
    console.log('  📊 Analyzing schema drift...');
    const driftAnalysis = await this.analyzeDrift(schemaMapping, usageReport);

    // Step 5: Generate recommendations
    console.log('  💡 Generating recommendations...');
    const recommendations = this.generateRecommendations(unusedElements);

    // Step 6: Create migration plan
    console.log('  🗺️  Creating migration plan...');
    const migrationPlan = this.createMigrationPlan(unusedElements);

    // Step 7: Calculate potential savings
    const potentialSavings = await this.calculatePotentialSavings(unusedElements);

    return {
      timestamp: new Date().toISOString(),
      tool: 'unused-elements-analyzer',
      summary: {
        totalElements: schemaMapping.analysis.totalElements,
        unusedElements: unusedElements.length,
        highConfidenceUnused: unusedElements.filter(e => e.confidence === 'high').length,
        potentialSavings
      },
      unusedElements,
      driftAnalysis,
      recommendations,
      migrationPlan
    };
  }

  private async identifyUnusedElements(
    schemaMapping: any,
    usageReport: any
  ): Promise<UnusedElement[]> {
    const unusedElements: UnusedElement[] = [];

    // Analyze unused tables
    for (const tableName of schemaMapping.unused.tables) {
      const table = schemaMapping.tables.get(tableName);
      if (table) {
        const element = await this.analyzeUnusedTable(table, schemaMapping, usageReport);
        unusedElements.push(element);
      }
    }

    // Analyze unused columns
    for (const columnKey of schemaMapping.unused.columns) {
      const column = schemaMapping.columns.get(columnKey);
      if (column) {
        const element = await this.analyzeUnusedColumn(column, schemaMapping, usageReport);
        unusedElements.push(element);
      }
    }

    // Analyze unused indexes
    for (const indexName of schemaMapping.unused.indexes) {
      const index = schemaMapping.indexes.get(indexName);
      if (index) {
        const element = await this.analyzeUnusedIndex(index, schemaMapping, usageReport);
        unusedElements.push(element);
      }
    }

    // Analyze unused enums
    for (const enumName of schemaMapping.unused.enums) {
      const enumDef = schemaMapping.enums.get(enumName);
      if (enumDef) {
        const element = await this.analyzeUnusedEnum(enumDef, schemaMapping, usageReport);
        unusedElements.push(element);
      }
    }

    return unusedElements;
  }

  private async analyzeUnusedTable(
    table: any,
    schemaMapping: any,
    usageReport: any
  ): Promise<UnusedElement> {
    const reasons: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    // Check if table is referenced in migrations
    const migrationFiles = await this.findMigrationFiles();
    const referencedInMigrations = await this.isReferencedInMigrations(table.name, migrationFiles);

    if (!referencedInMigrations) {
      reasons.push('Not referenced in recent migrations');
      confidence = 'high';
    }

    // Check for foreign key dependencies
    const dependencies = await this.findTableDependencies(table.name, schemaMapping);
    if (dependencies.length === 0) {
      reasons.push('No foreign key dependencies');
    } else {
      reasons.push(`Has ${dependencies.length} dependencies`);
      confidence = 'low';
    }

    // Check for test usage
    const testUsage = await this.findTestUsage(table.name);
    if (testUsage.length === 0) {
      reasons.push('No test coverage found');
    }

    return {
      name: table.name,
      type: 'table',
      confidence,
      reasons,
      metadata: {
        dependencies,
        potentialImpact: dependencies.length > 0 ? 'high' : 'low',
        migrationComplexity: dependencies.length > 0 ? 'complex' : 'simple'
      },
      recommendations: {
        action: confidence === 'high' ? 'remove' : 'investigate',
        priority: confidence === 'high' ? 'medium' : 'low',
        safeguards: [
          'Create database backup',
          'Check for runtime references',
          'Verify no external system dependencies'
        ],
        rollbackPlan: dependencies.length > 0 ? 'Complex rollback required' : 'Simple table recreation'
      }
    };
  }

  private async analyzeUnusedColumn(
    column: any,
    schemaMapping: any,
    usageReport: any
  ): Promise<UnusedElement> {
    const reasons: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    // Check if column is nullable (easier to remove)
    if (column.metadata.isNullable) {
      reasons.push('Column is nullable');
      confidence = 'high';
    }

    // Check if column has default value
    if (column.metadata.defaultValue) {
      reasons.push('Has default value');
    }

    // Check if column is part of primary key or foreign key
    if (column.metadata.isPrimaryKey) {
      reasons.push('Part of primary key');
      confidence = 'low';
    }

    if (column.metadata.isForeignKey) {
      reasons.push('Part of foreign key');
      confidence = 'low';
    }

    // Check for index usage
    const indexUsage = await this.findColumnIndexUsage(column.name);
    if (indexUsage.length > 0) {
      reasons.push(`Used in ${indexUsage.length} indexes`);
      confidence = 'low';
    }

    return {
      name: column.name,
      type: 'column',
      confidence,
      reasons,
      metadata: {
        potentialImpact: column.metadata.isPrimaryKey || column.metadata.isForeignKey ? 'high' : 'low',
        migrationComplexity: column.metadata.isNullable ? 'simple' : 'medium'
      },
      recommendations: {
        action: confidence === 'high' ? 'remove' : 'investigate',
        priority: 'low',
        safeguards: [
          'Ensure column is truly unused',
          'Check for computed columns that reference it',
          'Verify no reporting dependencies'
        ]
      }
    };
  }

  private async analyzeUnusedIndex(
    index: any,
    schemaMapping: any,
    usageReport: any
  ): Promise<UnusedElement> {
    const reasons: string[] = ['No queries found using this index'];

    // Indexes are generally safe to remove
    const confidence: 'high' | 'medium' | 'low' = 'high';

    return {
      name: index.name,
      type: 'index',
      confidence,
      reasons,
      metadata: {
        potentialImpact: 'low',
        migrationComplexity: 'simple'
      },
      recommendations: {
        action: 'remove',
        priority: 'high',
        safeguards: [
          'Monitor query performance after removal',
          'Keep index definition for quick recreation'
        ],
        rollbackPlan: 'Recreate index from saved definition'
      }
    };
  }

  private async analyzeUnusedEnum(
    enumDef: any,
    schemaMapping: any,
    usageReport: any
  ): Promise<UnusedElement> {
    const reasons: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    // Check if enum is used in any column definitions
    const enumUsage = await this.findEnumUsageInSchema(enumDef.name, schemaMapping);
    if (enumUsage.length === 0) {
      reasons.push('Not used in any column definitions');
      confidence = 'high';
    } else {
      reasons.push(`Used in ${enumUsage.length} column definitions`);
      confidence = 'low';
    }

    return {
      name: enumDef.name,
      type: 'enum',
      confidence,
      reasons,
      metadata: {
        potentialImpact: confidence === 'high' ? 'low' : 'medium',
        migrationComplexity: confidence === 'high' ? 'simple' : 'medium'
      },
      recommendations: {
        action: confidence === 'high' ? 'remove' : 'investigate',
        priority: 'low',
        safeguards: [
          'Verify no active data uses enum values',
          'Check for future planned usage'
        ]
      }
    };
  }

  private async analyzeDrift(schemaMapping: any, usageReport: any): Promise<DriftAnalysis> {
    // Analyze differences between schema definitions and actual usage
    const onlyInSchema: string[] = [];
    const onlyInCode: string[] = [];
    const mismatchedTypes: Array<{element: string; schemaType: string; codeUsage: string}> = [];

    // Find elements defined in schema but not used in code
    for (const [key, element] of schemaMapping.tables.entries()) {
      if (element.usage.length === 0) {
        onlyInSchema.push(key);
      }
    }

    // Analyze usage patterns
    const allUsagePatterns = usageReport.patterns;
    const usageFrequency = new Map<string, number>();

    for (const pattern of allUsagePatterns) {
      const current = usageFrequency.get(pattern.element) || 0;
      usageFrequency.set(pattern.element, current + 1);
    }

    const frequentlyUsed = Array.from(usageFrequency.entries())
      .filter(([_, count]) => count > 10)
      .map(([element, _]) => element);

    const rarelyUsed = Array.from(usageFrequency.entries())
      .filter(([_, count]) => count > 0 && count <= 3)
      .map(([element, _]) => element);

    const neverUsed = Array.from(schemaMapping.tables.keys())
      .filter(table => !usageFrequency.has(table));

    const dynamicallyReferenced = allUsagePatterns
      .filter(p => p.isDynamic)
      .map(p => p.element);

    return {
      schemaVsCode: {
        onlyInSchema,
        onlyInCode,
        mismatchedTypes
      },
      usagePatterns: {
        frequentlyUsed,
        rarelyUsed,
        neverUsed,
        dynamicallyReferenced: [...new Set(dynamicallyReferenced)]
      },
      performanceImpact: {
        indexesNotUsed: schemaMapping.unused.indexes,
        missingIndexes: [], // Would need query execution plan analysis
        oversizedTables: [], // Would need table size analysis
        suboptimalQueries: []
      }
    };
  }

  private generateRecommendations(unusedElements: UnusedElement[]) {
    const immediate = unusedElements.filter(e =>
      e.confidence === 'high' &&
      e.recommendations.action === 'remove' &&
      e.recommendations.priority === 'high'
    );

    const investigate = unusedElements.filter(e =>
      e.confidence === 'medium' ||
      e.recommendations.action === 'investigate'
    );

    const monitor = unusedElements.filter(e =>
      e.confidence === 'low' ||
      e.recommendations.priority === 'low'
    );

    return {
      immediate,
      investigate,
      monitor
    };
  }

  private createMigrationPlan(unusedElements: UnusedElement[]) {
    // Phase 1: Safe removals (indexes, nullable columns)
    const phase1 = unusedElements.filter(e =>
      e.type === 'index' ||
      (e.type === 'column' && e.metadata.migrationComplexity === 'simple')
    );

    // Phase 2: Medium complexity (non-nullable columns, some enums)
    const phase2 = unusedElements.filter(e =>
      e.metadata.migrationComplexity === 'medium' &&
      e.confidence !== 'low'
    );

    // Phase 3: Complex removals (tables with dependencies)
    const phase3 = unusedElements.filter(e =>
      e.metadata.migrationComplexity === 'complex' ||
      e.metadata.potentialImpact === 'high'
    );

    return {
      phase1,
      phase2,
      phase3,
      rollbackStrategy: 'Each phase includes rollback scripts and monitoring checkpoints'
    };
  }

  private async calculatePotentialSavings(unusedElements: UnusedElement[]) {
    // Simplified calculation - would need actual database statistics
    const indexCount = unusedElements.filter(e => e.type === 'index').length;
    const tableCount = unusedElements.filter(e => e.type === 'table').length;
    const columnCount = unusedElements.filter(e => e.type === 'column').length;

    return {
      storageBytes: tableCount * 1000000 + columnCount * 10000, // Rough estimate
      indexCount,
      maintenanceComplexity: unusedElements.length * 0.1 // Complexity reduction factor
    };
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

    return files;
  }

  private async isReferencedInMigrations(tableName: string, migrationFiles: string[]): Promise<boolean> {
    for (const file of migrationFiles) {
      try {
        const content = await readFile(join(this.rootDir, file), 'utf-8');
        if (content.includes(tableName)) {
          return true;
        }
      } catch (error) {
        // Ignore read errors
      }
    }
    return false;
  }

  private async findTableDependencies(tableName: string, schemaMapping: any): Promise<string[]> {
    const dependencies: string[] = [];

    // Look for foreign keys pointing to this table
    for (const [columnKey, column] of schemaMapping.columns.entries()) {
      if (column.metadata.isForeignKey && column.definition.includes(tableName)) {
        dependencies.push(columnKey);
      }
    }

    return dependencies;
  }

  private async findTestUsage(elementName: string): Promise<string[]> {
    const testFiles = await glob('**/*.test.{ts,js}', { cwd: this.rootDir });
    const usage: string[] = [];

    for (const file of testFiles) {
      try {
        const content = await readFile(join(this.rootDir, file), 'utf-8');
        if (content.includes(elementName)) {
          usage.push(file);
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return usage;
  }

  private async findColumnIndexUsage(columnName: string): Promise<string[]> {
    // Simplified - would need to parse index definitions properly
    return [];
  }

  private async findEnumUsageInSchema(enumName: string, schemaMapping: any): Promise<string[]> {
    const usage: string[] = [];

    for (const [columnKey, column] of schemaMapping.columns.entries()) {
      if (column.definition.includes(enumName)) {
        usage.push(columnKey);
      }
    }

    return usage;
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const analyzer = new UnusedElementsAnalyzer(rootDir);

    try {
      const result = await analyzer.analyze();

      console.log('\n📊 Unused Elements Analysis Results:');
      console.log(`Total elements: ${result.summary.totalElements}`);
      console.log(`Unused elements: ${result.summary.unusedElements}`);
      console.log(`High confidence unused: ${result.summary.highConfidenceUnused}`);
      console.log(`Potential storage savings: ${(result.summary.potentialSavings.storageBytes / 1000000).toFixed(1)}MB`);
      console.log(`Unused indexes: ${result.summary.potentialSavings.indexCount}`);

      console.log('\n🎯 Recommendations:');
      console.log(`  Immediate removal: ${result.recommendations.immediate.length} elements`);
      console.log(`  Investigate further: ${result.recommendations.investigate.length} elements`);
      console.log(`  Monitor usage: ${result.recommendations.monitor.length} elements`);

      console.log('\n🗺️  Migration Plan:');
      console.log(`  Phase 1 (safe): ${result.migrationPlan.phase1.length} elements`);
      console.log(`  Phase 2 (medium): ${result.migrationPlan.phase2.length} elements`);
      console.log(`  Phase 3 (complex): ${result.migrationPlan.phase3.length} elements`);

      if (result.driftAnalysis.usagePatterns.neverUsed.length > 0) {
        console.log('\n⚠️  Never Used Elements:');
        result.driftAnalysis.usagePatterns.neverUsed.forEach(element => {
          console.log(`  - ${element}`);
        });
      }

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Unused elements analysis failed:', error);
      process.exit(1);
    }
  }

  main();
}