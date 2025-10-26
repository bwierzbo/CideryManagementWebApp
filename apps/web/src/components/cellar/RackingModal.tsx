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
import { FlaskConical, AlertTriangle, Loader2, Info } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";
import { convertVolume } from "lib";
import { Badge } from "@/components/ui/badge";

const rackingSchema = z.object({
  destinationVesselId: z.string().min(1, "Please select a destination vessel"),
  volumeAfter: z.number().positive("Volume must be positive"),
  volumeAfterUnit: z.enum(["L", "gal"]),
  rackedAt: z.date(),
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
}

export function RackingModal({
  open,
  onClose,
  batchId,
  batchName,
  sourceVesselId,
  sourceVesselName,
  currentVolumeL,
}: RackingModalProps) {
  const utils = trpc.useUtils();
  const [calculatedLoss, setCalculatedLoss] = useState(0);
  const [lossPercentage, setLossPercentage] = useState(0);
  const [selectedVesselHasBatch, setSelectedVesselHasBatch] = useState(false);
  const [selectedVesselBatchName, setSelectedVesselBatchName] = useState<string | null>(null);

  // Fetch all vessels (not just available ones, to allow merging)
  const { data: vesselsData } = trpc.vessel.liquidMap.useQuery();
  const availableVessels = Array.from(
    new Map(
      vesselsData?.vessels
        ?.filter((v) => v.vesselId !== sourceVesselId && (v.vesselStatus === "available" || v.batchId))
        .map((v) => [v.vesselId, v])
    ).values()
  ) || [];

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
      volumeAfterUnit: "L",
      rackedAt: new Date(),
    },
  });

  const volumeAfter = watch("volumeAfter");
  const volumeAfterUnit = watch("volumeAfterUnit");
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

  // Calculate loss whenever volumeAfter changes
  useEffect(() => {
    if (volumeAfter !== undefined) {
      // Convert volumeAfter to liters for calculation
      const afterL = volumeAfterUnit === "gal"
        ? convertVolume(volumeAfter, "gal", "L")
        : volumeAfter;

      const lossL = currentVolumeL - afterL;
      const lossPercent = (lossL / currentVolumeL) * 100;

      setCalculatedLoss(lossL);
      setLossPercentage(lossPercent);
    } else {
      setCalculatedLoss(0);
      setLossPercentage(0);
    }
  }, [volumeAfter, volumeAfterUnit, currentVolumeL]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
      setCalculatedLoss(0);
      setLossPercentage(0);
    } else {
      // Set initial volume to current volume (no loss)
      setValue("volumeAfter", currentVolumeL);
      setValue("rackedAt", new Date());
    }
  }, [open, reset, setValue, currentVolumeL]);

  const rackBatchMutation = trpc.batch.rackBatch.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Batch Racked Successfully",
        description: data.message,
      });
      utils.vessel.liquidMap.invalidate();
      utils.batch.list.invalidate();
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
    rackBatchMutation.mutate({
      batchId,
      ...data,
    });
  };

  const selectedVessel = availableVessels.find((v) => v.vesselId === destinationVesselId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            Rack Batch
          </DialogTitle>
          <DialogDescription>
            Transfer {batchName} from {sourceVesselName} to another vessel
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Volume Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Current Volume</p>
            <p className="text-2xl font-bold text-blue-700">
              {currentVolumeL.toFixed(1)} L
            </p>
            <p className="text-sm text-blue-600">
              {(currentVolumeL / 3.78541).toFixed(1)} gallons
            </p>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="rackedAt">
              Racking Date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={rackedAt ? rackedAt.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const dateValue = e.target.value;
                if (dateValue && !isNaN(new Date(dateValue).getTime())) {
                  setValue("rackedAt", new Date(dateValue));
                } else if (!dateValue) {
                  setValue("rackedAt", new Date());
                }
              }}
              className="w-full"
            />
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
              <SelectContent>
                {availableVessels.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No available vessels
                  </SelectItem>
                ) : (
                  availableVessels.map((vessel) => {
                    const hasBatch = !!vessel.batchId;
                    const isEmpty = vessel.vesselStatus === "available" && !vessel.batchId;

                    return (
                      <SelectItem key={vessel.vesselId} value={vessel.vesselId}>
                        <div className="flex items-center gap-2">
                          <span>{vessel.vesselName} ({vessel.vesselCapacity} {vessel.vesselCapacityUnit})</span>
                          {hasBatch && (
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
              </SelectContent>
            </Select>
            {errors.destinationVesselId && (
              <p className="text-sm text-red-500">{errors.destinationVesselId.message}</p>
            )}

            {/* Show batch merge warning if destination has a batch */}
            {selectedVesselHasBatch && (
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

          {/* Volume After Racking */}
          <div className="space-y-2">
            <Label htmlFor="volumeAfter">
              Volume After Racking <span className="text-red-500">*</span>
            </Label>
            <VolumeInput
              value={volumeAfter || 0}
              unit={volumeAfterUnit}
              onValueChange={(value) => setValue("volumeAfter", value || 0)}
              onUnitChange={(unit) => {
                if (unit === "L" || unit === "gal") {
                  setValue("volumeAfterUnit", unit);
                }
              }}
              placeholder="Enter volume after racking"
            />
            {errors.volumeAfter && (
              <p className="text-sm text-red-500">{errors.volumeAfter.message}</p>
            )}
          </div>

          {/* Calculated Volume Loss Display */}
          {volumeAfter !== undefined && calculatedLoss > 0 && (
            <div className={`p-4 rounded-lg border ${
              lossPercentage > 10
                ? "bg-amber-50 border-amber-200"
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex items-start gap-2">
                {lossPercentage > 10 && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Calculated Volume Loss: {calculatedLoss.toFixed(1)} L ({(calculatedLoss / 3.78541).toFixed(1)} gal)
                  </p>
                  <p className="text-xs mt-1">
                    Loss percentage: {lossPercentage.toFixed(1)}%
                  </p>
                  {lossPercentage > 10 && (
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ Loss is higher than typical (5-10%). Please verify your measurements.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Capacity Check */}
          {selectedVessel && volumeAfter && (
            <div className={`p-3 rounded-lg ${
              volumeAfter > parseFloat(selectedVessel.vesselCapacity || "0")
                ? "bg-red-50 border border-red-200"
                : "bg-green-50 border border-green-200"
            }`}>
              <p className="text-sm font-medium">
                {volumeAfter > parseFloat(selectedVessel.vesselCapacity || "0")
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
