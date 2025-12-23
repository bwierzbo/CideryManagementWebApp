"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollableSelectContent } from "@/components/ui/scrollable-select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import {
  Wine,
  AlertTriangle,
  Info,
  Search,
  Droplets,
  Scale,
  Beaker
} from "lucide-react";
import {
  WeightDisplay,
  toKg,
  normalizeUnit,
  type WeightUnit,
} from "@/components/ui/weight-display";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";

const fruitWineSchema = z.object({
  vesselId: z.string().min(1, "Please select a vessel"),
  fruitWeightKg: z.number().positive("Fruit weight must be positive"),
  waterAddedL: z.number().min(0, "Water cannot be negative"),
  sugarAddedKg: z.number().min(0, "Sugar cannot be negative"),
  estimatedVolumeL: z.number().positive("Estimated volume must be positive").optional(),
  name: z.string().optional(),
  startDate: z.date(),
  notes: z.string().optional(),
});

type FruitWineForm = z.infer<typeof fruitWineSchema>;

interface StartFruitWineBatchDialogProps {
  open: boolean;
  onClose: () => void;
  fruitPurchaseItem: {
    id: string;
    varietyName: string;
    vendorName: string;
    availableKg: number;
    originalUnit: string;
  };
  onSuccess: () => void;
}

