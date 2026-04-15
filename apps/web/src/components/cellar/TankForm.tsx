"use client";

import React from "react";
import { trpc } from "@/utils/trpc";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { convertVolume } from "lib";
import { VolumeInput, VolumeUnit as VolumeUnitType } from "@/components/ui/volume-input";
import { BarrelContentsHistory } from "@/components/cellar/BarrelContentsHistory";

const tankSchema = z.object({
  name: z.string().optional(),
  capacity: z.number().positive("Capacity must be positive"),
  maxCapacity: z.number().min(0.001, "Max capacity must be positive").optional(),
  capacityUnit: z.enum(["L", "gal"]),
  material: z.enum(["stainless_steel", "plastic", "wood"]).optional(),
  jacketed: z.enum(["yes", "no"]).optional(),
  isPressureVessel: z.enum(["yes", "no"]).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  // Barrel-specific fields
  isBarrel: z.boolean().optional(),
  barrelWoodType: z.enum(["french_oak", "american_oak", "hungarian_oak", "chestnut", "other"]).optional(),
  barrelOriginContents: z.string().optional(), // Now dynamically loaded from barrel_origin_types table
  barrelOriginNotes: z.string().optional(),
  barrelToastLevel: z.enum(["light", "medium", "medium_plus", "heavy", "char"]).optional(),
  barrelYearAcquired: z.number().optional(),
  barrelAgeYears: z.number().optional(),
  barrelCost: z.number().optional(),
  barrelFlavorLevel: z.enum(["high", "medium", "low", "neutral"]).optional(),
});

type TankFormData = z.infer<typeof tankSchema>;

