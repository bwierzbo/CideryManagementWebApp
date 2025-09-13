import { test as baseTest, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login-page';
import { DashboardPage } from '../page-objects/dashboard-page';
import { AuthHelper } from './auth-helpers';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { VisualHelpers } from './visual-helpers';

// Extend basic test to include our page objects and helpers
export const test = baseTest.extend<{
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authHelper: AuthHelper;
  testDataFactory: TestDataFactory;
  visualHelpers: VisualHelpers;
}>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  authHelper: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },

  testDataFactory: async ({}, use) => {
    const factory = new TestDataFactory();
    await use(factory);
    await factory.close();
  },

  visualHelpers: async ({ page }, use) => {
    const helpers = new VisualHelpers(page);
    await helpers.setStandardViewport();
    await use(helpers);
  },
});

// Re-export expect for convenience
export { expect } from '@playwright/test';

/**
 * Test utilities and common functions
 */
export class TestHelpers {
  /**
   * Generate unique test identifier
   */
  static generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Wait for specified time
   */
  static async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a function until it succeeds or max attempts reached
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      onRetry?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000, onRetry } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        if (onRetry) {
          onRetry(error as Error, attempt);
        }

        await this.wait(delay);
      }
    }

    throw new Error('Should not reach here');
  }

  /**
   * Generate random test data
   */
  static generateTestData(): {
    email: string;
    name: string;
    phone: string;
    address: string;
    companyName: string;
  } {
    const id = this.generateTestId();
    return {
      email: `test-${id}@example.com`,
      name: `Test User ${id}`,
      phone: `555-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      address: `${Math.floor(Math.random() * 9999) + 1} Test Street, Test City, TC 12345`,
      companyName: `Test Company ${id}`
    };
  }

  /**
   * Check if running in CI environment
   */
  static isCI(): boolean {
    return process.env.CI === 'true';
  }

  /**
   * Get test environment info
   */
  static getTestEnvironment(): {
    isCI: boolean;
    nodeEnv: string;
    databaseUrl?: string;
    baseUrl?: string;
  } {
    return {
      isCI: this.isCI(),
      nodeEnv: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.TEST_DATABASE_URL,
      baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
    };
  }

  /**
   * Log test information
   */
  static logTestInfo(testName: string, info: Record<string, any>): void {
    if (!this.isCI()) {
      console.log(`\n[TEST: ${testName}]`, info);
    }
  }

  /**
   * Create test context for debugging
   */
  static createTestContext(testName: string): {
    log: (message: string, data?: any) => void;
    time: (label: string) => void;
    timeEnd: (label: string) => void;
  } {
    const prefix = `[${testName}]`;

    return {
      log: (message: string, data?: any) => {
        if (!this.isCI()) {
          console.log(`${prefix} ${message}`, data || '');
        }
      },
      time: (label: string) => {
        if (!this.isCI()) {
          console.time(`${prefix} ${label}`);
        }
      },
      timeEnd: (label: string) => {
        if (!this.isCI()) {
          console.timeEnd(`${prefix} ${label}`);
        }
      }
    };
  }
}

/**
 * Custom test reporter utilities
 */
export class TestReporter {
  private static testResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    screenshots?: string[];
  }> = [];

  /**
   * Record test result
   */
  static recordResult(result: {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    screenshots?: string[];
  }): void {
    this.testResults.push(result);
  }

  /**
   * Generate test summary
   */
  static generateSummary(): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    totalDuration: number;
  } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const skipped = this.testResults.filter(r => r.status === 'skipped').length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    return {
      total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      totalDuration
    };
  }

  /**
   * Export results to JSON
   */
  static exportResults(): string {
    return JSON.stringify({
      summary: this.generateSummary(),
      results: this.testResults,
      timestamp: new Date().toISOString(),
      environment: TestHelpers.getTestEnvironment()
    }, null, 2);
  }

  /**
   * Clear results
   */
  static clearResults(): void {
    this.testResults = [];
  }
}