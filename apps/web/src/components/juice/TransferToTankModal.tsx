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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, AlertTriangle, Info, Plus, Droplets } from "lucide-react";
import { VolumeInput, VolumeUnit } from "@/components/ui/volume-input";

const transferSchema = z.object({
  vesselId: z.string().min(1, "Please select a vessel"),
  volumeToTransfer: z.number().positive("Volume must be positive"),
  volumeUnit: z.enum(["L", "gal"]),
  transferDate: z.date(),
  notes: z.string().optional(),
});

type TransferForm = z.infer<typeof transferSchema>;

interface TransferToTankModalProps {
  open: boolean;
  onClose: () => void;
  juicePurchaseItemId: string;
  juiceLabel: string;
  availableVolumeL: number;
  onSuccess: () => void;
}

export function TransferToTankModal({
  open,
  onClose,
  juicePurchaseItemId,
  juiceLabel,
  availableVolumeL,
  onSuccess,
}: TransferToTankModalProps) {
  const utils = trpc.useUtils();
  const [selectedVesselHasBatch, setSelectedVesselHasBatch] = useState(false);
  const [selectedVesselBatchName, setSelectedVesselBatchName] = useState<
    string | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      volumeUnit: "L",
      transferDate: new Date(),
    },
  });

  const vesselId = watch("vesselId");
  const volumeToTransfer = watch("volumeToTransfer");
  const volumeUnit = watch("volumeUnit");
  const transferDate = watch("transferDate");

  // Get vessels and liquid map
  const vesselsQuery = trpc.vessel.list.useQuery();
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();

  // Check if selected vessel has a batch
  useEffect(() => {
    if (vesselId && liquidMapQuery.data) {
      const vesselMap = liquidMapQuery.data.vessels.find(
        (v) => v.vesselId === vesselId
      );
      if (vesselMap?.batchId) {
        setSelectedVesselHasBatch(true);
        setSelectedVesselBatchName(
          vesselMap.batchCustomName || vesselMap.batchNumber || "Unnamed Batch"
        );
      } else {
        setSelectedVesselHasBatch(false);
        setSelectedVesselBatchName(null);
      }
    }
  }, [vesselId, liquidMapQuery.data]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        volumeUnit: "L",
        transferDate: new Date(),
      });
      setSelectedVesselHasBatch(false);
      setSelectedVesselBatchName(null);
    }
  }, [open, reset]);

  const transferMutation = trpc.batch.transferJuiceToTank.useMutation({
    onSuccess: (data) => {
      console.log("✅ Transfer successful:", data);
      toast({
        title: data.isNewBatch ? "New Batch Created" : "Juice Added to Batch",
        description: data.message,
      });
      // Invalidate all relevant queries to ensure UI updates
      utils.juicePurchases.listInventory.invalidate();
      utils.inventory.list.invalidate();
      utils.vessel.liquidMap.invalidate();
      utils.batch.list.invalidate();
      utils.batch.getComposition.invalidate();
      utils.batch.get.invalidate();
      onSuccess();
    },
    onError: (error) => {
      console.error("❌ Transfer failed:", error);
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransferForm) => {
    console.log("🚀 Form submitted with data:", {
      juicePurchaseItemId,
      vesselId: data.vesselId,
      volumeToTransfer: data.volumeToTransfer,
      volumeUnit: data.volumeUnit,
      transferDate: data.transferDate,
      notes: data.notes,
    });
    transferMutation.mutate({
      juicePurchaseItemId,
      vesselId: data.vesselId,
      volumeToTransfer: data.volumeToTransfer,
      volumeUnit: data.volumeUnit,
      transferDate: data.transferDate,
      notes: data.notes,
    });
  };

  // Calculate volume in liters for validation
  const volumeInL =
    volumeUnit === "gal" ? volumeToTransfer * 3.78541 : volumeToTransfer;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Transfer Juice to Tank
          </DialogTitle>
          <DialogDescription>
            Transfer {juiceLabel} to a fermentation vessel
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="transferDate">
              Transfer Date & Time <span className="text-red-500">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={transferDate ? new Date(transferDate.getTime() - transferDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => setValue("transferDate", new Date(e.target.value))}
              className="w-full mt-1"
            />
            {errors.transferDate && (
              <p className="text-sm text-red-600 mt-1">
                {errors.transferDate.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="vesselId">
              Destination Vessel <span className="text-red-500">*</span>
            </Label>
            <Select
              value={vesselId}
              onValueChange={(value) => setValue("vesselId", value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a vessel" />
              </SelectTrigger>
              <SelectContent>
                {vesselsQuery.isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading vessels...
                  </SelectItem>
                ) : vesselsQuery.data?.vessels?.length ? (
                  vesselsQuery.data.vessels.map((vessel) => {
                    const vesselMap = liquidMapQuery.data?.vessels.find(
                      (v) => v.vesselId === vessel.id
                    );
                    const hasBatch = !!vesselMap?.batchId;
                    const isAvailable = vessel.status === "available";

                    return (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        <div className="flex items-center gap-2">
                          <span>{vessel.name || "Unnamed Vessel"}</span>
                          {hasBatch && (
                            <Badge variant="secondary" className="text-xs">
                              In Use
                            </Badge>
                          )}
                          {isAvailable && (
                            <Badge variant="outline" className="text-xs">
                              Empty
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="none" disabled>
                    No vessels available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.vesselId && (
              <p className="text-sm text-red-600 mt-1">
                {errors.vesselId.message}
              </p>
            )}

            {/* Show batch info if vessel has batch */}
            {selectedVesselHasBatch && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">
                      This vessel contains an active batch
                    </p>
                    <p className="text-xs mt-1">
                      Juice will be merged with: <span className="font-semibold">{selectedVesselBatchName}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="volumeToTransfer">
              Volume to Transfer <span className="text-red-500">*</span>
            </Label>
            <VolumeInput
              id="volumeToTransfer"
              value={volumeToTransfer}
              unit={volumeUnit as VolumeUnit}
              onValueChange={(value) => setValue("volumeToTransfer", value || 0)}
              onUnitChange={(unit) => setValue("volumeUnit", unit as "L" | "gal")}
              placeholder="Enter volume"
              className="mt-1"
              max={availableVolumeL}
              required
            />
            {errors.volumeToTransfer && (
              <p className="text-sm text-red-600 mt-1">
                {errors.volumeToTransfer.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Available: {availableVolumeL.toFixed(1)}L
            </p>
          </div>

          {/* Volume validation warning */}
          {volumeToTransfer && volumeInL > availableVolumeL && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Insufficient volume</p>
                  <p className="text-xs mt-1">
                    Requested: {volumeInL.toFixed(1)}L, Available:{" "}
                    {availableVolumeL.toFixed(1)}L
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transfer preview */}
          {volumeToTransfer && volumeInL <= availableVolumeL && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Transfer Summary
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Transferring:</span>
                  <span className="font-medium">{volumeInL.toFixed(1)}L</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining after:</span>
                  <span className="font-medium">
                    {(availableVolumeL - volumeInL).toFixed(1)}L
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-300">
                  <span>Action:</span>
                  <span className="font-medium">
                    {selectedVesselHasBatch ? (
                      <Badge variant="secondary" className="text-xs">
                        Merge with batch
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Create new batch
                      </Badge>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              {...register("notes")}
              placeholder="Any notes about this transfer"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                transferMutation.isPending ||
                !volumeToTransfer ||
                volumeInL > availableVolumeL ||
                !vesselId
              }
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer Juice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
