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
import { AppleTransactionForm } from "@/components/inventory/AppleTransactionForm"
import { InventoryTable } from "@/components/inventory/InventoryTable"
import { BaseFruitTable } from "@/components/inventory/BaseFruitTable"
import { PurchaseOrdersTable } from "@/components/inventory/PurchaseOrdersTable"
import {
  Package,
  Plus,
  Download,
  AlertTriangle,
  TrendingUp,
  Beaker,
  Droplets,
  Apple,
  ShoppingCart
} from "lucide-react"
import { trpc } from "@/utils/trpc"
import { handleTransactionError, showSuccess, showLoading } from "@/utils/error-handling"

export default function InventoryPage() {
  const { data: session } = useSession()
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("inventory")
  const [showAdditivesForm, setShowAdditivesForm] = useState(false)
  const [showJuiceForm, setShowJuiceForm] = useState(false)
  const [showPackagingForm, setShowPackagingForm] = useState(false)
  const [showAppleForm, setShowAppleForm] = useState(false)

  // Get inventory data using unified inventory API (minimal data for now)
  const { data: inventoryData, isLoading } = trpc.inventory.list.useQuery({
    limit: 50,
    offset: 0
  })

  // tRPC mutations
  const createInventoryItemMutation = trpc.inventory.createInventoryItem.useMutation({
    onSuccess: () => {
      // Refetch inventory data
      inventoryData && window.location.reload()
    }
  })

  // Handler for additives form submission
  const handleAdditivesSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording additives purchase...")

    try {
      console.log("Additives transaction:", transaction)

      // Transform the form data to match the API schema
      const inventoryTransaction = {
        materialType: 'additive' as const,
        transactionType: 'purchase' as const,
        quantityChange: Math.round(transaction.quantity), // Convert to integer
        transactionDate: new Date(),
        additiveType: transaction.additiveType,
        additiveName: transaction.productName,
        quantity: transaction.quantity,
        unit: transaction.unit as 'kg' | 'g' | 'L' | 'mL' | 'tablets' | 'packets',
        expirationDate: transaction.expirationDate ? new Date(transaction.expirationDate) : undefined,
        batchNumber: transaction.lotBatchNumber,
        storageRequirements: transaction.storageRequirements,
        notes: [
          transaction.notes,
          `Brand: ${transaction.brandManufacturer}`,
          transaction.unitCost ? `Unit Cost: $${transaction.unitCost}` : undefined,
          transaction.totalCost ? `Total Cost: $${transaction.totalCost}` : undefined
        ].filter(Boolean).join(' | ')
      }

      await createInventoryItemMutation.mutateAsync(inventoryTransaction)
      dismissLoading()
      showSuccess(
        "Additives Purchase Recorded",
        `Successfully added ${transaction.quantity} ${transaction.unit} of ${transaction.productName} to inventory.`
      )
      setShowAdditivesForm(false)
      setActiveTab("inventory")
    } catch (error) {
      dismissLoading()
      handleTransactionError(error, "Additives", "Purchase")
    }
  }

  const handleAdditivesCancel = () => {
    setShowAdditivesForm(false)
    setActiveTab("inventory")
  }

  // Handler for juice form submission
  const handleJuiceSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording juice purchase...")

    try {
      console.log("Juice transaction:", transaction)

      // Transform the form data to match the API schema
      const inventoryTransaction = {
        materialType: 'juice' as const,
        transactionType: 'purchase' as const,
        quantityChange: Math.round(transaction.volumeL), // Convert to integer
        transactionDate: new Date(),
        pressRunId: transaction.pressRunId,
        vesselId: transaction.vesselId,
        volumeL: transaction.volumeL,
        brixLevel: transaction.brixLevel,
        phLevel: transaction.phLevel,
        varietyComposition: transaction.varietyComposition,
        processDate: transaction.processDate ? new Date(transaction.processDate) : undefined,
        qualityNotes: transaction.qualityNotes,
        notes: transaction.notes
      }

      await createInventoryItemMutation.mutateAsync(inventoryTransaction)
      dismissLoading()
      showSuccess(
        "Juice Purchase Recorded",
        `Successfully added ${transaction.volumeL}L of juice to inventory.`
      )
      setShowJuiceForm(false)
      setActiveTab("inventory")
    } catch (error) {
      dismissLoading()
      handleTransactionError(error, "Juice", "Purchase")
    }
  }

  const handleJuiceCancel = () => {
    setShowJuiceForm(false)
    setActiveTab("inventory")
  }

  // Handler for packaging form submission
  const handlePackagingSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording packaging purchase...")

    try {
      console.log("Packaging transaction:", transaction)

      // Transform the form data to match the API schema
      const inventoryTransaction = {
        materialType: 'packaging' as const,
        transactionType: 'purchase' as const,
        quantityChange: Math.round(transaction.quantity), // Convert to integer
        transactionDate: new Date(),
        packagingType: transaction.packagingType as 'bottle' | 'cap' | 'label' | 'case' | 'shrink_wrap' | 'carton',
        packagingName: transaction.packagingName,
        quantity: transaction.quantity,
        unit: transaction.unit as 'pieces' | 'cases' | 'rolls' | 'sheets',
        size: transaction.size,
        color: transaction.color,
        material: transaction.material,
        supplier: transaction.supplier,
        notes: transaction.notes
      }

      await createInventoryItemMutation.mutateAsync(inventoryTransaction)
      dismissLoading()
      showSuccess(
        "Packaging Purchase Recorded",
        `Successfully added ${transaction.quantity} ${transaction.unit} of ${transaction.packagingName} to inventory.`
      )
      setShowPackagingForm(false)
      setActiveTab("inventory")
    } catch (error) {
      dismissLoading()
      handleTransactionError(error, "Packaging", "Purchase")
    }
  }

  const handlePackagingCancel = () => {
    setShowPackagingForm(false)
    setActiveTab("inventory")
  }

  // Handler for apple form submission
  const handleAppleSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording apple purchase...")

    try {
      console.log("Apple transaction:", transaction)

      // Transform the form data to match the API schema
      const inventoryTransaction = {
        materialType: 'apple' as const,
        transactionType: 'purchase' as const,
        quantityChange: Math.round(transaction.quantityKg), // Convert to integer
        transactionDate: new Date(),
        appleVarietyId: transaction.appleVarietyId,
        vendorId: transaction.vendorId,
        quantityKg: transaction.quantityKg,
        qualityGrade: transaction.qualityGrade,
        harvestDate: transaction.harvestDate ? new Date(transaction.harvestDate) : undefined,
        storageLocation: transaction.storageLocation,
        defectPercentage: transaction.defectPercentage,
        brixLevel: transaction.brixLevel,
        notes: transaction.notes
      }

      await createInventoryItemMutation.mutateAsync(inventoryTransaction)
      dismissLoading()
      showSuccess(
        "Apple Purchase Recorded",
        `Successfully added ${transaction.quantityKg} kg of base fruit to inventory.`
      )
      setShowAppleForm(false)
      setActiveTab("apple")
    } catch (error) {
      dismissLoading()
      handleTransactionError(error, "Apple", "Purchase")
    }
  }

  const handleAppleCancel = () => {
    setShowAppleForm(false)
    setActiveTab("apple")
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
      } else if (event.detail === 'apple') {
        setActiveTab('apple')
        setShowAppleForm(true)
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


        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="inventory" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Package className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="apple" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <Apple className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Base Fruit</span>
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
            <TabsTrigger value="purchase-orders" className="flex items-center justify-center space-x-1 lg:space-x-2 py-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Purchase Orders</span>
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

          <TabsContent value="apple" className="space-y-6">
            {showAppleForm ? (
              <AppleTransactionForm
                onCancel={handleAppleCancel}
              />
            ) : (
              <BaseFruitTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowAppleForm(true)}
                className=""
              />
            )}
          </TabsContent>

          <TabsContent value="additives" className="space-y-6">
            {showAdditivesForm ? (
              <AdditivesTransactionForm
                onSubmit={handleAdditivesSubmit}
                onCancel={handleAdditivesCancel}
                isSubmitting={createInventoryItemMutation.isPending}
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
                isSubmitting={createInventoryItemMutation.isPending}
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
                isSubmitting={createInventoryItemMutation.isPending}
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


          <TabsContent value="purchase-orders" className="space-y-6">
            <PurchaseOrdersTable
              showFilters={true}
              itemsPerPage={50}
              className=""
            />
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