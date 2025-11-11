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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Edit, Loader2 } from "lucide-react";

const editKegSchema = z.object({
  kegNumber: z.string().min(1, "Keg number is required"),
  status: z.enum([
    "available",
    "filled",
    "distributed",
    "cleaning",
    "maintenance",
    "retired",
  ]),
  condition: z.enum(["excellent", "good", "fair", "needs_repair", "retired"]),
  currentLocation: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
});

type EditKegForm = z.infer<typeof editKegSchema>;

interface EditKegModalProps {
  open: boolean;
  onClose: () => void;
  kegId: string;
  onSuccess?: () => void;
}

export function EditKegModal({
  open,
  onClose,
  kegId,
  onSuccess,
}: EditKegModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EditKegForm>({
    resolver: zodResolver(editKegSchema),
  });

  const utils = trpc.useUtils();

  // Fetch keg details
  const { data: kegData, isLoading } = trpc.kegs.getKegDetails.useQuery(
    { kegId },
    { enabled: open && !!kegId }
  );

  const keg = kegData?.keg;

  // Populate form when keg data loads
  useEffect(() => {
    if (keg) {
      reset({
        kegNumber: keg.kegNumber,
        status: keg.status as any,
        condition: keg.condition as any,
        currentLocation: keg.currentLocation || "cellar",
        notes: keg.notes || "",
      });
    }
  }, [keg, reset]);

  const updateKegMutation = trpc.kegs.updateKeg.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Updated",
        description: "Keg details updated successfully",
      });
      utils.kegs.listKegs.invalidate();
      utils.kegs.getKegDetails.invalidate({ kegId });
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

  const onSubmit = (data: EditKegForm) => {
    updateKegMutation.mutate({
      kegId,
      ...data,
    });
  };

  const statusValue = watch("status");
  const conditionValue = watch("condition");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Keg
          </DialogTitle>
          <DialogDescription>
            Update keg details and tracking information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !keg ? (
          <div className="text-center py-12 text-gray-500">Keg not found</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Keg Info - Read Only */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Type</p>
                  <p className="font-semibold">
                    {keg.kegType.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Capacity</p>
                  <p className="font-semibold">
                    {(keg.capacityML / 1000).toFixed(1)}L
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Keg Number */}
              <div>
                <Label htmlFor="kegNumber">
                  Keg Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="kegNumber"
                  {...register("kegNumber")}
                  className="mt-1"
                />
                {errors.kegNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.kegNumber.message}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={statusValue}
                  onValueChange={(value) => setValue("status", value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="distributed">Distributed</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.status.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Condition */}
              <div>
                <Label htmlFor="condition">
                  Condition <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={conditionValue}
                  onValueChange={(value) =>
                    setValue("condition", value as any)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
                {errors.condition && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.condition.message}
                  </p>
                )}
              </div>

              {/* Current Location */}
              <div>
                <Label htmlFor="currentLocation">
                  Current Location <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="currentLocation"
                  {...register("currentLocation")}
                  className="mt-1"
                />
                {errors.currentLocation && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.currentLocation.message}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Any additional notes about this keg..."
                className="mt-1 min-h-[100px]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateKegMutation.isPending}>
                {updateKegMutation.isPending ? "Updating..." : "Update Keg"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
