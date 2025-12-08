"use client";

import React from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Send, DollarSign, Package, Store } from "lucide-react";

const distributeInventorySchema = z.object({
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
  quantityDistributed: z.number().int().positive("Quantity must be positive"),
  pricePerUnit: z.number().positive("Price must be positive"),
  distributionDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type DistributeInventoryForm = z.infer<typeof distributeInventorySchema>;

interface DistributeInventoryModalProps {
  open: boolean;
  onClose: () => void;
  inventoryItemId: string;
  productName: string;
  currentQuantity: number;
  suggestedPrice?: number;
  onSuccess?: () => void;
}

export function DistributeInventoryModal({
  open,
  onClose,
  inventoryItemId,
  productName,
  currentQuantity,
  suggestedPrice,
  onSuccess,
}: DistributeInventoryModalProps) {
  // Fetch sales channels
  const { data: salesChannels } = trpc.inventory.getSalesChannels.useQuery(undefined, {
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    control,
  } = useForm<DistributeInventoryForm>({
    resolver: zodResolver(distributeInventorySchema),
    defaultValues: {
      distributionDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      pricePerUnit: suggestedPrice || 0,
      quantityDistributed: 0,
      salesChannelId: undefined,
    },
  });

  // Watch values for real-time calculations
  const watchQuantity = watch("quantityDistributed");
  const watchPrice = watch("pricePerUnit");

  // Calculate total revenue
  const totalRevenue = (watchQuantity || 0) * (watchPrice || 0);
  const remainingQuantity = currentQuantity - (watchQuantity || 0);

  const distributeMutation = trpc.inventory.distribute.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Distribution Recorded",
        description: `${data.distribution.quantityDistributed} units distributed. ${data.distribution.remainingQuantity} remaining.`,
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

  const onSubmit = (data: DistributeInventoryForm) => {
    // Validate quantity
    if (data.quantityDistributed > currentQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Cannot distribute ${data.quantityDistributed} units. Only ${currentQuantity} available.`,
        variant: "destructive",
      });
      return;
    }

    const distributionDate = new Date(data.distributionDate);
    distributeMutation.mutate({
      inventoryItemId,
      distributionLocation: data.distributionLocation,
      salesChannelId: data.salesChannelId,
      quantityDistributed: data.quantityDistributed,
      pricePerUnit: data.pricePerUnit,
      distributionDate: distributionDate.toISOString(),
      notes: data.notes,
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
            <Send className="h-5 w-5" />
            Distribute Inventory
          </DialogTitle>
          <DialogDescription>
            Record distribution of {productName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Available Quantity Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Available Units
                </span>
              </div>
              <span className="text-lg font-bold text-blue-900">
                {currentQuantity.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Distribution Date & Time */}
          <div>
            <Label htmlFor="distributionDate">
              Distribution Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="distributionDate"
              type="datetime-local"
              {...register("distributionDate")}
              className="mt-1"
            />
            {errors.distributionDate && (
              <p className="text-sm text-red-600 mt-1">
                {errors.distributionDate.message}
              </p>
            )}
          </div>

          {/* Distribution Location */}
          <div>
            <Label htmlFor="distributionLocation">
              Location / Customer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="distributionLocation"
              placeholder="e.g., Main Street Pub, ABC Distributors"
              {...register("distributionLocation")}
              className="mt-1"
            />
            {errors.distributionLocation && (
              <p className="text-sm text-red-600 mt-1">
                {errors.distributionLocation.message}
              </p>
            )}
          </div>

          {/* Sales Channel */}
          <div>
            <Label htmlFor="salesChannelId" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Sales Channel
            </Label>
            <Controller
              name="salesChannelId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => field.onChange(value || undefined)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select sales channel (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesChannels?.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">
              For TTB reporting and sales analytics
            </p>
          </div>

          {/* Quantity and Price Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <Label htmlFor="quantityDistributed">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantityDistributed"
                type="text"
                inputMode="numeric"
                pattern="^\d+$"
                min="1"
                max={currentQuantity}
                placeholder="0"
                {...register("quantityDistributed", { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.quantityDistributed && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.quantityDistributed.message}
                </p>
              )}
            </div>

            {/* Price per Unit */}
            <div>
              <Label htmlFor="pricePerUnit">
                Price per Unit <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="pricePerUnit"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d*\.?\d{0,2}$"
                  min="0.01"
                  placeholder="0.00"
                  {...register("pricePerUnit", { valueAsNumber: true })}
                  className="pl-9"
                />
              </div>
              {errors.pricePerUnit && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.pricePerUnit.message}
                </p>
              )}
            </div>
          </div>

          {/* Real-time Calculations */}
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Revenue:</span>
              <span className="font-semibold text-gray-900">
                ${totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining Inventory:</span>
              <span
                className={`font-semibold ${
                  remainingQuantity < 0
                    ? "text-red-600"
                    : remainingQuantity === 0
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {remainingQuantity.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this distribution..."
              {...register("notes")}
              className="mt-1 min-h-[80px]"
            />
          </div>

          {/* Validation Warning */}
          {remainingQuantity < 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Distribution quantity exceeds
                available inventory ({currentQuantity} units available)
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={distributeMutation.isPending || remainingQuantity < 0}
            >
              {distributeMutation.isPending ? "Recording..." : "Distribute"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
