"use client";

import React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

const distributeKegSchema = z.object({
  distributedAt: z.string().min(1, "Date is required"),
  distributionLocation: z.string().min(1, "Location is required"),
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
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DistributeKegForm>({
    resolver: zodResolver(distributeKegSchema),
    defaultValues: {
      distributedAt: new Date().toISOString().split("T")[0],
    },
  });

  const distributeMutation = trpc.kegs.distributeKegFill.useMutation({
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
    distributeMutation.mutate({
      kegFillId,
      distributedAt: new Date(data.distributedAt),
      distributionLocation: data.distributionLocation,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Distribute Keg
          </DialogTitle>
          <DialogDescription>
            Mark {kegNumber} as distributed and record where it's going
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Distribution Date */}
          <div>
            <Label htmlFor="distributedAt">
              Distribution Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="distributedAt"
              type="date"
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
