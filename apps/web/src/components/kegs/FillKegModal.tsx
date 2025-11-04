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
import { Checkbox } from "@/components/ui/checkbox";
import { Wine, AlertTriangle, Loader2, Package } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const fillKegsSchema = z.object({
  kegIds: z.array(z.string().uuid()).min(1, "Select at least one keg"),
  filledAt: z.string().min(1, "Date/time is required"),
  volumeTakenPerKeg: z.number().positive("Volume must be positive"),
  volumeTakenUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  loss: z.number().min(0).optional(),
  lossUnit: z.enum(["kg", "lb", "L", "gal", "bushel"]),
  abvAtPackaging: z.number().min(0).max(20).optional(),
  carbonationLevel: z.enum(["still", "petillant", "sparkling"]).optional(),
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

export function FillKegModal({
  open,
  onClose,
  vesselId,
  vesselName,
  batchId,
  currentVolumeL,
}: FillKegModalProps) {
  const [selectedKegIds, setSelectedKegIds] = useState<string[]>([]);

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

  const volumeTakenPerKeg = watch("volumeTakenPerKeg");
  const utils = trpc.useUtils();

  // Get available kegs
  const { data: availableKegs, isLoading: kegsLoading } =
    trpc.kegs.getAvailableKegs.useQuery(undefined, { enabled: open });

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

  // Update form when kegs selected
  useEffect(() => {
    setValue("kegIds", selectedKegIds);
  }, [selectedKegIds, setValue]);

  const handleKegToggle = (kegId: string) => {
    setSelectedKegIds((prev) =>
      prev.includes(kegId)
        ? prev.filter((id) => id !== kegId)
        : [...prev, kegId],
    );
  };

  const onSubmit = (data: FillKegsForm) => {
    fillKegsMutation.mutate({
      kegIds: data.kegIds,
      batchId,
      vesselId,
      filledAt: new Date(data.filledAt),
      volumeTakenPerKeg: data.volumeTakenPerKeg,
      volumeTakenUnit: data.volumeTakenUnit,
      loss: data.loss,
      lossUnit: data.lossUnit,
      abvAtPackaging: data.abvAtPackaging,
      carbonationLevel: data.carbonationLevel,
      carbonationMethod: data.carbonationMethod,
      productionNotes: data.productionNotes,
    });
  };

  // Calculate total volume to be taken
  const totalVolumeTaken =
    volumeTakenPerKeg && selectedKegIds.length
      ? volumeTakenPerKeg * selectedKegIds.length
      : 0;
  const exceedsCapacity = totalVolumeTaken > currentVolumeL;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
                  <div
                    key={keg.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedKegIds.includes(keg.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => handleKegToggle(keg.id)}
                  >
                    <Checkbox
                      checked={selectedKegIds.includes(keg.id)}
                    />
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
                ))}
              </div>
            )}

            {errors.kegIds && (
              <p className="text-sm text-red-600 mt-2">
                {errors.kegIds.message}
              </p>
            )}

            {selectedKegIds.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {selectedKegIds.length} keg(s)
              </p>
            )}
          </div>

          {/* Fill Details */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Fill Details</h3>

            <div className="grid grid-cols-2 gap-4">
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

              {/* Volume Per Keg */}
              <div>
                <Label htmlFor="volumeTakenPerKeg">
                  Volume Per Keg (L) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="volumeTakenPerKeg"
                  type="number"
                  step="0.1"
                  {...register("volumeTakenPerKeg", { valueAsNumber: true })}
                  className="mt-1"
                />
                {totalVolumeTaken > 0 && (
                  <p
                    className={`text-xs mt-1 ${exceedsCapacity ? "text-red-600" : "text-gray-500"}`}
                  >
                    Total: {totalVolumeTaken.toFixed(1)}L
                    {exceedsCapacity && " - Exceeds vessel capacity!"}
                  </p>
                )}
                {errors.volumeTakenPerKeg && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.volumeTakenPerKeg.message}
                  </p>
                )}
              </div>
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

            <div className="grid grid-cols-2 gap-4">
              {/* ABV */}
              <div>
                <Label htmlFor="abvAtPackaging">ABV (%)</Label>
                <Input
                  id="abvAtPackaging"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  {...register("abvAtPackaging", { valueAsNumber: true })}
                  className="mt-1"
                />
              </div>

              {/* Carbonation Level */}
              <div>
                <Label htmlFor="carbonationLevel">Carbonation Level</Label>
                <Select
                  onValueChange={(value) =>
                    setValue("carbonationLevel", value as any)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="still">Still</SelectItem>
                    <SelectItem value="petillant">Petillant</SelectItem>
                    <SelectItem value="sparkling">Sparkling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
