"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Package,
  MapPin,
  Calendar,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Send,
  RotateCcw,
  Wine,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/utils/date-format";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AddKegModal } from "./AddKegModal";
import { EditKegModal } from "./EditKegModal";
import { KegDetailsModal } from "./KegDetailsModal";
import { DistributeKegModal } from "./DistributeKegModal";
import { CleanKegModal } from "./CleanKegModal";
import { ReturnKegModal } from "./ReturnKegModal";
import { BottleFromKegModal } from "./BottleFromKegModal";
import { formatVolume, convertVolume, type VolumeUnit } from "lib";

type KegStatus =
  | "all"
  | "available"
  | "filled"
  | "distributed"
  | "cleaning"
  | "maintenance"
  | "retired";

type KegType =
  | "all"
  | "cornelius_5L"
  | "cornelius_9L"
  | "sanke_20L"
  | "sanke_30L"
  | "sanke_50L"
  | "other";

interface Keg {
  id: string;
  kegNumber: string;
  kegType: string;
  capacityML: number;
  capacityUnit: string;
  status: string;
  condition: string;
  currentLocation: string | null;
  notes: string | null;
  createdAt: string;
  latestFillId: string | null;
  latestFillBatchName: string | null;
  latestFillDate: string | null;
  latestFillRemainingVolume: string | null;
  latestFillVolumeTaken: string | null;
  latestFillVolumeUnit: string | null;
}

