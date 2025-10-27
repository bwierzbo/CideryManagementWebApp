"use client";

import React, { useState, useEffect } from "react";
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
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

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
}

export function BottleModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: BottleModalProps) {
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
  const createPackagingRunMutation =
    trpc.bottles.createFromCellar.useMutation();
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
      packagedAt: new Date().toISOString().slice(0, 16), // Current date/time in local format
      notes: "",
    },
  });

  // Watch form values for real-time calculations
  const volumeTakenL = watch("volumeTakenL");
  const packageSizeMl = watch("packageSizeMl");
  const unitsProduced = watch("unitsProduced");

  // Combine all packaging inventory into one list
  const allPackagingItems = [
    ...(primaryPackagingQuery.data?.items || []).map(item => ({ ...item, type: "Primary Packaging" })),
    ...(capsQuery.data?.items || []).map(item => ({ ...item, type: "Caps" })),
    ...(labelsQuery.data?.items || []).map(item => ({ ...item, type: "Labels" })),
  ];

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

  // Update form materials when selectedMaterials changes
  useEffect(() => {
    setValue("materials", selectedMaterials);
  }, [selectedMaterials, setValue]);

  // Calculate loss and loss percentage
  const unitSizeL = (packageSizeMl || 0) / 1000;
  const expectedVolumeL = (unitsProduced || 0) * unitSizeL;
  const lossL = (volumeTakenL || 0) - expectedVolumeL;
  const lossPercentage = volumeTakenL > 0 ? (lossL / volumeTakenL) * 100 : 0;

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

  const handleFormSubmit = async (data: BottleFormData) => {
    if (lossL < -0.001) {
      return; // Prevent submission with negative loss
    }

    setIsSubmitting(true);
    try {
      const result = await createPackagingRunMutation.mutateAsync({
        batchId,
        vesselId,
        packagedAt: new Date(data.packagedAt),
        packageSizeMl: data.packageSizeMl,
        unitsProduced: data.unitsProduced,
        volumeTakenL: data.volumeTakenL,
        notes: data.notes,
        materials: data.materials,
      });

      // Invalidate relevant queries to refresh data
      utils.vessel.liquidMap.invalidate();
      utils.batch.list.invalidate();

      // Show success toast with option to view packaging run
      toast({
        title: "Bottle Run Created",
        description: `Successfully packaged ${data.unitsProduced} units from ${vesselName}. Loss: ${result.lossL.toFixed(2)}L (${result.lossPercentage.toFixed(1)}%)`,
      });

      console.log("Packaging run created:", result);
      onClose();
    } catch (error) {
      console.error("Failed to create packaging run:", error);

      // Show error toast with specific error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Failed to Create Bottle Run",
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
            Bottle from {vesselName}
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            Package contents from this vessel. Available volume:{" "}
            {currentVolumeL.toFixed(1)}L
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-4 md:space-y-6"
        >
          {/* Available tank volume - display only */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Label className="text-sm font-medium text-blue-900">
              Available Volume in Tank
            </Label>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {currentVolumeL.toFixed(1)}L
            </p>
          </div>

          {/* Volume taken */}
          <div>
            <Label
              htmlFor="volumeTakenL"
              className="text-sm md:text-base font-medium"
            >
              Volume to use for bottling (L) *
            </Label>
            <Input
              id="volumeTakenL"
              type="number"
              step="0.1"
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
            <p className="text-xs text-gray-500 mt-1">
              Liters to be removed from tank for bottling
            </p>
          </div>

          {/* Packaging Materials Multi-Select */}
          <div className="space-y-3">
            <Label className="text-sm md:text-base font-medium">
              Packaging Materials *
            </Label>

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
                    type="number"
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

          {/* Package size input */}
          <div>
            <Label
              htmlFor="packageSizeMl"
              className="text-sm md:text-base font-medium"
            >
              Volume each package holds (mL) *
            </Label>
            <Input
              id="packageSizeMl"
              type="number"
              step="1"
              min="1"
              placeholder="e.g., 355, 500, 750"
              className="h-10 md:h-11 text-base"
              {...register("packageSizeMl", { valueAsNumber: true })}
            />
            {errors.packageSizeMl && (
              <p className="text-sm text-red-600 mt-1">
                {errors.packageSizeMl.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Volume in milliliters (mL) that each package holds
            </p>
          </div>

          {/* Units produced */}
          <div>
            <Label
              htmlFor="unitsProduced"
              className="text-sm md:text-base font-medium"
            >
              Units produced *
            </Label>
            <Input
              id="unitsProduced"
              type="number"
              min="0"
              placeholder="Number of packages filled"
              className="h-10 md:h-11 text-base"
              {...register("unitsProduced", { valueAsNumber: true })}
            />
            {errors.unitsProduced && (
              <p className="text-sm text-red-600 mt-1">
                {errors.unitsProduced.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Number of packages filled
            </p>
          </div>

          {/* Computed loss display */}
          {volumeTakenL && packageSizeMl && unitsProduced !== undefined && (
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
                  {lossL.toFixed(2)}L ({lossPercentage.toFixed(1)}%)
                </p>
                <p className={`text-sm ${lossStatus.color}`}>
                  {lossStatus.message}
                </p>
                <p className="text-xs text-gray-600 break-words">
                  Formula: {volumeTakenL.toFixed(1)}L taken - ({unitsProduced} ×{" "}
                  {unitSizeL.toFixed(3)}L)
                </p>
              </div>
            </div>
          )}

          {/* Date/time */}
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

          {/* Notes */}
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
                unitsProduced === undefined
              }
              className="w-full sm:w-auto h-10 md:h-11"
            >
              <span className="hidden sm:inline">
                {isSubmitting || createPackagingRunMutation.isPending
                  ? "Creating..."
                  : "Complete & Go to /bottles"}
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
