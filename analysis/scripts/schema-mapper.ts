import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface SchemaElement {
  name: string;
  type: 'table' | 'column' | 'index' | 'constraint' | 'enum';
  definition: string;
  dependencies: string[];
  usage: UsageInfo[];
  metadata: {
    tableName?: string;
    dataType?: string;
    isNullable?: boolean;
    defaultValue?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    enumValues?: string[];
  };
}

interface UsageInfo {
  file: string;
  line: number;
  column: number;
  type: 'select' | 'insert' | 'update' | 'delete' | 'join' | 'where' | 'orderby' | 'reference' | 'import';
  context: string;
  frequency: number;
  confidence: 'high' | 'medium' | 'low';
}

interface DatabaseMapping {
  timestamp: string;
  tool: 'schema-mapper';
  tables: Map<string, SchemaElement>;
  columns: Map<string, SchemaElement>;
  indexes: Map<string, SchemaElement>;
  enums: Map<string, SchemaElement>;
  usage: Map<string, UsageInfo[]>;
  unused: {
    tables: string[];
    columns: string[];
    indexes: string[];
    enums: string[];
  };
  analysis: {
    totalElements: number;
    usedElements: number;
    usageConfidence: number;
    driftIndicators: string[];
  };
}

export class SchemaMapper {
  private rootDir: string;
  private sourceFileProgram: ts.Program;
  private typeChecker: ts.TypeChecker;

  // Path patterns for different parts of the codebase
  private schemaPatterns: string[] = [
    'packages/db/src/schema.ts',
    'packages/db/src/schema/**/*.ts'
  ];

  private sourcePatterns: string[] = [
    'apps/web/src/**/*.{ts,tsx}',
    'packages/api/src/**/*.ts',
    'packages/lib/src/**/*.ts',
    'packages/worker/src/**/*.ts'
  ];

