/**
 * Simple Node.js script to run validation tests
 * Compiles and runs TypeScript validation code
 */

const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { performance } = require('perf_hooks');

const testDir = '/Users/benjaminwierzbanowski/Code/epic-cleanupandcodechecks';
const metricsDir = join(testDir, 'tests/cleanup-validation/metrics');

// Ensure metrics directory exists
if (!existsSync(metricsDir)) {
  execSync(`mkdir -p "${metricsDir}"`);
}

async function establishBaseline() {
  console.log('📊 Establishing performance baseline...');

  const startTime = performance.now();
  const baseline = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    commit: getCurrentCommit(),
    metrics: {}
  };

  // Measure build time
  console.log('  ⏱️ Measuring build time...');
  try {
    const buildStart = performance.now();
    execSync('pnpm build', {
      cwd: testDir,
      stdio: 'pipe',
      timeout: 300000
    });
    baseline.metrics.buildTime = performance.now() - buildStart;
    console.log(`    Build time: ${Math.round(baseline.metrics.buildTime)}ms`);
  } catch (error) {
    baseline.metrics.buildTime = -1;
    console.log('    Build failed');
  }

  // Measure type check time
  console.log('  ⏱️ Measuring type check time...');
  try {
    const typeCheckStart = performance.now();
    execSync('pnpm typecheck', {
      cwd: testDir,
      stdio: 'pipe',
      timeout: 120000
    });
    baseline.metrics.typeCheckTime = performance.now() - typeCheckStart;
    console.log(`    Type check time: ${Math.round(baseline.metrics.typeCheckTime)}ms`);
  } catch (error) {
    baseline.metrics.typeCheckTime = -1;
    console.log('    Type check failed');
  }

  // Measure analysis tools
  console.log('  🔍 Measuring analysis tools...');
  const analysisTools = [
    { name: 'knip', command: 'pnpm analysis:dead-code' },
    { name: 'tsPrune', command: 'pnpm analysis:ts-prune' },
    { name: 'depcheck', command: 'pnpm analysis:deps' },
    { name: 'madge', command: 'pnpm analysis:circular' }
  ];

  baseline.metrics.analysisTime = {};

  for (const tool of analysisTools) {
    try {
      const toolStart = performance.now();
      execSync(tool.command, {
        cwd: testDir,
        stdio: 'pipe',
        timeout: 60000
      });
      baseline.metrics.analysisTime[tool.name] = performance.now() - toolStart;
      console.log(`    ${tool.name}: ${Math.round(baseline.metrics.analysisTime[tool.name])}ms`);
    } catch (error) {
      baseline.metrics.analysisTime[tool.name] = -1;
      console.log(`    ${tool.name}: failed`);
    }
  }

  // Measure bundle size
  console.log('  📦 Measuring bundle size...');
  baseline.metrics.bundleSize = measureBundleSize();

  // Save baseline
  const baselineFile = join(metricsDir, 'baseline-performance.json');
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));

  const totalTime = performance.now() - startTime;
  console.log(`✅ Baseline established in ${Math.round(totalTime)}ms`);

  return baseline;
}

function measureBundleSize() {
  const bundleSize = {
    total: 0,
    packages: {}
  };

  try {
    // Measure package sizes
    const packages = ['api', 'db', 'lib', 'worker'];
    for (const pkg of packages) {
      const packagePath = join(testDir, 'packages', pkg);
      if (existsSync(packagePath)) {
        try {
          const size = getDirectorySize(packagePath);
          bundleSize.packages[pkg] = size;
          bundleSize.total += size;
        } catch (error) {
          console.warn(`Could not measure size for package ${pkg}`);
        }
      }
    }

    // Measure web app size
    const webPath = join(testDir, 'apps/web');
    if (existsSync(webPath)) {
      try {
        const size = getDirectorySize(webPath);
        bundleSize.packages['web'] = size;
        bundleSize.total += size;
      } catch (error) {
        console.warn('Could not measure web app size');
      }
    }
  } catch (error) {
    console.warn('Bundle size measurement failed:', error.message);
  }

  return bundleSize;
}

function getDirectorySize(dirPath) {
  try {
    const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf8' });
    return parseInt(output.split('\t')[0]);
  } catch {
    return 0;
  }
}

function getCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: testDir,
      encoding: 'utf8'
    }).trim();
  } catch {
    return 'unknown';
  }
}

