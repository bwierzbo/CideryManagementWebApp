"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Send,
  Edit,
  TrendingUp,
  Wine,
  History,
  DollarSign,
  Minus,
  Plus,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDateTime } from "@/utils/date-format";
import { DistributeInventoryModal } from "@/components/packaging/DistributeInventoryModal";
import { AdjustInventoryModal } from "@/components/packaging/AdjustInventoryModal";
import { UpdatePricingModal } from "@/components/packaging/UpdatePricingModal";

export default function FinishedGoodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  // Modal state
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

  // Fetch inventory item details with history
  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.inventory.getFinishedGoodDetails.useQuery(itemId, {
    enabled: !!itemId,
  });

  const utils = trpc.useUtils();

  // Format currency
  const formatCurrency = (amount: string | number | null) => {
    if (amount === null || amount === undefined) return "-";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Format package size
  const formatPackageSize = (sizeML: number | null, packageType: string | null) => {
    if (!sizeML || !packageType) return packageType || "Unknown";
    if (sizeML >= 1000) {
      const liters = (sizeML / 1000).toFixed(1).replace(/\.0$/, "");
      return `${liters}L ${packageType}`;
    }
    return `${sizeML}ml ${packageType}`;
  };

  // Format adjustment type
  const formatAdjustmentType = (type: string) => {
    const types: Record<string, string> = {
      breakage: "Breakage",
      sample: "Sample",
      transfer: "Transfer",
      correction: "Correction",
      void: "Void",
    };
    return types[type] || type;
  };

  // Handle successful actions
  const handleActionSuccess = () => {
    refetch();
    utils.inventory.listFinishedGoods.invalidate();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-3 md:py-8 px-3 sm:px-4 lg:px-8">
          <div className="space-y-4 md:space-y-6">
            <Skeleton className="h-7 md:h-8 w-48 md:w-64" />
            <Skeleton className="h-64 md:h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-3 md:py-8 px-3 sm:px-4 lg:px-8">
          <div className="flex items-center gap-2 p-3 md:p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm md:text-base">
              Error loading inventory item: {error?.message || "Not found"}
            </span>
          </div>
        </main>
      </div>
    );
  }

  const { item, distributions, adjustments, summary } = data;
  const productName = item.batchCustomName || item.batchName || item.lotCode || "Product";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto py-3 md:py-8 px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="mb-4 md:mb-6 lg:mb-8">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              size="sm"
              className="h-9 px-2 md:px-4"
            >
              <ArrowLeft className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:gap-4">
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Wine className="w-5 h-5 md:w-7 md:h-7 flex-shrink-0" />
                <span className="truncate">{productName}</span>
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base font-mono">
                Lot: {item.lotCode || "No lot code"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setDistributeModalOpen(true)}
                size="sm"
                disabled={(item.currentQuantity || 0) === 0}
              >
                <Send className="w-4 h-4 mr-2" />
                Distribute
              </Button>
              <Button
                onClick={() => setAdjustModalOpen(true)}
                size="sm"
                variant="outline"
              >
                <Edit className="w-4 h-4 mr-2" />
                Adjust
              </Button>
              <Button
                onClick={() => setPricingModalOpen(true)}
                size="sm"
                variant="outline"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Update Pricing
              </Button>
              {item.bottleRunId && (
                <Button
                  onClick={() => router.push(`/packaging/${item.bottleRunId}`)}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Packaging Run
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4 lg:space-y-6">
            {/* Item Details Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Package className="w-4 h-4 md:w-5 md:h-5" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Package Type</p>
                    <Badge variant="outline" className="font-mono text-xs mt-1">
                      {formatPackageSize(item.packageSizeML, item.packageType)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Current Quantity</p>
                    <p
                      className={cn(
                        "font-semibold text-lg md:text-xl",
                        (item.currentQuantity || 0) === 0
                          ? "text-red-600"
                          : (item.currentQuantity || 0) < 50
                            ? "text-yellow-600"
                            : "text-green-600"
                      )}
                    >
                      {(item.currentQuantity || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Units Produced</p>
                    <p className="font-medium text-sm md:text-base">
                      {item.unitsProduced?.toLocaleString() || "-"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Retail Price</p>
                    <p className="font-mono font-medium text-sm md:text-base">
                      {formatCurrency(item.retailPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Wholesale Price</p>
                    <p className="font-mono font-medium text-sm md:text-base">
                      {formatCurrency(item.wholesalePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">ABV at Packaging</p>
                    <p className="font-medium text-sm md:text-base">
                      {item.abvAtPackaging ? `${Number(item.abvAtPackaging).toFixed(2)}%` : "-"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Packaged Date</p>
                    <p className="font-medium text-sm md:text-base flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.packagedAt
                        ? new Date(item.packagedAt).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Expiration Date</p>
                    <p className="font-medium text-sm md:text-base">
                      {item.expirationDate
                        ? new Date(item.expirationDate).toLocaleDateString()
                        : "No expiration"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Carbonation</p>
                    <p className="font-medium text-sm md:text-base capitalize">
                      {item.carbonationLevel || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Distribution History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                  Distribution History
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {summary.distributionCount} distribution{summary.distributionCount !== 1 ? "s" : ""} •{" "}
                  {summary.totalDistributed.toLocaleString()} units • {formatCurrency(summary.totalRevenue)} revenue
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {distributions.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No distributions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {distributions.map((dist) => (
                      <div
                        key={dist.id}
                        className="p-3 border rounded-lg bg-gray-50/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm md:text-base">
                              {dist.distributionLocation}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDateTime(new Date(dist.distributionDate))}
                              {dist.distributedByName && ` • ${dist.distributedByName}`}
                            </p>
                            {dist.salesChannelName && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {dist.salesChannelName}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm md:text-base text-red-600">
                              -{dist.quantityDistributed} units
                            </p>
                            <p className="text-xs text-green-600 font-mono">
                              {formatCurrency(dist.totalRevenue)}
                            </p>
                          </div>
                        </div>
                        {dist.notes && (
                          <p className="text-xs text-gray-600 mt-2 italic">
                            {dist.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Adjustment History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <History className="w-4 h-4 md:w-5 md:h-5" />
                  Adjustment History
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {summary.adjustmentCount} adjustment{summary.adjustmentCount !== 1 ? "s" : ""} •{" "}
                  Net change: {summary.totalAdjustments > 0 ? "+" : ""}{summary.totalAdjustments} units
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {adjustments.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No adjustments recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adjustments.map((adj) => (
                      <div
                        key={adj.id}
                        className="p-3 border rounded-lg bg-gray-50/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  adj.adjustmentType === "breakage" && "border-red-200 bg-red-50 text-red-700",
                                  adj.adjustmentType === "sample" && "border-blue-200 bg-blue-50 text-blue-700",
                                  adj.adjustmentType === "correction" && "border-yellow-200 bg-yellow-50 text-yellow-700",
                                  adj.adjustmentType === "transfer" && "border-purple-200 bg-purple-50 text-purple-700",
                                  adj.adjustmentType === "void" && "border-gray-200 bg-gray-50 text-gray-700"
                                )}
                              >
                                {formatAdjustmentType(adj.adjustmentType)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(new Date(adj.adjustedAt))}
                              {adj.adjustedByName && ` • ${adj.adjustedByName}`}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {adj.reason}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-semibold text-sm md:text-base flex items-center gap-1",
                                adj.quantityChange > 0 ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {adj.quantityChange > 0 ? (
                                <Plus className="w-3 h-3" />
                              ) : (
                                <Minus className="w-3 h-3" />
                              )}
                              {Math.abs(adj.quantityChange)} units
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Summary */}
          <div className="space-y-3 md:space-y-4 lg:space-y-6">
            {/* Inventory Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Inventory Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xs text-green-700 font-medium">Current Stock</p>
                  <p className="text-2xl font-bold text-green-800">
                    {(item.currentQuantity || 0).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">Distributed</p>
                    <p className="font-semibold text-red-600">
                      -{summary.totalDistributed.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 border">
                    <p className="text-xs text-gray-500">Adjusted</p>
                    <p className={cn(
                      "font-semibold",
                      summary.totalAdjustments >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {summary.totalAdjustments >= 0 ? "+" : ""}{summary.totalAdjustments}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold text-green-700 font-mono">
                    {formatCurrency(summary.totalRevenue)}
                  </p>
                </div>
                {summary.distributionCount > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Avg. Price/Unit</p>
                    <p className="font-medium font-mono">
                      {formatCurrency(summary.totalRevenue / summary.totalDistributed)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Batch Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Batch Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Batch Name</p>
                  <p className="font-medium truncate">
                    {item.batchCustomName || item.batchName || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {item.batchStatus || "Unknown"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm">
                    {formatDateTime(new Date(item.createdAt))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Modals */}
      <DistributeInventoryModal
        open={distributeModalOpen}
        onClose={() => setDistributeModalOpen(false)}
        inventoryItemId={item.id}
        productName={productName}
        currentQuantity={item.currentQuantity || 0}
        suggestedPrice={
          item.retailPrice ? parseFloat(item.retailPrice) : undefined
        }
        onSuccess={handleActionSuccess}
      />

      <AdjustInventoryModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        inventoryItemId={item.id}
        productName={productName}
        currentQuantity={item.currentQuantity || 0}
        onSuccess={handleActionSuccess}
      />

      <UpdatePricingModal
        open={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        inventoryItemId={item.id}
        productName={productName}
        currentRetailPrice={item.retailPrice}
        currentWholesalePrice={item.wholesalePrice}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
