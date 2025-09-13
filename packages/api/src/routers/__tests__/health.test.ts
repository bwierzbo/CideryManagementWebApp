/**
 * Health Router Tests
 * Tests for health check API endpoints
 */

import { healthRouter } from '../health'
import { createInnerTRPCContext } from '../../trpc'

describe('Health Router', () => {
  const createContext = () => createInnerTRPCContext({ session: null })
  const caller = healthRouter.createCaller(createContext())

  describe('ping', () => {
    it('should return healthy status with basic information', async () => {
      const result = await caller.ping()

      expect(result.status).toBe('healthy')
      expect(result.message).toBe('API is operational')
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(typeof result.uptime).toBe('number')
      expect(result.uptime).toBeGreaterThan(0)
    })

    it('should respond in under 100ms', async () => {
      const start = Date.now()
      await caller.ping()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('system', () => {
    it('should return system resource information', async () => {
      const result = await caller.system()

      expect(result.status).toBe('healthy')
      expect(result.system).toBeDefined()
      expect(result.system.uptime_seconds).toBeGreaterThan(0)
      expect(result.system.memory).toBeDefined()
      expect(result.system.memory.heap_utilization_percent).toBeGreaterThan(0)
      expect(result.system.memory.heap_utilization_percent).toBeLessThan(100)
      expect(result.system.node_version).toMatch(/^v\d+\.\d+\.\d+/)
      expect(result.system.platform).toBeDefined()
      expect(result.system.arch).toBeDefined()
    })

    it('should respond in under 100ms', async () => {
      const start = Date.now()
      await caller.system()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('status', () => {
    it('should return comprehensive status information', async () => {
      const result = await caller.status()

      expect(result.status).toMatch(/^(healthy|unhealthy)$/)
      expect(result.checks).toBeDefined()
      expect(result.checks.database).toBeDefined()
      expect(result.checks.system).toBeDefined()
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(typeof result.response_time_ms).toBe('number')
    })

    it('should respond in under 100ms for basic checks', async () => {
      const start = Date.now()
      await caller.status()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('diagnostics', () => {
    it('should return detailed diagnostic information', async () => {
      const result = await caller.diagnostics()

      expect(result.status).toMatch(/^(healthy|unhealthy)$/)
      expect(result.diagnostics).toBeDefined()
      expect(result.diagnostics.environment).toBeDefined()
      expect(result.diagnostics.environment.node_version).toMatch(/^v\d+\.\d+\.\d+/)
      expect(result.diagnostics.memory).toBeDefined()
      expect(result.diagnostics.cpu).toBeDefined()
      expect(result.diagnostics.database).toBeDefined()
      expect(typeof result.diagnostics.database.url_configured).toBe('boolean')
    })

    it('should include response time metrics', async () => {
      const result = await caller.diagnostics()

      expect(typeof result.response_time_ms).toBe('number')
      expect(result.response_time_ms).toBeGreaterThan(0)
    })
  })

  describe('database', () => {
    it('should test database connectivity', async () => {
      const result = await caller.database()

      expect(result.status).toMatch(/^(healthy|unhealthy)$/)
      expect(result.database).toBeDefined()
      expect(typeof result.database.connected).toBe('boolean')
      expect(typeof result.response_time_ms).toBe('number')
    })

    it('should include database performance metrics when healthy', async () => {
      const result = await caller.database()

      if (result.status === 'healthy') {
        expect(result.database.connectivity_ms).toBeDefined()
        expect(result.database.table_query_ms).toBeDefined()
        expect(result.database.version).toBeDefined()
        expect(result.database.test_results).toBeDefined()
      }
    })
  })
})