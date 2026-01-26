"use client";

import React, { useState, useCallback } from "react";
import { formatDateTimeForInput, formatDate } from "@/utils/date-format";
import { trpc } from "@/utils/trpc";
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
  Activity,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Waves,
  Zap,
  ArrowRight,
  Trash2,
  Settings,
  MoreVertical,
  FlaskConical,
  Wine,
  Filter as FilterIcon,
  Package,
  Search,
  History,
  ArrowUpDown,
  SlidersHorizontal,
  Sprout,
  Scale,
} from "lucide-react";
import {
  litersToGallons,
  formatVolume,
  formatVolumeRange,
  VolumeUnit,
  convertVolume,
} from "lib";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BatchHistoryModal } from "@/components/cellar/BatchHistoryModal";
import { AddBatchMeasurementForm } from "@/components/cellar/AddBatchMeasurementForm";
import { AddBatchAdditiveForm } from "@/components/cellar/AddBatchAdditiveForm";
import { UnifiedPackagingModal } from "@/components/packaging/UnifiedPackagingModal";
import { FilterModal } from "@/components/cellar/FilterModal";
import { RackingModal } from "@/components/cellar/RackingModal";
import { VolumeAdjustmentModal } from "@/components/cellar/VolumeAdjustmentModal";
import { CleanTankModal } from "@/components/cellar/CleanTankModal";
import { CarbonateModal } from "@/components/batch/CarbonateModal";
import { KegsManagement } from "@/components/packaging/kegs/KegsManagement";
import { VolumeDisplay, VolumeInput, VolumeUnit as VolumeUnitType } from "@/components/ui/volume-input";
import { VesselHistoryModal } from "@/components/cellar/VesselHistoryModal";
import { BarrelHistoryModal } from "@/components/cellar/BarrelHistoryModal";
import { BarrelContentsHistory } from "@/components/cellar/BarrelContentsHistory";
import { BatchManagementTable } from "@/components/cellar/BatchManagementTable";

// Form schemas
const measurementSchema = z.object({
  batchId: z.string().uuid("Select a batch"),
  measurementDate: z.string().min(1, "Date is required"),
  specificGravity: z.number().min(0.99).max(1.2),
  abv: z.number().min(0).max(20).optional(),
  ph: z.number().min(2).max(5).optional(),
  totalAcidity: z.number().min(0).max(20).optional(),
  temperature: z.number().min(0).max(40).optional(),
  volumeL: z.number().positive().optional(),
  notes: z.string().optional(),
});

const tankMeasurementSchema = z.object({
  measurementDate: z.string().optional(),
  temperature: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z.number().optional(),
  ),
  temperatureUnit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  sh: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z.number().optional(),
  ),
  ph: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z.number().optional(),
  ),
  ta: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? undefined : Number(val),
    z.number().optional(),
  ),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  fromVesselId: z.string().uuid("Select source vessel"),
  toVesselId: z.string().uuid("Select destination vessel"),
  volumeL: z.number().positive("Volume must be positive"),
  loss: z.preprocess(
    (val) => val === "" || val === null || val === undefined || (typeof val === "number" && isNaN(val)) ? undefined : Number(val),
    z.number().min(0, "Loss cannot be negative").optional()
  ),
  transferDate: z.preprocess(
    (val) => val === null || val === undefined ? undefined : val,
    z.date().or(z.string().transform((val) => new Date(val))).optional()
  ),
  notes: z.string().optional(),
});

const tankSchema = z.object({
  name: z.string().optional(),
  capacity: z.number().positive("Capacity must be positive"),
  maxCapacity: z.number().min(0.001, "Max capacity must be positive").optional(),
  capacityUnit: z.enum(["L", "gal"]),
  material: z.enum(["stainless_steel", "plastic", "wood"]).optional(),
  jacketed: z.enum(["yes", "no"]).optional(),
  isPressureVessel: z.enum(["yes", "no"]).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  // Barrel-specific fields
  isBarrel: z.boolean().optional(),
  barrelWoodType: z.enum(["french_oak", "american_oak", "hungarian_oak", "chestnut", "other"]).optional(),
  barrelOriginContents: z.string().optional(), // Now dynamically loaded from barrel_origin_types table
  barrelOriginNotes: z.string().optional(),
  barrelToastLevel: z.enum(["light", "medium", "medium_plus", "heavy", "char"]).optional(),
  barrelYearAcquired: z.number().optional(),
  barrelAgeYears: z.number().optional(),
  barrelCost: z.number().optional(),
  barrelFlavorLevel: z.enum(["high", "medium", "low", "neutral"]).optional(),
});

