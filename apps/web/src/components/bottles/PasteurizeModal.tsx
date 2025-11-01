"use client";

import React, { useEffect } from "react";
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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Flame, Info, Loader2 } from "lucide-react";

const pasteurizeSchema = z.object({
  temperatureCelsius: z.number().min(60, "Temperature must be at least 60°C").max(100, "Temperature must be at most 100°C"),
  timeMinutes: z.number().positive("Time must be positive").max(120, "Time must be at most 120 minutes"),
  notes: z.string().optional(),
});

type PasteurizeForm = z.infer<typeof pasteurizeSchema>;

interface PasteurizeModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  unitsProduced: number;
  onSuccess: () => void;
}

/**
 * Calculate Pasteurization Units (PU)
 * Formula: PU = time * 1.393^(T - 60)
 * Where T is temperature in Celsius and 60°C is the reference temperature
 */
function calculatePU(temperatureCelsius: number, timeMinutes: number): number {
  const PU = timeMinutes * Math.pow(1.393, temperatureCelsius - 60);
  return Math.round(PU * 100) / 100; // Round to 2 decimal places
}

export function PasteurizeModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  unitsProduced,
  onSuccess,
}: PasteurizeModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<PasteurizeForm>({
    resolver: zodResolver(pasteurizeSchema),
    defaultValues: {
      temperatureCelsius: 72,
      timeMinutes: 15,
    },
  });

  const temperatureCelsius = watch("temperatureCelsius");
  const timeMinutes = watch("timeMinutes");

  // Calculate PU in real-time
  const calculatedPU = temperatureCelsius && timeMinutes
    ? calculatePU(temperatureCelsius, timeMinutes)
    : 0;

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        temperatureCelsius: 72,
        timeMinutes: 15,
      });
    }
  }, [open, reset]);

  const pasteurizeMutation = trpc.bottles.pasteurize.useMutation({
    onSuccess: () => {
      toast({
        title: "Batch Pasteurized",
        description: `Successfully recorded pasteurization for ${bottleRunName} with ${calculatedPU} PU`,
      });
      utils.bottles.list.invalidate();
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

    pasteurizeMutation.mutate({
      runId: bottleRunId,
      temperatureCelsius: data.temperatureCelsius,
      timeMinutes: data.timeMinutes,
      pasteurizationUnits: pu,
      notes: data.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Pasteurize Batch
          </DialogTitle>
          <DialogDescription>
            Record pasteurization parameters for {bottleRunName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Bottle Run Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Units Produced:</span>
              <span className="font-semibold text-blue-900">
                {unitsProduced.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label htmlFor="temperatureCelsius">
              Temperature (°C) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="temperatureCelsius"
              type="number"
              step="0.1"
              {...register("temperatureCelsius", { valueAsNumber: true })}
              placeholder="e.g., 72"
            />
            {errors.temperatureCelsius && (
              <p className="text-sm text-red-500">{errors.temperatureCelsius.message}</p>
            )}
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Typical pasteurization: 72°C for 15 min or 77°C for 1 min
              </span>
            </div>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="timeMinutes">
              Time (minutes) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="timeMinutes"
              type="number"
              step="0.1"
              {...register("timeMinutes", { valueAsNumber: true })}
              placeholder="e.g., 15"
            />
            {errors.timeMinutes && (
              <p className="text-sm text-red-500">{errors.timeMinutes.message}</p>
            )}
          </div>

          {/* Calculated PU */}
          {calculatedPU > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-900">
                  Pasteurization Units (PU):
                </span>
                <span className="text-lg font-bold text-orange-600">
                  {calculatedPU.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-orange-700 mt-1">
                Formula: PU = {timeMinutes} × 1.393^({temperatureCelsius} - 60)
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional pasteurization notes..."
              rows={3}
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
      </DialogContent>
    </Dialog>
  );
}
