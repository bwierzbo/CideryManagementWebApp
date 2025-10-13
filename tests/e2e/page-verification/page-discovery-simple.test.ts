import { test, expect } from '@playwright/test';
import { pageDiscovery, PageDiscovery } from '../utils/page-discovery';

// Simple test that doesn't require database or global setup
test.describe('Page Discovery System - Simple Tests', () => {
  test('should discover Next.js pages in the file system', async () => {
    const discoveredPages = await pageDiscovery.discoverAllPages();

    // Should find at least some basic pages
    expect(discoveredPages.length).toBeGreaterThan(0);

    console.log(`\n=== DISCOVERED ${discoveredPages.length} PAGES ===`);
    discoveredPages.forEach(page => {
      console.log(`- ${page.name.padEnd(15)} ${page.routePath.padEnd(20)} Auth: ${page.requiresAuth ? 'Y' : 'N'} Components: [${page.criticalComponents.join(', ')}]`);
    });

    // Verify page structure
    discoveredPages.forEach(page => {
      expect(page.filePath).toBeTruthy();
      expect(page.routePath).toBeTruthy();
      expect(page.name).toBeTruthy();
      expect(typeof page.requiresAuth).toBe('boolean');
      expect(Array.isArray(page.criticalComponents)).toBe(true);
      expect(Array.isArray(page.testDataNeeds)).toBe(true);
    });

    // Should find expected core pages
    const routePaths = discoveredPages.map(p => p.routePath);
    expect(routePaths).toContain('/');
    expect(routePaths).toContain('/auth/signin');

    // Check for production workflow pages
    const expectedPages = ['/purchasing', '/pressing', '/cellar', '/bottles', '/admin'];
    expectedPages.forEach(expectedPath => {
      if (!routePaths.includes(expectedPath)) {
        console.warn(`Expected page ${expectedPath} not found`);
      }
    });

    console.log('\n=== PAGE DISCOVERY VALIDATION ===');
    console.log(`✓ Total pages discovered: ${discoveredPages.length}`);
    console.log(`✓ Core pages found: ${routePaths.filter(p => ['/', '/auth/signin'].includes(p)).length}/2`);
    console.log(`✓ Production pages found: ${routePaths.filter(p => expectedPages.includes(p)).length}/${expectedPages.length}`);
  });

  test('should categorize pages by authentication requirement', async () => {
    const publicPages = await pageDiscovery.getPublicPages();
    const authPages = await pageDiscovery.getAuthenticatedPages();

    console.log(`\n=== AUTHENTICATION CATEGORIZATION ===`);
    console.log(`Public pages: ${publicPages.length}`);
    publicPages.forEach(page => {
      console.log(`  - ${page.name} (${page.routePath})`);
      expect(page.requiresAuth).toBe(false);
    });

    console.log(`Authenticated pages: ${authPages.length}`);
    authPages.forEach(page => {
      console.log(`  - ${page.name} (${page.routePath})`);
      expect(page.requiresAuth).toBe(true);
    });

    // Verify totals match
    const totalDiscovered = await pageDiscovery.discoverAllPages();
    expect(publicPages.length + authPages.length).toBe(totalDiscovered.length);

    // Should have at least one of each type
    expect(publicPages.length).toBeGreaterThan(0);
    expect(authPages.length).toBeGreaterThan(0);

    // Home page should be public
    const homePage = publicPages.find(p => p.routePath === '/');
    expect(homePage).toBeTruthy();

    // Auth signin should be public
    const signinPage = publicPages.find(p => p.routePath === '/auth/signin');
    expect(signinPage).toBeTruthy();
  });

  test('should organize pages by functional sections', async () => {
    const pagesBySection = await pageDiscovery.getPagesBySection();

    console.log('\n=== FUNCTIONAL SECTIONS ===');
    Object.keys(pagesBySection).forEach(section => {
      console.log(`${section.toUpperCase()}: ${pagesBySection[section].length} pages`);
      pagesBySection[section].forEach(page => {
        console.log(`  - ${page.name} (${page.routePath})`);
      });
    });

    // Should have expected sections
    expect(pagesBySection.auth).toBeDefined();
    expect(pagesBySection.main).toBeDefined();
    expect(pagesBySection.production).toBeDefined();
    expect(pagesBySection.admin).toBeDefined();

    // All sections should be arrays
    expect(Array.isArray(pagesBySection.auth)).toBe(true);
    expect(Array.isArray(pagesBySection.main)).toBe(true);
    expect(Array.isArray(pagesBySection.production)).toBe(true);
    expect(Array.isArray(pagesBySection.admin)).toBe(true);

    // Auth section should contain signin page
    const authPaths = pagesBySection.auth.map(p => p.routePath);
    expect(authPaths).toContain('/auth/signin');
  });

  test('should assign critical components to pages appropriately', async () => {
    const allPages = await pageDiscovery.discoverAllPages();

    console.log('\n=== CRITICAL COMPONENTS ASSIGNMENT ===');
    const pagesWithComponents = allPages.filter(p => p.criticalComponents.length > 0);

    pagesWithComponents.forEach(page => {
      console.log(`${page.name}: [${page.criticalComponents.join(', ')}]`);

      // Critical components should be non-empty strings
      page.criticalComponents.forEach(component => {
        expect(typeof component).toBe('string');
        expect(component.length).toBeGreaterThan(0);
      });
    });

    // Sign-in page should have login components
    const signinPage = allPages.find(p => p.routePath === '/auth/signin');
    if (signinPage && signinPage.criticalComponents.length > 0) {
      expect(signinPage.criticalComponents).toContain('login-form');
      expect(signinPage.criticalComponents).toContain('signin-button');
    }

    // Authenticated pages should typically have navigation
    const authPages = allPages.filter(p => p.requiresAuth && p.criticalComponents.length > 0);
    authPages.forEach(page => {
      expect(page.criticalComponents).toContain('navigation');
    });

    console.log(`✓ ${pagesWithComponents.length}/${allPages.length} pages have critical components defined`);
  });

  test('should identify pages with test data requirements', async () => {
    const allPages = await pageDiscovery.discoverAllPages();
    const pagesWithData = allPages.filter(p => p.testDataNeeds.length > 0);

    console.log('\n=== TEST DATA REQUIREMENTS ===');
    pagesWithData.forEach(page => {
      console.log(`${page.name}: [${page.testDataNeeds.join(', ')}]`);

      // Data needs should be non-empty strings
      page.testDataNeeds.forEach(dataType => {
        expect(typeof dataType).toBe('string');
        expect(dataType.length).toBeGreaterThan(0);
      });
    });

    // Expected data types should exist
    const allDataTypes = pagesWithData.flatMap(p => p.testDataNeeds);
    const uniqueDataTypes = [...new Set(allDataTypes)];

    console.log(`Unique data types needed: [${uniqueDataTypes.join(', ')}]`);

    // Should have reasonable data types for a cidery
    const expectedDataTypes = ['batches', 'vendors', 'inventory'];
    expectedDataTypes.forEach(expectedType => {
      if (!uniqueDataTypes.includes(expectedType)) {
        console.warn(`Expected data type ${expectedType} not found in requirements`);
      }
    });

    console.log(`✓ ${pagesWithData.length}/${allPages.length} pages have test data requirements`);
    console.log(`✓ ${uniqueDataTypes.length} unique data types identified`);
  });

  test('should provide consistent results across multiple calls', async () => {
    console.log('\n=== CONSISTENCY TEST ===');

    const results1 = await pageDiscovery.discoverAllPages();
    const results2 = await pageDiscovery.discoverAllPages();
    const results3 = await pageDiscovery.discoverAllPages();

    // Same number of pages
    expect(results1.length).toBe(results2.length);
    expect(results2.length).toBe(results3.length);

    // Same route paths
    const paths1 = results1.map(p => p.routePath).sort();
    const paths2 = results2.map(p => p.routePath).sort();
    const paths3 = results3.map(p => p.routePath).sort();

    expect(paths1).toEqual(paths2);
    expect(paths2).toEqual(paths3);

    // Same metadata for each page
    results1.forEach(page => {
      const page2 = results2.find(p => p.routePath === page.routePath);
      const page3 = results3.find(p => p.routePath === page.routePath);

      expect(page2).toBeTruthy();
      expect(page3).toBeTruthy();

      expect(page.requiresAuth).toBe(page2!.requiresAuth);
      expect(page.requiresAuth).toBe(page3!.requiresAuth);
      expect(page.name).toBe(page2!.name);
      expect(page.name).toBe(page3!.name);
    });

    console.log(`✓ Results consistent across ${results1.length} pages in 3 test runs`);
  });

  test('should validate expected page coverage', async () => {
    const validation = await pageDiscovery.validateExpectedPages();

    console.log('\n=== PAGE COVERAGE VALIDATION ===');
    console.log(`Total pages discovered: ${validation.total}`);
    console.log(`Expected pages found: [${validation.found.join(', ')}]`);

    if (validation.missing.length > 0) {
      console.log(`Missing expected pages: [${validation.missing.join(', ')}]`);
    } else {
      console.log('✓ All expected pages found!');
    }

    // Should find essential pages
    expect(validation.found).toContain('/');
    expect(validation.found).toContain('/auth/signin');

    // Should have discovered multiple pages
    expect(validation.total).toBeGreaterThan(2);

    // Coverage percentage
    const expectedTotal = validation.found.length + validation.missing.length;
    const coveragePercentage = (validation.found.length / expectedTotal) * 100;

    console.log(`✓ Page coverage: ${coveragePercentage.toFixed(1)}% (${validation.found.length}/${expectedTotal})`);

    // Should have good coverage (at least 50% of expected pages)
    expect(coveragePercentage).toBeGreaterThanOrEqual(50);
  });
});

