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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Calendar,
  MapPin,
  AlertTriangle,
  ArrowLeft,
  Wine,
  Edit,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { MeasurementChart } from "@/components/batch/MeasurementChart";
import { BatchActivityHistory } from "@/components/batch/BatchActivityHistory";
import { LabelComplianceCard } from "@/components/packaging/LabelComplianceCard";

const KEG_STATUS_CONFIG = {
  available: {
    label: "Available",
    color: "bg-green-100 text-green-800 border-green-300",
  },
  filled: {
    label: "Filled",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  distributed: {
    label: "Distributed",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  cleaning: {
    label: "Cleaning",
    color: "bg-gray-100 text-gray-800 border-gray-300",
  },
  maintenance: {
    label: "Maintenance",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  retired: {
    label: "Retired",
    color: "bg-red-100 text-red-800 border-red-300",
  },
};

const KEG_FILL_STATUS_CONFIG = {
  filled: { label: "Filled", color: "bg-blue-100 text-blue-800" },
  distributed: { label: "Distributed", color: "bg-orange-100 text-orange-800" },
  returned: { label: "Returned", color: "bg-green-100 text-green-800" },
  voided: { label: "Voided", color: "bg-red-100 text-red-800" },
};

const KEG_TYPE_MAP: Record<string, string> = {
  cornelius_5L: "Cornelius 5L",
  cornelius_9L: "Cornelius 9L",
  sanke_20L: "Sanke 20L (1/6 barrel)",
  sanke_30L: "Sanke 30L (1/4 barrel)",
  sanke_50L: "Sanke 50L (1/2 barrel)",
  other: "Other",
};

export default function KegDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kegId = params.id as string;

  const { data, isLoading, error } = trpc.packaging.kegs.getKegDetails.useQuery(
    { kegId },
    { enabled: !!kegId }
  );

  const keg = data?.keg;
  const fills = data?.fills || [];
  const latestFillBatch = data?.latestFillBatch;

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

  if (error || !keg) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>Error loading keg: {error?.message || "Not found"}</span>
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
                <Package className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0" />
                <span className="truncate">Keg {keg.kegNumber}</span>
              </h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                {KEG_TYPE_MAP[keg.kegType] || keg.kegType} -{" "}
                {(keg.capacityML / 1000).toFixed(1)}L
              </p>
              {latestFillBatch && (
                <p className="text-gray-600 text-sm mt-1">
                  Currently filled with:{" "}
                  <span className="font-medium">
                    {latestFillBatch.batchCustomName || latestFillBatch.batchName}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <Badge
                className={cn(
                  "text-xs md:text-sm",
                  KEG_STATUS_CONFIG[keg.status as keyof typeof KEG_STATUS_CONFIG]
                    ?.color || "bg-gray-100 text-gray-800"
                )}
              >
                {KEG_STATUS_CONFIG[keg.status as keyof typeof KEG_STATUS_CONFIG]
                  ?.label || keg.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/cellar?editKeg=${kegId}`)}
                className="flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Keg Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Keg Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Keg Number</p>
                    <p className="font-semibold">{keg.kegNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-semibold">
                      {KEG_TYPE_MAP[keg.kegType] || keg.kegType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Capacity</p>
                    <p className="font-semibold">
                      {(keg.capacityML / 1000).toFixed(1)}L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge
                      className={
                        KEG_STATUS_CONFIG[
                          keg.status as keyof typeof KEG_STATUS_CONFIG
                        ]?.color || "bg-gray-100 text-gray-800"
                      }
                      variant="secondary"
                    >
                      {KEG_STATUS_CONFIG[
                        keg.status as keyof typeof KEG_STATUS_CONFIG
                      ]?.label || keg.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Condition</p>
                    <p className="font-semibold">
                      {keg.condition
                        ? keg.condition.charAt(0).toUpperCase() +
                          keg.condition.slice(1).replace("_", " ")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <p className="font-semibold">
                        {keg.currentLocation || "Unknown"}
                      </p>
                    </div>
                  </div>
                  {keg.purchaseDate && (
                    <div>
                      <p className="text-sm text-gray-600">Purchase Date</p>
                      <p className="font-semibold">
                        {formatDate(keg.purchaseDate)}
                      </p>
                    </div>
                  )}
                  {keg.purchaseCost && (
                    <div>
                      <p className="text-sm text-gray-600">Purchase Cost</p>
                      <p className="font-semibold">
                        ${parseFloat(keg.purchaseCost).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {keg.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-1">Notes</p>
                    <p className="whitespace-pre-wrap">{keg.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Latest Measurements Summary */}
            {latestFillBatch && (
              <LabelComplianceCard
                measurements={latestFillBatch.history?.measurements || []}
                additives={latestFillBatch.history?.additives || []}
                abvAtPackaging={null}
                carbonationCo2Volumes={latestFillBatch.carbonationCo2Volumes}
                packageSizeML={keg.capacityML}
                composition={latestFillBatch.composition || []}
                showLabelCharacteristics={false}
                showMandatoryElements={false}
              />
            )}

            {/* Batch Composition - Only show if keg is filled/distributed */}
            {latestFillBatch && latestFillBatch.composition && latestFillBatch.composition.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Beaker className="w-5 h-5" />
                    Batch Composition
                  </CardTitle>
                  <CardDescription>
                    Source materials for {latestFillBatch.batchCustomName || latestFillBatch.batchName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {latestFillBatch.composition.map((comp: any, idx: number) => (
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

            {/* Batch Activity Timeline */}
            {latestFillBatch && (
              <BatchActivityHistory batchId={latestFillBatch.batchId} />
            )}

            {/* Measurements Chart */}
            {latestFillBatch && latestFillBatch.history?.measurements && latestFillBatch.history.measurements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Batch Measurements</CardTitle>
                  <CardDescription>
                    Fermentation progress and quality metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MeasurementChart measurements={latestFillBatch.history.measurements} />
                </CardContent>
              </Card>
            )}

            {/* Fill History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wine className="w-5 h-5" />
                  Fill History ({fills.length})
                </CardTitle>
                <CardDescription>
                  Complete fill and distribution history for this keg
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {fills.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No fill history yet
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filled Date</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Vessel</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Distributed</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Returned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fills.map((fill: any) => {
                          const statusConfig =
                            KEG_FILL_STATUS_CONFIG[
                              fill.status as keyof typeof KEG_FILL_STATUS_CONFIG
                            ];
                          return (
                            <TableRow
                              key={fill.id}
                              onClick={() =>
                                router.push(`/keg-fills/${fill.id}`)
                              }
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  {formatDate(fill.filledAt)}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {fill.batchCustomName || fill.batchName}
                              </TableCell>
                              <TableCell>{fill.vesselName}</TableCell>
                              <TableCell className="text-right font-mono">
                                {parseFloat(fill.volumeTaken).toFixed(1)}
                                {fill.volumeTakenUnit}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={statusConfig?.color}
                                  variant="secondary"
                                >
                                  {statusConfig?.label || fill.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {fill.distributedAt ? (
                                  <div className="text-sm">
                                    {formatDate(fill.distributedAt)}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {fill.distributionLocation || (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {fill.returnedAt ? (
                                  <div className="text-sm">
                                    {formatDate(fill.returnedAt)}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Summary Stats */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Total Fills</p>
                  <p className="text-2xl font-bold">{fills.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Status</p>
                  <Badge
                    className={
                      KEG_STATUS_CONFIG[
                        keg.status as keyof typeof KEG_STATUS_CONFIG
                      ]?.color || "bg-gray-100 text-gray-800"
                    }
                  >
                    {KEG_STATUS_CONFIG[
                      keg.status as keyof typeof KEG_STATUS_CONFIG
                    ]?.label || keg.status}
                  </Badge>
                </div>
                {fills.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">Last Filled</p>
                    <p className="font-medium">
                      {formatDate(fills[0].filledAt)}
                    </p>
                  </div>
                )}
                {latestFillBatch?.carbonationCo2Volumes && (
                  <div>
                    <p className="text-sm text-gray-500">CO₂ Volumes</p>
                    <p className="font-medium">
                      {latestFillBatch.carbonationCo2Volumes.toFixed(2)} vol
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
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="font-medium text-sm">
                    {formatDate(keg.createdAt)}
                  </p>
                </div>
                {keg.updatedAt && keg.updatedAt !== keg.createdAt && (
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium text-sm">
                      {formatDate(keg.updatedAt)}
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
