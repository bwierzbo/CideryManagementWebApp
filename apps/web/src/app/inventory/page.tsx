"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionTypeSelector } from "@/components/inventory/TransactionTypeSelector";
import { AdditivesTransactionForm } from "@/components/inventory/AdditivesTransactionForm";
import { JuiceTransactionForm } from "@/components/inventory/JuiceTransactionForm";
import { PackagingTransactionForm } from "@/components/inventory/PackagingTransactionForm";
import { AppleTransactionForm } from "@/components/inventory/AppleTransactionForm";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { BaseFruitTable } from "@/components/inventory/BaseFruitTable";
import { AdditivesInventoryTable } from "@/components/inventory/AdditivesInventoryTable";
import { JuiceInventoryTable } from "@/components/inventory/JuiceInventoryTable";
import { PackagingInventoryTable } from "@/components/inventory/PackagingInventoryTable";
import { PurchaseOrdersTable } from "@/components/inventory/PurchaseOrdersTable";
import { PackagingTable as BottleTable } from "@/components/bottles/bottle-table";
import { InventoryFAB } from "@/components/inventory/InventoryFAB";
import { InventoryItemDetailsModal } from "@/components/inventory/InventoryItemDetailsModal";
import { EditBaseFruitItemModal } from "@/components/inventory/EditBaseFruitItemModal";
import { EditJuiceItemModal } from "@/components/inventory/EditJuiceItemModal";
import { EditAdditiveItemModal } from "@/components/inventory/EditAdditiveItemModal";
import { EditPackagingItemModal } from "@/components/inventory/EditPackagingItemModal";
import {
  Package,
  Plus,
  Download,
  AlertTriangle,
  TrendingUp,
  Beaker,
  Droplets,
  Apple,
  ShoppingCart,
  Wine,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  handleTransactionError,
  showSuccess,
  showLoading,
} from "@/utils/error-handling";

