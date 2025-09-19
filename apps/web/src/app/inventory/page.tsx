"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TransactionTypeSelector } from "@/components/inventory/TransactionTypeSelector"
import {
  Package,
  Search,
  Filter,
  Plus,
  Download,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Calendar
} from "lucide-react"
import { trpc } from "@/utils/trpc"

export default function InventoryPage() {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)

  // Get inventory data using existing tRPC endpoints
  const { data: packagesData, isLoading } = trpc.packaging.list.useQuery()
  const packages = packagesData?.packages || []

  // Filter packages based on search and filters
  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.batchId?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLocation = locationFilter === "all" || true // simplified for demo
    const matchesStatus = statusFilter === "all" || true // simplified for demo

    return matchesSearch && matchesLocation && matchesStatus
  })

  // Calculate inventory stats - simplified for demo
  const totalBottles = packages.reduce((sum, pkg) => sum + (pkg.bottleCount || 0), 0)
  const totalReserved = 0 // simplified for demo
  const uniqueProducts = new Set(packages.map(pkg => pkg.batchId)).size
  const lowStockCount = packages.filter(pkg => (pkg.bottleCount || 0) < 50).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Package className="w-8 h-8 text-amber-600 mr-3" />
                Inventory Management
              </h1>
              <p className="text-gray-600 mt-2">Track and manage your cidery inventory</p>
            </div>

            {(session?.user as any)?.role === 'admin' && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
                  className="flex items-center"
                  onClick={() => setIsTransactionModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record Transaction
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bottles</p>
                  <p className="text-3xl font-bold text-gray-900">{totalBottles.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Available inventory</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reserved</p>
                  <p className="text-3xl font-bold text-gray-900">{totalReserved.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Pending orders</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Products</p>
                  <p className="text-3xl font-bold text-gray-900">{uniqueProducts}</p>
                  <p className="text-sm text-gray-500">Unique batches</p>
                </div>
                <Package className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-3xl font-bold text-gray-900">{lowStockCount}</p>
                  <p className="text-sm text-gray-500">Items below 50 units</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search Inventory</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by batch name or apple variety..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="lg:w-48">
                <Label htmlFor="location">Location</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="cellar">Cellar</SelectItem>
                    <SelectItem value="packaging">Packaging Area</SelectItem>
                    <SelectItem value="storage">Cold Storage</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:w-48">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="sold">Sold Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Inventory</span>
              <Badge variant="outline">{filteredPackages.length} items</Badge>
            </CardTitle>
            <CardDescription>
              Real-time inventory levels and product details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading inventory...</div>
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No inventory items found</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Available</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Reserved</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Package Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackages.map((pkg) => (
                      <tr key={pkg.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              Batch {pkg.batchId}
                            </div>
                            <div className="text-sm text-gray-500">
                              {pkg.abvAtPackaging}% ABV • {pkg.bottleSize}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                            <span className="capitalize">Warehouse</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium">{pkg.bottleCount}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium">0</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="w-4 h-4 mr-1" />
                            {pkg.packageDate ? new Date(pkg.packageDate).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {(pkg.bottleCount || 0) === 0 ? (
                            <Badge variant="destructive">Sold Out</Badge>
                          ) : (pkg.bottleCount || 0) < 50 ? (
                            <Badge variant="destructive">Low Stock</Badge>
                          ) : (
                            <Badge variant="outline">Available</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Type Selector Modal */}
        <TransactionTypeSelector
          open={isTransactionModalOpen}
          onOpenChange={setIsTransactionModalOpen}
        />
      </div>
    </div>
  )
}