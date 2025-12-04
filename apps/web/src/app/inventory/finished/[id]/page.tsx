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
  Beaker,
  Target,
  TestTube,
  Droplets,
  FileText,
  Eye,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDateTime } from "@/utils/date-format";
import { DistributeInventoryModal } from "@/components/packaging/DistributeInventoryModal";
import { AdjustInventoryModal } from "@/components/packaging/AdjustInventoryModal";
import { UpdatePricingModal } from "@/components/packaging/UpdatePricingModal";
import { LabelComplianceCard } from "@/components/packaging/LabelComplianceCard";
import { COGSSummaryCard } from "@/components/packaging/COGSSummaryCard";
import { MarginAnalysisCard } from "@/components/packaging/MarginAnalysisCard";
import { BatchActivityHistory } from "@/components/batch/BatchActivityHistory";

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

  // Fetch full packaging run data for all production details
  const { data: runData, isLoading: isLoadingRun } = trpc.packaging.get.useQuery(
    data?.item?.bottleRunId || "",
    { enabled: !!data?.item?.bottleRunId }
  );

  // Fetch enhanced details (COGS, margins, materials)
  const { data: enhancedData, isLoading: isLoadingEnhanced } = trpc.packaging.getEnhancedDetails.useQuery(
    data?.item?.bottleRunId || "",
    { enabled: !!data?.item?.bottleRunId }
  );

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

  // Get loss percentage color
  const getLossColor = (lossPercentage: number) => {
    if (lossPercentage <= 2) return "text-green-600";
    if (lossPercentage <= 5) return "text-yellow-600";
    return "text-red-600";
  };

  // Get fill check color
  const getFillCheckColor = (fillCheck: string | null) => {
    switch (fillCheck) {
      case "pass":
        return "text-green-600";
      case "fail":
        return "text-red-600";
      case "not_tested":
        return "text-yellow-600";
      default:
        return "text-gray-500";
    }
  };

  // Get carbonation level display
  const getCarbonationDisplay = (level: string | null) => {
    switch (level) {
      case "still":
        return "Still (no carbonation)";
      case "petillant":
        return "Pétillant (light carbonation)";
      case "sparkling":
        return "Sparkling (full carbonation)";
      default:
        return level || "Not specified";
    }
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

        {/* Label Compliance Card */}
        {runData && (
          <div className="mb-3 md:mb-4 lg:mb-6">
            <LabelComplianceCard
              measurements={runData.batch?.history?.measurements || []}
              additives={runData.batch?.history?.additives || []}
              abvAtPackaging={runData.abvAtPackaging}
              carbonationCo2Volumes={runData.carbonationCo2Volumes}
              packageSizeML={runData.packageSizeML}
              composition={runData.batch?.composition || []}
            />
          </div>
        )}

        {/* COGS and Margin Analysis Cards */}
        {enhancedData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 lg:gap-6 mb-3 md:mb-4 lg:mb-6">
            <COGSSummaryCard
              cogsData={enhancedData.cogs}
              unitsProduced={runData?.unitsProduced || 0}
            />
            <MarginAnalysisCard
              margins={enhancedData.margins}
              inventory={enhancedData.inventory}
            />
          </div>
        )}

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

            {/* Batch Composition */}
            {runData?.batch?.composition && runData.batch.composition.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Beaker className="w-4 h-4 md:w-5 md:h-5" />
                    Batch Composition
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Source materials for{" "}
                    {item.batchCustomName || item.batchName || "this batch"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {runData.batch.composition.map((comp: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between p-2.5 md:p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {comp.varietyName || "Unknown variety"}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500 truncate">
                            {comp.vendorName || "Unknown vendor"}
                          </p>
                        </div>
                        <div className="text-right ml-3 md:ml-4 flex-shrink-0">
                          <p className="font-medium text-sm md:text-base">
                            {comp.percentageOfBatch?.toFixed(1)}%
                          </p>
                          <p className="text-xs md:text-sm text-gray-500">
                            {comp.volumeL?.toFixed(1)}L
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Packaging Materials */}
            {enhancedData?.packagingMaterials && enhancedData.packagingMaterials.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Package className="w-4 h-4 md:w-5 md:h-5" />
                    Packaging Materials Used
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Materials consumed during this packaging run
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {enhancedData.packagingMaterials.map((material: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between p-2.5 md:p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {material.materialName || "Unknown material"}
                          </p>
                          <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {material.materialTypePurchase || material.materialType}
                            </Badge>
                            {material.size && (
                              <span className="text-xs text-gray-500">
                                {material.size}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3 md:ml-4 flex-shrink-0">
                          <p className="font-medium text-sm md:text-base">
                            {material.quantityUsed} units
                          </p>
                          {material.pricePerUnit && (
                            <p className="text-xs md:text-sm text-gray-500">
                              ${parseFloat(material.pricePerUnit).toFixed(2)} each
                            </p>
                          )}
                          {material.totalCost && (
                            <p className="text-xs md:text-sm font-medium text-green-600">
                              Total: ${parseFloat(material.totalCost.toString()).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch Activity Timeline */}
            {item.batchId && (
              <BatchActivityHistory batchId={item.batchId} />
            )}

            {/* Production Information with Loss */}
            {runData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Package className="w-4 h-4 md:w-5 md:h-5" />
                    Production Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Packaged Date</p>
                      <p className="font-medium text-sm md:text-base flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {runData.packagedAt
                          ? new Date(runData.packagedAt).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Units Produced</p>
                      <p className="font-medium text-base md:text-lg">
                        {runData.unitsProduced?.toLocaleString() || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Volume Taken</p>
                      <p className="font-medium text-sm md:text-base">
                        {runData.volumeTaken?.toFixed(1) || "-"}L
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Package Type</p>
                      <p className="font-medium text-sm md:text-base">
                        {formatPackageSize(runData.packageSizeML, runData.packageType)}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Loss Amount</p>
                      <p className="font-medium text-sm md:text-base">
                        {runData.loss?.toFixed(2) || "0.00"}L
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Loss Percentage</p>
                      <p className={cn(
                        "font-medium text-base md:text-lg",
                        getLossColor(runData.lossPercentage || 0)
                      )}>
                        {runData.lossPercentage?.toFixed(1) || "0.0"}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quality Assurance */}
            {runData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Beaker className="w-4 h-4 md:w-5 md:h-5" />
                    Quality Assurance
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Quality control measurements and testing results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        Fill Check
                      </p>
                      <p className={cn(
                        "font-medium text-sm md:text-base",
                        getFillCheckColor(runData.fillCheck)
                      )}>
                        {runData.fillCheck
                          ? runData.fillCheck.charAt(0).toUpperCase() +
                            runData.fillCheck.slice(1).replace("_", " ")
                          : "Not tested"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Fill Variance</p>
                      <p className="font-medium text-sm md:text-base">
                        {runData.fillVarianceML !== undefined && runData.fillVarianceML !== null
                          ? `${runData.fillVarianceML > 0 ? "+" : ""}${runData.fillVarianceML.toFixed(1)}ml`
                          : "Not measured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                        <TestTube className="w-3.5 h-3.5" />
                        ABV at Packaging
                      </p>
                      <p className="font-medium text-sm md:text-base">
                        {runData.abvAtPackaging !== undefined && runData.abvAtPackaging !== null
                          ? `${Number(runData.abvAtPackaging).toFixed(2)}%`
                          : "Not measured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5" />
                        Carbonation
                      </p>
                      <p className="font-medium text-sm md:text-base">
                        {getCarbonationDisplay(runData.carbonationLevel)}
                      </p>
                    </div>
                  </div>

                  {(runData.testMethod || runData.testDate) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                        {runData.testMethod && (
                          <div>
                            <p className="text-xs md:text-sm text-gray-500">Test Method</p>
                            <p className="font-medium text-sm md:text-base">
                              {runData.testMethod}
                            </p>
                          </div>
                        )}
                        {runData.testDate && (
                          <div>
                            <p className="text-xs md:text-sm text-gray-500">Test Date</p>
                            <p className="font-medium text-sm md:text-base">
                              {new Date(runData.testDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {runData.qaNotes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                          <FileText className="w-3.5 h-3.5" />
                          QA Notes
                        </p>
                        <p className="font-medium text-sm md:text-base whitespace-pre-wrap">
                          {runData.qaNotes}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Production Notes */}
            {runData?.productionNotes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <FileText className="w-4 h-4 md:w-5 md:h-5" />
                    Production Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base whitespace-pre-wrap">
                    {runData.productionNotes}
                  </p>
                </CardContent>
              </Card>
            )}

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

            {/* Photos */}
            {runData?.photos && runData.photos.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Eye className="w-4 h-4 md:w-5 md:h-5" />
                    Photos
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    {runData.photos.length} photo
                    {runData.photos.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {runData.photos.map((photo: any) => (
                    <div key={photo.id} className="space-y-2">
                      <img
                        src={photo.photoUrl}
                        alt={photo.caption || "Packaging photo"}
                        className="w-full rounded-lg max-h-48 md:max-h-64 lg:max-h-80 object-cover"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <p className="text-xs md:text-sm text-gray-600 break-words">
                          {photo.caption}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 break-words">
                        {photo.uploaderName} • {formatDateTime(new Date(photo.uploadedAt))}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            {runData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="font-medium text-sm truncate">
                      {runData.createdByName || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Packaged At</p>
                    <p className="text-sm">
                      {formatDateTime(new Date(runData.createdAt))}
                    </p>
                  </div>
                  {runData.updatedAt && runData.updatedAt !== runData.createdAt && (
                    <div>
                      <p className="text-xs text-gray-500">Last Updated</p>
                      <p className="text-sm">
                        {formatDateTime(new Date(runData.updatedAt))}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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
