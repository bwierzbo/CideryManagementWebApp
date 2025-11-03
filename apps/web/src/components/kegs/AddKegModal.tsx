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
import { Plus } from "lucide-react";

const addKegSchema = z.object({
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
  capacityUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().positive().optional(),
  currentLocation: z.string(),
  condition: z.enum(["excellent", "good", "fair", "needs_repair", "retired"]),
  notes: z.string().optional(),
});

type AddKegForm = z.infer<typeof addKegSchema>;

interface AddKegModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Keg type capacity presets
const KEG_TYPE_CAPACITIES: Record<string, number> = {
  cornelius_5L: 5000,
  cornelius_9L: 9000,
  sanke_20L: 19500, // 1/6 barrel
  sanke_30L: 30000, // 1/4 barrel
  sanke_50L: 50000, // 1/2 barrel
  other: 0,
};

export function AddKegModal({ open, onClose, onSuccess }: AddKegModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AddKegForm>({
    resolver: zodResolver(addKegSchema),
    defaultValues: {
      capacityUnit: "L",
      currentLocation: "cellar",
      condition: "excellent",
    },
  });

  const kegType = watch("kegType");
  const capacityML = watch("capacityML");

  // Auto-fill capacity when keg type changes
  useEffect(() => {
    if (kegType && KEG_TYPE_CAPACITIES[kegType]) {
      setValue("capacityML", KEG_TYPE_CAPACITIES[kegType]);
    }
  }, [kegType, setValue]);

  const createKegMutation = trpc.kegs.createKeg.useMutation({
    onSuccess: () => {
      toast({
        title: "Keg Added",
        description: "New keg registered successfully",
      });
      reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddKegForm) => {
    createKegMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Register New Keg
          </DialogTitle>
          <DialogDescription>
            Add a new keg to your asset registry for tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Keg Number */}
            <div>
              <Label htmlFor="kegNumber">
                Keg Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="kegNumber"
                placeholder="KEG-001"
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
                value={kegType}
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

          <div className="grid grid-cols-2 gap-4">
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

            {/* Condition */}
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select
                defaultValue="excellent"
                onValueChange={(value) => setValue("condition", value as any)}
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
            </div>
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

          {/* Current Location */}
          <div>
            <Label htmlFor="currentLocation">Current Location</Label>
            <Input
              id="currentLocation"
              placeholder="cellar"
              {...register("currentLocation")}
              className="mt-1"
            />
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createKegMutation.isPending}>
              {createKegMutation.isPending ? "Adding..." : "Add Keg"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
