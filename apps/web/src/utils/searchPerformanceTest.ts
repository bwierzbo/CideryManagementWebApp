/**
 * Performance testing utilities for search functionality
 * Used to verify <300ms response time target is met
 */

import { searchItems, generateSearchSuggestions, type SearchableItem } from './searchUtils'

// Generate test data
export function generateTestData(count: number): SearchableItem[] {
  const materialTypes = ['apple', 'additive', 'juice', 'packaging'] as const
  const locations = ['cellar', 'packaging', 'storage', 'warehouse', 'receiving']
  const conditions = ['excellent', 'good', 'fair', 'poor']

  return Array.from({ length: count }, (_, i) => ({
    id: `test-item-${i}`,
    materialType: materialTypes[i % materialTypes.length],
    location: locations[i % locations.length],
    notes: `Test item ${i} with various notes and descriptions`,
    metadata: {
      additiveName: `Additive ${i}`,
      appleVarietyId: `variety-${i % 20}`,
      vessellId: `vessel-${i % 10}`,
      packagingName: `Package Type ${i % 5}`,
      condition: conditions[i % conditions.length]
    },
    packageId: i % 100 === 0 ? `PKG-${i}` : null,
    currentBottleCount: Math.floor(Math.random() * 1000) + 100,
    reservedBottleCount: Math.floor(Math.random() * 100),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
  }))
}

// Performance test suite
export interface PerformanceTestResult {
  query: string
  itemCount: number
  searchTime: number
  resultsCount: number
  algorithm: string
  passesTarget: boolean
}

export async function runPerformanceTests(
  itemCounts: number[] = [100, 500, 1000, 2000, 5000],
  queries: string[] = [
    'apple',
    'vessel-1',
    'PKG-',
    'excellent condition',
    'additive yeast',
    'test item',
    'storage cellar',
    'a', // Short query
    'this is a very long query that should test performance with complex searches'
  ],
  targetTime = 300
): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = []

  for (const itemCount of itemCounts) {
    console.log(`\n🧪 Testing with ${itemCount} items...`)
    const testData = generateTestData(itemCount)

    for (const query of queries) {
      // Warm up
      searchItems(testData, query)

      // Actual test
      const startTime = performance.now()
      const { results: searchResults, metrics } = searchItems(testData, query, {
        maxResults: 100,
        highlightMatches: true
      })
      const endTime = performance.now()

      const searchTime = endTime - startTime
      const passesTarget = searchTime < targetTime

      const testResult: PerformanceTestResult = {
        query,
        itemCount,
        searchTime,
        resultsCount: searchResults.length,
        algorithm: metrics.algorithmUsed,
        passesTarget
      }

      results.push(testResult)

      const status = passesTarget ? '✅' : '❌'
      console.log(
        `${status} "${query}" (${itemCount} items): ${searchTime.toFixed(1)}ms → ${searchResults.length} results (${metrics.algorithmUsed})`
      )
    }
  }

  return results
}

