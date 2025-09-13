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
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/coverage/**',
        '**/tests/**',
        '**/migrations/**',
        'apps/web/next.config.js',
        'apps/web/tailwind.config.js',
        'packages/db/drizzle.config.ts'
      ],

      // Strict coverage thresholds for all packages
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },

    // Pool options for better test isolation
    pool: 'forks',

    // Timeout configuration
    testTimeout: 30000,
    hookTimeout: 30000,

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