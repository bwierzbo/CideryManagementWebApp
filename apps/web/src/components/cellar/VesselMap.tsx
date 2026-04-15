"use client";

import React, { useState, useCallback } from "react";
import { formatDate } from "@/utils/date-format";
import { useDateFormat } from "@/hooks/useDateFormat";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useOrganizationSettings } from "@/contexts/SettingsContext";
import {
  Beaker,
  Droplets,
  Thermometer,
  Plus,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Waves,
  ArrowRight,
  Trash2,
  Settings,
  MoreVertical,
  FlaskConical,
  Wine,
  Filter as FilterIcon,
  Package,
  History,
  ArrowUpDown,
  SlidersHorizontal,
  Sprout,
  Scale,
} from "lucide-react";
import {
  formatVolume,
  VolumeUnit,
  convertVolume,
} from "lib";
import { BatchHistoryModal } from "@/components/cellar/BatchHistoryModal";
import { UnifiedPackagingModal } from "@/components/packaging/UnifiedPackagingModal";
import { FilterModal } from "@/components/cellar/FilterModal";
import { RackingModal } from "@/components/cellar/RackingModal";
import { VolumeAdjustmentModal } from "@/components/cellar/VolumeAdjustmentModal";
import { CleanTankModal } from "@/components/cellar/CleanTankModal";
import { CarbonateModal } from "@/components/batch/CarbonateModal";
import { VolumeDisplay } from "@/components/ui/volume-input";
import { VesselHistoryModal } from "@/components/cellar/VesselHistoryModal";
import { BarrelHistoryModal } from "@/components/cellar/BarrelHistoryModal";
import { AddBatchMeasurementForm } from "@/components/cellar/AddBatchMeasurementForm";
import { AddBatchAdditiveForm } from "@/components/cellar/AddBatchAdditiveForm";
import { TankForm, EditVesselBarrelHistory } from "@/components/cellar/TankForm";
import { TankTransferForm } from "@/components/cellar/TankTransferForm";