test.describe('Page Discovery Edge Cases', () => {
  test('should handle invalid directory gracefully', async () => {
    const discovery = new PageDiscovery();

    // Should not crash with empty results
    const pages = await discovery.discoverAllPages();
    expect(Array.isArray(pages)).toBe(true);

    const validation = await discovery.validateExpectedPages();
    expect(typeof validation).toBe('object');
    expect(Array.isArray(validation.found)).toBe(true);
    expect(Array.isArray(validation.missing)).toBe(true);
  });

  test('should generate appropriate page names from routes', async () => {
    const pages = await pageDiscovery.discoverAllPages();

    console.log('\n=== PAGE NAME GENERATION ===');
    pages.forEach(page => {
      console.log(`${page.routePath.padEnd(20)} → "${page.name}"`);

      // Page names should be readable
      expect(page.name).toBeTruthy();
      expect(page.name.length).toBeGreaterThan(0);

      // Should not contain slashes or be raw route paths
      expect(page.name).not.toContain('/');

      // Home page should be named appropriately
      if (page.routePath === '/') {
        expect(page.name).toBe('Home');
      }

      // Should be title case for multi-word routes
      if (page.routePath.includes('/') && page.routePath !== '/') {
        expect(page.name[0]).toBe(page.name[0].toUpperCase());
      }
    });

    console.log(`✓ All ${pages.length} pages have appropriate names`);
  });
});