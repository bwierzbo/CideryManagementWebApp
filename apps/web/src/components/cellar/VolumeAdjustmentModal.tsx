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
import { Scale, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";
import { convertVolume } from "lib";
import { useDateFormat } from "@/hooks/useDateFormat";

const ADJUSTMENT_TYPES = [
  { value: "evaporation", label: "Evaporation", description: "Natural evaporation (angel's share)" },
  { value: "measurement_error", label: "Measurement Error", description: "Physical count differs from calculated" },
  { value: "sampling", label: "Sampling", description: "Volume removed for testing/QC" },
  { value: "contamination", label: "Contamination", description: "Loss due to contamination" },
  { value: "spillage", label: "Spillage", description: "Accidental spillage" },
  { value: "theft", label: "Theft", description: "Suspected theft" },
  { value: "sediment", label: "Sediment/Lees", description: "Loss from lees or sediment during racking/settling" },
  { value: "correction_up", label: "Correction (Increase)", description: "Undercount correction - increases volume" },
  { value: "correction_down", label: "Correction (Decrease)", description: "Overcount correction - decreases volume" },
  { value: "other", label: "Other", description: "Other reason - requires detailed notes" },
] as const;

type AdjustmentType = typeof ADJUSTMENT_TYPES[number]["value"];

const volumeAdjustmentSchema = z.object({
  adjustmentDate: z.date(),
  adjustmentType: z.enum([
    "evaporation",
    "measurement_error",
    "sampling",
    "contamination",
    "spillage",
    "theft",
    "sediment",
    "correction_up",
    "correction_down",
    "other",
  ]),
  volumeAfter: z.number().min(0, "Volume cannot be negative"),
  volumeAfterUnit: z.enum(["L", "gal"]),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

type VolumeAdjustmentForm = z.infer<typeof volumeAdjustmentSchema>;

interface VolumeAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  currentVolumeL: number;
  vesselId?: string;
  vesselName?: string;
  reconciliationSnapshotId?: string;
}

export function VolumeAdjustmentModal({
  open,
  onClose,
  batchId,
  batchName,
  currentVolumeL,
  vesselId,
  vesselName,
  reconciliationSnapshotId,
}: VolumeAdjustmentModalProps) {
  const utils = trpc.useUtils();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [showWarning, setShowWarning] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  // Date validation
  const { validateDate } = useBatchDateValidation(batchId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<VolumeAdjustmentForm>({
    resolver: zodResolver(volumeAdjustmentSchema),
    defaultValues: {
      adjustmentDate: new Date(),
      volumeAfter: currentVolumeL,
      volumeAfterUnit: "L",
      reason: "",
      notes: "",
    },
  });

  const adjustmentType = watch("adjustmentType");
  const volumeAfter = watch("volumeAfter");
  const volumeAfterUnit = watch("volumeAfterUnit");
  const adjustmentDate = watch("adjustmentDate");

  // Calculate adjustment whenever volume changes
  useEffect(() => {
    if (volumeAfter !== undefined && volumeAfter !== null) {
      // Convert to liters if needed
      const afterL = volumeAfterUnit === "gal"
        ? convertVolume(volumeAfter, "gal", "L")
        : volumeAfter;

      const amount = afterL - currentVolumeL;
      const percentage = currentVolumeL > 0 ? (Math.abs(amount) / currentVolumeL) * 100 : 0;

      setAdjustmentAmount(amount);
      setAdjustmentPercentage(percentage);

      // Show warning if adjustment > 10%
      setShowWarning(percentage > 10);
    }
  }, [volumeAfter, volumeAfterUnit, currentVolumeL]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      reset({
        adjustmentDate: new Date(),
        volumeAfter: currentVolumeL,
        volumeAfterUnit: "L",
        reason: "",
        notes: "",
      });
      setDateWarning(null);
    }
  }, [open, currentVolumeL, reset]);

  // Auto-set adjustment type based on direction
  useEffect(() => {
    if (adjustmentAmount !== 0 && !adjustmentType) {
      // Don't auto-set if user hasn't selected yet and we need them to choose
    }
  }, [adjustmentAmount, adjustmentType]);

  const createMutation = trpc.batch.createVolumeAdjustment.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Volume Adjustment Recorded",
        description: data.message,
      });
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      utils.batch.getActivityHistory.invalidate();
      utils.batch.list.invalidate();
      utils.batch.listVolumeAdjustments.invalidate();
      onClose();
      reset();
    },
    onError: (error) => {
      toast({
        title: "Volume Adjustment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VolumeAdjustmentForm) => {
    // Convert volume to liters
    const volumeAfterL = data.volumeAfterUnit === "gal"
      ? convertVolume(data.volumeAfter, "gal", "L")
      : data.volumeAfter;

    // Validate adjustment type matches direction
    const isIncrease = volumeAfterL > currentVolumeL;
    const isDecrease = volumeAfterL < currentVolumeL;

    if (isIncrease && data.adjustmentType !== "correction_up" && data.adjustmentType !== "measurement_error" && data.adjustmentType !== "other") {
      toast({
        title: "Invalid Adjustment Type",
        description: "For volume increases, use 'Correction (Increase)', 'Measurement Error', or 'Other'",
        variant: "destructive",
      });
      return;
    }

    if (isDecrease && data.adjustmentType === "correction_up") {
      toast({
        title: "Invalid Adjustment Type",
        description: "'Correction (Increase)' cannot be used for volume decreases",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      batchId,
      adjustmentDate: data.adjustmentDate,
      adjustmentType: data.adjustmentType,
      volumeAfter: volumeAfterL,
      reason: data.reason,
      notes: data.notes || undefined,
      reconciliationSnapshotId,
    });
  };

  const selectedTypeInfo = ADJUSTMENT_TYPES.find(t => t.value === adjustmentType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Adjust Volume - {batchName}
          </DialogTitle>
          <DialogDescription>
            Record a physical inventory correction for this batch
            {vesselName && <span className="block text-xs mt-1">Vessel: {vesselName}</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Adjustment Date */}
          <div>
            <Label htmlFor="adjustmentDate">
              Adjustment Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={adjustmentDate ? formatDateTimeForInput(adjustmentDate) : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const dateValue = parseDateTimeFromInput(e.target.value);
                  setValue("adjustmentDate", dateValue);
                  const result = validateDate(dateValue);
                  setDateWarning(result.warning);
                }
              }}
              className="w-full mt-1"
            />
            <DateWarning warning={dateWarning} />
            {errors.adjustmentDate && (
              <p className="text-sm text-red-600 mt-1">
                {errors.adjustmentDate.message}
              </p>
            )}
          </div>

          {/* Current Volume (read-only) */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Current Volume:</span>
              <span className="text-lg font-semibold">
                {currentVolumeL.toFixed(1)}L
                <span className="text-sm text-gray-500 ml-2">
                  ({convertVolume(currentVolumeL, "L", "gal").toFixed(2)} gal)
                </span>
              </span>
            </div>
          </div>

          {/* New Physical Volume */}
          <div>
            <Label htmlFor="volumeAfter">
              New Physical Volume <span className="text-red-500">*</span>
            </Label>
            <VolumeInput
              id="volumeAfter"
              value={volumeAfter}
              unit={volumeAfterUnit as VolumeUnit}
              onValueChange={(value) => setValue("volumeAfter", value || 0)}
              onUnitChange={(unit) => setValue("volumeAfterUnit", unit as "L" | "gal")}
              placeholder="Measured volume"
              className="mt-1"
              required
            />
            {errors.volumeAfter && (
              <p className="text-sm text-red-600 mt-1">
                {errors.volumeAfter.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Enter the actual physical measurement from inventory count
            </p>
          </div>

          {/* Adjustment Type */}
          <div>
            <Label htmlFor="adjustmentType">
              Adjustment Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={adjustmentType}
              onValueChange={(value) => setValue("adjustmentType", value as AdjustmentType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select reason for adjustment" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.adjustmentType && (
              <p className="text-sm text-red-600 mt-1">
                {errors.adjustmentType.message}
              </p>
            )}
            {selectedTypeInfo && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedTypeInfo.description}
              </p>
            )}
          </div>

          {/* Reason (Required) */}
          <div>
            <Label htmlFor="reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register("reason")}
              placeholder="Brief explanation for this adjustment..."
              className="mt-1"
            />
            {errors.reason && (
              <p className="text-sm text-red-600 mt-1">
                {errors.reason.message}
              </p>
            )}
          </div>

          {/* Notes (Optional) */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              {...register("notes")}
              placeholder="Additional details about this adjustment..."
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          {/* Adjustment Summary */}
          {volumeAfter !== undefined && volumeAfter !== currentVolumeL && (
            <div className={`p-3 rounded-lg ${
              showWarning
                ? "bg-orange-50 border border-orange-200"
                : adjustmentAmount > 0
                  ? "bg-green-50 border border-green-200"
                  : "bg-blue-50 border border-blue-200"
            }`}>
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  {adjustmentAmount > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                  )}
                  <span className="font-medium">Adjustment Summary:</span>
                </div>
                <div className="flex justify-between pl-6">
                  <span>Change:</span>
                  <span className={`font-semibold ${
                    adjustmentAmount > 0 ? "text-green-700" : "text-blue-700"
                  }`}>
                    {adjustmentAmount >= 0 ? "+" : ""}{adjustmentAmount.toFixed(2)}L
                    ({adjustmentPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between pl-6 text-gray-600">
                  <span>New Volume:</span>
                  <span>
                    {(volumeAfterUnit === "gal"
                      ? convertVolume(volumeAfter, "gal", "L")
                      : volumeAfter
                    ).toFixed(2)}L
                  </span>
                </div>
                {showWarning && (
                  <div className="flex items-start gap-2 text-orange-700 mt-2 pl-6">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">
                      Large adjustment detected (&gt;10%). Please verify the measurement is correct.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {reconciliationSnapshotId && (
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs text-purple-700">
                This adjustment will be linked to the current TTB reconciliation
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                volumeAfter === undefined ||
                volumeAfter === currentVolumeL ||
                !adjustmentType
              }
            >
              {createMutation.isPending ? "Recording..." : "Record Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
