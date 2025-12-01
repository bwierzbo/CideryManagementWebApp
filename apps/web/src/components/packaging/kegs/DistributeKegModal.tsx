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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Send, Store } from "lucide-react";

const distributeKegSchema = z.object({
  distributedAt: z.string().min(1, "Date is required"),
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
});

type DistributeKegForm = z.infer<typeof distributeKegSchema>;

interface DistributeKegModalProps {
  open: boolean;
  onClose: () => void;
  kegFillId: string;
  kegNumber: string;
  onSuccess?: () => void;
}

export function DistributeKegModal({
  open,
  onClose,
  kegFillId,
  kegNumber,
  onSuccess,
}: DistributeKegModalProps) {
  // Fetch sales channels
  const { data: salesChannels } = trpc.inventory.getSalesChannels.useQuery(undefined, {
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<DistributeKegForm>({
    resolver: zodResolver(distributeKegSchema),
    defaultValues: {
      distributedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      salesChannelId: undefined,
    },
  });

  const distributeMutation = trpc.packaging.kegs.distributeKegFill.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Distributed",
        description: `${kegNumber} marked as distributed`,
      });
      reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DistributeKegForm) => {
    const distributedAt = new Date(data.distributedAt);
    distributeMutation.mutate({
      kegFillId,
      distributedAt: distributedAt,
      distributionLocation: data.distributionLocation,
      salesChannelId: data.salesChannelId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Distribute Keg
          </DialogTitle>
          <DialogDescription>
            Mark {kegNumber} as distributed and record where it is going
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Distribution Date & Time */}
          <div>
            <Label htmlFor="distributedAt">
              Distribution Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="distributedAt"
              type="datetime-local"
              {...register("distributedAt")}
              className="mt-1"
            />
            {errors.distributedAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.distributedAt.message}
              </p>
            )}
          </div>

          {/* Distribution Location */}
          <div>
            <Label htmlFor="distributionLocation">
              Location / Distributor <span className="text-red-500">*</span>
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={distributeMutation.isPending}>
              {distributeMutation.isPending ? "Distributing..." : "Distribute"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
