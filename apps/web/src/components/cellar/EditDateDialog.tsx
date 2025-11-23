"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type EventType =
  | "transfer"
  | "rack"
  | "filter"
  | "carbonation_start"
  | "carbonation_complete"
  | "bottling"
  | "pasteurize"
  | "label"
  | "merge";

interface EditDateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventType: EventType;
  eventId: string;
  currentDate: Date | string;
  dateFieldLabel: string;
}

export function EditDateDialog({
  open,
  onClose,
  onSuccess,
  eventType,
  eventId,
  currentDate,
  dateFieldLabel,
}: EditDateDialogProps) {
  const { toast } = useToast();
  const [date, setDate] = useState("");

  useEffect(() => {
    if (currentDate && open) {
      // Convert date to local date format
      const d = new Date(currentDate);
      const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];
      setDate(localDate);
    }
  }, [currentDate, open]);

  const updateTransfer = trpc.batch.updateTransfer.useMutation();
  const updateRacking = trpc.batch.updateRacking.useMutation();
  const updateFilter = trpc.batch.updateFilter.useMutation();
  const updateMerge = trpc.batch.updateMerge.useMutation();
  const updateBottleRunDates = trpc.packaging.updateBottleRunDates.useMutation();
  const updateCarbonation = trpc.carbonation.updateCarbonation.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    try {
      const dateValue = new Date(date + "T00:00:00").toISOString();

      switch (eventType) {
        case "transfer":
          await updateTransfer.mutateAsync({
            transferId: eventId,
            transferredAt: dateValue,
          });
          break;

        case "rack":
          await updateRacking.mutateAsync({
            rackingId: eventId,
            rackedAt: dateValue,
          });
          break;

        case "filter":
          await updateFilter.mutateAsync({
            filterId: eventId,
            filteredAt: dateValue,
          });
          break;

        case "merge":
          await updateMerge.mutateAsync({
            mergeId: eventId,
            mergedAt: dateValue,
          });
          break;

        case "bottling":
          await updateBottleRunDates.mutateAsync({
            runId: eventId,
            packagedAt: dateValue,
          });
          break;

        case "pasteurize":
          await updateBottleRunDates.mutateAsync({
            runId: eventId,
            pasteurizedAt: dateValue,
          });
          break;

        case "label":
          await updateBottleRunDates.mutateAsync({
            runId: eventId,
            labeledAt: dateValue,
          });
          break;

        case "carbonation_start":
          await updateCarbonation.mutateAsync({
            carbonationId: eventId,
            startedAt: dateValue,
          });
          break;

        case "carbonation_complete":
          await updateCarbonation.mutateAsync({
            carbonationId: eventId,
            completedAt: dateValue,
          });
          break;

        default:
          throw new Error(`Unsupported event type: ${eventType}`);
      }

      toast({
        title: "Success",
        description: "Date updated successfully",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update date",
        variant: "destructive",
      });
    }
  };

  const isPending =
    updateTransfer.isPending ||
    updateRacking.isPending ||
    updateFilter.isPending ||
    updateMerge.isPending ||
    updateBottleRunDates.isPending ||
    updateCarbonation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {dateFieldLabel}</DialogTitle>
          <DialogDescription>
            Update the date for this event
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">{dateFieldLabel}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
