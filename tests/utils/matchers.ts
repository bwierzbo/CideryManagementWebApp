/**
 * Custom test matchers for the Cidery Management App
 */
import { expect } from 'vitest'

/**
 * Matcher for checking if a value is a valid UUID
 */
function toBeValidUuid(received: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const pass = uuidRegex.test(received)

  if (pass) {
    return {
      message: () => `expected ${received} not to be a valid UUID`,
      pass: true,
    }
  } else {
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass: false,
    }
  }
}

/**
 * Matcher for checking if a date is recent (within last few seconds)
 */
function toBeRecentDate(received: Date, withinSeconds = 5) {
  const now = new Date()
  const diff = Math.abs(now.getTime() - received.getTime()) / 1000
  const pass = diff <= withinSeconds

  if (pass) {
    return {
      message: () => `expected ${received} not to be within ${withinSeconds} seconds of now`,
      pass: true,
    }
  } else {
    return {
      message: () => `expected ${received} to be within ${withinSeconds} seconds of now (difference: ${diff}s)`,
      pass: false,
    }
  }
}

/**
 * Matcher for checking if an ABV value is valid
 */
function toBeValidAbv(received: number) {
  const pass = received >= 0 && received <= 20 && Number.isFinite(received)

  if (pass) {
    return {
      message: () => `expected ${received} not to be a valid ABV value`,
      pass: true,
    }
  } else {
    return {
      message: () => `expected ${received} to be a valid ABV value (0-20%)`,
      pass: false,
    }
  }
}

/**
 * Matcher for checking if a value is a valid decimal amount
 */
function toBeValidAmount(received: number) {
  const pass = received >= 0 && Number.isFinite(received)

  if (pass) {
    return {
      message: () => `expected ${received} not to be a valid amount`,
      pass: true,
    }
  } else {
    return {
      message: () => `expected ${received} to be a valid amount (non-negative finite number)`,
      pass: false,
    }
  }
}

// Extend Vitest matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidUuid(): T
    toBeRecentDate(withinSeconds?: number): T
    toBeValidAbv(): T
    toBeValidAmount(): T
  }
  interface AsymmetricMatchersContaining {
    toBeValidUuid(): any
    toBeRecentDate(withinSeconds?: number): any
    toBeValidAbv(): any
    toBeValidAmount(): any
  }
}

// Register custom matchers
expect.extend({
  toBeValidUuid,
  toBeRecentDate,
  toBeValidAbv,
  toBeValidAmount
})