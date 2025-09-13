import { FullConfig } from '@playwright/test';

/**
 * Global teardown for E2E tests
 * - Cleanup any resources that need cleanup after all tests
 * - Note: Database cleanup happens in global-setup before each run
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Starting E2E test global teardown...');

  try {
    // Any cleanup operations can go here
    // For now, we don't need to do anything special
    // as each test run starts with a fresh database state

    console.log('✅ E2E test global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw - we don't want teardown failures to fail the tests
  }
}

export default globalTeardown;