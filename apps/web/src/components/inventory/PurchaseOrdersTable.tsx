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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  FileText,
  AlertTriangle,
  ExternalLink,
  X,
  Download,
  Search,
  Filter,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/utils/trpc'
import { useTableSorting } from '@/hooks/useTableSorting'

// Type for purchase order from API
interface PurchaseOrder {
  id: string
  purchaseDate: string
  vendorId: string
  vendorName: string
  totalItems: number
  totalCost: number | null
  status: 'pending' | 'completed' | 'cancelled'
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Table column configuration
type SortField = 'purchaseDate' | 'vendorName' | 'totalItems' | 'totalCost' | 'status' | 'createdAt'

interface PurchaseOrdersTableProps {
  showFilters?: boolean
  className?: string
  itemsPerPage?: number
  onItemClick?: (item: PurchaseOrder) => void
}

export function PurchaseOrdersTable({
  showFilters = true,
  className,
  itemsPerPage = 50,
  onItemClick
}: PurchaseOrdersTableProps) {
  // Filter state
  const [vendorFilter, setVendorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

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
    defaultSort: { field: 'purchaseDate', direction: 'desc' }
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)

  // Router for navigation
  const router = useRouter()

  // API queries - Create mock data for now since we need to check the actual API
  const {
    data: listData,
    isLoading,
    error,
    refetch
  } = trpc.inventory.list.useQuery({
    limit: itemsPerPage,
    offset: currentPage * itemsPerPage,
  })

  // Create mock purchase orders from basefruit purchase data
  const purchaseOrders = useMemo(() => {
    if (!listData?.items) return []

    // Group apple items by purchase ID to create purchase orders
    const purchaseMap = new Map<string, any>()

    listData.items
      .filter((item: any) => item.materialType === 'apple')
      .forEach((item: any) => {
        const metadata = (item.metadata as any) || {}
        const purchaseId = metadata.purchaseId

        if (purchaseId) {
          if (!purchaseMap.has(purchaseId)) {
            purchaseMap.set(purchaseId, {
              id: purchaseId,
              purchaseDate: item.createdAt,
              vendorId: 'vendor-id',
              vendorName: metadata.vendorName || 'Unknown Vendor',
              totalItems: 0,
              totalCost: 0,
              status: 'completed' as const,
              notes: null,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              items: []
            })
          }

          const purchase = purchaseMap.get(purchaseId)
          purchase.totalItems += 1
          purchase.items.push(item)
        }
      })

    return Array.from(purchaseMap.values()) as PurchaseOrder[]
  }, [listData])

  // Apply client-side filtering
  const filteredOrders = useMemo(() => {
    let filtered = purchaseOrders

    if (vendorFilter !== 'all') {
      filtered = filtered.filter(order => order.vendorName === vendorFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(order =>
        order.vendorName.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query) ||
        (order.notes && order.notes.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [purchaseOrders, vendorFilter, statusFilter, searchQuery])

  // Sort orders using the hook
  const sortedOrders = useMemo(() => {
    return sortData(filteredOrders, (order, field) => {
      // Custom sort value extraction for different field types
      switch (field) {
        case 'purchaseDate':
          return new Date(order.purchaseDate)
        case 'vendorName':
          return order.vendorName
        case 'totalItems':
          return order.totalItems
        case 'totalCost':
          return order.totalCost || 0
        case 'status':
          return order.status
        case 'createdAt':
          return new Date(order.createdAt)
        default:
          return (order as any)[field]
      }
    })
  }, [filteredOrders, sortData])

  // Get unique vendors for filter dropdown
  const uniqueVendors = useMemo(() => {
    const vendors = [...new Set(purchaseOrders.map(order => order.vendorName))]
    return vendors.sort()
  }, [purchaseOrders])

  // Event handlers
  const handleColumnSort = useCallback((field: SortField) => {
    handleSort(field)
  }, [handleSort])

  const handleItemClick = useCallback((order: PurchaseOrder) => {
    if (onItemClick) {
      onItemClick(order)
    } else {
      // Default navigation to order detail page
      router.push(`/purchase-orders/${order.id}`)
    }
  }, [onItemClick, router])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  // PDF export temporarily disabled - generatePurchaseOrderPdf method not yet implemented
  const handleExportPdf = useCallback(async (orderId: string) => {
    console.log('PDF export not yet implemented for order:', orderId)
    // TODO: Implement generatePurchaseOrderPdf in reports router
  }, [])

  // Get sort direction for display
  const getSortDirectionForDisplay = useCallback((field: SortField) => {
    const direction = getSortDirection(field)
    return direction ? direction : 'none'
  }, [getSortDirection])

  // Get sort index for single-column sorting display
  const getSortIndex = useCallback((field: SortField) => {
    const columnIndex = sortState.columns.findIndex(col => col.field === field)
    return columnIndex >= 0 ? columnIndex : undefined
  }, [sortState.columns])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="flex flex-col lg:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="flex-1 min-w-0">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="search"
                      placeholder="Search purchase orders, vendors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Vendor Filter */}
                <div className="min-w-[200px]">
                  <Label htmlFor="vendor-filter">Vendor</Label>
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Vendors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {uniqueVendors.map(vendor => (
                        <SelectItem key={vendor} value={vendor}>
                          {vendor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="min-w-[150px]">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                <FileText className="w-5 h-5" />
                Purchase Orders
              </CardTitle>
              <div className="flex items-center gap-4">
                <CardDescription>
                  {sortedOrders.length > 0 ? `${sortedOrders.length} orders found` : 'No orders found'}
                </CardDescription>
                {sortState.columns.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Sorted by {sortState.columns[0]?.field} ({sortState.columns[0]?.direction})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllSort}
                      className="h-6 px-2 py-0 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}
              </div>
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
              <span>Error loading purchase orders: {error.message}</span>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('purchaseDate')}
                    sortIndex={getSortIndex('purchaseDate')}
                    onSort={() => handleColumnSort('purchaseDate')}
                  >
                    Purchase Date
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('vendorName')}
                    sortIndex={getSortIndex('vendorName')}
                    onSort={() => handleColumnSort('vendorName')}
                  >
                    Vendor
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('totalItems')}
                    sortIndex={getSortIndex('totalItems')}
                    onSort={() => handleColumnSort('totalItems')}
                  >
                    Items
                  </SortableHeader>
                  <SortableHeader
                    align="right"
                    sortDirection={getSortDirectionForDisplay('totalCost')}
                    sortIndex={getSortIndex('totalCost')}
                    onSort={() => handleColumnSort('totalCost')}
                  >
                    Total Cost
                  </SortableHeader>
                  <SortableHeader
                    sortDirection={getSortDirectionForDisplay('status')}
                    sortIndex={getSortIndex('status')}
                    onSort={() => handleColumnSort('status')}
                  >
                    Status
                  </SortableHeader>
                  <SortableHeader canSort={false} className="w-[120px]">
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
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery || vendorFilter !== 'all' || statusFilter !== 'all'
                        ? 'No purchase orders match your search criteria'
                        : 'No purchase orders found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(order)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{formatDate(order.purchaseDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {order.vendorName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {order.totalItems}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(order.totalCost)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleItemClick(order)
                            }}
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExportPdf(order.id)
                            }}
                            title="Export PDF"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results info */}
          {sortedOrders.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {sortedOrders.length} of {purchaseOrders.length} purchase orders
                {(vendorFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim()) &&
                  ` (filtered from ${purchaseOrders.length} total)`
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}