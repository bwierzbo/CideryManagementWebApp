"use client";

import React, { useState } from "react";
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
import { Loader2, Wine, Info } from "lucide-react";
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
  // Initialize with current date and time in local timezone
  const now = new Date();
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [distillationRecordId, setDistillationRecordId] = useState(preselectedRecordId || "");
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

  // Get selected record details
  const selectedRecord = pendingRecords.find((r) => r.id === distillationRecordId);

  const receiveBrandy = trpc.distillation.receiveBrandy.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Brandy received and batch "${data.brandyBatch.name}" created`,
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
    setDistillationRecordId(preselectedRecordId || "");
    setReceivedVolume("");
    setReceivedVolumeUnit("L");
    setReceivedAbv("");
    setReceivedAt(localISOTime);
    setTibInboundNumber("");
    setDestinationVesselId("");
    setBrandyBatchName("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!distillationRecordId) {
      toast({
        title: "Error",
        description: "Please select a distillation record",
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

    receiveBrandy.mutate({
      distillationRecordId,
      receivedVolume: parseFloat(receivedVolume),
      receivedVolumeUnit,
      receivedAbv: parseFloat(receivedAbv),
      receivedAt: new Date(receivedAt),
      tibInboundNumber: tibInboundNumber.trim() || undefined,
      destinationVesselId: destinationVesselId && destinationVesselId !== "__none__" ? destinationVesselId : undefined,
      notes: notes.trim() || undefined,
      brandyBatchName: brandyBatchName.trim() || undefined,
    });
  };

  // Update preselectedRecordId when prop changes
  React.useEffect(() => {
    if (preselectedRecordId) {
      setDistillationRecordId(preselectedRecordId);
    }
  }, [preselectedRecordId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Receive Brandy
          </DialogTitle>
          <DialogDescription>
            Record brandy received back from the distillery. This will complete
            the distillation record and create a new brandy batch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Distillation Record Selection */}
          <div className="space-y-2">
            <Label htmlFor="distillationRecord">Distillation Record *</Label>
            <Select value={distillationRecordId} onValueChange={setDistillationRecordId}>
              <SelectTrigger id="distillationRecord">
                <SelectValue placeholder="Select a pending shipment" />
              </SelectTrigger>
              <SelectContent>
                {pendingRecords.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-muted-foreground">
                    No pending shipments
                  </div>
                ) : (
                  pendingRecords.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.sourceBatchName || record.sourceBatchNumber} →{" "}
                      {record.distilleryName} ({parseFloat(record.sourceVolume || "0").toFixed(1)}
                      {record.sourceVolumeUnit})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Record Details */}
          {selectedRecord && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4" />
                Shipment Details
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Source Batch:</span>{" "}
                  {selectedRecord.sourceBatchName || selectedRecord.sourceBatchNumber}
                </div>
                <div>
                  <span className="text-muted-foreground">Distillery:</span>{" "}
                  {selectedRecord.distilleryName}
                </div>
                <div>
                  <span className="text-muted-foreground">Volume Sent:</span>{" "}
                  {parseFloat(selectedRecord.sourceVolume || "0").toFixed(1)}{" "}
                  {selectedRecord.sourceVolumeUnit}
                </div>
                <div>
                  <span className="text-muted-foreground">Sent Date:</span>{" "}
                  {selectedRecord.sentAt
                    ? formatDate(new Date(selectedRecord.sentAt))
                    : "Unknown"}
                </div>
                {selectedRecord.sourceAbv && (
                  <div>
                    <span className="text-muted-foreground">Source ABV:</span>{" "}
                    {selectedRecord.sourceAbv}%
                  </div>
                )}
                {selectedRecord.tibOutboundNumber && (
                  <div>
                    <span className="text-muted-foreground">TIB Outbound:</span>{" "}
                    {selectedRecord.tibOutboundNumber}
                  </div>
                )}
              </div>
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
              Leave blank to auto-generate: Brandy-{selectedRecord?.sourceBatchNumber || "[batch]"}-
              {new Date().getFullYear()}
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
            <Button type="submit" disabled={receiveBrandy.isPending}>
              {receiveBrandy.isPending && (
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
