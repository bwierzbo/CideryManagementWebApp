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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { toast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import {
  Gauge,
  Thermometer,
  AlertTriangle,
  Info,
  Clock,
  Beaker,
  CheckCircle2,
} from "lucide-react";
import {
  calculateCO2Volumes,
  calculateRequiredPressure,
  estimateCarbonationDuration,
  isTemperatureSafe,
  calculatePrimingSugar,
  calculateCO2FromSugar,
  estimateResidualCO2,
} from "lib";

const SUGAR_TYPE_LABELS: Record<string, string> = {
  sucrose: "Sucrose (Table Sugar)",
  dextrose: "Dextrose (Corn Sugar)",
  honey: "Honey",
};

// Schema for forced carbonation
const forcedCarbonationSchema = z.object({
  carbonationMethod: z.literal("forced"),
  startedAt: z.date(),
  startingVolume: z.number().positive("Starting volume must be positive"),
  startingVolumeUnit: z.enum(["L", "gal"]),
  startingTemperature: z.number().min(-5).max(25).optional(),
  residualCo2Volumes: z.number().min(0).max(1.5).optional(),
  targetCo2Volumes: z.number().min(0.1).max(5),
  pressureApplied: z.number().min(1).max(50),
  notes: z.string().optional(),
});

// Schema for bottle conditioning
const bottleConditioningSchema = z.object({
  carbonationMethod: z.literal("bottle_conditioning"),
  startedAt: z.date(),
  startingVolume: z.number().positive("Starting volume must be positive"),
  startingVolumeUnit: z.enum(["L", "gal"]),
  startingTemperature: z.number().min(-5).max(25).optional(),
  residualCo2Volumes: z.number().min(0).max(1.5).optional(),
  targetCo2Volumes: z.number().min(0.1).max(5),
  sugarPerLiter: z.number().min(0).optional(),
  additivePurchaseItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

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
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [carbonationMethod, setCarbonationMethod] = React.useState<"forced" | "bottle_conditioning">("forced");
  const [lastEditedField, setLastEditedField] = React.useState<"co2" | "sugar">("co2");
  const [dateWarning, setDateWarning] = React.useState<string | null>(null);
  const [sugarType, setSugarType] = React.useState<"sucrose" | "dextrose" | "honey">("sucrose");

  const { validateDate } = useBatchDateValidation(batch.id);

  // Query for available sweetener additives (for bottle conditioning)
  const { data: sweetenerInventory, isLoading: isLoadingInventory } =
    trpc.additivePurchases.list.useQuery(
      { limit: 100, offset: 0, itemType: "Sugar & Sweeteners" },
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
      startedAt: formatDateTimeForInput(new Date()),
      startingVolume: batch.currentVolume,
      startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
      startingTemperature: 10,
      residualCo2Volumes: 0.7,
      targetCo2Volumes: 2.5,
      pressureApplied: 0,
      sugarPerLiter: undefined,
    } as any,
  });

  const watchedMethod = watch("carbonationMethod");
  const startedAt = watch("startedAt" as any);
  const startingTemperature = watch("startingTemperature" as any);
  const targetCo2Volumes = watch("targetCo2Volumes");
  const pressureApplied = watch("pressureApplied" as any);
  const residualCo2Volumes = watch("residualCo2Volumes" as any) ?? 0.7;
  const startingVolume = watch("startingVolume");
  const startingVolumeUnit = watch("startingVolumeUnit");
  const sugarPerLiter = watch("sugarPerLiter" as any);

  // Sync carbonation method state with form
  useEffect(() => {
    if (watchedMethod) {
      setCarbonationMethod(watchedMethod as "forced" | "bottle_conditioning");
    }
  }, [watchedMethod]);

  // Validate date when it changes
  useEffect(() => {
    if (startedAt) {
      const dateObj = startedAt instanceof Date ? startedAt : parseDateTimeFromInput(startedAt);
      if (dateObj && !isNaN(dateObj.getTime())) {
        const result = validateDate(dateObj);
        setDateWarning(result.warning);
      }
    }
  }, [startedAt, validateDate, parseDateTimeFromInput]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const defaultMethod = vessel?.isPressureVessel === "yes" ? "forced" : "bottle_conditioning";
      reset({
        carbonationMethod: defaultMethod,
        startedAt: formatDateTimeForInput(new Date()) as any,
        startingVolume: batch.currentVolume,
        startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
        startingTemperature: 10,
        residualCo2Volumes: 0.7,
        targetCo2Volumes: 2.5,
        pressureApplied: 0,
        sugarPerLiter: undefined,
      } as any);
      setCarbonationMethod(defaultMethod);
      setLastEditedField("co2");
      setSugarType("sucrose");
      setDateWarning(null);
    }
  }, [open, reset, batch.currentVolume, batch.currentVolumeUnit, vessel?.isPressureVessel]);

  // Convert volume to liters for calculations
  const volumeInLiters = useMemo(() => {
    if (startingVolumeUnit === "gal") return startingVolume * 3.78541;
    return startingVolume;
  }, [startingVolume, startingVolumeUnit]);

  // Bidirectional calculation: CO2 <-> Sugar
  const calculatedSugarPerLiter = useMemo(() => {
    if (carbonationMethod === "bottle_conditioning" && lastEditedField === "co2" && targetCo2Volumes) {
      const totalGrams = calculatePrimingSugar(targetCo2Volumes, residualCo2Volumes, volumeInLiters, sugarType);
      return totalGrams / volumeInLiters;
    }
    return sugarPerLiter || 0;
  }, [carbonationMethod, lastEditedField, targetCo2Volumes, residualCo2Volumes, volumeInLiters, sugarPerLiter, sugarType]);

  const calculatedCo2Volumes = useMemo(() => {
    if (carbonationMethod === "bottle_conditioning" && lastEditedField === "sugar" && sugarPerLiter) {
      return calculateCO2FromSugar(sugarPerLiter, residualCo2Volumes, sugarType);
    }
    return targetCo2Volumes || 0;
  }, [carbonationMethod, lastEditedField, sugarPerLiter, residualCo2Volumes, targetCo2Volumes, sugarType]);

  // Total priming sugar in grams
  const requiredSugarGrams = useMemo(() => {
    if (carbonationMethod === "bottle_conditioning") {
      return calculatedSugarPerLiter * volumeInLiters;
    }
    return 0;
  }, [carbonationMethod, calculatedSugarPerLiter, volumeInLiters]);

  // Expected final CO2 in bottle = residual + CO2 from sugar
  const expectedFinalCo2 = useMemo(() => {
    if (carbonationMethod === "bottle_conditioning" && calculatedSugarPerLiter > 0) {
      return calculateCO2FromSugar(calculatedSugarPerLiter, residualCo2Volumes, sugarType);
    }
    return calculatedCo2Volumes;
  }, [carbonationMethod, calculatedSugarPerLiter, residualCo2Volumes, sugarType, calculatedCo2Volumes]);

  // Forced carbonation calculations
  const suggestedPressure = useMemo(() => {
    if (targetCo2Volumes && startingTemperature != null) {
      return calculateRequiredPressure(targetCo2Volumes, startingTemperature);
    }
    return null;
  }, [targetCo2Volumes, startingTemperature]);

  const expectedCo2Volumes = useMemo(() => {
    if (pressureApplied && startingTemperature != null) {
      return calculateCO2Volumes(pressureApplied, startingTemperature);
    }
    return null;
  }, [pressureApplied, startingTemperature]);

  const estimatedDuration = useMemo(() => {
    const isValidNumber = (val: any) => typeof val === 'number' && !isNaN(val) && val > 0;
    if (isValidNumber(targetCo2Volumes) && isValidNumber(pressureApplied)) {
      const startCo2 = (typeof residualCo2Volumes === 'number' && !isNaN(residualCo2Volumes)) ? residualCo2Volumes : 0;
      return estimateCarbonationDuration(startCo2, targetCo2Volumes, pressureApplied);
    }
    return null;
  }, [residualCo2Volumes, targetCo2Volumes, pressureApplied]);

  // Validation
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (startingTemperature != null && !isTemperatureSafe(startingTemperature)) {
      errs.push(`Temperature ${startingTemperature}°C is outside safe range (-5°C to 25°C)`);
    }
    return errs;
  }, [startingTemperature]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (startingTemperature != null && (startingTemperature < 0 || startingTemperature > 10)) {
      w.push(`Temperature ${startingTemperature}°C is outside optimal range (0-10°C). Carbonation may be less efficient.`);
    }
    return w;
  }, [startingTemperature]);

  const startMutation = trpc.carbonation.start.useMutation({
    onSuccess: () => {
      toast({ title: "Carbonation Started", description: `Carbonation operation started for ${batch.name}` });
      utils.vessel.list.invalidate();
      utils.batch.list.invalidate();
      utils.batch.get.invalidate({ batchId: batch.id });
      utils.vessel.liquidMap.invalidate();
      utils.carbonation.listActive.invalidate();
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Carbonation Failed", description: error.message, variant: "destructive" });
    },
  });

  const recordMutation = trpc.carbonation.record.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Carbonation Recorded",
        description: `Carbonation recorded for ${batch.name} at ${data.carbonation.finalCo2Volumes} volumes CO2`,
      });
      utils.vessel.list.invalidate();
      utils.batch.list.invalidate();
      utils.batch.get.invalidate({ batchId: batch.id });
      utils.vessel.liquidMap.invalidate();
      utils.carbonation.list.invalidate();
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Failed to Record Carbonation", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CarbonationForm) => {
    const rawDate = (data as any).startedAt;
    const dateValue = rawDate instanceof Date ? rawDate : parseDateTimeFromInput(rawDate);

    if (data.carbonationMethod === "forced") {
      if (validationErrors.length > 0) {
        toast({ title: "Validation Failed", description: validationErrors[0], variant: "destructive" });
        return;
      }
      recordMutation.mutate({
        batchId: batch.id,
        vesselId: vessel?.id ?? null,
        completedAt: dateValue,
        carbonationProcess: "headspace" as const,
        targetCo2Volumes: data.targetCo2Volumes,
        finalCo2Volumes: data.targetCo2Volumes,
        temperature: (data as any).startingTemperature ?? undefined,
        pressureApplied: (data as any).pressureApplied,
        startingVolume: data.startingVolume,
        finalVolume: data.startingVolume,
        volumeUnit: data.startingVolumeUnit,
        gasType: "CO2",
        notes: data.notes,
      });
    } else {
      const residualCo2 = (data as any).residualCo2Volumes;
      const additivePurchaseId = (data as any).additivePurchaseItemId;

      startMutation.mutate({
        batchId: batch.id,
        vesselId: null,
        startedAt: dateValue,
        startingVolume: data.startingVolume,
        startingVolumeUnit: data.startingVolumeUnit,
        startingCo2Volumes: typeof residualCo2 === 'number' && !isNaN(residualCo2) ? residualCo2 : undefined,
        targetCo2Volumes: data.targetCo2Volumes,
        carbonationProcess: "bottle_conditioning" as const,
        pressureApplied: 0,
        gasType: "CO2",
        notes: data.notes,
        ...(additivePurchaseId && {
          additivePurchaseId,
          primingSugarAmount: typeof requiredSugarGrams === 'number' && !isNaN(requiredSugarGrams) ? requiredSugarGrams : undefined,
          primingSugarType: sugarType,
        }),
      });
    }
  };

  const hasErrors = validationErrors.length > 0;
  const sugarTypeLabel = SUGAR_TYPE_LABELS[sugarType] || sugarType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Carbonation</DialogTitle>
          <DialogDescription>
            Log carbonation details for {batch.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Carbonation Method Selector */}
          <div className="space-y-3">
            <Label>Carbonation Method</Label>
            <div className={`grid ${vessel?.isPressureVessel === "yes" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
              {vessel?.isPressureVessel === "yes" && (
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
              )}

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
            {vessel?.isPressureVessel !== "yes" && (
              <p className="text-sm text-muted-foreground">
                {vessel === null
                  ? "No vessel assigned. Bottle conditioning available."
                  : "This vessel is not pressure-rated. Only bottle conditioning is available."}
              </p>
            )}
          </div>

          {/* Starting Conditions — shared for both methods */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Starting Conditions</h3>

            <div>
              <Label htmlFor="startedAt">Date</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                {...register("startedAt" as any)}
              />
              <DateWarning warning={dateWarning} />
              {(errors as any).startedAt && (
                <p className="text-sm text-destructive mt-1">
                  {(errors as any).startedAt.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startingVolume">Volume</Label>
                <Input
                  id="startingVolume"
                  type="text"
                  value={`${startingVolume} ${startingVolumeUnit}`}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="startingTemperature">
                  Temp (°C)
                </Label>
                <Input
                  id="startingTemperature"
                  type="number"
                  step="0.1"
                  placeholder="10"
                  {...register("startingTemperature", { valueAsNumber: true })}
                />
                {(errors as any).startingTemperature && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).startingTemperature.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="residualCo2Volumes">
                  Residual CO₂
                </Label>
                <Input
                  id="residualCo2Volumes"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1.5"
                  placeholder="0.7"
                  {...register("residualCo2Volumes" as any, { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {startingTemperature != null && !isNaN(startingTemperature)
                    ? `Est. ~${estimateResidualCO2(startingTemperature).toFixed(2)} vol at ${startingTemperature}°C`
                    : "CO₂ already in cider (0-1.5 vol)"}
                </p>
                {(errors as any).residualCo2Volumes && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).residualCo2Volumes.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Target Carbonation — shared */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Target Carbonation</h3>

            <div>
              <Label htmlFor="targetCo2Volumes">CO₂ Target (volumes)</Label>
              <Input
                id="targetCo2Volumes"
                type="number"
                step="0.01"
                placeholder="2.5"
                {...register("targetCo2Volumes", { valueAsNumber: true })}
                onChange={(e) => {
                  register("targetCo2Volumes", { valueAsNumber: true }).onChange(e);
                  setLastEditedField("co2");
                  if (carbonationMethod === "bottle_conditioning") {
                    const co2 = parseFloat(e.target.value);
                    if (co2 && volumeInLiters) {
                      const totalGrams = calculatePrimingSugar(co2, residualCo2Volumes, volumeInLiters, sugarType);
                      setValue("sugarPerLiter" as any, totalGrams / volumeInLiters);
                    }
                  }
                }}
              />
              {errors.targetCo2Volumes && (
                <p className="text-sm text-destructive mt-1">
                  {errors.targetCo2Volumes.message}
                </p>
              )}
            </div>
          </div>

          {/* Forced Carbonation Details */}
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

          {/* Bottle Conditioning Details */}
          {carbonationMethod === "bottle_conditioning" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Priming Sugar</h3>

              {/* Sugar Type Selector */}
              <div className="space-y-2">
                <Label>Sugar Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "sucrose" as const, label: "Sucrose", desc: "Table Sugar (4.0 g/L per vol)" },
                    { value: "dextrose" as const, label: "Dextrose", desc: "Corn Sugar (3.8 g/L per vol)" },
                    { value: "honey" as const, label: "Honey", desc: "~3.5 g/L per vol" },
                  ]).map((type) => (
                    <Card
                      key={type.value}
                      className={`cursor-pointer transition-colors ${
                        sugarType === type.value
                          ? "border-primary ring-2 ring-primary"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setSugarType(type.value);
                        if (lastEditedField === "co2" && targetCo2Volumes && volumeInLiters) {
                          const totalGrams = calculatePrimingSugar(targetCo2Volumes, residualCo2Volumes, volumeInLiters, type.value);
                          setValue("sugarPerLiter" as any, totalGrams / volumeInLiters);
                        } else if (lastEditedField === "sugar" && sugarPerLiter) {
                          const co2 = calculateCO2FromSugar(sugarPerLiter, residualCo2Volumes, type.value);
                          setValue("targetCo2Volumes", co2);
                        }
                      }}
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{type.label}</CardTitle>
                        <CardDescription className="text-xs">{type.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sugar Concentration */}
              <div>
                <Label htmlFor="sugarPerLiter">{sugarTypeLabel} (g/L)</Label>
                <Input
                  id="sugarPerLiter"
                  type="number"
                  step="0.1"
                  placeholder="10.0"
                  {...register("sugarPerLiter" as any, { valueAsNumber: true })}
                  onChange={(e) => {
                    register("sugarPerLiter" as any, { valueAsNumber: true }).onChange(e);
                    setLastEditedField("sugar");
                    const sugar = parseFloat(e.target.value);
                    if (sugar) {
                      const co2 = calculateCO2FromSugar(sugar, residualCo2Volumes, sugarType);
                      setValue("targetCo2Volumes", co2);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter either CO₂ target or {sugarType} amount — they calculate each other
                </p>
                {(errors as any).sugarPerLiter && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors as any).sugarPerLiter.message}
                  </p>
                )}
              </div>

              {/* Sugar Source from Inventory */}
              <div>
                <Label htmlFor="additivePurchaseItemId">
                  Select {sugarTypeLabel} from Inventory
                </Label>
                {isLoadingInventory ? (
                  <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-muted-foreground">
                    Loading sugar inventory...
                  </div>
                ) : sweetenerInventory?.purchases && sweetenerInventory.purchases.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {sweetenerInventory.purchases.flatMap((purchase: any) =>
                      purchase.items?.map((item: any) => {
                        const isSelected = watch("additivePurchaseItemId" as any) === purchase.id;
                        return (
                          <Card
                            key={item.id}
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
                                    {item.productName || purchase.vendorName}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {item.brandManufacturer || sugarTypeLabel}
                                  </div>
                                  {item.quantity && (
                                    <div className="text-xs font-semibold text-green-700 mt-1">
                                      {parseFloat(item.quantity).toFixed(0)} {item.unit} remaining
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Purchased: {formatDate(purchase.purchaseDate)}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }) || []
                    )}
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

              {/* Calculated Sugar + Expected CO2 Summary */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-green-900">
                  <Beaker className="h-4 w-4" />
                  Required {sugarTypeLabel}
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {requiredSugarGrams.toFixed(1)} grams
                </div>
                <div className="text-sm text-green-800">
                  {(requiredSugarGrams / volumeInLiters).toFixed(2)} g/L •{" "}
                  {(requiredSugarGrams / 1000).toFixed(3)} kg total
                </div>
                <div className="text-sm font-semibold text-green-900 mt-1">
                  Expected final CO₂ in bottle: {expectedFinalCo2.toFixed(2)} volumes
                </div>
                {requiredSugarGrams > 0 && (
                  <div className="text-xs text-green-700 mt-2">
                    Dissolve {sugarType === "honey" ? "honey" : "sugar"} in a small amount of boiled water before adding to batch
                    to ensure even distribution.
                  </div>
                )}
              </div>

              {/* Bottle safety warning */}
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

          {/* Notes */}
          <div>
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground text-xs">optional</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this carbonation operation..."
              rows={3}
              {...register("notes")}
            />
          </div>

          {/* Forced Carbonation Calculator */}
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

          {/* Validation Errors — forced only */}
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

          {/* Warnings — forced only */}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={(carbonationMethod === "forced" && hasErrors) || startMutation.isPending || recordMutation.isPending}
            >
              {(startMutation.isPending || recordMutation.isPending)
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
