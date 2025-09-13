import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for tests that don't need database setup
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/standalone-results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No global setup/teardown for standalone tests
  globalSetup: undefined,
  globalTeardown: undefined,

  // No web server needed for file system tests
  webServer: undefined,

  outputDir: 'test-results/standalone-artifacts',
  timeout: 30 * 1000,

  expect: {
    timeout: 5 * 1000,
  },
});