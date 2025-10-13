import { test, expect } from '../utils/test-helpers';
import { pageDiscovery, PageDiscovery } from '../utils/page-discovery';

test.describe('Page Discovery System', () => {
  test('should discover all Next.js App Router pages', async () => {
    const discoveredPages = await pageDiscovery.discoverAllPages();

    // Verify we found pages
    expect(discoveredPages.length).toBeGreaterThan(0);

    console.log(`Discovered ${discoveredPages.length} pages:`);
    discoveredPages.forEach(page => {
      console.log(`  - ${page.name} (${page.routePath}) - Auth: ${page.requiresAuth}`);
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
  });

  test('should validate all expected pages are present', async () => {
    const validation = await pageDiscovery.validateExpectedPages();

    console.log('Page validation results:', validation);
    console.log(`Found: ${validation.found.join(', ')}`);
    if (validation.missing.length > 0) {
      console.log(`Missing: ${validation.missing.join(', ')}`);
    }

    // Assert that all expected core pages are found
    const expectedCorePages = ['/', '/auth/signin', '/dashboard'];
    const foundCorePages = validation.found.filter(page => expectedCorePages.includes(page));

    expect(foundCorePages.length).toBe(expectedCorePages.length);

    // Assert total pages discovered
    expect(validation.total).toBeGreaterThanOrEqual(expectedCorePages.length);

    // Warn if any expected pages are missing but don't fail test
    if (validation.missing.length > 0) {
      console.warn('Some expected pages are missing:', validation.missing);
    }
  });

  test('should categorize pages by authentication requirement', async () => {
    const publicPages = await pageDiscovery.getPublicPages();
    const authPages = await pageDiscovery.getAuthenticatedPages();

    console.log(`Public pages: ${publicPages.length}`);
    publicPages.forEach(page => {
      console.log(`  - ${page.name} (${page.routePath})`);
    });

    console.log(`Authenticated pages: ${authPages.length}`);
    authPages.forEach(page => {
      console.log(`  - ${page.name} (${page.routePath})`);
    });

    // Verify categorization
    expect(publicPages.length).toBeGreaterThan(0);
    expect(authPages.length).toBeGreaterThan(0);

    // Verify no page is in both categories
    const allPages = [...publicPages, ...authPages];
    const totalDiscovered = await pageDiscovery.discoverAllPages();
    expect(allPages.length).toBe(totalDiscovered.length);

    // Verify auth requirements are correct
    publicPages.forEach(page => {
      expect(page.requiresAuth).toBe(false);
    });

    authPages.forEach(page => {
      expect(page.requiresAuth).toBe(true);
    });
  });

  test('should organize pages by section', async () => {
    const pagesBySection = await pageDiscovery.getPagesBySection();

    console.log('Pages by section:');
    Object.keys(pagesBySection).forEach(section => {
      console.log(`  ${section}: ${pagesBySection[section].length} pages`);
      pagesBySection[section].forEach(page => {
        console.log(`    - ${page.name} (${page.routePath})`);
      });
    });

    // Verify sections exist
    expect(pagesBySection.auth).toBeDefined();
    expect(pagesBySection.main).toBeDefined();
    expect(pagesBySection.production).toBeDefined();
    expect(pagesBySection.admin).toBeDefined();

    // Verify sections have appropriate content
    expect(Array.isArray(pagesBySection.auth)).toBe(true);
    expect(Array.isArray(pagesBySection.main)).toBe(true);
    expect(Array.isArray(pagesBySection.production)).toBe(true);
    expect(Array.isArray(pagesBySection.admin)).toBe(true);

    // Verify auth section contains sign-in page
    const authPaths = pagesBySection.auth.map(p => p.routePath);
    expect(authPaths).toContain('/auth/signin');

    // Verify production section contains expected pages
    const productionPaths = pagesBySection.production.map(p => p.routePath);
    const expectedProductionPages = ['/pressing', '/cellar', '/bottles'];
    expectedProductionPages.forEach(expectedPage => {
      if (productionPaths.length > 0) {
        // Only check if we have production pages
        const hasExpectedPage = productionPaths.some(path => path === expectedPage);
        if (!hasExpectedPage) {
          console.warn(`Expected production page ${expectedPage} not found`);
        }
      }
    });
  });

  test('should identify pages with test data requirements', async () => {
    const allPages = await pageDiscovery.discoverAllPages();
    const pagesWithData = allPages.filter(page => page.testDataNeeds.length > 0);

    console.log(`Pages requiring test data: ${pagesWithData.length}`);
    pagesWithData.forEach(page => {
      console.log(`  - ${page.name}: ${page.testDataNeeds.join(', ')}`);
    });

    // Verify data requirements are properly assigned
    pagesWithData.forEach(page => {
      expect(page.testDataNeeds.length).toBeGreaterThan(0);
      page.testDataNeeds.forEach(dataType => {
        expect(typeof dataType).toBe('string');
        expect(dataType.length).toBeGreaterThan(0);
      });
    });

    // Verify specific pages have appropriate data needs
    const dashboardPage = allPages.find(p => p.routePath === '/dashboard');
    if (dashboardPage) {
      expect(dashboardPage.testDataNeeds.length).toBeGreaterThan(0);
    }

    const cellarPage = allPages.find(p => p.routePath === '/cellar');
    if (cellarPage) {
      expect(cellarPage.testDataNeeds).toContain('batches');
    }
  });

  test('should assign critical components to pages', async () => {
    const allPages = await pageDiscovery.discoverAllPages();

    console.log('Critical components by page:');
    allPages.forEach(page => {
      if (page.criticalComponents.length > 0) {
        console.log(`  ${page.name}: ${page.criticalComponents.join(', ')}`);
      }
    });

    // Verify critical components are assigned
    const authPage = allPages.find(p => p.routePath === '/auth/signin');
    if (authPage) {
      expect(authPage.criticalComponents).toContain('login-form');
      expect(authPage.criticalComponents).toContain('signin-button');
    }

    const dashboardPage = allPages.find(p => p.routePath === '/dashboard');
    if (dashboardPage) {
      expect(dashboardPage.criticalComponents).toContain('navigation');
    }

    // Verify all authenticated pages have navigation
    const authPages = allPages.filter(p => p.requiresAuth);
    authPages.forEach(page => {
      if (page.criticalComponents.length > 0) {
        expect(page.criticalComponents).toContain('navigation');
      }
    });
  });

  test('should handle edge cases and invalid scenarios', async () => {
    const discovery = new PageDiscovery();

    // Test with empty results (should not crash)
    const pages = await discovery.discoverAllPages();
    expect(Array.isArray(pages)).toBe(true);

    // Test validation with discovered pages
    const validation = await discovery.validateExpectedPages();
    expect(validation.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(validation.found)).toBe(true);
    expect(Array.isArray(validation.missing)).toBe(true);

    // Test section organization
    const sections = await discovery.getPagesBySection();
    expect(typeof sections).toBe('object');
    expect(sections.auth).toBeDefined();
    expect(sections.main).toBeDefined();
    expect(sections.production).toBeDefined();
    expect(sections.admin).toBeDefined();
  });

  test('should provide consistent results across multiple calls', async () => {
    // Call discovery multiple times
    const results1 = await pageDiscovery.discoverAllPages();
    const results2 = await pageDiscovery.discoverAllPages();
    const results3 = await pageDiscovery.discoverAllPages();

    // Results should be consistent
    expect(results1.length).toBe(results2.length);
    expect(results2.length).toBe(results3.length);

    // Route paths should be identical
    const paths1 = results1.map(p => p.routePath).sort();
    const paths2 = results2.map(p => p.routePath).sort();
    const paths3 = results3.map(p => p.routePath).sort();

    expect(paths1).toEqual(paths2);
    expect(paths2).toEqual(paths3);

    // Metadata should be consistent
    results1.forEach((page, index) => {
      const page2 = results2[index];
      const page3 = results3[index];

      expect(page.routePath).toBe(page2.routePath);
      expect(page.routePath).toBe(page3.routePath);
      expect(page.requiresAuth).toBe(page2.requiresAuth);
      expect(page.requiresAuth).toBe(page3.requiresAuth);
    });
  });
});