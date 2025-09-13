import { readdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * Represents a discovered page in the Next.js App Router
 */
export interface DiscoveredPage {
  /** File system path to the page.tsx file */
  filePath: string;
  /** URL route path for the page */
  routePath: string;
  /** Page name for display purposes */
  name: string;
  /** Whether this page requires authentication */
  requiresAuth: boolean;
  /** Expected page title or title pattern */
  expectedTitle?: string;
  /** Critical UI components that must be present */
  criticalComponents: string[];
  /** Test data requirements */
  testDataNeeds: string[];
}

/**
 * Page discovery service for Next.js App Router pages
 */
export class PageDiscovery {
  private readonly webAppPath: string;
  private readonly appRouterPath: string;

  constructor() {
    this.webAppPath = join(process.cwd(), 'apps/web');
    this.appRouterPath = join(this.webAppPath, 'src/app');
  }

  /**
   * Discover all pages in the Next.js app
   */
  async discoverAllPages(): Promise<DiscoveredPage[]> {
    const pages: DiscoveredPage[] = [];

    try {
      await this.scanDirectory(this.appRouterPath, '', pages);
      return this.enrichPagesWithMetadata(pages);
    } catch (error) {
      console.error('Error discovering pages:', error);
      return [];
    }
  }

  /**
   * Recursively scan directory for page.tsx files
   */
  private async scanDirectory(
    dirPath: string,
    routePrefix: string,
    pages: DiscoveredPage[]
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Skip certain directories
          if (this.shouldSkipDirectory(entry)) {
            continue;
          }

          const newRoutePrefix = entry.startsWith('(') && entry.endsWith(')')
            ? routePrefix // Route groups don't affect URL
            : routePrefix + '/' + entry;

          await this.scanDirectory(fullPath, newRoutePrefix, pages);
        } else if (entry === 'page.tsx') {
          // Found a page file
          const routePath = routePrefix || '/';
          const name = this.generatePageName(routePath);

          pages.push({
            filePath: fullPath,
            routePath,
            name,
            requiresAuth: this.determineAuthRequirement(routePath),
            criticalComponents: [],
            testDataNeeds: []
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Determine if we should skip scanning a directory
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.next',
      'api', // API routes, not pages
      'components',
      'lib',
      'utils',
      'styles',
      'public'
    ];

    return skipPatterns.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Generate a readable name for the page
   */
  private generatePageName(routePath: string): string {
    if (routePath === '/') return 'Home';

    const segments = routePath.split('/').filter(Boolean);
    return segments
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  /**
   * Determine if a page requires authentication based on route
   */
  private determineAuthRequirement(routePath: string): boolean {
    const publicRoutes = ['/', '/auth/signin', '/auth/test'];
    return !publicRoutes.includes(routePath);
  }

  /**
   * Enrich pages with additional metadata based on their purpose
   */
  private enrichPagesWithMetadata(pages: DiscoveredPage[]): DiscoveredPage[] {
    return pages.map(page => {
      const enriched = { ...page };

      // Set expected titles and critical components based on page type
      switch (page.routePath) {
        case '/':
          enriched.expectedTitle = 'Cidery Management';
          enriched.criticalComponents = ['navigation', 'main-content'];
          break;

        case '/auth/signin':
          enriched.expectedTitle = 'Sign In';
          enriched.criticalComponents = ['login-form', 'signin-button'];
          enriched.requiresAuth = false;
          break;

        case '/dashboard':
          enriched.expectedTitle = 'Dashboard';
          enriched.criticalComponents = ['navigation', 'dashboard-widgets', 'main-content'];
          enriched.testDataNeeds = ['batches', 'inventory'];
          break;

        case '/purchasing':
          enriched.expectedTitle = 'Purchasing';
          enriched.criticalComponents = ['navigation', 'vendor-list', 'purchase-form'];
          enriched.testDataNeeds = ['vendors', 'purchases'];
          break;

        case '/pressing':
          enriched.expectedTitle = 'Pressing';
          enriched.criticalComponents = ['navigation', 'press-runs', 'juice-lots'];
          enriched.testDataNeeds = ['purchases', 'press-runs', 'juice-lots'];
          break;

        case '/cellar':
          enriched.expectedTitle = 'Cellar';
          enriched.criticalComponents = ['navigation', 'vessels', 'batches'];
          enriched.testDataNeeds = ['vessels', 'batches', 'measurements'];
          break;

        case '/packaging':
          enriched.expectedTitle = 'Packaging';
          enriched.criticalComponents = ['navigation', 'packaging-runs', 'inventory-items'];
          enriched.testDataNeeds = ['batches', 'packaging-runs', 'inventory'];
          break;

        case '/admin':
          enriched.expectedTitle = 'Administration';
          enriched.criticalComponents = ['navigation', 'admin-panels', 'user-management'];
          enriched.testDataNeeds = ['users', 'audit-logs'];
          break;

        default:
          enriched.expectedTitle = page.name;
          enriched.criticalComponents = ['navigation', 'main-content'];
      }

      return enriched;
    });
  }

  /**
   * Get pages that require specific test data
   */
  getPagesByTestDataNeeds(testDataType: string): DiscoveredPage[] {
    return this.discoverAllPages().then(pages =>
      pages.filter(page => page.testDataNeeds.includes(testDataType))
    ) as any; // Type assertion for simplicity in this context
  }

  /**
   * Get public pages that don't require authentication
   */
  async getPublicPages(): Promise<DiscoveredPage[]> {
    const pages = await this.discoverAllPages();
    return pages.filter(page => !page.requiresAuth);
  }

  /**
   * Get authenticated pages
   */
  async getAuthenticatedPages(): Promise<DiscoveredPage[]> {
    const pages = await this.discoverAllPages();
    return pages.filter(page => page.requiresAuth);
  }

  /**
   * Get pages by category/section
   */
  async getPagesBySection(): Promise<Record<string, DiscoveredPage[]>> {
    const pages = await this.discoverAllPages();

    const sections: Record<string, DiscoveredPage[]> = {
      auth: [],
      main: [],
      production: [],
      admin: []
    };

    pages.forEach(page => {
      if (page.routePath.startsWith('/auth')) {
        sections.auth.push(page);
      } else if (['/pressing', '/cellar', '/packaging'].includes(page.routePath)) {
        sections.production.push(page);
      } else if (page.routePath === '/admin') {
        sections.admin.push(page);
      } else {
        sections.main.push(page);
      }
    });

    return sections;
  }

  /**
   * Validate that all expected pages are present
   */
  async validateExpectedPages(): Promise<{
    found: string[];
    missing: string[];
    total: number;
  }> {
    const expectedPages = [
      '/',
      '/auth/signin',
      '/dashboard',
      '/purchasing',
      '/pressing',
      '/cellar',
      '/packaging',
      '/admin'
    ];

    const discoveredPages = await this.discoverAllPages();
    const foundPaths = discoveredPages.map(p => p.routePath);

    const found = expectedPages.filter(path => foundPaths.includes(path));
    const missing = expectedPages.filter(path => !foundPaths.includes(path));

    return {
      found,
      missing,
      total: discoveredPages.length
    };
  }
}

/**
 * Singleton instance for easy access
 */
export const pageDiscovery = new PageDiscovery();