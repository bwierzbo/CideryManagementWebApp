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
import { formatDateForInput, parseDateInput } from "@/utils/date-format";

const editAdditiveItemSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["g", "kg", "oz", "lb"]).optional(),
  pricePerUnit: z.number().min(0, "Price per unit cannot be negative").optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditAdditiveItemForm = z.infer<typeof editAdditiveItemSchema>;

interface EditAdditiveItemModalProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSuccess?: () => void;
}

export function EditAdditiveItemModal({
  open,
  onClose,
  item,
  onSuccess,
}: EditAdditiveItemModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditAdditiveItemForm>({
    resolver: zodResolver(editAdditiveItemSchema),
  });

  const unit = watch("unit");

  // Reset when modal opens
  useEffect(() => {
    if (open && item) {
      console.log("Prefilling edit form with item data:", item);

      // Parse quantity - database returns decimals as strings, ensure numeric type
      const rawQuantity = item.quantity ?? item.originalQuantity;
      const quantity = rawQuantity ? Number(parseFloat(String(rawQuantity))) : 0;

      // Parse price per unit
      const rawPrice = item.pricePerUnit;
      const pricePerUnit = rawPrice !== null && rawPrice !== undefined
        ? Number(parseFloat(String(rawPrice)))
        : undefined;

      // Format purchaseDate for date input (convert from ISO to YYYY-MM-DD)
      let purchaseDate = "";
      if (item.purchaseDate) {
        purchaseDate = formatDateForInput(item.purchaseDate);
      } else if (item.createdAt) {
        purchaseDate = formatDateForInput(item.createdAt);
      }

      reset({
        quantity: quantity || 0,
        unit: item.unit || item.originalUnit || "kg",
        pricePerUnit: pricePerUnit,
        purchaseDate: purchaseDate,
        notes: item.notes || "",
      });
    }
  }, [open, item, reset]);

  const updateMutation = trpc.additivePurchases.updatePurchaseItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Item Updated",
        description: "Additive purchase item updated successfully",
      });
      utils.additivePurchases.list.invalidate();
      utils.purchase.allPurchases.invalidate();
      onSuccess?.();
      onClose();
      reset();
    },
    onError: (error) => {
      console.error("Update error:", error);
      console.error("Error data:", error.data);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditAdditiveItemForm) => {
    console.log("Form data:", data);

    // Extract actual UUID from composite ID (format: "additive-{uuid}")
    const actualItemId = item.id.startsWith("additive-")
      ? item.id.replace("additive-", "")
      : item.id;

    // Validate and prepare quantity - must be a valid positive number
    const quantity =
      typeof data.quantity === "number" &&
      !isNaN(data.quantity) &&
      data.quantity > 0
        ? data.quantity
        : undefined;

    // Validate and prepare pricePerUnit - must be a valid non-negative number (can be 0)
    const pricePerUnit =
      typeof data.pricePerUnit === "number" &&
      !isNaN(data.pricePerUnit) &&
      data.pricePerUnit >= 0
        ? data.pricePerUnit
        : undefined;

    // Validate and prepare purchaseDate - ensure it's a valid date
    const purchaseDate = data.purchaseDate ? parseDateInput(data.purchaseDate) ?? undefined : undefined;

    const payload = {
      itemId: actualItemId,
      quantity,
      unit: data.unit,
      pricePerUnit,
      purchaseDate,
      notes: data.notes,
    };

    console.log("Sending to API:", payload);

    updateMutation.mutate(payload);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit {item.productName || "Additive Item"}
          </DialogTitle>
          <DialogDescription>
            Update additive purchase item details
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
                  <SelectItem value="g">Grams (g)</SelectItem>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="oz">Ounces (oz)</SelectItem>
                  <SelectItem value="lb">Pounds (lb)</SelectItem>
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
            <Label htmlFor="purchaseDate">
              Purchase Date
              <span className="text-xs text-muted-foreground ml-2">
                (affects all items in order)
              </span>
            </Label>
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

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Add notes about this additive purchase item..."
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
