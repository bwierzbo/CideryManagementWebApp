import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface DatabaseUsagePattern {
  element: string;
  elementType: 'table' | 'column' | 'index' | 'enum';
  usageType: 'select' | 'insert' | 'update' | 'delete' | 'join' | 'where' | 'orderby' | 'reference' | 'import';
  file: string;
  line: number;
  column: number;
  context: string;
  queryComplexity: 'simple' | 'medium' | 'complex';
  isDynamic: boolean;
  confidence: 'high' | 'medium' | 'low';
  performance: {
    indexUsed: boolean;
    estimatedCost: number;
    recommendedOptimization?: string;
  };
}

interface QueryAnalysis {
  type: 'select' | 'insert' | 'update' | 'delete' | 'complex';
  tables: string[];
  columns: string[];
  joins: string[];
  whereConditions: string[];
  orderBy: string[];
  groupBy: string[];
  having: string[];
  subqueries: number;
  complexity: number;
  estimatedRows: number;
  indexHints: string[];
}

interface DatabaseUsageReport {
  timestamp: string;
  tool: 'db-usage-scanner';
  patterns: DatabaseUsagePattern[];
  queries: QueryAnalysis[];
  summary: {
    totalUsages: number;
    highConfidenceUsages: number;
    dynamicQueries: number;
    potentialOptimizations: string[];
    unusedElements: {
      tables: string[];
      columns: string[];
      indexes: string[];
    };
  };
  performance: {
    slowQueryPatterns: string[];
    missingIndexes: string[];
    redundantIndexes: string[];
    optimizationOpportunities: Array<{
      type: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      effort: 'high' | 'medium' | 'low';
    }>;
  };
}

export class DatabaseUsageScanner {
  private rootDir: string;
  private sourceFileProgram: ts.Program;
  private typeChecker: ts.TypeChecker;
  private knownTables: Set<string>;
  private knownColumns: Map<string, string[]>; // table -> columns
  private knownIndexes: Set<string>;

  private sourcePatterns: string[] = [
    'apps/web/src/**/*.{ts,tsx}',
    'packages/api/src/**/*.ts',
    'packages/lib/src/**/*.ts',
    'packages/worker/src/**/*.ts'
  ];

