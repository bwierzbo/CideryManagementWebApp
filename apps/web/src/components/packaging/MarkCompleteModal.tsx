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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { CheckCircle, Loader2, AlertTriangle, Minus, Tag, Flame, Beaker, Wine, Package, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const markCompleteSchema = z.object({
  completedAt: z.string().min(1, "Please select a date and time"),
});

type MarkCompleteForm = z.infer<typeof markCompleteSchema>;

interface MarkCompleteModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  unitsProduced: number;
  onSuccess: () => void;
}

// Checklist item component
function ChecklistItem({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  status: "complete" | "warning" | "optional";
  detail?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-lg",
      status === "complete" && "bg-green-50",
      status === "warning" && "bg-amber-50",
      status === "optional" && "bg-gray-50"
    )}>
      <div className={cn(
        "flex-shrink-0",
        status === "complete" && "text-green-600",
        status === "warning" && "text-amber-600",
        status === "optional" && "text-gray-400"
      )}>
        {status === "complete" ? (
          <CheckCircle className="w-5 h-5" />
        ) : status === "warning" ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <Minus className="w-5 h-5" />
        )}
      </div>
      <Icon className={cn(
        "w-4 h-4 flex-shrink-0",
        status === "complete" && "text-green-700",
        status === "warning" && "text-amber-700",
        status === "optional" && "text-gray-500"
      )} />
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm font-medium",
          status === "complete" && "text-green-900",
          status === "warning" && "text-amber-900",
          status === "optional" && "text-gray-600"
        )}>
          {label}
        </div>
        {detail && (
          <div className={cn(
            "text-xs",
            status === "complete" && "text-green-700",
            status === "warning" && "text-amber-700",
            status === "optional" && "text-gray-500"
          )}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export function MarkCompleteModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  unitsProduced,
  onSuccess,
}: MarkCompleteModalProps) {
  const utils = trpc.useUtils();
  const [dateWarning, setDateWarning] = React.useState<string | null>(null);
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Fetch bottle run data for checklist
  const { data: bottleRunData, isLoading: isLoadingData } = trpc.packaging.get.useQuery(
    bottleRunId,
    { enabled: open && !!bottleRunId }
  );

  // Date validation with phase-specific checks for completion
  const { validateDate } = useBatchDateValidation(bottleRunData?.batchId, {
    bottleRunId,
    phase: "completion",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<MarkCompleteForm>({
    resolver: zodResolver(markCompleteSchema),
    defaultValues: {
      completedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    },
  });

  // Watch completedAt for validation
  const completedAt = watch("completedAt");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        completedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      });
      setDateWarning(null);
      setDateError(null);
    }
  }, [open, reset]);

  // Validate date when completedAt changes
  useEffect(() => {
    if (completedAt) {
      const result = validateDate(completedAt);
      setDateWarning(result.warning);
      setDateError(result.error ?? null);
    }
  }, [completedAt, validateDate]);

  const markCompleteMutation = trpc.packaging.markComplete.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${bottleRunName} marked as complete. Items are now in inventory.`,
      });
      utils.packaging.list.invalidate();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark packaging run as complete",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MarkCompleteForm) => {
    const completedAt = new Date(data.completedAt);
    markCompleteMutation.mutate({
      runId: bottleRunId,
      completedAt: completedAt,
    });
  };

  // Calculate checklist statuses
  const unitsLabeled = bottleRunData?.unitsLabeled ?? 0;
  const isFullyLabeled = unitsLabeled >= unitsProduced;
  const isPasteurized = !!bottleRunData?.pasteurizedAt;
  const hasQACheck = !!bottleRunData?.fillCheck && bottleRunData.fillCheck !== "not_tested";

  // ABV - check explicit packaging ABV first, then fall back to batch measurements
  const explicitABV = bottleRunData?.abvAtPackaging;
  const batchABV = bottleRunData?.batch?.history?.measurements
    ?.filter((m: any) => m.abv !== null && m.abv !== undefined)
    ?.sort((a: any, b: any) => new Date(b.measurementDate).getTime() - new Date(a.measurementDate).getTime())
    ?.[0]?.abv;
  const hasABV = !!explicitABV || !!batchABV;
  const abvValue = explicitABV ?? batchABV;
  const abvIsFromBatch = !explicitABV && !!batchABV;

  const hasInventory = (bottleRunData?.inventory?.length ?? 0) > 0;
  const hasNotes = !!bottleRunData?.productionNotes;
  // Check for carbonation - either CO2 volumes from operation or carbonation level enum
  const hasCarbonation = !!bottleRunData?.carbonationCo2Volumes || !!bottleRunData?.carbonationLevel;
  const carbonationDisplay = bottleRunData?.carbonationCo2Volumes
    ? `${parseFloat(String(bottleRunData.carbonationCo2Volumes)).toFixed(2)} CO₂ volumes`
    : bottleRunData?.carbonationLevel
      ? bottleRunData.carbonationLevel.charAt(0).toUpperCase() + bottleRunData.carbonationLevel.slice(1)
      : null;

  // Count warnings (items that should be completed before marking complete)
  const warningCount = [
    !isFullyLabeled,
    !hasQACheck,
    !hasABV,
  ].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Mark as Complete
          </DialogTitle>
          <DialogDescription>
            Review the checklist below before marking {bottleRunName} as complete.
          </DialogDescription>
        </DialogHeader>

        {/* Pre-Completion Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Pre-Completion Checklist</h4>
            {warningCount > 0 && (
              <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                {warningCount} item{warningCount > 1 ? "s" : ""} to review
              </span>
            )}
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Labeling - Critical */}
              <ChecklistItem
                icon={Tag}
                label="Labeling"
                status={isFullyLabeled ? "complete" : "warning"}
                detail={isFullyLabeled
                  ? `${unitsLabeled}/${unitsProduced} bottles labeled`
                  : `Only ${unitsLabeled}/${unitsProduced} bottles labeled`
                }
              />

              {/* Pasteurization - Show if done, otherwise optional */}
              <ChecklistItem
                icon={Flame}
                label="Pasteurization"
                status={isPasteurized ? "complete" : "optional"}
                detail={isPasteurized ? "Completed" : "Not pasteurized (optional)"}
              />

              {/* QA Fill Check - Important */}
              <ChecklistItem
                icon={Beaker}
                label="QA Fill Check"
                status={hasQACheck ? "complete" : "warning"}
                detail={hasQACheck
                  ? `${bottleRunData?.fillCheck === "pass" ? "Passed" : "Failed"}`
                  : "Not recorded"
                }
              />

              {/* ABV Recording - Important */}
              <ChecklistItem
                icon={Wine}
                label="ABV at Packaging"
                status={hasABV ? "complete" : "warning"}
                detail={hasABV
                  ? `${parseFloat(abvValue?.toString() || "0").toFixed(1)}%${abvIsFromBatch ? " (from batch)" : ""}`
                  : "Not recorded"
                }
              />

              {/* Inventory Created - Check if inventory items exist */}
              <ChecklistItem
                icon={Package}
                label="Inventory Items"
                status={hasInventory ? "complete" : "optional"}
                detail={hasInventory
                  ? `${bottleRunData?.inventory?.length} item${(bottleRunData?.inventory?.length ?? 0) > 1 ? "s" : ""} in inventory`
                  : "No inventory items (optional)"
                }
              />

              {/* Carbonation - Optional */}
              <ChecklistItem
                icon={Sparkles}
                label="Carbonation"
                status={hasCarbonation ? "complete" : "optional"}
                detail={carbonationDisplay || "Not specified (optional)"}
              />

              {/* Production Notes - Optional */}
              <ChecklistItem
                icon={FileText}
                label="Production Notes"
                status={hasNotes ? "complete" : "optional"}
                detail={hasNotes ? "Notes recorded" : "No notes (optional)"}
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Completion Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="completedAt">
              Completion Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="completedAt"
              type="datetime-local"
              {...register("completedAt")}
            />
            <DateWarning warning={dateWarning} error={dateError} />
            {errors.completedAt && (
              <p className="text-sm text-red-500">{errors.completedAt.message}</p>
            )}
          </div>

          {/* Warning message if there are items to review */}
          {warningCount > 0 && !isLoadingData && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {warningCount} item{warningCount > 1 ? "s" : ""} not yet recorded. You can still mark as complete, but consider reviewing the items above.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={markCompleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={markCompleteMutation.isPending || isLoadingData || !!dateError}
            >
              {markCompleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
