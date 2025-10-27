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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import {
  Gauge,
  Thermometer,
  AlertTriangle,
  Info,
  Clock,
  Droplets,
  Beaker,
  CheckCircle2,
} from "lucide-react";
import {
  calculateCO2Volumes,
  calculateRequiredPressure,
  estimateCarbonationDuration,
  isPressureSafe,
  isTemperatureSafe,
  calculatePrimingSugar,
} from "lib";

// Carbonation preset options
const CARBONATION_PRESETS = [
  { value: "0.5", label: "Still (0.5 vol)" },
  { value: "1.8", label: "Petillant (1.8 vol)" },
  { value: "3.0", label: "Sparkling (3.0 vol)" },
  { value: "custom", label: "Custom" },
] as const;

// Schema for forced carbonation
const forcedCarbonationSchema = z.object({
  carbonationMethod: z.literal("forced"),
  startedAt: z.date(),
  startingVolume: z.number().positive("Starting volume must be positive"),
  startingVolumeUnit: z.enum(["L", "gal"]),
  startingTemperature: z
    .number()
    .min(-5, "Temperature must be at least -5°C")
    .max(25, "Temperature must be at most 25°C")
    .optional()
    .nullable(),
  startingCo2Volumes: z
    .number()
    .min(0, "CO2 volumes cannot be negative")
    .max(5, "CO2 volumes must be at most 5")
    .optional()
    .nullable(),
  targetCo2Volumes: z
    .number()
    .min(0.1, "Target must be at least 0.1 volumes")
    .max(5, "Target must be at most 5 volumes"),
  pressureApplied: z
    .number()
    .min(1, "Pressure must be at least 1 PSI")
    .max(50, "Pressure must be at most 50 PSI"),
  notes: z.string().optional(),
});

// Schema for bottle conditioning
const bottleConditioningSchema = z.object({
  carbonationMethod: z.literal("bottle_conditioning"),
  startedAt: z.date(),
  startingVolume: z.number().positive("Starting volume must be positive"),
  startingVolumeUnit: z.enum(["L", "gal"]),
  residualCo2Volumes: z
    .number()
    .min(0, "CO2 volumes cannot be negative")
    .max(5, "CO2 volumes must be at most 5")
    .optional()
    .nullable(),
  targetCo2Volumes: z
    .number()
    .min(0.1, "Target must be at least 0.1 volumes")
    .max(5, "Target must be at most 5 volumes"),
  sugarType: z.enum(["sucrose", "dextrose", "honey"]),
  additivePurchaseItemId: z.string().uuid("Please select a sugar source").optional(),
  notes: z.string().optional(),
});

// Union schema
const carbonationSchema = z.discriminatedUnion("carbonationMethod", [
  forcedCarbonationSchema,
  bottleConditioningSchema,
]);

type CarbonationForm = z.infer<typeof carbonationSchema>;

interface CarbonateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: {
    id: string;
    name: string;
    vesselId: string | null;
    currentVolume: number;
    currentVolumeUnit: string;
    status: string;
  };
  vessel: {
    id: string;
    name: string;
    isPressureVessel: "yes" | "no";
    maxPressure: number;
  } | null;
  onSuccess?: () => void;
}

