"use client";

import React from "react";
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
  Beaker,
  AlertTriangle,
  ArrowLeft,
  Droplets,
  MapPin,
  Wine,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDateTime } from "@/utils/date-format";

export default function KegFillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fillId = params.id as string;
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Fetch keg fill data
  const {
    data: fillData,
    isLoading,
    error,
  } = trpc.kegs.getKegFillDetails.useQuery(fillId, {
    enabled: !!fillId,
  });

  // Delete mutation
  const utils = trpc.useUtils();
  const deleteMutation = trpc.kegs.deleteKegFill.useMutation({
    onSuccess: () => {
      router.push("/cellar");
    },
    onError: (error) => {
      alert(`Failed to delete keg fill: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this keg fill? This action cannot be undone and will restore the volume to the batch.")) {
      deleteMutation.mutate({ kegFillId: fillId });
    }
  };

  // Format date display
  const formatDateDisplay = (date: string | Date | null) => {
    if (!date) return "Not set";
    return formatDateTime(new Date(date));
  };

  // Format keg type display
  const formatKegType = (kegType: string) => {
    const typeMap: Record<string, string> = {
      cornelius_5L: "Cornelius 5L",
      cornelius_9L: "Cornelius 9L",
      sanke_20L: "Sanke 20L (1/6 barrel)",
      sanke_30L: "Sanke 30L (1/4 barrel)",
      sanke_50L: "Sanke 50L (1/2 barrel)",
      other: "Other",
    };
    return typeMap[kegType] || kegType;
  };

  // Get status badge color
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "filled":
        return "bg-blue-100 text-blue-800";
      case "distributed":
        return "bg-purple-100 text-purple-800";
      case "returned":
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

  if (error || !fillData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>
              Error loading keg fill: {error?.message || "Not found"}
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
              onClick={() => router.push("/cellar")}
              size="sm"
              className="h-8 md:h-10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cellar
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                <Wine className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0" />
                <span className="truncate">
                  Keg {fillData.keg.kegNumber}
                </span>
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                {fillData.batch.customName || fillData.batch.name || `Batch ${fillData.batchId.slice(0, 8)}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <Badge
                className={cn(
                  "text-xs md:text-sm self-start",
                  getStatusColor(fillData.status),
                )}
              >
                {fillData.status?.charAt(0).toUpperCase() +
                  fillData.status?.slice(1) || "Unknown"}
              </Badge>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Fill Details */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Fill Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5" />
                  Fill Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Filled Date</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        {formatDateDisplay(fillData.filledAt)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Volume Taken</p>
                    <p className="font-medium">
                      {fillData.volumeTaken
                        ? parseFloat(fillData.volumeTaken.toString()).toFixed(1)
                        : "0"}L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loss Amount</p>
                    <p className="font-medium">
                      {fillData.loss
                        ? parseFloat(fillData.loss.toString()).toFixed(2)
                        : "0"}L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loss Percentage</p>
                    <p
                      className={cn(
                        "font-medium text-lg",
                        getLossColor(fillData.lossPercentage || 0),
                      )}
                    >
                      {fillData.lossPercentage?.toFixed(1) || "0"}%
                    </p>
                  </div>
                </div>

                {fillData.carbonationMethod && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-gray-500">
                        Carbonation Method
                      </p>
                      <p className="font-medium">
                        {fillData.carbonationMethod === "natural"
                          ? "Natural Carbonation"
                          : fillData.carbonationMethod === "forced"
                            ? "Forced Carbonation"
                            : "None"}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Distribution/Return Information */}
            {(fillData.distributedAt || fillData.returnedAt) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Distribution & Returns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fillData.distributedAt && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Distributed Date</p>
                        <p className="font-medium">
                          {formatDateDisplay(fillData.distributedAt)}
                        </p>
                      </div>
                      {fillData.distributionLocation && (
                        <div>
                          <p className="text-sm text-gray-500">
                            Distribution Location
                          </p>
                          <p className="font-medium">
                            {fillData.distributionLocation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {fillData.returnedAt && (
                    <div>
                      <p className="text-sm text-gray-500">Returned Date</p>
                      <p className="font-medium">
                        {formatDateDisplay(fillData.returnedAt)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Production Notes */}
            {fillData.productionNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Production Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">
                    {fillData.productionNotes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Void Information */}
            {fillData.voidedAt && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-5 h-5" />
                    Void Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-600">Voided Date</p>
                    <p className="font-medium text-red-900">
                      {formatDateDisplay(fillData.voidedAt)}
                    </p>
                  </div>
                  {fillData.voidReason && (
                    <div>
                      <p className="text-sm text-gray-600">Reason</p>
                      <p className="font-medium text-red-900">
                        {fillData.voidReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Keg & Batch Info */}
          <div className="space-y-4 md:space-y-6">
            {/* Keg Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Keg Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Keg Number</p>
                  <p className="font-medium">{fillData.keg.kegNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Keg Type</p>
                  <p className="font-medium">
                    {formatKegType(fillData.keg.kegType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Capacity</p>
                  <p className="font-medium">
                    {(fillData.keg.capacityML / 1000).toFixed(1)}L
                  </p>
                </div>
                {fillData.keg.currentLocation && (
                  <div>
                    <p className="text-sm text-gray-500">Current Location</p>
                    <p className="font-medium">
                      {fillData.keg.currentLocation}
                    </p>
                  </div>
                )}
                {fillData.keg.condition && (
                  <div>
                    <p className="text-sm text-gray-500">Condition</p>
                    <p className="font-medium">
                      {fillData.keg.condition.charAt(0).toUpperCase() +
                        fillData.keg.condition.slice(1).replace("_", " ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Batch Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  Batch Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Batch Name</p>
                  <p className="font-medium">
                    {fillData.batch.customName || fillData.batch.name}
                  </p>
                </div>
                {fillData.batch.batchNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Batch Number</p>
                    <p className="font-medium">{fillData.batch.batchNumber}</p>
                  </div>
                )}
                {fillData.vessel.name && (
                  <div>
                    <p className="text-sm text-gray-500">Source Vessel</p>
                    <p className="font-medium">{fillData.vessel.name}</p>
                  </div>
                )}
                {fillData.batch.startDate && (
                  <div>
                    <p className="text-sm text-gray-500">Batch Start Date</p>
                    <p className="font-medium text-sm">
                      {formatDateDisplay(fillData.batch.startDate)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Filled By</p>
                  <p className="font-medium truncate">
                    {fillData.createdByName || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium text-sm md:text-base">
                    {formatDateDisplay(fillData.createdAt)}
                  </p>
                </div>
                {fillData.updatedAt && fillData.updatedAt !== fillData.createdAt && (
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium text-sm md:text-base">
                      {formatDateDisplay(fillData.updatedAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
