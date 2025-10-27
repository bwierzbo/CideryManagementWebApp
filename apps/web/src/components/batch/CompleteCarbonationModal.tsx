"use client";

import React, { useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Gauge,
  Thermometer,
} from "lucide-react";
import { calculateCO2Volumes } from "lib";

const completeCarbonationSchema = z
  .object({
    finalPressure: z
      .number()
      .min(0, "Pressure must be at least 0 PSI")
      .max(50, "Pressure must be at most 50 PSI"),
    finalTemperature: z
      .number()
      .min(-5, "Temperature must be at least -5°C")
      .max(25, "Temperature must be at most 25°C"),
    finalCo2Volumes: z
      .number()
      .min(0, "CO2 volumes cannot be negative")
      .max(5, "CO2 volumes must be at most 5"),
    finalVolume: z
      .number()
      .positive("Final volume must be positive")
      .optional()
      .nullable(),
    finalVolumeUnit: z.enum(["L", "gal"]).optional(),
    qualityCheck: z.enum(["pass", "fail", "needs_adjustment"]),
    qualityNotes: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      // Quality notes required if quality is not 'pass'
      if (data.qualityCheck !== "pass" && !data.qualityNotes) {
        return false;
      }
      return true;
    },
    {
      message: "Quality notes are required when quality check is not 'pass'",
      path: ["qualityNotes"],
    },
  );

type CompleteCarbonationForm = z.infer<typeof completeCarbonationSchema>;

interface CompleteCarbonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carbonationOperation: {
    id: string;
    batchId: string;
    batchName: string;
    vesselName: string;
    startedAt: Date;
    targetCO2Volumes: number;
    pressureApplied: number;
    startingVolume: number;
    startingVolumeUnit: string;
    startingTemperature?: number | null;
  };
  onSuccess?: () => void;
}

