"use client";

import React, { useState, lazy, Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Calendar,
  Beaker,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Edit,
  User,
  TestTube,
  Droplets,
  Target,
  Eye,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { performanceMonitor } from "@/lib/performance-monitor";
import { formatDateTime } from "@/utils/date-format";
import { MeasurementChart } from "@/components/batch/MeasurementChart";
import { LabelComplianceCard } from "@/components/packaging/LabelComplianceCard";
import { BatchActivityHistory } from "@/components/batch/BatchActivityHistory";
import { COGSSummaryCard } from "@/components/packaging/COGSSummaryCard";
import { MarginAnalysisCard } from "@/components/packaging/MarginAnalysisCard";

// Lazy load heavy components
const QAUpdateModal = lazy(() =>
  import("@/components/packaging/qa-update-modal").then((m) => ({
    default: m.QAUpdateModal,
  })),
);
const AdvancedPDFExport = lazy(() =>
  import("@/components/packaging/bottle-pdf-template").then((m) => ({
    default: m.AdvancedPDFExport,
  })),
);

// Types
import type { PackagingRunPDFData } from "@/lib/pdf-generator";

// Loading components for heavy features
function PDFExportSkeleton() {
  return <Skeleton className="h-9 w-20" />;
}

function QAModalSkeleton() {
  return null; // Modal doesn't need skeleton when closed
}

export default function PackagingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const [qaModalOpen, setQaModalOpen] = useState(false);

  // Auth for permission checks
  const { data: session } = useSession();

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.recordUserInteraction({
      type: "navigation",
      target: `/packaging/${runId}`,
      timestamp: performance.now(),
      metadata: { runId },
    });
  }, [runId]);

  // Fetch packaging run data
  const {
    data: runData,
    isLoading,
    error,
    refetch,
  } = trpc.packaging.get.useQuery(runId, {
    enabled: !!runId,
  });

  // Fetch enhanced details with COGS and margins
  const {
    data: enhancedData,
    isLoading: isLoadingEnhanced,
  } = trpc.packaging.getEnhancedDetails.useQuery(runId, {
    enabled: !!runId,
  });

  // Permission check: Admins and operators can update QA data
  const userRole = (session?.user as any)?.role;
  const canUpdateQA = userRole === "admin" || userRole === "operator";

  // Format date display - using imported formatDateTime
  const formatDateDisplay = (date: string | Date) => {
    return formatDateTime(new Date(date));
  };

  // Format package size display
  const formatPackageSize = (sizeML: number, packageType: string) => {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L ${packageType}`;
    }
    return `${sizeML}ml ${packageType}`;
  };

  // Get status badge color
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "voided":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
        return "Not specified";
    }
  };

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

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-3 md:py-8 px-3 sm:px-4 lg:px-8">
          <div className="flex items-center gap-2 p-3 md:p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm md:text-base">
              Error loading packaging run: {error?.message || "Not found"}
            </span>
          </div>
        </main>
      </div>
    );
  }

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
                <Package className="w-5 h-5 md:w-7 md:h-7 flex-shrink-0" />
                <span className="truncate">
                  {runData.batch.customName || runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}
                </span>
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                {runData.unitsProduced.toLocaleString()} × {formatPackageSize(runData.packageSizeML, runData.packageType)}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {runData.pasteurizedAt && (
                  <Badge
                    className={cn(
                      "text-xs",
                      "bg-orange-100 text-orange-800 hover:bg-orange-200",
                    )}
                  >
                    Pasteurized
                  </Badge>
                )}
                {runData.labeledAt && (
                  <Badge
                    className={cn(
                      "text-xs",
                      "bg-blue-100 text-blue-800 hover:bg-blue-200",
                    )}
                  >
                    Labeled
                  </Badge>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Suspense fallback={<PDFExportSkeleton />}>
                  <AdvancedPDFExport
                    data={{
                      ...runData,
                      qaTechnicianName: runData.qaTechnicianName || undefined,
                      voidedByName: runData.voidedByName || undefined,
                      createdByName: runData.createdByName || undefined,
                      testDate: runData.testDate || undefined,
                      voidedAt: runData.voidedAt || undefined,
                      carbonationLevel: runData.carbonationLevel || undefined,
                      fillCheck: runData.fillCheck || undefined,
                      testMethod: runData.testMethod || undefined,
                      qaNotes: runData.qaNotes || undefined,
                      productionNotes: runData.productionNotes || undefined,
                      voidReason: runData.voidReason || undefined,
                      qaTechnicianId: runData.qaTechnicianId || undefined,
                      voidedBy: runData.voidedBy || undefined,
                      inventory:
                        runData.inventory
                          ?.filter(
                            (item: any) =>
                              item.lotCode &&
                              item.packageType &&
                              item.packageSizeML &&
                              item.expirationDate,
                          )
                          .map((item: any) => ({
                            id: item.id,
                            lotCode: item.lotCode!,
                            packageType: item.packageType!,
                            packageSizeML: item.packageSizeML!,
                            expirationDate: item.expirationDate!,
                            createdAt: item.createdAt,
                          })) || [],
                      photos:
                        runData.photos
                          ?.filter((photo: any) => photo.photoType)
                          .map((photo: any) => ({
                            id: photo.id,
                            photoUrl: photo.photoUrl,
                            photoType: photo.photoType!,
                            caption: photo.caption || undefined,
                            uploadedBy: photo.uploadedBy,
                            uploadedAt: photo.uploadedAt,
                            uploaderName: photo.uploaderName || undefined,
                          })) || [],
                    }}
                  />
                </Suspense>
                {canUpdateQA && (
                  <Button
                    onClick={() => {
                      performanceMonitor.recordUserInteraction({
                        type: "click",
                        target: "qa-update-modal-open",
                        timestamp: performance.now(),
                        metadata: { runId },
                      });
                      setQaModalOpen(true);
                    }}
                    size="sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Update QA</span>
                    <span className="sm:hidden">QA</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Label Compliance Summary Card */}
        <div className="mb-3 md:mb-4 lg:mb-6">
          <LabelComplianceCard
            measurements={runData.batch.history?.measurements || []}
            additives={runData.batch.history?.additives || []}
            abvAtPackaging={runData.abvAtPackaging}
            carbonationCo2Volumes={runData.carbonationCo2Volumes}
            packageSizeML={runData.packageSizeML}
            composition={runData.batch.composition || []}
          />
        </div>

        {/* COGS and Margin Analysis Cards */}
        {enhancedData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 lg:gap-6 mb-3 md:mb-4 lg:mb-6">
            <COGSSummaryCard
              cogsData={enhancedData.cogs}
              unitsProduced={runData.unitsProduced}
            />
            <MarginAnalysisCard
              margins={enhancedData.margins}
              inventory={enhancedData.inventory}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {/* Main Production Details */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4 lg:space-y-6">
            {/* Batch Composition */}
            {runData.batch.composition && runData.batch.composition.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Beaker className="w-4 h-4 md:w-5 md:h-5" />
                    Batch Composition
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Source materials for{" "}
                    {runData.batch.customName || runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}
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

            {/* Batch Activity Timeline - filtered to only show this bottle run's packaging events */}
            <BatchActivityHistory batchId={runData.batchId} bottleRunId={runId} />

            {/* Production Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Package className="w-4 h-4 md:w-5 md:h-5" />
                  Production Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Packaged Date</p>
                    <p className="font-medium text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                      <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                      <span className="truncate">
                        {formatDateDisplay(runData.packagedAt)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Package Type & Size</p>
                    <p className="font-medium text-sm md:text-base">
                      {formatPackageSize(
                        runData.packageSizeML,
                        runData.packageType,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Units Produced</p>
                    <p className="font-medium text-base md:text-lg">
                      {runData.unitsProduced.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Volume Taken</p>
                    <p className="font-medium text-sm md:text-base">
                      {runData.volumeTaken.toFixed(1)}L
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Loss Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Loss Amount</p>
                    <p className="font-medium text-sm md:text-base">{runData.loss.toFixed(2)}L</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Loss Percentage</p>
                    <p
                      className={cn(
                        "font-medium text-base md:text-lg",
                        getLossColor(runData.lossPercentage),
                      )}
                    >
                      {runData.lossPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quality Assurance Data */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                      Fill Check
                    </p>
                    <p
                      className={cn(
                        "font-medium text-sm md:text-base",
                        getFillCheckColor(runData.fillCheck),
                      )}
                    >
                      {runData.fillCheck
                        ? runData.fillCheck.charAt(0).toUpperCase() +
                          runData.fillCheck.slice(1).replace("_", " ")
                        : "Not tested"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Fill Variance</p>
                    <p className="font-medium text-sm md:text-base">
                      {runData.fillVarianceML !== undefined
                        ? `${runData.fillVarianceML > 0 ? "+" : ""}${runData.fillVarianceML.toFixed(1)}ml`
                        : "Not measured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                      <TestTube className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                      ABV at Packaging
                    </p>
                    <p className="font-medium text-sm md:text-base">
                      {runData.abvAtPackaging !== undefined
                        ? `${runData.abvAtPackaging.toFixed(2)}%`
                        : "Not measured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                      <span className="truncate">Carbonation Level</span>
                    </p>
                    <p className="font-medium text-sm md:text-base break-words">
                      {getCarbonationDisplay(runData.carbonationLevel)}
                    </p>
                  </div>
                </div>

                {(runData.testMethod || runData.testDate) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                      {runData.testMethod && (
                        <div>
                          <p className="text-xs md:text-sm text-gray-500">Test Method</p>
                          <p className="font-medium text-sm md:text-base break-words">
                            {runData.testMethod}
                          </p>
                        </div>
                      )}
                      {runData.testDate && (
                        <div>
                          <p className="text-xs md:text-sm text-gray-500">Test Date</p>
                          <p className="font-medium text-sm md:text-base">
                            {formatDateDisplay(runData.testDate)}
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
                        <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        QA Notes
                      </p>
                      <p className="font-medium text-sm md:text-base whitespace-pre-wrap">
                        {runData.qaNotes}
                      </p>
                    </div>
                  </>
                )}

                {!runData.fillCheck &&
                  !runData.fillVarianceML &&
                  !runData.abvAtPackaging &&
                  !runData.carbonationLevel &&
                  !runData.testMethod &&
                  !runData.qaNotes && (
                    <div className="text-center py-6 md:py-8 text-gray-500">
                      <Beaker className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-50" />
                      <p className="text-sm md:text-base">No QA data recorded yet</p>
                      {canUpdateQA && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setQaModalOpen(true)}
                        >
                          Add QA Data
                        </Button>
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Production Notes - includes bottle run notes and compiled batch history notes */}
            {(runData.productionNotes || (runData.batch.compiledNotes && runData.batch.compiledNotes.length > 0)) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <FileText className="w-4 h-4 md:w-5 md:h-5" />
                    Production Notes
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Notes from packaging and batch history
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Bottle run production notes */}
                  {runData.productionNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Packaging Notes</p>
                      <p className="text-sm md:text-base whitespace-pre-wrap">
                        {runData.productionNotes}
                      </p>
                    </div>
                  )}

                  {/* Compiled batch history notes */}
                  {runData.batch.compiledNotes && runData.batch.compiledNotes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Batch History Notes</p>
                      <div className="space-y-2">
                        {runData.batch.compiledNotes.map((note: any, idx: number) => (
                          <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
                              <span className="capitalize font-medium">{note.type}</span>
                              <span>•</span>
                              <span>{new Date(note.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Inventory & Metadata */}
          <div className="space-y-3 md:space-y-4 lg:space-y-6">
            {/* Inventory Items */}
            {runData.inventory && runData.inventory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Package className="w-4 h-4 md:w-5 md:h-5" />
                    Inventory Items
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    {runData.inventory.length} item
                    {runData.inventory.length !== 1 ? "s" : ""} created
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {runData.inventory.map((item: any) => (
                    <div key={item.id} className="p-2.5 md:p-3 border rounded-lg">
                      <p className="font-medium text-sm md:text-base truncate">{item.lotCode}</p>
                      <p className="text-xs md:text-sm text-gray-500">
                        {item.packageSizeML && item.packageType
                          ? formatPackageSize(
                              item.packageSizeML,
                              item.packageType,
                            )
                          : "Unknown size"}
                      </p>
                      <p className="text-xs md:text-sm text-gray-500">
                        Expires:{" "}
                        {item.expirationDate
                          ? formatDateDisplay(item.expirationDate)
                          : "Not set"}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Created By</p>
                  <p className="font-medium text-sm md:text-base truncate">
                    {runData.createdByName || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500">Created At</p>
                  <p className="font-medium text-sm md:text-base">
                    {formatDateDisplay(runData.createdAt)}
                  </p>
                </div>
                {runData.updatedAt &&
                  runData.updatedAt !== runData.createdAt && (
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">Last Updated</p>
                      <p className="font-medium text-sm md:text-base">
                        {formatDateDisplay(runData.updatedAt)}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Photos */}
            {runData.photos && runData.photos.length > 0 && (
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
                        {photo.uploaderName} • {formatDateDisplay(photo.uploadedAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* QA Update Modal */}
      <Suspense fallback={<QAModalSkeleton />}>
        <QAUpdateModal
          open={qaModalOpen}
          onClose={() => {
            performanceMonitor.recordUserInteraction({
              type: "click",
              target: "qa-update-modal-close",
              timestamp: performance.now(),
              metadata: { runId },
            });
            setQaModalOpen(false);
          }}
          runId={runId}
          runData={runData}
        />
      </Suspense>
    </div>
  );
}
