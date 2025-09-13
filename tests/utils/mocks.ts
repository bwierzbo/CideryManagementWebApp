/**
 * Mock utilities for testing
 */
import { vi } from 'vitest'

/**
 * Mock Next.js router
 */
export function mockNextRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    }
  }
}

/**
 * Mock tRPC client
 */
export function mockTrpcClient() {
  return {
    vendor: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    purchase: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    batch: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}

/**
 * Mock Auth.js session
 */
export function mockSession(overrides = {}) {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Operator'
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides
  }
}

/**
 * Mock environment variables
 */
export function mockEnvVars(envVars: Record<string, string>) {
  const originalEnv = process.env
  process.env = { ...originalEnv, ...envVars }

  return () => {
    process.env = originalEnv
  }
}

/**
 * Mock console methods (useful for testing error handling)
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  }

  console.log = vi.fn()
  console.error = vi.fn()
  console.warn = vi.fn()
  console.info = vi.fn()

  return () => {
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.info = originalConsole.info
  }
}