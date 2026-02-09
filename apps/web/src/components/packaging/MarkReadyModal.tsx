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
import { useDateFormat } from "@/hooks/useDateFormat";
import { CheckCircle2, Loader2 } from "lucide-react";

const markReadySchema = z.object({
  readyAt: z.string().min(1, "Date is required"),
});

type MarkReadyForm = z.infer<typeof markReadySchema>;

interface MarkReadyModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  itemType: "bottle" | "keg";
  onSuccess?: () => void;
}

export function MarkReadyModal({
  open,
  onClose,
  itemId,
  itemName,
  itemType,
  onSuccess,
}: MarkReadyModalProps) {
  const utils = trpc.useUtils();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MarkReadyForm>({
    resolver: zodResolver(markReadySchema),
    defaultValues: {
      readyAt: formatDateTimeForInput(new Date()),
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        readyAt: formatDateTimeForInput(new Date()),
      });
    }
  }, [open, reset]);

  // Mutation for bottles
  const markBottleReadyMutation = trpc.packaging.markReady.useMutation({
    onSuccess: () => {
      toast({
        title: "Marked Ready",
        description: `${itemName} is ready for distribution`,
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

  // Mutation for kegs
  const markKegReadyMutation = trpc.packaging.kegs.markKegReady.useMutation({
    onSuccess: () => {
      toast({
        title: "Marked Ready",
        description: `${itemName} is ready for distribution`,
      });
      utils.packaging.list.invalidate();
      utils.packaging.kegs.listKegs.invalidate();
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

  const isPending = markBottleReadyMutation.isPending || markKegReadyMutation.isPending;

  const onSubmit = (data: MarkReadyForm) => {
    const readyAt = parseDateTimeFromInput(data.readyAt);

    if (itemType === "bottle") {
      markBottleReadyMutation.mutate({
        runId: itemId,
        readyAt,
      });
    } else {
      markKegReadyMutation.mutate({
        kegFillId: itemId,
        readyAt,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Mark Ready to Distribute
          </DialogTitle>
          <DialogDescription>
            Confirm that {itemName} has passed QA and is ready for distribution.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Ready Date & Time */}
          <div>
            <Label htmlFor="readyAt">
              Ready Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="readyAt"
              type="datetime-local"
              {...register("readyAt")}
              className="mt-1"
            />
            {errors.readyAt && (
              <p className="text-sm text-red-600 mt-1">{errors.readyAt.message}</p>
            )}
          </div>

          {/* Info about what marking ready means */}
          <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="font-medium text-blue-900 mb-1">What does &quot;Ready&quot; mean?</p>
            <p className="text-blue-700">
              This indicates the {itemType === "bottle" ? "packaging run" : "keg"} has completed
              all QA checks and is cleared for distribution. This step is optional but helps
              track QA signoff before products leave the facility.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Ready
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
