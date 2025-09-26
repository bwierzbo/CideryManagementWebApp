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
  Package,
  Eye,
  AlertTriangle,
  Calendar,
  Package2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/utils/trpc'
import { useTableSorting } from '@/hooks/useTableSorting'

// Type for packaging run from API
interface PackagingRun {
  id: string
  batchId: string
  vesselId: string
  packagedAt: string
  packageType: string
  packageSizeML: number
  unitsProduced: number
  volumeTakenL: number
  lossL: number
  lossPercentage: number
  status: 'completed' | 'voided' | null
  createdAt: string
  batch: {
    id: string
    name: string | null
  }
  vessel: {
    id: string
    name: string | null
  }
}

// Table column configuration
type SortField = 'packagedAt' | 'batchName' | 'unitsProduced' | 'lossPercentage'

interface PackagingTableProps {
  className?: string
  itemsPerPage?: number
  onItemClick?: (item: PackagingRun) => void
}

export function PackagingTable({
  className,
  itemsPerPage = 25,
  onItemClick
}: PackagingTableProps) {
  // Sorting state using the reusable hook
  const {
    sortState,
    handleSort,
    getSortDirection,
    getSortIcon,
    sortData,
    clearAllSort
  } = useTableSorting<SortField>({
    multiColumn: false,
    defaultSort: { field: 'packagedAt', direction: 'desc' }
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)

  // Router for navigation
  const router = useRouter()

  // Calculate API parameters
  const apiParams = useMemo(() => ({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
  }), [itemsPerPage, currentPage])

  // API query
  const {
    data,
    isLoading,
    error,
    refetch
  } = trpc.packaging.list.useQuery(apiParams)

  // Derived state
  const totalCount = data?.total || 0
  const hasMore = data?.hasMore || false

  // Sort items using the hook
  const sortedItems = useMemo(() => {
    const items = data?.runs || []
    return sortData(items, (item: PackagingRun, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case 'packagedAt':
          return new Date(item.packagedAt)
        case 'batchName':
          return item.batch.name || ''
        case 'unitsProduced':
          return item.unitsProduced
        case 'lossPercentage':
          return item.lossPercentage
        default:
          return (item as any)[field]
      }
    })
  }, [data?.runs, sortData])

  // Event handlers
  const handleColumnSort = useCallback((field: SortField) => {
    handleSort(field)
  }, [handleSort])

  const handleItemClick = useCallback((item: PackagingRun) => {
    if (onItemClick) {
      onItemClick(item)
    } else {
      // Default navigation to detail page
      router.push(`/packaging/${item.id}`)
    }
  }, [onItemClick, router])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  // Format package size display
  const formatPackageSize = useCallback((sizeML: number, packageType: string) => {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L ${packageType}`
    }
    return `${sizeML}ml ${packageType}`
  }, [])

  // Format date display
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }, [])

  // Get status badge color
  const getStatusColor = useCallback((status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'voided':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }, [])

  // Get loss percentage color
  const getLossColor = useCallback((lossPercentage: number) => {
    if (lossPercentage <= 2) return 'text-green-600'
    if (lossPercentage <= 5) return 'text-yellow-600'
    return 'text-red-600'
  }, [])

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback((field: SortField) => {
    const direction = getSortDirection(field)
    return direction ? direction : 'none'
  }, [getSortDirection])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Packaging Runs
              </CardTitle>
              <CardDescription>
                {totalCount > 0 ? `${totalCount} packaging runs found` : 'No packaging runs found'}
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
              <span>Error loading packaging runs: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('packagedAt')}
                    onSort={() => handleColumnSort('packagedAt')}
                  >
                    Date
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('batchName')}
                    onSort={() => handleColumnSort('batchName')}
                  >
                    Batch
                  </SortableHeader>
                  <SortableHeader canSort={false}>
                    Package Type & Size
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('unitsProduced')}
                    onSort={() => handleColumnSort('unitsProduced')}
                  >
                    Units Produced
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('lossPercentage')}
                    onSort={() => handleColumnSort('lossPercentage')}
                  >
                    Loss %
                  </SortableHeader>
                  <SortableHeader canSort={false}>
                    Status
                  </SortableHeader>
                  <SortableHeader canSort={false} className="w-[100px]">
                    Actions
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package2 className="w-8 h-8 text-muted-foreground/50" />
                        <span>No packaging runs found</span>
                        <span className="text-sm">Packaging runs will appear here once created</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">
                            {formatDate(item.packagedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {item.batch.name || `Batch ${item.batchId.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.vessel.name || `Vessel ${item.vesselId.slice(0, 8)}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 text-muted-foreground" />
                          <span className="capitalize">
                            {formatPackageSize(item.packageSizeML, item.packageType)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.unitsProduced.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-medium", getLossColor(item.lossPercentage))}>
                          {item.lossPercentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {item.lossL.toFixed(1)}L
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getStatusColor(item.status))}>
                          {item.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleItemClick(item)
                          }}
                          className="h-8 px-3"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && data && (
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
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage + 1}
                </span>
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
export function SimplePackagingTable({
  limit = 10,
  className
}: {
  limit?: number
  className?: string
}) {
  return (
    <PackagingTable
      className={className}
      itemsPerPage={limit}
    />
  )
}