function BatchMeasurementFormWrapper({
  vesselId,
  batchId,
  onClose,
}: {
  vesselId: string;
  batchId: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const handleSuccess = () => {
    // Invalidate vessel data to update the measurements shown
    utils.vessel.liquidMap.invalidate();
    utils.batch.get.invalidate({ batchId });
    utils.batch.list.invalidate();
    onClose();
  };

  return (
    <AddBatchMeasurementForm
      batchId={batchId}
      onSuccess={handleSuccess}
      onCancel={onClose}
    />
  );
}

function TankAdditiveForm({
  vesselId,
  onClose,
}: {
  vesselId: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();

  // Find the batch ID for this vessel
  const liquidMapVessel = liquidMapQuery.data?.vessels.find(
    (v) => v.vesselId === vesselId,
  );
  const batchId = liquidMapVessel?.batchId;

  const handleSuccess = () => {
    utils.vessel.liquidMap.invalidate();
    utils.batch.getHistory.invalidate({ batchId: batchId! });
    onClose();
  };

  if (!batchId) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No active batch found in this vessel.</p>
          <p className="text-xs mt-2">
            Additives can only be added to vessels with active batches.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AddBatchAdditiveForm
      batchId={batchId}
      onSuccess={handleSuccess}
      onCancel={onClose}
    />
  );
}

export function VesselMap() {
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const orgSettings = useOrganizationSettings();
  const [showAddTank, setShowAddTank] = useState(false);
  const [editingVesselId, setEditingVesselId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vesselToDelete, setVesselToDelete] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [vesselToPurge, setVesselToPurge] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showAdditiveForm, setShowAdditiveForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [selectedBatchIdForMeasurement, setSelectedBatchIdForMeasurement] =
    useState<string | null>(null);

  // History modal state
  const [showBatchHistory, setShowBatchHistory] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Vessel history modal state
  const [showVesselHistory, setShowVesselHistory] = useState(false);
  const [selectedVesselForHistory, setSelectedVesselForHistory] = useState<string | null>(null);

  // Barrel history modal state
  const [showBarrelHistory, setShowBarrelHistory] = useState(false);
  const [selectedBarrelForHistory, setSelectedBarrelForHistory] = useState<string | null>(null);

  // Unified packaging modal state
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [selectedVesselForPackaging, setSelectedVesselForPackaging] = useState<{
    id: string;
    name: string;
    batchId: string;
    currentVolumeL: number;
    preBottling?: {
      filterType?: string | null;
      carbonationProcess?: string | null;
      primingSugarGPerL?: number | null;
      targetCo2?: number | null;
      finalCo2?: number | null;
    };
  } | null>(null);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedVesselForFiltering, setSelectedVesselForFiltering] = useState<{
    id: string;
    name: string;
    batchId: string;
    currentVolumeL: number;
  } | null>(null);

  // Racking modal state
  const [showRackingModal, setShowRackingModal] = useState(false);
  const [selectedVesselForRacking, setSelectedVesselForRacking] = useState<{
    id: string;
    name: string;
    batchId: string;
    batchName: string;
    currentVolumeL: number;
    capacityUnit: "L" | "gal";
  } | null>(null);

  // Volume adjustment modal state
  const [showVolumeAdjustmentModal, setShowVolumeAdjustmentModal] = useState(false);
  const [selectedBatchForAdjustment, setSelectedBatchForAdjustment] = useState<{
    id: string;
    name: string;
    vesselId: string;
    vesselName: string;
    currentVolumeL: number;
  } | null>(null);

  // Clean tank modal state
  const [showCleanTankModal, setShowCleanTankModal] = useState(false);
  const [selectedVesselForCleaning, setSelectedVesselForCleaning] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Carbonate modal state
  const [showCarbonateModal, setShowCarbonateModal] = useState(false);
  const [selectedVesselForCarbonation, setSelectedVesselForCarbonation] = useState<{
    id: string;
    name: string;
    batchId: string;
    batchName: string;
    batchStatus: string;
    currentVolumeL: number;
    currentVolumeUnit: string;
    isPressureVessel: "yes" | "no";
    maxPressure: number;
  } | null>(null);

  // Set to Aging modal state
  const [showAgingModal, setShowAgingModal] = useState(false);
  const [selectedVesselForAging, setSelectedVesselForAging] = useState<{
    id: string;
    name: string;
    batchId: string;
    batchName: string;
  } | null>(null);
  const [agingDate, setAgingDate] = useState<Date | null>(null);

  // CO₂ unit toggle state (volumes vs g/L)
  const [co2Unit, setCo2Unit] = useState<"vol" | "gL">("vol");

  // Memoized modal close handlers to prevent infinite loops
  const handleClosePackagingModal = useCallback(() => {
    setShowPackagingModal(false);
    setSelectedVesselForPackaging(null);
  }, []);

  const handleCloseFilterModal = useCallback(() => {
    setShowFilterModal(false);
    setSelectedVesselForFiltering(null);
  }, []);

  const handleCloseRackingModal = useCallback(() => {
    setShowRackingModal(false);
    setSelectedVesselForRacking(null);
  }, []);

  const handleCloseVolumeAdjustmentModal = useCallback(() => {
    setShowVolumeAdjustmentModal(false);
    setSelectedBatchForAdjustment(null);
  }, []);

  // Vessel filter and sort state
  const [vesselMaterialFilter, setVesselMaterialFilter] = useState<string>("all");
  const [vesselSortBy, setVesselSortBy] = useState<"name" | "capacity" | "material">("name");
  const [vesselSortOrder, setVesselSortOrder] = useState<"asc" | "desc">("asc");

  const vesselListQuery = trpc.vessel.list.useQuery({
    material: vesselMaterialFilter === "all" ? undefined : vesselMaterialFilter as any,
    sortBy: vesselSortBy,
    sortOrder: vesselSortOrder,
  });
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();
  const utils = trpc.useUtils();

  // Auto-fix vessel/batch status inconsistencies (fire-and-forget on page load)
  const autoFixMutation = trpc.vessel.autoFixVesselStatus.useMutation({
    onSuccess: (result) => {
      if (result.vesselsFixed > 0 || result.batchesFixed > 0) {
        utils.vessel.liquidMap.invalidate();
        utils.vessel.list.invalidate();
      }
    },
  });
  React.useEffect(() => {
    autoFixMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Computed batch info for the selected vessel (used in tank action dialog headers)
  const selectedVesselInfo = selectedVesselId
    ? liquidMapQuery.data?.vessels.find((v: any) => v.vesselId === selectedVesselId)
    : null;
  const selectedVesselBatchName = selectedVesselInfo?.batchCustomName || selectedVesselInfo?.batchNumber || null;
  const selectedVesselBatchDate = selectedVesselInfo?.batchStartDate
    ? new Date(selectedVesselInfo.batchStartDate).toLocaleDateString()
    : null;

  const deleteMutation = trpc.vessel.delete.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      toast({
        title: "Success",
        description: "Tank deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tank",
        variant: "destructive",
      });
    },
  });

  const purgeMutation = trpc.vessel.purge.useMutation({
    onSuccess: async () => {
      // Invalidate and refetch to ensure UI updates
      await Promise.all([
        utils.vessel.list.invalidate(),
        utils.vessel.liquidMap.invalidate(),
        utils.batch.list.invalidate(),
      ]);
      toast({
        title: "Tank Purged",
        description: "The tank has been purged and the batch removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateBatchStatusMutation = trpc.batch.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.vessel.list.invalidate(),
        utils.vessel.liquidMap.invalidate(),
        utils.batch.list.invalidate(),
      ]);
      toast({
        title: "Batch Status Updated",
        description: "Batch status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Natural sort function for proper numeric ordering (1, 2, 10 instead of 1, 10, 2)
  const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  const vessels = [...(vesselListQuery.data?.vessels || [])].sort((a, b) =>
    naturalSort(a.name || '', b.name || '')
  );

  // Get color based on batch status if batch exists, otherwise vessel status
  const getStatusColor = (vesselStatus: string, batchStatus?: string | null, fermentationStage?: string | null) => {
    // If vessel has a batch, color based on batch status
    if (batchStatus) {
      // Check if batch is awaiting fermentation (needs attention)
      if (fermentationStage === "not_started") {
        return "border-orange-300 bg-orange-50";
      }
      switch (batchStatus) {
        case "fermentation":
          return "border-purple-300 bg-purple-50";
        case "aging":
          return "border-blue-300 bg-blue-50";
        case "discarded":
          return "border-gray-400 bg-gray-100";
        default:
          return "border-purple-300 bg-purple-50";
      }
    }

    // No batch, use vessel status
    switch (vesselStatus) {
      case "available":
        return "border-green-300 bg-green-50";
      case "cleaning":
        return "border-yellow-300 bg-yellow-50";
      case "maintenance":
        return "border-red-300 bg-red-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const getStatusIcon = (vesselStatus: string, batchStatus?: string | null, fermentationStage?: string | null) => {
    // If vessel has a batch, icon based on batch status
    if (batchStatus) {
      // Check if batch is awaiting fermentation (needs attention)
      if (fermentationStage === "not_started") {
        return <Sprout className="w-4 h-4 text-orange-600" />;
      }
      switch (batchStatus) {
        case "fermentation":
          return <Beaker className="w-4 h-4 text-purple-600" />;
        case "aging":
          return <Clock className="w-4 h-4 text-blue-600" />;
        case "discarded":
          return <AlertTriangle className="w-4 h-4 text-gray-600" />;
        default:
          return <Beaker className="w-4 h-4 text-purple-600" />;
      }
    }

    // No batch, use vessel status
    switch (vesselStatus) {
      case "available":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "cleaning":
        return <RotateCcw className="w-4 h-4 text-yellow-600" />;
      case "maintenance":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatMaterial = (material: string | null) => {
    if (!material) return "";
    return material.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatJacketed = (jacketed: string | null) => {
    if (!jacketed) return "";
    return jacketed.charAt(0).toUpperCase() + jacketed.slice(1);
  };


  const handleDeleteClick = (vesselId: string, vesselName: string | null) => {
    setVesselToDelete({ id: vesselId, name: vesselName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (vesselToDelete) {
      deleteMutation.mutate({ id: vesselToDelete.id });
      setDeleteConfirmOpen(false);
      setVesselToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setVesselToDelete(null);
  };

  const handlePurgeTank = (vesselId: string, vesselName: string | null) => {
    setVesselToPurge({ id: vesselId, name: vesselName });
    setPurgeConfirmOpen(true);
  };

  const handlePurgeConfirm = () => {
    if (vesselToPurge) {
      purgeMutation.mutate({ vesselId: vesselToPurge.id });
      setPurgeConfirmOpen(false);
      setVesselToPurge(null);
    }
  };

  const handlePurgeCancel = () => {
    setPurgeConfirmOpen(false);
    setVesselToPurge(null);
  };

  const handleCleanTank = (vesselId: string, vesselName: string | null) => {
    setSelectedVesselForCleaning({
      id: vesselId,
      name: vesselName || "Unknown Tank",
    });
    setShowCleanTankModal(true);
  };

  const handleRack = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;
    const batchName = liquidMapVessel?.batchCustomName || liquidMapVessel?.batchNumber || '';

    if (!vessel || !batchId) {
      toast({
        title: "Cannot Rack",
        description: "No batch found in this vessel",
        variant: "destructive",
      });
      return;
    }

    // Convert current volume to liters based on its stored unit
    const rawVolume = parseFloat(liquidMapVessel.currentVolume || "0");
    const volumeUnit = (liquidMapVessel.currentVolumeUnit || "L") as VolumeUnit;
    const currentVolumeL = volumeUnit === "gal"
      ? convertVolume(rawVolume, "gal", "L")
      : rawVolume;
    const capacityUnit = vessel.capacityUnit || "L";

    setSelectedVesselForRacking({
      id: vessel.id,
      name: vessel.name || '',
      batchId: batchId,
      batchName: batchName || '',
      currentVolumeL: currentVolumeL,
      capacityUnit: capacityUnit as "L" | "gal",
    });
    setShowRackingModal(true);
  };

  const handleSetToAging = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;
    const batchName = liquidMapVessel?.batchCustomName || liquidMapVessel?.batchNumber || "Unnamed Batch";

    if (!batchId) {
      toast({
        title: "Cannot Update Status",
        description: "No batch found in this vessel",
        variant: "destructive",
      });
      return;
    }

    // Open modal to collect aging date
    setSelectedVesselForAging({
      id: vesselId,
      name: vessel?.name || 'Unnamed Vessel',
      batchId: batchId,
      batchName: batchName,
    });
    // Default to current date and time
    setAgingDate(new Date());
    setShowAgingModal(true);
  };

  const handleTankMeasurement = (vesselId: string) => {
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;

    if (!batchId) {
      toast({
        title: "No Batch Found",
        description:
          "This vessel doesn't have an active batch. Please add a batch first.",
        variant: "destructive",
      });
      return;
    }

    setSelectedVesselId(vesselId);
    setSelectedBatchIdForMeasurement(batchId);
    setShowMeasurementForm(true);
  };

  const handleTankAdditive = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    setShowAdditiveForm(true);
  };

  const handleTankTransfer = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    setShowTransferForm(true);
  };

  const handleViewBatch = (vesselId: string) => {
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;

    if (batchId) {
      // Show batch history modal
      setSelectedBatchId(batchId);
      setShowBatchHistory(true);
    } else {
      // Show message if no active batch in vessel
      alert("No active batch found in this vessel");
    }
  };

  const handlePackage = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;

    if (!vessel || !batchId) {
      toast({
        title: "Cannot Package",
        description: "This vessel doesn't have an active batch.",
        variant: "destructive",
      });
      return;
    }

    // Calculate current volume (same logic as in vessel cards)
    const currentVolumeL = liquidMapVessel?.currentVolume
      ? parseFloat(liquidMapVessel.currentVolume.toString())
      : liquidMapVessel?.applePressRunVolume
        ? parseFloat(liquidMapVessel.applePressRunVolume.toString())
        : 0;

    if (currentVolumeL <= 0) {
      toast({
        title: "Cannot Package",
        description: "This vessel is empty.",
        variant: "destructive",
      });
      return;
    }

    // Compute pre-bottling summary from liquidMap data
    const sugarAmount = liquidMapVessel.primingSugarAmount
      ? parseFloat(String(liquidMapVessel.primingSugarAmount))
      : null;
    const startVol = liquidMapVessel.carbonationStartingVolume
      ? parseFloat(String(liquidMapVessel.carbonationStartingVolume))
      : null;

    setSelectedVesselForPackaging({
      id: vesselId,
      name: vessel.name || "Unnamed Vessel",
      batchId,
      currentVolumeL,
      preBottling: {
        filterType: liquidMapVessel.filterType || null,
        carbonationProcess: liquidMapVessel.carbonationProcess || null,
        primingSugarGPerL: sugarAmount && startVol ? sugarAmount / startVol : null,
        targetCo2: liquidMapVessel.carbonationTargetCo2
          ? parseFloat(String(liquidMapVessel.carbonationTargetCo2))
          : null,
        finalCo2: liquidMapVessel.carbonationFinalCo2
          ? parseFloat(String(liquidMapVessel.carbonationFinalCo2))
          : null,
      },
    });
    setShowPackagingModal(true);
  };

  const handleFilter = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;

    if (!vessel || !batchId) {
      toast({
        title: "Cannot Filter",
        description: "This vessel doesn't have an active batch.",
        variant: "destructive",
      });
      return;
    }

    // Calculate current volume
    const currentVolumeL = liquidMapVessel?.currentVolume
      ? parseFloat(liquidMapVessel.currentVolume.toString())
      : liquidMapVessel?.applePressRunVolume
        ? parseFloat(liquidMapVessel.applePressRunVolume.toString())
        : 0;

    if (currentVolumeL <= 0) {
      toast({
        title: "Cannot Filter",
        description: "This vessel is empty.",
        variant: "destructive",
      });
      return;
    }

    const batchStatus = liquidMapVessel?.batchStatus;

    // Check if batch is in fermentation or aging status
    if (batchStatus !== "fermentation" && batchStatus !== "aging") {
      toast({
        title: "Cannot Filter",
        description: "Filtering is only available for batches in fermentation or aging status.",
        variant: "destructive",
      });
      return;
    }

    setSelectedVesselForFiltering({
      id: vesselId,
      name: vessel.name || "Unnamed Vessel",
      batchId,
      currentVolumeL,
    });
    setShowFilterModal(true);
  };

  const handleVolumeAdjustment = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;

    if (!vessel || !batchId) {
      toast({
        title: "Cannot Adjust Volume",
        description: "This vessel doesn't have an active batch.",
        variant: "destructive",
      });
      return;
    }

    // Calculate current volume
    const currentVolumeL = liquidMapVessel?.currentVolume
      ? parseFloat(liquidMapVessel.currentVolume.toString())
      : liquidMapVessel?.applePressRunVolume
        ? parseFloat(liquidMapVessel.applePressRunVolume.toString())
        : 0;

    const batchName = liquidMapVessel?.batchCustomName || liquidMapVessel?.batchNumber || "Unnamed Batch";

    setSelectedBatchForAdjustment({
      id: batchId,
      name: batchName,
      vesselId: vesselId,
      vesselName: vessel.name || "Unnamed Vessel",
      currentVolumeL,
    });
    setShowVolumeAdjustmentModal(true);
  };

  const handleCarbonate = (vesselId: string) => {
    const vessel = vesselListQuery.data?.vessels?.find(
      (v) => v.id === vesselId,
    );
    const liquidMapVessel = liquidMapQuery.data?.vessels.find(
      (v) => v.vesselId === vesselId,
    );
    const batchId = liquidMapVessel?.batchId;
    const batchName = liquidMapVessel?.batchCustomName || liquidMapVessel?.batchNumber || "Unnamed Batch";
    const batchStatus = liquidMapVessel?.batchStatus || "aging";

    if (!vessel || !batchId) {
      toast({
        title: "Cannot Carbonate",
        description: "This vessel doesn't have an active batch.",
        variant: "destructive",
      });
      return;
    }

    // Calculate current volume
    const currentVolumeL = liquidMapVessel?.currentVolume
      ? parseFloat(liquidMapVessel.currentVolume.toString())
      : 0;
    const currentVolumeUnit = liquidMapVessel?.currentVolumeUnit || "L";

    if (currentVolumeL <= 0) {
      toast({
        title: "Cannot Carbonate",
        description: "This vessel is empty.",
        variant: "destructive",
      });
      return;
    }

    // Get vessel pressure info
    const isPressureVessel = vessel.isPressureVessel || "no";
    const maxPressure = vessel.maxPressure ? parseFloat(vessel.maxPressure) : 30;

    setSelectedVesselForCarbonation({
      id: vesselId,
      name: vessel.name || "Unnamed Vessel",
      batchId,
      batchName,
      batchStatus,
      currentVolumeL,
      currentVolumeUnit,
      isPressureVessel: isPressureVessel as "yes" | "no",
      maxPressure,
    });
    setShowCarbonateModal(true);
  };

  if (vesselListQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-blue-600" />
            Vessel Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading vessels...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="w-5 h-5 text-blue-600" />
                Vessel Map
              </CardTitle>
              <CardDescription>
                Overview of all fermentation and storage vessels
              </CardDescription>
            </div>
            <Dialog open={showAddTank} onOpenChange={setShowAddTank}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tank
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Tank</DialogTitle>
                <DialogDescription>
                  Create a new fermentation or storage vessel
                </DialogDescription>
              </DialogHeader>
              <TankForm onClose={() => setShowAddTank(false)} />
            </DialogContent>
          </Dialog>
          </div>

          {/* Filter and Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <Select
                value={vesselMaterialFilter}
                onValueChange={setVesselMaterialFilter}
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Filter by material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  <SelectItem value="stainless_steel">Stainless Steel</SelectItem>
                  <SelectItem value="plastic">Plastic</SelectItem>
                  <SelectItem value="wood">Wood</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <Select
                value={vesselSortBy}
                onValueChange={(value) => setVesselSortBy(value as "name" | "capacity" | "material")}
              >
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setVesselSortOrder(vesselSortOrder === "asc" ? "desc" : "asc")}
              >
                {vesselSortOrder === "asc" ? "A→Z" : "Z→A"}
              </Button>
            </div>

            {vesselMaterialFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={() => setVesselMaterialFilter("all")}
              >
                Clear filter
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {vessels.map((vessel) => {
            const liquidMapVessel = liquidMapQuery.data?.vessels.find(
              (v) => v.vesselId === vessel.id,
            );

            // Determine capacity unit from either vessel data or liquidMap data
            const capacityUnit =
              vessel.capacityUnit || liquidMapVessel?.vesselCapacityUnit || "L";

            // Vessel capacity is stored in the display unit (vessel.capacityUnit)
            const capacity = parseFloat(vessel.capacity);

            // Max capacity (for overfill) - also stored in display unit
            const maxCapacity = vessel.maxCapacity ? parseFloat(vessel.maxCapacity) : null;

            // Get current volume and convert to vessel's capacity unit
            let currentVolume = 0;
            if (liquidMapVessel?.currentVolume) {
              const volumeInOriginalUnit = parseFloat(liquidMapVessel.currentVolume.toString());
              const volumeUnit = (liquidMapVessel.currentVolumeUnit || "L") as VolumeUnit;

              // Convert from batch's unit to vessel's capacity unit
              currentVolume = convertVolume(volumeInOriginalUnit, volumeUnit, capacityUnit as VolumeUnit);
            } else if (liquidMapVessel?.applePressRunVolume) {
              const volumeInOriginalUnit = parseFloat(liquidMapVessel.applePressRunVolume.toString());
              const volumeUnit = (liquidMapVessel.applePressRunVolumeUnit || "L") as VolumeUnit;

              // Convert from press run's unit to vessel's capacity unit
              currentVolume = convertVolume(volumeInOriginalUnit, volumeUnit, capacityUnit as VolumeUnit);
            }

            const fillPercentage =
              capacity > 0 ? (currentVolume / capacity) * 100 : 0;

            return (
              <div
                key={vessel.id}
                className={`border-2 rounded-lg p-3 sm:p-4 transition-all hover:shadow-md ${getStatusColor(vessel.status, liquidMapVessel?.batchStatus, liquidMapVessel?.fermentationStage)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg truncate">
                        {vessel.name || "Unnamed Vessel"}
                      </h3>
                      {vessel.isBarrel && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                          <Wine className="w-3 h-3 mr-0.5" />
                          {vessel.barrelFlavorLevel?.charAt(0).toUpperCase() || "H"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {vessel.isBarrel && vessel.barrelOriginContents
                        ? `Ex-${vessel.barrelOriginContents.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} • ${vessel.location || "No location"}`
                        : vessel.location || "No location"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(vessel.status, liquidMapVessel?.batchStatus, liquidMapVessel?.fermentationStage)}
                  </div>
                </div>

                {/* Batch Info - Always render both sections for consistent spacing */}
                <div className="mb-3 space-y-2">
                  {/* Batch Name - Always rendered with fixed height */}
                  <div className="pb-2 border-b h-[56px] flex flex-col justify-start">
                    {liquidMapVessel?.batchId ? (
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900">
                          {liquidMapVessel.batchCustomName ? liquidMapVessel.batchCustomName : liquidMapVessel.batchNumber}
                        </p>
                        {(() => {
                          const pt = liquidMapVessel.productType || "cider";
                          const badgeStyle =
                            pt === "cider" ? "bg-yellow-100 text-yellow-800" :
                            pt === "perry" ? "bg-green-100 text-green-700" :
                            pt === "wine" ? "bg-rose-100 text-rose-700" :
                            pt === "cyser" ? "bg-amber-100 text-amber-700" :
                            pt === "pommeau" ? "bg-orange-100 text-orange-700" :
                            pt === "brandy" ? "bg-red-100 text-red-700" :
                            pt === "juice" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700";
                          const label = pt.charAt(0).toUpperCase() + pt.slice(1);
                          return (
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 ${badgeStyle}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        {(() => {
                          const lastActivity = (liquidMapVessel as any)?.lastActivity;
                          if (lastActivity) {
                            const activityDate = formatDate(lastActivity.date);
                            if (lastActivity.type === "cleaned") {
                              return `Cleaned ${activityDate}`;
                            } else if (lastActivity.type === "transferred") {
                              return `Batch transferred ${activityDate}`;
                            }
                          }
                          return "No active batch";
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Latest Measurements - Always rendered with fixed height */}
                  <div className="space-y-1 text-xs h-[60px]">
                    {liquidMapVessel?.batchId ? (
                      <>
                        {/* ABV - show Est ABV / Pot ABV format */}
                        {(() => {
                          const measurement = liquidMapVessel.latestMeasurement;
                          const og = liquidMapVessel.originalGravity;
                          const ASSUMED_FG = 1.000;
                          const isNonFermenting = liquidMapVessel.fermentationStage === "not_applicable"
                            || liquidMapVessel.productType === "pommeau"
                            || liquidMapVessel.productType === "brandy";
                          const batchActualAbv = liquidMapVessel.actualAbv;
                          const batchEstimatedAbv = liquidMapVessel.estimatedAbv;

                          // For non-fermenting products (pommeau, brandy), use batch ABV directly
                          if (isNonFermenting) {
                            const abv = batchActualAbv || batchEstimatedAbv;
                            const abvDisplay = abv ? `${parseFloat(String(abv)).toFixed(1)}%` : "--";
                            const isMeasured = batchActualAbv != null;
                            return (
                              <div className="flex justify-between">
                                <span className="text-gray-600" title="Actual ABV">
                                  ABV
                                  {abv && (
                                    isMeasured ? (
                                      <span className="text-green-600 text-[10px] ml-0.5" title="Measured">(M)</span>
                                    ) : (
                                      <span className="text-orange-500 text-[10px] ml-0.5" title="Estimated">(E)</span>
                                    )
                                  )}:
                                </span>
                                <span className="font-medium">{abvDisplay}</span>
                              </div>
                            );
                          }

                          // Calculate potential ABV (if OG exists)
                          let potentialAbv: number | null = null;
                          if (og) {
                            const ogNum = parseFloat(String(og));
                            potentialAbv = (ogNum - ASSUMED_FG) * 131.25;
                          }

                          // Calculate estimated ABV (if we have both OG and current SG)
                          let estimatedAbv: number | null = null;
                          if (measurement?.specificGravity && og) {
                            const fg = parseFloat(String(measurement.specificGravity));
                            const ogNum = parseFloat(String(og));
                            if (fg < ogNum) {
                              estimatedAbv = (ogNum - fg) * 131.25;
                            }
                          }

                          // Use measured ABV if available
                          if (measurement?.abv) {
                            estimatedAbv = parseFloat(String(measurement.abv));
                          }

                          // Format: "Est ABV / Pot ABV" or "--/Pot ABV" or "--/--"
                          const estDisplay = estimatedAbv !== null ? `${estimatedAbv.toFixed(1)}%` : "--";
                          const potDisplay = potentialAbv !== null && potentialAbv > 0 ? `${potentialAbv.toFixed(1)}%` : "--";

                          // Determine if ABV is from measurement (and if estimated) or calculated
                          const abvIsFromMeasurement = measurement?.abv != null;
                          const abvIsEstimated = abvIsFromMeasurement ? measurement?.abvIsEstimated : true; // Calculated values are always estimates

                          return (
                            <div className="flex justify-between">
                              <span className="text-gray-600" title="Estimated ABV / Potential ABV (if ferments to 1.000)">
                                ABV
                                {estimatedAbv !== null && (
                                  abvIsEstimated === true ? (
                                    <span className="text-orange-500 text-[10px] ml-0.5" title="Estimated">(E)</span>
                                  ) : (
                                    <span className="text-green-600 text-[10px] ml-0.5" title="Measured">(M)</span>
                                  )
                                )}:
                              </span>
                              <span className="font-medium">
                                <span title="Current estimated ABV">{estDisplay}</span>
                                <span className="text-gray-400 mx-0.5">/</span>
                                <span className="text-gray-500" title="Potential ABV if ferments dry">{potDisplay}</span>
                              </span>
                            </div>
                          );
                        })()}
                        {/* Show CO₂ if pressure vessel with carbonation data */}
                        {liquidMapVessel.isPressureVessel === "yes" && (liquidMapVessel.carbonationFinalCo2 || liquidMapVessel.carbonationTargetCo2) && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">CO₂:</span>
                            <button
                              onClick={() => setCo2Unit(co2Unit === "vol" ? "gL" : "vol")}
                              className="font-medium hover:text-purple-600 transition-colors cursor-pointer"
                              title="Click to toggle between volumes and g/L"
                            >
                              {(() => {
                                const co2Value = liquidMapVessel.carbonationFinalCo2
                                  ? parseFloat(String(liquidMapVessel.carbonationFinalCo2))
                                  : parseFloat(String(liquidMapVessel.carbonationTargetCo2));

                                return co2Unit === "vol"
                                  ? `${co2Value.toFixed(2)} vol`
                                  : `${(co2Value * 1.96).toFixed(2)} g/L`;
                              })()}
                            </button>
                          </div>
                        )}
                        {liquidMapVessel.latestMeasurement?.specificGravity && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              SG
                              {liquidMapVessel.latestMeasurement.specificGravityIsEstimated === true ? (
                                <span className="text-orange-500 text-[10px] ml-0.5" title="Estimated">(E)</span>
                              ) : (
                                <span className="text-green-600 text-[10px] ml-0.5" title="Measured">(M)</span>
                              )}:
                            </span>
                            <span className="font-medium">
                              {Number(liquidMapVessel.latestMeasurement.specificGravity).toFixed(orgSettings.sgDecimalPlaces)}
                              {liquidMapVessel.latestMeasurement.specificGravityDate && (
                                <span className="text-gray-400 text-[10px] ml-1">
                                  {formatDate(liquidMapVessel.latestMeasurement.specificGravityDate)}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {liquidMapVessel.latestMeasurement?.ph && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              pH
                              {liquidMapVessel.latestMeasurement.phIsEstimated === true ? (
                                <span className="text-orange-500 text-[10px] ml-0.5" title="Estimated">(E)</span>
                              ) : (
                                <span className="text-green-600 text-[10px] ml-0.5" title="Measured">(M)</span>
                              )}:
                            </span>
                            <span className="font-medium">
                              {Number(liquidMapVessel.latestMeasurement.ph).toFixed(orgSettings.phDecimalPlaces)}
                              {liquidMapVessel.latestMeasurement.phDate && (
                                <span className="text-gray-400 text-[10px] ml-1">
                                  {formatDate(liquidMapVessel.latestMeasurement.phDate)}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Volume Indicator */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Volume</span>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <VolumeDisplay
                        value={currentVolume}
                        unit={capacityUnit as VolumeUnit}
                        showUnit={true}
                      />
                      <span>/</span>
                      <VolumeDisplay
                        value={capacity}
                        unit={capacityUnit as VolumeUnit}
                        showUnit={true}
                      />
                      {maxCapacity && maxCapacity > capacity && (
                        <span className="text-xs text-gray-500" title="Max capacity (including headspace)">
                          ({Math.round(maxCapacity)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                    {/* Working capacity marker when overfilled */}
                    {maxCapacity && maxCapacity > capacity && fillPercentage > 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                        style={{ left: `${(capacity / maxCapacity) * 100}%` }}
                        title="Working capacity"
                      />
                    )}
                    <div
                      className={`h-3 rounded-full transition-all ${
                        fillPercentage > 90 && fillPercentage <= 100
                          ? "bg-yellow-500"
                          : fillPercentage > 75
                            ? "bg-yellow-400"
                            : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          maxCapacity && fillPercentage > 100
                            ? (currentVolume / maxCapacity) * 100
                            : fillPercentage,
                          100
                        )}%`,
                        ...(fillPercentage > 100 && {
                          background: `repeating-linear-gradient(
                            45deg,
                            rgb(59, 130, 246),
                            rgb(59, 130, 246) 4px,
                            rgb(96, 165, 250) 4px,
                            rgb(96, 165, 250) 8px
                          )`
                        })
                      }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {fillPercentage.toFixed(1)}% full
                  </div>
                </div>

                {/* Filter & Carbonation Status */}
                {liquidMapVessel?.batchId && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mb-2">
                    <span>
                      Filter:{" "}
                      {liquidMapVessel.filterType ? (
                        <span className="text-gray-700 font-medium">
                          {String(liquidMapVessel.filterType).charAt(0).toUpperCase() + String(liquidMapVessel.filterType).slice(1)}
                        </span>
                      ) : (
                        "None"
                      )}
                    </span>
                    <span>
                      Carb:{" "}
                      {liquidMapVessel.carbonationId ? (
                        liquidMapVessel.carbonationProcess === "bottle_conditioning" ? (
                          <span className="text-gray-700 font-medium">
                            Primed
                            {liquidMapVessel.primingSugarAmount && liquidMapVessel.carbonationStartingVolume
                              ? ` ${(parseFloat(String(liquidMapVessel.primingSugarAmount)) / parseFloat(String(liquidMapVessel.carbonationStartingVolume))).toFixed(1)} g/L`
                              : ""}
                            {liquidMapVessel.carbonationTargetCo2
                              ? ` (${parseFloat(String(liquidMapVessel.carbonationTargetCo2)).toFixed(1)} vol)`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-gray-700 font-medium">
                            Forced
                            {liquidMapVessel.carbonationFinalCo2
                              ? ` ${parseFloat(String(liquidMapVessel.carbonationFinalCo2)).toFixed(1)} vol`
                              : liquidMapVessel.carbonationTargetCo2
                                ? ` → ${parseFloat(String(liquidMapVessel.carbonationTargetCo2)).toFixed(1)} vol`
                                : ""}
                          </span>
                        )
                      ) : (
                        "None"
                      )}
                    </span>
                  </div>
                )}

                <div className="flex space-x-2">
                  {/* Batch Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <MoreVertical className="w-3 h-3 sm:mr-1" />
                        <span className="hidden sm:inline">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="max-h-[80vh] overflow-y-auto w-56"
                      sideOffset={5}
                    >
                      <DropdownMenuLabel>Tank Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {/* Show Clean Tank when vessel is in cleaning status */}
                      {vessel.status === "cleaning" && (
                        <DropdownMenuItem
                          onClick={() => handleCleanTank(vessel.id, vessel.name)}
                          className="text-green-600"
                        >
                          <CheckCircle className="w-3 h-3 mr-2" />
                          Clean Tank (Mark as Available)
                        </DropdownMenuItem>
                      )}

                      {/* Show batch actions when not cleaning, OR when cleaning but still has liquid */}
                      {(vessel.status !== "cleaning" || currentVolume > 0) && (
                        <>
                          {/* Batch-specific actions based on fermentation stage */}
                          {liquidMapVessel?.batchStatus === "fermentation" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRack(vessel.id)}
                              >
                                <FlaskConical className="w-3 h-3 mr-2" />
                                Rack Batch
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSetToAging(vessel.id)}
                              >
                                <Clock className="w-3 h-3 mr-2" />
                                Set to Aging
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCarbonate(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <Waves className="w-3 h-3 mr-2" />
                                Carbonate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleFilter(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <FilterIcon className="w-3 h-3 mr-2" />
                                Filter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePackage(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <Package className="w-3 h-3 mr-2" />
                                Package
                              </DropdownMenuItem>
                            </>
                          )}
                          {liquidMapVessel?.batchStatus === "aging" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleCarbonate(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <Waves className="w-3 h-3 mr-2" />
                                Carbonate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleFilter(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <FilterIcon className="w-3 h-3 mr-2" />
                                Filter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePackage(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <Package className="w-3 h-3 mr-2" />
                                Package
                              </DropdownMenuItem>
                            </>
                          )}
                          {liquidMapVessel?.batchId && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleTankMeasurement(vessel.id)}
                              >
                                <Thermometer className="w-3 h-3 mr-2" />
                                Add Measurement
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTankAdditive(vessel.id)}
                              >
                                <Droplets className="w-3 h-3 mr-2" />
                                Add Additive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleVolumeAdjustment(vessel.id)}
                              >
                                <Scale className="w-3 h-3 mr-2" />
                                Adjust Volume
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleViewBatch(vessel.id)}
                            disabled={!liquidMapVessel?.batchId}
                          >
                            <Eye className="w-3 h-3 mr-2" />
                            View Batch
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTankTransfer(vessel.id)}
                            disabled={currentVolume <= 0}
                          >
                            <ArrowRight className="w-3 h-3 mr-2" />
                            Transfer to Another Tank
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Tank Management Settings */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2"
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48"
                      sideOffset={5}
                    >
                      <DropdownMenuLabel>Tank Management</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => setEditingVesselId(vessel.id)}
                      >
                        <Settings className="w-3 h-3 mr-2" />
                        Edit Tank
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedVesselForHistory(vessel.id);
                          setShowVesselHistory(true);
                        }}
                      >
                        <History className="w-3 h-3 mr-2" />
                        View Tank History
                      </DropdownMenuItem>

                      {vessel.isBarrel && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedBarrelForHistory(vessel.id);
                            setShowBarrelHistory(true);
                          }}
                        >
                          <Wine className="w-3 h-3 mr-2" />
                          View Barrel History
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => handlePurgeTank(vessel.id, vessel.name)}
                        disabled={!liquidMapVessel?.batchId}
                        className="text-orange-600"
                      >
                        <Droplets className="w-3 h-3 mr-2" />
                        Purge Tank
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          handleDeleteClick(vessel.id, vessel.name)
                        }
                        disabled={vessel.status === "available"}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tank</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;
                {vesselToDelete?.name || "Unknown"}&quot;? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={handleDeleteCancel}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Purge Tank Confirmation Modal */}
        <Dialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purge Tank</DialogTitle>
              <DialogDescription>
                Are you sure you want to purge &quot;
                {vesselToPurge?.name || "Unknown"}&quot;? This will delete the
                batch currently in the tank and clear all liquid. This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={handlePurgeCancel}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handlePurgeConfirm}
                disabled={purgeMutation.isPending}
              >
                {purgeMutation.isPending ? "Purging..." : "Purge Tank"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Batch Measurement Form */}
        <Dialog
          open={showMeasurementForm}
          onOpenChange={setShowMeasurementForm}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Batch Measurement</DialogTitle>
              <DialogDescription>
                Record measurement data for the batch in this vessel
                {selectedVesselBatchName && selectedVesselBatchDate && (
                  <span className="block text-xs mt-1">
                    Batch: {selectedVesselBatchName} &middot; In vessel since {selectedVesselBatchDate}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedBatchIdForMeasurement && (
              <BatchMeasurementFormWrapper
                vesselId={selectedVesselId || ""}
                batchId={selectedBatchIdForMeasurement}
                onClose={() => {
                  setShowMeasurementForm(false);
                  setSelectedBatchIdForMeasurement(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Tank Additive Form */}
        <Dialog open={showAdditiveForm} onOpenChange={setShowAdditiveForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Tank Additive</DialogTitle>
              <DialogDescription>
                Record additive addition for this tank
                {selectedVesselBatchName && selectedVesselBatchDate && (
                  <span className="block text-xs mt-1">
                    Batch: {selectedVesselBatchName} &middot; In vessel since {selectedVesselBatchDate}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <TankAdditiveForm
              vesselId={selectedVesselId || ""}
              onClose={() => setShowAdditiveForm(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Tank Transfer Form */}
        <Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Transfer to Another Tank</DialogTitle>
              <DialogDescription>
                Move liquid from this tank to another available tank
                {selectedVesselBatchName && selectedVesselBatchDate && (
                  <span className="block text-xs mt-1">
                    Batch: {selectedVesselBatchName} &middot; In vessel since {selectedVesselBatchDate}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <TankTransferForm
              fromVesselId={selectedVesselId || ""}
              onClose={() => setShowTransferForm(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Batch History Modal */}
        {selectedBatchId && (
          <BatchHistoryModal
            batchId={selectedBatchId}
            open={showBatchHistory}
            onClose={() => {
              setShowBatchHistory(false);
              setSelectedBatchId(null);
            }}
          />
        )}

        {/* Vessel History Modal */}
        {selectedVesselForHistory && (
          <VesselHistoryModal
            vesselId={selectedVesselForHistory}
            open={showVesselHistory}
            onClose={() => {
              setShowVesselHistory(false);
              setSelectedVesselForHistory(null);
            }}
          />
        )}

        {/* Barrel History Modal */}
        {selectedBarrelForHistory && (
          <BarrelHistoryModal
            vesselId={selectedBarrelForHistory}
            open={showBarrelHistory}
            onClose={() => {
              setShowBarrelHistory(false);
              setSelectedBarrelForHistory(null);
            }}
          />
        )}

        {/* Unified Packaging Modal (Bottles/Cans or Kegs) */}
        {selectedVesselForPackaging && (
          <UnifiedPackagingModal
            open={showPackagingModal}
            onClose={handleClosePackagingModal}
            vesselId={selectedVesselForPackaging.id}
            vesselName={selectedVesselForPackaging.name}
            batchId={selectedVesselForPackaging.batchId}
            currentVolumeL={selectedVesselForPackaging.currentVolumeL}
            preBottling={selectedVesselForPackaging.preBottling}
          />
        )}

        {/* Filter Modal */}
        {selectedVesselForFiltering && (
          <FilterModal
            open={showFilterModal}
            onClose={handleCloseFilterModal}
            vesselId={selectedVesselForFiltering.id}
            vesselName={selectedVesselForFiltering.name}
            batchId={selectedVesselForFiltering.batchId}
            currentVolumeL={selectedVesselForFiltering.currentVolumeL}
          />
        )}

        {/* Volume Adjustment Modal */}
        {selectedBatchForAdjustment && (
          <VolumeAdjustmentModal
            open={showVolumeAdjustmentModal}
            onClose={handleCloseVolumeAdjustmentModal}
            batchId={selectedBatchForAdjustment.id}
            batchName={selectedBatchForAdjustment.name}
            currentVolumeL={selectedBatchForAdjustment.currentVolumeL}
            vesselId={selectedBatchForAdjustment.vesselId}
            vesselName={selectedBatchForAdjustment.vesselName}
          />
        )}

        {/* Racking Modal */}
        {selectedVesselForRacking && (
          <RackingModal
            open={showRackingModal}
            onClose={handleCloseRackingModal}
            batchId={selectedVesselForRacking.batchId}
            batchName={selectedVesselForRacking.batchName}
            sourceVesselId={selectedVesselForRacking.id}
            sourceVesselName={selectedVesselForRacking.name}
            currentVolumeL={selectedVesselForRacking.currentVolumeL}
            sourceVesselCapacityUnit={selectedVesselForRacking.capacityUnit}
          />
        )}

        {/* Clean Tank Modal */}
        <CleanTankModal
          open={showCleanTankModal && !!selectedVesselForCleaning}
          onClose={() => {
            setShowCleanTankModal(false);
            setSelectedVesselForCleaning(null);
          }}
          vesselId={selectedVesselForCleaning?.id || ""}
          vesselName={selectedVesselForCleaning?.name || ""}
        />

        {/* Carbonate Modal */}
        {selectedVesselForCarbonation && (
          <CarbonateModal
            open={showCarbonateModal}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setShowCarbonateModal(false);
                setSelectedVesselForCarbonation(null);
              }
            }}
            batch={{
              id: selectedVesselForCarbonation.batchId,
              name: selectedVesselForCarbonation.batchName,
              vesselId: selectedVesselForCarbonation.id,
              currentVolume: selectedVesselForCarbonation.currentVolumeL,
              currentVolumeUnit: selectedVesselForCarbonation.currentVolumeUnit,
              status: selectedVesselForCarbonation.batchStatus,
            }}
            vessel={{
              id: selectedVesselForCarbonation.id,
              name: selectedVesselForCarbonation.name,
              isPressureVessel: selectedVesselForCarbonation.isPressureVessel,
              maxPressure: selectedVesselForCarbonation.maxPressure,
            }}
            onSuccess={() => {
              utils.vessel.liquidMap.invalidate();
              utils.batch.list.invalidate();
            }}
          />
        )}

        {/* Set to Aging Modal */}
        {selectedVesselForAging && (
          <Dialog
            open={showAgingModal}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setShowAgingModal(false);
                setSelectedVesselForAging(null);
                setAgingDate(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Batch to Aging</DialogTitle>
                <DialogDescription>
                  Set {selectedVesselForAging.batchName} to aging status and specify when aging began
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="aging-date">Aging Start Date & Time</Label>
                  <Input
                    id="aging-date"
                    type="datetime-local"
                    value={agingDate ? formatDateTimeForInput(agingDate) : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setAgingDate(parseDateTimeFromInput(e.target.value));
                      }
                    }}
                    max={formatDateTimeForInput(new Date())}
                  />
                  <p className="text-sm text-muted-foreground">
                    This date and time will be recorded as when the batch transitioned to the aging phase
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAgingModal(false);
                    setSelectedVesselForAging(null);
                    setAgingDate(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!agingDate) {
                      toast({
                        title: "Date Required",
                        description: "Please select an aging start date and time",
                        variant: "destructive",
                      });
                      return;
                    }
                    updateBatchStatusMutation.mutate({
                      batchId: selectedVesselForAging.batchId,
                      status: "aging",
                      startDate: agingDate,
                    });
                    setShowAgingModal(false);
                    setSelectedVesselForAging(null);
                    setAgingDate(null);
                  }}
                >
                  Set to Aging
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Tank Modal */}
        <Dialog
          open={!!editingVesselId}
          onOpenChange={(open) => !open && setEditingVesselId(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tank</DialogTitle>
              <DialogDescription>
                Update tank details including name and capacity unit
              </DialogDescription>
            </DialogHeader>
            {editingVesselId && (
              <>
                <TankForm
                  vesselId={editingVesselId}
                  onClose={() => setEditingVesselId(null)}
                />
                <EditVesselBarrelHistory vesselId={editingVesselId} />
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