  constructor(rootDir: string) {
    this.rootDir = rootDir;

    // Initialize TypeScript program for AST analysis
    const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath!, ts.sys.readFile);
    const compilerOptions = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      rootDir
    );

    this.sourceFileProgram = ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
    this.typeChecker = this.sourceFileProgram.getTypeChecker();
  }

  async analyze(): Promise<DatabaseMapping> {
    console.log('🔍 Building comprehensive schema-to-code mapping...');

    const tables = new Map<string, SchemaElement>();
    const columns = new Map<string, SchemaElement>();
    const indexes = new Map<string, SchemaElement>();
    const enums = new Map<string, SchemaElement>();
    const usage = new Map<string, UsageInfo[]>();

    // Step 1: Extract schema elements using Drizzle introspection
    await this.extractSchemaElements(tables, columns, indexes, enums);

    // Step 2: Analyze code usage with AST parsing
    await this.analyzeCodeUsage(tables, columns, indexes, enums, usage);

    // Step 3: Calculate unused elements
    const unused = this.calculateUnusedElements(tables, columns, indexes, enums);

    // Step 4: Generate analysis metadata
    const analysis = this.generateAnalysis(tables, columns, indexes, enums, usage);

    return {
      timestamp: new Date().toISOString(),
      tool: 'schema-mapper',
      tables,
      columns,
      indexes,
      enums,
      usage,
      unused,
      analysis
    };
  }

  private async extractSchemaElements(
    tables: Map<string, SchemaElement>,
    columns: Map<string, SchemaElement>,
    indexes: Map<string, SchemaElement>,
    enums: Map<string, SchemaElement>
  ): Promise<void> {
    const schemaFiles = await this.findSchemaFiles();

    for (const schemaFile of schemaFiles) {
      const content = await readFile(join(this.rootDir, schemaFile), 'utf-8');
      const sourceFile = ts.createSourceFile(
        schemaFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Extract tables
      this.extractTablesFromAST(sourceFile, tables, columns);

      // Extract enums
      this.extractEnumsFromAST(sourceFile, enums);

      // Extract indexes
      this.extractIndexesFromAST(sourceFile, indexes);
    }
  }

  private extractTablesFromAST(
    sourceFile: ts.SourceFile,
    tables: Map<string, SchemaElement>,
    columns: Map<string, SchemaElement>
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const tableName = node.name.text;

        if (node.initializer && ts.isCallExpression(node.initializer)) {
          const callExpr = node.initializer;

          // Check if this is a pgTable call
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'pgTable') {
            const tableDbName = this.extractStringLiteral(callExpr.arguments[0]);
            const tableSchema = callExpr.arguments[1];

            tables.set(tableName, {
              name: tableName,
              type: 'table',
              definition: node.getFullText(sourceFile).trim(),
              dependencies: [],
              usage: [],
              metadata: {
                tableName: tableDbName
              }
            });

            // Extract columns from table schema
            if (tableSchema && ts.isObjectLiteralExpression(tableSchema)) {
              this.extractColumnsFromTableSchema(tableSchema, tableName, columns, sourceFile);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractColumnsFromTableSchema(
    schema: ts.ObjectLiteralExpression,
    tableName: string,
    columns: Map<string, SchemaElement>,
    sourceFile: ts.SourceFile
  ): void {
    for (const property of schema.properties) {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        const columnName = property.name.text;
        const columnKey = `${tableName}.${columnName}`;

        let dataType = 'unknown';
        let isNullable = true;
        let isPrimaryKey = false;
        let isForeignKey = false;
        let defaultValue: string | undefined;

        // Analyze column definition
        if (ts.isCallExpression(property.initializer)) {
          const columnDef = this.analyzeColumnDefinition(property.initializer);
          dataType = columnDef.dataType;
          isNullable = columnDef.isNullable;
          isPrimaryKey = columnDef.isPrimaryKey;
          isForeignKey = columnDef.isForeignKey;
          defaultValue = columnDef.defaultValue;
        }

        columns.set(columnKey, {
          name: columnName,
          type: 'column',
          definition: property.getFullText(sourceFile).trim(),
          dependencies: isForeignKey ? ['foreign_key'] : [],
          usage: [],
          metadata: {
            tableName,
            dataType,
            isNullable,
            defaultValue,
            isPrimaryKey,
            isForeignKey
          }
        });
      }
    }
  }

  private analyzeColumnDefinition(callExpr: ts.CallExpression): {
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    defaultValue?: string;
  } {
    let dataType = 'unknown';
    let isNullable = true;
    let isPrimaryKey = false;
    let isForeignKey = false;
    let defaultValue: string | undefined;

    // Get the base type from the function name
    if (ts.isIdentifier(callExpr.expression)) {
      dataType = callExpr.expression.text;
    }

    // Check for method chaining for constraints
    let current: ts.Expression = callExpr;
    while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const methodName = current.expression.name.text;

      switch (methodName) {
        case 'notNull':
          isNullable = false;
          break;
        case 'primaryKey':
          isPrimaryKey = true;
          isNullable = false;
          break;
        case 'default':
        case 'defaultNow':
        case 'defaultRandom':
          defaultValue = methodName;
          break;
        case 'references':
          isForeignKey = true;
          break;
      }

      current = current.expression.expression;
    }

    return {
      dataType,
      isNullable,
      isPrimaryKey,
      isForeignKey,
      defaultValue
    };
  }

  private extractEnumsFromAST(
    sourceFile: ts.SourceFile,
    enums: Map<string, SchemaElement>
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const enumName = node.name.text;

        if (node.initializer && ts.isCallExpression(node.initializer)) {
          const callExpr = node.initializer;

          // Check if this is a pgEnum call
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'pgEnum') {
            const enumDbName = this.extractStringLiteral(callExpr.arguments[0]);
            const enumValues = this.extractArrayLiteral(callExpr.arguments[1]);

            enums.set(enumName, {
              name: enumName,
              type: 'enum',
              definition: node.getFullText(sourceFile).trim(),
              dependencies: [],
              usage: [],
              metadata: {
                enumValues
              }
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractIndexesFromAST(
    sourceFile: ts.SourceFile,
    indexes: Map<string, SchemaElement>
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callExpr = node;

        // Check for index() or uniqueIndex() calls
        if (ts.isIdentifier(callExpr.expression) &&
            (callExpr.expression.text === 'index' || callExpr.expression.text === 'uniqueIndex')) {

          const indexName = this.extractStringLiteral(callExpr.arguments[0]);
          if (indexName) {
            indexes.set(indexName, {
              name: indexName,
              type: 'index',
              definition: node.getFullText(sourceFile).trim(),
              dependencies: [],
              usage: [],
              metadata: {}
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private async analyzeCodeUsage(
    tables: Map<string, SchemaElement>,
    columns: Map<string, SchemaElement>,
    indexes: Map<string, SchemaElement>,
    enums: Map<string, SchemaElement>,
    usage: Map<string, UsageInfo[]>
  ): Promise<void> {
    const sourceFiles = await this.findSourceFiles();

    for (const sourceFile of sourceFiles) {
      const content = await readFile(join(this.rootDir, sourceFile), 'utf-8');
      const tsSourceFile = ts.createSourceFile(
        sourceFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Analyze usage for each schema element type
      this.analyzeElementUsage(tsSourceFile, tables, usage, sourceFile);
      this.analyzeElementUsage(tsSourceFile, columns, usage, sourceFile);
      this.analyzeElementUsage(tsSourceFile, indexes, usage, sourceFile);
      this.analyzeElementUsage(tsSourceFile, enums, usage, sourceFile);
    }
  }

  private analyzeElementUsage(
    sourceFile: ts.SourceFile,
    elements: Map<string, SchemaElement>,
    usage: Map<string, UsageInfo[]>,
    filePath: string
  ): void {
    const visit = (node: ts.Node) => {
      // Check for identifier references
      if (ts.isIdentifier(node)) {
        const identifier = node.text;

        // Check if this identifier matches any of our schema elements
        for (const [elementKey, element] of elements.entries()) {
          const elementName = element.type === 'column' ? element.name : elementKey;

          if (identifier === elementName || identifier === elementKey) {
            const usageType = this.determineUsageType(node, sourceFile);
            const context = this.extractUsageContext(node, sourceFile);
            const confidence = this.calculateUsageConfidence(node, sourceFile, element);

            const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
            const column = sourceFile.getLineAndCharacterOfPosition(node.pos).character + 1;

            const usageInfo: UsageInfo = {
              file: filePath,
              line,
              column,
              type: usageType,
              context,
              frequency: 1,
              confidence
            };

            if (!usage.has(elementKey)) {
              usage.set(elementKey, []);
            }
            usage.get(elementKey)!.push(usageInfo);

            // Update the element's usage array
            element.usage.push(usageInfo);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private determineUsageType(node: ts.Node, sourceFile: ts.SourceFile): UsageInfo['type'] {
    let parent = node.parent;

    // Walk up the AST to determine context
    while (parent) {
      if (ts.isCallExpression(parent)) {
        const callExpr = parent;
        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const methodName = callExpr.expression.name.text;

          switch (methodName) {
            case 'select':
            case 'findFirst':
            case 'findMany':
              return 'select';
            case 'insert':
            case 'create':
              return 'insert';
            case 'update':
              return 'update';
            case 'delete':
              return 'delete';
            case 'where':
              return 'where';
            case 'orderBy':
              return 'orderby';
            case 'join':
            case 'leftJoin':
            case 'rightJoin':
            case 'innerJoin':
              return 'join';
          }
        }
      }

      if (ts.isImportDeclaration(parent)) {
        return 'import';
      }

      parent = parent.parent;
    }

    return 'reference';
  }

  private extractUsageContext(node: ts.Node, sourceFile: ts.SourceFile): string {
    let parent = node.parent;
    let depth = 0;

    // Get meaningful context (up to 3 levels up)
    while (parent && depth < 3) {
      if (ts.isCallExpression(parent) || ts.isPropertyAccessExpression(parent)) {
        return parent.getFullText(sourceFile).trim().slice(0, 100);
      }
      parent = parent.parent;
      depth++;
    }

    return node.getFullText(sourceFile).trim().slice(0, 50);
  }

  private calculateUsageConfidence(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    element: SchemaElement
  ): 'high' | 'medium' | 'low' {
    let parent = node.parent;

    // High confidence: Direct database operations
    while (parent) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        const methodName = parent.expression.name.text;
        if (['select', 'insert', 'update', 'delete', 'from'].includes(methodName)) {
          return 'high';
        }
      }
      parent = parent.parent;
    }

    // Medium confidence: Property access or type references
    if (ts.isPropertyAccessExpression(node.parent) || ts.isImportDeclaration(node.parent)) {
      return 'medium';
    }

    // Low confidence: String literals or comments
    return 'low';
  }

  private calculateUnusedElements(
    tables: Map<string, SchemaElement>,
    columns: Map<string, SchemaElement>,
    indexes: Map<string, SchemaElement>,
    enums: Map<string, SchemaElement>
  ): {
    tables: string[];
    columns: string[];
    indexes: string[];
    enums: string[];
  } {
    return {
      tables: Array.from(tables.keys()).filter(key => tables.get(key)!.usage.length === 0),
      columns: Array.from(columns.keys()).filter(key => columns.get(key)!.usage.length === 0),
      indexes: Array.from(indexes.keys()).filter(key => indexes.get(key)!.usage.length === 0),
      enums: Array.from(enums.keys()).filter(key => enums.get(key)!.usage.length === 0)
    };
  }

  private generateAnalysis(
    tables: Map<string, SchemaElement>,
    columns: Map<string, SchemaElement>,
    indexes: Map<string, SchemaElement>,
    enums: Map<string, SchemaElement>,
    usage: Map<string, UsageInfo[]>
  ): DatabaseMapping['analysis'] {
    const totalElements = tables.size + columns.size + indexes.size + enums.size;
    const usedElements = Array.from([...tables.values(), ...columns.values(), ...indexes.values(), ...enums.values()])
      .filter(element => element.usage.length > 0).length;

    // Calculate average confidence
    const allUsage = Array.from(usage.values()).flat();
    const confidenceScore = allUsage.length > 0
      ? allUsage.reduce((sum, u) => sum + (u.confidence === 'high' ? 1 : u.confidence === 'medium' ? 0.6 : 0.3), 0) / allUsage.length
      : 0;

    // Detect drift indicators
    const driftIndicators: string[] = [];

    // Check for tables with no high-confidence usage
    const lowUsageTables = Array.from(tables.values())
      .filter(table => !table.usage.some(u => u.confidence === 'high'));
    if (lowUsageTables.length > 0) {
      driftIndicators.push(`${lowUsageTables.length} tables have no high-confidence usage`);
    }

    // Check for unused indexes
    const unusedIndexes = Array.from(indexes.values()).filter(index => index.usage.length === 0);
    if (unusedIndexes.length > 0) {
      driftIndicators.push(`${unusedIndexes.length} indexes appear unused`);
    }

    return {
      totalElements,
      usedElements,
      usageConfidence: confidenceScore,
      driftIndicators
    };
  }

  private async findSchemaFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.schemaPatterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.sourcePatterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private extractStringLiteral(node: ts.Node | undefined): string | undefined {
    if (node && ts.isStringLiteral(node)) {
      return node.text;
    }
    return undefined;
  }

  private extractArrayLiteral(node: ts.Node | undefined): string[] {
    if (node && ts.isArrayLiteralExpression(node)) {
      return node.elements
        .filter(ts.isStringLiteral)
        .map(element => element.text);
    }
    return [];
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const mapper = new SchemaMapper(rootDir);

    try {
      const result = await mapper.analyze();

      console.log('\n📊 Schema-to-Code Mapping Results:');
      console.log(`Total elements: ${result.analysis.totalElements}`);
      console.log(`Used elements: ${result.analysis.usedElements}`);
      console.log(`Usage confidence: ${(result.analysis.usageConfidence * 100).toFixed(1)}%`);
      console.log(`Unused tables: ${result.unused.tables.length}`);
      console.log(`Unused columns: ${result.unused.columns.length}`);
      console.log(`Unused indexes: ${result.unused.indexes.length}`);
      console.log(`Unused enums: ${result.unused.enums.length}`);

      if (result.analysis.driftIndicators.length > 0) {
        console.log('\n⚠️  Drift Indicators:');
        result.analysis.driftIndicators.forEach(indicator => {
          console.log(`  - ${indicator}`);
        });
      }

      // Convert Maps to Objects for JSON serialization
      const serializable = {
        ...result,
        tables: Object.fromEntries(result.tables),
        columns: Object.fromEntries(result.columns),
        indexes: Object.fromEntries(result.indexes),
        enums: Object.fromEntries(result.enums),
        usage: Object.fromEntries(result.usage)
      };

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(serializable, null, 2));

    } catch (error) {
      console.error('Schema mapping failed:', error);
      process.exit(1);
    }
  }

  main();
}