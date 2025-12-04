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
import { CheckCircle, Loader2 } from "lucide-react";

const markCompleteSchema = z.object({
  completedAt: z.string().min(1, "Please select a date and time"),
});

type MarkCompleteForm = z.infer<typeof markCompleteSchema>;

interface MarkCompleteModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  onSuccess: () => void;
}

export function MarkCompleteModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  onSuccess,
}: MarkCompleteModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MarkCompleteForm>({
    resolver: zodResolver(markCompleteSchema),
    defaultValues: {
      completedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        completedAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      });
    }
  }, [open, reset]);

  const markCompleteMutation = trpc.packaging.markComplete.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${bottleRunName} marked as complete. Items are now in inventory.`,
      });
      utils.packaging.list.invalidate();
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark packaging run as complete",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MarkCompleteForm) => {
    const completedAt = new Date(data.completedAt);
    markCompleteMutation.mutate({
      runId: bottleRunId,
      completedAt: completedAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Mark as Complete
          </DialogTitle>
          <DialogDescription>
            Mark {bottleRunName} as complete and add to finished goods inventory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Completion Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="completedAt">
              Completion Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="completedAt"
              type="datetime-local"
              {...register("completedAt")}
            />
            {errors.completedAt && (
              <p className="text-sm text-red-500">{errors.completedAt.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={markCompleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={markCompleteMutation.isPending}
            >
              {markCompleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
