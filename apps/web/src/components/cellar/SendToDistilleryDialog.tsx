"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Truck, Plus, Trash2 } from "lucide-react";

interface BatchSelection {
  sourceBatchId: string;
  sourceVolume: string;
  sourceVolumeUnit: "L" | "gal";
  sourceAbv: string;
}

interface SendToDistilleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBatchId?: string;
}

export function SendToDistilleryDialog({
  open,
  onOpenChange,
  preselectedBatchId,
}: SendToDistilleryDialogProps) {
  // Initialize with current date and time in local timezone
  const now = new Date();
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Batch selections - array of batches to send
  const [batchSelections, setBatchSelections] = useState<BatchSelection[]>([
    { sourceBatchId: preselectedBatchId || "", sourceVolume: "", sourceVolumeUnit: "L", sourceAbv: "" },
  ]);

  // Distillery info (shared across all batches)
  const [distilleryName, setDistilleryName] = useState("");
  const [distilleryAddress, setDistilleryAddress] = useState("");
  const [distilleryPermitNumber, setDistilleryPermitNumber] = useState("");
  const [sentAt, setSentAt] = useState(localISOTime);
  const [tibOutboundNumber, setTibOutboundNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [deductFromBatch, setDeductFromBatch] = useState(true);

  const utils = trpc.useUtils();

  // Fetch available batches (cider/perry only, in fermentation or aging)
  // Use high limit to ensure we get all batches (default is 50)
  const { data: batchesData } = trpc.batch.list.useQuery({
    sortBy: "startDate",
    sortOrder: "desc",
    limit: 200,
  });

  // Fetch previously used distilleries for auto-complete
  const { data: savedDistilleries } = trpc.distillation.getDistilleries.useQuery();

  // Filter to show only cider/perry batches with volume (exclude brandy/pommeau)
  const availableBatches = batchesData?.batches?.filter(
    (batch) =>
      (batch.status === "fermentation" || batch.status === "aging") &&
      parseFloat(batch.currentVolume || "0") > 0
  ) || [];

  // Get selected batch IDs to filter them out of available options
  const selectedBatchIds = new Set(batchSelections.map(s => s.sourceBatchId).filter(Boolean));

  // Calculate total volume being sent
  const totalVolumeSummary = useMemo(() => {
    let totalLiters = 0;
    for (const selection of batchSelections) {
      const vol = parseFloat(selection.sourceVolume) || 0;
      if (selection.sourceVolumeUnit === "gal") {
        totalLiters += vol * 3.785411784;
      } else {
        totalLiters += vol;
      }
    }
    return totalLiters;
  }, [batchSelections]);

  const sendMultiple = trpc.distillation.sendMultipleToDistillery.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `${data.count} batch${data.count > 1 ? "es" : ""} sent to distillery successfully`,
      });
      utils.batch.list.invalidate();
      utils.distillation.list.invalidate();
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setBatchSelections([
      { sourceBatchId: preselectedBatchId || "", sourceVolume: "", sourceVolumeUnit: "L", sourceAbv: "" },
    ]);
    setDistilleryName("");
    setDistilleryAddress("");
    setDistilleryPermitNumber("");
    setSentAt(localISOTime);
    setTibOutboundNumber("");
    setNotes("");
    setDeductFromBatch(true);
  };

  const addBatchSelection = () => {
    setBatchSelections(prev => [
      ...prev,
      { sourceBatchId: "", sourceVolume: "", sourceVolumeUnit: "L", sourceAbv: "" },
    ]);
  };

  const removeBatchSelection = (index: number) => {
    setBatchSelections(prev => prev.filter((_, i) => i !== index));
  };

  const updateBatchSelection = (index: number, field: keyof BatchSelection, value: string) => {
    setBatchSelections(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Auto-fill volume and ABV when batch is selected
  const handleBatchChange = (index: number, batchId: string) => {
    const batch = availableBatches.find(b => b.id === batchId);
    // Get ABV from actualAbv, estimatedAbv, or fall back to latest measurement ABV
    let batchAbv = "";
    if (batch?.actualAbv && batch.actualAbv !== "0") {
      batchAbv = String(batch.actualAbv);
    } else if (batch?.estimatedAbv && batch.estimatedAbv !== "0") {
      batchAbv = String(batch.estimatedAbv);
    } else if (batch?.latestMeasurement?.abv) {
      batchAbv = String(batch.latestMeasurement.abv);
    }
    setBatchSelections(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        sourceBatchId: batchId,
        // Auto-fill volume from batch's current volume
        sourceVolume: batch?.currentVolume ? String(parseFloat(String(batch.currentVolume)).toFixed(1)) : "",
        // Auto-fill ABV from batch if available
        sourceAbv: batchAbv,
      };
      return next;
    });
  };

  // Get batch display name - prefer customName, fall back to name
  const getBatchDisplayName = (batchId: string) => {
    const batch = availableBatches.find(b => b.id === batchId);
    if (!batch) return "Loading...";
    // Prefer customName if it exists, otherwise use name
    return batch.customName || batch.name;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one batch is selected
    const validSelections = batchSelections.filter(s => s.sourceBatchId && parseFloat(s.sourceVolume) > 0);
    if (validSelections.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one batch with volume",
        variant: "destructive",
      });
      return;
    }

    if (!distilleryName.trim()) {
      toast({
        title: "Error",
        description: "Please enter the distillery name",
        variant: "destructive",
      });
      return;
    }

    sendMultiple.mutate({
      batches: validSelections.map(s => ({
        sourceBatchId: s.sourceBatchId,
        sourceVolume: parseFloat(s.sourceVolume),
        sourceVolumeUnit: s.sourceVolumeUnit,
        sourceAbv: s.sourceAbv ? parseFloat(s.sourceAbv) : undefined,
      })),
      distilleryName: distilleryName.trim(),
      distilleryAddress: distilleryAddress.trim() || undefined,
      distilleryPermitNumber: distilleryPermitNumber.trim() || undefined,
      sentAt: new Date(sentAt),
      tibOutboundNumber: tibOutboundNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      deductFromBatch,
    });
  };

  // Update preselectedBatchId when prop changes
  React.useEffect(() => {
    if (preselectedBatchId) {
      setBatchSelections([
        { sourceBatchId: preselectedBatchId, sourceVolume: "", sourceVolumeUnit: "L", sourceAbv: "" },
      ]);
    }
  }, [preselectedBatchId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Send to Distillery
          </DialogTitle>
          <DialogDescription>
            Record cider being sent to an external distillery for brandy production.
            You can send multiple batches in a single shipment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Batch Selections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Batches to Send *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBatchSelection}>
                <Plus className="w-4 h-4 mr-1" />
                Add Batch
              </Button>
            </div>

            <div className="space-y-3">
              {batchSelections.map((selection, index) => {
                const selectedBatch = availableBatches.find(b => b.id === selection.sourceBatchId);
                // Filter out already-selected batches from options (except current selection)
                const availableOptions = availableBatches.filter(
                  b => b.id === selection.sourceBatchId || !selectedBatchIds.has(b.id)
                );

                return (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-muted/30"
                  >
                    {/* Batch Select */}
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs text-muted-foreground">Batch</Label>
                      <Select
                        value={selection.sourceBatchId}
                        onValueChange={(v) => handleBatchChange(index, v)}
                      >
                        <SelectTrigger className="h-9">
                          {selection.sourceBatchId ? (
                            <span className="truncate">{getBatchDisplayName(selection.sourceBatchId)}</span>
                          ) : (
                            <span className="text-muted-foreground">Select batch</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {availableOptions.length === 0 ? (
                            <div className="py-2 px-2 text-sm text-muted-foreground">
                              No batches available
                            </div>
                          ) : (
                            availableOptions.map((batch) => (
                              <SelectItem key={batch.id} value={batch.id}>
                                {batch.customName || batch.name} ({parseFloat(batch.currentVolume || "0").toFixed(1)}L)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Volume */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Volume</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="--"
                        className="h-9"
                        value={selection.sourceVolume}
                        onChange={(e) => updateBatchSelection(index, "sourceVolume", e.target.value)}
                      />
                    </div>

                    {/* Unit */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Select
                        value={selection.sourceVolumeUnit}
                        onValueChange={(v) => updateBatchSelection(index, "sourceVolumeUnit", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Liters</SelectItem>
                          <SelectItem value="gal">Gallons</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* ABV */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">ABV %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="--"
                        className="h-9"
                        value={selection.sourceAbv}
                        onChange={(e) => updateBatchSelection(index, "sourceAbv", e.target.value)}
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-2 flex justify-end">
                      {batchSelections.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-destructive hover:text-destructive"
                          onClick={() => removeBatchSelection(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary */}
            {batchSelections.some(s => parseFloat(s.sourceVolume) > 0) && (
              <div className="text-sm text-muted-foreground">
                Total: {totalVolumeSummary.toFixed(1)}L ({(totalVolumeSummary / 3.785411784).toFixed(1)} gal)
              </div>
            )}
          </div>

          {/* Deduct from batch checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="deductFromBatch"
              checked={deductFromBatch}
              onChange={(e) => setDeductFromBatch(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="deductFromBatch" className="font-normal">
              Deduct volume from source batches
            </Label>
          </div>

          {/* Distillery Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Distillery Information</h4>
            {/* Saved Distilleries Dropdown */}
            {savedDistilleries && savedDistilleries.length > 0 && (
              <div className="space-y-2">
                <Label>Select from Previous Distilleries</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const distillery = savedDistilleries.find(d => d.name === value);
                    if (distillery) {
                      setDistilleryName(distillery.name);
                      setDistilleryAddress(distillery.address || "");
                      setDistilleryPermitNumber(distillery.permitNumber || "");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved distillery or enter new..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedDistilleries.map((distillery, idx) => (
                      <SelectItem key={idx} value={distillery.name}>
                        {distillery.name}
                        {distillery.permitNumber && (
                          <span className="text-muted-foreground ml-2">({distillery.permitNumber})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distilleryName">Distillery Name *</Label>
                <Input
                  id="distilleryName"
                  placeholder="ABC Distillery"
                  value={distilleryName}
                  onChange={(e) => setDistilleryName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distilleryPermitNumber">DSP/Permit Number</Label>
                <Input
                  id="distilleryPermitNumber"
                  placeholder="DSP-XX-12345"
                  value={distilleryPermitNumber}
                  onChange={(e) => setDistilleryPermitNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="distilleryAddress">Distillery Address</Label>
              <Input
                id="distilleryAddress"
                placeholder="123 Main St, City, State"
                value={distilleryAddress}
                onChange={(e) => setDistilleryAddress(e.target.value)}
              />
            </div>
          </div>

          {/* TIB and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sentAt">Date Sent *</Label>
              <Input
                id="sentAt"
                type="datetime-local"
                value={sentAt}
                onChange={(e) => setSentAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tibOutboundNumber">TIB Outbound Number</Label>
              <Input
                id="tibOutboundNumber"
                placeholder="TIB-2024-001"
                value={tibOutboundNumber}
                onChange={(e) => setTibOutboundNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">TTB Transfer in Bond number</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this shipment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendMultiple.isPending}>
              {sendMultiple.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send to Distillery
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
