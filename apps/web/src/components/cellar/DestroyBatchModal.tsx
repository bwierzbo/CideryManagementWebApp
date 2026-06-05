"use client";

import React, { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

const DESTRUCTION_CATEGORIES = [
  { value: "contamination_spoilage", label: "Contamination / spoilage (VA, brett, off-flavor)" },
  { value: "failed_quality", label: "Failed quality / spec" },
  { value: "equipment_failure", label: "Equipment failure" },
  { value: "accidental_loss", label: "Accidental loss" },
  { value: "lab_rd", label: "Lab / R&D / experimental" },
  { value: "other", label: "Other (see notes)" },
] as const;

const destroySchema = z.object({
  category: z.enum([
    "contamination_spoilage",
    "failed_quality",
    "equipment_failure",
    "accidental_loss",
    "lab_rd",
    "other",
  ]),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmed: z.boolean().refine((v) => v === true, {
    message: "You must confirm the destruction",
  }),
});

type DestroyForm = z.infer<typeof destroySchema>;

interface DestroyBatchModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchName: string;
  currentVolumeL: number;
}

export function DestroyBatchModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchName,
  currentVolumeL,
}: DestroyBatchModalProps) {
  const utils = trpc.useUtils();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<DestroyForm>({
    resolver: zodResolver(destroySchema),
    defaultValues: {
      category: undefined as unknown as DestroyForm["category"],
      reason: "",
      confirmed: false,
    },
  });

  // Re-prime defaults when the modal opens against a different vessel/batch
  useEffect(() => {
    if (open) {
      reset({
        category: undefined as unknown as DestroyForm["category"],
        reason: "",
        confirmed: false,
      });
      setSubmitError(null);
    }
  }, [open, reset]);

  const destroyMutation = trpc.vessel.destroyBatch.useMutation({
    onSuccess: (result) => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      toast({
        title: "Batch destroyed",
        description: result.message,
      });
      onClose();
    },
    onError: (error) => {
      setSubmitError(error.message);
      toast({
        title: "Destruction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DestroyForm) => {
    setSubmitError(null);
    // Destroy is always whole-batch: send the batch's full current volume.
    destroyMutation.mutate({
      vesselId,
      volumeL: currentVolumeL,
      category: data.category,
      reason: data.reason,
      confirmed: true,
    });
  };

  const selectedCategory = watch("category");
  const confirmed = watch("confirmed");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Destroy Batch
          </DialogTitle>
          <DialogDescription>
            Permanently mark <strong>{batchName}</strong> in {vesselName} as
            destroyed. This is recorded as a loss on TTB Form 5120.17.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Volume to destroy</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{currentVolumeL} L</span>
              <span className="text-muted-foreground"> — entire batch</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The whole batch is destroyed and recorded as a loss. There is no
              partial destroy.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={selectedCategory}
              onValueChange={(v) => setValue("category", v as DestroyForm["category"], { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a category…" />
              </SelectTrigger>
              <SelectContent>
                {DESTRUCTION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason * (min 10 characters)</Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="e.g. VA contamination, vinegar character, dumped to drain"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <Checkbox
              id="confirmed"
              checked={confirmed}
              onCheckedChange={(v) => setValue("confirmed", v === true, { shouldValidate: true })}
              className="mt-0.5"
            />
            <Label htmlFor="confirmed" className="text-sm font-normal leading-snug cursor-pointer">
              I confirm this batch is being destroyed and removed from
              production. This action cannot be undone.
            </Label>
          </div>
          {errors.confirmed && (
            <p className="text-sm text-red-600">{errors.confirmed.message}</p>
          )}

          {submitError && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={destroyMutation.isPending}
            >
              {destroyMutation.isPending ? "Destroying…" : "Destroy Batch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
