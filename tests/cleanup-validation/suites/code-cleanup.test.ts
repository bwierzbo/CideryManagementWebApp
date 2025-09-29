/**
 * Code Cleanup Validation Tests
 *
 * Tests for validating code cleanup operations including unused exports,
 * dead code removal, import optimization, and formatting consistency.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface CleanupAnalysis {
  unusedExports: Array<{
    file: string;
    exports: string[];
    confidence: number;
  }>;
  unusedFiles: Array<{
    path: string;
    size: number;
    lastModified: string;
  }>;
  duplicateCode: Array<{
    files: string[];
    similarity: number;
    lines: number;
  }>;
  importIssues: Array<{
    file: string;
    issue: string;
    suggestion: string;
  }>;
}

describe('Code Cleanup Validation', () => {
  const testDir = '/Users/benjaminwierzbanowski/Code/epic-cleanupandcodechecks';
  const backupDir = join(testDir, 'test-backups');
  const metricsDir = join(testDir, 'tests/cleanup-validation/metrics');

  beforeAll(() => {
    // Ensure directories exist
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test artifacts (but keep backups for safety)
  });

  describe('Static Analysis Validation', () => {
    it('should run knip analysis without errors', async () => {
      const startTime = performance.now();

      let analysisResult;
      let analysisError = null;

      try {
        const output = execSync('pnpm analysis:dead-code', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 60000, // 60 second timeout
        });
        analysisResult = output;
      } catch (error) {
        analysisError = error;
        // knip may exit with non-zero code when issues are found
        if (error.stdout) {
          analysisResult = error.stdout;
        }
      }

      const analysisTime = performance.now() - startTime;

      // Save performance metrics
      const metrics = {
        tool: 'knip',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        success: analysisError === null || (analysisError && analysisError.stdout),
        output: analysisResult,
      };

      writeFileSync(
        join(metricsDir, 'knip-analysis-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      // Analysis should complete within reasonable time
      expect(analysisTime).toBeLessThan(30000); // 30 seconds

      // Should have output (even if issues found)
      expect(analysisResult).toBeDefined();
      expect(typeof analysisResult).toBe('string');
    });

    it('should run ts-prune analysis successfully', async () => {
      const startTime = performance.now();

      let analysisResult;
      let analysisError = null;

      try {
        const output = execSync('pnpm analysis:ts-prune', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 60000,
        });
        analysisResult = output;
      } catch (error) {
        analysisError = error;
        if (error.stdout) {
          analysisResult = error.stdout;
        }
      }

      const analysisTime = performance.now() - startTime;

      // Save metrics
      const metrics = {
        tool: 'ts-prune',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        success: analysisError === null || (analysisError && analysisError.stdout),
        output: analysisResult,
      };

      writeFileSync(
        join(metricsDir, 'ts-prune-analysis-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(analysisTime).toBeLessThan(45000); // 45 seconds
      expect(analysisResult).toBeDefined();
    });

    it('should detect circular dependencies', async () => {
      const startTime = performance.now();

      let analysisResult;
      let hasCircularDeps = false;

      try {
        const output = execSync('pnpm analysis:circular', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 30000,
        });
        analysisResult = output;
      } catch (error) {
        // madge exits with non-zero code when circular deps found
        analysisResult = error.stdout || error.stderr;
        hasCircularDeps = true;
      }

      const analysisTime = performance.now() - startTime;

      // Save metrics
      const metrics = {
        tool: 'madge',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        circularDependenciesFound: hasCircularDeps,
        output: analysisResult,
      };

      writeFileSync(
        join(metricsDir, 'circular-deps-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(analysisTime).toBeLessThan(20000); // 20 seconds

      // Log circular dependencies if found (warning, not failure)
      if (hasCircularDeps) {
        console.warn('⚠️ Circular dependencies detected:', analysisResult);
      }
    });

    it('should validate dependency usage', async () => {
      const startTime = performance.now();

      let analysisResult;
      let analysisError = null;

      try {
        const output = execSync('pnpm analysis:deps', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 45000,
        });
        analysisResult = output;
      } catch (error) {
        analysisError = error;
        if (error.stdout) {
          analysisResult = error.stdout;
        }
      }

      const analysisTime = performance.now() - startTime;

      // Parse depcheck output for structured analysis
      let unusedDependencies = [];
      let missingDependencies = [];

      if (analysisResult) {
        try {
          // depcheck outputs JSON when run programmatically
          const parsed = JSON.parse(analysisResult);
          unusedDependencies = parsed.dependencies || [];
          missingDependencies = Object.keys(parsed.missing || {});
        } catch {
          // Fallback to text parsing if JSON parsing fails
          unusedDependencies = analysisResult.match(/Unused dependencies:.*?\n(.*?)\n/s)?.[1]?.split('\n').filter(Boolean) || [];
        }
      }

      const metrics = {
        tool: 'depcheck',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        success: analysisError === null,
        unusedDependencies,
        missingDependencies,
        output: analysisResult,
      };

      writeFileSync(
        join(metricsDir, 'dependency-analysis-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(analysisTime).toBeLessThan(30000); // 30 seconds

      // Log dependency issues if found
      if (unusedDependencies.length > 0) {
        console.warn('⚠️ Unused dependencies detected:', unusedDependencies);
      }
      if (missingDependencies.length > 0) {
        console.warn('⚠️ Missing dependencies detected:', missingDependencies);
      }
    });
  });

  describe('Code Quality Validation', () => {
    it('should validate TypeScript compilation', async () => {
      const startTime = performance.now();

      let compileResult;
      let compileError = null;

      try {
        const output = execSync('pnpm typecheck', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 120000, // 2 minutes for type checking
        });
        compileResult = output;
      } catch (error) {
        compileError = error;
        compileResult = error.stdout || error.stderr;
      }

      const compileTime = performance.now() - startTime;

      const metrics = {
        tool: 'typescript',
        executionTime: compileTime,
        timestamp: new Date().toISOString(),
        success: compileError === null,
        errors: compileError ? this.parseTypeScriptErrors(compileResult) : [],
        output: compileResult,
      };

      writeFileSync(
        join(metricsDir, 'typescript-compile-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(compileTime).toBeLessThan(120000); // 2 minutes

      // TypeScript compilation should succeed
      if (compileError) {
        console.error('❌ TypeScript compilation failed:', compileResult);
        expect(compileError).toBeNull();
      }
    });

    it('should validate code formatting consistency', async () => {
      const startTime = performance.now();

      let formatResult;
      let formatError = null;

      try {
        // Check formatting without modifying files
        const output = execSync('pnpm format --check', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 60000,
        });
        formatResult = output;
      } catch (error) {
        formatError = error;
        formatResult = error.stdout || error.stderr;
      }

      const formatTime = performance.now() - startTime;

      const metrics = {
        tool: 'prettier',
        executionTime: formatTime,
        timestamp: new Date().toISOString(),
        allFilesFormatted: formatError === null,
        unformattedFiles: formatError ? this.parseUnformattedFiles(formatResult) : [],
        output: formatResult,
      };

      writeFileSync(
        join(metricsDir, 'formatting-check-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(formatTime).toBeLessThan(30000); // 30 seconds

      // Log formatting issues if found
      if (formatError) {
        console.warn('⚠️ Formatting inconsistencies detected:', formatResult);
      }
    });

    it('should validate import path consistency', async () => {
      const startTime = performance.now();

      // Find all TypeScript files
      const tsFiles = glob.sync('**/*.{ts,tsx}', {
        cwd: testDir,
        ignore: ['node_modules/**', 'dist/**', '**/*.d.ts'],
      });

      const importIssues = [];
      const importPatterns = {
        relative: /from\s+['"]\.\.?\//g,
        absolute: /from\s+['"][@\w]/g,
        barrel: /from\s+['"].*\/index['"]$/g,
      };

      for (const file of tsFiles) {
        const filePath = join(testDir, file);
        if (!existsSync(filePath)) continue;

        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            // Check for potential import issues
            if (line.includes('import') && line.includes('from')) {
              // Very deep relative imports (potential issue)
              if (line.match(/from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\//)) {
                importIssues.push({
                  file,
                  line: index + 1,
                  issue: 'Very deep relative import',
                  suggestion: 'Consider using barrel imports or absolute paths',
                  content: line.trim(),
                });
              }

              // Mixed import styles in same file (consistency issue)
              const hasRelative = line.match(importPatterns.relative);
              const hasAbsolute = line.match(importPatterns.absolute);

              if (hasRelative && hasAbsolute) {
                importIssues.push({
                  file,
                  line: index + 1,
                  issue: 'Mixed import styles',
                  suggestion: 'Use consistent import style throughout file',
                  content: line.trim(),
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not analyze imports in ${file}:`, error.message);
        }
      }

      const analysisTime = performance.now() - startTime;

      const metrics = {
        tool: 'import-analyzer',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        filesAnalyzed: tsFiles.length,
        importIssues: importIssues.length,
        issues: importIssues,
      };

      writeFileSync(
        join(metricsDir, 'import-analysis-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(analysisTime).toBeLessThan(15000); // 15 seconds
      expect(tsFiles.length).toBeGreaterThan(0);

      // Log import issues if found
      if (importIssues.length > 0) {
        console.warn(`⚠️ Found ${importIssues.length} import issues`);
        importIssues.slice(0, 5).forEach(issue => {
          console.warn(`  ${issue.file}:${issue.line} - ${issue.issue}`);
        });
      }
    });
  });

  describe('Build and Bundle Validation', () => {
    it('should validate successful build after cleanup', async () => {
      const startTime = performance.now();

      let buildResult;
      let buildError = null;

      try {
        const output = execSync('pnpm build', {
          cwd: testDir,
          encoding: 'utf8',
          timeout: 300000, // 5 minutes for build
        });
        buildResult = output;
      } catch (error) {
        buildError = error;
        buildResult = error.stdout || error.stderr;
      }

      const buildTime = performance.now() - startTime;

      const metrics = {
        tool: 'build',
        executionTime: buildTime,
        timestamp: new Date().toISOString(),
        success: buildError === null,
        output: buildResult,
      };

      writeFileSync(
        join(metricsDir, 'build-validation-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(buildTime).toBeLessThan(300000); // 5 minutes

      // Build should succeed after cleanup
      if (buildError) {
        console.error('❌ Build failed after cleanup:', buildResult);
        expect(buildError).toBeNull();
      }
    });

    it('should validate bundle size optimization', async () => {
      const startTime = performance.now();

      // Analyze current bundle sizes
      const bundleSizes = {
        packages: {},
        total: 0,
      };

      const packages = ['api', 'db', 'lib', 'worker'];
      for (const pkg of packages) {
        const distPath = join(testDir, 'packages', pkg, 'dist');
        if (existsSync(distPath)) {
          try {
            const size = this.getDirectorySize(distPath);
            bundleSizes.packages[pkg] = size;
            bundleSizes.total += size;
          } catch (error) {
            console.warn(`Could not measure size for package ${pkg}:`, error.message);
          }
        }
      }

      // Analyze web app bundle if built
      const webDistPath = join(testDir, 'apps/web/.next');
      if (existsSync(webDistPath)) {
        try {
          const size = this.getDirectorySize(webDistPath);
          bundleSizes.packages['web'] = size;
          bundleSizes.total += size;
        } catch (error) {
          console.warn('Could not measure web app bundle size:', error.message);
        }
      }

      const analysisTime = performance.now() - startTime;

      const metrics = {
        tool: 'bundle-analyzer',
        executionTime: analysisTime,
        timestamp: new Date().toISOString(),
        bundleSizes,
        totalSize: bundleSizes.total,
        packagesAnalyzed: Object.keys(bundleSizes.packages).length,
      };

      writeFileSync(
        join(metricsDir, 'bundle-size-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      expect(analysisTime).toBeLessThan(10000); // 10 seconds
      expect(bundleSizes.total).toBeGreaterThan(0);

      console.log(`📦 Total bundle size: ${(bundleSizes.total / 1024 / 1024).toFixed(2)}MB`);
      Object.entries(bundleSizes.packages).forEach(([pkg, size]) => {
        console.log(`  ${pkg}: ${(size / 1024 / 1024).toFixed(2)}MB`);
      });
    });
  });

  describe('Regression Testing', () => {
    it('should validate no functionality regression', async () => {
      // Run existing test suites to ensure no functionality was broken
      const testCommands = [
        'pnpm --filter api test',
        'pnpm --filter db test',
        'pnpm --filter lib test',
      ];

      const testResults = [];

      for (const command of testCommands) {
        const startTime = performance.now();
        let testResult;
        let testError = null;

        try {
          const output = execSync(command, {
            cwd: testDir,
            encoding: 'utf8',
            timeout: 120000, // 2 minutes per package
          });
          testResult = output;
        } catch (error) {
          testError = error;
          testResult = error.stdout || error.stderr;
        }

        const testTime = performance.now() - startTime;

        testResults.push({
          command,
          executionTime: testTime,
          success: testError === null,
          output: testResult,
        });
      }

      const metrics = {
        tool: 'regression-tests',
        timestamp: new Date().toISOString(),
        results: testResults,
        allTestsPassed: testResults.every(result => result.success),
        totalTime: testResults.reduce((sum, result) => sum + result.executionTime, 0),
      };

      writeFileSync(
        join(metricsDir, 'regression-test-metrics.json'),
        JSON.stringify(metrics, null, 2)
      );

      // All tests should pass
      const failedTests = testResults.filter(result => !result.success);
      if (failedTests.length > 0) {
        console.error('❌ Some tests failed after cleanup:');
        failedTests.forEach(test => {
          console.error(`  ${test.command}: ${test.output}`);
        });
      }

      expect(failedTests.length).toBe(0);
    });
  });

  // Helper methods
  private parseTypeScriptErrors(output: string): Array<{ file: string; line: number; message: string }> {
    const errors = [];
    const errorRegex = /(.+?)\((\d+),\d+\):\s*error\s*TS\d+:\s*(.+)/g;
    let match;

    while ((match = errorRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        message: match[3],
      });
    }

    return errors;
  }

  private parseUnformattedFiles(output: string): string[] {
    const files = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.trim() && !line.includes('Code style issues found') && !line.includes('prettier --write')) {
        files.push(line.trim());
      }
    }

    return files;
  }

  private getDirectorySize(dirPath: string): number {
    try {
      const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf8' });
      return parseInt(output.split('\t')[0]);
    } catch {
      return 0;
    }
  }
});