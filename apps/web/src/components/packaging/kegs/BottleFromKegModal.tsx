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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Wine, AlertTriangle, CheckCircle, Loader2, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";

// Form validation schema
const packagingMaterialSchema = z.object({
  packagingPurchaseItemId: z.string().uuid(),
  quantityUsed: z.number().int().positive(),
  materialType: z.string(),
});

const bottleFromKegSchema = z.object({
  volumeTakenL: z.number().positive("Volume must be positive"),
  packageSizeMl: z.number().positive("Package size must be positive"),
  unitsProduced: z.number().int().min(0, "Units cannot be negative"),
  packagedAt: z.string().min(1, "Date/time is required"),
  notes: z.string().optional(),
  materials: z.array(packagingMaterialSchema).min(1, "Please select at least one packaging material"),
});

type BottleFromKegForm = z.infer<typeof bottleFromKegSchema>;

interface SelectedMaterial {
  packagingPurchaseItemId: string;
  quantityUsed: number;
  materialType: string;
  itemName: string;
  availableQuantity: number;
}

interface BottleFromKegModalProps {
  open: boolean;
  onClose: () => void;
  kegFillId: string;
  kegNumber: string;
  batchId: string;
  batchName: string;
  vesselId: string;
  remainingVolumeL: number;
  onSuccess?: () => void;
}

