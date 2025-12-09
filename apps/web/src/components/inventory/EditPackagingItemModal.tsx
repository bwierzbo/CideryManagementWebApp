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

const editPackagingItemSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").optional(),
  unitType: z.enum(["cases", "boxes", "individual", "pallets"]).optional(),
  pricePerUnit: z.number().min(0, "Price per unit cannot be negative").optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditPackagingItemForm = z.infer<typeof editPackagingItemSchema>;

interface EditPackagingItemModalProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSuccess?: () => void;
}

export function EditPackagingItemModal({
  open,
  onClose,
  item,
  onSuccess,
}: EditPackagingItemModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditPackagingItemForm>({
    resolver: zodResolver(editPackagingItemSchema),
  });

  const unitType = watch("unitType");

  // Reset when modal opens
  useEffect(() => {
    if (open && item) {
      console.log("Prefilling edit form with item data:", item);

      // Parse quantity - database returns integers as numbers but ensure type safety
      const rawQuantity = item.quantity;
      const quantity = rawQuantity ? Number(parseInt(String(rawQuantity), 10)) : 0;

      // Parse price per unit - database returns decimals as strings
      const rawPrice = item.pricePerUnit ?? item.unitCost;
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
        unitType: item.unitType || "individual",
        pricePerUnit: pricePerUnit,
        purchaseDate: purchaseDate,
        notes: item.notes || "",
      });
    }
  }, [open, item, reset]);

  const updateMutation = trpc.packagingPurchases.updatePurchaseItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Item Updated",
        description: "Packaging purchase item updated successfully",
      });
      utils.packagingPurchases.listInventory.invalidate();
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

  const onSubmit = (data: EditPackagingItemForm) => {
    console.log("Form data:", data);

    // Extract actual UUID from composite ID (format: "packaging-{uuid}")
    const actualItemId = item.id.startsWith("packaging-")
      ? item.id.replace("packaging-", "")
      : item.id;

    // Validate and prepare quantity - must be a valid positive number
    const quantity =
      typeof data.quantity === "number" &&
      !isNaN(data.quantity) &&
      data.quantity > 0
        ? Math.floor(data.quantity) // Packaging quantities are integers
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
      unitType: data.unitType,
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
            Edit {item.size || "Packaging Item"}
          </DialogTitle>
          <DialogDescription>
            Update packaging purchase item details
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
                step="1"
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
              <Label htmlFor="unitType">
                Unit <span className="text-red-500">*</span>
              </Label>
              <Select
                value={unitType}
                onValueChange={(value) => setValue("unitType", value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cases">Cases</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="pallets">Pallets</SelectItem>
                </SelectContent>
              </Select>
              {errors.unitType && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.unitType.message}
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
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
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
              placeholder="Add notes about this packaging purchase item..."
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
