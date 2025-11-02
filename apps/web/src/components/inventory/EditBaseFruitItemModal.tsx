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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";

const editBaseFruitItemSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["kg", "lb", "L", "gal", "bushel"]).optional(),
  pricePerUnit: z.number().min(0, "Price per unit cannot be negative").optional(),
  purchaseDate: z.string().optional(),
  harvestDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditBaseFruitItemForm = z.infer<typeof editBaseFruitItemSchema>;

interface EditBaseFruitItemModalProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSuccess?: () => void;
}

export function EditBaseFruitItemModal({
  open,
  onClose,
  item,
  onSuccess,
}: EditBaseFruitItemModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditBaseFruitItemForm>({
    resolver: zodResolver(editBaseFruitItemSchema),
  });

  const unit = watch("unit");

  // Reset when modal opens
  useEffect(() => {
    if (open && item) {
      // Format purchaseDate for date input (convert from ISO to YYYY-MM-DD)
      let purchaseDate = "";
      if (item.purchaseDate) {
        const date = new Date(item.purchaseDate);
        purchaseDate = date.toISOString().split("T")[0];
      } else if (item.createdAt) {
        const date = new Date(item.createdAt);
        purchaseDate = date.toISOString().split("T")[0];
      }

      reset({
        quantity: parseFloat(item.quantity || item.originalQuantity) || 0,
        unit: item.unit || item.originalUnit || "lb",
        pricePerUnit: parseFloat(item.pricePerUnit) || 0,
        purchaseDate: purchaseDate,
        harvestDate: item.harvestDate || "",
        notes: item.notes || "",
      });
    }
  }, [open, item, reset]);

  const updateMutation = trpc.baseFruitPurchases.updatePurchaseItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Item Updated",
        description: "Base fruit purchase item updated successfully",
      });
      utils.baseFruitPurchases.list.invalidate();
      utils.purchase.allPurchases.invalidate();
      onSuccess?.();
      onClose();
      reset();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditBaseFruitItemForm) => {
    updateMutation.mutate({
      itemId: item.id,
      ...data,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      harvestDate: data.harvestDate ? new Date(data.harvestDate) : undefined,
    });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit {item.fruitVarietyName || "Base Fruit Item"}
          </DialogTitle>
          <DialogDescription>
            Update purchase item details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                {...register("quantity", { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.quantity && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="unit">
                Unit <span className="text-red-500">*</span>
              </Label>
              <Select
                value={unit}
                onValueChange={(value) => setValue("unit", value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="lb">Pounds (lb)</SelectItem>
                  <SelectItem value="bushel">Bushels</SelectItem>
                  <SelectItem value="L">Liters (L)</SelectItem>
                  <SelectItem value="gal">Gallons (gal)</SelectItem>
                </SelectContent>
              </Select>
              {errors.unit && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.unit.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input
              id="purchaseDate"
              type="date"
              {...register("purchaseDate")}
              className="mt-1"
            />
            {errors.purchaseDate && (
              <p className="text-sm text-red-600 mt-1">
                {errors.purchaseDate.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pricePerUnit">Price per Unit</Label>
              <Input
                id="pricePerUnit"
                type="number"
                step="0.01"
                {...register("pricePerUnit", { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.pricePerUnit && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.pricePerUnit.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="harvestDate">Harvest Date</Label>
              <Input
                id="harvestDate"
                type="date"
                {...register("harvestDate")}
                className="mt-1"
              />
              {errors.harvestDate && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.harvestDate.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Add notes about this purchase item..."
              className="mt-1 min-h-[100px]"
            />
            {errors.notes && (
              <p className="text-sm text-red-600 mt-1">
                {errors.notes.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
