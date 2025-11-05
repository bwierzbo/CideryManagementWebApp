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
  FileText,
  Eye,
  BarChart3,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { performanceMonitor } from "@/lib/performance-monitor";
import { formatDateTime } from "@/utils/date-format";
import { MeasurementChart } from "@/components/batch/MeasurementChart";
import { LabelComplianceCard } from "@/components/bottles/LabelComplianceCard";

// Lazy load heavy components
const QAUpdateModal = lazy(() =>
  import("@/components/bottles/qa-update-modal").then((m) => ({
    default: m.QAUpdateModal,
  })),
);
const AdvancedPDFExport = lazy(() =>
  import("@/components/bottles/bottle-pdf-template").then((m) => ({
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
  const [measurementView, setMeasurementView] = useState<"chart" | "list">("chart");

  // Auth for permission checks
  const { data: session } = useSession();

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.recordUserInteraction({
      type: "navigation",
      target: `/bottles/${runId}`,
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
  } = trpc.bottles.get.useQuery(runId, {
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
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>
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

      <main className="max-w-6xl mx-auto py-4 md:py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              size="sm"
              className="h-8 md:h-10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                <Package className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0" />
                <span className="truncate">
                  {runData.batch.customName || runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}
                </span>
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base break-words">
                {runData.unitsProduced.toLocaleString()} × {formatPackageSize(runData.packageSizeML, runData.packageType)}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center gap-2 flex-shrink-0">
              <Badge
                className={cn(
                  "text-xs md:text-sm self-start",
                  getStatusColor(runData.status),
                )}
              >
                {runData.status || "pending"}
              </Badge>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {/* Export PDF and Update QA - other actions in main /bottles table */}
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
                    className="flex-1 sm:flex-initial"
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
        <div className="mb-4 md:mb-6">
          <LabelComplianceCard
            measurements={runData.batch.history?.measurements || []}
            additives={runData.batch.history?.additives || []}
            abvAtPackaging={runData.abvAtPackaging}
            packageSizeML={runData.packageSizeML}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Production Details */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Batch Composition */}
            {runData.batch.composition && runData.batch.composition.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Beaker className="w-5 h-5" />
                    Batch Composition
                  </CardTitle>
                  <CardDescription>
                    Source materials for{" "}
                    {runData.batch.customName || runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {runData.batch.composition.map((comp: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {comp.varietyName || "Unknown variety"}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {comp.vendorName || "Unknown vendor"}
                          </p>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="font-medium">
                            {comp.percentageOfBatch?.toFixed(1)}%
                          </p>
                          <p className="text-sm text-gray-500">
                            {comp.volumeL?.toFixed(1)}L
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch History */}
            {runData.batch.history && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Batch History
                  </CardTitle>
                  <CardDescription>
                    Key events for{" "}
                    {runData.batch.customName || runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Measurements */}
                    {runData.batch.history.measurements &&
                      runData.batch.history.measurements.length > 0 && (
                        <div>
                          {/* View Toggle */}
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-medium text-green-600">
                              Measurements ({runData.batch.history.measurements.length})
                            </p>
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                              <Button
                                size="sm"
                                variant={measurementView === "chart" ? "default" : "ghost"}
                                onClick={() => setMeasurementView("chart")}
                                className="h-7 text-xs"
                              >
                                <BarChart3 className="w-3 h-3 mr-1" />
                                Chart
                              </Button>
                              <Button
                                size="sm"
                                variant={measurementView === "list" ? "default" : "ghost"}
                                onClick={() => setMeasurementView("list")}
                                className="h-7 text-xs"
                              >
                                <List className="w-3 h-3 mr-1" />
                                List
                              </Button>
                            </div>
                          </div>

                          {/* Chart View */}
                          {measurementView === "chart" && (
                            <MeasurementChart measurements={runData.batch.history.measurements} />
                          )}

                          {/* List View */}
                          {measurementView === "list" && (
                            <div className="border-l-2 border-green-500 pl-4">
                              <div className="space-y-1">
                                {runData.batch.history.measurements
                                  .slice(0, 3)
                                  .map((m: any, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-600">
                                      {m.abv && `ABV: ${m.abv}%`}
                                      {m.specificGravity && ` SG: ${parseFloat(m.specificGravity).toFixed(3)}`}
                                      {m.ph && ` pH: ${m.ph}`}
                                      {m.temperature && ` ${m.temperature}°C`}
                                      {" • "}
                                      {formatDateDisplay(m.measurementDate)}
                                    </p>
                                  ))}
                                {runData.batch.history.measurements.length > 3 && (
                                  <p className="text-xs text-gray-400">
                                    +{runData.batch.history.measurements.length - 3} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Additives */}
                    {runData.batch.history.additives &&
                      runData.batch.history.additives.length > 0 && (
                        <div className="border-l-2 border-purple-500 pl-4">
                          <p className="text-sm font-medium text-purple-600">
                            Additives ({runData.batch.history.additives.length})
                          </p>
                          <div className="space-y-1">
                            {runData.batch.history.additives
                              .slice(0, 3)
                              .map((a: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  {a.additiveName}: {a.amount}
                                  {a.unit} • {formatDateDisplay(a.addedAt)}
                                </p>
                              ))}
                            {runData.batch.history.additives.length > 3 && (
                              <p className="text-xs text-gray-400">
                                +{runData.batch.history.additives.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Transfers */}
                    {runData.batch.history.transfers &&
                      runData.batch.history.transfers.length > 0 && (
                        <div className="border-l-2 border-orange-500 pl-4">
                          <p className="text-sm font-medium text-orange-600">
                            Transfers ({runData.batch.history.transfers.length})
                          </p>
                          <div className="space-y-1">
                            {runData.batch.history.transfers
                              .slice(0, 3)
                              .map((t: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  {t.volumeTransferred}L to {t.destinationVesselName} •{" "}
                                  {formatDateDisplay(t.transferredAt)}
                                </p>
                              ))}
                            {runData.batch.history.transfers.length > 3 && (
                              <p className="text-xs text-gray-400">
                                +{runData.batch.history.transfers.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Production Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Production Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Packaged Date</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        {formatDateDisplay(runData.packagedAt)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Package Type & Size</p>
                    <p className="font-medium">
                      {formatPackageSize(
                        runData.packageSizeML,
                        runData.packageType,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Units Produced</p>
                    <p className="font-medium text-lg">
                      {runData.unitsProduced.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Volume Taken</p>
                    <p className="font-medium">
                      {runData.volumeTaken.toFixed(1)}L
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Loss Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Loss Amount</p>
                    <p className="font-medium">{runData.loss.toFixed(2)}L</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loss Percentage</p>
                    <p
                      className={cn(
                        "font-medium text-lg",
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  Quality Assurance
                </CardTitle>
                <CardDescription>
                  Quality control measurements and testing results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Target className="w-4 h-4 flex-shrink-0" />
                      Fill Check
                    </p>
                    <p
                      className={cn(
                        "font-medium",
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
                    <p className="text-sm text-gray-500">Fill Variance</p>
                    <p className="font-medium">
                      {runData.fillVarianceML !== undefined
                        ? `${runData.fillVarianceML > 0 ? "+" : ""}${runData.fillVarianceML.toFixed(1)}ml`
                        : "Not measured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <TestTube className="w-4 h-4 flex-shrink-0" />
                      ABV at Packaging
                    </p>
                    <p className="font-medium">
                      {runData.abvAtPackaging !== undefined
                        ? `${runData.abvAtPackaging.toFixed(2)}%`
                        : "Not measured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Droplets className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">Carbonation Level</span>
                    </p>
                    <p className="font-medium break-words">
                      {getCarbonationDisplay(runData.carbonationLevel)}
                    </p>
                  </div>
                </div>

                {(runData.testMethod || runData.testDate) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      {runData.testMethod && (
                        <div>
                          <p className="text-sm text-gray-500">Test Method</p>
                          <p className="font-medium break-words">
                            {runData.testMethod}
                          </p>
                        </div>
                      )}
                      {runData.testDate && (
                        <div>
                          <p className="text-sm text-gray-500">Test Date</p>
                          <p className="font-medium">
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
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        QA Notes
                      </p>
                      <p className="font-medium whitespace-pre-wrap">
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
                    <div className="text-center py-8 text-gray-500">
                      <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No QA data recorded yet</p>
                      {canUpdateQA && (
                        <Button
                          variant="outline"
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

            {/* Production Notes */}
            {runData.productionNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Production Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">
                    {runData.productionNotes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Inventory & Metadata */}
          <div className="space-y-4 md:space-y-6">
            {/* Inventory Items */}
            {runData.inventory && runData.inventory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Inventory Items
                  </CardTitle>
                  <CardDescription>
                    {runData.inventory.length} item
                    {runData.inventory.length !== 1 ? "s" : ""} created
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runData.inventory.map((item: any) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <p className="font-medium truncate">{item.lotCode}</p>
                      <p className="text-sm text-gray-500">
                        {item.packageSizeML && item.packageType
                          ? formatPackageSize(
                              item.packageSizeML,
                              item.packageType,
                            )
                          : "Unknown size"}
                      </p>
                      <p className="text-sm text-gray-500">
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
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="font-medium truncate">
                    {runData.createdByName || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium text-sm md:text-base">
                    {formatDateDisplay(runData.createdAt)}
                  </p>
                </div>
                {runData.updatedAt &&
                  runData.updatedAt !== runData.createdAt && (
                    <div>
                      <p className="text-sm text-gray-500">Last Updated</p>
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Photos
                  </CardTitle>
                  <CardDescription>
                    {runData.photos.length} photo
                    {runData.photos.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runData.photos.map((photo: any) => (
                    <div key={photo.id} className="space-y-2">
                      <img
                        src={photo.photoUrl}
                        alt={photo.caption || "Packaging photo"}
                        className="w-full rounded-lg max-h-64 md:max-h-80 object-cover"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <p className="text-sm text-gray-600 break-words">
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