export function BottleFromKegModal({
  open,
  onClose,
  kegFillId,
  kegNumber,
  batchId,
  batchName,
  vesselId,
  remainingVolumeL,
  onSuccess,
}: BottleFromKegModalProps) {
  const utils = trpc.useUtils();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [currentMaterialId, setCurrentMaterialId] = useState<string>("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<BottleFromKegForm>({
    resolver: zodResolver(bottleFromKegSchema),
    defaultValues: {
      volumeTakenL: undefined,
      packageSizeMl: undefined,
      unitsProduced: undefined,
      packagedAt: new Date().toISOString().slice(0, 16), // Current date/time in local format
      notes: "",
      materials: [],
    },
  });

  // Watch form values for real-time calculations
  const volumeTakenL = watch("volumeTakenL");
  const packageSizeMl = watch("packageSizeMl");
  const unitsProduced = watch("unitsProduced");

  // Auto-calculate units when volume and package size are set (one-way calculation)
  useEffect(() => {
    if (volumeTakenL && packageSizeMl && !isNaN(volumeTakenL) && !isNaN(packageSizeMl)) {
      const calculatedUnits = Math.floor((volumeTakenL * 1000) / packageSizeMl);
      setValue("unitsProduced", calculatedUnits);
    }
  }, [volumeTakenL, packageSizeMl, setValue]);

  // Combine all packaging inventory into one list (memoized to prevent infinite loops)
  const allPackagingItems = useMemo(() => [
    ...(primaryPackagingQuery.data?.items || []).map(item => ({ ...item, type: "Primary Packaging" })),
    ...(capsQuery.data?.items || []).map(item => ({ ...item, type: "Caps" })),
    ...(labelsQuery.data?.items || []).map(item => ({ ...item, type: "Labels" })),
  ], [primaryPackagingQuery.data?.items, capsQuery.data?.items, labelsQuery.data?.items]);

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
        packagedAt: new Date().toISOString().slice(0, 16),
        notes: "",
        materials: [],
      });
      setSelectedMaterials([]);
      setCurrentMaterialId("");
      setCurrentQuantity(1);
    }
  }, [open, reset]);

  const createPackagingMutation = trpc.packaging.createFromCellar.useMutation({
    onSuccess: () => {
      toast({
        title: "Bottles Created",
        description: `Successfully bottled ${unitsProduced} units from ${kegNumber}`,
      });
      utils.packaging.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Bottling Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BottleFromKegForm) => {
    if (lossL < -0.001) {
      return; // Prevent submission with negative loss
    }

    setIsSubmitting(true);
    try {
      await createPackagingMutation.mutateAsync({
        kegFillId, // This tells the API to bottle from the keg
        batchId,
        vesselId,
        packagedAt: new Date(data.packagedAt),
        packageSizeMl: data.packageSizeMl,
        unitsProduced: data.unitsProduced,
        volumeTakenL: data.volumeTakenL,
        notes: data.notes,
        materials: data.materials,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exceedsAvailable = (volumeTakenL || 0) > remainingVolumeL;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="w-5 h-5 text-purple-600" />
            Bottle from Keg
          </DialogTitle>
          <DialogDescription>
            Bottle contents from {kegNumber} ({batchName})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          {/* Available Volume Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Label className="text-sm font-medium text-blue-900">
              Available in Keg
            </Label>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {remainingVolumeL.toFixed(1)} L
            </p>
            <p className="text-xs text-blue-600 mt-1">
              ({(remainingVolumeL / 3.78541).toFixed(1)} gal)
            </p>
          </div>

          {/* Volume to Bottle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="volumeTakenL" className="text-sm md:text-base font-medium">
                Volume to bottle (L) *
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValue("volumeTakenL", remainingVolumeL)}
                className="h-7 text-xs"
              >
                Use All ({remainingVolumeL.toFixed(3)}L)
              </Button>
            </div>
            <Input
              id="volumeTakenL"
              type="text"
              inputMode="decimal"
              pattern="^\d*\.?\d+$"
              max={remainingVolumeL}
              placeholder={`Max ${remainingVolumeL.toFixed(1)}L available`}
              className="h-10 md:h-11 text-base"
              {...register("volumeTakenL", { valueAsNumber: true })}
            />
            {errors.volumeTakenL && (
              <p className="text-sm text-red-600 mt-1">{errors.volumeTakenL.message}</p>
            )}
            {exceedsAvailable && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Exceeds available volume
              </p>
            )}
          </div>

          {/* Packaging Materials Multi-Select */}
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
                  <Select
                    value={currentMaterialId}
                    onValueChange={setCurrentMaterialId}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select packaging material" />
                    </SelectTrigger>
                    <SelectContent>
                      {primaryPackagingQuery.isLoading || capsQuery.isLoading || labelsQuery.isLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading materials...
                        </SelectItem>
                      ) : allPackagingItems.length > 0 ? (
                        <>
                          {/* Primary Packaging Group */}
                          {allPackagingItems.filter(i => i.type === "Primary Packaging").length > 0 && (
                            <>
                              <SelectItem value="primary-header" disabled className="font-semibold">
                                Primary Packaging
                              </SelectItem>
                              {allPackagingItems
                                .filter(i => i.type === "Primary Packaging")
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.varietyName || item.size} - Available: {item.quantity}
                                  </SelectItem>
                                ))}
                            </>
                          )}

                          {/* Caps Group */}
                          {allPackagingItems.filter(i => i.type === "Caps").length > 0 && (
                            <>
                              <SelectItem value="caps-header" disabled className="font-semibold">
                                Caps
                              </SelectItem>
                              {allPackagingItems
                                .filter(i => i.type === "Caps")
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.varietyName || item.size} - Available: {item.quantity}
                                  </SelectItem>
                                ))}
                            </>
                          )}

                          {/* Labels Group */}
                          {allPackagingItems.filter(i => i.type === "Labels").length > 0 && (
                            <>
                              <SelectItem value="labels-header" disabled className="font-semibold">
                                Labels
                              </SelectItem>
                              {allPackagingItems
                                .filter(i => i.type === "Labels")
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.varietyName || item.size} - Available: {item.quantity}
                                  </SelectItem>
                                ))}
                            </>
                          )}
                        </>
                      ) : (
                        <SelectItem value="none" disabled>
                          No packaging materials available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
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

          {/* Units Produced */}
          <div>
            <Label htmlFor="unitsProduced" className="text-sm md:text-base font-medium">
              Units produced *
            </Label>
            <Input
              id="unitsProduced"
              type="text"
              inputMode="numeric"
              pattern="^\d+$"
              min="0"
              placeholder={
                volumeTakenL && packageSizeMl && !isNaN(volumeTakenL) && !isNaN(packageSizeMl)
                  ? `~${Math.floor(volumeTakenL / (packageSizeMl / 1000))} calculated`
                  : "Number of packages filled"
              }
              className="h-10 md:h-11 text-base"
              {...register("unitsProduced", { valueAsNumber: true })}
            />
            {errors.unitsProduced && (
              <p className="text-sm text-red-600 mt-1">{errors.unitsProduced.message}</p>
            )}
            {volumeTakenL && !isNaN(volumeTakenL) && packageSizeMl && !isNaN(packageSizeMl) && (
              <p className="text-xs text-green-600 mt-1">
                💡 Estimated based on volume and package size
              </p>
            )}
          </div>

          {/* Computed Loss Display */}
          {volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
            <div className={`p-3 md:p-4 rounded-lg border ${lossStatus.bg}`}>
              <div className="flex items-center space-x-2 mb-2">
                <lossStatus.icon
                  className={`w-4 h-4 md:w-5 md:h-5 ${lossStatus.color} flex-shrink-0`}
                />
                <Label className={`font-medium ${lossStatus.color} text-sm md:text-base`}>
                  Computed Loss
                </Label>
              </div>
              <div className="space-y-1">
                <p className={`text-base md:text-lg font-semibold ${lossStatus.color}`}>
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

          {/* Date/Time */}
          <div>
            <Label htmlFor="packagedAt" className="text-sm md:text-base font-medium">
              Bottled Date/Time *
            </Label>
            <Input
              id="packagedAt"
              type="datetime-local"
              className="h-10 md:h-11 text-base"
              {...register("packagedAt")}
            />
            {errors.packagedAt && (
              <p className="text-sm text-red-600 mt-1">{errors.packagedAt.message}</p>
            )}
          </div>

          {/* Production Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm md:text-base font-medium">
              Production Notes <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Any notes about this bottling run..."
              maxLength={500}
              className="min-h-[80px] text-base resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || createPackagingMutation.isPending}
              className="w-full sm:w-auto h-10 md:h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createPackagingMutation.isPending ||
                exceedsAvailable ||
                lossL < -0.001 ||
                !volumeTakenL ||
                selectedMaterials.length === 0 ||
                !packageSizeMl ||
                unitsProduced === undefined
              }
              className="w-full sm:w-auto h-10 md:h-11"
            >
              {isSubmitting || createPackagingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Bottling...
                </>
              ) : (
                <>
                  <Wine className="w-4 h-4 mr-2" />
                  Bottle from Keg
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
