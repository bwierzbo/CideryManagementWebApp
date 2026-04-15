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
import { Loader2, Wine, Info, Check, Plus, X } from "lucide-react";
import { useDateFormat } from "@/hooks/useDateFormat";
import { formatDate } from "@/utils/date-format";

interface ReceiveBrandyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRecordId?: string;
}

export function ReceiveBrandyDialog({
  open,
  onOpenChange,
  preselectedRecordId,
}: ReceiveBrandyDialogProps) {
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();

  const localISOTime = formatDateTimeForInput(new Date());

  // Multi-select for distillation records
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>(
    preselectedRecordId ? [preselectedRecordId] : []
  );
  const [receivedVolume, setReceivedVolume] = useState("");
  const [receivedVolumeUnit, setReceivedVolumeUnit] = useState<"L" | "gal">("L");
  const [receivedAbv, setReceivedAbv] = useState("");
  const [receivedAt, setReceivedAt] = useState(localISOTime);
  const [tibInboundNumber, setTibInboundNumber] = useState("");
  const [destinationVessels, setDestinationVessels] = useState<
    { vesselId: string; volume: string }[]
  >([]);
  const [brandyBatchName, setBrandyBatchName] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  // Fetch pending distillation records (status = 'sent')
  const { data: recordsData } = trpc.distillation.list.useQuery({
    status: "sent",
    limit: 100,
  });

  const pendingRecords = recordsData || [];

  // Fetch available vessels with current volume info
  const { data: vesselsData } = trpc.vessel.list.useQuery();
  const { data: liquidMapData } = trpc.vessel.liquidMap.useQuery();
  const availableVessels = useMemo(() => {
    const vesselList = vesselsData?.vessels?.filter((v: { status: string }) => v.status !== "inactive") || [];
    const liquidMap = liquidMapData?.vessels || [];
    // Enrich vessel data with current volume from liquid map
    return vesselList.map((v: any) => {
      const lm = liquidMap.find((l: any) => l.vesselId === v.id);
      const currentVolume = lm?.currentVolume ? parseFloat(lm.currentVolume) : 0;
      const currentVolumeUnit = lm?.currentVolumeUnit || v.capacityUnit || "L";
      return { ...v, currentVolume, currentVolumeUnit, batchName: lm?.batchCustomName || lm?.batchNumber || null };
    });
  }, [vesselsData, liquidMapData]);

  // Get selected records details
  const selectedRecords = useMemo(() => {
    return pendingRecords.filter((r) => selectedRecordIds.includes(r.id));
  }, [pendingRecords, selectedRecordIds]);

  // Calculate totals from selected records
  const totals = useMemo(() => {
    const LITERS_PER_GALLON = 3.785411784;
    let totalVolumeLiters = 0;
    let totalVolume = 0;

    for (const r of selectedRecords) {
      const vol = parseFloat(r.sourceVolume || "0");
      totalVolume += vol;
      // Convert to liters if in gallons
      if (r.sourceVolumeUnit === "gal") {
        totalVolumeLiters += vol * LITERS_PER_GALLON;
      } else {
        totalVolumeLiters += vol;
      }
    }
    return { totalVolumeLiters, totalVolume };
  }, [selectedRecords]);

  const receiveMultipleBrandy = trpc.distillation.receiveMultipleBrandy.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Brandy received from ${data.recordsUpdated} shipment${data.recordsUpdated > 1 ? "s" : ""} - batch "${data.brandyBatch.name}" created`,
      });
      utils.batch.list.invalidate();
      utils.distillation.list.invalidate();
      utils.vessel.list.invalidate();
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
    setSelectedRecordIds(preselectedRecordId ? [preselectedRecordId] : []);
    setReceivedVolume("");
    setReceivedVolumeUnit("L");
    setReceivedAbv("");
    setReceivedAt(localISOTime);
    setTibInboundNumber("");
    setDestinationVessels([]);
    setBrandyBatchName("");
    setNotes("");
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  };

  const selectAllRecords = () => {
    setSelectedRecordIds(pendingRecords.map((r) => r.id));
  };

  const clearSelection = () => {
    setSelectedRecordIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRecordIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one distillation shipment",
        variant: "destructive",
      });
      return;
    }

    if (!receivedVolume || parseFloat(receivedVolume) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid received volume",
        variant: "destructive",
      });
      return;
    }

    if (!receivedAbv || parseFloat(receivedAbv) <= 0) {
      toast({
        title: "Error",
        description: "Please enter the brandy ABV",
        variant: "destructive",
      });
      return;
    }

    // Use first vessel as primary destination, pass all vessels for splitting
    const validVessels = destinationVessels.filter(
      (v) => v.vesselId && parseFloat(v.volume || "0") > 0
    );

    receiveMultipleBrandy.mutate({
      distillationRecordIds: selectedRecordIds,
      receivedVolume: parseFloat(receivedVolume),
      receivedVolumeUnit,
      receivedAbv: parseFloat(receivedAbv),
      receivedAt: parseDateTimeFromInput(receivedAt),
      tibInboundNumber: tibInboundNumber.trim() || undefined,
      destinationVesselId: validVessels.length > 0 ? validVessels[0].vesselId : undefined,
      destinationVessels: validVessels.length > 0
        ? validVessels.map((v) => ({
            vesselId: v.vesselId,
            volume: parseFloat(v.volume),
          }))
        : undefined,
      notes: notes.trim() || undefined,
      brandyBatchName: brandyBatchName.trim() || undefined,
    });
  };

  // Check if any vessel allocation would overflow
  const hasOverflow = useMemo(() => {
    const LITERS_PER_GAL = 3.785411784;
    return destinationVessels.some((dv) => {
      if (!dv.vesselId || !dv.volume) return false;
      const vessel = availableVessels.find((v: any) => v.id === dv.vesselId);
      if (!vessel) return false;
      const capRaw = parseFloat(vessel.capacity || "0");
      const capUnit = vessel.capacityUnit || "L";
      const capacityL = capUnit === "gal" ? capRaw * LITERS_PER_GAL : capRaw;
      const fillRaw = vessel.currentVolume || 0;
      const fillUnit = vessel.currentVolumeUnit || "L";
      const currentFillL = fillUnit === "gal" ? fillRaw * LITERS_PER_GAL : fillRaw;
      const availableL = capacityL - currentFillL;
      const enteredL = receivedVolumeUnit === "gal"
        ? parseFloat(dv.volume) * LITERS_PER_GAL
        : parseFloat(dv.volume);
      return enteredL > availableL + 0.1;
    });
  }, [destinationVessels, availableVessels, receivedVolumeUnit]);

  // Update preselectedRecordId when prop changes
  React.useEffect(() => {
    if (preselectedRecordId) {
      setSelectedRecordIds([preselectedRecordId]);
    }
  }, [preselectedRecordId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Receive Brandy
          </DialogTitle>
          <DialogDescription>
            Record brandy received back from the distillery. Select one or more
            cider shipments that were combined into a single brandy batch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Distillation Records Selection (Multi-select) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Cider Shipments *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllRecords}
                  disabled={pendingRecords.length === 0}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedRecordIds.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>

            {pendingRecords.length === 0 ? (
              <div className="py-4 px-3 text-sm text-muted-foreground border rounded-lg bg-muted/30">
                No pending shipments found
              </div>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {pendingRecords.map((record) => {
                  const isSelected = selectedRecordIds.includes(record.id);
                  return (
                    <div
                      key={record.id}
                      className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                        isSelected ? "bg-primary/10" : ""
                      }`}
                      onClick={() => toggleRecordSelection(record.id)}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/50"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {record.sourceBatchName || record.sourceBatchNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.distilleryName} • {parseFloat(record.sourceVolume || "0").toFixed(1)}
                          {record.sourceVolumeUnit} • Sent{" "}
                          {record.sentAt ? formatDate(new Date(record.sentAt)) : "Unknown"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Summary */}
          {selectedRecords.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4" />
                {selectedRecords.length === 1 ? "Selected Shipment" : `${selectedRecords.length} Shipments Selected`}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Cider Sent:</span>{" "}
                  {totals.totalVolumeLiters.toFixed(1)}L ({(totals.totalVolumeLiters / 3.785411784).toFixed(1)} gal)
                </div>
                <div>
                  <span className="text-muted-foreground">Distiller{selectedRecords.length > 1 ? "ies" : "y"}:</span>{" "}
                  {[...new Set(selectedRecords.map((r) => r.distilleryName))].join(", ")}
                </div>
                {selectedRecords.length === 1 && selectedRecords[0].sourceAbv && (
                  <div>
                    <span className="text-muted-foreground">Source ABV:</span>{" "}
                    {selectedRecords[0].sourceAbv}%
                  </div>
                )}
                {selectedRecords.length === 1 && selectedRecords[0].tibOutboundNumber && (
                  <div>
                    <span className="text-muted-foreground">TIB Outbound:</span>{" "}
                    {selectedRecords[0].tibOutboundNumber}
                  </div>
                )}
              </div>
              {selectedRecords.length > 1 && (
                <div className="text-xs text-muted-foreground mt-2">
                  Source batches: {selectedRecords.map((r) => r.sourceBatchName || r.sourceBatchNumber).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Received Volume and ABV */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receivedVolume">Received Volume *</Label>
              <Input
                id="receivedVolume"
                type="number"
                step="0.1"
                placeholder="25"
                value={receivedVolume}
                onChange={(e) => setReceivedVolume(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivedVolumeUnit">Unit</Label>
              <Select
                value={receivedVolumeUnit}
                onValueChange={(v) => setReceivedVolumeUnit(v as "L" | "gal")}
              >
                <SelectTrigger id="receivedVolumeUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Liters</SelectItem>
                  <SelectItem value="gal">Gallons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivedAbv">Brandy ABV (%) *</Label>
              <Input
                id="receivedAbv"
                type="number"
                step="0.1"
                placeholder="60"
                value={receivedAbv}
                onChange={(e) => setReceivedAbv(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Typically 40-70%</p>
            </div>
          </div>

          {/* Date and TIB */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receivedAt">Date Received *</Label>
              <Input
                id="receivedAt"
                type="datetime-local"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tibInboundNumber">TIB Inbound Number</Label>
              <Input
                id="tibInboundNumber"
                placeholder="TIB-2024-002"
                value={tibInboundNumber}
                onChange={(e) => setTibInboundNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">TTB Transfer in Bond number</p>
            </div>
          </div>

          {/* Destination Vessels */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Destination Vessels (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDestinationVessels([...destinationVessels, { vesselId: "", volume: "" }])}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Vessel
              </Button>
            </div>

            {destinationVessels.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No vessels selected — brandy batch will be created unassigned. Click "Add Vessel" to assign to barrels.
              </p>
            )}

            {destinationVessels.map((dv, index) => {
              const LITERS_PER_GAL = 3.785411784;
              const selectedIds = destinationVessels.map((v) => v.vesselId).filter(Boolean);
              const filteredVessels = availableVessels.filter(
                (v: any) => !selectedIds.includes(v.id) || v.id === dv.vesselId
              );

              // Get selected vessel info for capacity/fill display
              const selectedVessel = dv.vesselId ? availableVessels.find((v: any) => v.id === dv.vesselId) : null;
              const vesselCapacityRaw = selectedVessel ? parseFloat(selectedVessel.capacity || "0") : 0;
              const vesselCapacityUnit = selectedVessel?.capacityUnit || "L";
              // Convert capacity to liters
              const vesselCapacityL = vesselCapacityUnit === "gal"
                ? vesselCapacityRaw * LITERS_PER_GAL
                : vesselCapacityUnit === "mL" || vesselCapacityUnit === "ml"
                  ? vesselCapacityRaw / 1000
                  : vesselCapacityRaw;
              // currentVolume from liquidMap — check its unit too
              const currentFillRaw = selectedVessel?.currentVolume || 0;
              const currentFillUnit = selectedVessel?.currentVolumeUnit || "L";
              const currentFillL = currentFillUnit === "gal"
                ? currentFillRaw * LITERS_PER_GAL
                : currentFillRaw;
              const availableSpaceL = vesselCapacityL - currentFillL;
              // Convert available space to the user's unit for display
              const availableSpaceDisplay = receivedVolumeUnit === "gal"
                ? (availableSpaceL / LITERS_PER_GAL)
                : availableSpaceL;
              const enteredVolume = parseFloat(dv.volume || "0");
              const enteredVolumeL = receivedVolumeUnit === "gal" ? enteredVolume * LITERS_PER_GAL : enteredVolume;
              const wouldOverflow = selectedVessel && enteredVolumeL > availableSpaceL + 0.1;

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">Vessel</Label>
                      )}
                      <Select
                        value={dv.vesselId}
                        onValueChange={(value) => {
                          const updated = [...destinationVessels];
                          updated[index].vesselId = value;
                          setDestinationVessels(updated);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select vessel" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredVessels.map((vessel: any) => {
                            const capRaw = parseFloat(vessel.capacity || "0");
                            const capUnit = vessel.capacityUnit || "L";
                            const capL = capUnit === "gal" ? capRaw * LITERS_PER_GAL : capRaw;
                            const fillRaw = vessel.currentVolume || 0;
                            const fillUnit = vessel.currentVolumeUnit || "L";
                            const fillL = fillUnit === "gal" ? fillRaw * LITERS_PER_GAL : fillRaw;
                            const fillPct = capL > 0 ? Math.round((fillL / capL) * 100) : 0;
                            return (
                              <SelectItem key={vessel.id} value={vessel.id}>
                                {vessel.name} — {fillPct > 0 ? `${fillPct}% full` : "empty"} ({capRaw} {capUnit} cap)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">Volume ({receivedVolumeUnit})</Label>
                      )}
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={dv.volume}
                        onChange={(e) => {
                          const updated = [...destinationVessels];
                          updated[index].volume = e.target.value;
                          setDestinationVessels(updated);
                        }}
                        placeholder="0.0"
                        className={`h-9 ${wouldOverflow ? "border-red-400 bg-red-50" : ""}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() => {
                        setDestinationVessels(destinationVessels.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {selectedVessel && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pl-1">
                      <span>
                        Current: {currentFillRaw > 0
                          ? `${currentFillRaw.toFixed(1)} ${currentFillUnit}${selectedVessel.batchName ? ` (${selectedVessel.batchName})` : ""}`
                          : "Empty"}
                      </span>
                      <span>Available: {availableSpaceDisplay.toFixed(1)} {receivedVolumeUnit}</span>
                    </div>
                  )}
                  {wouldOverflow && (
                    <p className="text-xs text-red-600 pl-1">
                      Exceeds available space by {(enteredVolumeL - availableSpaceL).toFixed(1)}L — reduce volume or choose a larger vessel
                    </p>
                  )}
                </div>
              );
            })}

            {destinationVessels.length > 0 && receivedVolume && (() => {
              const totalAllocated = destinationVessels.reduce(
                (sum, v) => sum + (parseFloat(v.volume || "0")), 0
              );
              const totalReceived = parseFloat(receivedVolume || "0");
              const remaining = totalReceived - totalAllocated;
              return (
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Allocated: {totalAllocated.toFixed(1)} {receivedVolumeUnit}</span>
                    <span>
                      {Math.abs(remaining) < 0.01
                        ? <span className="text-green-600">Fully allocated</span>
                        : remaining > 0
                          ? <span className="text-amber-600">{remaining.toFixed(1)} {receivedVolumeUnit} unallocated</span>
                          : <span className="text-red-600">{Math.abs(remaining).toFixed(1)} {receivedVolumeUnit} over-allocated</span>
                      }
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Brandy Batch Name */}
          <div className="space-y-2">
            <Label htmlFor="brandyBatchName">Brandy Batch Name (Optional)</Label>
            <Input
              id="brandyBatchName"
              placeholder="Auto-generated if left blank"
              value={brandyBatchName}
              onChange={(e) => setBrandyBatchName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {selectedRecords.length > 1
                ? "Leave blank to auto-generate: Brandy-Combined-[sources]-YYYY"
                : `Leave blank to auto-generate: Brandy-${selectedRecords[0]?.sourceBatchNumber || "[batch]"}-${new Date().getFullYear()}`}
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this receipt..."
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
            <Button type="submit" disabled={receiveMultipleBrandy.isPending || hasOverflow}>
              {receiveMultipleBrandy.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Receive Brandy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