export function TankForm({
  vesselId,
  onClose,
}: {
  vesselId?: string;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<TankFormData>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      capacityUnit: "L",
    },
  });

  const utils = trpc.useUtils();
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId! },
    { enabled: !!vesselId },
  );

  // Fetch barrel origin types for dropdown
  const barrelOriginTypesQuery = trpc.barrelOriginTypes.list.useQuery();

  const createMutation = trpc.vessel.create.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      onClose();
      reset();
    },
  });

  const updateMutation = trpc.vessel.update.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      onClose();
      reset();
    },
  });

  // Load existing vessel data for editing
  React.useEffect(() => {
    if (vesselQuery.data?.vessel) {
      const vessel = vesselQuery.data.vessel;
      // Capacity is stored in the display unit (vessel.capacityUnit), no conversion needed
      const displayCapacity = parseFloat(vessel.capacity);
      const displayMaxCapacity = vessel.maxCapacity ? parseFloat(vessel.maxCapacity) : undefined;

      reset({
        name: vessel.name || undefined,
        capacity: displayCapacity,
        maxCapacity: displayMaxCapacity,
        capacityUnit: vessel.capacityUnit as any,
        material: vessel.material || undefined,
        jacketed: vessel.jacketed || undefined,
        isPressureVessel: vessel.isPressureVessel || undefined,
        location: vessel.location || undefined,
        notes: vessel.notes || undefined,
        // Barrel-specific fields - convert empty strings to undefined
        isBarrel: vessel.isBarrel || false,
        barrelWoodType: vessel.barrelWoodType || undefined,
        barrelOriginContents: vessel.barrelOriginContents || undefined,
        barrelOriginNotes: vessel.barrelOriginNotes || undefined,
        barrelToastLevel: vessel.barrelToastLevel || undefined,
        barrelYearAcquired: vessel.barrelYearAcquired || undefined,
        barrelAgeYears: vessel.barrelAgeYears || undefined,
        barrelCost: vessel.barrelCost ? parseFloat(vessel.barrelCost) : undefined,
        barrelFlavorLevel: vessel.barrelFlavorLevel || undefined,
      });
    }
  }, [vesselQuery.data, reset]);

  const watchedCapacityUnit = watch("capacityUnit");
  const watchedMaterial = watch("material");
  const watchedIsBarrel = watch("isBarrel");

  // Auto-set isBarrel when material is wood
  React.useEffect(() => {
    if (watchedMaterial === "wood" && !watchedIsBarrel) {
      setValue("isBarrel", true);
    }
  }, [watchedMaterial, watchedIsBarrel, setValue]);

  // Reset jacketed and pressure vessel when material is not stainless steel
  React.useEffect(() => {
    if (watchedMaterial === "plastic" || watchedMaterial === "wood") {
      setValue("jacketed", "no");
      setValue("isPressureVessel", "no");
    }
  }, [watchedMaterial, setValue]);

  // Only stainless steel can be jacketed or pressure vessel
  const canBeJacketedOrPressure = watchedMaterial === "stainless_steel";

  // Show barrel fields if material is wood or isBarrel is checked
  const showBarrelFields = watchedMaterial === "wood" || watchedIsBarrel;

  const onSubmit = (data: TankFormData) => {
    // Convert capacity to liters for storage (always stored in liters in DB)
    // capacityUnit for vessels is always L or gal
    const capacityL = convertVolume(
      data.capacity,
      data.capacityUnit as "L" | "gal",
      "L"
    );
    const maxCapacityL = data.maxCapacity
      ? convertVolume(data.maxCapacity, data.capacityUnit as "L" | "gal", "L")
      : undefined;

    const submitData = {
      ...data,
      capacityL,
      maxCapacityL,
      // Include barrel fields if this is a barrel
      ...(data.isBarrel && {
        isBarrel: data.isBarrel,
        barrelWoodType: data.barrelWoodType,
        barrelOriginContents: data.barrelOriginContents,
        barrelOriginNotes: data.barrelOriginNotes,
        barrelToastLevel: data.barrelToastLevel,
        barrelYearAcquired: data.barrelYearAcquired,
        barrelAgeYears: data.barrelAgeYears,
        barrelCost: data.barrelCost,
        barrelFlavorLevel: data.barrelFlavorLevel || "high",
      }),
    };

    if (vesselId) {
      updateMutation.mutate({ id: vesselId, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Tank Name</Label>
          <Input
            id="name"
            placeholder="Leave empty to auto-generate (Tank 1, Tank 2, etc.)"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="capacity">Working Capacity</Label>
          <VolumeInput
            id="capacity"
            value={watch("capacity")}
            unit={watchedCapacityUnit as VolumeUnitType}
            onValueChange={(value) => setValue("capacity", value || 0)}
            onUnitChange={(unit) => setValue("capacityUnit", unit as "L" | "gal")}
            placeholder="Normal fill level"
            required
          />
          {errors.capacity && (
            <p className="text-sm text-red-600 mt-1">
              {errors.capacity.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="maxCapacity">Max Capacity (optional)</Label>
          <VolumeInput
            id="maxCapacity"
            value={watch("maxCapacity")}
            unit={watchedCapacityUnit as VolumeUnitType}
            onValueChange={(value) => setValue("maxCapacity", value || undefined)}
            onUnitChange={(unit) => setValue("capacityUnit", unit as "L" | "gal")}
            placeholder="Including headspace"
          />
          <p className="text-xs text-muted-foreground mt-1">
            For overfill situations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="material">Material</Label>
          <Select
            value={watch("material")}
            onValueChange={(value) => setValue("material", value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stainless_steel">Stainless Steel</SelectItem>
              <SelectItem value="plastic">Plastic</SelectItem>
              <SelectItem value="wood">Wood</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="jacketed" className={!canBeJacketedOrPressure ? "text-muted-foreground" : ""}>
            Jacketed {!canBeJacketedOrPressure && <span className="text-xs">(SS only)</span>}
          </Label>
          <Select
            value={watch("jacketed")}
            onValueChange={(value) => setValue("jacketed", value as any)}
            disabled={!canBeJacketedOrPressure}
          >
            <SelectTrigger disabled={!canBeJacketedOrPressure}>
              <SelectValue placeholder="Select jacketed option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="isPressureVessel" className={!canBeJacketedOrPressure ? "text-muted-foreground" : ""}>
            Pressure Vessel {!canBeJacketedOrPressure && <span className="text-xs">(SS only)</span>}
          </Label>
          <Select
            value={watch("isPressureVessel")}
            onValueChange={(value) => setValue("isPressureVessel", value as any)}
            disabled={!canBeJacketedOrPressure}
          >
            <SelectTrigger disabled={!canBeJacketedOrPressure}>
              <SelectValue placeholder="Select pressure vessel option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="Building A, Row 1"
          {...register("location")}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          placeholder="Additional notes..."
          {...register("notes")}
        />
      </div>

      {/* Barrel-specific fields */}
      {showBarrelFields && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <h3 className="font-medium text-lg">Barrel Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barrelWoodType">Wood Type</Label>
              <Select
                value={watch("barrelWoodType")}
                onValueChange={(value) => setValue("barrelWoodType", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="french_oak">French Oak</SelectItem>
                  <SelectItem value="american_oak">American Oak</SelectItem>
                  <SelectItem value="hungarian_oak">Hungarian Oak</SelectItem>
                  <SelectItem value="chestnut">Chestnut</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="barrelToastLevel">Toast Level</Label>
              <Select
                value={watch("barrelToastLevel")}
                onValueChange={(value) => setValue("barrelToastLevel", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select toast level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="medium_plus">Medium+</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                  <SelectItem value="char">Char</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="barrelOriginContents">Previous Contents</Label>
              <Select
                value={watch("barrelOriginContents")}
                onValueChange={(value) => setValue("barrelOriginContents", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="What was in barrel before?" />
                </SelectTrigger>
                <SelectContent>
                  {barrelOriginTypesQuery.data?.types.map((type) => (
                    <SelectItem key={type.id} value={type.slug}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="barrelOriginNotes">Origin Notes</Label>
              <Input
                id="barrelOriginNotes"
                placeholder="e.g., 4-year Buffalo Trace"
                {...register("barrelOriginNotes")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="barrelYearAcquired">Year Acquired</Label>
              <Input
                id="barrelYearAcquired"
                type="number"
                placeholder={new Date().getFullYear().toString()}
                {...register("barrelYearAcquired", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="barrelAgeYears">Age When Acquired (years)</Label>
              <Input
                id="barrelAgeYears"
                type="number"
                placeholder="0"
                {...register("barrelAgeYears", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="barrelCost">Cost ($)</Label>
              <Input
                id="barrelCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("barrelCost", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="barrelFlavorLevel">Current Flavor Level</Label>
            <Select
              value={watch("barrelFlavorLevel") || "high"}
              onValueChange={(value) => setValue("barrelFlavorLevel", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select flavor contribution level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Strong oak/spirit character</SelectItem>
                <SelectItem value="medium">Medium - Moderate flavor contribution</SelectItem>
                <SelectItem value="low">Low - Subtle flavors remaining</SelectItem>
                <SelectItem value="neutral">Neutral - No significant flavor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              New barrels start at High. Flavor level decreases with each use.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : vesselId
              ? "Update Tank"
              : "Add Tank"}
        </Button>
      </div>
    </form>
  );
}

// Wrapper component that only shows barrel contents history if the vessel is a barrel
export function EditVesselBarrelHistory({ vesselId }: { vesselId: string }) {
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId },
    { enabled: !!vesselId }
  );

  // Only show for barrels
  if (!vesselQuery.data?.vessel?.isBarrel) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-6">
      <BarrelContentsHistory
        vesselId={vesselId}
        vesselName={vesselQuery.data.vessel.name || undefined}
      />
    </div>
  );
}
