import * as ts from 'typescript';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface ASTAnalysisOptions {
  includeComments?: boolean;
  trackTypeReferences?: boolean;
  analyzeImports?: boolean;
  detectDynamicQueries?: boolean;
}

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface CodeReference {
  identifier: string;
  type: 'variable' | 'function' | 'property' | 'type' | 'import' | 'export';
  location: CodeLocation;
  context: string;
  scope: 'global' | 'module' | 'function' | 'block';
  confidence: 'high' | 'medium' | 'low';
}

export interface QueryPattern {
  type: 'drizzle' | 'raw_sql' | 'dynamic';
  operation: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
  tables: string[];
  columns: string[];
  conditions: string[];
  joins: string[];
  location: CodeLocation;
  complexity: number;
  isDynamic: boolean;
  rawQuery?: string;
}

export interface ImportAnalysis {
  module: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  location: CodeLocation;
  isDynamicImport: boolean;
}

export interface TypeReference {
  typeName: string;
  location: CodeLocation;
  isGeneric: boolean;
  genericArgs?: string[];
  module?: string;
}

export class ASTParser {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;
  private sourceFiles: Map<string, ts.SourceFile>;

  constructor(rootDir: string, compilerOptions?: ts.CompilerOptions) {
    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      allowJs: true,
      strict: false,
      skipLibCheck: true,
      ...compilerOptions
    };

