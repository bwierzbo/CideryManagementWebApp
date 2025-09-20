"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  Calendar,
  Package,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/utils/trpc'
import { useTableSorting } from '@/hooks/useTableSorting'
import { MaterialTypeIndicator } from './MaterialTypeIndicator'
import { InventorySearch } from './InventorySearch'
import { InventoryFilters } from './InventoryFilters'
import type {
  MaterialType,
  InventoryFiltersState,
  SearchCallback,
  FilterCallback
} from '@/types/inventory'

// Type for inventory item from API
interface InventoryItem {
  id: string
  packageId?: string | null
  currentBottleCount: number
  reservedBottleCount: number
  materialType: MaterialType
  metadata: Record<string, any>
  location?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

// Table column configuration
type SortField = 'materialType' | 'location' | 'currentBottleCount' | 'reservedBottleCount' | 'createdAt' | 'updatedAt'

interface InventoryTableProps {
  showSearch?: boolean
  showFilters?: boolean
  className?: string
  itemsPerPage?: number
  onItemClick?: (item: InventoryItem) => void
}

export function InventoryTable({
  showSearch = true,
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick
}: InventoryTableProps) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filters, setFilters] = useState<InventoryFiltersState>({
    materialTypes: [],
    location: 'all',
    status: 'all',
    isActive: true
  })

  // Sorting state using the reusable hook
  const {
    sortState,
    handleSort,
    getSortDirection,
    getSortIcon,
    sortData
  } = useTableSorting<SortField>({
    multiColumn: false,
    defaultSort: undefined
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)

  // Router for navigation
  const router = useRouter()

  // Calculate API parameters
  const apiParams = useMemo(() => ({
    materialType: filters.materialTypes.length === 1 ? filters.materialTypes[0] : undefined,
    location: filters.location !== 'all' ? filters.location : undefined,
    isActive: filters.isActive,
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
  }), [filters, itemsPerPage, currentPage])

  // Search API parameters
  const searchParams = useMemo(() => ({
    query: searchQuery,
    materialTypes: filters.materialTypes.length > 0 ? filters.materialTypes : undefined,
    limit: itemsPerPage,
  }), [searchQuery, filters.materialTypes, itemsPerPage])

  // Determine whether to use search or list endpoint
  const useSearch = searchQuery.trim().length > 0

  // API queries
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList
  } = trpc.inventory.list.useQuery(apiParams, {
    enabled: !useSearch,
    keepPreviousData: true,
  })

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch
  } = trpc.inventory.search.useQuery(searchParams, {
    enabled: useSearch,
    keepPreviousData: true,
  })

  // Derived state
  const isLoading = useSearch ? isSearchLoading : isListLoading
  const error = useSearch ? searchError : listError
  const items = useSearch ? searchData?.items || [] : listData?.items || []
  const totalCount = useSearch ? searchData?.count || 0 : listData?.pagination?.total || 0
  const hasMore = useSearch ? false : listData?.pagination?.hasMore || false

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    return sortData(items, (item, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case 'materialType':
          return item.materialType
        case 'location':
          return item.location || ''
        case 'currentBottleCount':
          return item.currentBottleCount
        case 'reservedBottleCount':
          return item.reservedBottleCount
        case 'createdAt':
          return new Date(item.createdAt)
        case 'updatedAt':
          return new Date(item.updatedAt)
        default:
          return (item as any)[field]
      }
    })
  }, [items, sortData])

  // Event handlers
  const handleSearch: SearchCallback = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(0) // Reset pagination when searching
  }, [])

  const handleFiltersChange: FilterCallback = useCallback((newFilters: Partial<InventoryFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(0) // Reset pagination when filtering
  }, [])

  // Sort handler is provided by the hook
  const handleColumnSort = useCallback((field: SortField) => {
    handleSort(field)
  }, [handleSort])

  const handleItemClick = useCallback((item: InventoryItem) => {
    if (onItemClick) {
      onItemClick(item)
    } else {
      // Default navigation to item detail page
      router.push(`/inventory/${item.id}`)
    }
  }, [onItemClick, router])

  const handleRefresh = useCallback(() => {
    if (useSearch) {
      refetchSearch()
    } else {
      refetchList()
    }
  }, [useSearch, refetchSearch, refetchList])

  // Get status badge for item
  const getStatusBadge = (item: InventoryItem) => {
    const available = item.currentBottleCount - item.reservedBottleCount

    if (available <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (available < 50) {
      return <Badge variant="destructive">Low Stock</Badge>
    } else if (item.reservedBottleCount > 0) {
      return <Badge variant="secondary">Partially Reserved</Badge>
    } else {
      return <Badge variant="outline">Available</Badge>
    }
  }

  // Get display name for item
  const getItemDisplayName = (item: InventoryItem) => {
    if (item.packageId) {
      return `Package ${item.packageId}`
    }

    const { metadata } = item
    switch (item.materialType) {
      case 'apple':
        return metadata.additiveName || metadata.appleVarietyId || 'Apple Inventory'
      case 'additive':
        return metadata.additiveName || 'Additive Inventory'
      case 'juice':
        return metadata.vessellId || metadata.pressRunId || 'Juice Inventory'
      case 'packaging':
        return metadata.packagingName || 'Packaging Inventory'
      default:
        return 'Inventory Item'
    }
  }

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback((field: SortField) => {
    const direction = getSortDirection(field)
    return direction ? direction : 'none'
  }, [getSortDirection])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {showSearch && (
                <InventorySearch
                  onSearch={handleSearch}
                  placeholder="Search inventory items..."
                  className="max-w-md"
                />
              )}
              {showFilters && (
                <InventoryFilters
                  onFiltersChange={handleFiltersChange}
                  initialFilters={filters}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Inventory Items
              </CardTitle>
              <CardDescription>
                {totalCount > 0 ? `${totalCount} items found` : 'No items found'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span>Error loading inventory: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('materialType')}
                    onSort={() => handleColumnSort('materialType')}
                  >
                    Type
                  </SortableHeader>
                  <SortableHeader canSort={false}>
                    Item
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('location')}
                    onSort={() => handleColumnSort('location')}
                  >
                    Location
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('currentBottleCount')}
                    onSort={() => handleColumnSort('currentBottleCount')}
                  >
                    Available
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('reservedBottleCount')}
                    onSort={() => handleColumnSort('reservedBottleCount')}
                  >
                    Reserved
                  </SortableHeader>
                  <SortableHeader canSort={false}>
                    Status
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('updatedAt')}
                    onSort={() => handleColumnSort('updatedAt')}
                  >
                    Last Updated
                  </SortableHeader>
                  <SortableHeader canSort={false} className="w-[50px]">
                    {/* Actions column */}
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No items match your search' : 'No inventory items found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>
                        <MaterialTypeIndicator
                          materialType={item.materialType}
                          variant="compact"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {getItemDisplayName(item)}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.location ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="capitalize">{item.location}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(item.currentBottleCount - item.reservedBottleCount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.reservedBottleCount > 0
                          ? item.reservedBottleCount.toLocaleString()
                          : '—'
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(item.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleItemClick(item)
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination for list view */}
          {!useSearch && listData?.pagination && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, totalCount)} of {totalCount} items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Export a simplified version for basic usage
export function SimpleInventoryTable({
  materialType,
  limit = 20,
  className
}: {
  materialType?: MaterialType
  limit?: number
  className?: string
}) {
  return (
    <InventoryTable
      showSearch={false}
      showFilters={false}
      className={className}
      itemsPerPage={limit}
    />
  )
}