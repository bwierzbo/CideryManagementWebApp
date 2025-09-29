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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

  // Get inventory data using unified inventory API (minimal data for now)
  const { data: inventoryData, isLoading } = trpc.inventory.list.useQuery({
    limit: 50,
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
          notes: undefined,
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
            notes: undefined, // pH and SG now have their own fields
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
          notes: undefined,
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

            {(session?.user as any)?.role === "admin" && (
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
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 lg:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger
              value="inventory"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <Package className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Inventory</span>
            </TabsTrigger>
            <TabsTrigger
              value="apple"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <Apple className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Base Fruit</span>
            </TabsTrigger>
            <TabsTrigger
              value="additives"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <Beaker className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Additives</span>
            </TabsTrigger>
            <TabsTrigger
              value="juice"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <Droplets className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Juice</span>
            </TabsTrigger>
            <TabsTrigger
              value="packaging"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <Package className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Packaging</span>
            </TabsTrigger>
            <TabsTrigger
              value="purchase-orders"
              className="flex items-center justify-center space-x-1 lg:space-x-2 py-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs lg:text-sm">Transaction History</span>
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
                onSubmit={handleAppleSubmit}
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
                isSubmitting={createAdditivePurchaseMutation.isPending}
              />
            ) : (
              <AdditivesInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowAdditivesForm(true)}
                className=""
              />
            )}
          </TabsContent>

          <TabsContent value="juice" className="space-y-6">
            {showJuiceForm ? (
              <JuiceTransactionForm
                onSubmit={handleJuiceSubmit}
                onCancel={handleJuiceCancel}
                isSubmitting={createJuicePurchaseMutation.isPending}
              />
            ) : (
              <JuiceInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowJuiceForm(true)}
                className=""
              />
            )}
          </TabsContent>

          <TabsContent value="packaging" className="space-y-6">
            {showPackagingForm ? (
              <PackagingTransactionForm
                onSubmit={handlePackagingSubmit}
                onCancel={handlePackagingCancel}
                isSubmitting={createPackagingPurchaseMutation.isPending}
              />
            ) : (
              <PackagingInventoryTable
                showFilters={true}
                itemsPerPage={50}
                onAddNew={() => setShowPackagingForm(true)}
                className=""
              />
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
  );
}