const KEG_STATUS_CONFIG = {
  available: {
    label: "Available",
    cardColor: "border-green-300 bg-green-50",
    badgeColor: "bg-green-100 text-green-800 border-green-300",
  },
  filled: {
    label: "Filled",
    cardColor: "border-blue-300 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  distributed: {
    label: "Distributed",
    cardColor: "border-purple-300 bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  cleaning: {
    label: "Cleaning",
    cardColor: "border-yellow-300 bg-yellow-50",
    badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  maintenance: {
    label: "Maintenance",
    cardColor: "border-orange-300 bg-orange-50",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
  },
  retired: {
    label: "Retired",
    cardColor: "border-red-300 bg-red-50",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
  },
};

const KEG_TYPE_LABELS: Record<string, string> = {
  cornelius_5L: "Cornelius 5L",
  cornelius_9L: "Cornelius 9L",
  sanke_20L: "Sanke 20L",
  sanke_30L: "Sanke 30L",
  sanke_50L: "Sanke 50L",
  other: "Other",
};

// Get icon for keg status - matches vessel map pattern
const getKegStatusIcon = (status: string) => {
  switch (status) {
    case "available":
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case "filled":
      return <Clock className="w-4 h-4 text-blue-600" />; // Like aging batch
    case "distributed":
      return <Send className="w-4 h-4 text-purple-600" />;
    case "cleaning":
      return <RotateCcw className="w-4 h-4 text-yellow-600" />; // Matches vessel map
    case "maintenance":
      return <AlertTriangle className="w-4 h-4 text-red-600" />; // Matches vessel map
    case "retired":
      return <XCircle className="w-4 h-4 text-gray-600" />;
    default:
      return <CheckCircle className="w-4 h-4 text-gray-600" />;
  }
};

export function KegsManagement() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<KegStatus>("all");
  const [kegTypeFilter, setKegTypeFilter] = useState<KegType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKegForEdit, setSelectedKegForEdit] = useState<string | null>(
    null
  );
  const [selectedKegForDetails, setSelectedKegForDetails] = useState<
    string | null
  >(null);
  const [selectedKegForDistribution, setSelectedKegForDistribution] = useState<{
    kegFillId: string;
    kegNumber: string;
  } | null>(null);
  const [selectedKegForBottling, setSelectedKegForBottling] = useState<{
    kegFillId: string;
    kegNumber: string;
    vesselId: string;
    vesselName: string;
    batchId: string;
    batchName: string;
    currentVolumeL: number;
  } | null>(null);
  const [selectedKegForCleaning, setSelectedKegForCleaning] = useState<{
    kegId: string;
    kegNumber: string;
  } | null>(null);
  const [selectedKegForReturn, setSelectedKegForReturn] = useState<{
    kegFillId: string;
    kegNumber: string;
  } | null>(null);

  const utils = trpc.useUtils();

  // Query kegs with filters
  const {
    data: kegsData,
    isLoading,
    error,
  } = trpc.packaging.kegs.listKegs.useQuery({
    status: statusFilter,
    kegType: kegTypeFilter,
    search: searchQuery || undefined,
    limit: 100,
    offset: 0,
  });

  const deleteKegMutation = trpc.packaging.kegs.deleteKeg.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Retired",
        description: "Keg has been marked as retired",
      });
      utils.packaging.kegs.listKegs.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteKegFillMutation = trpc.packaging.kegs.deleteKegFill.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Fill Deleted",
        description: "Keg fill deleted and volume restored to batch",
      });
      utils.packaging.kegs.listKegs.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteKeg = async (kegId: string, kegNumber: string) => {
    if (
      !confirm(
        `Are you sure you want to retire keg ${kegNumber}? This cannot be undone.`,
      )
    ) {
      return;
    }

    deleteKegMutation.mutate({ kegId });
  };

  const handleDeleteKegFill = async (kegFillId: string, kegNumber: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the fill for keg ${kegNumber}? This will purge the keg fill record and cannot be undone.`,
      )
    ) {
      return;
    }

    deleteKegFillMutation.mutate({ kegFillId });
  };

  const handleReturnKeg = (kegFillId: string, kegNumber: string) => {
    setSelectedKegForReturn({ kegFillId, kegNumber });
  };

  // Query for keg fill details when needed for bottling
  const [kegFillIdForQuery, setKegFillIdForQuery] = useState<string | null>(null);
  const { data: kegFillDetails } = trpc.packaging.kegs.getKegFillDetails.useQuery(
    kegFillIdForQuery!,
    { enabled: !!kegFillIdForQuery }
  );

  // When keg fill details are loaded, open the bottle modal
  React.useEffect(() => {
    if (kegFillDetails && kegFillIdForQuery) {
      // Get remaining volume or fall back to volume taken
      const remainingVol = kegFillDetails.remainingVolume
        ? parseFloat(kegFillDetails.remainingVolume.toString())
        : kegFillDetails.volumeTaken
          ? parseFloat(kegFillDetails.volumeTaken.toString())
          : 0;

      setSelectedKegForBottling({
        kegFillId: kegFillIdForQuery,
        kegNumber: kegFillDetails.keg.kegNumber || "",
        vesselId: kegFillDetails.vesselId || "",
        vesselName: kegFillDetails.vessel.name || "",
        batchId: kegFillDetails.batchId || "",
        batchName: kegFillDetails.batch.customName || kegFillDetails.batch.name || "",
        currentVolumeL: remainingVol,
      });

      // Clear the query state
      setKegFillIdForQuery(null);
    }
  }, [kegFillDetails, kegFillIdForQuery]);

  const handleBottleFromKeg = (kegFillId: string, keg: Keg) => {
    // Trigger query to fetch keg fill details
    setKegFillIdForQuery(kegFillId);
  };

  const kegs = kegsData?.kegs || [];

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading kegs: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Keg Registry</CardTitle>
              <CardDescription>
                Manage and track individual keg assets through their lifecycle
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Keg
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as KegStatus)}
              >
                <SelectTrigger id="status-filter" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="distributed">Distributed</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type-filter">Keg Type</Label>
              <Select
                value={kegTypeFilter}
                onValueChange={(value) => setKegTypeFilter(value as KegType)}
              >
                <SelectTrigger id="type-filter" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="cornelius_5L">Cornelius 5L</SelectItem>
                  <SelectItem value="cornelius_9L">Cornelius 9L</SelectItem>
                  <SelectItem value="sanke_20L">Sanke 20L</SelectItem>
                  <SelectItem value="sanke_30L">Sanke 30L</SelectItem>
                  <SelectItem value="sanke_50L">Sanke 50L</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by keg number or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Kegs Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : kegs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No kegs found. Add your first keg to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kegs.map((keg: Keg) => {
                const statusConfig =
                  KEG_STATUS_CONFIG[keg.status as keyof typeof KEG_STATUS_CONFIG] ||
                  KEG_STATUS_CONFIG.available;

                return (
                  <Card
                    key={keg.id}
                    className={`border-2 ${statusConfig.cardColor} hover:shadow-md transition-all`}
                  >
                    <CardContent className="pt-6">
                      {/* Keg Number & Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{keg.kegNumber}</h3>
                          <p className="text-sm text-gray-600">
                            {KEG_TYPE_LABELS[keg.kegType] || keg.kegType}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getKegStatusIcon(keg.status)}
                        </div>
                      </div>

                      {/* Keg Details */}
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span>
                            {keg.capacityML / 1000}L ({keg.condition})
                          </span>
                        </div>

                        {/* Current Volume - Only show for filled kegs */}
                        {keg.status === "filled" && (keg.latestFillRemainingVolume || keg.latestFillVolumeTaken) && (() => {
                          const currentVol = keg.latestFillRemainingVolume
                            ? parseFloat(keg.latestFillRemainingVolume)
                            : keg.latestFillVolumeTaken
                              ? parseFloat(keg.latestFillVolumeTaken)
                              : 0;
                          const unit = (keg.latestFillVolumeUnit || "L") as VolumeUnit;
                          const capacityL = keg.capacityML / 1000;

                          // Convert current volume to liters for percentage calculation
                          const currentVolL = convertVolume(currentVol, unit, "L");
                          const fillPercentage = (currentVolL / capacityL) * 100;

                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <Wine className="w-4 h-4 text-gray-400" />
                                <span>
                                  {formatVolume(currentVol, unit)} / {capacityL}L remaining
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    fillPercentage > 90
                                      ? "bg-green-500"
                                      : fillPercentage > 50
                                        ? "bg-blue-500"
                                        : fillPercentage > 25
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                                />
                              </div>
                            </>
                          );
                        })()}

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="truncate">{keg.currentLocation || "Unknown"}</span>
                        </div>

                        {keg.latestFillBatchName && keg.latestFillId && (
                          <button
                            onClick={() => router.push(`/keg-fills/${keg.latestFillId}`)}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="truncate">
                              {keg.latestFillBatchName}
                            </span>
                          </button>
                        )}

                        {keg.latestFillDate && keg.latestFillId && (
                          <button
                            onClick={() => router.push(`/keg-fills/${keg.latestFillId}`)}
                            className="text-xs text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            Filled: {formatDate(keg.latestFillDate)}
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/kegs/${keg.id}`)}
                          className="flex-1"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedKegForEdit(keg.id)}
                          className="flex-1"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>

                        {keg.status === "filled" && keg.latestFillId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                              >
                                <MoreVertical className="w-3 h-3 mr-1" />
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleBottleFromKeg(keg.latestFillId as string, keg)
                                }
                              >
                                <Wine className="w-3 h-3 mr-2" />
                                Bottle
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setSelectedKegForDistribution({
                                    kegFillId: keg.latestFillId as string,
                                    kegNumber: keg.kegNumber,
                                  })
                                }
                              >
                                <Send className="w-3 h-3 mr-2" />
                                Distribute
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDeleteKegFill(
                                    keg.latestFillId as string,
                                    keg.kegNumber,
                                  )
                                }
                                className="text-red-600 focus:text-red-700"
                              >
                                <Trash2 className="w-3 h-3 mr-2" />
                                Delete Fill
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {keg.status === "distributed" && keg.latestFillId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReturnKeg(
                                keg.latestFillId as string,
                                keg.kegNumber,
                              )
                            }
                            className="flex-1"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Return
                          </Button>
                        )}

                        {keg.status === "cleaning" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedKegForCleaning({
                                kegId: keg.id,
                                kegNumber: keg.kegNumber,
                              })
                            }
                            className="flex-1"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Clean Keg
                          </Button>
                        )}

                        {keg.status === "available" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteKeg(keg.id, keg.kegNumber)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {kegs.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600">
                Showing {kegs.length} of {kegsData?.pagination.total || 0} kegs
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddKegModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          utils.packaging.kegs.listKegs.invalidate();
        }}
      />

      {selectedKegForEdit && (
        <EditKegModal
          open={!!selectedKegForEdit}
          onClose={() => setSelectedKegForEdit(null)}
          kegId={selectedKegForEdit}
          onSuccess={() => {
            setSelectedKegForEdit(null);
            utils.packaging.kegs.listKegs.invalidate();
          }}
        />
      )}

      {selectedKegForDetails && (
        <KegDetailsModal
          open={!!selectedKegForDetails}
          onClose={() => setSelectedKegForDetails(null)}
          kegId={selectedKegForDetails}
        />
      )}

      {selectedKegForDistribution && (
        <DistributeKegModal
          open={!!selectedKegForDistribution}
          onClose={() => setSelectedKegForDistribution(null)}
          kegFillId={selectedKegForDistribution.kegFillId}
          kegNumber={selectedKegForDistribution.kegNumber}
          onSuccess={() => {
            setSelectedKegForDistribution(null);
            utils.packaging.kegs.listKegs.invalidate();
          }}
        />
      )}

      {selectedKegForCleaning && (
        <CleanKegModal
          open={!!selectedKegForCleaning}
          onClose={() => setSelectedKegForCleaning(null)}
          kegId={selectedKegForCleaning.kegId}
          kegNumber={selectedKegForCleaning.kegNumber}
        />
      )}

      {selectedKegForReturn && (
        <ReturnKegModal
          open={!!selectedKegForReturn}
          onClose={() => setSelectedKegForReturn(null)}
          kegFillId={selectedKegForReturn.kegFillId}
          kegNumber={selectedKegForReturn.kegNumber}
        />
      )}

      {/* Bottle from Keg Modal */}
      {selectedKegForBottling && (
        <BottleFromKegModal
          open={!!selectedKegForBottling}
          onClose={() => setSelectedKegForBottling(null)}
          kegFillId={selectedKegForBottling.kegFillId}
          kegNumber={selectedKegForBottling.kegNumber}
          batchId={selectedKegForBottling.batchId}
          batchName={selectedKegForBottling.batchName}
          vesselId={selectedKegForBottling.vesselId}
          remainingVolumeL={selectedKegForBottling.currentVolumeL}
          onSuccess={() => {
            setSelectedKegForBottling(null);
            utils.packaging.kegs.listKegs.invalidate();
          }}
        />
      )}
    </>
  );
}