export function StartFruitWineBatchDialog({
  open,
  onClose,
  fruitPurchaseItem,
  onSuccess,
}: StartFruitWineBatchDialogProps) {
  const utils = trpc.useUtils();
  const [vesselSearchQuery, setVesselSearchQuery] = useState("");
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<WeightUnit>("lb");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FruitWineForm>({
    resolver: zodResolver(fruitWineSchema),
    defaultValues: {
      waterAddedL: 0,
      sugarAddedKg: 0,
      startDate: new Date(),
    },
  });

  const vesselId = watch("vesselId");
  const fruitWeightKg = watch("fruitWeightKg");
  const waterAddedL = watch("waterAddedL");
  const sugarAddedKg = watch("sugarAddedKg");
  const startDate = watch("startDate");

  // Get vessels
  const vesselsQuery = trpc.vessel.list.useQuery();
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        waterAddedL: 0,
        sugarAddedKg: 0,
        startDate: new Date(),
        fruitWeightKg: fruitPurchaseItem.availableKg,
      });
      setVesselSearchQuery("");
    }
  }, [open, reset, fruitPurchaseItem.availableKg]);

  const createMutation = trpc.batch.createFruitWineBatch.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Fruit Wine Batch Created",
        description: data.message,
      });
      utils.baseFruitPurchases.listItems.invalidate();
      utils.batch.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      utils.vessel.list.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Batch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FruitWineForm) => {
    createMutation.mutate({
      fruitPurchaseItemId: fruitPurchaseItem.id,
      vesselId: data.vesselId,
      fruitWeightKg: data.fruitWeightKg,
      waterAddedL: data.waterAddedL,
      sugarAddedKg: data.sugarAddedKg,
      estimatedVolumeL: data.estimatedVolumeL,
      name: data.name,
      startDate: data.startDate,
      notes: data.notes,
    });
  };

  // Calculate estimated volume (rough estimate: fruit weight * 0.7 + water)
  const calculatedEstimatedVolume = useMemo(() => {
    if (!fruitWeightKg) return 0;
    return Math.round(fruitWeightKg * 0.7 + (waterAddedL || 0));
  }, [fruitWeightKg, waterAddedL]);

  // Check if selected vessel has capacity
  const selectedVessel = vesselsQuery.data?.vessels?.find(v => v.id === vesselId);
  const vesselMap = liquidMapQuery.data?.vessels?.find(v => v.vesselId === vesselId);
  const vesselHasBatch = !!vesselMap?.batchId;

  // Filter vessels based on search query (only show available/empty vessels for fruit wine)
  const filteredVessels = vesselsQuery.data?.vessels?.filter((vessel) => {
    const query = vesselSearchQuery.toLowerCase();
    const vesselName = (vessel.name || "").toLowerCase();
    const matchesSearch = vesselName.includes(query);
    const isAvailable = vessel.status === "available";
    const isEmpty = !liquidMapQuery.data?.vessels?.find(v => v.vesselId === vessel.id)?.batchId;
    return matchesSearch && isAvailable && isEmpty;
  }) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-purple-600" />
            Start Fruit Wine Batch
          </DialogTitle>
          <DialogDescription>
            Create a new batch from {fruitPurchaseItem.varietyName} via whole-fruit maceration
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Fruit Source Info */}
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-800">
                <p className="font-medium">{fruitPurchaseItem.varietyName}</p>
                <p className="text-xs mt-1">
                  From: {fruitPurchaseItem.vendorName} &bull; Available:{" "}
                  <WeightDisplay
                    weightKg={fruitPurchaseItem.availableKg}
                    originalUnit="kg"
                    displayUnit={weightDisplayUnit}
                    onToggle={setWeightDisplayUnit}
                    decimals={1}
                  />
                </p>
              </div>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate">
              Start Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={startDate ? new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => setValue("startDate", new Date(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Batch Name */}
          <div>
            <Label htmlFor="name">Batch Name (optional)</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={`${fruitPurchaseItem.varietyName} Wine`}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to auto-generate
            </p>
          </div>

          {/* Vessel Selection */}
          <div>
            <Label htmlFor="vesselId">
              Fermentation Vessel <span className="text-red-500">*</span>
            </Label>
            <Select
              value={vesselId}
              onValueChange={(value) => setValue("vesselId", value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select an empty vessel" />
              </SelectTrigger>
              <ScrollableSelectContent maxHeight="200px">
                {/* Search input */}
                <div className="px-2 pb-2 pt-1 sticky top-0 bg-background z-10 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vessels..."
                      value={vesselSearchQuery}
                      onChange={(e) => setVesselSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {vesselsQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading vessels...
                  </SelectItem>
                ) : filteredVessels.length ? (
                  filteredVessels.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      <div className="flex items-center gap-2">
                        <span>{vessel.name || "Unnamed Vessel"}</span>
                        <Badge variant="outline" className="text-xs">
                          {vessel.capacity}L
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {vesselSearchQuery ? "No vessels match" : "No empty vessels available"}
                  </SelectItem>
                )}
              </ScrollableSelectContent>
            </Select>
            {errors.vesselId && (
              <p className="text-sm text-red-600 mt-1">{errors.vesselId.message}</p>
            )}
          </div>

          {/* Fruit Weight */}
          <div>
            <Label htmlFor="fruitWeightKg">
              <Scale className="inline h-4 w-4 mr-1" />
              Fruit Weight (kg) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fruitWeightKg"
              type="number"
              step="0.1"
              {...register("fruitWeightKg", { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.fruitWeightKg && (
              <p className="text-sm text-red-600 mt-1">{errors.fruitWeightKg.message}</p>
            )}
            {fruitWeightKg > fruitPurchaseItem.availableKg && (
              <p className="text-sm text-orange-600 mt-1">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Exceeds available quantity ({fruitPurchaseItem.availableKg.toFixed(1)} kg)
              </p>
            )}
          </div>

          {/* Water Added */}
          <div>
            <Label htmlFor="waterAddedL">
              <Droplets className="inline h-4 w-4 mr-1" />
              Water Added (L)
            </Label>
            <Input
              id="waterAddedL"
              type="number"
              step="0.1"
              {...register("waterAddedL", { valueAsNumber: true })}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional - add water for thinner wines
            </p>
          </div>

          {/* Sugar Added */}
          <div>
            <Label htmlFor="sugarAddedKg">
              <Beaker className="inline h-4 w-4 mr-1" />
              Sugar Added (kg)
            </Label>
            <Input
              id="sugarAddedKg"
              type="number"
              step="0.1"
              {...register("sugarAddedKg", { valueAsNumber: true })}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional - for chaptalisation
            </p>
          </div>

          {/* Estimated Volume */}
          <div>
            <Label htmlFor="estimatedVolumeL">
              Estimated Volume (L)
            </Label>
            <Input
              id="estimatedVolumeL"
              type="number"
              step="0.1"
              placeholder={calculatedEstimatedVolume.toString()}
              {...register("estimatedVolumeL", { valueAsNumber: true })}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-estimate: ~{calculatedEstimatedVolume}L (fruit × 0.7 + water)
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Yeast strain, maceration details, etc."
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Summary */}
          {fruitWeightKg && vesselId && fruitWeightKg <= fruitPurchaseItem.availableKg && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wine className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Batch Summary
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Fruit:</span>
                  <span className="font-medium">{fruitWeightKg?.toFixed(1)} kg</span>
                </div>
                {waterAddedL > 0 && (
                  <div className="flex justify-between">
                    <span>Water:</span>
                    <span className="font-medium">{waterAddedL?.toFixed(1)} L</span>
                  </div>
                )}
                {sugarAddedKg > 0 && (
                  <div className="flex justify-between">
                    <span>Sugar:</span>
                    <span className="font-medium">{sugarAddedKg?.toFixed(1)} kg</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-300">
                  <span>Est. Volume:</span>
                  <span className="font-medium">~{calculatedEstimatedVolume} L</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining fruit:</span>
                  <span className="font-medium">
                    {(fruitPurchaseItem.availableKg - (fruitWeightKg || 0)).toFixed(1)} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                !fruitWeightKg ||
                !vesselId ||
                fruitWeightKg > fruitPurchaseItem.availableKg
              }
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createMutation.isPending ? "Creating..." : "Start Batch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
