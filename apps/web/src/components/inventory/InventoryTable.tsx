"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/utils/trpc'
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
type SortDirection = 'asc' | 'desc' | null

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

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

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

  // Sort items locally
  const sortedItems = useMemo(() => {
    if (!sortField || !sortDirection) return items

    return [...items].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Handle different data types
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [items, sortField, sortDirection])

  // Event handlers
  const handleSearch: SearchCallback = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(0) // Reset pagination when searching
  }, [])

  const handleFiltersChange: FilterCallback = useCallback((newFilters: Partial<InventoryFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(0) // Reset pagination when filtering
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

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

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4" />
    }
    return <ArrowDown className="w-4 h-4" />
  }

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
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('materialType')}
                  >
                    <div className="flex items-center gap-2">
                      Type
                      <SortIcon field="materialType" />
                    </div>
                  </TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center gap-2">
                      Location
                      <SortIcon field="location" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('currentBottleCount')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Available
                      <SortIcon field="currentBottleCount" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('reservedBottleCount')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Reserved
                      <SortIcon field="reservedBottleCount" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <div className="flex items-center gap-2">
                      Last Updated
                      <SortIcon field="updatedAt" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
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