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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

const cleanKegSchema = z.object({
  cleanedAt: z.date(),
  notes: z.string().optional(),
});

type CleanKegForm = z.infer<typeof cleanKegSchema>;

interface CleanKegModalProps {
  open: boolean;
  onClose: () => void;
  kegId: string;
  kegNumber: string;
}

export function CleanKegModal({
  open,
  onClose,
  kegId,
  kegNumber,
}: CleanKegModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CleanKegForm>({
    resolver: zodResolver(cleanKegSchema),
    defaultValues: {
      cleanedAt: new Date(),
      notes: "",
    },
  });

  const cleanedAt = watch("cleanedAt");

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
        cleanedAt: new Date(),
        notes: "",
      });
    }
  }, [open, reset]);

  const cleanKegMutation = trpc.packaging.kegs.cleanKeg.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Keg Cleaned Successfully",
        description: data.message,
      });
      utils.packaging.kegs.listKegs.invalidate();
      onClose();
      reset();
    },
    onError: (error) => {
      toast({
        title: "Cleaning Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CleanKegForm) => {
    cleanKegMutation.mutate({
      kegId,
      cleanedAt: data.cleanedAt,
      notes: data.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Clean Keg - {kegNumber}
          </DialogTitle>
          <DialogDescription>
            Record cleaning details for this keg
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="cleanedAt">
              Cleaning Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={formatDatetimeLocal(cleanedAt)}
              onChange={(e) => setValue("cleanedAt", new Date(e.target.value))}
              className="w-full mt-1"
            />
            {errors.cleanedAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.cleanedAt.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">
              Cleaning Method & Notes
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Describe how the keg was cleaned (e.g., hot water rinse, sanitizer used, etc.)"
              className="mt-1 min-h-[100px]"
            />
            {errors.notes && (
              <p className="text-sm text-red-600 mt-1">
                {errors.notes.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Record the cleaning method, sanitizers used, and any observations (optional)
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={cleanKegMutation.isPending}
            >
              {cleanKegMutation.isPending ? "Recording..." : "Mark as Clean"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
