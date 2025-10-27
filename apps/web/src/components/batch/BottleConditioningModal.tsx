"use client";

import React, { useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Info, Beaker } from "lucide-react";
import { calculatePrimingSugar } from "lib";

// Carbonation preset options
const CARBONATION_PRESETS = [
  { value: "0.5", label: "Still (0.5 vol)" },
  { value: "1.8", label: "Petillant (1.8 vol)" },
  { value: "3.0", label: "Sparkling (3.0 vol)" },
  { value: "custom", label: "Custom" },
] as const;

const bottleConditioningSchema = z.object({
  startingVolume: z.number().positive("Starting volume must be positive"),
  startingVolumeUnit: z.enum(["L", "gal"]),
  residualCo2Volumes: z
    .number()
    .min(0, "CO2 volumes cannot be negative")
    .max(5, "CO2 volumes must be at most 5")
    .optional()
    .nullable(),
  targetCo2Volumes: z
    .number()
    .min(0.1, "Target must be at least 0.1 volumes")
    .max(5, "Target must be at most 5 volumes"),
  sugarType: z.enum(["sucrose", "dextrose", "honey"]),
  additivePurchaseItemId: z.string().uuid("Please select a sugar source"),
  notes: z.string().optional(),
});

type BottleConditioningForm = z.infer<typeof bottleConditioningSchema>;

interface BottleConditioningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: {
    id: string;
    name: string;
    currentVolume: number;
    currentVolumeUnit: string;
  };
  onSuccess?: () => void;
}

