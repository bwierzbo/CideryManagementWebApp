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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp } from "lucide-react";

const updatePricingSchema = z.object({
  retailPrice: z
    .number()
    .positive("Retail price must be positive")
    .optional()
    .or(z.nan().transform(() => undefined)),
  wholesalePrice: z
    .number()
    .positive("Wholesale price must be positive")
    .optional()
    .or(z.nan().transform(() => undefined)),
}).refine(
  (data) => data.retailPrice !== undefined || data.wholesalePrice !== undefined,
  {
    message: "At least one price must be updated",
  },
);

type UpdatePricingForm = z.infer<typeof updatePricingSchema>;

interface UpdatePricingModalProps {
  open: boolean;
  onClose: () => void;
  inventoryItemId: string;
  productName: string;
  currentRetailPrice?: string | null;
  currentWholesalePrice?: string | null;
  onSuccess?: () => void;
}

export function UpdatePricingModal({
  open,
  onClose,
  inventoryItemId,
  productName,
  currentRetailPrice,
  currentWholesalePrice,
  onSuccess,
}: UpdatePricingModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<UpdatePricingForm>({
    resolver: zodResolver(updatePricingSchema),
    defaultValues: {
      retailPrice: currentRetailPrice ? parseFloat(currentRetailPrice) : undefined,
      wholesalePrice: currentWholesalePrice
        ? parseFloat(currentWholesalePrice)
        : undefined,
    },
  });

  // Watch values for real-time calculations
  const watchRetailPrice = watch("retailPrice");
  const watchWholesalePrice = watch("wholesalePrice");

  // Calculate margins
  const retailMargin =
    watchRetailPrice && watchWholesalePrice && watchWholesalePrice > 0
      ? ((watchRetailPrice - watchWholesalePrice) / watchRetailPrice) * 100
      : null;

  const markup =
    watchRetailPrice && watchWholesalePrice && watchWholesalePrice > 0
      ? ((watchRetailPrice - watchWholesalePrice) / watchWholesalePrice) * 100
      : null;

  const updateMutation = trpc.inventory.updatePricing.useMutation({
    onSuccess: () => {
      toast({
        title: "Pricing Updated",
        description: `Pricing for ${productName} has been updated successfully.`,
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

  const onSubmit = (data: UpdatePricingForm) => {
    updateMutation.mutate({
      inventoryItemId,
      retailPrice: data.retailPrice,
      wholesalePrice: data.wholesalePrice,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Format currency for display
  const formatCurrency = (amount?: number) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Update Pricing
          </DialogTitle>
          <DialogDescription>
            Update retail or wholesale pricing for {productName}. You can update one or both prices.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Pricing Display */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 mb-1">Current Retail</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(
                  currentRetailPrice ? parseFloat(currentRetailPrice) : undefined,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Current Wholesale</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(
                  currentWholesalePrice
                    ? parseFloat(currentWholesalePrice)
                    : undefined,
                )}
              </p>
            </div>
          </div>

          {/* Retail Price */}
          <div>
            <Label htmlFor="retailPrice">
              Retail Price (per unit) <span className="text-gray-500 text-xs">(optional)</span>
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="retailPrice"
                type="text"
                inputMode="decimal"
                pattern="^\d*\.?\d{0,2}$"
                min="0.01"
                placeholder="Leave empty to keep current"
                {...register("retailPrice", { valueAsNumber: true })}
                className="pl-9"
              />
            </div>
            {errors.retailPrice && (
              <p className="text-sm text-red-600 mt-1">
                {errors.retailPrice.message}
              </p>
            )}
          </div>

          {/* Wholesale Price */}
          <div>
            <Label htmlFor="wholesalePrice">
              Wholesale Price (per unit) <span className="text-gray-500 text-xs">(optional)</span>
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="wholesalePrice"
                type="text"
                inputMode="decimal"
                pattern="^\d*\.?\d{0,2}$"
                min="0.01"
                placeholder="Leave empty to keep current"
                {...register("wholesalePrice", { valueAsNumber: true })}
                className="pl-9"
              />
            </div>
            {errors.wholesalePrice && (
              <p className="text-sm text-red-600 mt-1">
                {errors.wholesalePrice.message}
              </p>
            )}
          </div>

          {/* Margin Calculations */}
          {watchRetailPrice && watchWholesalePrice && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                Margin Analysis
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-800">Gross Margin:</span>
                  <span className="font-semibold text-blue-900">
                    {retailMargin !== null ? `${retailMargin.toFixed(1)}%` : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-800">Markup:</span>
                  <span className="font-semibold text-blue-900">
                    {markup !== null ? `${markup.toFixed(1)}%` : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-blue-300 pt-2">
                  <span className="text-blue-800">Margin per Unit:</span>
                  <span className="font-semibold text-blue-900">
                    {watchRetailPrice && watchWholesalePrice
                      ? formatCurrency(watchRetailPrice - watchWholesalePrice)
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Guidelines */}
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-medium mb-1">Pricing Guidelines:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Retail price is what you charge customers directly</li>
              <li>Wholesale price is for distributors/retailers</li>
              <li>Typical gross margins: 30-50% for beverages</li>
            </ul>
          </div>

          {/* Form Error */}
          {errors.root && (
            <p className="text-sm text-red-600">{errors.root.message}</p>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Pricing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
