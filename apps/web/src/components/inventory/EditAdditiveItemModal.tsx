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

const editAdditiveItemSchema = z.object({
  brandManufacturer: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive").optional(),
  unit: z.enum(["g", "kg", "oz", "lb"]).optional(),
  lotBatchNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  storageRequirements: z.string().optional(),
  pricePerUnit: z.number().positive("Price per unit must be positive").optional(),
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
      reset({
        brandManufacturer: item.brandManufacturer || "",
        productName: item.productName || "",
        quantity: item.quantity ? parseFloat(item.quantity) : 0,
        unit: item.unit || "kg",
        lotBatchNumber: item.lotBatchNumber || "",
        expirationDate: item.expirationDate || "",
        storageRequirements: item.storageRequirements || "",
        pricePerUnit: item.pricePerUnit ? parseFloat(item.pricePerUnit) : undefined,
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

  const onSubmit = (data: EditAdditiveItemForm) => {
    updateMutation.mutate({
      itemId: item.id,
      ...data,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
    });
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
              <Label htmlFor="brandManufacturer">
                Brand/Manufacturer
              </Label>
              <Input
                id="brandManufacturer"
                {...register("brandManufacturer")}
                className="mt-1"
              />
              {errors.brandManufacturer && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.brandManufacturer.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="productName">
                Product Name
              </Label>
              <Input
                id="productName"
                {...register("productName")}
                className="mt-1"
              />
              {errors.productName && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.productName.message}
                </p>
              )}
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lotBatchNumber">Lot/Batch Number</Label>
              <Input
                id="lotBatchNumber"
                {...register("lotBatchNumber")}
                className="mt-1"
              />
              {errors.lotBatchNumber && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.lotBatchNumber.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="expirationDate">Expiration Date</Label>
              <Input
                id="expirationDate"
                type="date"
                {...register("expirationDate")}
                className="mt-1"
              />
              {errors.expirationDate && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.expirationDate.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="storageRequirements">Storage Requirements</Label>
            <Textarea
              id="storageRequirements"
              {...register("storageRequirements")}
              placeholder="e.g., Refrigerate after opening, store in cool dry place..."
              className="mt-1 min-h-[60px]"
            />
            {errors.storageRequirements && (
              <p className="text-sm text-red-600 mt-1">
                {errors.storageRequirements.message}
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
