import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { glob } from 'glob';

interface DatabaseTable {
  name: string;
  path: string;
  isUsed: boolean;
  usageCount: number;
  references: string[];
}

interface DatabaseIndex {
  name: string;
  table: string;
  columns: string[];
  isUsed: boolean;
  references: string[];
}

interface DatabaseMigration {
  path: string;
  timestamp: string;
  isApplied: boolean;
  hasRollback: boolean;
}

interface DatabaseAnalysisResult {
  timestamp: string;
  tool: 'db-scanner';
  tables: DatabaseTable[];
  indexes: DatabaseIndex[];
  migrations: DatabaseMigration[];
  summary: {
    totalTables: number;
    unusedTables: number;
    totalIndexes: number;
    unusedIndexes: number;
    orphanedMigrations: number;
  };
}

export class DatabaseScanner {
  private rootDir: string;
  private schemaPatterns: string[];
  private migrationPatterns: string[];
  private sourcePatterns: string[];

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.schemaPatterns = [
      'packages/db/src/schema/**/*.ts',
      'packages/db/src/schema.ts'
    ];
    this.migrationPatterns = [
      'packages/db/drizzle/**/*.sql',
      'packages/db/migrations/**/*.sql'
    ];
    this.sourcePatterns = [
      'apps/web/src/**/*.{ts,tsx}',
      'packages/api/src/**/*.ts',
      'packages/lib/src/**/*.ts',
      'packages/worker/src/**/*.ts'
    ];
  }

  async scan(): Promise<DatabaseAnalysisResult> {
    console.log('🔍 Scanning database schema and usage...');

    const tables = await this.analyzeTables();
    const indexes = await this.analyzeIndexes();
    const migrations = await this.analyzeMigrations();

    const unusedTables = tables.filter(table => !table.isUsed);
    const unusedIndexes = indexes.filter(index => !index.isUsed);

    return {
      timestamp: new Date().toISOString(),
      tool: 'db-scanner',
      tables,
      indexes,
      migrations,
      summary: {
        totalTables: tables.length,
        unusedTables: unusedTables.length,
        totalIndexes: indexes.length,
        unusedIndexes: unusedIndexes.length,
        orphanedMigrations: migrations.filter(m => !m.isApplied).length
      }
    };
  }

  private async analyzeTables(): Promise<DatabaseTable[]> {
    const schemaFiles = await this.findSchemaFiles();
    const sourceContent = await this.readSourceFiles();
    const tables: DatabaseTable[] = [];

    for (const schemaFile of schemaFiles) {
      const content = await readFile(join(this.rootDir, schemaFile), 'utf-8');
      const tableDefs = this.extractTableDefinitions(content, schemaFile);

      for (const tableDef of tableDefs) {
        const references = this.findTableReferences(tableDef.name, sourceContent);
        tables.push({
          name: tableDef.name,
          path: schemaFile,
          isUsed: references.length > 0,
          usageCount: references.length,
          references
        });
      }
    }

    return tables;
  }

  private async analyzeIndexes(): Promise<DatabaseIndex[]> {
    const schemaFiles = await this.findSchemaFiles();
    const sourceContent = await this.readSourceFiles();
    const indexes: DatabaseIndex[] = [];

    for (const schemaFile of schemaFiles) {
      const content = await readFile(join(this.rootDir, schemaFile), 'utf-8');
      const indexDefs = this.extractIndexDefinitions(content);

      for (const indexDef of indexDefs) {
        const references = this.findIndexReferences(indexDef.name, sourceContent);
        indexes.push({
          name: indexDef.name,
          table: indexDef.table,
          columns: indexDef.columns,
          isUsed: references.length > 0,
          references
        });
      }
    }

    return indexes;
  }

  private async analyzeMigrations(): Promise<DatabaseMigration[]> {
    const migrationFiles = await this.findMigrationFiles();
    const migrations: DatabaseMigration[] = [];

    for (const migrationFile of migrationFiles) {
      const content = await readFile(join(this.rootDir, migrationFile), 'utf-8');
      const timestamp = this.extractMigrationTimestamp(migrationFile);

      migrations.push({
        path: migrationFile,
        timestamp,
        isApplied: true, // Would need to check against actual DB state
        hasRollback: content.includes('DROP') || content.includes('DELETE')
      });
    }

    return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async findSchemaFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.schemaPatterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private async findMigrationFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.migrationPatterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private async readSourceFiles(): Promise<string> {
    let content = '';

    for (const pattern of this.sourcePatterns) {
      const files = await glob(pattern, { cwd: this.rootDir });

      for (const file of files) {
        try {
          const fileContent = await readFile(join(this.rootDir, file), 'utf-8');
          content += fileContent + '\n';
        } catch (error) {
          console.warn(`Warning: Could not read ${file}:`, error);
        }
      }
    }

    return content;
  }

  private extractTableDefinitions(content: string, filePath: string): Array<{ name: string }> {
    const tables: Array<{ name: string }> = [];

    // Match Drizzle table definitions
    const tableMatches = content.matchAll(/export const (\w+) = (?:pgTable|mysqlTable|sqliteTable)\(['"](\w+)['"]|export const (\w+) = table\(/g);

    for (const match of tableMatches) {
      const tableName = match[1] || match[3];
      const dbName = match[2] || tableName;

      if (tableName) {
        tables.push({ name: tableName });
      }
    }

    // Also match schema object properties
    const schemaMatches = content.matchAll(/^\s*(\w+):\s*(?:pgTable|mysqlTable|sqliteTable|table)\(/gm);

    for (const match of schemaMatches) {
      const tableName = match[1];
      if (tableName && !tables.find(t => t.name === tableName)) {
        tables.push({ name: tableName });
      }
    }

    return tables;
  }

  private extractIndexDefinitions(content: string): Array<{ name: string; table: string; columns: string[] }> {
    const indexes: Array<{ name: string; table: string; columns: string[] }> = [];

    // Match index definitions
    const indexMatches = content.matchAll(/(?:index|uniqueIndex)\(['"](\w+)['"]\)\s*\.on\(([^)]+)\)/g);

    for (const match of indexMatches) {
      const indexName = match[1];
      const columns = match[2]
        .split(',')
        .map(col => col.trim().replace(/^\\w+\\./, '').replace(/['\"`]/g, ''))
        .filter(Boolean);

      indexes.push({
        name: indexName,
        table: 'unknown', // Would need more sophisticated parsing
        columns
      });
    }

    return indexes;
  }

  private extractMigrationTimestamp(filePath: string): string {
    const filename = filePath.split('/').pop() || '';
    const timestampMatch = filename.match(/^(\d{4}_\d{2}_\d{2}_\d{6})/);
    return timestampMatch ? timestampMatch[1] : filename;
  }

  private findTableReferences(tableName: string, sourceContent: string): string[] {
    const references: string[] = [];

    // Common patterns for table usage
    const patterns = [
      // Direct table references
      new RegExp(`\\b${tableName}\\b`, 'g'),
      // Query references
      new RegExp(`from\\(${tableName}\\)`, 'g'),
      new RegExp(`insert\\(${tableName}\\)`, 'g'),
      new RegExp(`update\\(${tableName}\\)`, 'g'),
      new RegExp(`delete\\(${tableName}\\)`, 'g'),
      // Schema references
      new RegExp(`schema\\.${tableName}`, 'g'),
      new RegExp(`db\\.${tableName}`, 'g')
    ];

    for (const pattern of patterns) {
      const matches = sourceContent.match(pattern);
      if (matches) {
        references.push(...matches);
      }
    }

    return [...new Set(references)];
  }

  private findIndexReferences(indexName: string, sourceContent: string): string[] {
    const references: string[] = [];

    // Index references are less common in application code
    const patterns = [
      new RegExp(`['"\`]${indexName}['"\`]`, 'g'),
      new RegExp(`\\b${indexName}\\b`, 'g')
    ];

    for (const pattern of patterns) {
      const matches = sourceContent.match(pattern);
      if (matches) {
        references.push(...matches);
      }
    }

    return [...new Set(references)];
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const scanner = new DatabaseScanner(rootDir);

    try {
      const result = await scanner.scan();

      console.log('\\n📊 Database Analysis Results:');
      console.log(`Total tables: ${result.summary.totalTables}`);
      console.log(`Unused tables: ${result.summary.unusedTables}`);
      console.log(`Total indexes: ${result.summary.totalIndexes}`);
      console.log(`Unused indexes: ${result.summary.unusedIndexes}`);
      console.log(`Orphaned migrations: ${result.summary.orphanedMigrations}`);

      // Output JSON for programmatic use
      console.log('\\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Database scanning failed:', error);
      process.exit(1);
    }
  }

  main();
}