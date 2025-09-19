"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TransactionTypeSelector } from "@/components/inventory/TransactionTypeSelector"
import { AdditivesTransactionForm } from "@/components/inventory/AdditivesTransactionForm"
import { JuiceTransactionForm } from "@/components/inventory/JuiceTransactionForm"
import { PackagingTransactionForm } from "@/components/inventory/PackagingTransactionForm"
import { InventoryTable } from "@/components/inventory/InventoryTable"
import {
  Package,
  Plus,
  Download,
  AlertTriangle,
  TrendingUp,
  Beaker,
  Droplets
} from "lucide-react"
import { trpc } from "@/utils/trpc"

export default function InventoryPage() {
  const { data: session } = useSession()
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("inventory")
  const [showAdditivesForm, setShowAdditivesForm] = useState(false)
  const [showJuiceForm, setShowJuiceForm] = useState(false)
  const [showPackagingForm, setShowPackagingForm] = useState(false)

  // Get inventory data using unified inventory API
  const { data: inventoryData, isLoading } = trpc.inventory.list.useQuery({
    limit: 1000, // Get all for stats calculation
    offset: 0
  })
  const inventoryItems = inventoryData?.items || []

  // Calculate inventory stats from unified inventory data
  const totalBottles = inventoryItems.reduce((sum, item) => sum + item.currentBottleCount, 0)
  const totalReserved = inventoryItems.reduce((sum, item) => sum + item.reservedBottleCount, 0)
  const uniqueProducts = inventoryItems.length
  const lowStockCount = inventoryItems.filter(item => {
    const available = item.currentBottleCount - item.reservedBottleCount
    return available > 0 && available < 50
  }).length

  // Handler for additives form submission
  const handleAdditivesSubmit = async (transaction: any) => {
    try {
      console.log("Additives transaction:", transaction)
      // TODO: Implement tRPC mutation for additives transaction
      alert("Additives transaction recorded successfully!")
      setShowAdditivesForm(false)
      setActiveTab("inventory")
    } catch (error) {
      console.error("Error recording additives transaction:", error)
      alert("Error recording transaction. Please try again.")
    }
  }

  const handleAdditivesCancel = () => {
    setShowAdditivesForm(false)
    setActiveTab("inventory")
  }

  // Handler for juice form submission
  const handleJuiceSubmit = async (transaction: any) => {
    try {
      console.log("Juice transaction:", transaction)
      // TODO: Implement tRPC mutation for juice transaction
      alert("Juice transaction recorded successfully!")
      setShowJuiceForm(false)
      setActiveTab("inventory")
    } catch (error) {
      console.error("Error recording juice transaction:", error)
      alert("Error recording transaction. Please try again.")
    }
  }

  const handleJuiceCancel = () => {
    setShowJuiceForm(false)
    setActiveTab("inventory")
  }

  // Handler for packaging form submission
  const handlePackagingSubmit = async (transaction: any) => {
    try {
      console.log("Packaging transaction:", transaction)
      // TODO: Implement tRPC mutation for packaging transaction
      alert("Packaging transaction recorded successfully!")
      setShowPackagingForm(false)
      setActiveTab("inventory")
    } catch (error) {
      console.error("Error recording packaging transaction:", error)
      alert("Error recording transaction. Please try again.")
    }
  }

  const handlePackagingCancel = () => {
    setShowPackagingForm(false)
    setActiveTab("inventory")
  }

  // Listen for tab change events from TransactionTypeSelector
  useEffect(() => {
    const handleSetTab = (event: CustomEvent) => {
      if (event.detail === 'additives') {
        setActiveTab('additives')
        setShowAdditivesForm(true)
      } else if (event.detail === 'juice') {
        setActiveTab('juice')
        setShowJuiceForm(true)
      } else if (event.detail === 'packaging') {
        setActiveTab('packaging')
        setShowPackagingForm(true)
      }
    }

    window.addEventListener('setInventoryTab', handleSetTab as EventListener)

    return () => {
      window.removeEventListener('setInventoryTab', handleSetTab as EventListener)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center">
                <Package className="w-6 h-6 lg:w-8 lg:h-8 text-amber-600 mr-3" />
                Inventory Management
              </h1>
              <p className="text-gray-600 mt-2">Track and manage your cidery inventory</p>
            </div>

            {(session?.user as any)?.role === 'admin' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => {
                    setShowAdditivesForm(true)
                    setActiveTab("additives")
                  }}
                >
                  <Beaker className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add Additives</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => {
                    setShowJuiceForm(true)
                    setActiveTab("juice")
                  }}
                >
                  <Droplets className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add Juice</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => {
                    setShowPackagingForm(true)
                    setActiveTab("packaging")
                  }}
                >
                  <Package className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add Packaging</span>
                </Button>
                <Button
                  size="sm"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{totalBottles.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Current inventory</p>
                </div>
                <Package className="w-6 h-6 lg:w-8 lg:h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reserved</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{totalReserved.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Pending orders</p>
                </div>
                <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inventory Lines</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{uniqueProducts}</p>
                  <p className="text-sm text-gray-500">Active products</p>
                </div>
                <Package className="w-6 h-6 lg:w-8 lg:h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">{lowStockCount}</p>
                  <p className="text-sm text-gray-500">Items below 50 units</p>
                </div>
                <AlertTriangle className="w-6 h-6 lg:w-8 lg:h-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="inventory" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Package className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="additives" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Beaker className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Additives</span>
            </TabsTrigger>
            <TabsTrigger value="juice" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Droplets className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Juice</span>
            </TabsTrigger>
            <TabsTrigger value="packaging" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Package className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Packaging</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            {/* Enhanced Inventory Table with Search and Filters */}
            <InventoryTable
              showSearch={true}
              showFilters={true}
              itemsPerPage={50}
              className=""
            />
          </TabsContent>

          <TabsContent value="additives" className="space-y-6">
            {showAdditivesForm ? (
              <AdditivesTransactionForm
                onSubmit={handleAdditivesSubmit}
                onCancel={handleAdditivesCancel}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Beaker className="w-5 h-5 text-purple-600" />
                    <span>Additives Inventory</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your additives inventory and record new purchases
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <Beaker className="w-16 h-16 text-gray-300 mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No additives recorded yet
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Start by recording your first additives purchase
                      </p>
                      <Button
                        onClick={() => setShowAdditivesForm(true)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Beaker className="w-4 h-4 mr-2" />
                        Add Additives Purchase
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="juice" className="space-y-6">
            {showJuiceForm ? (
              <JuiceTransactionForm
                onSubmit={handleJuiceSubmit}
                onCancel={handleJuiceCancel}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <span>Juice Inventory</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your juice inventory and record new purchases
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <Droplets className="w-16 h-16 text-gray-300 mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No juice recorded yet
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Start by recording your first juice purchase
                      </p>
                      <Button
                        onClick={() => setShowJuiceForm(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Droplets className="w-4 h-4 mr-2" />
                        Add Juice Purchase
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="packaging" className="space-y-6">
            {showPackagingForm ? (
              <PackagingTransactionForm
                onSubmit={handlePackagingSubmit}
                onCancel={handlePackagingCancel}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    <span>Packaging Inventory</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your packaging materials and record new purchases
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <Package className="w-16 h-16 text-gray-300 mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No packaging materials recorded yet
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Start by recording your first packaging purchase
                      </p>
                      <Button
                        onClick={() => setShowPackagingForm(true)}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Add Packaging Purchase
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Transaction Type Selector Modal */}
        <TransactionTypeSelector
          open={isTransactionModalOpen}
          onOpenChange={setIsTransactionModalOpen}
        />
      </div>
    </div>
  )
}