export function BottleConditioningModal({
  open,
  onOpenChange,
  batch,
  onSuccess,
}: BottleConditioningModalProps) {
  const utils = trpc.useUtils();
  const [presetSelection, setPresetSelection] = React.useState<string>("3.0");
  const [isCustomTarget, setIsCustomTarget] = React.useState(false);

  // Query for available sweetener additives
  const { data: sweetenerInventory, isLoading: isLoadingInventory } =
    trpc.additivePurchases.list.useQuery(
      {
        limit: 100,
        offset: 0,
      },
      { enabled: open }
    );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<BottleConditioningForm>({
    resolver: zodResolver(bottleConditioningSchema),
    defaultValues: {
      startingVolume: batch.currentVolume,
      startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
      residualCo2Volumes: 0,
      targetCo2Volumes: 3.0, // Default to sparkling
      sugarType: "sucrose",
    },
  });

  const targetCo2Volumes = watch("targetCo2Volumes");
  const residualCo2Volumes = watch("residualCo2Volumes") || 0;
  const sugarType = watch("sugarType");
  const startingVolume = watch("startingVolume");
  const startingVolumeUnit = watch("startingVolumeUnit");

  // Convert volume to liters for calculations
  const volumeInLiters = useMemo(() => {
    if (startingVolumeUnit === "gal") {
      return startingVolume * 3.78541; // gallons to liters
    }
    return startingVolume;
  }, [startingVolume, startingVolumeUnit]);

  // Calculate required sugar
  const requiredSugarGrams = useMemo(() => {
    return calculatePrimingSugar(
      targetCo2Volumes,
      residualCo2Volumes,
      volumeInLiters,
      sugarType
    );
  }, [targetCo2Volumes, residualCo2Volumes, volumeInLiters, sugarType]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        startingVolume: batch.currentVolume,
        startingVolumeUnit: (batch.currentVolumeUnit as "L" | "gal") || "L",
        residualCo2Volumes: 0,
        targetCo2Volumes: 3.0,
        sugarType: "sucrose",
      });
      setPresetSelection("3.0");
      setIsCustomTarget(false);
    }
  }, [open, reset, batch.currentVolume, batch.currentVolumeUnit]);

  // Handle preset selection
  const handlePresetChange = (value: string) => {
    setPresetSelection(value);
    if (value === "custom") {
      setIsCustomTarget(true);
    } else {
      setIsCustomTarget(false);
      setValue("targetCo2Volumes", parseFloat(value));
    }
  };

  const startMutation = trpc.carbonation.start.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Bottle Conditioning Started",
        description: `Priming sugar added to ${batch.name} for bottle conditioning`,
      });

      utils.batch.list.invalidate();
      utils.batch.get.invalidate({ batchId: batch.id });
      utils.carbonation.listActive.invalidate();

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to Start Bottle Conditioning",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BottleConditioningForm) => {
    startMutation.mutate({
      batchId: batch.id,
      vesselId: null, // Bottle conditioning doesn't require a vessel
      startingVolume: data.startingVolume,
      startingVolumeUnit: data.startingVolumeUnit,
      startingCo2Volumes: data.residualCo2Volumes ?? undefined,
      targetCo2Volumes: data.targetCo2Volumes,
      carbonationProcess: "bottle_conditioning",
      pressureApplied: 0, // No pressure applied for bottle conditioning
      gasType: "CO2",
      notes: data.notes,
      // TODO: Add additive usage tracking when that's implemented
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bottle Conditioning Setup</DialogTitle>
          <DialogDescription>
            Add priming sugar to {batch.name} for natural carbonation in the bottle
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Info Alert */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <strong>Bottle Conditioning</strong> uses natural fermentation to create
                carbonation. Sugar is added before bottling, and yeast ferments it to produce
                CO2 trapped in the sealed bottle.
              </div>
            </div>
          </div>

          {/* Starting Conditions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Batch Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startingVolume">Volume to Bottle</Label>
                <Input
                  id="startingVolume"
                  type="number"
                  step="0.1"
                  {...register("startingVolume", { valueAsNumber: true })}
                />
                {errors.startingVolume && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.startingVolume.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="startingVolumeUnit">Unit</Label>
                <Select
                  value={startingVolumeUnit}
                  onValueChange={(value) =>
                    setValue("startingVolumeUnit", value as "L" | "gal")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Liters (L)</SelectItem>
                    <SelectItem value="gal">Gallons (gal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="residualCo2Volumes">
                Residual CO2 Volumes{" "}
                <span className="text-muted-foreground text-xs">optional</span>
              </Label>
              <Input
                id="residualCo2Volumes"
                type="number"
                step="0.1"
                placeholder="0"
                {...register("residualCo2Volumes", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                CO2 already dissolved in the cider (usually 0 for flat cider)
              </p>
              {errors.residualCo2Volumes && (
                <p className="text-sm text-destructive mt-1">
                  {errors.residualCo2Volumes.message}
                </p>
              )}
            </div>
          </div>

          {/* Target Carbonation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Target Carbonation</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preset">Carbonation Level</Label>
                <Select value={presetSelection} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARBONATION_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCustomTarget && (
                <div>
                  <Label htmlFor="targetCo2Volumes">Custom Target (vol)</Label>
                  <Input
                    id="targetCo2Volumes"
                    type="number"
                    step="0.1"
                    {...register("targetCo2Volumes", { valueAsNumber: true })}
                  />
                  {errors.targetCo2Volumes && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.targetCo2Volumes.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sugar Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Priming Sugar</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sugarType">Sugar Type</Label>
                <Select
                  value={sugarType}
                  onValueChange={(value) =>
                    setValue("sugarType", value as "sucrose" | "dextrose" | "honey")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sucrose">Table Sugar (Sucrose)</SelectItem>
                    <SelectItem value="dextrose">Corn Sugar (Dextrose)</SelectItem>
                    <SelectItem value="honey">Honey</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="additivePurchaseItemId">Sugar Source</Label>
                <Select
                  onValueChange={(value) =>
                    setValue("additivePurchaseItemId", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from inventory" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingInventory ? (
                      <SelectItem value="loading" disabled>
                        Loading inventory...
                      </SelectItem>
                    ) : sweetenerInventory?.purchases && sweetenerInventory.purchases.length > 0 ? (
                      sweetenerInventory.purchases.map((purchase) => (
                        <SelectItem key={purchase.id} value={purchase.id}>
                          {purchase.vendorName} - {new Date(purchase.purchaseDate).toLocaleDateString()}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No sweeteners in inventory
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.additivePurchaseItemId && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.additivePurchaseItemId.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Calculated Sugar Amount */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-green-900">
              <Beaker className="h-4 w-4" />
              Required Priming Sugar
            </div>
            <div className="text-2xl font-bold text-green-900">
              {requiredSugarGrams.toFixed(1)} grams
            </div>
            <div className="text-sm text-green-800">
              {(requiredSugarGrams / volumeInLiters).toFixed(2)} g/L •{" "}
              {(requiredSugarGrams / 1000).toFixed(3)} kg total
            </div>
            {requiredSugarGrams > 0 && (
              <div className="text-xs text-green-700 mt-2">
                Dissolve sugar in a small amount of boiled water before adding to batch
                to ensure even distribution.
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground text-xs">optional</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this bottle conditioning process..."
              rows={3}
              {...register("notes")}
            />
          </div>

          {/* Warning about bottle strength */}
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <strong>Important:</strong> Ensure bottles are rated for carbonated beverages.
                Over-priming can cause bottles to explode. Always use proper bottle conditioning
                bottles and crown caps.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? "Adding Sugar..." : "Add Priming Sugar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
