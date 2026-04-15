"use client";

import React, { useState } from "react";
import { useDateFormat } from "@/hooks/useDateFormat";
import { trpc } from "@/utils/trpc";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  formatVolume,
  VolumeUnit,
  convertVolume,
} from "lib";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { VolumeDisplay } from "@/components/ui/volume-input";
import { WorkerLaborInput, type WorkerAssignment, toApiLaborAssignments } from "@/components/labor/WorkerLaborInput";

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

export function TankTransferForm({
  fromVesselId,
  onClose,
}: {
  fromVesselId: string;
  onClose: () => void;
}) {
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [showBlendConfirm, setShowBlendConfirm] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
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
  const [laborAssignments, setLaborAssignments] = useState<WorkerAssignment[]>([]);
  const [lossType, setLossType] = useState<string>("sediment");

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

  // Get available destination vessels (include source vessel for rack-to-self)
  const availableVessels =
    vesselListQuery.data?.vessels?.filter(
      (vessel) => vessel.status === "available",
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
      setTransferError(null);
      onClose();
      toast({
        title: "Transfer successful",
        description: result.message || "Liquid transferred successfully",
      });
    },
    onError: (error) => {
      setShowBlendConfirm(false);
      setTransferError(error.message);
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
    const validLabor = laborAssignments.filter(a => a.workerId && a.hoursWorked > 0);
    transferMutation.mutate({
      ...data,
      volumeL: volumeInLiters,
      loss: lossInLiters,
      lossType: lossInLiters > 0 ? lossType as any : undefined,
      transferDate: data.transferDate,
      ...(validLabor.length > 0 && {
        laborAssignments: toApiLaborAssignments(validLabor),
      }),
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
          value={transferDate ? formatDateTimeForInput(transferDate as Date) : ''}
          onChange={(e) => {
            if (e.target.value) {
              setValue("transferDate", parseDateTimeFromInput(e.target.value));
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
        {destMaxCapacityL > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Available space: {formatVolume(
              convertVolume(Math.max(0, destMaxCapacityL - destCurrentVolumeL), "L", destCapacityUnit),
              destCapacityUnit
            )} {destCapacityUnit}
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

      {/* Loss type selector — shown when loss > 0 */}
      {watchedLoss > 0 && (
        <div>
          <Label>Loss Type</Label>
          <Select value={lossType} onValueChange={setLossType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sediment">Sediment / Lees</SelectItem>
              <SelectItem value="spillage">Spillage</SelectItem>
              <SelectItem value="evaporation">Evaporation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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

      {/* Labor Tracking */}
      <WorkerLaborInput
        value={laborAssignments}
        onChange={setLaborAssignments}
        activityLabel="this transfer"
      />

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          placeholder="Transfer notes..."
          {...register("notes")}
        />
      </div>

      {/* Inline error from failed submission */}
      {transferError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {transferError}
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            !isVolumeValid || !watchedVolumeL || watchedVolumeL <= 0 || wouldExceedMaxCapacity
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
