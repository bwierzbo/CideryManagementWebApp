#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

interface DatabaseEntity {
  name: string;
  type: 'table' | 'enum' | 'relation' | 'index';
  file: string;
  usages: EntityUsage[];
  columns?: string[];
  enumValues?: string[];
}

interface EntityUsage {
  file: string;
  line: number;
  context: 'query' | 'schema' | 'type' | 'import' | 'validation';
  snippet: string;
}

interface DatabaseAnalysis {
  entities: DatabaseEntity[];
  unusedEntities: DatabaseEntity[];
  potentiallyUnused: DatabaseEntity[];
  orphanedQueries: string[];
  schemaCodeDrift: SchemaDrift[];
  analysisDate: string;
  errors: string[];
}

interface SchemaDrift {
  entity: string;
  issue: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

class DatabaseScanner {
  private readonly rootDir: string;
  private readonly dbDir: string;
  private readonly apiDir: string;
  private readonly webDir: string;
  private entities = new Map<string, DatabaseEntity>();
  private errors: string[] = [];

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.dbDir = join(rootDir, 'packages/db');
    this.apiDir = join(rootDir, 'packages/api');
    this.webDir = join(rootDir, 'apps/web');
  }

  async scanDatabase(): Promise<DatabaseAnalysis> {
    console.log('🗄️ Starting database schema analysis...');

    try {
      // Parse database schema
      await this.parseSchema();

      // Scan for usage across codebase
      await this.scanUsages();

      // Analyze schema-code drift
      const schemaDrift = await this.analyzeSchemaDrift();

      // Find orphaned queries
      const orphanedQueries = await this.findOrphanedQueries();

      return this.generateAnalysis(schemaDrift, orphanedQueries);
    } catch (error) {
      this.errors.push(`Database scanning failed: ${error}`);
      return this.generateAnalysis([], []);
    }
  }

  private async parseSchema(): Promise<void> {
    console.log('📋 Parsing database schema...');

    const schemaFiles = await glob('src/schema*.ts', { cwd: this.dbDir, nodir: true });

    for (const file of schemaFiles) {
      await this.parseSchemaFile(join(this.dbDir, file), file);
    }
  }

