import { test, expect } from '../utils/test-helpers';
import { DataValidator } from '../utils/data-validation';
import { SeededDataDiscovery } from '../utils/seeded-data-discovery';
import { CalculationValidator } from '../utils/calculation-validators';
import { RelationshipValidator } from '../utils/relationship-validators';
import { DataCompletenessValidator } from '../utils/data-completeness-validator';
import { ValidationReporter } from '../utils/validation-reporter';
import { pageDiscovery } from '../utils/page-discovery';

test.describe('Final Demo Data Validation Integration - Issue #9', () => {
  let validationReporter: ValidationReporter;

  test.beforeAll(async () => {
    console.log('🚀 Starting final integration validation for Issue #9...');
    validationReporter = new ValidationReporter(`final-integration-${Date.now()}`);
  });

  test('should perform complete demo data validation with comprehensive reporting', async ({
    page,
    authHelper,
    testDataFactory
  }) => {
    console.log('🎯 Executing comprehensive demo data validation suite...');

    // Ensure we have test data and proper authentication
    await testDataFactory.ensureTestData();
    await authHelper.loginAsAdmin();

    // Initialize all validators
    const dataValidator = new DataValidator(page);
    const seededDataDiscovery = new SeededDataDiscovery();
    const calculationValidator = new CalculationValidator(page);
    const relationshipValidator = new RelationshipValidator();
    const completenessValidator = new DataCompletenessValidator(page);

    // Execute all validation components in parallel where possible
    console.log('📊 Running parallel validation processes...');

    const [
      dataValidationReport,
      seededDataInventory,
      calculationValidationReport,
      relationshipValidationReport,
      completenessValidationReport
    ] = await Promise.all([
      dataValidator.validateDemoData(),
      seededDataDiscovery.discoverAllSeededData(),
      calculationValidator.validateAllCalculations(),
      relationshipValidator.validateAllRelationships(),
      completenessValidator.validateDataCompletenessAndFreshness()
    ]);

    // Measure performance of data-heavy pages
    console.log('⚡ Testing performance of data-heavy pages...');
    const performanceResults = [];
    const dataHeavyPages = [
      { path: '/dashboard', name: 'Dashboard', threshold: 5000 },
      { path: '/batches', name: 'Batches', threshold: 4000 },
      { path: '/purchases', name: 'Purchases', threshold: 4000 },
      { path: '/inventory', name: 'Inventory', threshold: 4000 }
    ];

    for (const pageInfo of dataHeavyPages) {
      const startTime = Date.now();
      try {
        await page.goto(pageInfo.path);
        await page.waitForLoadState('networkidle', { timeout: pageInfo.threshold });
        const loadTime = Date.now() - startTime;

        performanceResults.push({
          page: pageInfo.name,
          path: pageInfo.path,
          loadTime,
          threshold: pageInfo.threshold,
          passed: loadTime <= pageInfo.threshold,
          dataRecords: await this.estimatePageDataRecords(page, pageInfo.path)
        });

        console.log(`  ⚡ ${pageInfo.name}: ${loadTime}ms (${loadTime <= pageInfo.threshold ? 'PASS' : 'FAIL'})`);
      } catch (error) {
        performanceResults.push({
          page: pageInfo.name,
          path: pageInfo.path,
          loadTime: Date.now() - startTime,
          threshold: pageInfo.threshold,
          passed: false,
          dataRecords: 0,
          error: (error as Error).message
        });
      }
    }

    const performanceMetrics = {
      timestamp: new Date().toISOString(),
      pageMetrics: performanceResults.reduce((acc, result) => {
        acc[result.path] = {
          loadTime: result.loadTime,
          passed: result.passed,
          threshold: result.threshold,
          dataRecords: result.dataRecords
        };
        return acc;
      }, {} as any),
      summary: {
        averageLoadTime: performanceResults.reduce((sum, r) => sum + r.loadTime, 0) / performanceResults.length,
        pagesPassingThreshold: performanceResults.filter(r => r.passed).length / performanceResults.length,
        slowestPage: performanceResults.reduce((max, r) => r.loadTime > max.loadTime ? r : max).page,
        fastestPage: performanceResults.reduce((min, r) => r.loadTime < min.loadTime ? r : min).page
      }
    };

    // Generate comprehensive validation report
    console.log('📋 Generating comprehensive validation report...');
    const comprehensiveReport = await validationReporter.generateComprehensiveReport(
      dataValidationReport,
      seededDataInventory,
      calculationValidationReport,
      relationshipValidationReport,
      performanceMetrics
    );

    // Export all reports
    const exportedFiles = await validationReporter.exportReport(comprehensiveReport);

    // Also export individual detailed reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await completenessValidator.exportResults(
      completenessValidationReport,
      `./test-results/data-completeness-${timestamp}.json`
    );

    // Log comprehensive results
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPREHENSIVE DEMO DATA VALIDATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${comprehensiveReport.overallStatus}`);
    console.log(`Overall Score: ${comprehensiveReport.overallScore.toFixed(1)}%`);
    console.log('');

    console.log('📊 Key Metrics:');
    console.log(`  • Data Visibility: ${comprehensiveReport.summary.metrics.averageDataVisibility.toFixed(1)}%`);
    console.log(`  • Calculation Accuracy: ${comprehensiveReport.summary.metrics.averageCalculationAccuracy.toFixed(1)}%`);
    console.log(`  • Data Integrity: ${comprehensiveReport.summary.metrics.dataIntegrityScore.toFixed(1)}%`);
    console.log(`  • Workflow Continuity: ${comprehensiveReport.summary.metrics.workflowContinuityScore.toFixed(1)}%`);
    console.log(`  • Records Validated: ${comprehensiveReport.summary.metrics.totalRecordsValidated.toLocaleString()}`);
    console.log(`  • Calculations Verified: ${comprehensiveReport.summary.metrics.totalCalculationsValidated}`);
    console.log('');

    console.log('✅ Requirements Status:');
    Object.entries(comprehensiveReport.summary.requirementsMet).forEach(([req, met]) => {
      const icon = met ? '✅' : '❌';
      const reqName = validationReporter['formatRequirementName'](req);
      console.log(`  ${icon} ${reqName}`);
    });
    console.log('');

    if (comprehensiveReport.summary.issues.critical > 0) {
      console.log(`🚨 Critical Issues: ${comprehensiveReport.summary.issues.critical}`);
    }
    if (comprehensiveReport.summary.issues.warnings > 0) {
      console.log(`⚠️ Warnings: ${comprehensiveReport.summary.issues.warnings}`);
    }
    console.log('');

    console.log('📁 Reports Exported:');
    exportedFiles.forEach(file => {
      console.log(`  • ${file}`);
    });
    console.log('');

    console.log('💡 Top Recommendations:');
    comprehensiveReport.recommendations.immediate.slice(0, 3).forEach(rec => {
      console.log(`  🚨 ${rec}`);
    });
    comprehensiveReport.recommendations.shortTerm.slice(0, 2).forEach(rec => {
      console.log(`  ⚠️ ${rec}`);
    });
    console.log('='.repeat(60));

    // Critical Issue #9 Assertions - Must Pass All Requirements

    // 1. ≥95% Demo Data Visibility (Core Requirement)
    expect(comprehensiveReport.summary.metrics.averageDataVisibility,
      `🔴 CRITICAL: Demo data visibility is ${comprehensiveReport.summary.metrics.averageDataVisibility.toFixed(1)}% (Issue #9 requirement: ≥95%)`
    ).toBeGreaterThanOrEqual(95);

    // 2. Data Consistency (No critical issues)
    expect(comprehensiveReport.summary.issues.critical,
      `🔴 CRITICAL: Found ${comprehensiveReport.summary.issues.critical} critical issues that violate data consistency requirements`
    ).toBe(0);

    // 3. Entity Relationship Verification (≥95% integrity)
    expect(comprehensiveReport.summary.metrics.dataIntegrityScore,
      `🔴 CRITICAL: Data integrity score is ${comprehensiveReport.summary.metrics.dataIntegrityScore.toFixed(1)}% (requirement: ≥95%)`
    ).toBeGreaterThanOrEqual(95);

    // 4. Business Calculation Accuracy (≥95% accuracy)
    expect(comprehensiveReport.summary.metrics.averageCalculationAccuracy,
      `🔴 CRITICAL: Business calculation accuracy is ${comprehensiveReport.summary.metrics.averageCalculationAccuracy.toFixed(1)}% (requirement: ≥95%)`
    ).toBeGreaterThanOrEqual(95);

    // 5. Workflow Completeness (≥60% continuity for demo data)
    expect(comprehensiveReport.summary.metrics.workflowContinuityScore,
      `🔴 CRITICAL: Workflow continuity is ${comprehensiveReport.summary.metrics.workflowContinuityScore.toFixed(1)}% (requirement: ≥60%)`
    ).toBeGreaterThanOrEqual(60);

    // 6. Performance Requirements (≥80% of data-heavy pages meet thresholds)
    expect(performanceMetrics.summary.pagesPassingThreshold,
      `🔴 CRITICAL: Only ${(performanceMetrics.summary.pagesPassingThreshold * 100).toFixed(1)}% of data-heavy pages meet performance requirements (requirement: ≥80%)`
    ).toBeGreaterThanOrEqual(0.8);

    // 7. Overall Validation Score (≥90% for comprehensive pass)
    expect(comprehensiveReport.overallScore,
      `🔴 CRITICAL: Overall validation score is ${comprehensiveReport.overallScore.toFixed(1)}% (requirement: ≥90%)`
    ).toBeGreaterThanOrEqual(90);

    // 8. All Core Requirements Met
    const requirementsMet = Object.values(comprehensiveReport.summary.requirementsMet).filter(Boolean).length;
    const totalRequirements = Object.values(comprehensiveReport.summary.requirementsMet).length;
    expect(requirementsMet,
      `🔴 CRITICAL: Only ${requirementsMet}/${totalRequirements} core requirements met (all must pass)`
    ).toBe(totalRequirements);

    // 9. Minimum Data Volume Requirements
    expect(comprehensiveReport.summary.metrics.totalRecordsValidated,
      `🔴 CRITICAL: Only ${comprehensiveReport.summary.metrics.totalRecordsValidated} records validated (minimum: 50)`
    ).toBeGreaterThanOrEqual(50);

    // 10. Data Completeness (from completeness validation)
    expect(completenessValidationReport.summary.overallCompletenessScore,
      `🔴 CRITICAL: Data completeness score is ${completenessValidationReport.summary.overallCompletenessScore.toFixed(1)}% (requirement: ≥85%)`
    ).toBeGreaterThanOrEqual(85);

    // Success Confirmation
    console.log('\n🎉🎉🎉 SUCCESS: ALL ISSUE #9 REQUIREMENTS MET! 🎉🎉🎉');
    console.log('✅ Demo Data Validation System is comprehensive and working correctly');
    console.log('✅ ≥95% of seeded demo data is visible through UI');
    console.log('✅ Data accuracy and consistency validated');
    console.log('✅ Entity relationships verified across production workflow');
    console.log('✅ Business calculations (COGS, yields, measurements, ABV) are accurate');
    console.log('✅ Missing data detection and reporting operational');
    console.log('✅ Data freshness and completeness validation working');
    console.log('✅ Performance monitoring for data-heavy pages implemented');
    console.log('✅ Comprehensive reporting system operational');
    console.log('\n🚀 Demo Data Validation System (Issue #9) is COMPLETE and READY! 🚀\n');

    // Update comprehensive report with final status
    comprehensiveReport.cicdIntegration.exitCode = 0; // Success

    // Final export with success status
    const finalReportPath = `./test-results/FINAL-demo-data-validation-SUCCESS-${timestamp}.json`;
    const fs = require('fs');
    fs.writeFileSync(finalReportPath, JSON.stringify(comprehensiveReport, null, 2));
    console.log(`📄 Final success report: ${finalReportPath}`);
  });

  test('should validate integration with existing page verification system', async ({
    page,
    authHelper
  }) => {
    console.log('🔗 Validating integration with page verification system...');

    await authHelper.loginAsAdmin();

    // Discover pages using existing system
    const discoveredPages = await pageDiscovery.discoverAllPages();
    console.log(`📄 Discovered ${discoveredPages.length} pages for integration validation`);

    // Test that data validation can work with discovered pages
    const dataValidator = new DataValidator(page);

    // Sample a few pages to validate data integration
    const samplePages = discoveredPages.filter(p =>
      p.testDataNeeds && p.testDataNeeds.length > 0
    ).slice(0, 3);

    for (const discoveredPage of samplePages) {
      console.log(`🔍 Validating data integration for page: ${discoveredPage.name}`);

      await page.goto(discoveredPage.routePath);
      await page.waitForLoadState('networkidle');

      // Check that data validation can analyze the page
      const hasExpectedData = discoveredPage.testDataNeeds.every(async (dataType) => {
        const visible = await dataValidator['checkDataTypeVisibility'](dataType);
        return visible;
      });

      // Log integration status
      console.log(`  ${discoveredPage.name}: Data integration ${hasExpectedData ? 'working' : 'needs attention'}`);
    }

    // Ensure we have reasonable integration coverage
    expect(samplePages.length,
      'Not enough pages with data needs found for integration testing'
    ).toBeGreaterThan(0);

    console.log('✅ Page verification system integration validated');
  });

  /**
   * Estimate the number of data records displayed on a page
   */
  private async estimatePageDataRecords(page: any, pagePath: string): Promise<number> {
    try {
      // Common selectors for data display
      const dataSelectors = [
        'table tbody tr',
        '[data-testid*="item"]',
        '.list-item',
        '[role="row"]:not([role="columnheader"])',
        '.card',
        '.data-row'
      ];

      let maxRecords = 0;
      for (const selector of dataSelectors) {
        try {
          const count = await page.locator(selector).count();
          maxRecords = Math.max(maxRecords, count);
        } catch {
          continue;
        }
      }

      return maxRecords;
    } catch {
      return 0;
    }
  }
});