    // Find tsconfig.json or use default options
    const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        rootDir
      );
      this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    } else {
      this.program = ts.createProgram([], defaultOptions);
    }

    this.typeChecker = this.program.getTypeChecker();
    this.sourceFiles = new Map();
  }

  async loadSourceFile(filePath: string): Promise<ts.SourceFile> {
    if (this.sourceFiles.has(filePath)) {
      return this.sourceFiles.get(filePath)!;
    }

    const content = await readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    this.sourceFiles.set(filePath, sourceFile);
    return sourceFile;
  }

  findCodeReferences(
    sourceFile: ts.SourceFile,
    searchTerms: string[],
    options: ASTAnalysisOptions = {}
  ): CodeReference[] {
    const references: CodeReference[] = [];
    const searchSet = new Set(searchTerms);

    const visit = (node: ts.Node) => {
      // Check identifiers
      if (ts.isIdentifier(node) && searchSet.has(node.text)) {
        const location = this.getNodeLocation(node, sourceFile);
        const context = this.extractContext(node, sourceFile);
        const scope = this.determineScope(node);
        const type = this.determineReferenceType(node);
        const confidence = this.calculateReferenceConfidence(node, sourceFile);

        references.push({
          identifier: node.text,
          type,
          location,
          context,
          scope,
          confidence
        });
      }

      // Check property access
      if (ts.isPropertyAccessExpression(node) && searchSet.has(node.name.text)) {
        const location = this.getNodeLocation(node, sourceFile);
        const context = this.extractContext(node, sourceFile);
        const scope = this.determineScope(node);
        const confidence = this.calculateReferenceConfidence(node, sourceFile);

        references.push({
          identifier: node.name.text,
          type: 'property',
          location,
          context,
          scope,
          confidence
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return references;
  }

  findQueryPatterns(sourceFile: ts.SourceFile, filePath: string): QueryPattern[] {
    const patterns: QueryPattern[] = [];

    const visit = (node: ts.Node) => {
      // Detect Drizzle ORM patterns
      if (ts.isCallExpression(node)) {
        const drizzlePattern = this.analyzeDrizzleQuery(node, sourceFile, filePath);
        if (drizzlePattern) {
          patterns.push(drizzlePattern);
        }
      }

      // Detect raw SQL patterns
      if (ts.isStringLiteral(node) || ts.isTemplateExpression(node)) {
        const sqlPattern = this.analyzeRawSQL(node, sourceFile, filePath);
        if (sqlPattern) {
          patterns.push(sqlPattern);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return patterns;
  }

  analyzeImports(sourceFile: ts.SourceFile): ImportAnalysis[] {
    const imports: ImportAnalysis[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const location = this.getNodeLocation(node, sourceFile);
          const specifiers: ImportAnalysis['specifiers'] = [];

          if (node.importClause) {
            // Default import
            if (node.importClause.name) {
              specifiers.push({
                name: node.importClause.name.text,
                isDefault: true,
                isNamespace: false
              });
            }

            // Named imports
            if (node.importClause.namedBindings) {
              if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                specifiers.push({
                  name: node.importClause.namedBindings.name.text,
                  isDefault: false,
                  isNamespace: true
                });
              } else if (ts.isNamedImports(node.importClause.namedBindings)) {
                for (const element of node.importClause.namedBindings.elements) {
                  specifiers.push({
                    name: element.name.text,
                    alias: element.propertyName?.text,
                    isDefault: false,
                    isNamespace: false
                  });
                }
              }
            }
          }

          imports.push({
            module: moduleSpecifier.text,
            specifiers,
            location,
            isDynamicImport: false
          });
        }
      }

      // Dynamic imports
      if (ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const location = this.getNodeLocation(node, sourceFile);
        const moduleArg = node.arguments[0];

        if (ts.isStringLiteral(moduleArg)) {
          imports.push({
            module: moduleArg.text,
            specifiers: [],
            location,
            isDynamicImport: true
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  findTypeReferences(sourceFile: ts.SourceFile, typeNames: string[]): TypeReference[] {
    const references: TypeReference[] = [];
    const typeSet = new Set(typeNames);

    const visit = (node: ts.Node) => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const typeName = node.typeName.text;

        if (typeSet.has(typeName)) {
          const location = this.getNodeLocation(node, sourceFile);
          const isGeneric = !!node.typeArguments && node.typeArguments.length > 0;
          const genericArgs = isGeneric
            ? node.typeArguments!.map(arg => arg.getFullText(sourceFile).trim())
            : undefined;

          references.push({
            typeName,
            location,
            isGeneric,
            genericArgs
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return references;
  }

  private analyzeDrizzleQuery(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    filePath: string
  ): QueryPattern | null {
    if (!ts.isPropertyAccessExpression(node.expression)) {
      return null;
    }

    const methodName = node.expression.name.text;
    const drizzleMethods = ['select', 'insert', 'update', 'delete', 'from', 'where', 'join'];

    if (!drizzleMethods.includes(methodName)) {
      return null;
    }

    const location = this.getNodeLocation(node, sourceFile);
    const tables = this.extractTablesFromDrizzleQuery(node, sourceFile);
    const columns = this.extractColumnsFromDrizzleQuery(node, sourceFile);
    const conditions = this.extractConditionsFromDrizzleQuery(node, sourceFile);
    const joins = this.extractJoinsFromDrizzleQuery(node, sourceFile);
    const complexity = this.calculateQueryComplexity(node, sourceFile);
    const isDynamic = this.isDynamicQuery(node, sourceFile);

    return {
      type: 'drizzle',
      operation: this.mapMethodToOperation(methodName),
      tables,
      columns,
      conditions,
      joins,
      location,
      complexity,
      isDynamic
    };
  }

  private analyzeRawSQL(
    node: ts.StringLiteral | ts.TemplateExpression,
    sourceFile: ts.SourceFile,
    filePath: string
  ): QueryPattern | null {
    const sqlText = ts.isStringLiteral(node) ? node.text : node.getFullText(sourceFile);

    // Simple SQL detection
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i;
    if (!sqlKeywords.test(sqlText)) {
      return null;
    }

    const location = this.getNodeLocation(node, sourceFile);
    const operation = this.extractSQLOperation(sqlText);
    const tables = this.extractTablesFromSQL(sqlText);
    const columns = this.extractColumnsFromSQL(sqlText);
    const isDynamic = ts.isTemplateExpression(node) || sqlText.includes('${') || sqlText.includes('?');

    return {
      type: 'raw_sql',
      operation,
      tables,
      columns,
      conditions: [],
      joins: [],
      location,
      complexity: this.calculateSQLComplexity(sqlText),
      isDynamic,
      rawQuery: sqlText
    };
  }

  private getNodeLocation(node: ts.Node, sourceFile: ts.SourceFile): CodeLocation {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      file: sourceFile.fileName,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1
    };
  }

  private extractContext(node: ts.Node, sourceFile: ts.SourceFile, maxLength: number = 150): string {
    let parent = node.parent;
    let depth = 0;

    while (parent && depth < 3) {
      if (ts.isCallExpression(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isFunctionDeclaration(parent) ||
          ts.isArrowFunction(parent)) {
        return parent.getFullText(sourceFile).trim().slice(0, maxLength);
      }
      parent = parent.parent;
      depth++;
    }

    return node.getFullText(sourceFile).trim().slice(0, maxLength);
  }

  private determineScope(node: ts.Node): CodeReference['scope'] {
    let parent = node.parent;

    while (parent) {
      if (ts.isFunctionDeclaration(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isArrowFunction(parent)) {
        return 'function';
      }

      if (ts.isBlock(parent)) {
        return 'block';
      }

      if (ts.isSourceFile(parent)) {
        return 'module';
      }

      parent = parent.parent;
    }

    return 'global';
  }

  private determineReferenceType(node: ts.Node): CodeReference['type'] {
    const parent = node.parent;

    if (ts.isCallExpression(parent) && parent.expression === node) {
      return 'function';
    }

    if (ts.isPropertyAccessExpression(parent)) {
      return 'property';
    }

    if (ts.isVariableDeclaration(parent) && parent.name === node) {
      return 'variable';
    }

    if (ts.isImportSpecifier(parent)) {
      return 'import';
    }

    if (ts.isExportSpecifier(parent)) {
      return 'export';
    }

    return 'variable';
  }

  private calculateReferenceConfidence(node: ts.Node, sourceFile: ts.SourceFile): 'high' | 'medium' | 'low' {
    // High confidence for direct usage in known patterns
    if (ts.isCallExpression(node.parent) || ts.isPropertyAccessExpression(node.parent)) {
      return 'high';
    }

    // Medium confidence for assignments and declarations
    if (ts.isVariableDeclaration(node.parent) || ts.isBinaryExpression(node.parent)) {
      return 'medium';
    }

    // Low confidence for comments or string literals
    const nodeText = node.getFullText(sourceFile);
    if (nodeText.includes('//') || nodeText.includes('/*')) {
      return 'low';
    }

    return 'medium';
  }

  private extractTablesFromDrizzleQuery(node: ts.CallExpression, sourceFile: ts.SourceFile): string[] {
    const tables: string[] = [];
    // Implementation would traverse the call chain to find table references
    // This is a simplified version
    return tables;
  }

  private extractColumnsFromDrizzleQuery(node: ts.CallExpression, sourceFile: ts.SourceFile): string[] {
    const columns: string[] = [];
    // Implementation would analyze select clauses and property access
    return columns;
  }

  private extractConditionsFromDrizzleQuery(node: ts.CallExpression, sourceFile: ts.SourceFile): string[] {
    const conditions: string[] = [];
    // Implementation would analyze where clauses
    return conditions;
  }

  private extractJoinsFromDrizzleQuery(node: ts.CallExpression, sourceFile: ts.SourceFile): string[] {
    const joins: string[] = [];
    // Implementation would analyze join clauses
    return joins;
  }

  private calculateQueryComplexity(node: ts.CallExpression, sourceFile: ts.SourceFile): number {
    let complexity = 1;
    let current = node;

    // Count chained method calls
    while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      complexity++;
      const expr = current.expression.expression;
      if (ts.isCallExpression(expr)) {
        current = expr;
      } else {
        break;
      }
    }

    return complexity;
  }

  private isDynamicQuery(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    const text = node.getFullText(sourceFile);
    return text.includes('${') || text.includes('concat') || text.includes('?') || text.includes('template');
  }

  private mapMethodToOperation(methodName: string): QueryPattern['operation'] {
    const mapping: Record<string, QueryPattern['operation']> = {
      'select': 'select',
      'insert': 'insert',
      'update': 'update',
      'delete': 'delete'
    };

    return mapping[methodName] || 'unknown';
  }

  private extractSQLOperation(sql: string): QueryPattern['operation'] {
    const upperSQL = sql.toUpperCase();

    if (upperSQL.includes('SELECT')) return 'select';
    if (upperSQL.includes('INSERT')) return 'insert';
    if (upperSQL.includes('UPDATE')) return 'update';
    if (upperSQL.includes('DELETE')) return 'delete';

    return 'unknown';
  }

  private extractTablesFromSQL(sql: string): string[] {
    const tables: string[] = [];

    // Simple regex-based extraction (would need proper SQL parser for production)
    const fromMatches = sql.match(/FROM\s+(\w+)/gi);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const table = match.replace(/FROM\s+/i, '').trim();
        tables.push(table);
      });
    }

    const joinMatches = sql.match(/JOIN\s+(\w+)/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const table = match.replace(/JOIN\s+/i, '').trim();
        tables.push(table);
      });
    }

    return [...new Set(tables)];
  }

  private extractColumnsFromSQL(sql: string): string[] {
    const columns: string[] = [];

    // Extract column names from SELECT clause (simplified)
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const columnPart = selectMatch[1];
      if (!columnPart.includes('*')) {
        const cols = columnPart.split(',').map(col => col.trim());
        columns.push(...cols);
      }
    }

    return columns;
  }

  private calculateSQLComplexity(sql: string): number {
    let complexity = 1;

    if (sql.includes('JOIN')) complexity += 2;
    if (sql.includes('WHERE')) complexity += 1;
    if (sql.includes('ORDER BY')) complexity += 1;
    if (sql.includes('GROUP BY')) complexity += 2;
    if (sql.includes('HAVING')) complexity += 2;
    if (sql.includes('UNION')) complexity += 3;
    if (sql.includes('SUBQUERY') || sql.includes('EXISTS')) complexity += 3;

    return complexity;
  }
}

export default ASTParser;