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

const editJuiceItemSchema = z.object({
  volume: z.number().positive("Volume must be positive").optional(),
  volumeUnit: z.enum(["L", "gal"]).optional(),
  brix: z.number().min(0).max(50).optional(),
  ph: z.number().min(0).max(14).optional(),
  specificGravity: z.number().min(0.95).max(1.2).optional(),
  containerType: z.enum(["drum", "tote", "tank", "other"]).optional(),
  pricePerLiter: z.number().positive("Price per liter must be positive").optional(),
  notes: z.string().optional(),
});

type EditJuiceItemForm = z.infer<typeof editJuiceItemSchema>;

interface EditJuiceItemModalProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSuccess?: () => void;
}

export function EditJuiceItemModal({
  open,
  onClose,
  item,
  onSuccess,
}: EditJuiceItemModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditJuiceItemForm>({
    resolver: zodResolver(editJuiceItemSchema),
  });

  const volumeUnit = watch("volumeUnit");
  const containerType = watch("containerType");

  // Reset when modal opens
  useEffect(() => {
    if (open && item) {
      reset({
        volume: parseFloat(item.volume) || 0,
        volumeUnit: item.volumeUnit || "L",
        brix: item.brix ? parseFloat(item.brix) : undefined,
        ph: item.ph ? parseFloat(item.ph) : undefined,
        specificGravity: item.specificGravity ? parseFloat(item.specificGravity) : undefined,
        containerType: item.containerType || undefined,
        pricePerLiter: item.pricePerLiter ? parseFloat(item.pricePerLiter) : undefined,
        notes: item.notes || "",
      });
    }
  }, [open, item, reset]);

  const updateMutation = trpc.juicePurchases.updatePurchaseItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Item Updated",
        description: "Juice purchase item updated successfully",
      });
      utils.juicePurchases.listInventory.invalidate();
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

  const onSubmit = (data: EditJuiceItemForm) => {
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
            Edit {item.juiceType || "Juice Item"} {item.varietyName ? `- ${item.varietyName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Update juice purchase item details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="volume">
                Volume <span className="text-red-500">*</span>
              </Label>
              <Input
                id="volume"
                type="number"
                step="0.1"
                {...register("volume", { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.volume && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.volume.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="volumeUnit">
                Unit <span className="text-red-500">*</span>
              </Label>
              <Select
                value={volumeUnit}
                onValueChange={(value) => setValue("volumeUnit", value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Liters (L)</SelectItem>
                  <SelectItem value="gal">Gallons (gal)</SelectItem>
                </SelectContent>
              </Select>
              {errors.volumeUnit && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.volumeUnit.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="brix">Brix</Label>
              <Input
                id="brix"
                type="number"
                step="0.1"
                {...register("brix", { valueAsNumber: true })}
                className="mt-1"
                placeholder="0-50"
              />
              {errors.brix && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.brix.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="ph">pH</Label>
              <Input
                id="ph"
                type="number"
                step="0.01"
                {...register("ph", { valueAsNumber: true })}
                className="mt-1"
                placeholder="0-14"
              />
              {errors.ph && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.ph.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="specificGravity">Specific Gravity</Label>
              <Input
                id="specificGravity"
                type="number"
                step="0.001"
                {...register("specificGravity", { valueAsNumber: true })}
                className="mt-1"
                placeholder="0.95-1.2"
              />
              {errors.specificGravity && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.specificGravity.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="containerType">Container Type</Label>
              <Select
                value={containerType}
                onValueChange={(value) => setValue("containerType", value as any)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select container type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drum">Drum</SelectItem>
                  <SelectItem value="tote">Tote</SelectItem>
                  <SelectItem value="tank">Tank</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.containerType && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.containerType.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="pricePerLiter">Price per Liter</Label>
              <Input
                id="pricePerLiter"
                type="number"
                step="0.01"
                {...register("pricePerLiter", { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.pricePerLiter && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.pricePerLiter.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Add notes about this juice purchase item..."
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
