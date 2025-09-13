import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration for page verification tests that need web server
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run sequentially to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid conflicts

  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/page-verification-report' }],
    ['json', { outputFile: 'test-results/page-verification-results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No database setup needed for basic page verification
  globalSetup: undefined,
  globalTeardown: undefined,

  // Use existing development server
  webServer: {
    command: 'echo "Using existing dev server on port 3002"',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 5 * 1000,
  },

  outputDir: 'test-results/page-verification-artifacts',
  timeout: 60 * 1000, // 1 minute per test

  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },
});