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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";

// Form validation schema
const bottleFormSchema = z.object({
  volumeTakenL: z.number().positive("Volume must be positive"),
  packagingItemId: z.string().min(1, "Please select a packaging type"),
  packageSizeMl: z.number().positive("Package size must be positive"),
  unitsProduced: z.number().int().min(0, "Units cannot be negative"),
  packagedAt: z.string().min(1, "Date/time is required"),
  notes: z.string().optional(),
});

type BottleFormData = z.infer<typeof bottleFormSchema>;

interface BottleModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchId: string;
  currentVolumeL: number;
}

export function BottleModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: BottleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPackaging, setSelectedPackaging] = useState<any>(null);

  // tRPC queries and mutations
  const packagingInventoryQuery = trpc.packagingPurchases.listInventory.useQuery({
    itemType: "Primary Packaging",
    limit: 100,
  });
  const createPackagingRunMutation =
    trpc.packaging.createFromCellar.useMutation();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BottleFormData>({
    resolver: zodResolver(bottleFormSchema),
    defaultValues: {
      packagedAt: new Date().toISOString().slice(0, 16), // Current date/time in local format
      notes: "",
    },
  });

  // Watch form values for real-time calculations
  const volumeTakenL = watch("volumeTakenL");
  const packagingItemId = watch("packagingItemId");
  const packageSizeMl = watch("packageSizeMl");
  const unitsProduced = watch("unitsProduced");

  // Update selectedPackaging when packagingItemId changes
  useEffect(() => {
    if (packagingItemId && packagingInventoryQuery.data?.items) {
      const selected = packagingInventoryQuery.data.items.find(
        (item) => item.id === packagingItemId
      );
      setSelectedPackaging(selected);
    } else {
      setSelectedPackaging(null);
    }
  }, [packagingItemId, packagingInventoryQuery.data]);

  // Calculate loss and loss percentage
  const unitSizeL = packageSizeMl / 1000;
  const expectedVolumeL = (unitsProduced || 0) * unitSizeL;
  const lossL = (volumeTakenL || 0) - expectedVolumeL;
  const lossPercentage = volumeTakenL > 0 ? (lossL / volumeTakenL) * 100 : 0;

  // Determine loss status and styling
  const getLossStatus = () => {
    if (lossL < 0)
      return {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: AlertTriangle,
        message: "Invalid: negative loss",
      };
    if (lossPercentage > 10)
      return {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: AlertTriangle,
        message: "Excessive loss (>10%)",
      };
    if (lossPercentage > 5)
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: AlertTriangle,
        message: "High loss (>5%)",
      };
    if (lossPercentage > 2)
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: AlertTriangle,
        message: "Moderate loss (2-5%)",
      };
    return {
      color: "text-green-600",
      bg: "bg-green-50",
      icon: CheckCircle,
      message: "Normal loss (<2%)",
    };
  };

  const lossStatus = getLossStatus();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        packagedAt: new Date().toISOString().slice(0, 16),
        notes: "",
      });
    }
  }, [open, reset]);

  const handleFormSubmit = async (data: BottleFormData) => {
    if (lossL < 0) {
      return; // Prevent submission with negative loss
    }

    setIsSubmitting(true);
    try {
      const result = await createPackagingRunMutation.mutateAsync({
        batchId,
        vesselId,
        packagedAt: new Date(data.packagedAt),
        packageSizeMl: data.packageSizeMl,
        unitsProduced: data.unitsProduced,
        volumeTakenL: data.volumeTakenL,
        notes: data.notes,
      });

      // Invalidate relevant queries to refresh data
      utils.vessel.liquidMap.invalidate();
      utils.batch.list.invalidate();

      // Show success toast with option to view packaging run
      toast({
        title: "Packaging Run Created",
        description: `Successfully packaged ${data.unitsProduced} units from ${vesselName}. Loss: ${result.lossL.toFixed(2)}L (${result.lossPercentage.toFixed(1)}%)`,
      });

      console.log("Packaging run created:", result);
      onClose();
    } catch (error) {
      console.error("Failed to create packaging run:", error);

      // Show error toast with specific error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Failed to Create Packaging Run",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg md:text-xl truncate pr-8">
            Bottle from {vesselName}
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            Package contents from this vessel. Available volume:{" "}
            {currentVolumeL.toFixed(1)}L
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-4 md:space-y-6"
        >
          {/* Available tank volume - display only */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Label className="text-sm font-medium text-blue-900">
              Available Volume in Tank
            </Label>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {currentVolumeL.toFixed(1)}L
            </p>
          </div>

          {/* Volume taken */}
          <div>
            <Label
              htmlFor="volumeTakenL"
              className="text-sm md:text-base font-medium"
            >
              Volume to use for bottling (L) *
            </Label>
            <Input
              id="volumeTakenL"
              type="number"
              step="0.1"
              max={currentVolumeL}
              placeholder={`Max ${currentVolumeL.toFixed(1)}L available`}
              className="h-10 md:h-11 text-base"
              {...register("volumeTakenL", { valueAsNumber: true })}
            />
            {errors.volumeTakenL && (
              <p className="text-sm text-red-600 mt-1">
                {errors.volumeTakenL.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Liters to be removed from tank for bottling
            </p>
          </div>

          {/* Select packaging type from inventory */}
          <div>
            <Label
              htmlFor="packagingItemId"
              className="text-sm md:text-base font-medium"
            >
              Packaging Type *
            </Label>
            <Select
              onValueChange={(value) => {
                setValue("packagingItemId", value);
                // Reset package size when packaging type changes
                setValue("packageSizeMl", 0);
              }}
            >
              <SelectTrigger className="h-10 md:h-11">
                <SelectValue placeholder="Select packaging from inventory" />
              </SelectTrigger>
              <SelectContent>
                {packagingInventoryQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading packaging...
                  </SelectItem>
                ) : packagingInventoryQuery.data?.items?.length ? (
                  packagingInventoryQuery.data.items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.varietyName || item.size}
                        </span>
                        <span className="text-xs text-gray-500">
                          Available: {item.quantity} units | {item.vendorName || "Unknown vendor"}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No primary packaging available in inventory
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.packagingItemId && (
              <p className="text-sm text-red-600 mt-1">
                {errors.packagingItemId.message}
              </p>
            )}
            {selectedPackaging && (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                <p><strong>Selected:</strong> {selectedPackaging.varietyName || selectedPackaging.size}</p>
                <p><strong>Available:</strong> {selectedPackaging.quantity} units</p>
                {selectedPackaging.notes && <p><strong>Notes:</strong> {selectedPackaging.notes}</p>}
              </div>
            )}
          </div>

          {/* Package size input */}
          <div>
            <Label
              htmlFor="packageSizeMl"
              className="text-sm md:text-base font-medium"
            >
              Volume each package holds (mL) *
            </Label>
            <Input
              id="packageSizeMl"
              type="number"
              step="1"
              min="1"
              placeholder="e.g., 355, 500, 750"
              className="h-10 md:h-11 text-base"
              {...register("packageSizeMl", { valueAsNumber: true })}
              disabled={!packagingItemId}
            />
            {errors.packageSizeMl && (
              <p className="text-sm text-red-600 mt-1">
                {errors.packageSizeMl.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Volume in milliliters (mL) that each package holds
            </p>
          </div>

          {/* Units produced */}
          <div>
            <Label
              htmlFor="unitsProduced"
              className="text-sm md:text-base font-medium"
            >
              Units produced *
            </Label>
            <Input
              id="unitsProduced"
              type="number"
              min="0"
              placeholder="Number of packages filled"
              className="h-10 md:h-11 text-base"
              {...register("unitsProduced", { valueAsNumber: true })}
            />
            {errors.unitsProduced && (
              <p className="text-sm text-red-600 mt-1">
                {errors.unitsProduced.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Number of packages filled
            </p>
          </div>

          {/* Computed loss display */}
          {volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
            <div className={`p-3 md:p-4 rounded-lg border ${lossStatus.bg}`}>
              <div className="flex items-center space-x-2 mb-2">
                <lossStatus.icon
                  className={`w-4 h-4 md:w-5 md:h-5 ${lossStatus.color} flex-shrink-0`}
                />
                <Label
                  className={`font-medium ${lossStatus.color} text-sm md:text-base`}
                >
                  Computed Loss
                </Label>
              </div>
              <div className="space-y-1">
                <p
                  className={`text-base md:text-lg font-semibold ${lossStatus.color}`}
                >
                  {lossL.toFixed(2)}L ({lossPercentage.toFixed(1)}%)
                </p>
                <p className={`text-sm ${lossStatus.color}`}>
                  {lossStatus.message}
                </p>
                <p className="text-xs text-gray-600 break-words">
                  Formula: {volumeTakenL.toFixed(1)}L taken - ({unitsProduced} ×{" "}
                  {unitSizeL.toFixed(3)}L)
                </p>
              </div>
            </div>
          )}

          {/* Date/time */}
          <div>
            <Label
              htmlFor="packagedAt"
              className="text-sm md:text-base font-medium"
            >
              Date/time *
            </Label>
            <Input
              id="packagedAt"
              type="datetime-local"
              className="h-10 md:h-11 text-base"
              {...register("packagedAt")}
            />
            {errors.packagedAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.packagedAt.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm md:text-base font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any observations about packaging run"
              maxLength={500}
              className="min-h-[80px] text-base resize-none"
              {...register("notes")}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || createPackagingRunMutation.isPending}
              className="w-full sm:w-auto h-10 md:h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createPackagingRunMutation.isPending ||
                lossL < 0 ||
                !volumeTakenL ||
                !packagingItemId ||
                !packageSizeMl ||
                unitsProduced === undefined
              }
              className="w-full sm:w-auto h-10 md:h-11"
            >
              <span className="hidden sm:inline">
                {isSubmitting || createPackagingRunMutation.isPending
                  ? "Creating..."
                  : "Complete & Go to /packaging"}
              </span>
              <span className="sm:hidden">
                {isSubmitting || createPackagingRunMutation.isPending
                  ? "Creating..."
                  : "Complete"}
              </span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
