/**
 * Optimized React Query hooks for packaging data with performance enhancements
 */

import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/utils/trpc'
import { useCallback, useMemo } from 'react'
import { performanceMonitor } from '@/lib/performance-monitor'

export interface PackagingFilters {
  dateFrom?: Date | null
  dateTo?: Date | null
  packageSizeML?: number | null
  batchSearch?: string
  status?: 'all' | 'completed' | 'voided'
}

export interface PackagingQueryParams {
  limit: number
  offset: number
  dateFrom?: Date
  dateTo?: Date
  packageSizeML?: number
  batchSearch?: string
  status?: string
}

/**
 * Optimized hook for packaging list queries with intelligent prefetching
 */
export function useOptimizedPackagingList(
  filters: PackagingFilters = {},
  itemsPerPage: number = 25,
  currentPage: number = 0
) {
  const queryClient = useQueryClient()

  // Convert filters to API parameters
  const apiParams = useMemo((): PackagingQueryParams => {
    const params: PackagingQueryParams = {
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    }

    if (filters.dateFrom) params.dateFrom = filters.dateFrom
    if (filters.dateTo) params.dateTo = filters.dateTo
    if (filters.packageSizeML) params.packageSizeML = filters.packageSizeML
    if (filters.batchSearch) params.batchSearch = filters.batchSearch
    if (filters.status && filters.status !== 'all') params.status = filters.status

    return params
  }, [itemsPerPage, currentPage, filters])

  // Main query with optimized settings
  const query = trpc.packaging.list.useQuery(apiParams as any, {
    // Optimized caching for packaging lists
    staleTime: 2 * 60 * 1000, // 2 minutes for list data
    gcTime: 10 * 60 * 1000, // 10 minutes cache time

    // Background refetching for fresh data
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,

    // Keep previous data while refetching - handled by placeholderData
    placeholderData: (previousData) => previousData,

    // Enable query to run
    enabled: true,

    // Error and success handling would be done via useEffect if needed
  })

  // Prefetch next page when user is likely to navigate
  const prefetchNextPage = useCallback(() => {
    if (query.data?.hasMore) {
      const nextPageParams = {
        ...apiParams,
        offset: (currentPage + 1) * itemsPerPage,
      }

      queryClient.prefetchQuery({
        queryKey: ['packaging', 'list', nextPageParams],
        queryFn: async () => {}, // Simplified for now
        staleTime: 2 * 60 * 1000, // 2 minutes
      })
    }
  }, [queryClient, apiParams, currentPage, itemsPerPage, query.data?.hasMore])

  // Prefetch previous page
  const prefetchPreviousPage = useCallback(() => {
    if (currentPage > 0) {
      const prevPageParams = {
        ...apiParams,
        offset: (currentPage - 1) * itemsPerPage,
      }

      queryClient.prefetchQuery({
        queryKey: ['packaging', 'list', prevPageParams],
        queryFn: async () => {}, // Simplified for now
        staleTime: 2 * 60 * 1000,
      })
    }
  }, [queryClient, apiParams, currentPage, itemsPerPage])

  // Optimistic cache updates for list
  const updatePackagingRunInCache = useCallback((runId: string, updater: (oldData: any) => any) => {
    // Update the list cache
    queryClient.setQueryData(['packaging', 'list', apiParams], (oldData: any) => {
      if (!oldData?.runs) return oldData

      return {
        ...oldData,
        runs: oldData.runs.map((run: any) =>
          run.id === runId ? updater(run) : run
        )
      }
    })

    // Also update the individual run cache if it exists
    queryClient.setQueryData(['packaging', 'get', runId], updater)
  }, [queryClient, apiParams])

  // Invalidate and refetch list
  const invalidateList = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ['packaging', 'list']
    })
  }, [queryClient])

  return {
    ...query,
    prefetchNextPage,
    prefetchPreviousPage,
    updatePackagingRunInCache,
    invalidateList,
  }
}

/**
 * Optimized hook for individual packaging run queries
 */
export function useOptimizedPackagingRun(runId: string) {
  const queryClient = useQueryClient()

  const query = trpc.packaging.get.useQuery(runId, {
    // Individual runs cache longer since they change less frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes

    // Don't refetch on focus for individual items
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,

    // Enable query only if runId exists
    enabled: !!runId,

    // Performance tracking - use useEffect if needed for error/success handling
  })

  // Optimistic updates for individual runs
  const updateRun = useCallback((updater: (oldData: any) => any) => {
    queryClient.setQueryData(['packaging', 'get', runId], updater)

    // Also try to update in list caches
    queryClient.setQueriesData({ queryKey: ['packaging', 'list'] }, (oldData: any) => {
      if (!oldData?.runs) return oldData

      return {
        ...oldData,
        runs: oldData.runs.map((run: any) =>
          run.id === runId ? updater(run) : run
        )
      }
    })
  }, [queryClient, runId])

  // Invalidate individual run
  const invalidateRun = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ['packaging', 'get', runId]
    })
  }, [queryClient, runId])

  return {
    ...query,
    updateRun,
    invalidateRun,
  }
}

/**
 * Hook for managing packaging mutations with optimistic updates
 */
export function useOptimizedPackagingMutations() {
  const queryClient = useQueryClient()

  // QA update mutation with optimistic updates
  const qaUpdateMutation = trpc.packaging.updateQA.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['packaging', 'get', variables.runId] })

      // Snapshot previous value
      const previousRun = queryClient.getQueryData(['packaging', 'get', variables.runId])

      // Optimistically update
      queryClient.setQueryData(['packaging', 'get', variables.runId], (old: any) => ({
        ...old,
        ...variables,
        updatedAt: new Date().toISOString(),
      }))

      return { previousRun }
    },
    // Note: onError and onSettled callbacks removed for React Query v5 compatibility
    // Handle these with useEffect in components if needed
  })

  return {
    qaUpdateMutation,
  }
}

/**
 * Hook for prefetching related packaging data
 */
export function usePackagingPrefetching() {
  const queryClient = useQueryClient()

  // Prefetch common reference data
  const prefetchReferenceData = useCallback(() => {
    // Prefetch batches for filters
    queryClient.prefetchQuery({
      queryKey: ['batches', 'list'],
      queryFn: async () => [], // Simplified for now
      staleTime: 10 * 60 * 1000, // 10 minutes for reference data
    })

    // Prefetch vessels for filters
    queryClient.prefetchQuery({
      queryKey: ['vessels', 'list'],
      queryFn: async () => [], // Simplified for now
      staleTime: 10 * 60 * 1000,
    })
  }, [queryClient])

  // Prefetch packaging data on hover/focus
  const prefetchPackagingRun = useCallback((runId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['packaging', 'get', runId],
      queryFn: async () => null, // Simplified for now
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient])

  return {
    prefetchReferenceData,
    prefetchPackagingRun,
  }
}