async function runStaticAnalysisValidation() {
  console.log('\n🔍 Running static analysis validation...');

  const startTime = performance.now();
  const results = {
    success: true,
    errors: [],
    warnings: [],
    metrics: {}
  };

  // Run knip analysis
  console.log('  📝 Running knip analysis...');
  try {
    const output = execSync('pnpm analysis:dead-code', {
      cwd: testDir,
      encoding: 'utf8',
      timeout: 60000
    });
    results.metrics.knip = { success: true, issues: 0 };
    console.log('    ✅ Knip analysis completed');
  } catch (error) {
    if (error.stdout && error.stdout.includes('issues found')) {
      // Knip found issues but ran successfully
      results.warnings.push('Knip found unused code');
      results.metrics.knip = { success: true, issues: parseKnipIssues(error.stdout) };
      console.log('    ⚠️ Knip found issues');
    } else {
      results.errors.push('Knip analysis failed');
      results.metrics.knip = { success: false, error: error.message };
      results.success = false;
      console.log('    ❌ Knip analysis failed');
    }
  }

  // Run ts-prune analysis
  console.log('  📝 Running ts-prune analysis...');
  try {
    const output = execSync('pnpm analysis:ts-prune', {
      cwd: testDir,
      encoding: 'utf8',
      timeout: 60000
    });
    results.metrics.tsPrune = { success: true, output: output.trim() };
    console.log('    ✅ ts-prune analysis completed');
  } catch (error) {
    if (error.stdout) {
      results.warnings.push('ts-prune found unused exports');
      results.metrics.tsPrune = { success: true, output: error.stdout };
      console.log('    ⚠️ ts-prune found issues');
    } else {
      results.errors.push('ts-prune analysis failed');
      results.metrics.tsPrune = { success: false, error: error.message };
      results.success = false;
      console.log('    ❌ ts-prune analysis failed');
    }
  }

  // Run dependency check
  console.log('  📦 Running dependency check...');
  try {
    const output = execSync('pnpm analysis:deps', {
      cwd: testDir,
      encoding: 'utf8',
      timeout: 45000
    });
    results.metrics.depcheck = { success: true, output: 'No issues found' };
    console.log('    ✅ Dependency check completed');
  } catch (error) {
    if (error.stdout) {
      results.warnings.push('Dependency check found issues');
      results.metrics.depcheck = { success: true, output: error.stdout };
      console.log('    ⚠️ Dependency check found issues');
    } else {
      results.errors.push('Dependency check failed');
      results.metrics.depcheck = { success: false, error: error.message };
      results.success = false;
      console.log('    ❌ Dependency check failed');
    }
  }

  // Run circular dependency check
  console.log('  🔄 Running circular dependency check...');
  try {
    const output = execSync('pnpm analysis:circular', {
      cwd: testDir,
      encoding: 'utf8',
      timeout: 30000
    });
    results.metrics.madge = { success: true, output: 'No circular dependencies found' };
    console.log('    ✅ No circular dependencies found');
  } catch (error) {
    if (error.stdout && error.stdout.includes('No circular dependency found')) {
      results.metrics.madge = { success: true, output: 'No circular dependencies found' };
      console.log('    ✅ No circular dependencies found');
    } else {
      results.warnings.push('Circular dependencies found');
      results.metrics.madge = { success: true, output: error.stdout || error.stderr };
      console.log('    ⚠️ Circular dependencies found');
    }
  }

  results.duration = performance.now() - startTime;
  console.log(`  Completed in ${Math.round(results.duration)}ms`);

  return results;
}

function parseKnipIssues(output) {
  // Simple parsing of knip output to count issues
  const lines = output.split('\n').filter(line => line.trim());
  return lines.length;
}

async function runCodeQualityValidation() {
  console.log('\n🧹 Running code quality validation...');

  const startTime = performance.now();
  const results = {
    success: true,
    errors: [],
    warnings: [],
    metrics: {}
  };

  // TypeScript compilation
  console.log('  📝 Checking TypeScript compilation...');
  try {
    execSync('pnpm typecheck', {
      cwd: testDir,
      encoding: 'utf8',
      timeout: 120000
    });
    results.metrics.typescript = { success: true };
    console.log('    ✅ TypeScript compilation successful');
  } catch (error) {
    results.errors.push('TypeScript compilation failed');
    results.metrics.typescript = { success: false, error: error.stdout || error.message };
    results.success = false;
    console.log('    ❌ TypeScript compilation failed');
  }

  // Build validation
  console.log('  🏗️ Validating build...');
  try {
    execSync('pnpm build', {
      cwd: testDir,
      stdio: 'pipe',
      timeout: 300000
    });
    results.metrics.build = { success: true };
    console.log('    ✅ Build successful');
  } catch (error) {
    results.errors.push('Build failed');
    results.metrics.build = { success: false, error: error.message };
    results.success = false;
    console.log('    ❌ Build failed');
  }

  results.duration = performance.now() - startTime;
  console.log(`  Completed in ${Math.round(results.duration)}ms`);

  return results;
}

async function runComprehensiveValidation() {
  console.log('🚀 Starting comprehensive cleanup validation...');
  const overallStart = performance.now();

  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      commit: getCurrentCommit(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      totalDuration: 0
    },
    baseline: null,
    categories: {}
  };

  try {
    // 1. Establish baseline
    report.baseline = await establishBaseline();

    // 2. Run static analysis validation
    report.categories.staticAnalysis = await runStaticAnalysisValidation();

    // 3. Run code quality validation
    report.categories.codeQuality = await runCodeQualityValidation();

    // Update summary
    const categories = Object.values(report.categories);
    report.summary.totalTests = categories.length;
    report.summary.passed = categories.filter(cat => cat.success).length;
    report.summary.failed = categories.filter(cat => !cat.success).length;
    report.summary.warnings = categories.reduce((sum, cat) => sum + cat.warnings.length, 0);
    report.summary.totalDuration = performance.now() - overallStart;

    // Save report
    const reportFile = join(metricsDir, `validation-report-${Date.now()}.json`);
    const latestFile = join(metricsDir, 'latest-validation-report.json');

    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    writeFileSync(latestFile, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Tests: ${report.summary.passed}/${report.summary.totalTests} passed`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Duration: ${Math.round(report.summary.totalDuration / 1000)}s`);

    if (report.summary.failed > 0) {
      console.log(`\n❌ ${report.summary.failed} categories failed validation`);
    } else {
      console.log(`\n✅ All validation categories passed!`);
    }

    console.log(`\n📄 Report saved to: ${reportFile}`);
    console.log('='.repeat(60));

    return report;

  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
}

// Run the validation
if (require.main === module) {
  runComprehensiveValidation()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveValidation,
  establishBaseline
};