  private async parseSchemaFile(filePath: string, relativePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      this.visitSchemaNode(sourceFile, relativePath);
    } catch (error) {
      this.errors.push(`Failed to parse schema file ${relativePath}: ${error}`);
    }
  }

  private visitSchemaNode(node: ts.Node, file: string): void {
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;

      // Parse table definitions
      if (node.initializer && ts.isCallExpression(node.initializer)) {
        const expression = node.initializer.expression;

        if (ts.isIdentifier(expression)) {
          if (expression.text === 'pgTable') {
            this.parseTableDefinition(name, node.initializer, file);
          } else if (expression.text === 'pgEnum') {
            this.parseEnumDefinition(name, node.initializer, file);
          }
        }
      }

      // Parse relations
      if (name.endsWith('Relations') && node.initializer && ts.isCallExpression(node.initializer)) {
        this.parseRelationDefinition(name, node.initializer, file);
      }
    }

    ts.forEachChild(node, child => this.visitSchemaNode(child, file));
  }

  private parseTableDefinition(name: string, callExpr: ts.CallExpression, file: string): void {
    const columns: string[] = [];

    // Extract column definitions from the third argument (schema object)
    if (callExpr.arguments.length >= 3) {
      const schemaArg = callExpr.arguments[2];
      if (ts.isObjectLiteralExpression(schemaArg)) {
        for (const property of schemaArg.properties) {
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
            columns.push(property.name.text);
          }
        }
      }
    }

    this.entities.set(name, {
      name,
      type: 'table',
      file,
      usages: [],
      columns
    });
  }

  private parseEnumDefinition(name: string, callExpr: ts.CallExpression, file: string): void {
    const enumValues: string[] = [];

    // Extract enum values from the second argument
    if (callExpr.arguments.length >= 2) {
      const valuesArg = callExpr.arguments[1];
      if (ts.isArrayLiteralExpression(valuesArg)) {
        for (const element of valuesArg.elements) {
          if (ts.isStringLiteral(element)) {
            enumValues.push(element.text);
          }
        }
      }
    }

    this.entities.set(name, {
      name,
      type: 'enum',
      file,
      usages: [],
      enumValues
    });
  }

  private parseRelationDefinition(name: string, callExpr: ts.CallExpression, file: string): void {
    this.entities.set(name, {
      name,
      type: 'relation',
      file,
      usages: []
    });
  }

  private async scanUsages(): Promise<void> {
    console.log('🔍 Scanning for database entity usages...');

    // Scan API package
    await this.scanDirectoryForUsages(this.apiDir, 'api');

    // Scan web app
    await this.scanDirectoryForUsages(this.webDir, 'web');

    // Scan db package queries
    await this.scanDirectoryForUsages(join(this.dbDir, 'src/queries'), 'db-queries');
  }

  private async scanDirectoryForUsages(dir: string, context: string): Promise<void> {
    try {
      const files = await glob('**/*.{ts,tsx}', {
        cwd: dir,
        ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**'],
        nodir: true
      });

      for (const file of files) {
        await this.scanFileForUsages(join(dir, file), file, context);
      }
    } catch (error) {
      this.errors.push(`Failed to scan directory ${dir}: ${error}`);
    }
  }

  private async scanFileForUsages(filePath: string, relativePath: string, context: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for entity references
      for (const [entityName, entity] of this.entities) {
        const regex = new RegExp(`\\b${entityName}\\b`, 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const line = lines[lineNumber - 1] || '';

          // Determine usage context
          const usageContext = this.determineUsageContext(line, entityName);

          // Skip self-definitions
          if (relativePath === entity.file && usageContext === 'schema') {
            continue;
          }

          entity.usages.push({
            file: relativePath,
            line: lineNumber,
            context: usageContext,
            snippet: line.trim()
          });
        }
      }

      // Scan for Drizzle query patterns
      await this.scanForQueryPatterns(content, relativePath, lines);

    } catch (error) {
      this.errors.push(`Failed to scan file ${relativePath}: ${error}`);
    }
  }

  private determineUsageContext(line: string, entityName: string): EntityUsage['context'] {
    if (line.includes('import') || line.includes('from')) {
      return 'import';
    }
    if (line.includes('select') || line.includes('insert') || line.includes('update') || line.includes('delete')) {
      return 'query';
    }
    if (line.includes('z.') || line.includes('schema') || line.includes('validator')) {
      return 'validation';
    }
    if (line.includes('type') || line.includes('interface') || line.includes('typeof')) {
      return 'type';
    }
    return 'schema';
  }

  private async scanForQueryPatterns(content: string, relativePath: string, lines: string[]): Promise<void> {
    // Drizzle query patterns
    const queryPatterns = [
      /db\.select\(\)\.from\((\w+)\)/g,
      /db\.insert\((\w+)\)/g,
      /db\.update\((\w+)\)/g,
      /db\.delete\(\)\.from\((\w+)\)/g,
      /\.select\(\)\.from\((\w+)\)/g,
      /\.insert\((\w+)\)/g,
      /\.update\((\w+)\)/g,
      /\.delete\(\)\.from\((\w+)\)/g
    ];

    for (const pattern of queryPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const tableName = match[1];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1] || '';

        // Find the corresponding entity
        const entity = this.entities.get(tableName);
        if (entity) {
          entity.usages.push({
            file: relativePath,
            line: lineNumber,
            context: 'query',
            snippet: line.trim()
          });
        }
      }
    }
  }

  private async analyzeSchemaDrift(): Promise<SchemaDrift[]> {
    console.log('🔄 Analyzing schema-code drift...');

    const drift: SchemaDrift[] = [];

    for (const [name, entity] of this.entities) {
      // Check for tables with no queries
      if (entity.type === 'table' && !entity.usages.some(usage => usage.context === 'query')) {
        drift.push({
          entity: name,
          issue: 'no_queries',
          description: `Table ${name} is defined but has no query usages`,
          severity: 'medium'
        });
      }

      // Check for enums with no usages outside schema
      if (entity.type === 'enum' && entity.usages.filter(usage => usage.context !== 'schema').length === 0) {
        drift.push({
          entity: name,
          issue: 'unused_enum',
          description: `Enum ${name} is defined but never used`,
          severity: 'high'
        });
      }

      // Check for relations with no corresponding queries
      if (entity.type === 'relation' && entity.usages.length === 0) {
        drift.push({
          entity: name,
          issue: 'unused_relation',
          description: `Relation ${name} is defined but never used`,
          severity: 'low'
        });
      }
    }

    return drift;
  }

  private async findOrphanedQueries(): Promise<string[]> {
    console.log('🔍 Finding orphaned queries...');

    const orphaned: string[] = [];

    try {
      const queryFiles = await glob('**/*.ts', {
        cwd: join(this.dbDir, 'src/queries'),
        nodir: true
      });

      for (const file of queryFiles) {
        const content = await fs.readFile(join(this.dbDir, 'src/queries', file), 'utf-8');

        // Check if this query file is imported anywhere
        const queryExports = this.extractExports(content);

        for (const exportName of queryExports) {
          const usageFound = await this.checkQueryUsage(exportName);
          if (!usageFound) {
            orphaned.push(`${file}:${exportName}`);
          }
        }
      }
    } catch (error) {
      this.errors.push(`Failed to find orphaned queries: ${error}`);
    }

    return orphaned;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:const|function|class)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private async checkQueryUsage(queryName: string): Promise<boolean> {
    const searchDirs = [this.apiDir, this.webDir];

    for (const dir of searchDirs) {
      try {
        const files = await glob('**/*.{ts,tsx}', {
          cwd: dir,
          ignore: ['node_modules/**', '.next/**'],
          nodir: true
        });

        for (const file of files) {
          const content = await fs.readFile(join(dir, file), 'utf-8');
          if (content.includes(queryName)) {
            return true;
          }
        }
      } catch (error) {
        // Continue searching other directories
      }
    }

    return false;
  }

  private generateAnalysis(schemaDrift: SchemaDrift[], orphanedQueries: string[]): DatabaseAnalysis {
    const entities = Array.from(this.entities.values());
    const unusedEntities = entities.filter(entity => entity.usages.length === 0);
    const potentiallyUnused = entities.filter(entity =>
      entity.usages.length > 0 &&
      entity.usages.length <= 2 &&
      entity.usages.every(usage => usage.context === 'type' || usage.context === 'import')
    );

    return {
      entities,
      unusedEntities,
      potentiallyUnused,
      orphanedQueries,
      schemaCodeDrift: schemaDrift,
      analysisDate: new Date().toISOString(),
      errors: this.errors
    };
  }

  async saveReport(outputPath: string): Promise<void> {
    const analysis = await this.scanDatabase();

    // Create output directory if it doesn't exist
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Save JSON report
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

    // Generate markdown summary
    const markdownPath = outputPath.replace('.json', '.md');
    const markdown = this.generateMarkdownReport(analysis);
    await fs.writeFile(markdownPath, markdown);

    console.log(`📊 Database analysis report saved to ${outputPath}`);
    console.log(`📝 Markdown summary saved to ${markdownPath}`);
  }

  private generateMarkdownReport(analysis: DatabaseAnalysis): string {
    const { entities, unusedEntities, potentiallyUnused, orphanedQueries, schemaCodeDrift, errors } = analysis;

    return `# Database Schema Analysis Report

Generated: ${new Date(analysis.analysisDate).toLocaleString()}

## Summary
- **Total Entities**: ${entities.length}
- **Unused Entities**: ${unusedEntities.length}
- **Potentially Unused**: ${potentiallyUnused.length}
- **Orphaned Queries**: ${orphanedQueries.length}
- **Schema Drift Issues**: ${schemaCodeDrift.length}

## Unused Entities
${unusedEntities.length === 0 ? 'No unused entities found.' : unusedEntities.map(entity =>
  `- **${entity.name}** (${entity.type}) in \`${entity.file}\``
).join('\n')}

