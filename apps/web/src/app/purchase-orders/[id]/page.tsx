"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Package,
  AlertTriangle,
  Download,
  Truck,
  DollarSign,
  Boxes,
  Eye
} from 'lucide-react'
import { trpc } from '@/utils/trpc'
import { cn } from '@/lib/utils'

interface PurchaseOrderDetailPageProps {
  params: {
    id: string
  }
}

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)

  // Fetch purchase order details
  const {
    data: purchaseData,
    isLoading,
    error,
    refetch
  } = trpc.purchase.getById.useQuery(params.id, {
    enabled: !!params.id
  })

  const handleBack = () => {
    router.back()
  }

  const handleExportPdf = async () => {
    setIsExporting(true)
    try {
      // TODO: Implement PDF export functionality
      console.log('Exporting PDF for purchase order:', params.id)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate export
    } catch (error) {
      console.error('Error exporting PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'partially_depleted':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partially Used</Badge>
      case 'depleted':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Depleted</Badge>
      case 'archived':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Archived</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getMaterialTypeBadge = (materialType: string) => {
    switch (materialType) {
      case 'basefruit':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Base Fruit</Badge>
      case 'additives':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Additives</Badge>
      case 'juice':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Juice</Badge>
      case 'packaging':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Packaging</Badge>
      default:
        return <Badge variant="outline">{materialType}</Badge>
    }
  }

  const formatItemDetails = (item: any) => {
    // Format item details based on material type
    if (item.fruitVarietyName) {
      return {
        name: item.fruitVarietyName,
        details: `${item.quantity} ${item.unit}${item.harvestDate ? ` • Harvested: ${formatDate(item.harvestDate)}` : ''}`,
        unitCost: item.pricePerUnit
      }
    } else if (item.additiveName) {
      return {
        name: item.additiveName || item.productName,
        details: `${item.quantity} ${item.unit}${item.brandManufacturer ? ` • ${item.brandManufacturer}` : ''}`,
        unitCost: item.pricePerUnit
      }
    } else if (item.juiceName || item.varietyName) {
      return {
        name: item.juiceName || item.varietyName,
        details: `${item.volumeL}L${item.brix ? ` • ${item.brix}° Brix` : ''}${item.ph ? ` • pH ${item.ph}` : ''}`,
        unitCost: item.pricePerLiter
      }
    } else if (item.packagingName) {
      return {
        name: item.packagingName,
        details: `${item.quantity} ${item.unitType}${item.packagingType ? ` • ${item.packagingType}` : ''}`,
        unitCost: item.pricePerUnit
      }
    }

    return {
      name: 'Unknown Item',
      details: 'No details available',
      unitCost: null
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>Error loading purchase order: {error.message}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <FileText className="w-8 h-8 text-amber-600" />
                  Transaction Details
                </h1>
                <p className="text-gray-600 mt-1">
                  Purchase Order ID: {params.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          // Loading skeletons
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-96" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-32" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : purchaseData ? (
          <div className="space-y-6">
            {/* Purchase Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Purchase Overview
                    </CardTitle>
                    <CardDescription>
                      Order from {purchaseData.purchase.vendorName || 'Unknown Vendor'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getMaterialTypeBadge(purchaseData.purchase.materialType || 'basefruit')}
                    {getStatusBadge(purchaseData.purchase.status || 'active')}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Purchase Date</p>
                      <p className="font-semibold">{formatDate(purchaseData.purchase.purchaseDate)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Vendor</p>
                      <p className="font-semibold">{purchaseData.purchase.vendorName || 'Unknown'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Boxes className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Total Items</p>
                      <p className="font-semibold">{purchaseData.items?.length || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Total Cost</p>
                      <p className="font-semibold">
                        {formatCurrency(purchaseData.purchase.totalCost)}
                      </p>
                    </div>
                  </div>
                </div>

                {purchaseData.purchase.notes && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600">{purchaseData.purchase.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Items ({purchaseData.items?.length || 0})
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of all items in this purchase order
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchaseData.items && purchaseData.items.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseData.items.map((item: any, index: number) => {
                          const itemDetails = formatItemDetails(item)
                          const totalCost = item.totalCost ||
                                          (itemDetails.unitCost && item.quantity ?
                                            itemDetails.unitCost * item.quantity : null)

                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="font-medium">{itemDetails.name}</div>
                                {item.notes && (
                                  <div className="text-sm text-gray-500 mt-1">{item.notes}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-600">{itemDetails.details}</div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(itemDetails.unitCost)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {formatCurrency(totalCost)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items found for this purchase order
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Purchase order not found
          </div>
        )}
      </div>
    </div>
  )
}