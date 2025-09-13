import { test, expect } from '../utils/test-helpers';
import { DataValidator } from '../utils/data-validation';
import { SeededDataDiscovery } from '../utils/seeded-data-discovery';
import { CalculationValidator } from '../utils/calculation-validators';
import { RelationshipValidator } from '../utils/relationship-validators';

test.describe('Demo Data Validation System - Issue #9', () => {
  let dataValidator: DataValidator;
  let seededDataDiscovery: SeededDataDiscovery;
  let calculationValidator: CalculationValidator;
  let relationshipValidator: RelationshipValidator;

  test.beforeAll(async () => {
    console.log('🚀 Starting comprehensive demo data validation for Issue #9...');
  });

  test.beforeEach(async ({ page, authHelper, testDataFactory }) => {
    // Ensure we have test data and authentication
    await testDataFactory.ensureTestData();
    await authHelper.loginAsAdmin();

    // Initialize validators
    dataValidator = new DataValidator(page);
    seededDataDiscovery = new SeededDataDiscovery();
    calculationValidator = new CalculationValidator(page);
    relationshipValidator = new RelationshipValidator();
  });

  test.describe('Core Requirement: ≥95% Demo Data Visibility', () => {
    test('should verify ≥95% of seeded demo data is visible through UI', async ({ page }) => {
      console.log('📊 Validating demo data visibility...');

      const validationReport = await dataValidator.validateDemoData();

      // Log detailed results
      console.log('\n=== DEMO DATA VISIBILITY REPORT ===');
      console.log(`Overall Visibility: ${validationReport.summary.overallVisibilityPercentage.toFixed(1)}%`);
      console.log(`Entities Passed: ${validationReport.summary.passedEntities}/${validationReport.summary.totalEntities}`);
      console.log(`Critical Issues: ${validationReport.summary.criticalIssues}`);
      console.log(`Warnings: ${validationReport.summary.warnings}`);

      // Log individual entity results
      validationReport.entityValidation.forEach(entity => {
        const status = entity.passed ? '✅' : '❌';
        console.log(`  ${status} ${entity.entityType}: ${entity.visibilityPercentage.toFixed(1)}% (${entity.uiCount}/${entity.dbCount})`);

        if (entity.issues.length > 0) {
          entity.issues.forEach(issue => {
            console.log(`    ⚠️ ${issue}`);
          });
        }
      });

      // Export results for analysis
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await dataValidator.exportResults(validationReport, `./test-results/demo-data-validation-${timestamp}.json`);

      // Core assertion: Overall visibility must be ≥95%
      expect(validationReport.summary.overallVisibilityPercentage,
        `Overall demo data visibility is ${validationReport.summary.overallVisibilityPercentage.toFixed(1)}% (requirement: ≥95%)`
      ).toBeGreaterThanOrEqual(95);

      // Ensure no critical issues
      expect(validationReport.summary.criticalIssues,
        `Found ${validationReport.summary.criticalIssues} critical visibility issues`
      ).toBe(0);

      // At least 90% of entity types should pass individual validation
      const entityPassRate = (validationReport.summary.passedEntities / validationReport.summary.totalEntities) * 100;
      expect(entityPassRate,
        `Only ${entityPassRate.toFixed(1)}% of entity types passed validation (requirement: ≥90%)`
      ).toBeGreaterThanOrEqual(90);
    });

    test('should validate data consistency between database and UI displays', async ({ page }) => {
      console.log('🔄 Validating database-UI consistency...');

      const validationReport = await dataValidator.validateDemoData();

      // Check for significant database vs UI count mismatches
      const significantMismatches = validationReport.entityValidation.filter(entity => {
        const countDifference = Math.abs(entity.dbCount - entity.uiCount);
        const percentageDifference = entity.dbCount > 0 ? (countDifference / entity.dbCount) * 100 : 0;
        return percentageDifference > 10; // More than 10% difference
      });

      console.log('\n=== DATABASE-UI CONSISTENCY CHECK ===');
      if (significantMismatches.length > 0) {
        console.log('❌ Significant mismatches found:');
        significantMismatches.forEach(entity => {
          console.log(`  - ${entity.entityType}: DB=${entity.dbCount}, UI=${entity.uiCount}`);
        });
      } else {
        console.log('✅ All entity counts are consistent between database and UI');
      }

      // Assertion: No more than 1 entity type should have significant mismatches
      expect(significantMismatches.length,
        `${significantMismatches.length} entity types have significant DB-UI count mismatches`
      ).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Entity Relationship Verification', () => {
    test('should verify entity relationships across the production workflow', async () => {
      console.log('🔗 Validating entity relationships...');

      const relationshipReport = await relationshipValidator.validateAllRelationships();

      // Log relationship validation results
      console.log('\n=== ENTITY RELATIONSHIP VALIDATION ===');
      console.log(`Data Integrity Score: ${relationshipReport.dataIntegrityScore.toFixed(1)}%`);
      console.log(`Passed Relationships: ${relationshipReport.summary.passedRelationships}/${relationshipReport.summary.totalRelationships}`);
      console.log(`Orphaned Records: ${relationshipReport.summary.orphanedRecords}`);
      console.log(`Critical Issues: ${relationshipReport.summary.criticalIssues}`);

      // Log individual relationship results
      relationshipReport.relationshipValidations.forEach(rel => {
        const status = rel.passed ? '✅' : '❌';
        const severity = rel.severity === 'critical' ? '🚨' : rel.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${status} ${severity} ${rel.relationshipType}: ${rel.message}`);
      });

      // Log workflow continuity
      console.log('\n=== WORKFLOW CONTINUITY ===');
      relationshipReport.workflowValidations.forEach(workflow => {
        const status = workflow.passed ? '✅' : '❌';
        console.log(`  ${status} ${workflow.workflowType}: ${workflow.continuityPercentage.toFixed(1)}% continuity`);
        console.log(`    Complete chains: ${workflow.completeChains}, Broken chains: ${workflow.brokenChains}`);
      });

      // Export results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await relationshipValidator.exportResults(relationshipReport, `./test-results/relationship-validation-${timestamp}.json`);

      // Core assertions
      expect(relationshipReport.summary.criticalIssues,
        `Found ${relationshipReport.summary.criticalIssues} critical referential integrity issues`
      ).toBe(0);

      expect(relationshipReport.summary.orphanedRecords,
        `Found ${relationshipReport.summary.orphanedRecords} orphaned records`
      ).toBe(0);

      expect(relationshipReport.dataIntegrityScore,
        `Data integrity score is ${relationshipReport.dataIntegrityScore.toFixed(1)}% (requirement: ≥95%)`
      ).toBeGreaterThanOrEqual(95);

      // Workflow continuity should be reasonable for demo data
      expect(relationshipReport.summary.workflowContinuity,
        `Workflow continuity is ${relationshipReport.summary.workflowContinuity.toFixed(1)}% (requirement: ≥60%)`
      ).toBeGreaterThanOrEqual(60);
    });

    test('should validate vendor → purchase → pressing → fermentation → packaging → inventory workflow', async () => {
      console.log('🏭 Validating complete production workflow...');

      const relationshipReport = await relationshipValidator.validateAllRelationships();
      const completeWorkflow = relationshipReport.workflowValidations.find(w => w.workflowType === 'complete_production');

      console.log('\n=== COMPLETE PRODUCTION WORKFLOW ===');
      if (completeWorkflow) {
        console.log(`Complete workflow chains: ${completeWorkflow.completeChains}`);
        console.log(`Broken chains: ${completeWorkflow.brokenChains}`);
        console.log(`Continuity: ${completeWorkflow.continuityPercentage.toFixed(1)}%`);

        if (completeWorkflow.gapDescriptions.length > 0) {
          console.log('Workflow gaps:');
          completeWorkflow.gapDescriptions.forEach(gap => {
            console.log(`  - ${gap}`);
          });
        }
      }

      // Assert that we have some complete production workflows
      expect(completeWorkflow?.completeChains,
        'No complete production workflows found (vendor → inventory)'
      ).toBeGreaterThan(0);

      expect(completeWorkflow?.continuityPercentage,
        `Complete production workflow continuity is ${completeWorkflow?.continuityPercentage.toFixed(1)}% (requirement: ≥20%)`
      ).toBeGreaterThanOrEqual(20);
    });
  });

  test.describe('Business Calculation Validation', () => {
    test('should validate COGS, yields, measurements, and ABV calculations', async ({ page }) => {
      console.log('🧮 Validating business calculations...');

      const calculationReport = await calculationValidator.validateAllCalculations();

      // Log calculation validation results
      console.log('\n=== BUSINESS CALCULATION VALIDATION ===');
      console.log(`Overall Accuracy: ${calculationReport.summary.averageAccuracy.toFixed(1)}%`);
      console.log(`Passed Calculations: ${calculationReport.summary.passedCalculations}/${calculationReport.summary.totalCalculations}`);
      console.log(`Failed Calculations: ${calculationReport.summary.failedCalculations}`);
      console.log(`Critical Failures: ${calculationReport.summary.criticalFailures}`);
      console.log(`Warnings: ${calculationReport.summary.warnings}`);

      // Log calculation type summary
      console.log('\n=== CALCULATION TYPES SUMMARY ===');
      Object.entries(calculationReport.calculationTypes).forEach(([type, stats]) => {
        const accuracy = stats.averageAccuracy.toFixed(1);
        const status = stats.averageAccuracy >= 95 ? '✅' : stats.averageAccuracy >= 80 ? '⚠️' : '❌';
        console.log(`  ${status} ${type}: ${accuracy}% accuracy (${stats.passed}/${stats.total})`);
      });

      // Log critical failures
      const criticalFailures = calculationReport.validations.filter(v => !v.passed && v.severity === 'critical');
      if (criticalFailures.length > 0) {
        console.log('\n=== CRITICAL CALCULATION FAILURES ===');
        criticalFailures.forEach(failure => {
          console.log(`  ❌ ${failure.calculationType} - ${failure.fieldName}: ${failure.message}`);
        });
      }

      // Export results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await calculationValidator.exportResults(calculationReport, `./test-results/calculation-validation-${timestamp}.json`);

      // Core assertions
      expect(calculationReport.summary.criticalFailures,
        `Found ${calculationReport.summary.criticalFailures} critical calculation errors`
      ).toBe(0);

      expect(calculationReport.summary.averageAccuracy,
        `Calculation accuracy is ${calculationReport.summary.averageAccuracy.toFixed(1)}% (requirement: ≥95%)`
      ).toBeGreaterThanOrEqual(95);

      // Specific calculation type validations
      const purchaseCosts = calculationReport.calculationTypes['purchase_cost'];
      if (purchaseCosts) {
        expect(purchaseCosts.averageAccuracy,
          `Purchase cost calculations are ${purchaseCosts.averageAccuracy.toFixed(1)}% accurate (requirement: ≥98%)`
        ).toBeGreaterThanOrEqual(98);
      }

      const batchCosts = calculationReport.calculationTypes['batch_total_cost'];
      if (batchCosts) {
        expect(batchCosts.averageAccuracy,
          `Batch cost calculations are ${batchCosts.averageAccuracy.toFixed(1)}% accurate (requirement: ≥95%)`
        ).toBeGreaterThanOrEqual(95);
      }
    });

    test('should validate extraction rates and yield calculations', async () => {
      console.log('📈 Validating extraction rates and yields...');

      const calculationReport = await calculationValidator.validateAllCalculations();

      const extractionRates = calculationReport.validations.filter(v => v.calculationType === 'extraction_rate');
      const yieldCalculations = calculationReport.validations.filter(v => v.calculationType === 'pressing_yield');

      console.log('\n=== EXTRACTION RATES AND YIELDS ===');
      console.log(`Extraction rate calculations: ${extractionRates.length}`);
      console.log(`Yield calculations: ${yieldCalculations.length}`);

      // Log any out-of-range yields
      const badYields = yieldCalculations.filter(y => !y.passed);
      if (badYields.length > 0) {
        console.log('⚠️ Out-of-range yields found:');
        badYields.forEach(yield => {
          console.log(`  - ${yield.entityId}: ${yield.actualValue} (expected: ${yield.expectedValue})`);
        });
      }

      // Most extraction rates should be reasonable (between 0.4-0.8 L/kg)
      const reasonableExtractionRates = extractionRates.filter(er => {
        const rate = typeof er.actualValue === 'number' ? er.actualValue : parseFloat(er.actualValue.toString());
        return rate >= 0.4 && rate <= 0.8;
      });

      if (extractionRates.length > 0) {
        const reasonablePercentage = (reasonableExtractionRates.length / extractionRates.length) * 100;
        expect(reasonablePercentage,
          `Only ${reasonablePercentage.toFixed(1)}% of extraction rates are in reasonable range (0.4-0.8 L/kg)`
        ).toBeGreaterThanOrEqual(80);
      }
    });
  });

  test.describe('Data Completeness and Freshness', () => {
    test('should validate data completeness across all entities', async () => {
      console.log('📋 Validating data completeness...');

      const seededInventory = await seededDataDiscovery.discoverAllSeededData();

      console.log('\n=== SEEDED DATA INVENTORY ===');
      console.log(`Total entities: ${seededInventory.totalEntities}`);
      console.log(`Total records: ${seededInventory.totalRecords}`);

      // Log entity record counts
      console.log('\n=== ENTITY RECORD COUNTS ===');
      seededInventory.entities.forEach(entity => {
        const adequateData = entity.recordCount >= 3 ? '✅' : entity.recordCount >= 1 ? '⚠️' : '❌';
        console.log(`  ${adequateData} ${entity.entityType}: ${entity.recordCount} records`);

        // Log data quality issues
        if (entity.dataQuality.referencialIntegrityIssues > 0) {
          console.log(`    🔴 ${entity.dataQuality.referencialIntegrityIssues} referential integrity issues`);
        }
      });

      // Log business workflow coverage
      console.log('\n=== BUSINESS WORKFLOW COVERAGE ===');
      const workflow = seededInventory.businessWorkflowCoverage;
      console.log(`  Vendor → Purchase: ${workflow.vendorToPurchase ? '✅' : '❌'}`);
      console.log(`  Purchase → Pressing: ${workflow.purchaseToPressing ? '✅' : '❌'}`);
      console.log(`  Pressing → Fermentation: ${workflow.pressingToFermentation ? '✅' : '❌'}`);
      console.log(`  Fermentation → Packaging: ${workflow.fermentationToPackaging ? '✅' : '❌'}`);
      console.log(`  Packaging → Inventory: ${workflow.packagingToInventory ? '✅' : '❌'}`);
      console.log(`  Complete workflow examples: ${workflow.completeWorkflowExamples}`);

      if (workflow.partialWorkflowGaps.length > 0) {
        console.log('  Workflow gaps:');
        workflow.partialWorkflowGaps.forEach(gap => {
          console.log(`    - ${gap}`);
        });
      }

      // Export inventory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await seededDataDiscovery.exportInventory(seededInventory, `./test-results/seeded-data-inventory-${timestamp}.json`);

      // Core assertions
      expect(seededInventory.totalRecords,
        `Only ${seededInventory.totalRecords} total records found (requirement: ≥50)`
      ).toBeGreaterThanOrEqual(50);

      // All critical entity types should have data
      const criticalEntities = ['vendors', 'purchases', 'batches', 'users'];
      criticalEntities.forEach(entityType => {
        const entity = seededInventory.entities.find(e => e.entityType === entityType);
        expect(entity?.recordCount,
          `Critical entity type '${entityType}' has ${entity?.recordCount || 0} records (minimum: 1)`
        ).toBeGreaterThanOrEqual(1);
      });

      // Should have at least one complete workflow
      expect(workflow.completeWorkflowExamples,
        'No complete workflow examples found (vendor → inventory)'
      ).toBeGreaterThan(0);
    });

    test('should validate data freshness and detect missing data', async () => {
      console.log('⏰ Validating data freshness...');

      const validationReport = await dataValidator.validateDemoData();
      const freshness = validationReport.dataFreshness;

      console.log('\n=== DATA FRESHNESS ===');
      console.log(`Last updated: ${freshness.lastUpdated.toISOString()}`);
      console.log(`Days old: ${freshness.staleDays}`);
      console.log(`Is stale: ${freshness.isStale ? 'Yes' : 'No'}`);

      // For demo data, we don't expect it to be updated frequently,
      // but it shouldn't be completely empty or extremely old
      expect(freshness.staleDays,
        `Demo data is ${freshness.staleDays} days old (maximum acceptable: 365 days)`
      ).toBeLessThanOrEqual(365);

      expect(validationReport.completenessScore,
        `Data completeness score is ${validationReport.completenessScore.toFixed(1)}% (requirement: ≥80%)`
      ).toBeGreaterThanOrEqual(80);
    });
  });

  test.describe('Performance Monitoring for Data-Heavy Pages', () => {
    test('should monitor performance of data-heavy pages', async ({ page }) => {
      console.log('⚡ Monitoring performance of data-heavy pages...');

      const dataHeavyPages = [
        { path: '/dashboard', name: 'Dashboard', timeout: 5000 },
        { path: '/batches', name: 'Batches List', timeout: 4000 },
        { path: '/purchases', name: 'Purchases List', timeout: 4000 },
        { path: '/inventory', name: 'Inventory List', timeout: 4000 },
        { path: '/reports', name: 'Reports', timeout: 6000 }
      ];

      const performanceResults = [];

      for (const pageInfo of dataHeavyPages) {
        const startTime = Date.now();

        try {
          await page.goto(pageInfo.path);
          await page.waitForLoadState('networkidle', { timeout: pageInfo.timeout });

          const loadTime = Date.now() - startTime;
          const passed = loadTime <= pageInfo.timeout;

          performanceResults.push({
            page: pageInfo.name,
            path: pageInfo.path,
            loadTime,
            timeout: pageInfo.timeout,
            passed
          });

          console.log(`  ${passed ? '✅' : '❌'} ${pageInfo.name}: ${loadTime}ms (limit: ${pageInfo.timeout}ms)`);

        } catch (error) {
          const loadTime = Date.now() - startTime;
          performanceResults.push({
            page: pageInfo.name,
            path: pageInfo.path,
            loadTime,
            timeout: pageInfo.timeout,
            passed: false,
            error: (error as Error).message
          });

          console.log(`  ❌ ${pageInfo.name}: Failed after ${loadTime}ms - ${(error as Error).message}`);
        }
      }

      // Performance summary
      const passedPages = performanceResults.filter(r => r.passed).length;
      const averageLoadTime = performanceResults.reduce((sum, r) => sum + r.loadTime, 0) / performanceResults.length;

      console.log('\n=== PERFORMANCE SUMMARY ===');
      console.log(`Pages passed: ${passedPages}/${performanceResults.length}`);
      console.log(`Average load time: ${averageLoadTime.toFixed(0)}ms`);

      // Export performance results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fs = require('fs');
      const path = require('path');
      const resultsDir = './test-results';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(resultsDir, `performance-data-heavy-pages-${timestamp}.json`),
        JSON.stringify({ timestamp, results: performanceResults, summary: { passedPages, averageLoadTime } }, null, 2)
      );

      // Assertions
      expect(passedPages / performanceResults.length,
        `Only ${((passedPages / performanceResults.length) * 100).toFixed(1)}% of data-heavy pages met performance requirements`
      ).toBeGreaterThanOrEqual(0.8); // 80% should pass

      expect(averageLoadTime,
        `Average load time is ${averageLoadTime.toFixed(0)}ms (maximum: 4000ms)`
      ).toBeLessThanOrEqual(4000);
    });
  });

  test.describe('Integration and Final Validation', () => {
    test('should generate comprehensive demo data validation report', async ({ page }) => {
      console.log('📊 Generating comprehensive validation report...');

      // Run all validations
      const [dataReport, seededInventory, calculationReport, relationshipReport] = await Promise.all([
        dataValidator.validateDemoData(),
        seededDataDiscovery.discoverAllSeededData(),
        calculationValidator.validateAllCalculations(),
        relationshipValidator.validateAllRelationships()
      ]);

      // Create comprehensive report
      const comprehensiveReport = {
        timestamp: new Date().toISOString(),
        summary: {
          dataVisibility: {
            overallPercentage: dataReport.summary.overallVisibilityPercentage,
            passedEntities: dataReport.summary.passedEntities,
            totalEntities: dataReport.summary.totalEntities,
            criticalIssues: dataReport.summary.criticalIssues
          },
          calculations: {
            averageAccuracy: calculationReport.summary.averageAccuracy,
            passedCalculations: calculationReport.summary.passedCalculations,
            totalCalculations: calculationReport.summary.totalCalculations,
            criticalFailures: calculationReport.summary.criticalFailures
          },
          relationships: {
            dataIntegrityScore: relationshipReport.dataIntegrityScore,
            passedRelationships: relationshipReport.summary.passedRelationships,
            totalRelationships: relationshipReport.summary.totalRelationships,
            workflowContinuity: relationshipReport.summary.workflowContinuity
          },
          data: {
            totalRecords: seededInventory.totalRecords,
            totalEntities: seededInventory.totalEntities,
            completenessScore: dataReport.completenessScore
          }
        },
        detailedReports: {
          dataValidation: dataReport,
          seededInventory: seededInventory,
          calculationValidation: calculationReport,
          relationshipValidation: relationshipReport
        },
        overallScore: 0, // Will calculate below
        recommendations: []
      };

      // Calculate overall score (weighted average)
      const scores = [
        { score: dataReport.summary.overallVisibilityPercentage, weight: 0.3 }, // 30% - Data visibility
        { score: calculationReport.summary.averageAccuracy, weight: 0.25 }, // 25% - Calculation accuracy
        { score: relationshipReport.dataIntegrityScore, weight: 0.25 }, // 25% - Relationship integrity
        { score: relationshipReport.summary.workflowContinuity, weight: 0.2 } // 20% - Workflow continuity
      ];

      comprehensiveReport.overallScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);

      // Combine recommendations
      comprehensiveReport.recommendations = [
        ...dataReport.recommendations,
        ...calculationReport.recommendations,
        ...relationshipReport.recommendations,
        ...seededInventory.recommendations
      ].filter((rec, index, arr) => arr.indexOf(rec) === index); // Remove duplicates

      // Export comprehensive report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fs = require('fs');
      const path = require('path');
      const resultsDir = './test-results';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const reportPath = path.join(resultsDir, `comprehensive-demo-data-validation-${timestamp}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(comprehensiveReport, null, 2));

      // Log final results
      console.log('\n=== COMPREHENSIVE VALIDATION RESULTS ===');
      console.log(`Overall Score: ${comprehensiveReport.overallScore.toFixed(1)}%`);
      console.log(`Data Visibility: ${dataReport.summary.overallVisibilityPercentage.toFixed(1)}%`);
      console.log(`Calculation Accuracy: ${calculationReport.summary.averageAccuracy.toFixed(1)}%`);
      console.log(`Relationship Integrity: ${relationshipReport.dataIntegrityScore.toFixed(1)}%`);
      console.log(`Workflow Continuity: ${relationshipReport.summary.workflowContinuity.toFixed(1)}%`);
      console.log(`Data Completeness: ${dataReport.completenessScore.toFixed(1)}%`);
      console.log(`\nComprehensive report saved to: ${reportPath}`);

      // Final assertions for Issue #9 requirements
      expect(comprehensiveReport.overallScore,
        `Overall demo data validation score is ${comprehensiveReport.overallScore.toFixed(1)}% (requirement: ≥90%)`
      ).toBeGreaterThanOrEqual(90);

      expect(dataReport.summary.overallVisibilityPercentage,
        `Demo data visibility is ${dataReport.summary.overallVisibilityPercentage.toFixed(1)}% (requirement: ≥95%)`
      ).toBeGreaterThanOrEqual(95);

      expect(dataReport.summary.criticalIssues + calculationReport.summary.criticalFailures + relationshipReport.summary.criticalIssues,
        'Found critical issues that must be resolved'
      ).toBe(0);

      console.log('\n🎉 Demo Data Validation System (Issue #9) - ALL REQUIREMENTS MET! 🎉');
    });
  });
});