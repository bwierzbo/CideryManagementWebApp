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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Tag, AlertTriangle, Info, Loader2 } from "lucide-react";

const labelSchema = z.object({
  packagingItemId: z.string().min(1, "Please select a label"),
  quantity: z.number().int().positive("Quantity must be positive"),
});

type LabelForm = z.infer<typeof labelSchema>;

interface LabelModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  unitsProduced: number;
  onSuccess: () => void;
}

export function LabelModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  unitsProduced,
  onSuccess,
}: LabelModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<LabelForm>({
    resolver: zodResolver(labelSchema),
    defaultValues: {
      quantity: unitsProduced,
    },
  });

  const selectedItemId = watch("packagingItemId");
  const quantity = watch("quantity");

  // Get packaging items (labels)
  const { data: packagingItems, isLoading: isLoadingItems } =
    trpc.packagingPurchases.listInventory.useQuery(
      { materialType: "Labels" },
      { enabled: open }
    );

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        quantity: unitsProduced,
      });
    }
  }, [open, reset, unitsProduced]);

  // Find selected item details
  const selectedItem = packagingItems?.items.find(
    (item) => item.id === selectedItemId
  );

  const labelMutation = trpc.bottles.addLabel.useMutation({
    onSuccess: () => {
      toast({
        title: "Labels Applied",
        description: `Successfully applied ${quantity} labels to ${bottleRunName}`,
      });
      utils.bottles.list.invalidate();
      utils.packagingPurchases.listInventory.invalidate();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Labeling Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LabelForm) => {
    labelMutation.mutate({
      bottleRunId,
      packagingItemId: data.packagingItemId,
      quantity: data.quantity,
    });
  };

  const hasInsufficientStock = selectedItem && quantity > selectedItem.quantity;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Apply Labels
          </DialogTitle>
          <DialogDescription>
            Select labels from inventory and specify quantity to apply to{" "}
            {bottleRunName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Bottle Run Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Bottles Produced:</span>
              <span className="font-semibold text-blue-900">
                {unitsProduced.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* Select Label */}
          <div className="space-y-2">
            <Label htmlFor="packagingItemId">
              Label Type <span className="text-red-500">*</span>
            </Label>
            {isLoadingItems ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading labels...
              </div>
            ) : packagingItems?.items.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                No labels found in packaging inventory
              </div>
            ) : (
              <Select
                value={selectedItemId}
                onValueChange={(value) => setValue("packagingItemId", value)}
              >
                <SelectTrigger id="packagingItemId">
                  <SelectValue placeholder="Select a label type..." />
                </SelectTrigger>
                <SelectContent>
                  {packagingItems?.items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{item.size}</span>
                        <Badge
                          variant={item.quantity > 0 ? "default" : "destructive"}
                          className="ml-2"
                        >
                          {item.quantity} in stock
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.packagingItemId && (
              <p className="text-sm text-red-500">
                {errors.packagingItemId.message}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity to Apply <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              {...register("quantity", { valueAsNumber: true })}
              placeholder="Enter quantity"
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity.message}</p>
            )}
            {selectedItem && (
              <div className="flex items-start gap-2 text-sm">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">
                  Available in stock: {selectedItem.quantity} labels
                </span>
              </div>
            )}
            {hasInsufficientStock && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Insufficient stock! You only have {selectedItem?.quantity}{" "}
                  labels available.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={labelMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                labelMutation.isPending ||
                !selectedItemId ||
                hasInsufficientStock ||
                !quantity
              }
            >
              {labelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 mr-2" />
                  Apply Labels
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
