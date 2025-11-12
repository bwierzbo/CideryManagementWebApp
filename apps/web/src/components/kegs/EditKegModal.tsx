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
  kegType: z.enum([
    "cornelius_5L",
    "cornelius_9L",
    "sanke_20L",
    "sanke_30L",
    "sanke_50L",
    "other",
  ]),
  capacityML: z.number().positive("Capacity must be positive"),
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
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().positive().optional(),
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
    defaultValues: {
      kegNumber: "",
      kegType: "cornelius_5L",
      capacityML: 0,
      status: "available",
      condition: "good",
      currentLocation: "cellar",
      purchaseDate: "",
      notes: "",
    },
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
    if (keg && open) {
      const formData = {
        kegNumber: keg.kegNumber,
        kegType: keg.kegType as any,
        capacityML: keg.capacityML,
        status: keg.status as any,
        condition: keg.condition as any,
        currentLocation: keg.currentLocation || "cellar",
        purchaseDate: keg.purchaseDate || "",
        purchaseCost: keg.purchaseCost ? parseFloat(keg.purchaseCost) : undefined,
        notes: keg.notes || "",
      };
      reset(formData);
    }
  }, [keg, open, reset]);

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

  const formValues = watch();
  const kegTypeValue = formValues.kegType;
  const capacityML = formValues.capacityML;
  const statusValue = formValues.status;
  const conditionValue = formValues.condition;

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

              {/* Keg Type */}
              <div>
                <Label htmlFor="kegType">
                  Keg Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  key={`kegType-${kegTypeValue}`}
                  value={kegTypeValue}
                  onValueChange={(value) => setValue("kegType", value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select keg type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cornelius_5L">Cornelius 5L</SelectItem>
                    <SelectItem value="cornelius_9L">Cornelius 9L</SelectItem>
                    <SelectItem value="sanke_20L">
                      Sanke 20L (1/6 barrel)
                    </SelectItem>
                    <SelectItem value="sanke_30L">
                      Sanke 30L (1/4 barrel)
                    </SelectItem>
                    <SelectItem value="sanke_50L">
                      Sanke 50L (1/2 barrel)
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.kegType && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.kegType.message}
                  </p>
                )}
              </div>
            </div>

            {/* Capacity */}
            <div>
              <Label htmlFor="capacityML">
                Capacity (mL) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="capacityML"
                type="number"
                {...register("capacityML", { valueAsNumber: true })}
                className="mt-1"
              />
              {capacityML > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  ≈ {(capacityML / 1000).toFixed(1)}L
                </p>
              )}
              {errors.capacityML && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.capacityML.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  key={`status-${statusValue}`}
                  value={statusValue}
                  onValueChange={(value) => setValue("status", value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
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

              {/* Condition */}
              <div>
                <Label htmlFor="condition">
                  Condition <span className="text-red-500">*</span>
                </Label>
                <Select
                  key={`condition-${conditionValue}`}
                  value={conditionValue}
                  onValueChange={(value) =>
                    setValue("condition", value as any)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select condition" />
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

            <div className="grid grid-cols-2 gap-4">
              {/* Purchase Date */}
              <div>
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  {...register("purchaseDate")}
                  className="mt-1"
                />
                {errors.purchaseDate && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.purchaseDate.message}
                  </p>
                )}
              </div>

              {/* Purchase Cost */}
              <div>
                <Label htmlFor="purchaseCost">Purchase Cost ($)</Label>
                <Input
                  id="purchaseCost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("purchaseCost", { valueAsNumber: true })}
                  className="mt-1"
                />
                {errors.purchaseCost && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.purchaseCost.message}
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
