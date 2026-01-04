"use client";

import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useBatchDateValidation } from "@/hooks/useBatchDateValidation";
import { DateWarning } from "@/components/ui/DateWarning";
import { Tag, AlertTriangle, Info, Loader2, ChevronsUpDown, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const labelSchema = z.object({
  unitsToLabel: z.number().int().positive("Units to label must be positive"),
  labels: z.array(z.object({
    packagingItemId: z.string().min(1, "Please select a label"),
    quantity: z.number().int().positive("Quantity must be positive"),
  })).min(1, "At least one label is required"),
  labeledAt: z.string().min(1, "Please select a date"),
  // Labor tracking (optional)
  laborHours: z.number().min(0).optional(),
});

type LabelForm = z.infer<typeof labelSchema>;

interface LabelModalProps {
  open: boolean;
  onClose: () => void;
  bottleRunId: string;
  bottleRunName: string;
  unitsProduced: number;
  unitsLabeled?: number; // Current number of labeled units (for partial labeling)
  onSuccess: () => void;
}

export function LabelModal({
  open,
  onClose,
  bottleRunId,
  bottleRunName,
  unitsProduced,
  unitsLabeled: initialUnitsLabeled = 0,
  onSuccess,
}: LabelModalProps) {
  const utils = trpc.useUtils();
  const [comboboxOpen, setComboboxOpen] = useState<{[key: number]: boolean}>({});
  const [appliedLabels, setAppliedLabels] = useState<Array<{name: string, quantity: number}>>([]);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // Fetch fresh bottle run data when modal opens to get current unitsLabeled
  const { data: bottleRunData } = trpc.packaging.get.useQuery(bottleRunId, {
    enabled: open && !!bottleRunId,
  });

  // Date validation with phase-specific checks
  const { validateDate } = useBatchDateValidation(bottleRunData?.batchId, {
    bottleRunId,
    phase: "labeling",
  });

  // Use fresh data if available, otherwise fall back to prop
  const currentUnitsLabeled = bottleRunData?.unitsLabeled ?? initialUnitsLabeled;
  const remainingUnits = unitsProduced - currentUnitsLabeled;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
    control,
  } = useForm<LabelForm>({
    resolver: zodResolver(labelSchema),
    defaultValues: {
      unitsToLabel: remainingUnits,
      labels: [{ packagingItemId: "", quantity: remainingUnits }],
      labeledAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      laborHours: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "labels",
  });

  const labelsData = watch("labels");
  const unitsToLabelValue = watch("unitsToLabel");
  const labeledAt = watch("labeledAt");

  // Validate date when it changes
  useEffect(() => {
    if (labeledAt) {
      const result = validateDate(labeledAt);
      setDateWarning(result.warning);
      setDateError(result.error ?? null);
    }
  }, [labeledAt, validateDate]);

  // Get packaging items (labels) - filter by Secondary Packaging item type
  const { data: packagingItems, isLoading: isLoadingItems, refetch: refetchPackagingItems } =
    trpc.packagingPurchases.listInventory.useQuery(
      { itemType: "Secondary Packaging" },
      { enabled: open }
    );

  // Reset form and applied labels when modal opens
  useEffect(() => {
    if (open) {
      reset({
        unitsToLabel: remainingUnits,
        labels: [{ packagingItemId: "", quantity: remainingUnits }],
        labeledAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        laborHours: undefined,
      });
      setAppliedLabels([]);
      setComboboxOpen({});
    }
  }, [open, reset, remainingUnits]);

  const labelMutation = trpc.packaging.addLabel.useMutation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: LabelForm) => {
    setIsSubmitting(true);
    const labeledAt = new Date(data.labeledAt);
    const appliedLabelsList: Array<{name: string, quantity: number}> = [];

    try {
      // Apply each label sequentially
      for (let i = 0; i < data.labels.length; i++) {
        const label = data.labels[i];
        const result = await labelMutation.mutateAsync({
          bottleRunId,
          packagingItemId: label.packagingItemId,
          quantity: label.quantity,
          unitsToLabel: data.unitsToLabel,
          labeledAt: labeledAt,
          // Only pass labor hours on the first label application
          ...(i === 0 && data.laborHours !== undefined && { laborHours: data.laborHours }),
        });

        appliedLabelsList.push({
          name: result.labelName || "Label",
          quantity: label.quantity,
        });
      }

      // Success - update applied labels list
      setAppliedLabels(prev => [...prev, ...appliedLabelsList]);

      toast({
        title: "Labels Applied",
        description: `Successfully labeled ${data.unitsToLabel} units with ${appliedLabelsList.length} label type(s)`,
      });

      // Refresh inventory and bottle data
      utils.packaging.list.invalidate();
      utils.packaging.get.invalidate(bottleRunId);
      refetchPackagingItems();
      onSuccess();

      // Close modal after successful labeling
      onClose();

    } catch (error: any) {
      toast({
        title: "Labeling Failed",
        description: error.message || "Failed to apply labels",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Apply Labels
          </DialogTitle>
          <DialogDescription>
            Select labels from inventory and specify quantity to apply to{" "}
            {bottleRunName}
          </DialogDescription>
        </DialogHeader>

        {/* Applied Labels List */}
        {appliedLabels.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-green-900 mb-2">
              Labels Applied:
            </h4>
            <ul className="space-y-1">
              {appliedLabels.map((label, index) => (
                <li key={index} className="flex items-center justify-between text-sm">
                  <span className="text-green-800">{label.name}</span>
                  <Badge variant="secondary">{label.quantity.toLocaleString()} units</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Packaging Run Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Produced:</span>
              <span className="font-semibold text-blue-900">
                {unitsProduced.toLocaleString()} units
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Already Labeled:</span>
              <span className="font-semibold text-blue-900">
                {currentUnitsLabeled.toLocaleString()} units
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-blue-200 pt-2">
              <span className="text-gray-600">Remaining to Label:</span>
              <span className="font-semibold text-green-700">
                {remainingUnits.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* Units to Label */}
          <div className="space-y-2">
            <Label htmlFor="unitsToLabel">
              Units to Label <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unitsToLabel"
              type="text"
              inputMode="numeric"
              pattern="^\d+$"
              {...register("unitsToLabel", { valueAsNumber: true })}
              placeholder="Enter number of bottles to label"
            />
            {errors.unitsToLabel && (
              <p className="text-sm text-red-500">{errors.unitsToLabel.message}</p>
            )}
            {unitsToLabelValue > remainingUnits && (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Only {remainingUnits} bottles remaining. Adjust quantity or label all remaining.
                </span>
              </div>
            )}
          </div>

          {/* Loading/Empty State */}
          {isLoadingItems ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading labels...
            </div>
          ) : packagingItems?.items.length === 0 ? (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              No labels found in packaging inventory
            </div>
          ) : (
            <>
              {/* Labels to Apply */}
              <div className="space-y-3">
                <Label>Labels to Apply <span className="text-red-500">*</span></Label>

                {fields.map((field, index) => {
                  const selectedItem = packagingItems?.items.find(
                    (item) => item.id === labelsData[index]?.packagingItemId
                  );
                  const hasInsufficientStock = selectedItem && labelsData[index]?.quantity > selectedItem.quantity;

                  return (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                      {/* Label Selector */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Label</Label>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>

                        <Popover
                          open={comboboxOpen[index]}
                          onOpenChange={(open) =>
                            setComboboxOpen(prev => ({ ...prev, [index]: open }))
                          }
                          modal={false}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={comboboxOpen[index]}
                              className="w-full justify-between"
                            >
                              {labelsData[index]?.packagingItemId
                                ? packagingItems?.items.find(
                                    (item) => item.id === labelsData[index]?.packagingItemId
                                  )?.size
                                : "Select a label..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command shouldFilter={true}>
                              <CommandInput placeholder="Search labels..." />
                              <CommandList
                                className="max-h-[200px] overflow-y-auto overscroll-contain touch-pan-y"
                                onWheel={(e) => e.stopPropagation()}
                              >
                                <CommandEmpty>No label found.</CommandEmpty>
                                <CommandGroup>
                                  {packagingItems?.items.map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={item.size}
                                      onSelect={() => {
                                        setValue(`labels.${index}.packagingItemId`, item.id);
                                        setComboboxOpen(prev => ({ ...prev, [index]: false }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          labelsData[index]?.packagingItemId === item.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex items-center justify-between flex-1">
                                        <span className="truncate">{item.size}</span>
                                        <Badge
                                          variant={item.quantity > 0 ? "default" : "destructive"}
                                          className="ml-2 flex-shrink-0"
                                        >
                                          {item.quantity} in stock
                                        </Badge>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {errors.labels?.[index]?.packagingItemId && (
                          <p className="text-sm text-red-500">
                            {errors.labels[index]?.packagingItemId?.message}
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="space-y-2">
                        <Label className="text-sm">Quantity</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="^\d+$"
                          {...register(`labels.${index}.quantity`, { valueAsNumber: true })}
                          placeholder="Enter quantity"
                        />
                        {errors.labels?.[index]?.quantity && (
                          <p className="text-sm text-red-500">
                            {errors.labels[index]?.quantity?.message}
                          </p>
                        )}
                        {selectedItem && (
                          <div className="flex items-start gap-2 text-sm">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600">
                              Available: {selectedItem.quantity} labels
                            </span>
                          </div>
                        )}
                        {hasInsufficientStock && (
                          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              Insufficient stock! Only {selectedItem?.quantity} available.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Another Label Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ packagingItemId: "", quantity: unitsToLabelValue || remainingUnits })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Label
                </Button>
              </div>
            </>
          )}

          {/* Labeling Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="labeledAt">
              Labeling Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="labeledAt"
              type="datetime-local"
              {...register("labeledAt")}
            />
            <DateWarning warning={dateWarning} error={dateError} />
            {errors.labeledAt && (
              <p className="text-sm text-red-500">{errors.labeledAt.message}</p>
            )}
          </div>

          {/* Labor Hours */}
          <div className="space-y-2">
            <Label htmlFor="laborHours">
              Labor Hours <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              id="laborHours"
              type="number"
              step="0.25"
              min="0"
              placeholder="e.g., 1.5"
              {...register("laborHours", { valueAsNumber: true })}
            />
            <p className="text-xs text-gray-500">Hours spent on labeling for COGS</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isLoadingItems || !!dateError}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying {labelsData.length} label{labelsData.length > 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 mr-2" />
                  Apply {labelsData.length} Label{labelsData.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full"
              disabled={isSubmitting}
            >
              Close
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
