"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { Flame, Info, Loader2, Clock, Thermometer, Droplet, AlertTriangle, Snowflake, Wind, Waves } from "lucide-react";
import {
  calculatePU,
  calculateEnhancedPasteurization,
  calculateRequiredHoldTime,
  classifyProduct,
  validatePasteurization,
  getBottleProfileOptions,
  BOTTLE_PROFILES,
  type CooldownMethod,
  type EnhancedPasteurizationResult,
} from "lib";

const pasteurizeSchema = z.object({
  pasteurizedAt: z.string(),
  bottleTypeId: z.string(),
  startingTempC: z.number().min(-5, "Temperature too low").max(40, "Temperature too high"),
  temperatureCelsius: z.number().min(0, "Temperature must be positive").max(100, "Temperature must be at most 100°C"),
  timeMinutes: z.number().min(0, "Time cannot be negative").max(120, "Time must be at most 120 minutes"),
  cooldownMethod: z.enum(["air", "water_bath", "ice_bath"]),
  bottlesLost: z.number().int().min(0, "Must be 0 or more").optional(),
  notes: z.string().optional(),
  // Labor tracking (optional)
  laborHours: z.number().min(0).optional(),
});

// Starting temperature presets
const STARTING_TEMP_PRESETS = [
  { label: "Refrigerator (4°C)", value: 4 },
  { label: "Cellar (12°C)", value: 12 },
  { label: "Room Temp (20°C)", value: 20 },
  { label: "Custom", value: -999 }, // Sentinel for custom input
];

// Cooldown method options
const COOLDOWN_OPTIONS: { value: CooldownMethod; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "air", label: "Air Cool", icon: <Wind className="w-4 h-4" />, description: "Natural cooling at room temperature (~22°C)" },
  { value: "water_bath", label: "Water Bath", icon: <Waves className="w-4 h-4" />, description: "Cool water bath (~18°C)" },
  { value: "ice_bath", label: "Ice Bath", icon: <Snowflake className="w-4 h-4" />, description: "Ice water for rapid cooling (~2°C)" },
];

type PasteurizeForm = z.infer<typeof pasteurizeSchema>;

interface PasteurizeModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  batchId: string;
  unitsProduced: number;
  onSuccess: () => void;
}