## Potentially Unused Entities
${potentiallyUnused.length === 0 ? 'No potentially unused entities found.' : potentiallyUnused.map(entity =>
  `- **${entity.name}** (${entity.type}) - ${entity.usages.length} usage(s): ${entity.usages.map(u => u.context).join(', ')}`
).join('\n')}

## Orphaned Queries
${orphanedQueries.length === 0 ? 'No orphaned queries found.' : orphanedQueries.map(query =>
  `- \`${query}\``
).join('\n')}

## Schema-Code Drift
${schemaCodeDrift.length === 0 ? 'No schema drift detected.' : schemaCodeDrift.map(drift =>
  `- **${drift.entity}** (${drift.severity}): ${drift.description}`
).join('\n')}

## Entity Usage Details
${entities.filter(e => e.usages.length > 0).map(entity =>
  `### ${entity.name} (${entity.type})
- **File**: \`${entity.file}\`
- **Usages**: ${entity.usages.length}
${entity.columns ? `- **Columns**: ${entity.columns.join(', ')}` : ''}
${entity.enumValues ? `- **Values**: ${entity.enumValues.join(', ')}` : ''}

Usage breakdown:
${entity.usages.slice(0, 5).map(usage =>
  `  - \`${usage.file}:${usage.line}\` (${usage.context}): ${usage.snippet}`
).join('\n')}${entity.usages.length > 5 ? `\n  - ... and ${entity.usages.length - 5} more` : ''}
`).join('\n')}

${errors.length > 0 ? `## Errors
${errors.map(error => `- ${error}`).join('\n')}` : ''}
`;
  }
}

// CLI usage
if (require.main === module) {
  const scanner = new DatabaseScanner();
  const outputPath = join(process.cwd(), 'reports/database-analysis.json');

  scanner.saveReport(outputPath).catch(error => {
    console.error('Database analysis failed:', error);
    process.exit(1);
  });
}

export { DatabaseScanner, type DatabaseAnalysis, type DatabaseEntity, type SchemaDrift };