export default function InventoryPage() {
  const { data: session } = useSession();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inventory");
  const [showAdditivesForm, setShowAdditivesForm] = useState(false);
  const [showJuiceForm, setShowJuiceForm] = useState(false);
  const [showPackagingForm, setShowPackagingForm] = useState(false);
  const [showAppleForm, setShowAppleForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Edit modal state
  const [editBaseFruitItem, setEditBaseFruitItem] = useState<any | null>(null);
  const [editJuiceItem, setEditJuiceItem] = useState<any | null>(null);
  const [editAdditiveItem, setEditAdditiveItem] = useState<any | null>(null);
  const [editPackagingItem, setEditPackagingItem] = useState<any | null>(null);

  // Get inventory data using unified inventory API (minimal data for now)
  const { data: inventoryData, isLoading } = trpc.inventory.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // tRPC context for cache invalidation
  const utils = trpc.useContext();

  // tRPC mutations
  // Purchase mutations for different material types
  const createAdditivePurchaseMutation =
    trpc.additivePurchases.create.useMutation({
      onSuccess: () => {
        utils.inventory.list.invalidate();
      },
    });

  const createJuicePurchaseMutation = trpc.juicePurchases.create.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
    },
  });

  const createPackagingPurchaseMutation =
    trpc.packagingPurchases.create.useMutation({
      onSuccess: () => {
        utils.inventory.list.invalidate();
      },
    });

  const createBaseFruitPurchaseMutation =
    trpc.baseFruitPurchases.create.useMutation({
      onSuccess: () => {
        // Refetch inventory data
        inventoryData && window.location.reload();
      },
    });

  // Handler for additives form submission
  const handleAdditivesSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording additives purchase...");

    try {
      console.log("Additives transaction:", transaction);

      // Create additive purchase with multiple items
      const purchaseData = {
        vendorId: transaction.vendorId,
        purchaseDate: new Date(transaction.purchaseDate),
        invoiceNumber: undefined,
        notes:
          transaction.notes ||
          `Additives purchased from ${transaction.vendorName || "vendor"}`,
        items: transaction.items.map((item: any) => ({
          additiveVarietyId: item.additiveId,
          brandManufacturer: transaction.vendorName || transaction.vendorId,
          productName: item.additiveName || "Unknown Additive",
          quantity: item.quantity,
          unit: (item.unit === "lb"
            ? "lb"
            : item.unit === "mL"
              ? "oz"
              : item.unit) as "g" | "kg" | "oz" | "lb",
          pricePerUnit: item.unitCost,
          notes: item.notes,
        })),
      };

      await createAdditivePurchaseMutation.mutateAsync(purchaseData);
      dismissLoading();

      const itemCount = transaction.items.length;
      const itemText =
        itemCount === 1
          ? `${transaction.items[0].quantity} ${transaction.items[0].unit} of ${transaction.items[0].additiveName}`
          : `${itemCount} different additives`;

      showSuccess(
        "Additives Purchase Recorded",
        `Successfully added ${itemText} to inventory.`,
      );
      setShowAdditivesForm(false);
      setActiveTab("additives");
    } catch (error) {
      dismissLoading();
      handleTransactionError(error, "Additives", "Purchase");
    }
  };

  const handleAdditivesCancel = () => {
    setShowAdditivesForm(false);
    setActiveTab("additives");
  };

  // Handler for juice form submission
  const handleJuiceSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording juice purchase...");

    try {
      console.log("Juice transaction:", transaction);

      // Create juice purchase with multiple items
      const purchaseData = {
        vendorId: transaction.vendorId,
        purchaseDate: new Date(transaction.purchaseDate),
        invoiceNumber: undefined,
        notes:
          transaction.notes ||
          `Juice purchased from ${transaction.vendorName || "vendor"}`,
        items: transaction.items.map((item: any) => {
          // More robust unit checking - handle both 'liters'/'liter' and 'L'
          const isLiters =
            item.unit === "liters" ||
            item.unit === "liter" ||
            item.unit === "L" ||
            item.unit?.toLowerCase() === "liters";
          const volumeL = isLiters ? item.volume : item.volume * 3.78541;

          // Debug logging to trace volume calculation
          console.log('[JUICE PURCHASE DEBUG]', {
            juiceName: item.juiceName,
            inputVolume: item.volume,
            unit: item.unit,
            isLiters,
            convertedVolumeL: volumeL,
          });

          return {
            juiceType: "blend" as const, // Default type
            varietyName: item.juiceName || "Unknown Juice",
            volumeL: volumeL,
            brix: item.specificGravity
              ? ((item.specificGravity - 1) * 1000) / 4
              : undefined, // Rough SG to Brix conversion
            ph: item.ph, // Use the new pH field directly
            specificGravity: item.specificGravity, // Use the new SG field directly
            pricePerLiter: item.unitCost
              ? isLiters
                ? item.unitCost
                : item.unitCost / 3.78541
              : undefined,
            notes: item.notes,
          };
        }),
      };

      await createJuicePurchaseMutation.mutateAsync(purchaseData);
      dismissLoading();

      const itemCount = transaction.items.length;
      const itemText =
        itemCount === 1
          ? `${transaction.items[0].volume} ${transaction.items[0].unit} of ${transaction.items[0].juiceName}`
          : `${itemCount} different juices`;

      showSuccess(
        "Juice Purchase Recorded",
        `Successfully added ${itemText} to inventory.`,
      );
      setShowJuiceForm(false);
      setActiveTab("juice");
    } catch (error) {
      dismissLoading();
      handleTransactionError(error, "Juice", "Purchase");
    }
  };

  const handleJuiceCancel = () => {
    setShowJuiceForm(false);
    setActiveTab("juice");
  };

  // Handler for packaging form submission
  const handlePackagingSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording packaging purchase...");

    try {
      console.log("Packaging transaction:", transaction);

      // Create packaging purchase with multiple items
      const purchaseData = {
        vendorId: transaction.vendorId,
        purchaseDate: new Date(transaction.purchaseDate),
        invoiceNumber: undefined,
        notes:
          transaction.notes ||
          `Packaging purchased from ${transaction.vendorName || "vendor"}`,
        items: transaction.items.map((item: any) => ({
          packagingId: item.packagingId,
          packagingName: item.packagingName,
          packagingType: item.packagingType,
          unitType: item.unitType,
          quantity: item.quantity,
          pricePerUnit: item.unitCost,
          totalCost: item.totalCost,
          notes: item.notes,
        })),
      };

      await createPackagingPurchaseMutation.mutateAsync(purchaseData);
      dismissLoading();

      const itemCount = transaction.items.length;
      const itemText =
        itemCount === 1
          ? `${transaction.items[0].quantity} ${transaction.items[0].unitType} of ${transaction.items[0].packagingName}`
          : `${itemCount} different packaging items`;

      showSuccess(
        "Packaging Purchase Recorded",
        `Successfully added ${itemText} to inventory.`,
      );
      setShowPackagingForm(false);
      setActiveTab("packaging");
    } catch (error) {
      dismissLoading();
      handleTransactionError(error, "Packaging", "Purchase");
    }
  };

  const handlePackagingCancel = () => {
    setShowPackagingForm(false);
    setActiveTab("packaging");
  };

  // Handler for apple form submission
  const handleAppleSubmit = async (transaction: any) => {
    const dismissLoading = showLoading("Recording apple purchase...");

    try {
      console.log("Apple transaction:", transaction);

      // Create base fruit purchase
      const purchaseData = {
        vendorId: transaction.vendorId,
        purchaseDate: new Date(transaction.purchaseDate),
        invoiceNumber: undefined,
        notes: transaction.notes,
        items: transaction.items.map((item: any) => ({
          fruitVarietyId: item.fruitVarietyId,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: item.pricePerUnit,
          harvestDate: item.harvestDate,
          notes: item.notes,
        })),
      };

      await createBaseFruitPurchaseMutation.mutateAsync(purchaseData);
      dismissLoading();

      const itemCount = transaction.items.length;
      const totalQuantity = transaction.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      );
      const itemText =
        itemCount === 1
          ? `${transaction.items[0].quantity} ${transaction.items[0].unit} of base fruit`
          : `${itemCount} different base fruit varieties (${totalQuantity} total units)`;

      showSuccess(
        "Base Fruit Purchase Recorded",
        `Successfully added ${itemText} to inventory.`,
      );
      setShowAppleForm(false);
      setActiveTab("apple");
    } catch (error) {
      dismissLoading();
      handleTransactionError(error, "Apple", "Purchase");
    }
  };

  const handleAppleCancel = () => {
    setShowAppleForm(false);
    setActiveTab("apple");
  };

  // Listen for tab change events from TransactionTypeSelector
  useEffect(() => {
    const handleSetTab = (event: CustomEvent) => {
      if (event.detail === "additives") {
        setActiveTab("additives");
        setShowAdditivesForm(true);
      } else if (event.detail === "juice") {
        setActiveTab("juice");
        setShowJuiceForm(true);
      } else if (event.detail === "packaging") {
        setActiveTab("packaging");
        setShowPackagingForm(true);
      } else if (event.detail === "apple") {
        setActiveTab("apple");
        setShowAppleForm(true);
      }
    };

    window.addEventListener("setInventoryTab", handleSetTab as EventListener);

    return () => {
      window.removeEventListener(
        "setInventoryTab",
        handleSetTab as EventListener,
      );
    };
  }, []);

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
              <p className="text-gray-600 mt-2">
                Track and manage your cidery inventory
              </p>
            </div>
          </div>
        </div>

        {/* Main Content with Sidebar Navigation */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-4">
                <nav className="space-y-1">
                  {/* Primary Views Section */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                      Overview
                    </h3>
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "inventory"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Package className="w-5 h-5 flex-shrink-0" />
                      <span>All Inventory</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("ciders")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "ciders"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Wine className="w-5 h-5 flex-shrink-0" />
                      <span>Finished Ciders</span>
                    </button>
                  </div>

                  {/* Materials Section */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 pt-2 border-t">
                      Raw Materials
                    </h3>
                    <button
                      onClick={() => setActiveTab("apple")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "apple"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Apple className="w-5 h-5 flex-shrink-0" />
                      <span>Base Fruit</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("juice")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "juice"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Droplets className="w-5 h-5 flex-shrink-0" />
                      <span>Juice</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("additives")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "additives"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Beaker className="w-5 h-5 flex-shrink-0" />
                      <span>Additives</span>
                    </button>
                  </div>

                  {/* Packaging Section */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 pt-2 border-t">
                      Packaging
                    </h3>
                    <button
                      onClick={() => setActiveTab("packaging")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "packaging"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Package className="w-5 h-5 flex-shrink-0" />
                      <span>Packaging Materials</span>
                    </button>
                  </div>

                  {/* Management Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 pt-2 border-t">
                      Management
                    </h3>
                    <button
                      onClick={() => setActiveTab("purchase-orders")}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === "purchase-orders"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                      <span>Transaction History</span>
                    </button>
                  </div>
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
          {activeTab === "inventory" && (
            <div className="space-y-6">
            {/* Header with Add Button */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Inventory</CardTitle>
                    <CardDescription>
                      View all inventory items across all categories
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Purchase
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Purchase Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowAppleForm(true)}>
                        <Apple className="w-4 h-4 mr-2 text-red-600" />
                        <span>Base Fruit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowJuiceForm(true)}>
                        <Droplets className="w-4 h-4 mr-2 text-blue-600" />
                        <span>Juice</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowAdditivesForm(true)}>
                        <Beaker className="w-4 h-4 mr-2 text-purple-600" />
                        <span>Additives</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowPackagingForm(true)}>
                        <Package className="w-4 h-4 mr-2 text-orange-600" />
                        <span>Packaging</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
            </Card>
            {/* Enhanced Inventory Table with Search */}
            <InventoryTable
              showSearch={true}
              itemsPerPage={100}
              className=""
              onItemClick={(item) => setSelectedItem(item)}
            />
            </div>
          )}

          {activeTab === "ciders" && (
            <div className="space-y-6">
            <BottleTable
              filters={{
                status: "completed",
              }}
              itemsPerPage={50}
              className=""
            />
            </div>
          )}

          {activeTab === "apple" && (
            <div className="space-y-6">
              <BaseFruitTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowAppleForm(true)}
                onItemClick={(item) => setSelectedItem(item)}
                onEdit={(item) => setEditBaseFruitItem(item)}
                className=""
              />
            </div>
          )}

          {activeTab === "additives" && (
            <div className="space-y-6">
              <AdditivesInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowAdditivesForm(true)}
                onItemClick={(item) => setSelectedItem(item)}
                onEdit={(item) => {
                  console.log("Edit button clicked for additive item:", item);

                  // Transform inventory item to additive purchase item format
                  const transformedItem = {
                    id: item.id,
                    quantity: item.currentBottleCount,
                    unit: item.metadata?.unit || "kg",
                    pricePerUnit: item.metadata?.unitCost || "0",
                    notes: item.notes || "",
                    brandManufacturer: item.metadata?.brandManufacturer,
                    productName: item.metadata?.productName,
                  };

                  console.log("Transformed item for edit modal:", transformedItem);
                  setEditAdditiveItem(transformedItem);
                }}
                className=""
              />
            </div>
          )}

          {activeTab === "juice" && (
            <div className="space-y-6">
              <JuiceInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowJuiceForm(true)}
                onItemClick={(item) => setSelectedItem(item)}
                onEdit={(item) => setEditJuiceItem(item)}
                className=""
              />
            </div>
          )}

          {activeTab === "packaging" && (
            <div className="space-y-6">
              <PackagingInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowPackagingForm(true)}
                onItemClick={(item) => setSelectedItem(item)}
                onEdit={(item) => setEditPackagingItem(item)}
                className=""
              />
            </div>
          )}

          {activeTab === "purchase-orders" && (
            <div className="space-y-6">
            <PurchaseOrdersTable
              showFilters={true}
              itemsPerPage={50}
              className=""
            />
            </div>
          )}
          </div>
        </div>

        {/* Floating Action Button */}
        <InventoryFAB
          activeTab={activeTab}
          onAddApple={() => setShowAppleForm(true)}
          onAddAdditive={() => setShowAdditivesForm(true)}
          onAddJuice={() => setShowJuiceForm(true)}
          onAddPackaging={() => setShowPackagingForm(true)}
        />

        {/* Transaction Type Selector Modal */}
        <TransactionTypeSelector
          open={isTransactionModalOpen}
          onOpenChange={setIsTransactionModalOpen}
        />

        {/* Sheet Drawers for Transaction Forms */}
        <Sheet open={showAppleForm} onOpenChange={setShowAppleForm}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Base Fruit Purchase</SheetTitle>
              <SheetDescription>
                Record a new purchase of apples or other base fruit for pressing
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <AppleTransactionForm
                onSubmit={handleAppleSubmit}
                onCancel={handleAppleCancel}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={showAdditivesForm} onOpenChange={setShowAdditivesForm}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Additives Purchase</SheetTitle>
              <SheetDescription>
                Record a new purchase of enzymes, nutrients, clarifiers, or other additives
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <AdditivesTransactionForm
                onSubmit={handleAdditivesSubmit}
                onCancel={handleAdditivesCancel}
                isSubmitting={createAdditivePurchaseMutation.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={showJuiceForm} onOpenChange={setShowJuiceForm}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Juice Purchase</SheetTitle>
              <SheetDescription>
                Record a new purchase of pressed juice ready for fermentation
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <JuiceTransactionForm
                onSubmit={handleJuiceSubmit}
                onCancel={handleJuiceCancel}
                isSubmitting={createJuicePurchaseMutation.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={showPackagingForm} onOpenChange={setShowPackagingForm}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Packaging Purchase</SheetTitle>
              <SheetDescription>
                Record a new purchase of bottles, cans, kegs, labels, caps, or other packaging materials
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <PackagingTransactionForm
                onSubmit={handlePackagingSubmit}
                onCancel={handlePackagingCancel}
                isSubmitting={createPackagingPurchaseMutation.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inventory Item Details Modal */}
        <InventoryItemDetailsModal
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
        />

        {/* Edit Modals */}
        <EditBaseFruitItemModal
          open={!!editBaseFruitItem}
          onClose={() => setEditBaseFruitItem(null)}
          item={editBaseFruitItem}
        />

        <EditJuiceItemModal
          open={!!editJuiceItem}
          onClose={() => setEditJuiceItem(null)}
          item={editJuiceItem}
        />

        <EditAdditiveItemModal
          open={!!editAdditiveItem}
          onClose={() => setEditAdditiveItem(null)}
          item={editAdditiveItem}
        />

        <EditPackagingItemModal
          open={!!editPackagingItem}
          onClose={() => setEditPackagingItem(null)}
          item={editPackagingItem}
        />
      </div>
    </div>
  );
}
