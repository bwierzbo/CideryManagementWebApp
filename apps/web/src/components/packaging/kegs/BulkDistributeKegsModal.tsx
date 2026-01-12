"use client";

import React, { useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Send, Store, AlertTriangle, Beer } from "lucide-react";

const bulkDistributeSchema = z.object({
  distributedAt: z.string().min(1, "Date is required"),
  distributionLocation: z.string().min(1, "Location is required"),
  salesChannelId: z.string().uuid().optional(),
});

type BulkDistributeForm = z.infer<typeof bulkDistributeSchema>;

interface SelectedKeg {
  id: string;
  kegNumber: string | null;
  status: string | null;
}

interface BulkDistributeKegsModalProps {
  open: boolean;
  onClose: () => void;
  selectedKegs: SelectedKeg[];
  onSuccess?: () => void;
}

export function BulkDistributeKegsModal({
  open,
  onClose,
  selectedKegs,
  onSuccess,
}: BulkDistributeKegsModalProps) {
  const utils = trpc.useUtils();

  // Separate valid (filled) from invalid kegs
  const { validKegs, invalidKegs } = useMemo(() => {
    const valid = selectedKegs.filter((k) => k.status === "filled");
    const invalid = selectedKegs.filter((k) => k.status !== "filled");
    return { validKegs: valid, invalidKegs: invalid };
  }, [selectedKegs]);

  // Fetch sales channels
  const { data: salesChannels } = trpc.inventory.getSalesChannels.useQuery(undefined, {
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    control,
  } = useForm<BulkDistributeForm>({
    resolver: zodResolver(bulkDistributeSchema),
    defaultValues: {
      distributedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      distributionLocation: "",
      salesChannelId: undefined,
    },
    mode: "onChange", // Validate on change to enable/disable button properly
  });

  const bulkDistributeMutation = trpc.packaging.kegs.bulkDistributeKegFills.useMutation({
    onSuccess: async (result) => {
      const skippedMsg = result.skipped.length > 0
        ? ` (${result.skipped.length} skipped)`
        : "";
      toast({
        title: "Kegs Distributed",
        description: `${result.distributed} keg${result.distributed !== 1 ? "s" : ""} distributed successfully${skippedMsg}`,
      });
      // Invalidate queries to refresh the table (await to ensure completion)
      await Promise.all([
        utils.packaging.list.invalidate(),
        utils.packaging.kegs.listKegs.invalidate(),
      ]);
      reset();
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

  const onSubmit = (data: BulkDistributeForm) => {
    const distributedAt = new Date(data.distributedAt);
    bulkDistributeMutation.mutate({
      kegFillIds: validKegs.map((k) => k.id),
      distributedAt,
      distributionLocation: data.distributionLocation,
      salesChannelId: data.salesChannelId,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Distribute {validKegs.length} Keg{validKegs.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            All selected kegs will be distributed to the same location
          </DialogDescription>
        </DialogHeader>

        {/* Selected Kegs List */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Beer className="h-4 w-4" />
            Selected Kegs
          </Label>
          <div className="h-32 overflow-y-auto rounded-md border p-3">
            <div className="flex flex-wrap gap-2">
              {validKegs.map((keg) => (
                <Badge key={keg.id} variant="secondary" className="text-sm">
                  {keg.kegNumber || keg.id.slice(0, 8)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Warning for invalid kegs */}
        {invalidKegs.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  {invalidKegs.length} keg{invalidKegs.length !== 1 ? "s" : ""} will be skipped
                </p>
                <p className="text-yellow-700 mt-1">
                  Only kegs with "filled" status can be distributed. The following kegs have a different status:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {invalidKegs.map((keg) => (
                    <Badge key={keg.id} variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                      {keg.kegNumber || keg.id.slice(0, 8)} ({keg.status})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {validKegs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>No kegs are eligible for distribution.</p>
            <p className="text-sm">Select kegs with "filled" status.</p>
          </div>
        ) : (
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
              <p className="text-xs text-muted-foreground mt-1">
                All {validKegs.length} kegs will go to this location
              </p>
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
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || bulkDistributeMutation.isPending}>
                {bulkDistributeMutation.isPending
                  ? "Distributing..."
                  : `Distribute ${validKegs.length} Keg${validKegs.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
