"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { FlaskConical, AlertTriangle, Loader2, Info, Search } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";
import { convertVolume } from "lib";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/hooks/useDateFormat";

const rackingSchema = z.object({
  destinationVesselId: z.string().min(1, "Please select a destination vessel"),
  volumeToRack: z.number().positive("Volume to rack must be positive"),
  loss: z.number().min(0, "Loss cannot be negative").optional(),
  rackedAt: z.date(),
  notes: z.string().optional(),
});

type RackingForm = z.infer<typeof rackingSchema>;

interface RackingModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  sourceVesselId: string;
  sourceVesselName: string;
  currentVolumeL: number;
  sourceVesselCapacityUnit: "L" | "gal";
}

export function RackingModal({
  open,
  onClose,
  batchId,
  batchName,
  sourceVesselId,
  sourceVesselName,
  currentVolumeL,
  sourceVesselCapacityUnit,
}: RackingModalProps) {
  const utils = trpc.useUtils();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [remainingVolume, setRemainingVolume] = useState(0);
  const [isFullRack, setIsFullRack] = useState(false);
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  // Date validation
  const { validateDate } = useBatchDateValidation(batchId);
  const [selectedVesselHasBatch, setSelectedVesselHasBatch] = useState(false);
  const [selectedVesselBatchName, setSelectedVesselBatchName] = useState<string | null>(null);
  const [vesselSearchQuery, setVesselSearchQuery] = useState("");

  // Fetch all vessels (including source vessel for rack-to-self operations)
  const { data: vesselsData } = trpc.vessel.liquidMap.useQuery();
  const allVessels = Array.from(
    new Map(
      vesselsData?.vessels
        ?.filter((v) => v.vesselStatus === "available" || v.batchId)
        .map((v) => [v.vesselId, v])
    ).values()
  ) || [];

  // Filter vessels based on search query
  const availableVessels = allVessels.filter((vessel) =>
    vessel.vesselName?.toLowerCase().includes(vesselSearchQuery.toLowerCase()) ?? false
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<RackingForm>({
    resolver: zodResolver(rackingSchema),
    defaultValues: {
      rackedAt: new Date(),
      volumeToRack: undefined,
      loss: 0,
      notes: "",
    },
  });

  const volumeToRack = watch("volumeToRack");
  const loss = watch("loss");
  const destinationVesselId = watch("destinationVesselId");
  const rackedAt = watch("rackedAt");

  // Check if selected vessel has a batch (for merge warning)
  useEffect(() => {
    if (destinationVesselId && vesselsData) {
      const vesselMap = vesselsData.vessels.find(
        (v) => v.vesselId === destinationVesselId
      );
      if (vesselMap?.batchId) {
        setSelectedVesselHasBatch(true);
        setSelectedVesselBatchName(
          vesselMap.batchCustomName || vesselMap.batchNumber || "Unnamed Batch"
        );
      } else {
        setSelectedVesselHasBatch(false);
        setSelectedVesselBatchName(null);
      }
    }
  }, [destinationVesselId, vesselsData]);

  // Calculate remaining volume and determine if full rack
  useEffect(() => {
    if (volumeToRack !== undefined && volumeToRack > 0) {
      // Convert volumeToRack and loss to liters for calculation
      const toRackL = sourceVesselCapacityUnit === "gal"
        ? convertVolume(volumeToRack, "gal", "L")
        : volumeToRack;
      const lossL = sourceVesselCapacityUnit === "gal"
        ? convertVolume(loss || 0, "gal", "L")
        : (loss || 0);

      const remainingL = currentVolumeL - toRackL - lossL;
      setRemainingVolume(remainingL);

      // Auto-determine: if remaining < 1L, treat as full rack
      setIsFullRack(remainingL < 1.0);
    } else {
      setRemainingVolume(0);
      setIsFullRack(false);
    }
  }, [volumeToRack, loss, sourceVesselCapacityUnit, currentVolumeL]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
      setRemainingVolume(0);
      setIsFullRack(false);
      setVesselSearchQuery("");
    } else {
      // Set initial volume to rack as current volume
      const initialVolume = sourceVesselCapacityUnit === "gal"
        ? convertVolume(currentVolumeL, "L", "gal")
        : currentVolumeL;
      setValue("volumeToRack", initialVolume);
      setValue("rackedAt", new Date());
    }
  }, [open, reset, setValue, currentVolumeL, sourceVesselCapacityUnit]);

  const rackBatchMutation = trpc.batch.rackBatch.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Batch Racked Successfully",
        description: data.message,
      });
      // Await invalidations to ensure data is refetched before closing modal
      await Promise.all([
        utils.vessel.list.invalidate(),
        utils.vessel.liquidMap.invalidate(),
        utils.batch.list.invalidate(),
      ]);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Racking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RackingForm) => {
    // Convert volumeToRack and loss to liters for backend
    const volumeToRackL = sourceVesselCapacityUnit === "gal"
      ? convertVolume(data.volumeToRack, "gal", "L")
      : data.volumeToRack;
    const lossL = sourceVesselCapacityUnit === "gal"
      ? convertVolume(data.loss || 0, "gal", "L")
      : (data.loss || 0);

    rackBatchMutation.mutate({
      batchId,
      destinationVesselId: data.destinationVesselId,
      volumeToRack: volumeToRackL,
      loss: lossL,
      rackedAt: data.rackedAt,
      notes: data.notes,
    });
  };

  const selectedVessel = availableVessels.find((v) => v.vesselId === destinationVesselId);
  const isRackToSelf = destinationVesselId === sourceVesselId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            {isRackToSelf ? "Rack to Self" : "Rack Batch"}
          </DialogTitle>
          <DialogDescription>
            {isRackToSelf
              ? `Rack ${batchName} to itself in ${sourceVesselName} (removes sediment, records volume loss)`
              : `Transfer ${batchName} from ${sourceVesselName} to another vessel`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Volume Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Current Volume</p>
            <p className="text-2xl font-bold text-blue-700">
              {sourceVesselCapacityUnit === "gal"
                ? `${(currentVolumeL / 3.78541).toFixed(1)} gal`
                : `${currentVolumeL.toFixed(1)} L`
              }
            </p>
            <p className="text-sm text-blue-600">
              {sourceVesselCapacityUnit === "gal"
                ? `(${currentVolumeL.toFixed(1)} L)`
                : `(${(currentVolumeL / 3.78541).toFixed(1)} gal)`
              }
            </p>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="rackedAt">
              Racking Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={rackedAt ? formatDateTimeForInput(rackedAt) : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const dateValue = parseDateTimeFromInput(e.target.value);
                  setValue("rackedAt", dateValue);
                  const result = validateDate(dateValue);
                  setDateWarning(result.warning);
                }
              }}
              className="w-full"
            />
            <DateWarning warning={dateWarning} />
            {errors.rackedAt && (
              <p className="text-sm text-red-500">{errors.rackedAt.message}</p>
            )}
          </div>

          {/* Destination Vessel Selection */}
          <div className="space-y-2">
            <Label htmlFor="destinationVesselId">
              Destination Vessel <span className="text-red-500">*</span>
            </Label>
            <Select
              value={destinationVesselId}
              onValueChange={(value) => setValue("destinationVesselId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a vessel" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {/* Search Input */}
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

                {/* Vessel List */}
                <div className="overflow-y-auto max-h-[300px]">
                  {availableVessels.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      {vesselSearchQuery ? "No vessels match your search" : "No available vessels"}
                    </div>
                  ) : (
                    availableVessels.map((vessel) => {
                      const hasBatch = !!vessel.batchId;
                      const isEmpty = vessel.vesselStatus === "available" && !vessel.batchId;
                      const isCurrentVessel = vessel.vesselId === sourceVesselId;

                      return (
                        <SelectItem key={vessel.vesselId} value={vessel.vesselId}>
                          <div className="flex items-center gap-2">
                            <span>{vessel.vesselName} ({vessel.vesselCapacity} {vessel.vesselCapacityUnit})</span>
                            {isCurrentVessel && (
                              <Badge variant="default" className="text-xs">
                                Current
                              </Badge>
                            )}
                            {hasBatch && !isCurrentVessel && (
                              <Badge variant="secondary" className="text-xs">
                                In Use
                              </Badge>
                            )}
                            {isEmpty && (
                              <Badge variant="outline" className="text-xs">
                                Empty
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </div>
              </SelectContent>
            </Select>
            {errors.destinationVesselId && (
              <p className="text-sm text-red-500">{errors.destinationVesselId.message}</p>
            )}

            {/* Show rack-to-self info or batch merge warning */}
            {isRackToSelf && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-800">
                    <p className="font-medium">
                      Rack to Self Operation
                    </p>
                    <p className="text-xs mt-1">
                      This removes sediment and records volume loss without changing vessels
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!isRackToSelf && selectedVesselHasBatch && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">
                      This vessel contains an active batch
                    </p>
                    <p className="text-xs mt-1">
                      Batches will be merged: <span className="font-semibold">{selectedVesselBatchName}</span> + {batchName}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Volume to Rack */}
          <div className="space-y-2">
            <Label htmlFor="volumeToRack">
              Volume to Rack ({sourceVesselCapacityUnit}) <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-gray-500">
              Amount to transfer to destination vessel
            </p>
            <Input
              type="number"
              step="0.01"
              value={volumeToRack || ""}
              onChange={(e) => setValue("volumeToRack", parseFloat(e.target.value) || 0)}
              placeholder={`Enter volume in ${sourceVesselCapacityUnit}`}
              className="w-full"
            />
            {errors.volumeToRack && (
              <p className="text-sm text-red-500">{errors.volumeToRack.message}</p>
            )}
          </div>

          {/* Loss (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="loss">
              Loss ({sourceVesselCapacityUnit})
            </Label>
            <p className="text-xs text-gray-500">
              Optional: sediment or spillage left behind
            </p>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={loss || ""}
              onChange={(e) => setValue("loss", parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full"
            />
            {errors.loss && (
              <p className="text-sm text-red-500">{errors.loss.message}</p>
            )}
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              {...register("notes")}
              placeholder="Optional notes about this racking operation..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Remaining Volume & Rack Type Display */}
          {volumeToRack && volumeToRack > 0 && (
            <div className={`p-4 rounded-lg border ${
              isFullRack
                ? "bg-purple-50 border-purple-200"
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {isFullRack ? "Full Rack" : "Partial Rack"}
                  </span>
                  <Badge variant={isFullRack ? "default" : "secondary"}>
                    {isFullRack ? "Entire Batch" : "Split Batch"}
                  </Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p>
                    <span className="text-gray-600">Remaining in source:</span>{" "}
                    <span className="font-medium">
                      {sourceVesselCapacityUnit === "gal"
                        ? `${(remainingVolume / 3.78541).toFixed(2)} gal`
                        : `${remainingVolume.toFixed(2)} L`
                      }
                    </span>
                  </p>
                  {isFullRack && remainingVolume > 0 && (
                    <p className="text-purple-700">
                      ℹ️ Remainder &lt; 1L will be treated as loss
                    </p>
                  )}
                  {!isFullRack && (
                    <p className="text-blue-700">
                      ℹ️ Remaining volume will stay in source vessel
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Capacity Check (only for different vessels) */}
          {!isRackToSelf && selectedVessel && volumeToRack && (
            <div className={`p-3 rounded-lg ${
              volumeToRack > parseFloat(selectedVessel.vesselCapacity || "0")
                ? "bg-red-50 border border-red-200"
                : "bg-green-50 border border-green-200"
            }`}>
              <p className="text-sm font-medium">
                {volumeToRack > parseFloat(selectedVessel.vesselCapacity || "0")
                  ? "⚠️ Volume exceeds vessel capacity!"
                  : "✓ Volume fits in vessel"}
              </p>
              <p className="text-xs mt-1">
                Vessel capacity: {selectedVessel.vesselCapacity} {selectedVessel.vesselCapacityUnit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={rackBatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={rackBatchMutation.isPending || !destinationVesselId}
            >
              {rackBatchMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Rack Batch
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
