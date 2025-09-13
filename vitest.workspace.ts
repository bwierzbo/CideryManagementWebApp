import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Web application
  {
    extends: './vitest.config.ts',
    test: {
      name: 'web',
      root: './apps/web',
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts']
    }
  },

  // API package
  {
    extends: './vitest.config.ts',
    test: {
      name: 'api',
      root: './packages/api',
      environment: 'node',
      setupFiles: ['./tests/setup.ts']
    }
  },

  // Database package
  {
    extends: './vitest.config.ts',
    test: {
      name: 'db',
      root: './packages/db',
      environment: 'node',
      setupFiles: ['./tests/setup.ts']
    }
  },

  // Lib package
  {
    extends: './vitest.config.ts',
    test: {
      name: 'lib',
      root: './packages/lib',
      environment: 'node'
    }
  },

  // Worker package
  {
    extends: './vitest.config.ts',
    test: {
      name: 'worker',
      root: './packages/worker',
      environment: 'node',
      setupFiles: ['./tests/setup.ts']
    }
  }
])