  private queryPatterns = {
    drizzle: {
      select: /\.select\(/,
      insert: /\.insert\(/,
      update: /\.update\(/,
      delete: /\.delete\(/,
      from: /\.from\(/,
      where: /\.where\(/,
      join: /\.(leftJoin|rightJoin|innerJoin|join)\(/,
      orderBy: /\.orderBy\(/
    },
    raw: {
      select: /SELECT\s+/i,
      insert: /INSERT\s+INTO/i,
      update: /UPDATE\s+/i,
      delete: /DELETE\s+FROM/i,
      from: /FROM\s+(\w+)/i,
      where: /WHERE\s+/i,
      join: /(LEFT|RIGHT|INNER)?\s*JOIN\s+/i,
      orderBy: /ORDER\s+BY\s+/i
    }
  };

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.knownTables = new Set();
    this.knownColumns = new Map();
    this.knownIndexes = new Set();

    // Initialize TypeScript program for AST analysis
    const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const compilerOptions = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        rootDir
      );

      this.sourceFileProgram = ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
      this.typeChecker = this.sourceFileProgram.getTypeChecker();
    } else {
      // Fallback configuration
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        allowJs: true,
        strict: true
      };

      this.sourceFileProgram = ts.createProgram([], compilerOptions);
      this.typeChecker = this.sourceFileProgram.getTypeChecker();
    }
  }

  async scan(): Promise<DatabaseUsageReport> {
    console.log('🔍 Scanning database usage patterns with AST analysis...');

    // Step 1: Load schema information
    await this.loadSchemaInfo();

    // Step 2: Scan source files for usage patterns
    const patterns: DatabaseUsagePattern[] = [];
    const queries: QueryAnalysis[] = [];

    const sourceFiles = await this.findSourceFiles();

    for (const sourceFile of sourceFiles) {
      const content = await readFile(join(this.rootDir, sourceFile), 'utf-8');
      const tsSourceFile = ts.createSourceFile(
        sourceFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // AST-based analysis
      const filePatterns = this.analyzeFileWithAST(tsSourceFile, sourceFile);
      patterns.push(...filePatterns);

      // Regex-based query analysis for complex patterns
      const fileQueries = this.analyzeQueriesWithRegex(content, sourceFile);
      queries.push(...fileQueries);
    }

    // Step 3: Generate analysis report
    const summary = this.generateSummary(patterns);
    const performance = this.analyzePerformance(patterns, queries);

    return {
      timestamp: new Date().toISOString(),
      tool: 'db-usage-scanner',
      patterns,
      queries,
      summary,
      performance
    };
  }

  private async loadSchemaInfo(): Promise<void> {
    const schemaFiles = await glob('packages/db/src/schema.ts', { cwd: this.rootDir });

    for (const schemaFile of schemaFiles) {
      const content = await readFile(join(this.rootDir, schemaFile), 'utf-8');

      // Extract table names
      const tableMatches = content.matchAll(/export const (\w+) = pgTable\('(\w+)'/g);
      for (const match of tableMatches) {
        this.knownTables.add(match[1]);
      }

      // Extract column information (simplified)
      const sourceFile = ts.createSourceFile(
        schemaFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      this.extractSchemaDetails(sourceFile);
    }
  }

  private extractSchemaDetails(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) &&
          node.name && ts.isIdentifier(node.name) &&
          node.initializer && ts.isCallExpression(node.initializer)) {

        const tableName = node.name.text;
        const callExpr = node.initializer;

        if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'pgTable') {
          const tableSchema = callExpr.arguments[1];

          if (tableSchema && ts.isObjectLiteralExpression(tableSchema)) {
            const columns: string[] = [];

            for (const property of tableSchema.properties) {
              if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
                columns.push(property.name.text);
              }
            }

            this.knownColumns.set(tableName, columns);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private analyzeFileWithAST(sourceFile: ts.SourceFile, filePath: string): DatabaseUsagePattern[] {
    const patterns: DatabaseUsagePattern[] = [];

    const visit = (node: ts.Node) => {
      // Analyze method call expressions
      if (ts.isCallExpression(node)) {
        const pattern = this.analyzeCallExpression(node, sourceFile, filePath);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      // Analyze property access expressions
      if (ts.isPropertyAccessExpression(node)) {
        const pattern = this.analyzePropertyAccess(node, sourceFile, filePath);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      // Analyze identifier references
      if (ts.isIdentifier(node)) {
        const pattern = this.analyzeIdentifierReference(node, sourceFile, filePath);
        if (pattern) {
          patterns.push(pattern);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return patterns;
  }

  private analyzeCallExpression(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    filePath: string
  ): DatabaseUsagePattern | null {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      const usageType = this.mapMethodToUsageType(methodName);

      if (usageType) {
        // Try to identify the table/element being used
        const element = this.extractElementFromCallChain(node);

        if (element && this.isKnownElement(element)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.pos);
          const context = this.extractContext(node, sourceFile);

          return {
            element,
            elementType: this.determineElementType(element),
            usageType,
            file: filePath,
            line: position.line + 1,
            column: position.character + 1,
            context,
            queryComplexity: this.assessQueryComplexity(node, sourceFile),
            isDynamic: this.isDynamicQuery(node, sourceFile),
            confidence: this.calculateConfidence(node, sourceFile),
            performance: this.analyzePerformanceImplications(node, element)
          };
        }
      }
    }

    return null;
  }

  private analyzePropertyAccess(
    node: ts.PropertyAccessExpression,
    sourceFile: ts.SourceFile,
    filePath: string
  ): DatabaseUsagePattern | null {
    const propertyName = node.name.text;

    // Check if this is a table or column reference
    if (this.isKnownElement(propertyName)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.pos);
      const context = this.extractContext(node, sourceFile);

      return {
        element: propertyName,
        elementType: this.determineElementType(propertyName),
        usageType: 'reference',
        file: filePath,
        line: position.line + 1,
        column: position.character + 1,
        context,
        queryComplexity: 'simple',
        isDynamic: false,
        confidence: 'medium',
        performance: this.analyzePerformanceImplications(node, propertyName)
      };
    }

    return null;
  }

  private analyzeIdentifierReference(
    node: ts.Identifier,
    sourceFile: ts.SourceFile,
    filePath: string
  ): DatabaseUsagePattern | null {
    const identifier = node.text;

    if (this.isKnownElement(identifier)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.pos);
      const context = this.extractContext(node, sourceFile);

      return {
        element: identifier,
        elementType: this.determineElementType(identifier),
        usageType: 'reference',
        file: filePath,
        line: position.line + 1,
        column: position.character + 1,
        context,
        queryComplexity: 'simple',
        isDynamic: false,
        confidence: this.calculateConfidence(node, sourceFile),
        performance: this.analyzePerformanceImplications(node, identifier)
      };
    }

    return null;
  }

  private analyzeQueriesWithRegex(content: string, filePath: string): QueryAnalysis[] {
    const queries: QueryAnalysis[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Look for SQL-like patterns
      for (const [type, pattern] of Object.entries(this.queryPatterns.raw)) {
        if (pattern.test(line)) {
          const query = this.parseQueryFromLine(line, type as any);
          if (query) {
            queries.push({
              ...query,
              type: type as any
            });
          }
        }
      }
    });

    return queries;
  }

  private parseQueryFromLine(line: string, type: string): Partial<QueryAnalysis> | null {
    // This is a simplified parser - in a real implementation,
    // you'd want a proper SQL parser
    const tables: string[] = [];
    const columns: string[] = [];

    // Extract table names
    const tableMatches = line.match(/\b(\w+)\s*\./g);
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableName = match.replace('.', '');
        if (this.knownTables.has(tableName)) {
          tables.push(tableName);
        }
      });
    }

    // Extract column references
    for (const [tableName, cols] of this.knownColumns.entries()) {
      for (const col of cols) {
        if (line.includes(col)) {
          columns.push(`${tableName}.${col}`);
        }
      }
    }

    if (tables.length > 0 || columns.length > 0) {
      return {
        tables,
        columns,
        joins: [],
        whereConditions: [],
        orderBy: [],
        groupBy: [],
        having: [],
        subqueries: 0,
        complexity: this.calculateQueryComplexity(line),
        estimatedRows: 100, // Placeholder
        indexHints: []
      };
    }

    return null;
  }

  private mapMethodToUsageType(methodName: string): DatabaseUsagePattern['usageType'] | null {
    const mapping: Record<string, DatabaseUsagePattern['usageType']> = {
      'select': 'select',
      'insert': 'insert',
      'update': 'update',
      'delete': 'delete',
      'from': 'reference',
      'where': 'where',
      'join': 'join',
      'leftJoin': 'join',
      'rightJoin': 'join',
      'innerJoin': 'join',
      'orderBy': 'orderby'
    };

    return mapping[methodName] || null;
  }

  private extractElementFromCallChain(node: ts.CallExpression): string | null {
    let current: ts.Expression = node.expression;

    while (ts.isPropertyAccessExpression(current)) {
      if (ts.isIdentifier(current.expression)) {
        const identifier = current.expression.text;
        if (this.isKnownElement(identifier)) {
          return identifier;
        }
      }
      current = current.expression;
    }

    return null;
  }

  private isKnownElement(element: string): boolean {
    if (this.knownTables.has(element)) return true;
    if (this.knownIndexes.has(element)) return true;

    // Check if it's a column
    for (const columns of this.knownColumns.values()) {
      if (columns.includes(element)) return true;
    }

    return false;
  }

  private determineElementType(element: string): 'table' | 'column' | 'index' | 'enum' {
    if (this.knownTables.has(element)) return 'table';
    if (this.knownIndexes.has(element)) return 'index';

    for (const columns of this.knownColumns.values()) {
      if (columns.includes(element)) return 'column';
    }

    return 'enum'; // Fallback
  }

  private extractContext(node: ts.Node, sourceFile: ts.SourceFile): string {
    let parent = node.parent;
    let depth = 0;

    while (parent && depth < 2) {
      if (ts.isCallExpression(parent) || ts.isMethodDeclaration(parent)) {
        return parent.getFullText(sourceFile).trim().slice(0, 150);
      }
      parent = parent.parent;
      depth++;
    }

    return node.getFullText(sourceFile).trim().slice(0, 100);
  }

  private assessQueryComplexity(node: ts.Node, sourceFile: ts.SourceFile): 'simple' | 'medium' | 'complex' {
    let complexity = 0;
    let current = node;

    // Count method chains
    while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      complexity++;
      current = current.expression.expression;
    }

    if (complexity <= 2) return 'simple';
    if (complexity <= 5) return 'medium';
    return 'complex';
  }

  private isDynamicQuery(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    // Look for template literals, variable interpolation, or conditional logic
    const text = node.getFullText(sourceFile);
    return text.includes('${') || text.includes('concat') || text.includes('?');
  }

  private calculateConfidence(node: ts.Node, sourceFile: ts.SourceFile): 'high' | 'medium' | 'low' {
    let parent = node.parent;

    // High confidence for direct ORM calls
    while (parent) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        const methodName = parent.expression.name.text;
        if (['select', 'insert', 'update', 'delete'].includes(methodName)) {
          return 'high';
        }
      }
      parent = parent.parent;
    }

    // Medium confidence for property access
    if (ts.isPropertyAccessExpression(node.parent)) {
      return 'medium';
    }

    return 'low';
  }

  private analyzePerformanceImplications(node: ts.Node, element: string): DatabaseUsagePattern['performance'] {
    return {
      indexUsed: false, // Would need actual query execution plan
      estimatedCost: 100, // Placeholder
      recommendedOptimization: undefined
    };
  }

  private calculateQueryComplexity(query: string): number {
    let complexity = 1;

    if (query.includes('JOIN')) complexity += 2;
    if (query.includes('WHERE')) complexity += 1;
    if (query.includes('ORDER BY')) complexity += 1;
    if (query.includes('GROUP BY')) complexity += 2;
    if (query.includes('HAVING')) complexity += 2;
    if (query.includes('UNION')) complexity += 3;

    return complexity;
  }

  private generateSummary(patterns: DatabaseUsagePattern[]): DatabaseUsageReport['summary'] {
    const totalUsages = patterns.length;
    const highConfidenceUsages = patterns.filter(p => p.confidence === 'high').length;
    const dynamicQueries = patterns.filter(p => p.isDynamic).length;

    // Find unused elements
    const usedTables = new Set(patterns
      .filter(p => p.elementType === 'table')
      .map(p => p.element));

    const usedColumns = new Set(patterns
      .filter(p => p.elementType === 'column')
      .map(p => p.element));

    const unusedTables = Array.from(this.knownTables).filter(t => !usedTables.has(t));
    const unusedColumns: string[] = [];

    for (const [table, columns] of this.knownColumns.entries()) {
      for (const column of columns) {
        if (!usedColumns.has(column)) {
          unusedColumns.push(`${table}.${column}`);
        }
      }
    }

    const potentialOptimizations = [
      ...dynamicQueries > 0 ? ['Consider query parameterization for dynamic queries'] : [],
      ...unusedTables.length > 0 ? [`${unusedTables.length} tables appear unused`] : [],
      ...unusedColumns.length > 0 ? [`${unusedColumns.length} columns appear unused`] : []
    ];

    return {
      totalUsages,
      highConfidenceUsages,
      dynamicQueries,
      potentialOptimizations,
      unusedElements: {
        tables: unusedTables,
        columns: unusedColumns,
        indexes: Array.from(this.knownIndexes) // Simplified
      }
    };
  }

  private analyzePerformance(
    patterns: DatabaseUsagePattern[],
    queries: QueryAnalysis[]
  ): DatabaseUsageReport['performance'] {
    const slowQueryPatterns = queries
      .filter(q => q.complexity > 5)
      .map(q => `Complex query with ${q.tables.length} tables and ${q.subqueries} subqueries`);

    const optimizationOpportunities = [
      {
        type: 'index_optimization',
        description: 'Add indexes for frequently filtered columns',
        impact: 'high' as const,
        effort: 'low' as const
      },
      {
        type: 'query_optimization',
        description: 'Optimize complex queries with many joins',
        impact: 'medium' as const,
        effort: 'medium' as const
      }
    ];

    return {
      slowQueryPatterns,
      missingIndexes: [], // Would need actual execution plan analysis
      redundantIndexes: [], // Would need actual index usage statistics
      optimizationOpportunities
    };
  }

  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.sourcePatterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)];
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const scanner = new DatabaseUsageScanner(rootDir);

    try {
      const result = await scanner.scan();

      console.log('\n📊 Database Usage Analysis Results:');
      console.log(`Total usages found: ${result.summary.totalUsages}`);
      console.log(`High confidence usages: ${result.summary.highConfidenceUsages}`);
      console.log(`Dynamic queries: ${result.summary.dynamicQueries}`);
      console.log(`Unused tables: ${result.summary.unusedElements.tables.length}`);
      console.log(`Unused columns: ${result.summary.unusedElements.columns.length}`);

      if (result.summary.potentialOptimizations.length > 0) {
        console.log('\n💡 Optimization Opportunities:');
        result.summary.potentialOptimizations.forEach(opt => {
          console.log(`  - ${opt}`);
        });
      }

      if (result.performance.optimizationOpportunities.length > 0) {
        console.log('\n🚀 Performance Recommendations:');
        result.performance.optimizationOpportunities.forEach(rec => {
          console.log(`  - ${rec.description} (Impact: ${rec.impact}, Effort: ${rec.effort})`);
        });
      }

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Database usage scanning failed:', error);
      process.exit(1);
    }
  }

  main();
}