// Generate performance report
export function generatePerformanceReport(results: PerformanceTestResult[]): {
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    passRate: number
    averageTime: number
    slowestTest: PerformanceTestResult
    fastestTest: PerformanceTestResult
  }
  byItemCount: Record<number, {
    averageTime: number
    passRate: number
    slowestQuery: string
  }>
  byAlgorithm: Record<string, {
    averageTime: number
    testCount: number
    passRate: number
  }>
  recommendations: string[]
} {
  const passedTests = results.filter(r => r.passesTarget)
  const failedTests = results.filter(r => !r.passesTarget)

  const totalTime = results.reduce((sum, r) => sum + r.searchTime, 0)
  const averageTime = totalTime / results.length

  const slowestTest = results.reduce((slowest, current) =>
    current.searchTime > slowest.searchTime ? current : slowest
  )

  const fastestTest = results.reduce((fastest, current) =>
    current.searchTime < fastest.searchTime ? current : fastest
  )

  // Group by item count
  const byItemCount: Record<number, {
    averageTime: number
    passRate: number
    slowestQuery: string
  }> = {}

  const itemCounts = [...new Set(results.map(r => r.itemCount))]
  for (const count of itemCounts) {
    const countResults = results.filter(r => r.itemCount === count)
    const countPassed = countResults.filter(r => r.passesTarget).length
    const countAvgTime = countResults.reduce((sum, r) => sum + r.searchTime, 0) / countResults.length
    const slowestInCount = countResults.reduce((slowest, current) =>
      current.searchTime > slowest.searchTime ? current : slowest
    )

    byItemCount[count] = {
      averageTime: countAvgTime,
      passRate: (countPassed / countResults.length) * 100,
      slowestQuery: slowestInCount.query
    }
  }

  // Group by algorithm
  const byAlgorithm: Record<string, {
    averageTime: number
    testCount: number
    passRate: number
  }> = {}

  const algorithms = [...new Set(results.map(r => r.algorithm))]
  for (const algorithm of algorithms) {
    const algorithmResults = results.filter(r => r.algorithm === algorithm)
    const algorithmPassed = algorithmResults.filter(r => r.passesTarget).length
    const algorithmAvgTime = algorithmResults.reduce((sum, r) => sum + r.searchTime, 0) / algorithmResults.length

    byAlgorithm[algorithm] = {
      averageTime: algorithmAvgTime,
      testCount: algorithmResults.length,
      passRate: (algorithmPassed / algorithmResults.length) * 100
    }
  }

  // Generate recommendations
  const recommendations: string[] = []

  if (failedTests.length > 0) {
    recommendations.push(`⚠️  ${failedTests.length} tests failed the 300ms target`)

    const slowItemCounts = Object.entries(byItemCount)
      .filter(([_, data]) => data.averageTime > 300)
      .map(([count, _]) => count)

    if (slowItemCounts.length > 0) {
      recommendations.push(`📊 Performance degrades significantly with ${slowItemCounts.join(', ')} items`)
    }

    const slowAlgorithms = Object.entries(byAlgorithm)
      .filter(([_, data]) => data.averageTime > 300)
      .map(([algorithm, _]) => algorithm)

    if (slowAlgorithms.length > 0) {
      recommendations.push(`🔍 Consider optimizing algorithms: ${slowAlgorithms.join(', ')}`)
    }
  }

  if (averageTime < 150) {
    recommendations.push('🚀 Excellent performance! Consider reducing debounce time further')
  } else if (averageTime < 300) {
    recommendations.push('✅ Good performance within target range')
  } else {
    recommendations.push('🐌 Performance below target, consider optimization')
  }

  return {
    summary: {
      totalTests: results.length,
      passedTests: passedTests.length,
      failedTests: failedTests.length,
      passRate: (passedTests.length / results.length) * 100,
      averageTime,
      slowestTest,
      fastestTest
    },
    byItemCount,
    byAlgorithm,
    recommendations
  }
}

// Console-friendly performance test runner
export async function runQuickPerformanceCheck(): Promise<void> {
  console.log('🚀 Running Quick Performance Check...\n')

  const results = await runPerformanceTests(
    [500, 1000, 2000], // Reasonable test sizes
    ['apple', 'vessel-1', 'excellent condition', 'test'], // Key queries
    300 // Target time
  )

  const report = generatePerformanceReport(results)

  console.log('\n📊 PERFORMANCE REPORT')
  console.log('='.repeat(50))
  console.log(`Total Tests: ${report.summary.totalTests}`)
  console.log(`Passed: ${report.summary.passedTests} (${report.summary.passRate.toFixed(1)}%)`)
  console.log(`Failed: ${report.summary.failedTests}`)
  console.log(`Average Time: ${report.summary.averageTime.toFixed(1)}ms`)
  console.log(`Slowest: ${report.summary.slowestTest.searchTime.toFixed(1)}ms ("${report.summary.slowestTest.query}" with ${report.summary.slowestTest.itemCount} items)`)
  console.log(`Fastest: ${report.summary.fastestTest.searchTime.toFixed(1)}ms ("${report.summary.fastestTest.query}" with ${report.summary.fastestTest.itemCount} items)`)

  console.log('\n📈 BY ITEM COUNT')
  for (const [count, data] of Object.entries(report.byItemCount)) {
    console.log(`${count} items: ${data.averageTime.toFixed(1)}ms avg, ${data.passRate.toFixed(1)}% pass rate`)
  }

  console.log('\n🔍 BY ALGORITHM')
  for (const [algorithm, data] of Object.entries(report.byAlgorithm)) {
    console.log(`${algorithm}: ${data.averageTime.toFixed(1)}ms avg (${data.testCount} tests, ${data.passRate.toFixed(1)}% pass rate)`)
  }

  console.log('\n💡 RECOMMENDATIONS')
  for (const recommendation of report.recommendations) {
    console.log(`   ${recommendation}`)
  }

  console.log('\n🎯 OPTIMAL DEBOUNCE RECOMMENDATIONS')
  if (report.summary.averageTime < 100) {
    console.log('   🟢 Debounce: 100ms (very fast searches)')
  } else if (report.summary.averageTime < 200) {
    console.log('   🟡 Debounce: 150ms (good balance)')
  } else {
    console.log('   🔴 Debounce: 200ms+ (slower searches need more time)')
  }
}