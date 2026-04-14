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
import { AlertTriangle, CheckCircle, Plus, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { Card } from "@/components/ui/card";
import { PackageTypeSelector } from "./UnifiedPackagingModal";
import { PreBottlingBanner, type PreBottlingData } from "./PreBottlingBanner";
import { WorkerLaborInput, type WorkerAssignment, toApiLaborAssignments } from "@/components/labor/WorkerLaborInput";

// Form validation schema
const packagingMaterialSchema = z.object({
  packagingPurchaseItemId: z.string().uuid(),
  quantityUsed: z.number().int().positive(),
  materialType: z.string(),
});

const bottleFormSchema = z.object({
  volumeTakenL: z.number().positive("Volume must be positive"),
  packageSizeMl: z.number().positive("Package size must be positive"),
  unitsProduced: z.number().int().min(0, "Units cannot be negative"),
  packagedAt: z.string().min(1, "Date/time is required"),
  notes: z.string().optional(),
  materials: z.array(packagingMaterialSchema).min(1, "Please select at least one packaging material"),
  // Labor tracking (optional)
  laborHours: z.number().min(0).optional(),
  laborCostPerHour: z.number().min(0).optional(),
});

type BottleFormData = z.infer<typeof bottleFormSchema>;

interface SelectedMaterial {
  packagingPurchaseItemId: string;
  quantityUsed: number;
  materialType: string;
  itemName: string;
  availableQuantity: number;
}

interface BottleModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchId: string;
  currentVolumeL: number;
  kegFillId?: string; // Optional - when bottling from a keg
  showTypeSelector?: boolean; // Show package type selector (bottles vs kegs)
  onTypeChange?: (type: "bottles" | "kegs") => void; // Callback when type changes
  preBottling?: PreBottlingData;
}

type InputMode = "volume" | "units";

