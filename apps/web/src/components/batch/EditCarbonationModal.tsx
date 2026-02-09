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
import { useDateFormat } from "@/hooks/useDateFormat";
import { Loader2, Save } from "lucide-react";

const editCarbonationSchema = z.object({
  startedAt: z.string().min(1, "Start date is required"),
  completedAt: z.string().nullable().optional(),
  targetCo2Volumes: z.number().min(0).max(5),
  pressureApplied: z.number().min(0).max(50),
  carbonationProcess: z.enum(["headspace", "inline", "stone", "bottle_conditioning"]),
  finalCo2Volumes: z.number().min(0).max(5).nullable().optional(),
  finalPressure: z.number().min(0).max(50).nullable().optional(),
  finalTemperature: z.number().min(-5).max(25).nullable().optional(),
  qualityCheck: z.enum(["pass", "fail", "needs_adjustment", "in_progress"]),
  qualityNotes: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type EditCarbonationForm = z.infer<typeof editCarbonationSchema>;

interface EditCarbonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carbonation: {
    id: string;
    batchId: string;
    startedAt: string | Date;
    completedAt: string | Date | null;
    targetCo2Volumes: string | number;
    pressureApplied: string | number;
    carbonationProcess: string;
    finalCo2Volumes: string | number | null;
    finalPressure: string | number | null;
    finalTemperature: string | number | null;
    qualityCheck: string | null;
    qualityNotes: string | null;
    notes: string | null;
  };
  batchName: string;
  onSuccess?: () => void;
}

function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? null : n;
}

