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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

const prepSchema = z.object({
  residueL: z.number().nonnegative("Residue can't be negative"),
  notes: z.string().optional(),
});
type PrepForm = z.infer<typeof prepSchema>;

interface PrepForCleaningModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  // Batch context is optional — Prep for Cleaning also works on vessels
  // whose only "contents" are stuck completed batches or press runs.
  batchName?: string | null;
  currentVolumeL?: number;
}

export function PrepForCleaningModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchName,
  currentVolumeL = 0,
}: PrepForCleaningModalProps) {
  const utils = trpc.useUtils();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PrepForm>({
    resolver: zodResolver(prepSchema),
    defaultValues: { residueL: currentVolumeL, notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ residueL: currentVolumeL, notes: "" });
      setSubmitError(null);
    }
  }, [open, currentVolumeL, reset]);

  const prepMutation = trpc.vessel.prepForCleaning.useMutation({
    onSuccess: (result) => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      toast({
        title: "Tank ready for cleaning",
        description: result.message,
      });
      onClose();
    },
    onError: (error) => {
      setSubmitError(error.message);
      toast({
        title: "Couldn't prep tank",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PrepForm) => {
    setSubmitError(null);
    prepMutation.mutate({
      vesselId,
      residueL: data.residueL,
      notes: data.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Prep for Cleaning
          </DialogTitle>
          <DialogDescription>
            {batchName ? (
              <>
                Close out <strong>{batchName}</strong> in {vesselName} and send the
                vessel to cleaning. Any residue is logged as a sediment loss.
              </>
            ) : (
              <>
                Clear {vesselName} and send it to cleaning. Use this when the
                tank just has dregs or leftover state to clean up.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="residueL">Residue volume (L)</Label>
            <Input
              id="residueL"
              type="number"
              step="0.01"
              min="0"
              {...register("residueL", { valueAsNumber: true })}
            />
            {errors.residueL && (
              <p className="text-sm text-red-600">{errors.residueL.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Lees / dregs to write off as sediment loss. Leave 0 if the tank is
              already empty.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="e.g. racking lees, evaporation drift"
              {...register("notes")}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={prepMutation.isPending}>
              {prepMutation.isPending ? "Prepping…" : "Send to Cleaning"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
