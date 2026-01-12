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
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { RotateCcw, MapPin, Calendar, Loader2 } from "lucide-react";
import { formatDate } from "@/utils/date-format";

const returnKegSchema = z.object({
  returnedAt: z.date(),
});

type ReturnKegForm = z.infer<typeof returnKegSchema>;

interface ReturnKegModalProps {
  open: boolean;
  onClose: () => void;
  kegFillId: string;
  kegNumber: string;
  onSuccess?: () => void;
}

export function ReturnKegModal({
  open,
  onClose,
  kegFillId,
  kegNumber,
  onSuccess,
}: ReturnKegModalProps) {
  const utils = trpc.useUtils();

  // Fetch keg fill details to show distribution info
  const { data: kegFillDetails, isLoading: isLoadingDetails } =
    trpc.packaging.kegs.getKegFillDetails.useQuery(kegFillId, {
      enabled: open && !!kegFillId,
    });

  const {
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ReturnKegForm>({
    resolver: zodResolver(returnKegSchema),
    defaultValues: {
      returnedAt: new Date(),
    },
  });

  const returnedAt = watch("returnedAt");

  // Format date for datetime-local input
  const formatDatetimeLocal = (date: Date | undefined): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "";
    }
    try {
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      reset({
        returnedAt: new Date(),
      });
    }
  }, [open, reset]);

  const returnKegMutation = trpc.packaging.kegs.returnKegFill.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Returned",
        description: `${kegNumber} has been marked as returned and is now available.`,
      });
      utils.packaging.kegs.listKegs.invalidate();
      onSuccess?.();
      onClose();
      reset();
    },
    onError: (error) => {
      toast({
        title: "Return Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReturnKegForm) => {
    returnKegMutation.mutate({
      kegFillId,
      returnedAt: data.returnedAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Return Keg - {kegNumber}
          </DialogTitle>
          <DialogDescription>
            Mark this keg as returned. It will be set to available status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Distribution Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-blue-900">Distribution Details</h4>
            {isLoadingDetails ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : kegFillDetails ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-blue-800">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Distributed:</span>
                  <span>
                    {kegFillDetails.distributedAt
                      ? formatDate(kegFillDetails.distributedAt.toString())
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-blue-800">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Location:</span>
                  <span>{kegFillDetails.distributionLocation || "Not specified"}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-blue-700">Distribution details not available</p>
            )}
          </div>

          <div>
            <Label htmlFor="returnedAt">
              Return Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={formatDatetimeLocal(returnedAt)}
              onChange={(e) => setValue("returnedAt", new Date(e.target.value))}
              className="w-full mt-1"
            />
            {errors.returnedAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.returnedAt.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={returnKegMutation.isPending}
            >
              {returnKegMutation.isPending ? "Returning..." : "Mark as Returned"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
