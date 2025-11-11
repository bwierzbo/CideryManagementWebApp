"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Wine, AlertTriangle, Loader2, Package } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const kegVolumeSchema = z.object({
  kegId: z.string().uuid(),
  volumeTaken: z.number().positive("Volume must be positive"),
});

const fillKegsSchema = z.object({
  kegVolumes: z.array(kegVolumeSchema).min(1, "Select at least one keg"),
  filledAt: z.string().min(1, "Date/time is required"),
  volumeTakenUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  loss: z.number().min(0).optional(),
  lossUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  carbonationMethod: z.enum(["natural", "forced", "none"]).optional(),
  productionNotes: z.string().optional(),
});

type FillKegsForm = z.infer<typeof fillKegsSchema>;

interface FillKegModalProps {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  vesselName: string;
  batchId: string;
  currentVolumeL: number;
}

// Memoized keg item component to prevent re-renders
const KegItem = React.memo(({ keg, isSelected, onToggle }: {
  keg: any;
  isSelected: boolean;
  onToggle: (kegId: string) => void;
}) => {
  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[KegItem] Click - keg.id:', keg.id);
    onToggle(keg.id);
  }, [keg.id, onToggle]);

  console.log('[KegItem] Render - keg:', keg.kegNumber, 'isSelected:', isSelected);

  return (
    <div
      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
      onClick={handleClick}
    >
      {/* Simple checkbox visual instead of Checkbox component */}
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
        isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
      }`}>
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M5 13l4 4L19 7"></path>
          </svg>
        )}
      </div>
      <div className="flex-1">
        <p className="font-semibold">{keg.kegNumber}</p>
        <p className="text-sm text-gray-600">
          {keg.kegType.replace("_", " ")} -{" "}
          {(keg.capacityML / 1000).toFixed(1)}L
        </p>
        <p className="text-xs text-gray-500">
          {keg.currentLocation}
        </p>
      </div>
      <Package className="w-5 h-5 text-gray-400" />
    </div>
  );
});

KegItem.displayName = 'KegItem';

export function FillKegModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: FillKegModalProps) {
  console.log('[FillKegModal] Render - open:', open);
  const [selectedKegIds, setSelectedKegIds] = useState<string[]>([]);
  const [kegVolumes, setKegVolumes] = useState<Record<string, number>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FillKegsForm>({
    resolver: zodResolver(fillKegsSchema),
    defaultValues: {
      filledAt: new Date().toISOString().slice(0, 16),
      volumeTakenUnit: "L",
      lossUnit: "L",
      carbonationMethod: "none",
    },
  });

  const utils = trpc.useUtils();

  // Get available kegs with query stabilization to prevent infinite refetches
  const { data: kegsData, isLoading: kegsLoading } =
    trpc.kegs.getAvailableKegs.useQuery(undefined, {
      enabled: open,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 30000, // 30 seconds
    });

  const availableKegs = React.useMemo(() => kegsData ?? [], [kegsData]);

  const fillKegsMutation = trpc.kegs.fillKegs.useMutation({
    onSuccess: () => {
      toast({
        title: "Kegs Filled",
        description: `Successfully filled ${selectedKegIds.length} keg(s)`,
      });
      utils.kegs.listKegs.invalidate();
      utils.kegs.getAvailableKegs.invalidate();
      reset();
      setSelectedKegIds([]);
      setKegVolumes({});
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

  // Reset selected kegs and volumes when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedKegIds([]);
      setKegVolumes({});
    }
  }, [open]);

  // Memoized toggle handler with stable reference using useCallback
  const handleKegToggle = React.useCallback((kegId: string) => {
    console.log('[FillKegModal] handleKegToggle called with:', kegId);

    // Check current state before toggling
    setSelectedKegIds((prev) => {
      const isCurrentlySelected = prev.includes(kegId);
      const next = isCurrentlySelected
        ? prev.filter((id) => id !== kegId)
        : [...prev, kegId];

      // Handle volume auto-fill/removal based on current state
      if (!isCurrentlySelected) {
        // About to select - auto-fill with keg capacity
        const keg = availableKegs.find(k => k.id === kegId);
        if (keg) {
          const capacityL = keg.capacityML / 1000;
          setKegVolumes(volumes => ({...volumes, [kegId]: capacityL}));
        }
      } else {
        // About to deselect - remove volume
        setKegVolumes(volumes => {
          const {[kegId]: _, ...rest} = volumes;
          return rest;
        });
      }

      return next;
    });
  }, [availableKegs]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  }, [onClose]); // Now safe - parent memoizes onClose

  const onSubmit = (data: FillKegsForm) => {
    // Build keg volumes array from state
    const kegVolumesArray = selectedKegIds.map(kegId => ({
      kegId,
      volumeTaken: kegVolumes[kegId] || 0,
    }));

    // Validate that all kegs have volumes
    if (kegVolumesArray.some(kv => kv.volumeTaken <= 0)) {
      toast({
        title: "Error",
        description: "Please enter a volume for all selected kegs",
        variant: "destructive",
      });
      return;
    }

    fillKegsMutation.mutate({
      kegVolumes: kegVolumesArray,
      batchId,
      vesselId,
      filledAt: new Date(data.filledAt),
      volumeTakenUnit: data.volumeTakenUnit,
      loss: data.loss,
      lossUnit: data.lossUnit,
      carbonationMethod: data.carbonationMethod,
      productionNotes: data.productionNotes,
    });
  };

  // Calculate total volume to be taken
  const totalVolumeTaken = selectedKegIds.reduce(
    (sum, kegId) => sum + (kegVolumes[kegId] || 0),
    0
  );
  const exceedsCapacity = totalVolumeTaken > currentVolumeL;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Fill Kegs from {vesselName}
          </DialogTitle>
          <DialogDescription>
            Select available kegs and record fill details. Current vessel volume:{" "}
            {currentVolumeL.toFixed(1)}L
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Available Kegs Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Select Kegs to Fill{" "}
              <span className="text-red-500">*</span>
            </Label>

            {kegsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : !availableKegs || availableKegs.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-gray-500">
                  No available kegs. Register kegs in the Kegs tab first.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                {availableKegs.map((keg) => (
                  <KegItem
                    key={keg.id}
                    keg={keg}
                    isSelected={selectedKegIds.includes(keg.id)}
                    onToggle={handleKegToggle}
                  />
                ))}
              </div>
            )}

            {selectedKegIds.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {selectedKegIds.length} keg(s)
              </p>
            )}
          </div>

          {/* Individual Keg Volumes */}
          {selectedKegIds.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Keg Fill Volumes</h3>
                {totalVolumeTaken > 0 && (
                  <p
                    className={`text-sm ${exceedsCapacity ? "text-red-600 font-semibold" : "text-gray-600"}`}
                  >
                    Total: {totalVolumeTaken.toFixed(1)}L / {currentVolumeL.toFixed(1)}L
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                {selectedKegIds.map((kegId) => {
                  const keg = availableKegs.find(k => k.id === kegId);
                  if (!keg) return null;

                  return (
                    <div key={kegId} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{keg.kegNumber}</p>
                        <p className="text-xs text-gray-600">
                          Capacity: {(keg.capacityML / 1000).toFixed(1)}L
                        </p>
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Volume (L)"
                          value={kegVolumes[kegId] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            if (!isNaN(value)) {
                              setKegVolumes(prev => ({...prev, [kegId]: value}));
                            }
                          }}
                          className="text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning if exceeds capacity */}
              {exceedsCapacity && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-800">
                    Total volume ({totalVolumeTaken.toFixed(1)}L) exceeds vessel
                    capacity ({currentVolumeL.toFixed(1)}L)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Fill Details */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Fill Details</h3>

            {/* Fill Date/Time */}
            <div>
              <Label htmlFor="filledAt">
                Fill Date/Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="filledAt"
                type="datetime-local"
                {...register("filledAt")}
                className="mt-1"
              />
              {errors.filledAt && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.filledAt.message}
                </p>
              )}
            </div>

            {/* Production Notes */}
            <div>
              <Label htmlFor="productionNotes">Production Notes</Label>
              <Textarea
                id="productionNotes"
                {...register("productionNotes")}
                placeholder="Any notes about this fill..."
                className="mt-1 min-h-[80px]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                fillKegsMutation.isPending ||
                selectedKegIds.length === 0 ||
                exceedsCapacity
              }
            >
              {fillKegsMutation.isPending
                ? "Filling..."
                : `Fill ${selectedKegIds.length} Keg(s)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
