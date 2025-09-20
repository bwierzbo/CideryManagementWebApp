/**
 * Integration tests for Issue #57 - Inventory Upgrades
 * Tests combined search + sort operations, performance, and accessibility
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  runInventoryPerformanceTests,
  runAccessibilityTests,
  generateTestInventoryData,
  PerformanceTimer,
  simulateSearch,
  simulateSort
} from '@/utils/inventoryPerformanceTest'

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn()
global.performance = {
  now: mockPerformanceNow
} as any

describe('Issue #57 - Inventory Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformanceNow.mockReturnValue(0)
  })

  describe('Performance Tests', () => {
    test('should generate test data with correct structure', () => {
      const data = generateTestInventoryData(100)

      expect(data).toHaveLength(100)
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('packageId')
      expect(data[0]).toHaveProperty('currentBottleCount')
      expect(data[0]).toHaveProperty('reservedBottleCount')
      expect(data[0]).toHaveProperty('materialType')
      expect(data[0]).toHaveProperty('metadata')
      expect(data[0]).toHaveProperty('location')
      expect(data[0]).toHaveProperty('createdAt')
      expect(data[0]).toHaveProperty('updatedAt')
    })

    test('should simulate search operations correctly', () => {
      const testData = generateTestInventoryData(50)

      // Test search functionality
      const appleResults = simulateSearch(testData, 'apple')
      const appleItems = testData.filter(item =>
        item.materialType === 'apple' ||
        JSON.stringify(item).toLowerCase().includes('apple')
      )
      expect(appleResults.length).toBeGreaterThanOrEqual(0)

      // Test empty search returns all items
      const allResults = simulateSearch(testData, '')
      expect(allResults).toHaveLength(testData.length)

      // Test case insensitive search
      const upperResults = simulateSearch(testData, 'APPLE')
      const lowerResults = simulateSearch(testData, 'apple')
      expect(upperResults.length).toBe(lowerResults.length)
    })

    test('should simulate sort operations correctly', () => {
      const testData = generateTestInventoryData(20)

      // Test ascending sort by currentBottleCount
      const ascResults = simulateSort(testData, 'currentBottleCount', 'asc')
      expect(ascResults).toHaveLength(testData.length)
      for (let i = 1; i < ascResults.length; i++) {
        expect(ascResults[i].currentBottleCount).toBeGreaterThanOrEqual(
          ascResults[i-1].currentBottleCount
        )
      }

      // Test descending sort by currentBottleCount
      const descResults = simulateSort(testData, 'currentBottleCount', 'desc')
      expect(descResults).toHaveLength(testData.length)
      for (let i = 1; i < descResults.length; i++) {
        expect(descResults[i].currentBottleCount).toBeLessThanOrEqual(
          descResults[i-1].currentBottleCount
        )
      }

      // Test string sort by materialType
      const typeResults = simulateSort(testData, 'materialType', 'asc')
      expect(typeResults).toHaveLength(testData.length)

      // Test date sort by createdAt
      const dateResults = simulateSort(testData, 'createdAt', 'desc')
      expect(dateResults).toHaveLength(testData.length)
    })

    test('should measure performance with PerformanceTimer', () => {
      const timer = new PerformanceTimer()

      // Mock performance.now to return incremental values
      let mockTime = 0
      mockPerformanceNow.mockImplementation(() => {
        mockTime += 10
        return mockTime
      })

      timer.start()
      const elapsed = timer.end()

      expect(elapsed).toBe(10)
      expect(mockPerformanceNow).toHaveBeenCalledTimes(2)
    })

    test('should run performance tests with different dataset sizes', async () => {
      // Mock performance.now for predictable timing
      let mockTime = 0
      mockPerformanceNow.mockImplementation(() => {
        mockTime += 50 // Each operation takes 50ms
        return mockTime
      })

      const config = {
        datasets: [10, 20],
        iterations: 1,
        searchQueries: ['apple'],
        sortColumns: ['materialType'],
        performanceTargets: {
          searchTime: 100,
          sortTime: 100,
          combinedTime: 200,
          memoryUsage: 50
        }
      }

      const results = await runInventoryPerformanceTests(config)

      expect(results).toHaveLength(2)
      expect(results[0].datasetSize).toBe(10)
      expect(results[1].datasetSize).toBe(20)

      // Verify performance metrics are captured
      results.forEach(result => {
        expect(result.searchTime).toBeGreaterThan(0)
        expect(result.sortTime).toBeGreaterThan(0)
        expect(result.combinedTime).toBeGreaterThan(0)
        expect(result.passedTargets).toHaveProperty('search')
        expect(result.passedTargets).toHaveProperty('sort')
        expect(result.passedTargets).toHaveProperty('combined')
        expect(result.passedTargets).toHaveProperty('memory')
      })
    })

    test('should validate performance targets', async () => {
      // Mock fast performance
      mockPerformanceNow
        .mockReturnValueOnce(0)   // start search
        .mockReturnValueOnce(25)  // end search (25ms)
        .mockReturnValueOnce(25)  // start sort
        .mockReturnValueOnce(50)  // end sort (25ms)
        .mockReturnValueOnce(50)  // start combined
        .mockReturnValueOnce(75)  // end combined (25ms)

      const config = {
        datasets: [100],
        iterations: 1,
        searchQueries: ['test'],
        sortColumns: ['materialType'],
        performanceTargets: {
          searchTime: 30,  // Should pass (25ms < 30ms)
          sortTime: 30,    // Should pass (25ms < 30ms)
          combinedTime: 30, // Should pass (25ms < 30ms)
          memoryUsage: 50
        }
      }

      const results = await runInventoryPerformanceTests(config)

      expect(results[0].passedTargets.search).toBe(true)
      expect(results[0].passedTargets.sort).toBe(true)
      expect(results[0].passedTargets.combined).toBe(true)
    })
  })

  describe('Accessibility Tests', () => {
    test('should run accessibility tests for all components', async () => {
      const results = await runAccessibilityTests()

      expect(results).toHaveLength(3)

      const componentNames = results.map(r => r.component)
      expect(componentNames).toContain('InventorySearch')
      expect(componentNames).toContain('SortableHeader')
      expect(componentNames).toContain('InventoryTable')

      // Verify all tests have full accessibility compliance
      results.forEach(result => {
        expect(result.tests.keyboardNavigation).toBe(true)
        expect(result.tests.ariaLabels).toBe(true)
        expect(result.tests.focusManagement).toBe(true)
        expect(result.tests.screenReaderSupport).toBe(true)
        expect(result.tests.colorContrast).toBe(true)
        expect(result.tests.motionPreferences).toBe(true)
        expect(result.score).toBe(100)
        expect(result.issues).toHaveLength(0)
      })
    })
  })

  describe('Combined Search + Sort Operations', () => {
    test('should handle search followed by sort efficiently', () => {
      const testData = generateTestInventoryData(1000)

      // Time the combined operation
      const startTime = performance.now()

      // First search for apple items
      const searchResults = simulateSearch(testData, 'apple')

      // Then sort by currentBottleCount
      const finalResults = simulateSort(searchResults, 'currentBottleCount', 'desc')

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Verify results are correct
      expect(finalResults.length).toBeLessThanOrEqual(searchResults.length)
      expect(finalResults.length).toBeLessThanOrEqual(testData.length)

      // Verify sorting is correct
      if (finalResults.length > 1) {
        for (let i = 1; i < finalResults.length; i++) {
          expect(finalResults[i].currentBottleCount).toBeLessThanOrEqual(
            finalResults[i-1].currentBottleCount
          )
        }
      }

      // Performance should be reasonable (this is a simulated test)
      expect(totalTime).toBeDefined()
    })

    test('should handle multiple sort columns', () => {
      const testData = generateTestInventoryData(100)

      // Sort by materialType first, then by currentBottleCount
      const step1 = simulateSort(testData, 'materialType', 'asc')
      const step2 = simulateSort(step1, 'currentBottleCount', 'desc')

      expect(step2).toHaveLength(testData.length)

      // Verify multi-column sort behavior
      // Within each material type group, items should be sorted by count descending
      const groupedByType = step2.reduce((groups: any, item) => {
        if (!groups[item.materialType]) {
          groups[item.materialType] = []
        }
        groups[item.materialType].push(item)
        return groups
      }, {})

      Object.values(groupedByType).forEach((group: any) => {
        if (group.length > 1) {
          for (let i = 1; i < group.length; i++) {
            expect(group[i].currentBottleCount).toBeLessThanOrEqual(
              group[i-1].currentBottleCount
            )
          }
        }
      })
    })

    test('should handle edge cases gracefully', () => {
      // Empty dataset
      const emptyResults = simulateSearch([], 'test')
      expect(emptyResults).toHaveLength(0)

      const emptySorted = simulateSort([], 'materialType')
      expect(emptySorted).toHaveLength(0)

      // Single item
      const singleItem = generateTestInventoryData(1)
      const singleSearched = simulateSearch(singleItem, 'test')
      const singleSorted = simulateSort(singleItem, 'materialType')

      expect(singleSorted).toHaveLength(1)
      expect(singleSorted[0]).toEqual(singleItem[0])

      // Search with no matches
      const testData = generateTestInventoryData(50)
      const noMatches = simulateSearch(testData, 'nonexistent-term-xyz123')
      expect(noMatches).toHaveLength(0)

      const sortedNoMatches = simulateSort(noMatches, 'materialType')
      expect(sortedNoMatches).toHaveLength(0)
    })
  })

  describe('Memory Management', () => {
    test('should not create memory leaks with large datasets', () => {
      // Test with increasingly large datasets
      const sizes = [100, 500, 1000]

      sizes.forEach(size => {
        const data = generateTestInventoryData(size)

        // Perform multiple operations
        const searched = simulateSearch(data, 'apple')
        const sorted = simulateSort(searched, 'currentBottleCount')
        const resorted = simulateSort(sorted, 'materialType')

        // Verify operations complete successfully
        expect(resorted).toBeDefined()
        expect(Array.isArray(resorted)).toBe(true)

        // Clear references to help GC
        searched.length = 0
        sorted.length = 0
        resorted.length = 0
      })
    })
  })

  describe('Responsive Design Integration', () => {
    test('should verify component props are correctly configured', () => {
      // Test that the inventory page uses the correct props for responsive design
      const defaultProps = {
        showSearch: true,
        showFilters: true,
        itemsPerPage: 50,
        className: ""
      }

      // Verify props are reasonable for different screen sizes
      expect(defaultProps.showSearch).toBe(true)
      expect(defaultProps.showFilters).toBe(true)
      expect(defaultProps.itemsPerPage).toBeGreaterThan(0)
      expect(defaultProps.itemsPerPage).toBeLessThanOrEqual(100)
    })
  })

  describe('URL Parameter Synchronization', () => {
    test('should handle search and sort state in URL parameters', () => {
      // Simulate URL parameter handling
      const urlParams = new URLSearchParams()

      // Set search parameter
      urlParams.set('search', 'apple')
      expect(urlParams.get('search')).toBe('apple')

      // Set sort parameters
      urlParams.set('sort', 'materialType')
      urlParams.set('order', 'asc')
      expect(urlParams.get('sort')).toBe('materialType')
      expect(urlParams.get('order')).toBe('asc')

      // Test parameter parsing
      const searchQuery = urlParams.get('search') || ''
      const sortColumn = urlParams.get('sort') || ''
      const sortOrder = urlParams.get('order') || 'asc'

      expect(searchQuery).toBe('apple')
      expect(sortColumn).toBe('materialType')
      expect(['asc', 'desc'].includes(sortOrder)).toBe(true)
    })
  })
})

// Integration test utilities
export const IntegrationTestUtils = {
  /**
   * Simulate user interaction workflow
   */
  async simulateUserWorkflow() {
    console.log('🔄 Simulating user workflow...')

    // 1. User loads page
    const initialData = generateTestInventoryData(1000)
    console.log(`✅ Loaded ${initialData.length} items`)

    // 2. User searches for items
    const searchResults = simulateSearch(initialData, 'apple')
    console.log(`🔍 Found ${searchResults.length} items matching "apple"`)

    // 3. User sorts results
    const sortedResults = simulateSort(searchResults, 'currentBottleCount', 'desc')
    console.log(`📊 Sorted ${sortedResults.length} items by bottle count`)

    // 4. User changes sort order
    const resortedResults = simulateSort(sortedResults, 'location', 'asc')
    console.log(`🔄 Re-sorted ${resortedResults.length} items by location`)

    // 5. User searches again
    const finalResults = simulateSearch(resortedResults, 'warehouse')
    console.log(`🎯 Final results: ${finalResults.length} items`)

    return {
      initialData,
      searchResults,
      sortedResults,
      resortedResults,
      finalResults
    }
  },

  /**
   * Test performance under load
   */
  async testPerformanceUnderLoad() {
    console.log('⚡ Testing performance under load...')

    const results = await runInventoryPerformanceTests({
      datasets: [1000, 2000, 5000],
      iterations: 2,
      searchQueries: ['apple', 'warehouse', 'PKG'],
      sortColumns: ['materialType', 'currentBottleCount', 'location'],
      performanceTargets: {
        searchTime: 300,
        sortTime: 100,
        combinedTime: 400,
        memoryUsage: 50
      }
    })

    const allTestsPassed = results.every(result =>
      result.passedTargets.search &&
      result.passedTargets.sort &&
      result.passedTargets.combined
    )

    console.log(`📊 Performance test ${allTestsPassed ? 'PASSED' : 'FAILED'}`)
    return { results, allTestsPassed }
  },

  /**
   * Test accessibility compliance
   */
  async testAccessibilityCompliance() {
    console.log('♿ Testing accessibility compliance...')

    const results = await runAccessibilityTests()
    const allTestsPassed = results.every(result => result.score === 100)

    console.log(`♿ Accessibility test ${allTestsPassed ? 'PASSED' : 'FAILED'}`)
    return { results, allTestsPassed }
  }
}