export function EditCarbonationModal({
  open,
  onOpenChange,
  carbonation,
  batchName,
  onSuccess,
}: EditCarbonationModalProps) {
  const utils = trpc.useUtils();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();

  // Wrapper to handle nullable dates for datetime-local inputs
  const toDatetimeLocal = (d: string | Date | null): string => {
    if (!d) return "";
    return formatDateTimeForInput(d);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditCarbonationForm>({
    resolver: zodResolver(editCarbonationSchema),
    defaultValues: {
      startedAt: toDatetimeLocal(carbonation.startedAt),
      completedAt: toDatetimeLocal(carbonation.completedAt),
      targetCo2Volumes: numOrNull(carbonation.targetCo2Volumes) ?? 0,
      pressureApplied: numOrNull(carbonation.pressureApplied) ?? 0,
      carbonationProcess: carbonation.carbonationProcess as "headspace" | "inline" | "stone" | "bottle_conditioning",
      finalCo2Volumes: numOrNull(carbonation.finalCo2Volumes),
      finalPressure: numOrNull(carbonation.finalPressure),
      finalTemperature: numOrNull(carbonation.finalTemperature),
      qualityCheck: (carbonation.qualityCheck as "pass" | "fail" | "needs_adjustment" | "in_progress") ?? "in_progress",
      qualityNotes: carbonation.qualityNotes ?? "",
      notes: carbonation.notes ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        startedAt: toDatetimeLocal(carbonation.startedAt),
        completedAt: toDatetimeLocal(carbonation.completedAt),
        targetCo2Volumes: numOrNull(carbonation.targetCo2Volumes) ?? 0,
        pressureApplied: numOrNull(carbonation.pressureApplied) ?? 0,
        carbonationProcess: carbonation.carbonationProcess as "headspace" | "inline" | "stone" | "bottle_conditioning",
        finalCo2Volumes: numOrNull(carbonation.finalCo2Volumes),
        finalPressure: numOrNull(carbonation.finalPressure),
        finalTemperature: numOrNull(carbonation.finalTemperature),
        qualityCheck: (carbonation.qualityCheck as "pass" | "fail" | "needs_adjustment" | "in_progress") ?? "in_progress",
        qualityNotes: carbonation.qualityNotes ?? "",
        notes: carbonation.notes ?? "",
      });
    }
  }, [open, reset, carbonation]);

  const updateMutation = trpc.carbonation.updateCarbonation.useMutation({
    onSuccess: () => {
      toast({
        title: "Carbonation Updated",
        description: `Carbonation operation updated for ${batchName}`,
      });
      utils.batch.get.invalidate({ batchId: carbonation.batchId });
      utils.carbonation.listActive.invalidate();
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCarbonationForm) => {
    updateMutation.mutate({
      carbonationId: carbonation.id,
      startedAt: parseDateTimeFromInput(data.startedAt),
      completedAt: data.completedAt ? parseDateTimeFromInput(data.completedAt) : null,
      targetCo2Volumes: data.targetCo2Volumes,
      pressureApplied: data.pressureApplied,
      carbonationProcess: data.carbonationProcess,
      finalCo2Volumes: data.finalCo2Volumes ?? null,
      finalPressure: data.finalPressure ?? null,
      finalTemperature: data.finalTemperature ?? null,
      qualityCheck: data.qualityCheck,
      qualityNotes: data.qualityNotes || null,
      notes: data.notes || null,
    });
  };

  const processLabels: Record<string, string> = {
    headspace: "Headspace (CO2 in headspace)",
    inline: "Inline (CO2 injected during transfer)",
    stone: "Carbonation Stone",
    bottle_conditioning: "Bottle Conditioning",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Carbonation Operation</DialogTitle>
          <DialogDescription>
            Modify carbonation details for {batchName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dates & Process */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Process Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startedAt">Started At</Label>
                <Input
                  id="startedAt"
                  type="datetime-local"
                  {...register("startedAt")}
                />
                {errors.startedAt && (
                  <p className="text-sm text-destructive mt-1">{errors.startedAt.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="completedAt">Completed At</Label>
                <Input
                  id="completedAt"
                  type="datetime-local"
                  {...register("completedAt")}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for in-progress</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="carbonationProcess">Method</Label>
                <Select
                  value={watch("carbonationProcess")}
                  onValueChange={(v) => setValue("carbonationProcess", v as "headspace" | "inline" | "stone" | "bottle_conditioning")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(processLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetCo2Volumes">Target CO2 (vol)</Label>
                <Input
                  id="targetCo2Volumes"
                  type="number"
                  step="0.01"
                  {...register("targetCo2Volumes", { valueAsNumber: true })}
                />
                {errors.targetCo2Volumes && (
                  <p className="text-sm text-destructive mt-1">{errors.targetCo2Volumes.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="pressureApplied">Pressure (PSI)</Label>
                <Input
                  id="pressureApplied"
                  type="number"
                  step="0.1"
                  {...register("pressureApplied", { valueAsNumber: true })}
                />
                {errors.pressureApplied && (
                  <p className="text-sm text-destructive mt-1">{errors.pressureApplied.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Final Measurements */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Final Measurements</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="finalCo2Volumes">Final CO2 (vol)</Label>
                <Input
                  id="finalCo2Volumes"
                  type="number"
                  step="0.01"
                  placeholder="—"
                  {...register("finalCo2Volumes", { setValueAs: (v) => v === "" || v === null || v === undefined ? null : Number.isNaN(Number(v)) ? null : Number(v) })}
                />
              </div>
              <div>
                <Label htmlFor="finalPressure">Final Pressure (PSI)</Label>
                <Input
                  id="finalPressure"
                  type="number"
                  step="0.1"
                  placeholder="—"
                  {...register("finalPressure", { setValueAs: (v) => v === "" || v === null || v === undefined ? null : Number.isNaN(Number(v)) ? null : Number(v) })}
                />
              </div>
              <div>
                <Label htmlFor="finalTemperature">Final Temp (°C)</Label>
                <Input
                  id="finalTemperature"
                  type="number"
                  step="0.1"
                  placeholder="—"
                  {...register("finalTemperature", { setValueAs: (v) => v === "" || v === null || v === undefined ? null : Number.isNaN(Number(v)) ? null : Number(v) })}
                />
              </div>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Quality Assessment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qualityCheck">Quality</Label>
                <Select
                  value={watch("qualityCheck")}
                  onValueChange={(v) => setValue("qualityCheck", v as "pass" | "fail" | "needs_adjustment" | "in_progress")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pass">Pass</SelectItem>
                    <SelectItem value="needs_adjustment">Needs Adjustment</SelectItem>
                    <SelectItem value="fail">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="qualityNotes">Quality Notes</Label>
                <Input
                  id="qualityNotes"
                  placeholder="Optional notes"
                  {...register("qualityNotes")}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">General Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes about this carbonation operation"
              {...register("notes")}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
