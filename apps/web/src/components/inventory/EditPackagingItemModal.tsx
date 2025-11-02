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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";

const editPackagingItemSchema = z.object({
  packageType: z.string().optional(),
  materialType: z.string().optional(),
  size: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive").optional(),
  pricePerUnit: z.number().positive("Price per unit must be positive").optional(),
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
    reset,
  } = useForm<EditPackagingItemForm>({
    resolver: zodResolver(editPackagingItemSchema),
  });

  // Reset when modal opens
  useEffect(() => {
    if (open && item) {
      reset({
        packageType: item.packageType || "",
        materialType: item.materialType || "",
        size: item.size || "",
        quantity: item.quantity || 0,
        pricePerUnit: item.unitCost ? parseFloat(item.unitCost) : undefined,
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
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditPackagingItemForm) => {
    updateMutation.mutate({
      itemId: item.id,
      ...data,
    });
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
              <Label htmlFor="packageType">Package Type</Label>
              <Input
                id="packageType"
                {...register("packageType")}
                placeholder="e.g., Bottle, Keg, Can"
                className="mt-1"
              />
              {errors.packageType && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.packageType.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="materialType">Material Type</Label>
              <Input
                id="materialType"
                {...register("materialType")}
                placeholder="e.g., Glass, Aluminum, Stainless Steel"
                className="mt-1"
              />
              {errors.materialType && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.materialType.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="size">Size/Description</Label>
            <Input
              id="size"
              {...register("size")}
              placeholder="e.g., 750ml, 5L, 1/2 barrel"
              className="mt-1"
            />
            {errors.size && (
              <p className="text-sm text-red-600 mt-1">
                {errors.size.message}
              </p>
            )}
          </div>

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
