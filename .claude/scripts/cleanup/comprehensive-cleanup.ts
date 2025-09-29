#!/usr/bin/env tsx

import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { join, extname, dirname, relative, resolve } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

interface DuplicateFile {
  path: string;
  size: number;
  hash: string;
  duplicates: string[];
}

interface ImportPathAnalysis {
  file: string;
  imports: {
    original: string;
    normalized: string;
    type: 'relative' | 'absolute' | 'barrel' | 'external';
  }[];
}

interface CleanupReport {
  timestamp: string;
  duplicatesRemoved: DuplicateFile[];
  importsNormalized: ImportPathAnalysis[];
  spaceSaved: number;
  filesProcessed: number;
}

class ComprehensiveCleanupTool {
  private rootDir: string;
  private sourcePatterns: string[];
  private excludePatterns: string[];

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.sourcePatterns = [
      'apps/**/*.{ts,tsx,js,jsx}',
      'packages/**/*.{ts,tsx,js,jsx}',
      '!node_modules/**',
      '!.next/**',
      '!dist/**',
      '!build/**'
    ];
    this.excludePatterns = [
      'node_modules',
      '.next',
      'dist',
      'build',
      'coverage',
      '.git'
    ];
  }

  async findDuplicateFiles(): Promise<DuplicateFile[]> {
    console.log('🔍 Scanning for duplicate files...');

    const fileHashes = new Map<string, string[]>();
    const fileSizes = new Map<string, number>();

    await this.walkDirectory(this.rootDir, async (filePath) => {
      if (this.shouldSkipFile(filePath)) return;

      try {
        const stats = await stat(filePath);
        if (!stats.isFile()) return;

        const content = await readFile(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        fileSizes.set(filePath, stats.size);

        if (!fileHashes.has(hash)) {
          fileHashes.set(hash, []);
        }
        fileHashes.get(hash)!.push(filePath);
      } catch (error) {
        console.warn(`Skipping ${filePath}: ${error}`);
      }
    });

    const duplicates: DuplicateFile[] = [];

    for (const [hash, paths] of fileHashes) {
      if (paths.length > 1) {
        const primary = paths[0];
        const duplicatePaths = paths.slice(1);

        duplicates.push({
          path: primary,
          size: fileSizes.get(primary) || 0,
          hash,
          duplicates: duplicatePaths
        });
      }
    }

    return duplicates;
  }

  async normalizeImportPaths(): Promise<ImportPathAnalysis[]> {
    console.log('🔧 Normalizing import paths...');

    const analyses: ImportPathAnalysis[] = [];

    await this.walkDirectory(this.rootDir, async (filePath) => {
      if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;
      if (this.shouldSkipFile(filePath)) return;

      try {
        const content = await readFile(filePath, 'utf8');
        const imports = this.extractImports(content);

        if (imports.length === 0) return;

        const analysis: ImportPathAnalysis = {
          file: filePath,
          imports: imports.map(imp => ({
            original: imp,
            normalized: this.normalizeImport(imp, filePath),
            type: this.getImportType(imp)
          }))
        };

        // Only include if we have changes to make
        const hasChanges = analysis.imports.some(
          imp => imp.original !== imp.normalized
        );

        if (hasChanges) {
          analyses.push(analysis);
          await this.updateFileImports(filePath, analysis.imports);
        }
      } catch (error) {
        console.warn(`Failed to process imports in ${filePath}: ${error}`);
      }
    });

    return analyses;
  }

  private async walkDirectory(dir: string, callback: (path: string) => Promise<void>) {
    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        if (this.excludePatterns.some(pattern => entry.includes(pattern))) {
          continue;
        }

        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await this.walkDirectory(fullPath, callback);
        } else {
          await callback(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dir}: ${error}`);
    }
  }

  private shouldSkipFile(filePath: string): boolean {
    return this.excludePatterns.some(pattern =>
      filePath.includes(pattern)
    );
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];

    // Match ES6 imports
    const importRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"](.*?)['"];?/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"](.*?)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private normalizeImport(importPath: string, fromFile: string): string {
    // Skip external modules
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return importPath;
    }

    // Convert relative paths to absolute paths where beneficial
    if (importPath.startsWith('../../../')) {
      const fromDir = dirname(fromFile);
      const resolved = resolve(fromDir, importPath);
      const relativeTo = this.findProjectRoot(fromFile);

      if (relativeTo) {
        const absolutePath = relative(relativeTo, resolved);
        if (absolutePath.length < importPath.length) {
          return absolutePath.startsWith('.') ? absolutePath : `./${absolutePath}`;
        }
      }
    }

    // Normalize index imports
    if (importPath.endsWith('/index')) {
      return importPath.slice(0, -6);
    }

    // Remove file extensions for TypeScript/JavaScript
    if (importPath.match(/\.(ts|tsx|js|jsx)$/)) {
      return importPath.replace(/\.(ts|tsx|js|jsx)$/, '');
    }

    return importPath;
  }

  private getImportType(importPath: string): 'relative' | 'absolute' | 'barrel' | 'external' {
    if (importPath.startsWith('.')) return 'relative';
    if (importPath.startsWith('/')) return 'absolute';
    if (importPath.includes('/index')) return 'barrel';
    return 'external';
  }

  private findProjectRoot(filePath: string): string | null {
    let dir = dirname(filePath);

    while (dir !== '/' && dir !== '.') {
      try {
        const packageJsonPath = join(dir, 'package.json');
        const tsConfigPath = join(dir, 'tsconfig.json');

        if (require('fs').existsSync(packageJsonPath) || require('fs').existsSync(tsConfigPath)) {
          return dir;
        }
      } catch {
        // Continue searching
      }

      dir = dirname(dir);
    }

    return null;
  }

  private async updateFileImports(filePath: string, imports: ImportPathAnalysis['imports']) {
    try {
      let content = await readFile(filePath, 'utf8');

      for (const imp of imports) {
        if (imp.original !== imp.normalized) {
          // Replace the import statement
          const importRegex = new RegExp(
            `(import\\s+(?:[\\w*{}\\s,]+\\s+from\\s+)?['"])${this.escapeRegex(imp.original)}(['"];?)`,
            'g'
          );
          content = content.replace(importRegex, `$1${imp.normalized}$2`);

          // Also handle dynamic imports
          const dynamicRegex = new RegExp(
            `(import\\s*\\(\\s*['"])${this.escapeRegex(imp.original)}(['"]\\s*\\))`,
            'g'
          );
          content = content.replace(dynamicRegex, `$1${imp.normalized}$2`);
        }
      }

      await writeFile(filePath, content, 'utf8');
      console.log(`✅ Updated imports in ${relative(this.rootDir, filePath)}`);
    } catch (error) {
      console.error(`Failed to update imports in ${filePath}: ${error}`);
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async formatCode(): Promise<void> {
    console.log('🎨 Formatting code with Prettier...');

    try {
      execSync('pnpm format', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      console.log('✅ Code formatting completed');
    } catch (error) {
      console.error('❌ Code formatting failed:', error);
    }
  }

  async lintCode(): Promise<void> {
    console.log('🔍 Running ESLint...');

    try {
      execSync('pnpm lint --fix', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      console.log('✅ Linting completed');
    } catch (error) {
      console.warn('⚠️ Linting had issues (this may be expected)');
    }
  }

  async removeDuplicates(duplicates: DuplicateFile[]): Promise<number> {
    console.log('🗑️ Removing duplicate files...');

    let spaceSaved = 0;

    for (const duplicate of duplicates) {
      for (const dupPath of duplicate.duplicates) {
        try {
          // Use git rm to preserve history
          execSync(`git rm "${dupPath}"`, { cwd: this.rootDir });
          spaceSaved += duplicate.size;
          console.log(`✅ Removed duplicate: ${relative(this.rootDir, dupPath)}`);
        } catch (error) {
          console.warn(`⚠️ Could not remove ${dupPath}: ${error}`);
        }
      }
    }

    return spaceSaved;
  }

  async generateReport(
    duplicatesRemoved: DuplicateFile[],
    importsNormalized: ImportPathAnalysis[],
    spaceSaved: number,
    filesProcessed: number
  ): Promise<void> {
    const report: CleanupReport = {
      timestamp: new Date().toISOString(),
      duplicatesRemoved,
      importsNormalized,
      spaceSaved,
      filesProcessed
    };

    const reportPath = join(this.rootDir, 'reports', `cleanup-report-${Date.now()}.json`);
    const markdownPath = join(this.rootDir, 'reports', `cleanup-report-${Date.now()}.md`);

    await writeFile(reportPath, JSON.stringify(report, null, 2));

    const markdown = this.generateMarkdownReport(report);
    await writeFile(markdownPath, markdown);

    console.log(`📊 Reports saved:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Markdown: ${markdownPath}`);
  }

  private generateMarkdownReport(report: CleanupReport): string {
    return `# Comprehensive Cleanup Report

Generated: ${new Date(report.timestamp).toLocaleString()}

## Summary

- **Files Processed**: ${report.filesProcessed}
- **Duplicates Removed**: ${report.duplicatesRemoved.length}
- **Imports Normalized**: ${report.importsNormalized.length}
- **Space Saved**: ${(report.spaceSaved / 1024).toFixed(2)} KB

## Duplicate Files Removed

${report.duplicatesRemoved.map(dup =>
  `- **${dup.path}** (${(dup.size / 1024).toFixed(2)} KB)\n  - Duplicates: ${dup.duplicates.join(', ')}`
).join('\n')}

## Import Path Normalizations

${report.importsNormalized.map(analysis =>
  `### ${analysis.file}\n${analysis.imports.map(imp =>
    `- \`${imp.original}\` → \`${imp.normalized}\` (${imp.type})`
  ).join('\n')}`
).join('\n\n')}

---
*Generated by Comprehensive Cleanup Tool*
`;
  }

  async run(): Promise<void> {
    console.log('🚀 Starting comprehensive cleanup...');

    try {
      // Find duplicates
      const duplicates = await this.findDuplicateFiles();
      console.log(`Found ${duplicates.length} sets of duplicate files`);

      // Normalize imports
      const importAnalyses = await this.normalizeImportPaths();
      console.log(`Normalized imports in ${importAnalyses.length} files`);

      // Remove duplicates
      const spaceSaved = await this.removeDuplicates(duplicates);

      // Format code
      await this.formatCode();

      // Lint code
      await this.lintCode();

      // Generate report
      const filesProcessed = duplicates.length + importAnalyses.length;
      await this.generateReport(duplicates, importAnalyses, spaceSaved, filesProcessed);

      console.log('✅ Comprehensive cleanup completed successfully!');
      console.log(`💾 Space saved: ${(spaceSaved / 1024).toFixed(2)} KB`);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  }
}

async function main() {
  const rootDir = process.cwd();
  const cleanup = new ComprehensiveCleanupTool(rootDir);
  await cleanup.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveCleanupTool };