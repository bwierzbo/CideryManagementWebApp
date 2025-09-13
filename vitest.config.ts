/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Global test environment setup
    environment: 'node',
    globals: true,

    // Coverage configuration for workspace
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
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

      // Strict coverage thresholds for all packages
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        // Per-package thresholds for granular control
        'packages/lib/src/**': {
          branches: 98,
          functions: 98,
          lines: 98,
          statements: 98
        },
        'packages/api/src/**': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'packages/db/src/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },

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
      '**/coverage/**'
    ]
  }
})