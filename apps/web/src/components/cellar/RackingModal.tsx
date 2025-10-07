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
import { FlaskConical, AlertTriangle, Loader2 } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";
import { convertVolume } from "lib";

const rackingSchema = z.object({
  destinationVesselId: z.string().min(1, "Please select a destination vessel"),
  volumeAfter: z.number().positive("Volume must be positive"),
  volumeAfterUnit: z.enum(["L", "gal"]),
  volumeLoss: z.number().min(0, "Volume loss cannot be negative"),
  volumeLossUnit: z.enum(["L", "gal"]),
  reason: z.string().optional(),
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
  const [showLossWarning, setShowLossWarning] = useState(false);
  const [lossPercentage, setLossPercentage] = useState(0);

  // Fetch available vessels
  const { data: vesselsData } = trpc.vessel.liquidMap.useQuery();
  const availableVessels = vesselsData?.vessels?.filter(
    (v) => v.vesselStatus === "available" && v.vesselId !== sourceVesselId
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
      volumeLossUnit: "L",
      volumeLoss: 0,
    },
  });

  const volumeAfter = watch("volumeAfter");
  const volumeAfterUnit = watch("volumeAfterUnit");
  const volumeLoss = watch("volumeLoss");
  const volumeLossUnit = watch("volumeLossUnit");
  const destinationVesselId = watch("destinationVesselId");

  // Calculate loss whenever volumes change
  useEffect(() => {
    if (volumeAfter !== undefined && volumeLoss !== undefined) {
      // Convert both to liters for calculation
      const afterL = volumeAfterUnit === "gal"
        ? convertVolume(volumeAfter, "gal", "L")
        : volumeAfter;
      const lossL = volumeLossUnit === "gal"
        ? convertVolume(volumeLoss, "gal", "L")
        : volumeLoss;

      const expectedAfter = currentVolumeL - lossL;
      const lossPercent = (lossL / currentVolumeL) * 100;

      setLossPercentage(lossPercent);
      setShowLossWarning(lossPercent > 10); // Warn if loss > 10%

      // Auto-calculate volumeAfter if only loss is entered
      if (volumeLoss > 0 && !volumeAfter) {
        setValue("volumeAfter", expectedAfter);
      }
    }
  }, [volumeAfter, volumeAfterUnit, volumeLoss, volumeLossUnit, currentVolumeL, setValue]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
      setShowLossWarning(false);
      setLossPercentage(0);
    } else {
      // Set initial volume to current volume
      setValue("volumeAfter", currentVolumeL);
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
                  availableVessels.map((vessel) => (
                    <SelectItem key={vessel.vesselId} value={vessel.vesselId}>
                      {vessel.vesselName} ({vessel.vesselCapacity} {vessel.vesselCapacityUnit})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.destinationVesselId && (
              <p className="text-sm text-red-500">{errors.destinationVesselId.message}</p>
            )}
          </div>

          {/* Volume Loss */}
          <div className="space-y-2">
            <Label htmlFor="volumeLoss">
              Volume Loss (Lees/Sediment)
            </Label>
            <VolumeInput
              value={volumeLoss || 0}
              unit={volumeLossUnit}
              onValueChange={(value) => setValue("volumeLoss", value || 0)}
              onUnitChange={(unit) => {
                if (unit === "L" || unit === "gal") {
                  setValue("volumeLossUnit", unit);
                }
              }}
              placeholder="Enter volume lost to lees"
            />
            {showLossWarning && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">High volume loss detected</p>
                  <p>Loss of {lossPercentage.toFixed(1)}% is higher than typical (5-10%). Please verify.</p>
                </div>
              </div>
            )}
            {errors.volumeLoss && (
              <p className="text-sm text-red-500">{errors.volumeLoss.message}</p>
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
            <p className="text-xs text-gray-500">
              Expected: {(currentVolumeL - (volumeLossUnit === "gal" ? volumeLoss * 3.78541 : volumeLoss || 0)).toFixed(1)} L
            </p>
            {errors.volumeAfter && (
              <p className="text-sm text-red-500">{errors.volumeAfter.message}</p>
            )}
          </div>

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

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select
              value={watch("reason")}
              onValueChange={(value) => setValue("reason", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary_to_secondary">Primary to Secondary Fermentation</SelectItem>
                <SelectItem value="aging_transfer">Aging Transfer</SelectItem>
                <SelectItem value="clarification">Clarification</SelectItem>
                <SelectItem value="vessel_maintenance">Vessel Maintenance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              {...register("notes")}
              placeholder="Any additional notes about this racking operation"
              rows={3}
            />
          </div>

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
