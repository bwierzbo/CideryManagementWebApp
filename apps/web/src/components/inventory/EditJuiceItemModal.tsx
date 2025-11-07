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
import { formatDateForInput } from "@/utils/date-format";

const editJuiceItemSchema = z.object({
  volume: z.number().positive("Volume must be positive").optional(),
  volumeUnit: z.enum(["L", "gal"]).optional(),
  ph: z.preprocess(
    (val) => (val === "" || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0).max(14).optional()
  ),
  specificGravity: z.preprocess(
    (val) => (val === "" || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0.95).max(1.2).optional()
  ),
  pricePerLiter: z.preprocess(
    (val) => (val === "" || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().positive("Price per liter must be positive").optional()
  ),
  purchaseDate: z.string().optional(),
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

  // Query for full juice inventory items
  const { data: juiceInventoryData } = trpc.juicePurchases.listInventory.useQuery(
    { limit: 100, offset: 0 },
    { enabled: open && !!item }
  );

  // Find the full item data from inventory
  const fullItem = React.useMemo(() => {
    if (!item || !juiceInventoryData?.items) return item;

    // If item already has all required fields, it's complete
    if ('volume' in item && 'pricePerLiter' in item && 'purchaseDate' in item) return item;

    // Otherwise, find it in the inventory list using the metadata.itemId
    const itemIdToFind = item.metadata?.itemId || item.id;
    const foundItem = juiceInventoryData.items.find(
      (invItem: any) => invItem.id === itemIdToFind
    );

    return foundItem || item;
  }, [item, juiceInventoryData]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<EditJuiceItemForm>({
    resolver: zodResolver(editJuiceItemSchema) as any,
  });

  const volumeUnit = watch("volumeUnit");

  // Reset when modal opens
  useEffect(() => {
    if (open && fullItem) {
      reset({
        volume: fullItem.volume ? parseFloat(fullItem.volume) : 0,
        volumeUnit: fullItem.volumeUnit || "L",
        purchaseDate: fullItem.purchaseDate
          ? formatDateForInput(fullItem.purchaseDate)
          : undefined,
        ph: fullItem.ph ? parseFloat(fullItem.ph) : undefined,
        specificGravity: fullItem.specificGravity ? parseFloat(fullItem.specificGravity) : undefined,
        pricePerLiter: fullItem.pricePerLiter ? parseFloat(fullItem.pricePerLiter) : undefined,
        notes: fullItem.notes || "",
      });
    }
  }, [open, fullItem, reset]);

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
      itemId: fullItem?.id || item?.metadata?.itemId || item?.id,
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
            Edit {fullItem?.juiceType || fullItem?.metadata?.varietyName || "Juice Item"} {fullItem?.varietyName ? `- ${fullItem.varietyName}` : ""}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ph">pH</Label>
              <Input
                id="ph"
                type="number"
                step="0.01"
                {...register("ph")}
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
              <Label htmlFor="specificGravity">Specific Gravity (SG)</Label>
              <Input
                id="specificGravity"
                type="number"
                step="0.001"
                {...register("specificGravity")}
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

          <div>
            <Label htmlFor="pricePerLiter">Price per Liter</Label>
            <Input
              id="pricePerLiter"
              type="number"
              step="0.01"
              {...register("pricePerLiter")}
              className="mt-1"
            />
            {errors.pricePerLiter && (
              <p className="text-sm text-red-600 mt-1">
                {errors.pricePerLiter.message}
              </p>
            )}
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
