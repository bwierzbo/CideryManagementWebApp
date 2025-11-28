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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";

const returnKegSchema = z.object({
  returnedAt: z.date(),
});

type ReturnKegForm = z.infer<typeof returnKegSchema>;

interface ReturnKegModalProps {
  open: boolean;
  onClose: () => void;
  kegFillId: string;
  kegNumber: string;
}

export function ReturnKegModal({
  open,
  onClose,
  kegFillId,
  kegNumber,
}: ReturnKegModalProps) {
  const utils = trpc.useUtils();

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