export function CarbonateModal({
  open,
  onOpenChange,
  batch,
  vessel,
  onSuccess,
}: CarbonateModalProps) {
  const utils = trpc.useUtils();
  const [carbonationMethod, setCarbonationMethod] = React.useState<"forced" | "bottle_conditioning">("forced");
  const [presetSelection, setPresetSelection] = React.useState<string>("3.0");
  const [isCustomTarget, setIsCustomTarget] = React.useState(false);

  // Query for available sweetener additives (for bottle conditioning)
  const { data: sweetenerInventory, isLoading: isLoadingInventory } =
    trpc.additivePurchases.list.useQuery(
      {
        limit: 100,
        offset: 0,
      },
      { enabled: open && carbonationMethod === "bottle_conditioning" }
    );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CarbonationForm>({
    resolver: zodResolver(carbonationSchema),
    defaultValues: {
      carbonationMethod: "forced",
      startedAt: new Date(),
      startingVolume: batch.currentVolume,
      startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
      startingTemperature: 4, // Default to optimal carbonation temp
      targetCo2Volumes: 3.0, // Default to sparkling
      carbonationProcess: "headspace",
      pressureApplied: 0,
      sugarType: "sucrose",
      residualCo2Volumes: 0,
    } as any,
  });

  const watchedMethod = watch("carbonationMethod");
  const startingTemperature = watch("startingTemperature" as any);
  const targetCo2Volumes = watch("targetCo2Volumes");
  const pressureApplied = watch("pressureApplied" as any);
  const startingCo2Volumes = watch("startingCo2Volumes" as any);
  const sugarType = watch("sugarType" as any) || "sucrose"; // Default to sucrose for bottle conditioning
  const residualCo2Volumes = watch("residualCo2Volumes" as any) || 0;
  const startingVolume = watch("startingVolume");
  const startingVolumeUnit = watch("startingVolumeUnit");

  // Sync carbonation method state with form
  useEffect(() => {
    if (watchedMethod) {
      setCarbonationMethod(watchedMethod as "forced" | "bottle_conditioning");
    }
  }, [watchedMethod]);

  // Convert volume to liters for calculations
  const volumeInLiters = useMemo(() => {
    if (startingVolumeUnit === "gal") {
      return startingVolume * 3.78541; // gallons to liters
    }
    return startingVolume;
  }, [startingVolume, startingVolumeUnit]);

  // Calculate required priming sugar for bottle conditioning
  const requiredSugarGrams = useMemo(() => {
    if (carbonationMethod === "bottle_conditioning") {
      return calculatePrimingSugar(
        targetCo2Volumes,
        residualCo2Volumes,
        volumeInLiters,
        sugarType as "sucrose" | "dextrose" | "honey"
      );
    }
    return 0;
  }, [carbonationMethod, targetCo2Volumes, residualCo2Volumes, volumeInLiters, sugarType]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        carbonationMethod: "forced",
        startingVolume: batch.currentVolume,
        startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
        startingTemperature: 4,
        targetCo2Volumes: 3.0,
        carbonationProcess: "headspace",
        pressureApplied: 0,
        sugarType: "sucrose",
        residualCo2Volumes: 0,
      } as any);
      setPresetSelection("3.0");
      setIsCustomTarget(false);
      setCarbonationMethod("forced");
    }
  }, [open, reset, batch.currentVolume, batch.currentVolumeUnit]);

  // Handle preset selection
  const handlePresetChange = (value: string) => {
    setPresetSelection(value);
    if (value === "custom") {
      setIsCustomTarget(true);
    } else {
      setIsCustomTarget(false);
      setValue("targetCo2Volumes", parseFloat(value));
    }
  };

  // Calculate suggested pressure
  const suggestedPressure = useMemo(() => {
    if (targetCo2Volumes && startingTemperature != null) {
      return calculateRequiredPressure(targetCo2Volumes, startingTemperature);
    }
    return null;
  }, [targetCo2Volumes, startingTemperature]);

  // Calculate expected CO2 volumes from applied pressure
  const expectedCo2Volumes = useMemo(() => {
    if (pressureApplied && startingTemperature != null) {
      return calculateCO2Volumes(pressureApplied, startingTemperature);
    }
    return null;
  }, [pressureApplied, startingTemperature]);

  // Estimate carbonation duration
  const estimatedDuration = useMemo(() => {
    // Validate that values are actual numbers (not NaN or null/undefined)
    const isValidNumber = (val: any) => typeof val === 'number' && !isNaN(val) && val > 0;

    if (
      startingCo2Volumes != null &&
      !isNaN(startingCo2Volumes) &&
      isValidNumber(targetCo2Volumes) &&
      isValidNumber(pressureApplied)
    ) {
      return estimateCarbonationDuration(
        startingCo2Volumes,
        targetCo2Volumes,
        pressureApplied,
      );
    } else if (isValidNumber(targetCo2Volumes) && isValidNumber(pressureApplied)) {
      // If no starting CO2, assume from 0
      return estimateCarbonationDuration(0, targetCo2Volumes, pressureApplied);
    }
    return null;
  }, [startingCo2Volumes, targetCo2Volumes, pressureApplied]);

  // Validation checks
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (
      startingTemperature != null &&
      !isTemperatureSafe(startingTemperature)
    ) {
      errors.push(
        `Temperature ${startingTemperature}°C is outside safe range (-5°C to 25°C)`,
      );
    }

    return errors;
  }, [startingTemperature]);

  // Warnings (non-blocking)
  const warnings = useMemo(() => {
    const warnings: string[] = [];

    if (startingTemperature != null) {
      if (startingTemperature < 0 || startingTemperature > 10) {
        warnings.push(
          `Temperature ${startingTemperature}°C is outside optimal range (0-10°C). Carbonation may be less efficient.`,
        );
      }
    }

    return warnings;
  }, [startingTemperature]);

  const startMutation = trpc.carbonation.start.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Carbonation Started",
        description: `Carbonation operation started for ${batch.name}`,
      });

      // Invalidate relevant queries
      utils.batch.list.invalidate();
      utils.batch.get.invalidate({ batchId: batch.id });
      utils.vessel.liquidMap.invalidate();
      utils.carbonation.listActive.invalidate();

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Carbonation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CarbonationForm) => {
    if (data.carbonationMethod === "forced") {
      // Forced carbonation validation
      if (validationErrors.length > 0) {
        toast({
          title: "Validation Failed",
          description: validationErrors[0],
          variant: "destructive",
        });
        return;
      }

      startMutation.mutate({
        batchId: batch.id,
        vesselId: null, // No vessel needed for forced carbonation
        startedAt: (data as any).startedAt,
        startingVolume: data.startingVolume,
        startingVolumeUnit: data.startingVolumeUnit,
        startingTemperature: (data as any).startingTemperature ?? undefined,
        startingCo2Volumes: (data as any).startingCo2Volumes ?? undefined,
        targetCo2Volumes: data.targetCo2Volumes,
        carbonationProcess: "headspace", // Default to headspace carbonation
        pressureApplied: (data as any).pressureApplied,
        gasType: "CO2",
        notes: data.notes,
      });
    } else {
      // Bottle conditioning
      const residualCo2 = (data as any).residualCo2Volumes;
      const additivePurchaseId = (data as any).additivePurchaseItemId;

      const bottleConditioningData = {
        batchId: batch.id,
        vesselId: null, // No vessel needed for bottle conditioning
        startedAt: (data as any).startedAt,
        startingVolume: data.startingVolume,
        startingVolumeUnit: data.startingVolumeUnit,
        // Handle NaN properly - convert to undefined
        startingCo2Volumes: typeof residualCo2 === 'number' && !isNaN(residualCo2) ? residualCo2 : undefined,
        targetCo2Volumes: data.targetCo2Volumes,
        carbonationProcess: "bottle_conditioning" as const,
        pressureApplied: 0,
        gasType: "CO2",
        notes: data.notes,
        // Additive tracking - only include if values are valid
        ...(additivePurchaseId && {
          additivePurchaseId,
          primingSugarAmount: typeof requiredSugarGrams === 'number' && !isNaN(requiredSugarGrams) ? requiredSugarGrams : undefined,
          primingSugarType: ((data as any).sugarType || "sucrose") as "sucrose" | "dextrose" | "honey",
        }),
      };
      console.log("🍾 Bottle conditioning data:", bottleConditioningData);
      console.log("🍬 Required sugar grams:", requiredSugarGrams);
      console.log("🎯 Target CO2:", data.targetCo2Volumes);
      console.log("💧 Volume:", data.startingVolume, data.startingVolumeUnit);
      startMutation.mutate(bottleConditioningData);
    }
  };

  const hasErrors = validationErrors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Carbonation Operation</DialogTitle>
          <DialogDescription>
            Choose carbonation method for {batch.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Carbonation Method Selector */}
          <div className="space-y-3">
            <Label>Carbonation Method</Label>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-colors ${
                  carbonationMethod === "forced"
                    ? "border-primary ring-2 ring-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setValue("carbonationMethod", "forced")}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    <CardTitle className="text-base">Forced Carbonation</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-2">
                    Use CO2 gas and pressure in a vessel. Fast (1-3 days).
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${
                  carbonationMethod === "bottle_conditioning"
                    ? "border-primary ring-2 ring-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setValue("carbonationMethod", "bottle_conditioning")}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <Beaker className="h-5 w-5" />
                    <CardTitle className="text-base">Bottle Conditioning</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-2">
                    Add priming sugar before bottling. Natural (2-4 weeks).
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Starting Conditions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Starting Conditions</h3>

            <div>
              <Label htmlFor="startedAt">Started Date</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                {...register("startedAt", {
                  setValueAs: (value) => (value ? new Date(value) : new Date()),
                })}
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
              {(errors as any).startedAt && (
                <p className="text-sm text-destructive mt-1">
                  {(errors as any).startedAt.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startingVolume">Starting Volume</Label>
                <Input
                  id="startingVolume"
                  type="text"
                  value={`${startingVolume} ${startingVolumeUnit}`}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current batch volume
                </p>
              </div>

              <div>
                <Label htmlFor="startingTemperature">
                  Temperature (°C){" "}
                  <span className="text-muted-foreground text-xs">
                    optional
                  </span>
                </Label>
                <Input
                  id="startingTemperature"
                  type="number"
                  step="0.1"
                  placeholder="4"
                  {...register("startingTemperature", { valueAsNumber: true })}
                />
                {errors.startingTemperature && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.startingTemperature.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="startingCo2Volumes">
                Starting CO2 Volumes{" "}
                <span className="text-muted-foreground text-xs">optional</span>
              </Label>
              <Input
                id="startingCo2Volumes"
                type="number"
                step="0.1"
                placeholder="0"
                {...register("startingCo2Volumes", { valueAsNumber: true })}
              />
              {errors.startingCo2Volumes && (
                <p className="text-sm text-destructive mt-1">
                  {errors.startingCo2Volumes.message}
                </p>
              )}
            </div>
          </div>

          {/* Target Carbonation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Target Carbonation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preset">Carbonation Level</Label>
                <Select value={presetSelection} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARBONATION_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCustomTarget && (
                <div>
                  <Label htmlFor="targetCo2Volumes">Custom Target (vol)</Label>
                  <Input
                    id="targetCo2Volumes"
                    type="number"
                    step="0.1"
                    {...register("targetCo2Volumes", { valueAsNumber: true })}
                  />
                  {errors.targetCo2Volumes && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.targetCo2Volumes.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Process Details - Forced Carbonation */}
          {carbonationMethod === "forced" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Process Details</h3>

              <div>
                <Label htmlFor="pressureApplied">Pressure to Apply (PSI)</Label>
                <Input
                  id="pressureApplied"
                  type="number"
                  step="0.1"
                  placeholder={suggestedPressure?.toString() || ""}
                  {...register("pressureApplied" as any, { valueAsNumber: true })}
                />
                {(errors as any).pressureApplied && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).pressureApplied.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Priming Sugar - Bottle Conditioning */}
          {carbonationMethod === "bottle_conditioning" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Priming Sugar</h3>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>Bottle Conditioning</strong> uses natural fermentation to create
                    carbonation. Sugar is added before bottling, and yeast ferments it to produce
                    CO2 trapped in the sealed bottle.
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="residualCo2Volumes">
                  Residual CO2 Volumes{" "}
                  <span className="text-muted-foreground text-xs">optional</span>
                </Label>
                <Input
                  id="residualCo2Volumes"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="0"
                  defaultValue={0}
                  {...register("residualCo2Volumes" as any, { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  CO2 already dissolved in the cider (usually 0 for flat cider)
                </p>
                {(errors as any).residualCo2Volumes && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).residualCo2Volumes.message}
                  </p>
                )}
              </div>

              {/* Sugar Source Selection */}
              <div>
                <Label htmlFor="additivePurchaseItemId">
                  Select Priming Sugar from Inventory
                </Label>
                {isLoadingInventory ? (
                  <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-muted-foreground">
                    Loading sugar inventory...
                  </div>
                ) : sweetenerInventory?.purchases && sweetenerInventory.purchases.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {sweetenerInventory.purchases.map((purchase: any) => {
                      const isSelected = watch("additivePurchaseItemId" as any) === purchase.id;
                      return (
                        <Card
                          key={purchase.id}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary"
                              : "hover:border-primary/50 hover:bg-accent"
                          }`}
                          onClick={() => setValue("additivePurchaseItemId" as any, purchase.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-sm">
                                  {purchase.vendorName}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {purchase.productName || "Table Sugar"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Purchased: {new Date(purchase.purchaseDate).toLocaleDateString()}
                                </div>
                                {purchase.quantity && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Qty: {purchase.quantity} {purchase.unit}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 mt-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5" />
                      <div className="text-sm text-yellow-900">
                        No sugar inventory found. Please add sweeteners to your inventory first.
                      </div>
                    </div>
                  </div>
                )}
                {(errors as any).additivePurchaseItemId && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).additivePurchaseItemId.message}
                  </p>
                )}
              </div>

              {/* Calculated Sugar Amount */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-green-900">
                  <Beaker className="h-4 w-4" />
                  Required Priming Sugar
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {requiredSugarGrams.toFixed(1)} grams
                </div>
                <div className="text-sm text-green-800">
                  {(requiredSugarGrams / volumeInLiters).toFixed(2)} g/L •{" "}
                  {(requiredSugarGrams / 1000).toFixed(3)} kg total
                </div>
                {requiredSugarGrams > 0 && (
                  <div className="text-xs text-green-700 mt-2">
                    Dissolve sugar in a small amount of boiled water before adding to batch
                    to ensure even distribution.
                  </div>
                )}
              </div>

              {/* Warning about bottle strength */}
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <strong>Important:</strong> Ensure bottles are rated for carbonated beverages.
                    Over-priming can cause bottles to explode. Always use proper bottle conditioning
                    bottles and crown caps.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes (common to both methods) */}
          <div>
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground text-xs">optional</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this carbonation operation..."
              rows={3}
              {...register("notes")}
            />
          </div>

          {/* Calculator Section - Only for forced carbonation */}
          {carbonationMethod === "forced" && (suggestedPressure !== null ||
            expectedCo2Volumes !== null ||
            estimatedDuration !== null) && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-blue-900">
                <Info className="h-4 w-4" />
                Calculated Suggestions
              </div>

              {suggestedPressure !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Gauge className="h-4 w-4 text-blue-700" />
                  <span className="text-blue-900">
                    <strong>Suggested Pressure:</strong>{" "}
                    {suggestedPressure.toFixed(1)} PSI to achieve{" "}
                    {targetCo2Volumes} volumes at {startingTemperature}°C
                  </span>
                </div>
              )}

              {expectedCo2Volumes !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Thermometer className="h-4 w-4 text-blue-700" />
                  <span className="text-blue-900">
                    <strong>Expected CO2:</strong>{" "}
                    {expectedCo2Volumes.toFixed(2)} volumes at {pressureApplied}{" "}
                    PSI and {startingTemperature}°C
                  </span>
                </div>
              )}

              {estimatedDuration !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-700" />
                  <span className="text-blue-900">
                    <strong>Estimated Duration:</strong>{" "}
                    {estimatedDuration.toFixed(1)} hours (~
                    {(estimatedDuration / 24).toFixed(1)} days)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Validation Errors - Only for forced carbonation */}
          {carbonationMethod === "forced" && validationErrors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              {validationErrors.map((error, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <span className="text-destructive">{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings - Only for forced carbonation */}
          {carbonationMethod === "forced" && warnings.length > 0 && validationErrors.length === 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-2">
              {warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5" />
                  <span className="text-yellow-900">{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={(carbonationMethod === "forced" && hasErrors) || startMutation.isPending}
            >
              {startMutation.isPending
                ? (carbonationMethod === "forced" ? "Logging..." : "Adding Sugar...")
                : (carbonationMethod === "forced" ? "Log Forced Carbonation" : "Add Priming Sugar")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
