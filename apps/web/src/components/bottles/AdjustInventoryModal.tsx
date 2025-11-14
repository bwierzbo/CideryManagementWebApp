"use client";

import React from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Edit, AlertCircle, Package } from "lucide-react";

const adjustInventorySchema = z.object({
  adjustmentType: z.enum(["breakage", "sample", "transfer", "correction", "void"]),
  quantityChange: z.number().int().refine((val) => val !== 0, {
    message: "Quantity change cannot be zero",
  }),
  reason: z.string().min(1, "Reason is required"),
});

type AdjustInventoryForm = z.infer<typeof adjustInventorySchema>;

interface AdjustInventoryModalProps {
  open: boolean;
  onClose: () => void;
  inventoryItemId: string;
  productName: string;
  currentQuantity: number;
  onSuccess?: () => void;
}

const adjustmentTypeLabels = {
  breakage: "Breakage/Damage",
  sample: "Sample/Tasting",
  transfer: "Transfer/Relocation",
  correction: "Inventory Correction",
  void: "Void/Write-off",
};

const adjustmentTypeDescriptions = {
  breakage: "Units lost due to breakage or damage",
  sample: "Units used for sampling or tasting events",
  transfer: "Units transferred to another location",
  correction: "Correcting inventory count discrepancies",
  void: "Voiding units (expired, recalled, etc.)",
};

export function AdjustInventoryModal({
  open,
  onClose,
  inventoryItemId,
  productName,
  currentQuantity,
  onSuccess,
}: AdjustInventoryModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<AdjustInventoryForm>({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: {
      quantityChange: 0,
      reason: "",
    },
  });

  // Watch values for real-time calculations
  const watchQuantityChange = watch("quantityChange");
  const watchAdjustmentType = watch("adjustmentType");

  // Calculate new quantity
  const newQuantity = currentQuantity + (watchQuantityChange || 0);
  const isNegativeResult = newQuantity < 0;
  const isAddition = (watchQuantityChange || 0) > 0;

  const adjustMutation = trpc.inventory.adjustInventory.useMutation({
    onSuccess: () => {
      toast({
        title: "Inventory Adjusted",
        description: `${productName} inventory updated successfully.`,
      });
      reset();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdjustInventoryForm) => {
    // Validate new quantity won't be negative
    if (newQuantity < 0) {
      toast({
        title: "Invalid Adjustment",
        description: `Adjustment would result in negative inventory (${newQuantity} units).`,
        variant: "destructive",
      });
      return;
    }

    adjustMutation.mutate({
      inventoryItemId,
      adjustmentType: data.adjustmentType,
      quantityChange: data.quantityChange,
      reason: data.reason,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Adjust Inventory
          </DialogTitle>
          <DialogDescription>
            Adjust inventory for {productName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Quantity Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Current Quantity
                </span>
              </div>
              <span className="text-lg font-bold text-blue-900">
                {currentQuantity.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Adjustment Type */}
          <div>
            <Label htmlFor="adjustmentType">
              Adjustment Type <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value) =>
                setValue(
                  "adjustmentType",
                  value as "breakage" | "sample" | "transfer" | "correction" | "void",
                )
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select adjustment type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(adjustmentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-gray-500">
                        {adjustmentTypeDescriptions[value as keyof typeof adjustmentTypeDescriptions]}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.adjustmentType && (
              <p className="text-sm text-red-600 mt-1">
                {errors.adjustmentType.message}
              </p>
            )}
          </div>

          {/* Quantity Change */}
          <div>
            <Label htmlFor="quantityChange">
              Quantity Change <span className="text-red-500">*</span>
            </Label>
            <div className="mt-1">
              <Input
                id="quantityChange"
                type="number"
                placeholder="Enter positive or negative number"
                {...register("quantityChange", { valueAsNumber: true })}
                className={
                  isAddition
                    ? "border-green-300 focus:border-green-500"
                    : "border-red-300 focus:border-red-500"
                }
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use negative numbers to remove units (e.g., -5), positive to add (e.g., +10)
            </p>
            {errors.quantityChange && (
              <p className="text-sm text-red-600 mt-1">
                {errors.quantityChange.message}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this adjustment is needed..."
              {...register("reason")}
              className="mt-1 min-h-[80px]"
            />
            {errors.reason && (
              <p className="text-sm text-red-600 mt-1">{errors.reason.message}</p>
            )}
          </div>

          {/* Real-time Calculation */}
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Quantity:</span>
              <span className="font-semibold text-gray-900">
                {currentQuantity.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Change:</span>
              <span
                className={`font-semibold ${
                  isAddition ? "text-green-600" : "text-red-600"
                }`}
              >
                {isAddition ? "+" : ""}
                {(watchQuantityChange || 0).toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-900 font-medium">New Quantity:</span>
              <span
                className={`text-lg font-bold ${
                  isNegativeResult
                    ? "text-red-600"
                    : newQuantity === 0
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {newQuantity.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Validation Warning */}
          {isNegativeResult && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Invalid Adjustment
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This adjustment would result in negative inventory. Please adjust
                  the quantity change.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustMutation.isPending || isNegativeResult || !watchAdjustmentType}
            >
              {adjustMutation.isPending ? "Adjusting..." : "Adjust Inventory"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
