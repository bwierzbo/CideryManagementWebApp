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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Flame, Info, Loader2, Clock, Thermometer, Droplet, AlertTriangle } from "lucide-react";
import {
  calculatePU,
  calculatePasteurizationPlan,
  classifyProduct,
  validatePasteurization,
  BOTTLE_PROFILE_750ML_GLASS,
} from "lib";

const pasteurizeSchema = z.object({
  pasteurizedAt: z.string(),
  temperatureCelsius: z.number().min(0, "Temperature must be positive").max(100, "Temperature must be at most 100°C"),
  timeMinutes: z.number().positive("Time must be positive").max(120, "Time must be at most 120 minutes"),
  notes: z.string().optional(),
});

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
  } = useForm<PasteurizeForm>({
    resolver: zodResolver(pasteurizeSchema),
    defaultValues: {
      pasteurizedAt: new Date().toISOString().split('T')[0],
      temperatureCelsius: 65, // Hot-start bath temperature
      timeMinutes: 8, // Default based on typical 750ml glass profile
    },
  });

  const temperatureCelsius = watch("temperatureCelsius");
  const timeMinutes = watch("timeMinutes");

  // Product classification based on batch data
  const productClassification = useMemo(() => {
    if (!batchData) return null;
    return classifyProduct(batchData.finalGravity, batchData.hasFruitAddition);
  }, [batchData]);

  // Calculate PU using Craft Metrics formula
  const calculatedPU = useMemo(() => {
    if (!temperatureCelsius || !timeMinutes) return 0;
    return calculatePU(temperatureCelsius, timeMinutes);
  }, [temperatureCelsius, timeMinutes]);

  // Generate pasteurization plan
  const plan = useMemo(() => {
    if (!productClassification) return null;
    const targetPU = productClassification.targetPU_min;
    return calculatePasteurizationPlan('750ml_glass', targetPU, 65);
  }, [productClassification]);

  // Validate pasteurization against product requirements
  const validation = useMemo(() => {
    if (!productClassification || calculatedPU === 0) return null;
    return validatePasteurization(calculatedPU, productClassification);
  }, [calculatedPU, productClassification]);

  // Reset form when modal opens
  useEffect(() => {
    if (open && plan) {
      reset({
        pasteurizedAt: new Date().toISOString().split('T')[0],
        temperatureCelsius: 65,
        timeMinutes: Math.ceil(plan.total_bath_time_min),
      });
    }
  }, [open, plan, reset]);

  const pasteurizeMutation = trpc.packaging.pasteurize.useMutation({
    onSuccess: () => {
      toast({
        title: "Batch Pasteurized",
        description: `Successfully recorded pasteurization for ${bottleRunName} with ${calculatedPU.toFixed(2)} PU`,
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
    const pu = calculatePU(data.temperatureCelsius, data.timeMinutes);
    const pasteurizedAt = new Date(`${data.pasteurizedAt}T12:00:00.000Z`);

    pasteurizeMutation.mutate({
      runId: bottleRunId,
      pasteurizedAt: pasteurizedAt,
      temperatureCelsius: data.temperatureCelsius,
      timeMinutes: data.timeMinutes,
      pasteurizationUnits: pu,
      notes: data.notes,
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

            {/* Bottle Profile & Planning */}
            {plan && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">Pasteurization Plan (750mL Glass)</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <div className="text-gray-600">Time to 60°C:</div>
                      <div className="font-semibold text-gray-900">{plan.time_to_reach_hold_min} min</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Thermometer className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <div className="text-gray-600">Hold Time @ 65°C:</div>
                      <div className="font-semibold text-gray-900">{plan.time_at_hold_min.toFixed(1)} min</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <div className="text-gray-600">Total Bath Time:</div>
                      <div className="font-semibold text-gray-900">{Math.ceil(plan.total_bath_time_min)} min</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-gray-500" />
                    <div>
                      <div className="text-gray-600">Expected PU:</div>
                      <div className="font-semibold text-gray-900">{plan.PU_breakdown.total.toFixed(1)} PU</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">PU Breakdown:</span> Heat-up: {plan.PU_breakdown.heatup} •
                    Hold: {plan.PU_breakdown.hold.toFixed(1)} • Cool-down: {plan.PU_breakdown.cooldown}
                  </div>
                </div>
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

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="pasteurizedAt">
                  Pasteurization Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pasteurizedAt"
                  type="date"
                  {...register("pasteurizedAt")}
                />
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
                  type="number"
                  step="0.1"
                  {...register("temperatureCelsius", { valueAsNumber: true })}
                  placeholder="65"
                />
                {errors.temperatureCelsius && (
                  <p className="text-sm text-red-500">{errors.temperatureCelsius.message}</p>
                )}
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label htmlFor="timeMinutes">
                  Total Bath Time (minutes) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="timeMinutes"
                  type="number"
                  step="0.1"
                  {...register("timeMinutes", { valueAsNumber: true })}
                  placeholder={plan ? Math.ceil(plan.total_bath_time_min).toString() : "8"}
                />
                {errors.timeMinutes && (
                  <p className="text-sm text-red-500">{errors.timeMinutes.message}</p>
                )}
              </div>
            </div>

            {/* Calculated PU & Validation */}
            {validation && (() => {
              const colors = getValidationColors();
              return (
                <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${colors.text}`}>
                      Achieved Pasteurization Units:
                    </span>
                    <span className={`text-2xl font-bold ${colors.textBold}`}>
                      {calculatedPU.toFixed(2)} PU
                    </span>
                  </div>

                  <div className="flex items-start gap-2 mt-3">
                    {validation.status === 'optimal' && <span className="text-xl">✓</span>}
                    {validation.status === 'acceptable' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                    {validation.status === 'insufficient' && <span className="text-xl">✗</span>}
                    <p className={`text-sm ${colors.text}`}>{validation.message}</p>
                  </div>

                  <div className={`text-xs ${colors.text} mt-3 pt-3 border-t ${colors.border}`}>
                    Formula: PU = {timeMinutes} × 10^(({temperatureCelsius} - 60) / 7) = {calculatedPU.toFixed(2)}
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
                <li>Preheat water bath to 65°C</li>
                <li>Load bottles gently (room temp 20-22°C)</li>
                <li>Insert probe bottle to monitor core temperature</li>
                <li>Begin timing when probe reaches 60°C (~6 min)</li>
                <li>Hold for recommended time ({plan ? Math.ceil(plan.time_at_hold_min) : '2-3'} min at 65°C)</li>
                <li>Remove and cool gradually</li>
              </ol>
              <p className="text-xs text-amber-700 mt-2">
                Expected total: {plan ? Math.ceil(plan.total_bath_time_min) : '8'} min •
                Target PU: {productClassification?.targetPU_min || 30}
              </p>
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
                  !temperatureCelsius ||
                  !timeMinutes
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
