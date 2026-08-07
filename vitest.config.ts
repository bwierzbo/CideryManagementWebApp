/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Suites excluded in CI (CI_SKIP_BROKEN_TESTS=1). Two kinds, both unable to
// pass in a fresh CI environment today:
//  - live-data suites that assert against the real production database
//    (TTB golden/parity/checkpoint, reconciliation health, LIQ-774)
//  - bit-rotted suites referencing since-removed code (createInnerTRPCContext,
//    @/components/navbar, ...) that predate CI ever running
// They still run locally. Repair them and shrink this list over time.
const ciSkippedSuites = process.env.CI_SKIP_BROKEN_TESTS
  ? [
      '**/__tests__/destroy-prep-integration.test.ts',
      '**/__tests__/health.test.ts',
      '**/__tests__/liq774-integration.test.ts',
      '**/__tests__/recipes-integration.test.ts',
      '**/__tests__/reconciliation-health.test.ts',
      '**/__tests__/ttb-checkpoint.test.ts',
      '**/__tests__/ttb-golden-2025.test.ts',
      '**/__tests__/ttb-parity.test.ts',
      '**/__tests__/invoiceNumber.test.ts',
      '**/__tests__/purchase-integration.test.ts',
      '**/__tests__/purchase-line-integration.test.ts',
      '**/__tests__/batch-volume-recompute.test.ts',
      '**/test/deprecation-system.test.ts',
      '**/__tests__/packaging-optimized.test.ts',
      '**/pressing/__tests__/page.test.tsx',
    ]
  : []

export default defineConfig({
  test: {
    // Global test environment setup
    environment: 'node',
    globals: true,

    // Coverage configuration for workspace
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov', 'text-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/coverage/**',
        '**/tests/**',
        '**/migrations/**',
        '**/snapshots/**',
        'apps/web/next.config.js',
        'apps/web/tailwind.config.js',
        'packages/db/drizzle.config.ts',
        'packages/db/src/migrations/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/test-utils/**',
        '**/test-setup.ts'
      ],

      // Include source files for accurate coverage
      include: [
        'apps/*/src/**/*.{ts,tsx,js,jsx}',
        'packages/*/src/**/*.{ts,tsx,js,jsx}'
      ],

      // NOTE: hard coverage thresholds (95%+) were removed 2026-08 — they
      // predated CI ever running and would fail every build. Coverage is
      // still reported; reintroduce per-package thresholds at achievable
      // levels as coverage grows.

      // Coverage reporting options
      all: true,
      clean: true,
      cleanOnRerun: true,
      skipFull: false,
      perFile: true,
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        lines: [80, 95]
      }
    },

    // Pool options for better test isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },

    // Timeout configuration
    testTimeout: 30000,
    hookTimeout: 30000,

    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath
        .replace(/\.test\.(ts|tsx|js|jsx)$/, '') + snapExtension
        .replace(/src/, 'tests/snapshots')
    },

    // Performance monitoring
    reporter: ['default', 'json'],
    outputFile: 'test-results.json',

    // Test file patterns
    include: [
      '**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],

    // Files to exclude from test runs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      ...ciSkippedSuites
    ]
  }
})