export function PasteurizeModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  batchId,
  unitsProduced,
  onSuccess,
}: PasteurizeModalProps) {
  const utils = trpc.useUtils();

  // State for custom starting temperature input
  const [useCustomStartTemp, setUseCustomStartTemp] = useState(false);
  const [showTempCurve, setShowTempCurve] = useState(false);
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  // Date validation
  const { validateDate } = useBatchDateValidation(batchId);

  // Get bottle profile options
  const bottleOptions = useMemo(() => getBottleProfileOptions(), []);

  // Fetch batch composition data for product classification
  const { data: batchData, isLoading: isBatchLoading } = trpc.packaging.getBatchPasteurizationData.useQuery(
    { batchId },
    { enabled: open }
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<PasteurizeForm>({
    resolver: zodResolver(pasteurizeSchema),
    defaultValues: {
      pasteurizedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      bottleTypeId: "750ml_glass",
      startingTempC: 20, // Room temperature default
      temperatureCelsius: 65, // Hot-start bath temperature
      timeMinutes: 0, // Default to 0, user enters actual hold time
      cooldownMethod: "air",
      bottlesLost: 0,
      laborHours: undefined,
    },
  });

  const bottleTypeId = watch("bottleTypeId");
  const startingTempC = watch("startingTempC");
  const temperatureCelsius = watch("temperatureCelsius");
  const timeMinutes = watch("timeMinutes");
  const cooldownMethod = watch("cooldownMethod");
  const pasteurizedAt = watch("pasteurizedAt");

  // Validate date when it changes
  useEffect(() => {
    if (pasteurizedAt) {
      const result = validateDate(pasteurizedAt);
      setDateWarning(result.warning);
    }
  }, [pasteurizedAt, validateDate]);

  // Product classification based on batch data
  const productClassification = useMemo(() => {
    if (!batchData) return null;
    return classifyProduct(batchData.finalGravity, batchData.hasFruitAddition);
  }, [batchData]);

  // Enhanced pasteurization calculation with dynamic ramp modeling
  // Normalize timeMinutes - treat any invalid value as 0.1 (use 0.1 instead of 0 to prevent calculation issues)
  // This handles: 0, "0", "", null, undefined, NaN, or any other edge cases from form input
  const normalizedTimeMinutes = useMemo(() => {
    let value = 0;

    // If it's already a valid number, use it
    if (typeof timeMinutes === 'number' && !isNaN(timeMinutes)) {
      value = timeMinutes;
    }
    // If it's a string, try to parse it
    else if (typeof timeMinutes === 'string') {
      const parsed = parseFloat(timeMinutes);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }

    // Use 0.1 instead of 0 to prevent calculation from failing
    // This is effectively 0 for practical purposes but keeps the math working
    return value <= 0 ? 0.1 : value;
  }, [timeMinutes]);

  const enhancedResult = useMemo((): EnhancedPasteurizationResult | null => {
    const validStartTemp = typeof startingTempC === 'number' && !isNaN(startingTempC);
    const validBathTemp = typeof temperatureCelsius === 'number' && !isNaN(temperatureCelsius);

    if (!bottleTypeId || !validStartTemp || !validBathTemp || !cooldownMethod) {
      return null;
    }
    try {
      return calculateEnhancedPasteurization({
        bottleTypeId,
        productStartingTempC: startingTempC,
        bathTempC: temperatureCelsius,
        holdTimeMinutes: normalizedTimeMinutes,
        cooldownMethod: cooldownMethod as CooldownMethod,
      });
    } catch (e) {
      console.error("Pasteurization calculation error:", e);
      return null;
    }
  }, [bottleTypeId, startingTempC, temperatureCelsius, normalizedTimeMinutes, cooldownMethod]);

  // Calculate recommended hold time to meet target PUs
  const recommendedHoldTime = useMemo(() => {
    if (!productClassification || !bottleTypeId) return null;
    try {
      return calculateRequiredHoldTime(
        productClassification.targetPU_min,
        bottleTypeId,
        startingTempC || 20,
        temperatureCelsius || 65,
        (cooldownMethod as CooldownMethod) || "air"
      );
    } catch {
      return null;
    }
  }, [productClassification, bottleTypeId, startingTempC, temperatureCelsius, cooldownMethod]);

  // Validate pasteurization against product requirements
  const validation = useMemo(() => {
    if (!productClassification || !enhancedResult) return null;
    return validatePasteurization(enhancedResult.totals.total_pu, productClassification);
  }, [enhancedResult, productClassification]);

  // Track if we've set the recommended time for this modal session
  const [hasSetRecommendedTime, setHasSetRecommendedTime] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        pasteurizedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        bottleTypeId: "750ml_glass",
        startingTempC: 20,
        temperatureCelsius: 65,
        timeMinutes: 0, // Will be updated once recommendedHoldTime is calculated
        cooldownMethod: "air",
        bottlesLost: 0,
      });
      setUseCustomStartTemp(false);
      setShowTempCurve(false);
      setHasSetRecommendedTime(false);
    }
  }, [open, reset]);

  // Set timeMinutes to recommended value once it's calculated (only once per modal open)
  useEffect(() => {
    if (open && recommendedHoldTime && !hasSetRecommendedTime) {
      const recommendedTime = Math.max(0, Math.ceil(recommendedHoldTime.holdTimeMinutes));
      setValue("timeMinutes", recommendedTime);
      setHasSetRecommendedTime(true);
    }
  }, [open, recommendedHoldTime, hasSetRecommendedTime, setValue]);

  // Calculate PUs at minimal hold time (0.1 min) to see ramp contribution
  const minimalHoldResult = useMemo(() => {
    const validStartTemp = typeof startingTempC === 'number' && !isNaN(startingTempC);
    const validBathTemp = typeof temperatureCelsius === 'number' && !isNaN(temperatureCelsius);

    if (!bottleTypeId || !validStartTemp || !validBathTemp || !cooldownMethod) {
      return null;
    }
    try {
      return calculateEnhancedPasteurization({
        bottleTypeId,
        productStartingTempC: startingTempC,
        bathTempC: temperatureCelsius,
        holdTimeMinutes: 0.1, // Use 0.1 instead of 0
        cooldownMethod: cooldownMethod as CooldownMethod,
      });
    } catch {
      return null;
    }
  }, [bottleTypeId, startingTempC, temperatureCelsius, cooldownMethod]);

  // Calculate the optimal temperature for minimum PUs with minimal hold time
  // This uses binary search to find the exact temperature that achieves target minimum PUs
  const optimalMinPUTemp = useMemo(() => {
    if (!productClassification || !bottleTypeId) return null;

    const targetMin = productClassification.targetPU_min;
    const currentStartTemp = startingTempC || 20;
    const currentCooldown = (cooldownMethod as CooldownMethod) || "air";

    // Binary search for temperature that gives exactly target minimum PUs with 0.1 min hold
    let lowTemp = 55; // Minimum effective pasteurization temp
    let highTemp = 85; // Maximum reasonable bath temp
    let bestTemp: number | null = null;
    let bestPU = 0;

    for (let i = 0; i < 25; i++) { // 25 iterations for good precision
      const midTemp = (lowTemp + highTemp) / 2;
      try {
        const result = calculateEnhancedPasteurization({
          bottleTypeId,
          productStartingTempC: currentStartTemp,
          bathTempC: midTemp,
          holdTimeMinutes: 0.1,
          cooldownMethod: currentCooldown,
        });

        const pu = result.totals.total_pu;

        if (pu < targetMin) {
          // Need higher temperature
          lowTemp = midTemp;
        } else {
          // This temperature works, but maybe we can go lower
          highTemp = midTemp;
          bestTemp = midTemp;
          bestPU = pu;
        }
      } catch {
        // If calculation fails, try higher temp
        lowTemp = midTemp;
      }
    }

    // If we couldn't find a valid temperature, return null
    if (bestTemp === null) return null;

    // Round to nearest 0.5°C
    const roundedTemp = Math.round(bestTemp * 2) / 2;

    // Calculate actual PU at this rounded temperature
    try {
      const verifyResult = calculateEnhancedPasteurization({
        bottleTypeId,
        productStartingTempC: currentStartTemp,
        bathTempC: roundedTemp,
        holdTimeMinutes: 0.1,
        cooldownMethod: currentCooldown,
      });
      bestPU = verifyResult.totals.total_pu;
    } catch {
      // Use the last known good PU
    }

    return {
      temperature: roundedTemp,
      estimatedPU: Math.round(bestPU * 10) / 10,
      isCurrentTemp: Math.abs(roundedTemp - (temperatureCelsius || 65)) < 0.5,
    };
  }, [productClassification, bottleTypeId, startingTempC, temperatureCelsius, cooldownMethod]);

  const pasteurizeMutation = trpc.packaging.pasteurize.useMutation({
    onSuccess: () => {
      const totalPU = enhancedResult?.totals.total_pu || 0;
      toast({
        title: "Batch Pasteurized",
        description: `Successfully recorded pasteurization for ${bottleRunName} with ${totalPU.toFixed(1)} PU`,
      });
      utils.packaging.list.invalidate();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Pasteurization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PasteurizeForm) => {
    // Use enhanced calculation for total PU
    const totalPU = enhancedResult?.totals.total_pu || calculatePU(data.temperatureCelsius, data.timeMinutes);
    const pasteurizedAt = new Date(data.pasteurizedAt);

    // Build notes with enhanced details
    const enhancedNotes = [
      data.notes,
      `Bottle Type: ${BOTTLE_PROFILES[data.bottleTypeId]?.name || data.bottleTypeId}`,
      `Starting Temp: ${data.startingTempC}°C`,
      `Cooldown Method: ${data.cooldownMethod.replace("_", " ")}`,
      enhancedResult ? `Heatup: ${enhancedResult.phases.heatup.pu} PU (${enhancedResult.phases.heatup.duration_min} min)` : null,
      enhancedResult ? `Hold: ${enhancedResult.phases.hold.pu} PU (${enhancedResult.phases.hold.duration_min} min)` : null,
      enhancedResult ? `Cooldown: ${enhancedResult.phases.cooldown.pu} PU (${enhancedResult.phases.cooldown.duration_min} min)` : null,
    ].filter(Boolean).join(" | ");

    pasteurizeMutation.mutate({
      runId: bottleRunId,
      pasteurizedAt: pasteurizedAt,
      temperatureCelsius: data.temperatureCelsius,
      timeMinutes: data.timeMinutes,
      pasteurizationUnits: totalPU,
      bottlesLost: data.bottlesLost,
      notes: enhancedNotes,
      laborHours: data.laborHours,
    });
  };

  // Get validation colors
  const getValidationColors = () => {
    if (!validation) return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" };

    if (validation.color === 'green') {
      return { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", textBold: "text-green-600" };
    } else if (validation.color === 'yellow') {
      return { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", textBold: "text-yellow-600" };
    } else {
      return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", textBold: "text-red-600" };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Hot-Start Pasteurization Planning
          </DialogTitle>
          <DialogDescription>
            Record pasteurization for {bottleRunName}
          </DialogDescription>
        </DialogHeader>

        {isBatchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading batch data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Classification */}
            {productClassification && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplet className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-900">Product Classification</span>
                    </div>
                    <p className="text-sm text-blue-700">{productClassification.description}</p>
                    {batchData?.fruitAdditives && batchData.fruitAdditives.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1">
                        Fruit additions: {batchData.fruitAdditives.join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge className={`${
                    productClassification.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                    productClassification.riskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {productClassification.riskLevel.charAt(0).toUpperCase() + productClassification.riskLevel.slice(1)} Risk
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700">Recommended PU Target:</span>
                    <span className="font-bold text-blue-900">
                      {productClassification.targetPU_min}–{productClassification.targetPU_max} PU
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottle Type & Setup */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Bottle & Temperature Setup</span>
              </div>

              {/* Bottle Type Selection */}
              <div className="space-y-2">
                <Label>Bottle Type</Label>
                <Select
                  value={bottleTypeId}
                  onValueChange={(value) => setValue("bottleTypeId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bottle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bottleOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Starting Temperature */}
              <div className="space-y-2">
                <Label>Product Starting Temperature</Label>
                <div className="flex gap-2 flex-wrap">
                  {STARTING_TEMP_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      type="button"
                      size="sm"
                      variant={
                        preset.value === -999
                          ? useCustomStartTemp ? "default" : "outline"
                          : startingTempC === preset.value && !useCustomStartTemp ? "default" : "outline"
                      }
                      onClick={() => {
                        if (preset.value === -999) {
                          setUseCustomStartTemp(true);
                        } else {
                          setUseCustomStartTemp(false);
                          setValue("startingTempC", preset.value);
                        }
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                {useCustomStartTemp && (
                  <Input
                    type="number"
                    step="0.5"
                    {...register("startingTempC", { valueAsNumber: true })}
                    placeholder="Enter temperature (°C)"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Cooldown Method */}
              <div className="space-y-2">
                <Label>Cooldown Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {COOLDOWN_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={cooldownMethod === option.value ? "default" : "outline"}
                      className="flex flex-col items-center h-auto py-2"
                      onClick={() => setValue("cooldownMethod", option.value)}
                    >
                      {option.icon}
                      <span className="text-xs mt-1">{option.label}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {COOLDOWN_OPTIONS.find(o => o.value === cooldownMethod)?.description}
                </p>
              </div>
            </div>

            {/* Enhanced Pasteurization Plan */}
            {enhancedResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-gray-900">Calculated PU Breakdown</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTempCurve(!showTempCurve)}
                  >
                    {showTempCurve ? "Hide" : "Show"} Temp Curve
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-2 bg-orange-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Heatup</div>
                    <div className="font-bold text-orange-600">{enhancedResult.phases.heatup.pu} PU</div>
                    <div className="text-xs text-gray-500">{enhancedResult.phases.heatup.duration_min} min</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Hold @ {temperatureCelsius}°C</div>
                    <div className="font-bold text-red-600">{enhancedResult.phases.hold.pu} PU</div>
                    <div className="text-xs text-gray-500">{enhancedResult.phases.hold.duration_min} min</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Cooldown</div>
                    <div className="font-bold text-blue-600">{enhancedResult.phases.cooldown.pu} PU</div>
                    <div className="text-xs text-gray-500">{enhancedResult.phases.cooldown.duration_min} min</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Process Time:</span>
                  <span className="font-bold text-gray-900">{enhancedResult.totals.total_time_min} min</span>
                </div>

                {/* Temperature Curve Visualization */}
                {showTempCurve && enhancedResult.temperatureProfile.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">Temperature & PU Curve</div>
                    <div className="h-40 bg-white rounded border p-2">
                      <svg viewBox="0 0 400 120" className="w-full h-full">
                        {/* Grid lines */}
                        <line x1="40" y1="10" x2="40" y2="100" stroke="#e5e7eb" strokeWidth="1" />
                        <line x1="40" y1="100" x2="390" y2="100" stroke="#e5e7eb" strokeWidth="1" />
                        <line x1="40" y1="55" x2="390" y2="55" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />

                        {/* Y-axis labels */}
                        <text x="35" y="15" fontSize="8" textAnchor="end" fill="#6b7280">{temperatureCelsius}°C</text>
                        <text x="35" y="58" fontSize="8" textAnchor="end" fill="#6b7280">60°C</text>
                        <text x="35" y="105" fontSize="8" textAnchor="end" fill="#6b7280">{startingTempC}°C</text>

                        {/* Temperature curve */}
                        <path
                          d={enhancedResult.temperatureProfile.map((point, i) => {
                            const maxTime = enhancedResult.totals.total_time_min;
                            const x = 40 + (point.time_min / maxTime) * 350;
                            const tempRange = temperatureCelsius - startingTempC;
                            const y = 100 - ((point.core_temp_C - startingTempC) / tempRange) * 90;
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2"
                        />

                        {/* Phase labels */}
                        <text x="80" y="115" fontSize="7" fill="#9ca3af">Heatup</text>
                        <text x="200" y="115" fontSize="7" fill="#9ca3af">Hold</text>
                        <text x="330" y="115" fontSize="7" fill="#9ca3af">Cooldown</text>
                      </svg>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-orange-500"></span> Temperature
                      </span>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {enhancedResult.warnings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {enhancedResult.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommended hold time */}
                {recommendedHoldTime && productClassification && recommendedHoldTime.holdTimeMinutes > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Recommended hold time for {productClassification.targetPU_min} PU:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setValue("timeMinutes", Math.ceil(recommendedHoldTime.holdTimeMinutes))}
                      >
                        Use {Math.ceil(recommendedHoldTime.holdTimeMinutes)} min
                      </Button>
                    </div>
                  </div>
                )}

                {/* Optimal temperature for minimum PUs */}
                {optimalMinPUTemp && productClassification && (
                  <div className="mt-3 pt-3 border-t border-gray-200 bg-emerald-50 -mx-4 px-4 py-2 rounded-b-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <Thermometer className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-900">
                          Optimal Temperature for Minimum PUs
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          {optimalMinPUTemp.temperature}°C with minimal hold time achieves ~{optimalMinPUTemp.estimatedPU} PU
                          {" "}(target: {productClassification.targetPU_min} PU minimum)
                        </p>
                      </div>
                    </div>
                    {!optimalMinPUTemp.isCurrentTemp && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-700">Apply optimal settings:</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                          onClick={() => {
                            setValue("temperatureCelsius", optimalMinPUTemp.temperature);
                            setValue("timeMinutes", 0);
                          }}
                        >
                          Use {optimalMinPUTemp.temperature}°C &amp; 0 min
                        </Button>
                      </div>
                    )}
                    {optimalMinPUTemp.isCurrentTemp && (
                      <p className="text-xs text-emerald-600 italic">
                        ✓ Current temperature is already optimal for minimum PUs
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Packaging Run Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Units to Pasteurize:</span>
                <span className="font-semibold text-purple-900">
                  {unitsProduced.toLocaleString()} bottles
                </span>
              </div>
            </div>

            {/* Actual Pasteurization Parameters */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b pb-2">
                <Thermometer className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-gray-900">Actual Pasteurization</span>
              </div>

              {/* Date & Time */}
              <div className="space-y-2">
                <Label htmlFor="pasteurizedAt">
                  Pasteurization Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pasteurizedAt"
                  type="datetime-local"
                  {...register("pasteurizedAt")}
                />
                <DateWarning warning={dateWarning} />
                {errors.pasteurizedAt && (
                  <p className="text-sm text-red-500">{errors.pasteurizedAt.message}</p>
                )}
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label htmlFor="temperatureCelsius">
                  Hold Temperature (°C) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="temperatureCelsius"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d*\.?\d+$"
                  {...register("temperatureCelsius", { valueAsNumber: true })}
                  placeholder="65"
                />
                {errors.temperatureCelsius && (
                  <p className="text-sm text-red-500">{errors.temperatureCelsius.message}</p>
                )}
              </div>

              {/* Hold Time */}
              <div className="space-y-2">
                <Label htmlFor="timeMinutes">
                  Hold Time (minutes) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="timeMinutes"
                  type="number"
                  min="0"
                  max="120"
                  step="0.5"
                  {...register("timeMinutes", {
                    setValueAs: (v) => {
                      if (v === "" || v === null || v === undefined) return 0;
                      const num = parseFloat(v);
                      return isNaN(num) ? 0 : num;
                    }
                  })}
                  placeholder="0"
                />
                {errors.timeMinutes && (
                  <p className="text-sm text-red-500">{errors.timeMinutes.message}</p>
                )}
              </div>

              {/* Bottles Lost */}
              <div className="space-y-2">
                <Label htmlFor="bottlesLost">
                  Bottles Lost (breakage/waste)
                </Label>
                <Input
                  id="bottlesLost"
                  type="text"
                  inputMode="numeric"
                  pattern="^\d+$"
                  min="0"
                  {...register("bottlesLost", { valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.bottlesLost && (
                  <p className="text-sm text-red-500">{errors.bottlesLost.message}</p>
                )}
              </div>
            </div>

            {/* Calculated PU & Validation */}
            {enhancedResult && (() => {
              const colors = validation ? getValidationColors() : { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", textBold: "text-gray-900" };
              const totalPU = enhancedResult.totals.total_pu;
              return (
                <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${colors.text}`}>
                      Total Pasteurization Units:
                    </span>
                    <span className={`text-2xl font-bold ${colors.textBold}`}>
                      {totalPU.toFixed(1)} PU
                    </span>
                  </div>

                  {validation && (
                    <div className="flex items-start gap-2 mt-3">
                      {validation.status === 'optimal' && <span className="text-xl">✓</span>}
                      {validation.status === 'acceptable' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                      {validation.status === 'insufficient' && <span className="text-xl">✗</span>}
                      <p className={`text-sm ${colors.text}`}>{validation.message}</p>
                    </div>
                  )}

                  <div className={`text-xs ${colors.text} mt-3 pt-3 border-t ${colors.border}`}>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>Heatup: {enhancedResult.phases.heatup.pu} PU</div>
                      <div>Hold: {enhancedResult.phases.hold.pu} PU</div>
                      <div>Cooldown: {enhancedResult.phases.cooldown.pu} PU</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SOP Guidance */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-amber-900">Standard Operating Procedure</span>
              </div>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Preheat water bath to {temperatureCelsius}°C</li>
                <li>Load bottles from {startingTempC}°C storage</li>
                <li>Insert probe bottle to monitor core temperature</li>
                <li>Begin timing when probe reaches 60°C (~{enhancedResult?.phases.heatup.duration_min || 6} min)</li>
                <li>Hold for {timeMinutes} min at {temperatureCelsius}°C</li>
                <li>Remove and {cooldownMethod === 'ice_bath' ? 'ice bath cool' : cooldownMethod === 'water_bath' ? 'water bath cool' : 'air cool'}</li>
              </ol>
              <p className="text-xs text-amber-700 mt-2">
                Expected total: {enhancedResult?.totals.total_time_min || '8'} min •
                Target PU: {productClassification?.targetPU_min || 30} •
                Cooldown adds ~{enhancedResult?.phases.cooldown.pu || 20} PU
              </p>
            </div>

            {/* Labor Hours */}
            <div className="space-y-2">
              <Label htmlFor="laborHours">
                Labor Hours <span className="text-gray-400">(optional)</span>
              </Label>
              <Input
                id="laborHours"
                type="number"
                step="0.25"
                min="0"
                placeholder="e.g., 1.5"
                {...register("laborHours", { valueAsNumber: true })}
              />
              <p className="text-xs text-gray-500">Hours spent on pasteurization for COGS</p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Additional pasteurization notes..."
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={pasteurizeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                disabled={
                  pasteurizeMutation.isPending ||
                  temperatureCelsius === undefined ||
                  temperatureCelsius === null ||
                  timeMinutes === undefined ||
                  timeMinutes === null
                }
              >
                {pasteurizeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-2" />
                    Record Pasteurization
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
