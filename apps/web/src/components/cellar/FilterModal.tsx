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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Filter, AlertTriangle } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";
import { convertVolume } from "lib";

const filterSchema = z.object({
  filterType: z.enum(["coarse", "fine", "sterile"], {
    message: "Please select a filter type",
  }),
  volumeBefore: z.number().positive("Volume must be positive"),
  volumeBeforeUnit: z.enum(["L", "gal"]),
  volumeAfter: z.number().positive("Volume must be positive"),
  volumeAfterUnit: z.enum(["L", "gal"]),
  filteredAt: z.date(),
});

type FilterForm = z.infer<typeof filterSchema>;

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchId: string;
  currentVolumeL: number;
}

export function FilterModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: FilterModalProps) {
  const utils = trpc.useUtils();
  const [showLossWarning, setShowLossWarning] = useState(false);
  const [calculatedLoss, setCalculatedLoss] = useState(0);
  const [lossPercentage, setLossPercentage] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FilterForm>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      volumeBeforeUnit: "L",
      volumeAfterUnit: "L",
      volumeBefore: currentVolumeL,
      filteredAt: new Date(),
    },
  });

  const filterType = watch("filterType");
  const volumeBefore = watch("volumeBefore");
  const volumeBeforeUnit = watch("volumeBeforeUnit");
  const volumeAfter = watch("volumeAfter");
  const volumeAfterUnit = watch("volumeAfterUnit");
  const filteredAt = watch("filteredAt");

  // Calculate loss whenever volumes change
  useEffect(() => {
    if (volumeBefore && volumeAfter) {
      // Convert both to liters for calculation
      const beforeL = volumeBeforeUnit === "gal"
        ? convertVolume(volumeBefore, "gal", "L")
        : volumeBefore;
      const afterL = volumeAfterUnit === "gal"
        ? convertVolume(volumeAfter, "gal", "L")
        : volumeAfter;

      const loss = beforeL - afterL;
      const lossPercent = (loss / beforeL) * 100;

      setCalculatedLoss(loss);
      setLossPercentage(lossPercent);

      // Show warning if loss > 10%
      if (lossPercent > 10) {
        setShowLossWarning(true);
      } else {
        setShowLossWarning(false);
      }
    }
  }, [volumeBefore, volumeBeforeUnit, volumeAfter, volumeAfterUnit]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      reset({
        volumeBefore: currentVolumeL,
        volumeBeforeUnit: "L",
        volumeAfterUnit: "L",
        filteredAt: new Date(),
      });
    }
  }, [open, currentVolumeL, reset]);

  const filterMutation = trpc.batch.filter.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Filter Operation Successful",
        description: data.message,
      });
      utils.vessel.liquidMap.invalidate();
      utils.batch.getActivityHistory.invalidate();
      utils.batch.list.invalidate();
      onClose();
      reset();
    },
    onError: (error) => {
      toast({
        title: "Filter Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FilterForm) => {
    if (data.volumeAfter >= data.volumeBefore) {
      toast({
        title: "Invalid Volumes",
        description: "Volume after filtering must be less than volume before",
        variant: "destructive",
      });
      return;
    }

    filterMutation.mutate({
      batchId,
      vesselId,
      filterType: data.filterType,
      volumeBefore: data.volumeBefore,
      volumeBeforeUnit: data.volumeBeforeUnit,
      volumeAfter: data.volumeAfter,
      volumeAfterUnit: data.volumeAfterUnit,
      filteredAt: data.filteredAt,
      filteredBy: undefined, // Could be populated from user session
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Batch - {vesselName}
          </DialogTitle>
          <DialogDescription>
            Record a filtering operation for this batch
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="filteredAt">
              Filter Date <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={filteredAt ? filteredAt.toISOString().split('T')[0] : ''}
              onChange={(e) => setValue("filteredAt", new Date(e.target.value))}
              className="w-full mt-1"
            />
            {errors.filteredAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.filteredAt.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="filterType">Filter Type</Label>
            <Select
              value={filterType}
              onValueChange={(value) => setValue("filterType", value as any)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coarse">Coarse Filter</SelectItem>
                <SelectItem value="fine">Fine Filter</SelectItem>
                <SelectItem value="sterile">Sterile Filter</SelectItem>
              </SelectContent>
            </Select>
            {errors.filterType && (
              <p className="text-sm text-red-600 mt-1">
                {errors.filterType.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Coarse: Removes large particles | Fine: Removes small particles | Sterile: Final filtering
            </p>
          </div>

          <div>
            <Label htmlFor="volumeBefore">Volume Before Filtering</Label>
            <VolumeInput
              id="volumeBefore"
              value={volumeBefore}
              unit={volumeBeforeUnit as VolumeUnit}
              onValueChange={(value) => setValue("volumeBefore", value || 0)}
              onUnitChange={(unit) => setValue("volumeBeforeUnit", unit as "L" | "gal")}
              placeholder="Current volume"
              className="mt-1"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Current batch volume (read-only)
            </p>
          </div>

          <div>
            <Label htmlFor="volumeAfter">Volume After Filtering</Label>
            <VolumeInput
              id="volumeAfter"
              value={volumeAfter}
              unit={volumeAfterUnit as VolumeUnit}
              onValueChange={(value) => setValue("volumeAfter", value || 0)}
              onUnitChange={(unit) => setValue("volumeAfterUnit", unit as "L" | "gal")}
              placeholder="Volume after filtering"
              className="mt-1"
              required
            />
            {errors.volumeAfter && (
              <p className="text-sm text-red-600 mt-1">
                {errors.volumeAfter.message}
              </p>
            )}
          </div>

          {/* Loss Display */}
          {volumeBefore && volumeAfter && volumeAfter < volumeBefore && (
            <div className={`p-3 rounded-lg ${
              showLossWarning
                ? "bg-orange-50 border border-orange-200"
                : "bg-gray-50 border border-gray-200"
            }`}>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">Calculated Loss:</span>
                  <span className={showLossWarning ? "text-orange-700 font-semibold" : "text-gray-700"}>
                    {calculatedLoss.toFixed(2)}L ({lossPercentage.toFixed(1)}%)
                  </span>
                </div>
                {showLossWarning && (
                  <div className="flex items-start gap-2 text-orange-700 mt-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">
                      High loss detected (&gt;10%). Please verify the volume after filtering is correct.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={filterMutation.isPending || !volumeAfter || volumeAfter >= volumeBefore}
            >
              {filterMutation.isPending ? "Filtering..." : "Record Filter Operation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}