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
import { useDateFormat } from "@/hooks/useDateFormat";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { calculateAbv } from "lib";
import { DateWarning } from "@/components/ui/DateWarning";
import { CheckCircle, Loader2, AlertTriangle, Minus, Tag, Flame, Beaker, Wine, Package, FileText, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const markCompleteSchema = z.object({
  completedAt: z.string()
    .min(1, "Please select a date and time")
    .refine((val) => {
      const year = parseInt(val.substring(0, 4), 10);
      return year >= 1900 && year <= 2099;
    }, "Year must be between 1900 and 2099"),
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
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
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
      completedAt: formatDateTimeForInput(new Date()),
    },
  });

  // Watch completedAt for validation
  const completedAt = watch("completedAt");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        completedAt: formatDateTimeForInput(new Date()),
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
    const completedAt = parseDateTimeFromInput(data.completedAt);
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

  // ABV - check explicit packaging ABV first, then batch measurements, then calculate from SG
  const explicitABV = bottleRunData?.abvAtPackaging;
  const batchABV = bottleRunData?.batch?.history?.measurements
    ?.filter((m: any) => m.abv !== null && m.abv !== undefined)
    ?.sort((a: any, b: any) => new Date(b.measurementDate).getTime() - new Date(a.measurementDate).getTime())
    ?.[0]?.abv;

  // Calculate ABV from SG if no explicit ABV is available
  let calculatedABV: number | null = null;
  if (!explicitABV && !batchABV) {
    const measurements = bottleRunData?.batch?.history?.measurements ?? [];
    const sgValues = measurements
      .filter((m: any) => m.specificGravity !== null && m.specificGravity !== undefined)
      .map((m: any) => typeof m.specificGravity === 'number' ? m.specificGravity : parseFloat(m.specificGravity));

    if (sgValues.length >= 2) {
      const og = Math.max(...sgValues);
      const fg = Math.min(...sgValues);
      if (og > fg) {
        try {
          calculatedABV = calculateAbv(og, fg);
        } catch (error) {
          // Calculation failed, leave as null
        }
      }
    }
  }

  const hasABV = !!explicitABV || !!batchABV || !!calculatedABV;
  const abvValue = explicitABV ?? batchABV ?? calculatedABV;
  const abvIsFromBatch = !explicitABV && !!batchABV;
  const abvIsEstimated = !explicitABV && !batchABV && !!calculatedABV;

  const hasInventory = (bottleRunData?.inventory?.length ?? 0) > 0;
  const hasNotes = !!bottleRunData?.productionNotes;
  // Check for carbonation - either CO2 volumes from operation or carbonation level enum
  const hasCarbonation = !!bottleRunData?.carbonationCo2Volumes || !!bottleRunData?.carbonationLevel;
  const carbonationDisplay = bottleRunData?.carbonationCo2Volumes
    ? `${parseFloat(String(bottleRunData.carbonationCo2Volumes)).toFixed(2)} CO₂ volumes`
    : bottleRunData?.carbonationLevel
      ? bottleRunData.carbonationLevel.charAt(0).toUpperCase() + bottleRunData.carbonationLevel.slice(1)
      : null;

  // Date sequence validation
  const dateSequenceIssues: string[] = [];
  const packagedAt = bottleRunData?.packagedAt ? new Date(bottleRunData.packagedAt) : null;
  const pasteurizedAt = bottleRunData?.pasteurizedAt ? new Date(bottleRunData.pasteurizedAt) : null;
  const labeledAt = bottleRunData?.labeledAt ? new Date(bottleRunData.labeledAt) : null;
  const completionDate = completedAt ? new Date(completedAt) : null;
  const batchStartDate = bottleRunData?.batch?.startDate
    ? new Date(bottleRunData.batch.startDate)
    : null;

  // Helper to format date for display
  const formatDateShort = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Check: Bottling should be after batch start
  if (batchStartDate && packagedAt && packagedAt < batchStartDate) {
    dateSequenceIssues.push(`Bottling (${formatDateShort(packagedAt)}) is before batch start (${formatDateShort(batchStartDate)})`);
  }

  // Check: Pasteurization should be after bottling
  if (packagedAt && pasteurizedAt && pasteurizedAt < packagedAt) {
    dateSequenceIssues.push(`Pasteurization (${formatDateShort(pasteurizedAt)}) is before bottling (${formatDateShort(packagedAt)})`);
  }

  // Check: Labeling should be after bottling
  if (packagedAt && labeledAt && labeledAt < packagedAt) {
    dateSequenceIssues.push(`Labeling (${formatDateShort(labeledAt)}) is before bottling (${formatDateShort(packagedAt)})`);
  }

  // Check: Completion should be after bottling
  if (packagedAt && completionDate && completionDate < packagedAt) {
    dateSequenceIssues.push(`Completion (${formatDateShort(completionDate)}) is before bottling (${formatDateShort(packagedAt)})`);
  }

  // Check: Completion should be after pasteurization (if done)
  if (pasteurizedAt && completionDate && completionDate < pasteurizedAt) {
    dateSequenceIssues.push(`Completion (${formatDateShort(completionDate)}) is before pasteurization (${formatDateShort(pasteurizedAt)})`);
  }

  // Check: Completion should be after labeling (if done)
  if (labeledAt && completionDate && completionDate < labeledAt) {
    dateSequenceIssues.push(`Completion (${formatDateShort(completionDate)}) is before labeling (${formatDateShort(labeledAt)})`);
  }

  const hasDateSequenceIssues = dateSequenceIssues.length > 0;

  // Count warnings (items that should be completed before marking complete)
  const warningCount = [
    !isFullyLabeled,
    !hasQACheck,
    !hasABV,
    hasDateSequenceIssues,
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
                  ? `${parseFloat(abvValue?.toString() || "0").toFixed(1)}%${abvIsFromBatch ? " (from batch)" : abvIsEstimated ? " (est. from SG)" : ""}`
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

              {/* Date Sequence - Important */}
              <ChecklistItem
                icon={Calendar}
                label="Date Sequence"
                status={hasDateSequenceIssues ? "warning" : "complete"}
                detail={hasDateSequenceIssues
                  ? dateSequenceIssues[0] + (dateSequenceIssues.length > 1 ? ` (+${dateSequenceIssues.length - 1} more)` : "")
                  : "All dates in correct order"
                }
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
              max="2099-12-31T23:59"
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