export function CompleteCarbonationModal({
  open,
  onOpenChange,
  carbonationOperation,
  onSuccess,
}: CompleteCarbonationModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CompleteCarbonationForm>({
    resolver: zodResolver(completeCarbonationSchema),
    defaultValues: {
      finalPressure: carbonationOperation.pressureApplied,
      finalTemperature: carbonationOperation.startingTemperature ?? 4,
      finalVolume: carbonationOperation.startingVolume,
      finalVolumeUnit: carbonationOperation.startingVolumeUnit as "L" | "gal",
      qualityCheck: "pass",
    },
  });

  const finalPressure = watch("finalPressure");
  const finalTemperature = watch("finalTemperature");
  const finalCo2Volumes = watch("finalCo2Volumes");
  const qualityCheck = watch("qualityCheck");
  const finalVolume = watch("finalVolume");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        finalPressure: carbonationOperation.pressureApplied,
        finalTemperature: carbonationOperation.startingTemperature ?? 4,
        finalVolume: carbonationOperation.startingVolume,
        finalVolumeUnit: carbonationOperation.startingVolumeUnit as "L" | "gal",
        qualityCheck: "pass",
      });
    }
  }, [
    open,
    reset,
    carbonationOperation.pressureApplied,
    carbonationOperation.startingTemperature,
    carbonationOperation.startingVolume,
    carbonationOperation.startingVolumeUnit,
  ]);

  // Auto-calculate CO2 volumes from pressure + temperature
  const calculatedCo2Volumes = useMemo(() => {
    if (finalPressure != null && finalTemperature != null) {
      return calculateCO2Volumes(finalPressure, finalTemperature);
    }
    return null;
  }, [finalPressure, finalTemperature]);

  // Auto-fill finalCo2Volumes if not manually entered
  useEffect(() => {
    if (calculatedCo2Volumes !== null && !finalCo2Volumes) {
      setValue("finalCo2Volumes", calculatedCo2Volumes);
    }
  }, [calculatedCo2Volumes, finalCo2Volumes, setValue]);

  // Calculate time elapsed
  const timeElapsed = useMemo(() => {
    const now = new Date();
    const startTime = new Date(carbonationOperation.startedAt);
    const diffMs = now.getTime() - startTime.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return hours;
  }, [carbonationOperation.startedAt]);

  // Calculate CO2 delta and determine quality
  const co2Delta = useMemo(() => {
    if (finalCo2Volumes != null) {
      return finalCo2Volumes - carbonationOperation.targetCO2Volumes;
    }
    return null;
  }, [finalCo2Volumes, carbonationOperation.targetCO2Volumes]);

  const deltaStatus = useMemo(() => {
    if (co2Delta === null) return null;

    const absDelta = Math.abs(co2Delta);
    if (absDelta <= 0.2) {
      return { status: "excellent", color: "green", icon: CheckCircle2 };
    } else if (absDelta <= 0.5) {
      return { status: "acceptable", color: "yellow", icon: AlertCircle };
    } else {
      return { status: "off-target", color: "red", icon: XCircle };
    }
  }, [co2Delta]);

  // Suggest quality check based on delta
  const suggestedQuality = useMemo(() => {
    if (co2Delta === null) return null;

    const absDelta = Math.abs(co2Delta);
    if (absDelta <= 0.2) return "pass";
    if (absDelta <= 0.5) return "needs_adjustment";
    return "fail";
  }, [co2Delta]);

  // Auto-suggest quality check if not manually changed
  useEffect(() => {
    if (suggestedQuality && qualityCheck === "pass" && suggestedQuality !== "pass") {
      // Only auto-change if still on default 'pass'
      setValue("qualityCheck", suggestedQuality as "pass" | "fail" | "needs_adjustment");
    }
  }, [suggestedQuality, qualityCheck, setValue]);

  // Calculate volume loss
  const volumeLoss = useMemo(() => {
    if (finalVolume != null) {
      return carbonationOperation.startingVolume - finalVolume;
    }
    return null;
  }, [finalVolume, carbonationOperation.startingVolume]);

  const completeMutation = trpc.carbonation.complete.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Carbonation Completed",
        description: `Carbonation operation completed for ${carbonationOperation.batchName}`,
      });

      // Invalidate relevant queries
      utils.batch.list.invalidate();
      utils.batch.get.invalidate({ batchId: carbonationOperation.batchId });
      utils.carbonation.listActive.invalidate();
      utils.vessel.liquidMap.invalidate();

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Completion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompleteCarbonationForm) => {
    completeMutation.mutate({
      carbonationId: carbonationOperation.id,
      finalPressure: data.finalPressure,
      finalTemperature: data.finalTemperature,
      finalCo2Volumes: data.finalCo2Volumes,
      finalVolume: data.finalVolume ?? carbonationOperation.startingVolume,
      finalVolumeUnit: (data.finalVolumeUnit ?? carbonationOperation.startingVolumeUnit) as "L" | "gal",
      qualityCheck: data.qualityCheck,
      qualityNotes: data.qualityNotes,
      notes: data.notes,
    });
  };

  const DeltaIcon = deltaStatus?.icon || Minus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Carbonation Operation</DialogTitle>
          <DialogDescription>
            Record final measurements for {carbonationOperation.batchName} in{" "}
            {carbonationOperation.vesselName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Operation Info Section */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="font-semibold text-sm mb-2">Operation Details</div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Started:</span>{" "}
                <span className="font-medium">
                  {new Date(carbonationOperation.startedAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground">Time Elapsed:</span>{" "}
                <span className="font-medium">
                  {timeElapsed.toFixed(1)} hours (~
                  {(timeElapsed / 24).toFixed(1)} days)
                </span>
              </div>

              <div>
                <span className="text-muted-foreground">Target CO2:</span>{" "}
                <span className="font-medium">
                  {carbonationOperation.targetCO2Volumes} volumes
                </span>
              </div>

              <div>
                <span className="text-muted-foreground">Pressure Applied:</span>{" "}
                <span className="font-medium">
                  {carbonationOperation.pressureApplied} PSI
                </span>
              </div>

              {carbonationOperation.startingTemperature != null && (
                <div>
                  <span className="text-muted-foreground">Starting Temp:</span>{" "}
                  <span className="font-medium">
                    {carbonationOperation.startingTemperature}°C
                  </span>
                </div>
              )}

              <div>
                <span className="text-muted-foreground">Starting Volume:</span>{" "}
                <span className="font-medium">
                  {carbonationOperation.startingVolume}{" "}
                  {carbonationOperation.startingVolumeUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Final Measurements */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Final Measurements</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="finalPressure">
                  Final Pressure (PSI) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="finalPressure"
                    type="number"
                    step="0.1"
                    {...register("finalPressure", { valueAsNumber: true })}
                  />
                </div>
                {errors.finalPressure && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.finalPressure.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="finalTemperature">
                  Final Temperature (°C) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="finalTemperature"
                    type="number"
                    step="0.1"
                    {...register("finalTemperature", { valueAsNumber: true })}
                  />
                </div>
                {errors.finalTemperature && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.finalTemperature.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="finalCo2Volumes">
                  Final CO2 Volumes <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="finalCo2Volumes"
                  type="number"
                  step="0.01"
                  placeholder={calculatedCo2Volumes?.toFixed(2) || ""}
                  {...register("finalCo2Volumes", { valueAsNumber: true })}
                />
                {errors.finalCo2Volumes && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.finalCo2Volumes.message}
                  </p>
                )}
                {calculatedCo2Volumes !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated: {calculatedCo2Volumes.toFixed(2)} volumes
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="finalVolume">
                  Final Volume{" "}
                  <span className="text-muted-foreground text-xs">optional</span>
                </Label>
                <Input
                  id="finalVolume"
                  type="number"
                  step="0.1"
                  {...register("finalVolume", { valueAsNumber: true })}
                />
                {volumeLoss !== null && volumeLoss > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Loss: {volumeLoss.toFixed(1)}{" "}
                    {carbonationOperation.startingVolumeUnit} (
                    {((volumeLoss / carbonationOperation.startingVolume) * 100).toFixed(1)}
                    %)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Section */}
          {co2Delta !== null && deltaStatus && (
            <div
              className={`rounded-lg border-2 p-4 ${
                deltaStatus.color === "green"
                  ? "bg-green-50 border-green-200"
                  : deltaStatus.color === "yellow"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <DeltaIcon
                  className={`h-5 w-5 ${
                    deltaStatus.color === "green"
                      ? "text-green-700"
                      : deltaStatus.color === "yellow"
                        ? "text-yellow-700"
                        : "text-red-700"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    deltaStatus.color === "green"
                      ? "text-green-900"
                      : deltaStatus.color === "yellow"
                        ? "text-yellow-900"
                        : "text-red-900"
                  }`}
                >
                  Carbonation Assessment
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div
                    className={`text-xs ${
                      deltaStatus.color === "green"
                        ? "text-green-700"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-700"
                          : "text-red-700"
                    }`}
                  >
                    Target
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      deltaStatus.color === "green"
                        ? "text-green-900"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-900"
                          : "text-red-900"
                    }`}
                  >
                    {carbonationOperation.targetCO2Volumes.toFixed(2)} vol
                  </div>
                </div>

                <div>
                  <div
                    className={`text-xs ${
                      deltaStatus.color === "green"
                        ? "text-green-700"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-700"
                          : "text-red-700"
                    }`}
                  >
                    Actual
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      deltaStatus.color === "green"
                        ? "text-green-900"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-900"
                          : "text-red-900"
                    }`}
                  >
                    {finalCo2Volumes.toFixed(2)} vol
                  </div>
                </div>

                <div>
                  <div
                    className={`text-xs ${
                      deltaStatus.color === "green"
                        ? "text-green-700"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-700"
                          : "text-red-700"
                    }`}
                  >
                    Delta
                  </div>
                  <div
                    className={`text-lg font-bold flex items-center gap-1 ${
                      deltaStatus.color === "green"
                        ? "text-green-900"
                        : deltaStatus.color === "yellow"
                          ? "text-yellow-900"
                          : "text-red-900"
                    }`}
                  >
                    {co2Delta > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : co2Delta < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                    {co2Delta >= 0 ? "+" : ""}
                    {co2Delta.toFixed(2)} vol
                  </div>
                </div>
              </div>

              <div
                className={`mt-3 text-sm ${
                  deltaStatus.color === "green"
                    ? "text-green-900"
                    : deltaStatus.color === "yellow"
                      ? "text-yellow-900"
                      : "text-red-900"
                }`}
              >
                {deltaStatus.status === "excellent" && (
                  <p>
                    ✓ Excellent! Carbonation is within ±0.2 volumes of target.
                  </p>
                )}
                {deltaStatus.status === "acceptable" && (
                  <p>
                    ⚠ Acceptable range. Carbonation is within ±0.5 volumes of target.
                  </p>
                )}
                {deltaStatus.status === "off-target" && (
                  <p>
                    ✗ Off target. Carbonation is more than ±0.5 volumes from target.
                    Consider adjusting process for future batches.
                  </p>
                )}
              </div>

              {suggestedQuality && suggestedQuality !== qualityCheck && (
                <div
                  className={`mt-2 flex items-start gap-2 text-sm ${
                    deltaStatus.color === "green"
                      ? "text-green-800"
                      : deltaStatus.color === "yellow"
                        ? "text-yellow-800"
                        : "text-red-800"
                  }`}
                >
                  <Info className="h-4 w-4 mt-0.5" />
                  <span>
                    Suggested quality check:{" "}
                    <strong className="capitalize">{suggestedQuality}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quality Assessment */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Quality Assessment</h3>

            <div>
              <Label htmlFor="qualityCheck">
                Quality Check <span className="text-destructive">*</span>
              </Label>
              <Select
                value={qualityCheck}
                onValueChange={(value) =>
                  setValue(
                    "qualityCheck",
                    value as "pass" | "fail" | "needs_adjustment",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Pass - Target achieved
                    </div>
                  </SelectItem>
                  <SelectItem value="needs_adjustment">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      Needs Adjustment - Close but off target
                    </div>
                  </SelectItem>
                  <SelectItem value="fail">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Fail - Did not carbonate properly
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="qualityNotes">
                Quality Notes
                {qualityCheck !== "pass" && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Textarea
                id="qualityNotes"
                placeholder={
                  qualityCheck !== "pass"
                    ? "Explain why quality check did not pass..."
                    : "Any observations about the carbonation quality..."
                }
                rows={3}
                {...register("qualityNotes")}
              />
              {errors.qualityNotes && (
                <p className="text-sm text-destructive mt-1">
                  {errors.qualityNotes.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">
                General Notes{" "}
                <span className="text-muted-foreground text-xs">optional</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this carbonation operation..."
                rows={2}
                {...register("notes")}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={completeMutation.isPending}>
              {completeMutation.isPending
                ? "Completing..."
                : "Complete Carbonation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