export function BottleModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
  kegFillId,
  showTypeSelector = false,
  onTypeChange,
  preBottling,
}: BottleModalProps) {
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [currentMaterialId, setCurrentMaterialId] = useState<string>("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);
  const [laborAssignments, setLaborAssignments] = useState<WorkerAssignment[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("volume");
  const [unitEntryMode, setUnitEntryMode] = useState<"bottles" | "cases">("bottles");
  const [casesCount, setCasesCount] = useState<number>(0);
  const [unitsPerCase, setUnitsPerCase] = useState<number>(12);
  const [looseBottles, setLooseBottles] = useState<number>(0);
  const [remainingAction, setRemainingAction] = useState<"keep" | "loss">("keep");
  const [lossReason, setLossReason] = useState<string>("sediment");
  const [lossNotes, setLossNotes] = useState<string>("");

  // tRPC queries for different packaging types
  const primaryPackagingQuery = trpc.packagingPurchases.listInventory.useQuery({
    itemType: "Primary Packaging",
    limit: 100,
  });
  const capsQuery = trpc.packagingPurchases.listInventory.useQuery({
    itemType: "Caps",
    limit: 100,
  });
  const labelsQuery = trpc.packagingPurchases.listInventory.useQuery({
    itemType: "Labels",
    limit: 100,
  });
  const createPackagingRunMutation =
    trpc.packaging.createFromCellar.useMutation();
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BottleFormData>({
    resolver: zodResolver(bottleFormSchema),
    defaultValues: {
      volumeTakenL: undefined,
      packageSizeMl: undefined,
      unitsProduced: undefined,
      packagedAt: formatDateTimeForInput(new Date()),
      notes: "",
      materials: [],
      laborHours: undefined,
      laborCostPerHour: undefined,
    },
  });

  // Watch form values for real-time calculations
  const volumeTakenL = watch("volumeTakenL");
  const packageSizeMl = watch("packageSizeMl");
  const unitsProduced = watch("unitsProduced");

  // Auto-calculate: volume → units (volume mode) or units → volume (units mode)
  useEffect(() => {
    if (inputMode === "volume") {
      if (volumeTakenL && packageSizeMl && !isNaN(volumeTakenL) && !isNaN(packageSizeMl)) {
        const calculatedUnits = Math.floor((volumeTakenL * 1000) / packageSizeMl);
        setValue("unitsProduced", calculatedUnits);
      }
    }
  }, [volumeTakenL, packageSizeMl, setValue, inputMode]);

  // In units mode: calculate volume from units × package size
  useEffect(() => {
    if (inputMode === "units") {
      if (unitsProduced && packageSizeMl && !isNaN(unitsProduced) && !isNaN(packageSizeMl)) {
        const calculatedVolume = parseFloat(((unitsProduced * packageSizeMl) / 1000).toFixed(3));
        setValue("volumeTakenL", calculatedVolume);
      }
    }
  }, [unitsProduced, packageSizeMl, setValue, inputMode]);

  // Cases + loose bottles: update total units (only in cases sub-mode)
  useEffect(() => {
    if (inputMode === "units" && unitEntryMode === "cases") {
      const fromCases = (casesCount || 0) * (unitsPerCase || 0);
      const totalUnits = fromCases + (looseBottles || 0);
      if (totalUnits >= 0) {
        setValue("unitsProduced", totalUnits);
      }
    }
  }, [casesCount, unitsPerCase, looseBottles, inputMode, unitEntryMode, setValue]);

  // Combine all packaging inventory into one list (memoized to prevent infinite loops)
  const allPackagingItems = useMemo(() => [
    ...(primaryPackagingQuery.data?.items || []).map(item => ({ ...item, type: "Primary Packaging" })),
    ...(capsQuery.data?.items || []).map(item => ({ ...item, type: "Caps" })),
    ...(labelsQuery.data?.items || []).map(item => ({ ...item, type: "Labels" })),
  ], [primaryPackagingQuery.data?.items, capsQuery.data?.items, labelsQuery.data?.items]);

  // Parse package size from material name (e.g., "750ml glass bottle" → 750)
  const parsePackageSizeFromName = (name: string): number | null => {
    const match = name.match(/(\d+)\s*ml/i);
    return match ? parseInt(match[1]) : null;
  };

  // Add material to the list
  const handleAddMaterial = () => {
    if (!currentMaterialId || currentQuantity <= 0) return;

    const selectedItem = allPackagingItems.find(item => item.id === currentMaterialId);
    if (!selectedItem) return;

    // Check if already added
    if (selectedMaterials.some(m => m.packagingPurchaseItemId === currentMaterialId)) {
      toast({
        title: "Material Already Added",
        description: "This material is already in the list. Remove it first to change the quantity.",
        variant: "destructive",
      });
      return;
    }

    // Check if quantity exceeds available
    if (currentQuantity > selectedItem.quantity) {
      toast({
        title: "Insufficient Quantity",
        description: `Only ${selectedItem.quantity} units available`,
        variant: "destructive",
      });
      return;
    }

    const newMaterial: SelectedMaterial = {
      packagingPurchaseItemId: currentMaterialId,
      quantityUsed: currentQuantity,
      materialType: selectedItem.type,
      itemName: selectedItem.varietyName || selectedItem.size || "Unknown",
      availableQuantity: selectedItem.quantity,
    };

    setSelectedMaterials([...selectedMaterials, newMaterial]);
    setValue("materials", [...selectedMaterials, newMaterial]);

    setCurrentMaterialId("");
    setCurrentQuantity(1);
  };

  // Remove material from the list
  const handleRemoveMaterial = (id: string) => {
    const updated = selectedMaterials.filter(m => m.packagingPurchaseItemId !== id);
    setSelectedMaterials(updated);
    setValue("materials", updated);
  };

  // Auto-detect package size when primary packaging is selected
  useEffect(() => {
    if (currentMaterialId) {
      const selectedItem = allPackagingItems.find(item => item.id === currentMaterialId);
      if (selectedItem && selectedItem.type === "Primary Packaging") {
        const match = (selectedItem.varietyName || selectedItem.size || "").match(/(\d+)\s*ml/i);
        const parsedSize = match ? parseInt(match[1]) : null;
        // Only update if value is actually changing to prevent infinite loop
        if (parsedSize && parsedSize !== packageSizeMl) {
          setValue("packageSizeMl", parsedSize);
        }
      }
    }
  }, [currentMaterialId, allPackagingItems, packageSizeMl, setValue]);

  // Auto-fill quantity when material is selected
  useEffect(() => {
    if (currentMaterialId && unitsProduced && unitsProduced > 0) {
      setCurrentQuantity(unitsProduced);
    }
  }, [currentMaterialId, unitsProduced]);

  // Update form materials when selectedMaterials changes
  useEffect(() => {
    setValue("materials", selectedMaterials);
  }, [selectedMaterials, setValue]);

  // Calculate loss and loss percentage (with NaN guards)
  const unitSizeL = (packageSizeMl && !isNaN(packageSizeMl) ? packageSizeMl : 0) / 1000;
  const expectedVolumeL = (unitsProduced && !isNaN(unitsProduced) ? unitsProduced : 0) * unitSizeL;
  const lossL = (volumeTakenL && !isNaN(volumeTakenL) ? volumeTakenL : 0) - expectedVolumeL;
  const lossPercentage = volumeTakenL && !isNaN(volumeTakenL) && volumeTakenL > 0 ? (lossL / volumeTakenL) * 100 : 0;

  // Remaining volume in tank after this packaging run
  const remainingVolumeL = volumeTakenL && !isNaN(volumeTakenL) ? currentVolumeL - volumeTakenL : currentVolumeL;
  const remainingPercentage = currentVolumeL > 0 ? (remainingVolumeL / currentVolumeL) * 100 : 0;
  const hasRemaining = remainingVolumeL > 0.01 && volumeTakenL && !isNaN(volumeTakenL) && volumeTakenL < currentVolumeL;
  // Smart default: if remaining is < 10% of tank, it's probably loss (sediment/dead space)
  const smartDefaultIsLoss = remainingPercentage < 10;

  // Auto-set remaining action based on smart default when volume changes
  useEffect(() => {
    if (hasRemaining) {
      setRemainingAction(smartDefaultIsLoss ? "loss" : "keep");
    }
  }, [hasRemaining, smartDefaultIsLoss]);

  // Determine loss status and styling
  const getLossStatus = () => {
    // Use a small epsilon for floating point comparison to handle -0.00 cases
    if (lossL < -0.001)
      return {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: AlertTriangle,
        message: "Invalid: negative loss",
      };
    if (lossPercentage > 10)
      return {
        color: "text-red-600",
        bg: "bg-red-50",
        icon: AlertTriangle,
        message: "Excessive loss (>10%)",
      };
    if (lossPercentage > 5)
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: AlertTriangle,
        message: "High loss (>5%)",
      };
    if (lossPercentage > 2)
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: AlertTriangle,
        message: "Moderate loss (2-5%)",
      };
    return {
      color: "text-green-600",
      bg: "bg-green-50",
      icon: CheckCircle,
      message: "Normal loss (<2%)",
    };
  };

  const lossStatus = getLossStatus();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        packagedAt: formatDateTimeForInput(new Date()),
        notes: "",
        materials: [],
        // packageSizeMl will be set automatically when primary packaging is selected
      });
      setSelectedMaterials([]);
      setCurrentMaterialId("");
      setCurrentQuantity(1);
      setLaborAssignments([]);
      setInputMode("volume");
      setUnitEntryMode("bottles");
      setCasesCount(0);
      setUnitsPerCase(12);
      setLooseBottles(0);
      setRemainingAction("keep");
      setLossReason("sediment");
      setLossNotes("");
    }
  }, [open, reset]);

  const handleFormSubmit = async (data: BottleFormData) => {
    if (lossL < -0.001) {
      return; // Prevent submission with negative loss
    }

    // Validate packagedAt is a valid date
    const packagedAtDate = parseDateTimeFromInput(data.packagedAt);
    if (!data.packagedAt || isNaN(packagedAtDate.getTime())) {
      toast({
        title: "Invalid Date",
        description: "Please enter a valid date and time",
        variant: "destructive",
      });
      return;
    }

    // Filter out any invalid labor assignments (safety check)
    const validLaborAssignments = laborAssignments.filter(
      (a) => a.workerId && a.hoursWorked > 0
    );

    setIsSubmitting(true);
    try {
      const result = await createPackagingRunMutation.mutateAsync({
        batchId,
        vesselId,
        packagedAt: packagedAtDate,
        packageSizeMl: data.packageSizeMl,
        unitsProduced: data.unitsProduced,
        volumeTakenL: data.volumeTakenL,
        notes: data.notes,
        materials: data.materials,
        ...(kegFillId && { kegFillId }), // Include kegFillId if bottling from keg
        // Labor tracking - using worker-based assignments (only include if there are valid assignments)
        ...(validLaborAssignments.length > 0 && {
          laborAssignments: toApiLaborAssignments(validLaborAssignments),
        }),
        // Remaining volume handling
        ...(hasRemaining && {
          remainingAction,
          ...(remainingAction === "loss" && {
            lossReason: lossReason as any,
            lossNotes: lossNotes || undefined,
          }),
        }),
      });

      // Invalidate relevant queries to refresh data
      utils.vessel.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      utils.batch.list.invalidate();
      if (kegFillId) {
        utils.packaging.kegs.listKegs.invalidate();
      }

      // Show success toast with option to view packaging run
      const lossDisplay = typeof result.lossL === "number" ? `${result.lossL.toFixed(2)}L (${(result.lossPercentage ?? 0).toFixed(1)}%)` : "0L";
      toast({
        title: "Packaging Run Created",
        description: `Successfully packaged ${data.unitsProduced} units from ${vesselName}. Loss: ${lossDisplay}`,
      });

      console.log("Packaging run created:", result);
      onClose();
    } catch (error) {
      console.error("Failed to create packaging run:", error);

      // Show error toast with specific error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Failed to Create Packaging Run",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg md:text-xl truncate pr-8">
            Package from {vesselName}
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            Package contents from this vessel.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit, (validationErrors) => {
            const firstError = Object.entries(validationErrors)[0];
            toast({
              title: "Validation Error",
              description: firstError ? `${firstError[0]}: ${firstError[1]?.message}` : "Please check the form",
              variant: "destructive",
            });
          })}
          className="space-y-4 md:space-y-6"
        >
          {/* 1. Available volume + Filter/Carb summary */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <div className="flex items-baseline justify-between">
              <Label className="text-sm font-medium text-blue-900">
                Available Volume
              </Label>
              <p className="text-2xl font-bold text-blue-700">
                {currentVolumeL.toFixed(1)}L
              </p>
            </div>
            <PreBottlingBanner data={preBottling} />
          </div>

          {/* 2. Date/time */}
          <div>
            <Label
              htmlFor="packagedAt"
              className="text-sm md:text-base font-medium"
            >
              Date/time *
            </Label>
            <Input
              id="packagedAt"
              type="datetime-local"
              className="h-10 md:h-11 text-base"
              {...register("packagedAt")}
            />
            {errors.packagedAt && (
              <p className="text-sm text-red-600 mt-1">
                {errors.packagedAt.message}
              </p>
            )}
          </div>

          {/* 3. Package Type Selector (if enabled) */}
          {showTypeSelector && onTypeChange && (
            <PackageTypeSelector
              value="bottles"
              onChange={onTypeChange}
              className="pb-4 border-b"
            />
          )}

          {/* 4. Input Mode Toggle */}
          <div>
            <Label className="text-sm md:text-base font-medium">
              How do you want to enter the quantity? *
            </Label>
            <div className="flex rounded-lg border overflow-hidden mt-2">
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                  inputMode === "volume"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => {
                  setInputMode("volume");
                }}
              >
                By Volume (L)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors border-l ${
                  inputMode === "units"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setInputMode("units")}
              >
                By Unit Count
              </button>
            </div>
          </div>

          {/* 5. Volume / Unit Count Input Fields */}
          <div className="space-y-3">
            {inputMode === "volume" ? (
              /* Volume input mode (original behavior) */
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label
                    htmlFor="volumeTakenL"
                    className="text-sm md:text-base font-medium"
                  >
                    Volume to use for bottling (L)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValue("volumeTakenL", currentVolumeL)}
                    className="h-7 text-xs"
                  >
                    Use All ({currentVolumeL.toFixed(3)}L)
                  </Button>
                </div>
                <Input
                  id="volumeTakenL"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d*\.?\d+$"
                  max={currentVolumeL}
                  placeholder={`Max ${currentVolumeL.toFixed(1)}L available`}
                  className="h-10 md:h-11 text-base"
                  {...register("volumeTakenL", { valueAsNumber: true })}
                />
                {errors.volumeTakenL && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.volumeTakenL.message}
                  </p>
                )}
                {/* Auto-calculated units display */}
                {unitsProduced !== undefined && !isNaN(unitsProduced) && packageSizeMl && (
                  <p className="text-xs text-green-600 mt-1">
                    = {unitsProduced} units ({packageSizeMl}ml each)
                  </p>
                )}
              </div>
            ) : (
              /* Unit count input mode */
              <div className="space-y-3">
                {!packageSizeMl && (
                  <p className="text-xs text-amber-600">
                    Select a primary packaging material below to set the package size
                  </p>
                )}

                {/* Bottles vs Cases sub-toggle */}
                <div className="flex rounded-md border overflow-hidden w-fit">
                  <button
                    type="button"
                    className={`py-1.5 px-3 text-xs font-medium transition-colors ${
                      unitEntryMode === "bottles"
                        ? "bg-gray-800 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setUnitEntryMode("bottles");
                      setValue("unitsProduced", undefined as unknown as number);
                      setValue("volumeTakenL", undefined as unknown as number);
                    }}
                  >
                    Bottles
                  </button>
                  <button
                    type="button"
                    className={`py-1.5 px-3 text-xs font-medium transition-colors border-l ${
                      unitEntryMode === "cases"
                        ? "bg-gray-800 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setUnitEntryMode("cases");
                      setValue("unitsProduced", undefined as unknown as number);
                      setValue("volumeTakenL", undefined as unknown as number);
                    }}
                  >
                    Cases
                  </button>
                </div>

                {unitEntryMode === "bottles" ? (
                  /* Direct bottle entry */
                  <div>
                    <Label
                      htmlFor="unitsProduced"
                      className="text-xs text-muted-foreground"
                    >
                      Number of bottles/cans
                    </Label>
                    <Input
                      id="unitsProduced"
                      type="text"
                      inputMode="numeric"
                      pattern="^\d+$"
                      min="0"
                      placeholder="Number of packages to fill"
                      className="h-10 md:h-11 text-base"
                      {...register("unitsProduced", { valueAsNumber: true })}
                    />
                    {errors.unitsProduced && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.unitsProduced.message}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Cases + loose bottles entry */
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="casesCount" className="text-xs text-muted-foreground">
                          Cases
                        </Label>
                        <Input
                          id="casesCount"
                          type="text"
                          inputMode="numeric"
                          pattern="^\d+$"
                          value={casesCount || ""}
                          onChange={(e) => setCasesCount(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="h-10 md:h-11 text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unitsPerCase" className="text-xs text-muted-foreground">
                          Per case
                        </Label>
                        <Input
                          id="unitsPerCase"
                          type="text"
                          inputMode="numeric"
                          pattern="^\d+$"
                          value={unitsPerCase || ""}
                          onChange={(e) => setUnitsPerCase(parseInt(e.target.value) || 0)}
                          placeholder="12"
                          className="h-10 md:h-11 text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="looseBottles" className="text-xs text-muted-foreground">
                          + Extra bottles
                        </Label>
                        <Input
                          id="looseBottles"
                          type="text"
                          inputMode="numeric"
                          pattern="^\d+$"
                          value={looseBottles || ""}
                          onChange={(e) => setLooseBottles(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="h-10 md:h-11 text-base"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Totals summary — bottles + volume */}
                {unitsProduced !== undefined && !isNaN(unitsProduced) && unitsProduced > 0 && (
                  <div className="p-3 bg-gray-50 border rounded-lg space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total bottles</span>
                      <span className="font-medium">
                        {unitsProduced}
                        {unitEntryMode === "cases" && casesCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({casesCount} x {unitsPerCase}{looseBottles > 0 ? ` + ${looseBottles}` : ""})
                          </span>
                        )}
                      </span>
                    </div>
                    {packageSizeMl && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Volume needed</span>
                          <span className="font-medium">
                            {volumeTakenL && !isNaN(volumeTakenL) ? volumeTakenL.toFixed(3) : "—"}L
                          </span>
                        </div>
                        <div className="border-t pt-1.5 flex justify-between">
                          <span className="text-muted-foreground">Available in tank</span>
                          <span className="font-medium">{currentVolumeL.toFixed(1)}L</span>
                        </div>
                        {(() => {
                          const remaining = volumeTakenL && !isNaN(volumeTakenL) ? currentVolumeL - volumeTakenL : null;
                          if (remaining === null) return null;
                          const isOver = remaining < -0.001;
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Remaining</span>
                                <span className={`font-medium ${isOver ? "text-red-600" : remaining < 0.001 ? "text-green-600" : "text-blue-600"}`}>
                                  {isOver
                                    ? `${remaining.toFixed(1)}L (not enough)`
                                    : `${remaining.toFixed(1)}L`}
                                </span>
                              </div>
                              {remaining > 0.1 && (
                                <p className="text-xs text-muted-foreground pt-0.5">
                                  Remaining can be a partial fill or packaging loss.
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Error: exceeds available */}
                {volumeTakenL && !isNaN(volumeTakenL) && volumeTakenL > currentVolumeL && (
                  <p className="text-sm text-red-600">
                    Volume needed exceeds available volume in tank.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Computed loss display — only shown in volume mode since units mode calculates exact volume */}
          {inputMode === "volume" && volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
            <div className={`p-3 md:p-4 rounded-lg border ${lossStatus.bg}`}>
              <div className="flex items-center space-x-2 mb-2">
                <lossStatus.icon
                  className={`w-4 h-4 md:w-5 md:h-5 ${lossStatus.color} flex-shrink-0`}
                />
                <Label
                  className={`font-medium ${lossStatus.color} text-sm md:text-base`}
                >
                  Computed Loss
                </Label>
              </div>
              <div className="space-y-1">
                <p
                  className={`text-base md:text-lg font-semibold ${lossStatus.color}`}
                >
                  {isNaN(lossL) ? "0.00" : lossL.toFixed(2)}L ({isNaN(lossPercentage) ? "0.0" : lossPercentage.toFixed(1)}%)
                </p>
                <p className={`text-sm ${lossStatus.color}`}>
                  {lossStatus.message}
                </p>
                <p className="text-xs text-gray-600 break-words">
                  Formula: {isNaN(volumeTakenL) || !volumeTakenL ? "0.0" : volumeTakenL.toFixed(1)}L taken - ({unitsProduced || 0} ×{" "}
                  {isNaN(unitSizeL) ? "0.000" : unitSizeL.toFixed(3)}L)
                </p>
              </div>
            </div>
          )}

          {/* 6. Packaging Materials */}
          <div className="space-y-3">
            <Label className="text-sm md:text-base font-medium">
              Packaging Materials *
            </Label>
            <p className="text-xs text-blue-600">
              💡 Select primary packaging first (e.g., 750ml bottles) to calculate units
            </p>

            {/* Add Material Section */}
            <Card className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <SearchableSelect
                    options={allPackagingItems.map((item) => ({
                      value: item.id,
                      label: `${item.varietyName || item.size} (${item.quantity} avail)`,
                      description: item.type,
                    }))}
                    value={currentMaterialId}
                    onValueChange={setCurrentMaterialId}
                    placeholder={
                      primaryPackagingQuery.isLoading ? "Loading materials..." :
                      allPackagingItems.length === 0 ? "No materials available" :
                      "Select packaging material"
                    }
                    searchPlaceholder="Type to search materials..."
                    emptyText="No matching materials"
                    disabled={primaryPackagingQuery.isLoading}
                  />
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="^\d+$"
                    min="1"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    onClick={handleAddMaterial}
                    disabled={!currentMaterialId || currentQuantity <= 0}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            </Card>

            {/* Selected Materials List */}
            {selectedMaterials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Selected Materials ({selectedMaterials.length})
                </Label>
                {selectedMaterials.map((material) => (
                  <Card key={material.packagingPurchaseItemId} className="p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{material.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {material.materialType} - Using {material.quantityUsed} of {material.availableQuantity} available
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(material.packagingPurchaseItemId)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {errors.materials && (
              <p className="text-sm text-red-600">
                {errors.materials.message}
              </p>
            )}
          </div>

          {/* 7. Remaining volume handling */}
          {hasRemaining && (
            <div className="p-3 border rounded-lg space-y-3">
              <div className="flex items-baseline justify-between">
                <Label className="text-sm md:text-base font-medium">
                  Remaining Volume
                </Label>
                <span className="text-lg font-bold text-blue-700">
                  {remainingVolumeL.toFixed(1)}L
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({remainingPercentage.toFixed(1)}% of tank)
                  </span>
                </span>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  What happens to the remaining {remainingVolumeL.toFixed(1)}L?
                </Label>
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                      remainingAction === "loss"
                        ? "bg-amber-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setRemainingAction("loss")}
                  >
                    Record as Loss
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 text-sm font-medium transition-colors border-l ${
                      remainingAction === "keep"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setRemainingAction("keep")}
                  >
                    Keep in Tank
                  </button>
                </div>
                {smartDefaultIsLoss && remainingAction === "loss" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-selected: remaining is less than 10% of tank volume
                  </p>
                )}
              </div>

              {remainingAction === "loss" && (
                <div className="space-y-2 pl-1">
                  <div>
                    <Label htmlFor="lossReason" className="text-xs text-muted-foreground">
                      Loss type
                    </Label>
                    <Select value={lossReason} onValueChange={setLossReason}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sediment">Sediment / Lees</SelectItem>
                        <SelectItem value="evaporation">Evaporation</SelectItem>
                        <SelectItem value="spillage">Spillage</SelectItem>
                        <SelectItem value="contamination">Contamination</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="lossNotes" className="text-xs text-muted-foreground">
                      Notes (optional)
                    </Label>
                    <Input
                      id="lossNotes"
                      type="text"
                      value={lossNotes}
                      onChange={(e) => setLossNotes(e.target.value)}
                      placeholder="e.g., trub at bottom of tank"
                      className="h-9 text-sm"
                    />
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                    This will record a {remainingVolumeL.toFixed(3)}L volume adjustment, mark the batch as completed, and set the vessel to cleaning.
                  </p>
                </div>
              )}

              {remainingAction === "keep" && (
                <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                  The remaining {remainingVolumeL.toFixed(1)}L will stay in the tank for another packaging run.
                </p>
              )}
            </div>
          )}

          {/* 8. Labor Tracking (optional) */}
          <WorkerLaborInput
            value={laborAssignments}
            onChange={setLaborAssignments}
            activityLabel="this packaging run"
          />

          {/* 8. Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm md:text-base font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any observations about packaging run"
              maxLength={500}
              className="min-h-[80px] text-base resize-none"
              {...register("notes")}
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || createPackagingRunMutation.isPending}
              className="w-full sm:w-auto h-10 md:h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createPackagingRunMutation.isPending ||
                lossL < -0.001 ||
                !volumeTakenL ||
                selectedMaterials.length === 0 ||
                !packageSizeMl ||
                unitsProduced === undefined ||
                (inputMode === "units" && volumeTakenL > currentVolumeL)
              }
              className="w-full sm:w-auto h-10 md:h-11"
            >
              <span className="hidden sm:inline">
                {isSubmitting || createPackagingRunMutation.isPending
                  ? "Creating..."
                  : "Complete & Go to /packaging"}
              </span>
              <span className="sm:hidden">
                {isSubmitting || createPackagingRunMutation.isPending
                  ? "Creating..."
                  : "Complete"}
              </span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
