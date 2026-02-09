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
import { Loader2, Wine, Info, Check } from "lucide-react";
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
  const [destinationVesselId, setDestinationVesselId] = useState("");
  const [brandyBatchName, setBrandyBatchName] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  // Fetch pending distillation records (status = 'sent')
  const { data: recordsData } = trpc.distillation.list.useQuery({
    status: "sent",
    limit: 100,
  });

  const pendingRecords = recordsData || [];

  // Fetch available vessels
  const { data: vesselsData } = trpc.vessel.list.useQuery();
  const availableVessels = vesselsData?.vessels?.filter((v: { status: string }) => v.status !== "inactive") || [];

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
    setDestinationVesselId("");
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

    receiveMultipleBrandy.mutate({
      distillationRecordIds: selectedRecordIds,
      receivedVolume: parseFloat(receivedVolume),
      receivedVolumeUnit,
      receivedAbv: parseFloat(receivedAbv),
      receivedAt: parseDateTimeFromInput(receivedAt),
      tibInboundNumber: tibInboundNumber.trim() || undefined,
      destinationVesselId: destinationVesselId && destinationVesselId !== "__none__" ? destinationVesselId : undefined,
      notes: notes.trim() || undefined,
      brandyBatchName: brandyBatchName.trim() || undefined,
    });
  };

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

          {/* Destination Vessel */}
          <div className="space-y-2">
            <Label htmlFor="destinationVessel">Destination Vessel (Optional)</Label>
            <Select value={destinationVesselId} onValueChange={setDestinationVesselId}>
              <SelectTrigger id="destinationVessel">
                <SelectValue placeholder="Select a vessel for aging" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No vessel (unassigned)</SelectItem>
                {availableVessels.map((vessel: { id: string; name: string | null; material: string | null; capacity: string }) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name} ({vessel.material || "unknown"}, {vessel.capacity}L)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={receiveMultipleBrandy.isPending}>
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
