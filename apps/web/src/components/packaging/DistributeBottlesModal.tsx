"use client";

import React, { useEffect } from "react";
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
import { Send, Store, Loader2 } from "lucide-react";

const distributeBottlesSchema = z.object({
  distributedAt: z.string().min(1, "Date is required"),
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
});

type DistributeBottlesForm = z.infer<typeof distributeBottlesSchema>;

interface DistributeBottlesModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  unitsProduced: number;
  onSuccess?: () => void;
}

export function DistributeBottlesModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  unitsProduced,
  onSuccess,
}: DistributeBottlesModalProps) {
  const utils = trpc.useUtils();

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
  } = useForm<DistributeBottlesForm>({
    resolver: zodResolver(distributeBottlesSchema),
    defaultValues: {
      distributedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
      salesChannelId: undefined,
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        distributedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
        distributionLocation: "",
        salesChannelId: undefined,
      });
    }
  }, [open, reset]);

  const distributeMutation = trpc.packaging.distribute.useMutation({
    onSuccess: () => {
      toast({
        title: "Packaging Distributed",
        description: `${bottleRunName} (${unitsProduced} units) marked as distributed`,
      });
      utils.packaging.list.invalidate();
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

  const onSubmit = (data: DistributeBottlesForm) => {
    const distributedAt = new Date(data.distributedAt);
    distributeMutation.mutate({
      runId: bottleRunId,
      distributedAt,
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
            Distribute Packaging
          </DialogTitle>
          <DialogDescription>
            Mark {bottleRunName} ({unitsProduced} units) as distributed and record where it is
            going.
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
              <p className="text-sm text-red-600 mt-1">{errors.distributedAt.message}</p>
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
              <p className="text-sm text-red-600 mt-1">{errors.distributionLocation.message}</p>
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

          {/* Info about distribution */}
          <div className="text-sm text-muted-foreground bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="font-medium text-green-900 mb-1">What happens after distribution?</p>
            <p className="text-green-700">
              Once distributed, the packaging run is marked as complete. The products leave
              bonded space and are tracked for TTB reporting purposes.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={distributeMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={distributeMutation.isPending}>
              {distributeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Distributing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Distribute
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
