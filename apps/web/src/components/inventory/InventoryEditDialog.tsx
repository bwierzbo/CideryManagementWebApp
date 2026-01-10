"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";

// Schema for base fruit items
const baseFruitEditSchema = z.object({
  quantity: z.number().int().min(0, "Quantity must be positive"),
  unit: z.enum(["kg", "lb", "L", "gal"]),
  harvestDate: z.date().optional(),
  notes: z.string().optional(),
});

// Schema for additive items
const additiveEditSchema = z.object({
  quantity: z.number().min(0, "Quantity must be positive"), // Allow decimals for fractional units (e.g., 2.5 lb yeast)
  unit: z.enum(["g", "kg", "lb", "L", "mL"]),
  unitCost: z.number().min(0, "Unit cost must be positive").optional(),
  totalCost: z.number().min(0, "Total cost must be positive").optional(),
  purchaseDate: z.date().optional(),
  notes: z.string().optional(),
});

// Schema for juice items
const juiceEditSchema = z.object({
  volumeL: z.number().min(0, "Volume must be positive"),
  unit: z.enum(["L", "gal"]),
  specificGravity: z.number().min(0.9).max(1.2).optional(),
  ph: z.number().min(0).max(14).optional(),
  notes: z.string().optional(),
});

// Schema for packaging items
const packagingEditSchema = z.object({
  quantity: z.number().int().min(0, "Quantity must be positive"),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

interface InventoryEditDialogProps {
  open: boolean;
  onClose: () => void;
  item: any; // The inventory item to edit
  onSuccess?: () => void;
}

export function InventoryEditDialog({
  open,
  onClose,
  item,
  onSuccess,
}: InventoryEditDialogProps) {
  const utils = trpc.useUtils();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract material type and item ID from the composite ID
  // Format: "materialType-uuid" (e.g., "basefruit-abc123...")
  const [materialType, ...idParts] = item?.id?.split("-") || [];
  const itemId = idParts.join("-"); // Rejoin in case UUID contains dashes
  const metadata = (item?.metadata || {}) as Record<string, any>;

  // Create form based on material type - use any type to handle dynamic forms
  const form = useForm<any>({
    resolver: zodResolver(
      materialType === "basefruit"
        ? baseFruitEditSchema
        : materialType === "additive"
          ? additiveEditSchema
          : materialType === "juice"
            ? juiceEditSchema
            : materialType === "packaging"
              ? packagingEditSchema
              : z.object({}),
    ),
    defaultValues:
      materialType === "basefruit"
        ? {
            quantity: item?.currentBottleCount || undefined,
            unit: metadata.unit || "kg",
            harvestDate: metadata.harvestDate
              ? new Date(metadata.harvestDate)
              : undefined,
            notes: item?.notes || "",
          }
        : materialType === "additive"
          ? {
              // Use actual quantity from metadata (total purchased), not currentBottleCount (remaining)
              quantity: metadata.quantity ? parseFloat(metadata.quantity) : (item?.currentBottleCount || undefined),
              unit: metadata.unit || "g",
              unitCost:
                parseFloat(metadata.unitCost) ||
                parseFloat(item?.unitCost) ||
                undefined,
              totalCost:
                parseFloat(metadata.totalCost) ||
                parseFloat(item?.totalCost) ||
                undefined,
              purchaseDate: metadata.purchaseDate
                ? new Date(metadata.purchaseDate)
                : new Date(),
              notes: item?.notes || "",
            }
          : materialType === "juice"
            ? {
                volumeL: item?.currentBottleCount || undefined,
                unit: metadata.unit || "L",
                specificGravity: metadata.specificGravity
                  ? parseFloat(metadata.specificGravity)
                  : undefined,
                ph: metadata.ph ? parseFloat(metadata.ph) : undefined,
                notes: item?.notes || "",
              }
            : materialType === "packaging"
              ? {
                  quantity: item?.currentBottleCount || undefined,
                  unit: metadata.unit || metadata.size || "units",
                  notes: item?.notes || "",
                }
              : {},
  });

  // Update mutations for each type
  const updateBaseFruit = trpc.inventory.updateBaseFruitItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      utils.inventory.list.invalidate();
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

  const updateAdditive = trpc.inventory.updateAdditiveItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      utils.inventory.list.invalidate();
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

  const updateJuice = trpc.inventory.updateJuiceItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      utils.inventory.list.invalidate();
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

  const updatePackaging = trpc.inventory.updatePackagingItem.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      utils.inventory.list.invalidate();
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

  const onSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      switch (materialType) {
        case "basefruit":
          await updateBaseFruit.mutateAsync({
            id: itemId,
            quantity: values.quantity,
            unit: values.unit,
            harvestDate: values.harvestDate,
            notes: values.notes,
          });
          break;
        case "additive":
          await updateAdditive.mutateAsync({
            id: itemId,
            quantity: values.quantity,
            unit: values.unit,
            notes: values.notes,
          });
          break;
        case "juice":
          await updateJuice.mutateAsync({
            id: itemId,
            volumeL: values.volume,
            specificGravity: values.specificGravity,
            ph: values.ph,
            notes: values.notes,
          });
          break;
        case "packaging":
          await updatePackaging.mutateAsync({
            id: itemId,
            quantity: values.quantity,
            notes: values.notes,
          });
          break;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (materialType) {
      case "basefruit":
        return `Edit ${metadata.varietyName || "Base Fruit"} Inventory`;
      case "additive":
        return `Edit ${metadata.productName || "Additive"} Inventory`;
      case "juice":
        return `Edit ${metadata.varietyName || "Juice"} Inventory`;
      case "packaging":
        return `Edit ${metadata.packageType || "Packaging"} Inventory`;
      default:
        return "Edit Inventory Item";
    }
  };

  const renderFormFields = () => {
    switch (materialType) {
      case "basefruit":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        placeholder="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="lb">Pounds (lb)</SelectItem>
                        <SelectItem value="L">Liters (L)</SelectItem>
                        <SelectItem value="gal">Gallons (gal)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="harvestDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Harvest Date</FormLabel>
                  <FormControl>
                    <HarvestDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select harvest date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "additive":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Purchased</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="g">Grams (g)</SelectItem>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="lb">Pounds (lbs)</SelectItem>
                        <SelectItem value="L">Liters (L)</SelectItem>
                        <SelectItem value="mL">Milliliters (mL)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value
                            ? parseFloat(e.target.value)
                            : undefined;
                          field.onChange(value);
                          // Calculate total from unit cost
                          const quantity = form.getValues("quantity");
                          if (value && quantity) {
                            form.setValue(
                              "totalCost",
                              parseFloat((value * quantity).toFixed(2)),
                            );
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="totalCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value
                            ? parseFloat(e.target.value)
                            : undefined;
                          field.onChange(value);
                          // Calculate unit cost from total
                          const quantity = form.getValues("quantity");
                          if (value && quantity) {
                            form.setValue(
                              "unitCost",
                              parseFloat((value / quantity).toFixed(2)),
                            );
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <HarvestDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select purchase date"
                      allowFutureDates={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "juice":
        return (
          <>
            <div>
              <FormField
                control={form.control}
                name="volumeL"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume</FormLabel>
                    <FormControl>
                      <VolumeInput
                        value={field.value}
                        unit={(form.watch("unit") as VolumeUnit) || "L"}
                        onValueChange={(value) => field.onChange(value || 0)}
                        onUnitChange={(unit) => form.setValue("unit", unit)}
                        placeholder="Enter volume"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specificGravity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SG (Specific Gravity)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="1.000"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ph"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>pH</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="3.5"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        );

      case "packaging":
        return (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      placeholder="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value) : undefined,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 12oz, 750ml, units" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Update the inventory details for this item
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {renderFormFields()}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