type MeasurementForm = z.infer<typeof measurementSchema>;
type TransferForm = z.infer<typeof transferSchema>;
type TankForm = z.infer<typeof tankSchema>;

function TankForm({
  vesselId,
  onClose,
}: {
  vesselId?: string;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<TankForm>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      capacityUnit: "L",
    },
  });

  const utils = trpc.useUtils();
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId! },
    { enabled: !!vesselId },
  );

  // Fetch barrel origin types for dropdown
  const barrelOriginTypesQuery = trpc.barrelOriginTypes.list.useQuery();

  const createMutation = trpc.vessel.create.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      onClose();
      reset();
    },
  });

  const updateMutation = trpc.vessel.update.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      onClose();
      reset();
    },
  });

  // Load existing vessel data for editing
  React.useEffect(() => {
    if (vesselQuery.data?.vessel) {
      const vessel = vesselQuery.data.vessel;
      // Capacity is stored in the display unit (vessel.capacityUnit), no conversion needed
      const displayCapacity = parseFloat(vessel.capacity);
      const displayMaxCapacity = vessel.maxCapacity ? parseFloat(vessel.maxCapacity) : undefined;

      reset({
        name: vessel.name || undefined,
        capacity: displayCapacity,
        maxCapacity: displayMaxCapacity,
        capacityUnit: vessel.capacityUnit as any,
        material: vessel.material || undefined,
        jacketed: vessel.jacketed || undefined,
        isPressureVessel: vessel.isPressureVessel || undefined,
        location: vessel.location || undefined,
        notes: vessel.notes || undefined,
        // Barrel-specific fields - convert empty strings to undefined
        isBarrel: vessel.isBarrel || false,
        barrelWoodType: vessel.barrelWoodType || undefined,
        barrelOriginContents: vessel.barrelOriginContents || undefined,
        barrelOriginNotes: vessel.barrelOriginNotes || undefined,
        barrelToastLevel: vessel.barrelToastLevel || undefined,
        barrelYearAcquired: vessel.barrelYearAcquired || undefined,
        barrelAgeYears: vessel.barrelAgeYears || undefined,
        barrelCost: vessel.barrelCost ? parseFloat(vessel.barrelCost) : undefined,
        barrelFlavorLevel: vessel.barrelFlavorLevel || undefined,
      });
    }
  }, [vesselQuery.data, reset]);

  const watchedCapacityUnit = watch("capacityUnit");
  const watchedMaterial = watch("material");
  const watchedIsBarrel = watch("isBarrel");

  // Auto-set isBarrel when material is wood
  React.useEffect(() => {
    if (watchedMaterial === "wood" && !watchedIsBarrel) {
      setValue("isBarrel", true);
    }
  }, [watchedMaterial, watchedIsBarrel, setValue]);

  // Reset jacketed and pressure vessel when material is not stainless steel
  React.useEffect(() => {
    if (watchedMaterial === "plastic" || watchedMaterial === "wood") {
      setValue("jacketed", "no");
      setValue("isPressureVessel", "no");
    }
  }, [watchedMaterial, setValue]);

  // Only stainless steel can be jacketed or pressure vessel
  const canBeJacketedOrPressure = watchedMaterial === "stainless_steel";

  // Show barrel fields if material is wood or isBarrel is checked
  const showBarrelFields = watchedMaterial === "wood" || watchedIsBarrel;

  const onSubmit = (data: TankForm) => {
    // Convert capacity to liters for storage (always stored in liters in DB)
    // capacityUnit for vessels is always L or gal
    const capacityL = convertVolume(
      data.capacity,
      data.capacityUnit as "L" | "gal",
      "L"
    );
    const maxCapacityL = data.maxCapacity
      ? convertVolume(data.maxCapacity, data.capacityUnit as "L" | "gal", "L")
      : undefined;

    const submitData = {
      ...data,
      capacityL,
      maxCapacityL,
      // Include barrel fields if this is a barrel
      ...(data.isBarrel && {
        isBarrel: data.isBarrel,
        barrelWoodType: data.barrelWoodType,
        barrelOriginContents: data.barrelOriginContents,
        barrelOriginNotes: data.barrelOriginNotes,
        barrelToastLevel: data.barrelToastLevel,
        barrelYearAcquired: data.barrelYearAcquired,
        barrelAgeYears: data.barrelAgeYears,
        barrelCost: data.barrelCost,
        barrelFlavorLevel: data.barrelFlavorLevel || "high",
      }),
    };

    if (vesselId) {
      updateMutation.mutate({ id: vesselId, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Tank Name</Label>
          <Input
            id="name"
            placeholder="Leave empty to auto-generate (Tank 1, Tank 2, etc.)"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="capacity">Working Capacity</Label>
          <VolumeInput
            id="capacity"
            value={watch("capacity")}
            unit={watchedCapacityUnit as VolumeUnitType}
            onValueChange={(value) => setValue("capacity", value || 0)}
            onUnitChange={(unit) => setValue("capacityUnit", unit as "L" | "gal")}
            placeholder="Normal fill level"
            required
          />
          {errors.capacity && (
            <p className="text-sm text-red-600 mt-1">
              {errors.capacity.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="maxCapacity">Max Capacity (optional)</Label>
          <VolumeInput
            id="maxCapacity"
            value={watch("maxCapacity")}
            unit={watchedCapacityUnit as VolumeUnitType}
            onValueChange={(value) => setValue("maxCapacity", value || undefined)}
            onUnitChange={(unit) => setValue("capacityUnit", unit as "L" | "gal")}
            placeholder="Including headspace"
          />
          <p className="text-xs text-muted-foreground mt-1">
            For overfill situations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="material">Material</Label>
          <Select
            value={watch("material")}
            onValueChange={(value) => setValue("material", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stainless_steel">Stainless Steel</SelectItem>
              <SelectItem value="plastic">Plastic</SelectItem>
              <SelectItem value="wood">Wood</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="jacketed" className={!canBeJacketedOrPressure ? "text-muted-foreground" : ""}>
            Jacketed {!canBeJacketedOrPressure && <span className="text-xs">(SS only)</span>}
          </Label>
          <Select
            value={watch("jacketed")}
            onValueChange={(value) => setValue("jacketed", value as any)}
            disabled={!canBeJacketedOrPressure}
          >
            <SelectTrigger disabled={!canBeJacketedOrPressure}>
              <SelectValue placeholder="Select jacketed option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="isPressureVessel" className={!canBeJacketedOrPressure ? "text-muted-foreground" : ""}>
            Pressure Vessel {!canBeJacketedOrPressure && <span className="text-xs">(SS only)</span>}
          </Label>
          <Select
            value={watch("isPressureVessel")}
            onValueChange={(value) => setValue("isPressureVessel", value as any)}
            disabled={!canBeJacketedOrPressure}
          >
            <SelectTrigger disabled={!canBeJacketedOrPressure}>
              <SelectValue placeholder="Select pressure vessel option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="Building A, Row 1"
          {...register("location")}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          placeholder="Additional notes..."
          {...register("notes")}
        />
      </div>

      {/* Barrel-specific fields */}
      {showBarrelFields && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <h3 className="font-medium text-lg">Barrel Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barrelWoodType">Wood Type</Label>
              <Select
                value={watch("barrelWoodType")}
                onValueChange={(value) => setValue("barrelWoodType", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="french_oak">French Oak</SelectItem>
                  <SelectItem value="american_oak">American Oak</SelectItem>
                  <SelectItem value="hungarian_oak">Hungarian Oak</SelectItem>
                  <SelectItem value="chestnut">Chestnut</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="barrelToastLevel">Toast Level</Label>
              <Select
                value={watch("barrelToastLevel")}
                onValueChange={(value) => setValue("barrelToastLevel", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select toast level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="medium_plus">Medium+</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                  <SelectItem value="char">Char</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barrelOriginContents">Previous Contents</Label>
              <Select
                value={watch("barrelOriginContents")}
                onValueChange={(value) => setValue("barrelOriginContents", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="What was in barrel before?" />
                </SelectTrigger>
                <SelectContent>
                  {barrelOriginTypesQuery.data?.types.map((type) => (
                    <SelectItem key={type.id} value={type.slug}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="barrelOriginNotes">Origin Notes</Label>
              <Input
                id="barrelOriginNotes"
                placeholder="e.g., 4-year Buffalo Trace"
                {...register("barrelOriginNotes")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="barrelYearAcquired">Year Acquired</Label>
              <Input
                id="barrelYearAcquired"
                type="number"
                placeholder={new Date().getFullYear().toString()}
                {...register("barrelYearAcquired", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="barrelAgeYears">Age When Acquired (years)</Label>
              <Input
                id="barrelAgeYears"
                type="number"
                placeholder="0"
                {...register("barrelAgeYears", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="barrelCost">Cost ($)</Label>
              <Input
                id="barrelCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("barrelCost", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="barrelFlavorLevel">Current Flavor Level</Label>
            <Select
              value={watch("barrelFlavorLevel") || "high"}
              onValueChange={(value) => setValue("barrelFlavorLevel", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select flavor contribution level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Strong oak/spirit character</SelectItem>
                <SelectItem value="medium">Medium - Moderate flavor contribution</SelectItem>
                <SelectItem value="low">Low - Subtle flavors remaining</SelectItem>
                <SelectItem value="neutral">Neutral - No significant flavor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              New barrels start at High. Flavor level decreases with each use.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : vesselId
              ? "Update Tank"
              : "Add Tank"}
        </Button>
      </div>
    </form>
  );
}

// Wrapper component that only shows barrel contents history if the vessel is a barrel
function EditVesselBarrelHistory({ vesselId }: { vesselId: string }) {
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId },
    { enabled: !!vesselId }
  );

  // Only show for barrels
  if (!vesselQuery.data?.vessel?.isBarrel) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-6">
      <BarrelContentsHistory
        vesselId={vesselId}
        vesselName={vesselQuery.data.vessel.name || undefined}
      />
    </div>
  );
}

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

function TankTransferForm({
  fromVesselId,
  onClose,
}: {
  fromVesselId: string;
  onClose: () => void;
}) {
  const [showBlendConfirm, setShowBlendConfirm] = useState(false);
  const [selectedDestVesselId, setSelectedDestVesselId] = useState<string | null>(null);
  const [vesselSearchQuery, setVesselSearchQuery] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromVesselId: fromVesselId,
      loss: undefined,
      transferDate: new Date(),
    },
  });

  const transferDate = watch("transferDate");

  // Helper to format date for datetime-local input
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return formatDateTimeForInput(new Date()); // Fallback to current time
    }
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const vesselListQuery = trpc.vessel.list.useQuery();
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();
  const utils = trpc.useUtils();

  // Get source vessel info
  const sourceVessel = vesselListQuery.data?.vessels?.find(
    (v) => v.id === fromVesselId,
  );
  const sourceLiquidMap = liquidMapQuery.data?.vessels?.find(
    (v) => v.vesselId === fromVesselId,
  );

  // Get source vessel's capacity unit for display
  const sourceCapacityUnit = (sourceVessel?.capacityUnit || "L") as VolumeUnit;

  // Unit selector state - default to source vessel's unit
  const [displayUnit, setDisplayUnit] = useState<"L" | "gal">("L");

  // Update display unit when vessel data loads
  React.useEffect(() => {
    if (sourceVessel?.capacityUnit) {
      setDisplayUnit(sourceVessel.capacityUnit === "gal" ? "gal" : "L");
    }
  }, [sourceVessel?.capacityUnit]);

  // Epsilon tolerance for validation (0.2 L ≈ 0.05 gal)
  const EPSILON_L = 0.2;

  // Helper functions for unit conversion using utility functions
  const toLiters = (value: number, unit: "L" | "gal"): number => {
    return convertVolume(value, unit, "L");
  };
  const fromLiters = (liters: number, unit: "L" | "gal"): number => {
    return convertVolume(liters, "L", unit);
  };
  const formatDisplayVolume = (value: number, unit: "L" | "gal"): string => {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} ${unit}`;
  };

  // Get current volume in source vessel in liters (canonical)
  let currentVolumeL = 0;
  if (sourceLiquidMap?.currentVolume) {
    const vol = parseFloat(sourceLiquidMap.currentVolume.toString());
    const unit = (sourceLiquidMap.currentVolumeUnit || "L") as VolumeUnit;
    currentVolumeL = convertVolume(vol, unit, "L");
  } else if (sourceLiquidMap?.applePressRunVolume) {
    const vol = parseFloat(sourceLiquidMap.applePressRunVolume.toString());
    const unit = (sourceLiquidMap.applePressRunVolumeUnit || "L") as VolumeUnit;
    currentVolumeL = convertVolume(vol, unit, "L");
  }

  // Convert current volume to display unit
  const currentVolume = fromLiters(currentVolumeL, displayUnit);

  // Get available destination vessels (exclude current vessel, only available vessels)
  const availableVessels =
    vesselListQuery.data?.vessels?.filter(
      (vessel) => vessel.id !== fromVesselId && vessel.status === "available",
    ) || [];

  // Filter vessels based on search query with natural sort
  const filteredVessels = availableVessels
    .filter((vessel) =>
      vessel.name?.toLowerCase().includes(vesselSearchQuery.toLowerCase())
    )
    .sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    );

  // Check if destination vessel has liquid (is fermenting)
  const watchedToVesselId = watch("toVesselId");
  const destVessel = availableVessels.find(v => v.id === watchedToVesselId);
  const destCapacityUnit = (destVessel?.capacityUnit || "L") as VolumeUnit;
  const destLiquidMap = liquidMapQuery.data?.vessels?.find(
    (v) => v.vesselId === watchedToVesselId,
  );

  // Get destination current volume, converted to its capacity unit
  let destCurrentVolume = 0;
  if (destLiquidMap?.currentVolume) {
    const vol = parseFloat(destLiquidMap.currentVolume.toString());
    const unit = (destLiquidMap.currentVolumeUnit || "L") as VolumeUnit;
    destCurrentVolume = convertVolume(vol, unit, destCapacityUnit);
  }

  // Check if destination has liquid based on actual volume, not status
  const destHasLiquid = destCurrentVolume > 0;

  // Get destination capacity and max capacity (convert to liters for comparison)
  const destCapacityRaw = destVessel?.capacity ? parseFloat(destVessel.capacity) : 0;
  const destCapacityL = destCapacityUnit === "gal"
    ? convertVolume(destCapacityRaw, "gal", "L")
    : destCapacityRaw;
  const destMaxCapacityRaw = destVessel?.maxCapacity ? parseFloat(destVessel.maxCapacity) : destCapacityRaw;
  const destMaxCapacityL = destCapacityUnit === "gal"
    ? convertVolume(destMaxCapacityRaw, "gal", "L")
    : destMaxCapacityRaw;

  const watchedVolumeL = watch("volumeL") || 0;
  const watchedLoss = (watch("loss") as number | undefined) || 0;

  // Calculate remaining volume with epsilon tolerance
  const transferInLiters = watchedVolumeL ? toLiters(watchedVolumeL, displayUnit) : 0;

  // Check if transfer would overfill destination
  const destCurrentVolumeL = convertVolume(destCurrentVolume, destCapacityUnit, "L");
  const destFinalVolumeL = destCurrentVolumeL + transferInLiters;
  const wouldExceedWorkingCapacity = destCapacityL > 0 && destFinalVolumeL > destCapacityL;
  const wouldExceedMaxCapacity = destMaxCapacityL > 0 && destFinalVolumeL > destMaxCapacityL;
  const lossInLiters = toLiters(watchedLoss, displayUnit);
  const totalUsedLiters = transferInLiters + lossInLiters;
  const isVolumeValid = totalUsedLiters <= currentVolumeL + EPSILON_L;
  const remainingVolume = currentVolume - watchedVolumeL - watchedLoss;

  const transferMutation = trpc.vessel.transfer.useMutation({
    onSuccess: (result) => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      setShowBlendConfirm(false);
      onClose();
      toast({
        title: "Transfer successful",
        description: result.message || "Liquid transferred successfully",
      });
    },
    onError: (error) => {
      setShowBlendConfirm(false);
      toast({
        title: "Transfer failed",
        description: error.message,
        variant: "destructive",
      });
      console.error("Transfer failed:", error.message);
    },
  });

  const onSubmit = (data: any) => {
    // Check if destination has liquid - if so, show blend confirmation
    if (destHasLiquid && !showBlendConfirm) {
      setSelectedDestVesselId(data.toVesselId);
      setShowBlendConfirm(true);
      return;
    }

    // Convert display unit values to canonical liters for API
    const volumeInLiters = toLiters(data.volumeL, displayUnit);
    const lossInLiters = data.loss ? toLiters(data.loss, displayUnit) : 0;

    // Proceed with transfer (API expects liters)
    transferMutation.mutate({
      ...data,
      volumeL: volumeInLiters,
      loss: lossInLiters,
      transferDate: data.transferDate,
    });
  };

  const handleBlendConfirm = () => {
    // User confirmed blend, proceed with transfer
    handleSubmit(onSubmit)();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900">
          Transfer from {sourceVessel?.name || "Unknown"}
        </h4>
        <p className="text-sm text-blue-700">
          Current volume:{" "}
          {formatDisplayVolume(currentVolume, displayUnit)}
        </p>
      </div>

      {/* Transfer Date */}
      <div>
        <Label htmlFor="transferDate">Transfer Date & Time</Label>
        <Input
          id="transferDate"
          type="datetime-local"
          value={formatDateForInput(transferDate as Date | undefined)}
          onChange={(e) => {
            const dateValue = new Date(e.target.value);
            if (!isNaN(dateValue.getTime())) {
              setValue("transferDate", dateValue);
            }
          }}
          className="w-full"
        />
        {errors.transferDate && (
          <p className="text-sm text-red-600 mt-1">{errors.transferDate.message}</p>
        )}
      </div>

      {/* Unit Selector */}
      <div>
        <Label>Display Units</Label>
        <Select
          value={displayUnit}
          onValueChange={(value) => setDisplayUnit(value as "L" | "gal")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L">Liters (L)</SelectItem>
            <SelectItem value="gal">Gallons (gal)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="toVesselId">Destination Tank</Label>
        <Select onValueChange={(value) => setValue("toVesselId", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select destination tank" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {/* Search Input - Sticky at top */}
            <div className="sticky top-0 z-10 bg-white p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search vessels..."
                  value={vesselSearchQuery}
                  onChange={(e) => setVesselSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Scrollable Vessel List */}
            <div className="overflow-y-auto max-h-[300px]">
              {filteredVessels.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {vesselSearchQuery ? "No vessels match your search" : "No available vessels"}
                </div>
              ) : (
                filteredVessels.map((vessel) => {
                  const vesselLiquidMap = liquidMapQuery.data?.vessels?.find(
                    (v) => v.vesselId === vessel.id,
                  );

                  // Capacity is stored in the display unit (vessel.capacityUnit)
                  const capacityUnit = vessel.capacityUnit as VolumeUnit;
                  const capacity = parseFloat(vessel.capacity);

                  // Current volume - convert to vessel's capacity unit
                  let vesselCurrentVolume = 0;
                  if (vesselLiquidMap?.currentVolume) {
                    const currentVol = parseFloat(vesselLiquidMap.currentVolume.toString());
                    const currentUnit = (vesselLiquidMap.currentVolumeUnit || "L") as VolumeUnit;
                    vesselCurrentVolume = convertVolume(currentVol, currentUnit, capacityUnit);
                  }
                  const hasLiquid = vessel.status === "available" && vesselCurrentVolume > 0;

                  return (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      <span className="flex items-center gap-2">
                        {vessel.name || "Unnamed"} (
                        <VolumeDisplay
                          value={capacity}
                          unit={capacityUnit}
                          showUnit={true}
                          className="inline"
                        />
                        capacity)
                        {hasLiquid && (
                          <span className="text-xs text-orange-600 font-medium">
                            • Contains {vesselCurrentVolume.toFixed(1)} {capacityUnit}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })
              )}
            </div>
          </SelectContent>
        </Select>
        {errors.toVesselId && (
          <p className="text-sm text-red-600">{errors.toVesselId.message}</p>
        )}
        {destHasLiquid && destCurrentVolume > 0 && (
          <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            This tank contains liquid. Transferring will blend the contents.
          </p>
        )}
        {wouldExceedMaxCapacity && (
          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Transfer would exceed max capacity! Final volume would be {formatVolume(convertVolume(destFinalVolumeL, "L", destCapacityUnit), destCapacityUnit)} but max is {formatVolume(destMaxCapacityRaw, destCapacityUnit)}.
          </p>
        )}
        {wouldExceedWorkingCapacity && !wouldExceedMaxCapacity && (
          <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Transfer will exceed working capacity (overfill). Final volume: {formatVolume(convertVolume(destFinalVolumeL, "L", destCapacityUnit), destCapacityUnit)} / Working: {formatVolume(destCapacityRaw, destCapacityUnit)} / Max: {formatVolume(destMaxCapacityRaw, destCapacityUnit)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor="volumeL">Transfer Volume ({displayUnit})</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue("volumeL", currentVolume)}
              className="h-7 text-xs"
            >
              Transfer All ({formatDisplayVolume(currentVolume, displayUnit)})
            </Button>
          </div>
          <Input
            id="volumeL"
            type="number"
            step="any"
            max={Number.isFinite(currentVolume) ? currentVolume : undefined}
            placeholder="Amount to transfer"
            {...register("volumeL", { valueAsNumber: true })}
          />
          {errors.volumeL && (
            <p className="text-sm text-red-600">{errors.volumeL.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="lossL">Loss/Waste ({displayUnit})</Label>
          <Input
            id="lossL"
            type="number"
            step="0.1"
            min="0"
            placeholder="0"
            {...register("loss", { valueAsNumber: true })}
          />
          {errors.loss && (
            <p className="text-sm text-red-600">{errors.loss.message}</p>
          )}
        </div>
      </div>

      {(watchedVolumeL || watchedLoss) && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Remaining in source tank:</span>{" "}
            <span
              className={
                !isVolumeValid
                  ? "text-red-600 font-medium"
                  : "text-gray-700"
              }
            >
              {formatDisplayVolume(remainingVolume, displayUnit)}
            </span>
          </p>
          {!isVolumeValid && (
            <p className="text-sm text-red-600 mt-1">
              ⚠️ Transfer volume exceeds available liquid
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          placeholder="Transfer notes..."
          {...register("notes")}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            !isVolumeValid || !watchedVolumeL || watchedVolumeL <= 0
          }
        >
          Transfer Liquid
        </Button>
      </div>

      {/* Blend Confirmation Modal */}
      <Dialog open={showBlendConfirm} onOpenChange={setShowBlendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Blend Operation
            </DialogTitle>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                The destination tank <strong>{destVessel?.name || "Unknown"}</strong> already contains{" "}
                {formatVolume(destCurrentVolume, destCapacityUnit)} of liquid.
              </p>
              <p>
                Transferring {formatDisplayVolume(watchedVolumeL || 0, displayUnit)} from{" "}
                <strong>{sourceVessel?.name || "Unknown"}</strong> will blend the contents of both tanks.
              </p>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-900">
                  ⚠️ This action is irreversible
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  The batches will be combined and cannot be separated. The resulting blend will have a total volume of approximately{" "}
                  {formatDisplayVolume(
                    fromLiters(
                      convertVolume(destCurrentVolume, destCapacityUnit, "L") + transferInLiters,
                      displayUnit
                    ),
                    displayUnit
                  )}.
                </p>
              </div>
              <p className="text-sm font-medium">Do you want to continue?</p>
            </div>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBlendConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleBlendConfirm}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Blending..." : "Confirm Blend"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function VesselMap() {
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

    setSelectedVesselForPackaging({
      id: vesselId,
      name: vessel.name || "Unnamed Vessel",
      batchId,
      currentVolumeL,
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
                      <p className="text-sm font-medium text-gray-900">
                        {liquidMapVessel.batchCustomName ? liquidMapVessel.batchCustomName : liquidMapVessel.batchNumber}
                      </p>
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
                          const isNonFermenting = liquidMapVessel.fermentationStage === "not_applicable";
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

                      {/* When vessel is cleaning, only show Clean Tank action */}
                      {vessel.status === "cleaning" ? (
                        <DropdownMenuItem
                          onClick={() => handleCleanTank(vessel.id, vessel.name)}
                          className="text-green-600"
                        >
                          <CheckCircle className="w-3 h-3 mr-2" />
                          Clean Tank (Mark as Available)
                        </DropdownMenuItem>
                      ) : (
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
                                onClick={() => handleFilter(vessel.id)}
                                disabled={
                                  !liquidMapVessel?.batchId || currentVolume <= 0
                                }
                              >
                                <FilterIcon className="w-3 h-3 mr-2" />
                                Filter
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
                    value={agingDate ? new Date(agingDate.getTime() - agingDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setAgingDate(new Date(e.target.value))}
                    max={new Date().toISOString().slice(0, 16)}
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

function AddMeasurement() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<MeasurementForm>({
    resolver: zodResolver(measurementSchema),
  });

  const specificGravity = watch("specificGravity");

  // Calculate approximate ABV from SG
  const calculateAbv = (sg: number) => {
    if (!sg || sg >= 1.0) return 0;
    // Simplified ABV calculation: (OG - FG) * 131.25
    const og = 1.055; // Assumed original gravity
    return ((og - sg) * 131.25).toFixed(1);
  };

  const onSubmit = (data: MeasurementForm) => {
    console.log("Measurement data:", data);
    // TODO: Implement measurement creation mutation
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-green-600" />
          Add Measurement
        </CardTitle>
        <CardDescription>
          Record new batch measurements and observations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batchId">Batch</Label>
              <Select onValueChange={(value) => setValue("batchId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b-2024-001">
                    B-2024-001 (Fermenter Tank 1)
                  </SelectItem>
                  <SelectItem value="b-2024-002">
                    B-2024-002 (Fermenter Tank 2)
                  </SelectItem>
                  <SelectItem value="b-2024-003">
                    B-2024-003 (Conditioning Tank 1)
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.batchId && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.batchId.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="measurementDate">Measurement Date</Label>
              <Input
                id="measurementDate"
                type="datetime-local"
                {...register("measurementDate")}
              />
              {errors.measurementDate && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.measurementDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="specificGravity">Specific Gravity</Label>
              <Input
                id="specificGravity"
                type="number"
                step="0.001"
                placeholder="1.015"
                {...register("specificGravity", { valueAsNumber: true })}
              />
              {errors.specificGravity && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.specificGravity.message}
                </p>
              )}
              {specificGravity && (
                <p className="text-sm text-gray-600 mt-1">
                  Est. ABV: {calculateAbv(specificGravity)}%
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ph">pH</Label>
              <Input
                id="ph"
                type="number"
                step="0.1"
                placeholder="3.5"
                {...register("ph", { valueAsNumber: true })}
              />
              {errors.ph && (
                <p className="text-sm text-red-600 mt-1">{errors.ph.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="temperature">Temperature (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                placeholder="18.5"
                {...register("temperature", { valueAsNumber: true })}
              />
              {errors.temperature && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.temperature.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
              <Input
                id="totalAcidity"
                type="number"
                step="0.1"
                placeholder="5.2"
                {...register("totalAcidity", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="volumeL">Volume</Label>
              <Input
                id="volumeL"
                type="number"
                step="0.1"
                placeholder="750"
                {...register("volumeL", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              {...register("notes")}
              placeholder="Fermentation observations..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">Add Measurement</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CellarPage() {
  const [activeTab, setActiveTab] = useState<"vessels" | "batches" | "kegs">("vessels");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cellar</h1>
          <p className="text-gray-600 mt-1">
            Monitor fermentation vessels, track batch progress, and record
            measurements.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "vessels", label: "Vessel Map", icon: Beaker },
            { key: "batches", label: "Batch List", icon: FlaskConical },
            { key: "kegs", label: "Keg Tracking", icon: Wine },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "vessels" && <VesselMap />}
          {activeTab === "batches" && <BatchManagementTable />}
          {activeTab === "kegs" && <KegsManagement />}
        </div>
      </main>
    </div>
  );
}
