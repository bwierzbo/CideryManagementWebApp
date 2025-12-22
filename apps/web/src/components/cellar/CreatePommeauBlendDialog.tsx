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
import { Loader2, Beaker, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreatePommeauBlendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LITERS_PER_GALLON = 3.785411784;

// Client-side ABV blend calculation (mirrors lib function)
function calculateBlendAbv(
  components: Array<{ volumeLiters: number; abv: number }>
): number {
  if (components.length === 0 || components.every((c) => c.volumeLiters === 0)) {
    return 0;
  }

  const totalVolume = components.reduce((sum, c) => sum + c.volumeLiters, 0);
  if (totalVolume <= 0) return 0;

  const totalAlcohol = components.reduce(
    (sum, c) => sum + c.volumeLiters * c.abv,
    0
  );

  return Math.round((totalAlcohol / totalVolume) * 100) / 100;
}

export function CreatePommeauBlendDialog({
  open,
  onOpenChange,
}: CreatePommeauBlendDialogProps) {
  // Initialize with current date in local timezone
  const now = new Date();
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Juice source
  const [juiceVolume, setJuiceVolume] = useState("");
  const [juiceVolumeUnit, setJuiceVolumeUnit] = useState<"L" | "gal">("L");
  const [juiceAbv, setJuiceAbv] = useState("0"); // Fresh juice is 0% ABV

  // Brandy source
  const [brandyBatchId, setBrandyBatchId] = useState("");
  const [brandyVolume, setBrandyVolume] = useState("");
  const [brandyVolumeUnit, setBrandyVolumeUnit] = useState<"L" | "gal">("L");

  // Pommeau batch
  const [pommeauName, setPommeauName] = useState("");
  const [destinationVesselId, setDestinationVesselId] = useState("");
  const [blendDate, setBlendDate] = useState(localISOTime);
  const [notes, setNotes] = useState("");
  const [deductFromBrandy, setDeductFromBrandy] = useState(true);

  const utils = trpc.useUtils();

  // Fetch batches - we'll filter for brandy locally
  // Since productType isn't in the list query, we use status="aging" as a proxy
  const { data: batchesData } = trpc.batch.list.useQuery({
    status: "aging",
    sortBy: "startDate",
    sortOrder: "desc",
  });

  // Filter to batches with volume (ideally brandy, but we can't filter by productType in list)
  // The user will need to select the correct brandy batch
  const brandyBatches =
    batchesData?.batches?.filter(
      (batch) => parseFloat(batch.currentVolume || "0") > 0
    ) || [];

  // Get selected brandy batch details
  const selectedBrandy = brandyBatches.find((b) => b.id === brandyBatchId);

  // Fetch available vessels
  const { data: vesselsData } = trpc.vessel.list.useQuery();
  const availableVessels =
    vesselsData?.vessels?.filter(
      (v: { status: string }) => v.status !== "inactive"
    ) || [];

  // Calculate preview of resulting blend
  const blendPreview = useMemo(() => {
    const juiceVolLiters =
      juiceVolumeUnit === "gal"
        ? parseFloat(juiceVolume || "0") * LITERS_PER_GALLON
        : parseFloat(juiceVolume || "0");

    const brandyVolLiters =
      brandyVolumeUnit === "gal"
        ? parseFloat(brandyVolume || "0") * LITERS_PER_GALLON
        : parseFloat(brandyVolume || "0");

    const brandyAbv = selectedBrandy?.actualAbv
      ? parseFloat(selectedBrandy.actualAbv)
      : 60; // Default assumption

    const totalVolume = juiceVolLiters + brandyVolLiters;

    const resultingAbv = calculateBlendAbv([
      { volumeLiters: juiceVolLiters, abv: parseFloat(juiceAbv) || 0 },
      { volumeLiters: brandyVolLiters, abv: brandyAbv },
    ]);

    return {
      juiceVolLiters,
      brandyVolLiters,
      brandyAbv,
      totalVolume,
      resultingAbv,
    };
  }, [juiceVolume, juiceVolumeUnit, brandyVolume, brandyVolumeUnit, selectedBrandy, juiceAbv]);

  // Create pommeau mutation
  const createPommeau = trpc.distillation.createPommeau.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Pommeau batch "${data.pommeauBatch.name}" created with ${data.resultingAbv.toFixed(1)}% ABV`,
      });
      utils.batch.list.invalidate();
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
    setJuiceVolume("");
    setJuiceVolumeUnit("L");
    setJuiceAbv("0");
    setBrandyBatchId("");
    setBrandyVolume("");
    setBrandyVolumeUnit("L");
    setPommeauName("");
    setDestinationVesselId("");
    setBlendDate(localISOTime);
    setNotes("");
    setDeductFromBrandy(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!juiceVolume || parseFloat(juiceVolume) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid juice volume",
        variant: "destructive",
      });
      return;
    }

    if (!brandyBatchId) {
      toast({
        title: "Error",
        description: "Please select a brandy batch",
        variant: "destructive",
      });
      return;
    }

    if (!brandyVolume || parseFloat(brandyVolume) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid brandy volume",
        variant: "destructive",
      });
      return;
    }

    createPommeau.mutate({
      name: pommeauName || undefined,
      juiceVolumeLiters: blendPreview.juiceVolLiters,
      juiceAbv: parseFloat(juiceAbv) || 0,
      brandyBatchId,
      brandyVolumeLiters: blendPreview.brandyVolLiters,
      destinationVesselId: destinationVesselId && destinationVesselId !== "__none__" ? destinationVesselId : undefined,
      blendDate: new Date(blendDate),
      notes: notes || undefined,
      deductFromBrandy,
    });
  };

  // Check if resulting ABV is in typical pommeau range (16-22%)
  const isTypicalPommeauAbv =
    blendPreview.resultingAbv >= 16 && blendPreview.resultingAbv <= 22;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Create Pommeau Blend
          </DialogTitle>
          <DialogDescription>
            Blend fresh apple juice with apple brandy to create pommeau. The
            resulting ABV is calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Juice Source */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Fresh Juice</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="juiceVolume">Juice Volume *</Label>
                <Input
                  id="juiceVolume"
                  type="number"
                  step="0.1"
                  placeholder="75"
                  value={juiceVolume}
                  onChange={(e) => setJuiceVolume(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="juiceVolumeUnit">Unit</Label>
                <Select
                  value={juiceVolumeUnit}
                  onValueChange={(v) => setJuiceVolumeUnit(v as "L" | "gal")}
                >
                  <SelectTrigger id="juiceVolumeUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Liters</SelectItem>
                    <SelectItem value="gal">Gallons</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="juiceAbv">Juice ABV (%)</Label>
                <Input
                  id="juiceAbv"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={juiceAbv}
                  onChange={(e) => setJuiceAbv(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Usually 0% (fresh juice)</p>
              </div>
            </div>
          </div>

          {/* Brandy Source */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Apple Brandy</h4>
            <div className="space-y-2">
              <Label htmlFor="brandyBatch">Brandy Batch *</Label>
              <Select value={brandyBatchId} onValueChange={setBrandyBatchId}>
                <SelectTrigger id="brandyBatch">
                  <SelectValue placeholder="Select a brandy batch" />
                </SelectTrigger>
                <SelectContent>
                  {brandyBatches.length === 0 ? (
                    <div className="py-2 px-2 text-sm text-muted-foreground">
                      No aging batches available
                    </div>
                  ) : (
                    brandyBatches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name} ({parseFloat(batch.currentVolume || "0").toFixed(1)}L,{" "}
                        {batch.actualAbv || "?"}% ABV)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brandyVolume">Brandy Volume *</Label>
                <Input
                  id="brandyVolume"
                  type="number"
                  step="0.1"
                  placeholder="25"
                  value={brandyVolume}
                  onChange={(e) => setBrandyVolume(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandyVolumeUnit">Unit</Label>
                <Select
                  value={brandyVolumeUnit}
                  onValueChange={(v) => setBrandyVolumeUnit(v as "L" | "gal")}
                >
                  <SelectTrigger id="brandyVolumeUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Liters</SelectItem>
                    <SelectItem value="gal">Gallons</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="deductFromBrandy"
                checked={deductFromBrandy}
                onChange={(e) => setDeductFromBrandy(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="deductFromBrandy" className="font-normal">
                Deduct volume from brandy batch
              </Label>
            </div>
          </div>

          {/* Blend Preview */}
          {(parseFloat(juiceVolume || "0") > 0 || parseFloat(brandyVolume || "0") > 0) && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4" />
                Blend Preview
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Juice:</span>{" "}
                  {blendPreview.juiceVolLiters.toFixed(1)}L @ {juiceAbv || "0"}%
                </div>
                <div>
                  <span className="text-muted-foreground">Brandy:</span>{" "}
                  {blendPreview.brandyVolLiters.toFixed(1)}L @ {blendPreview.brandyAbv}%
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  {blendPreview.totalVolume.toFixed(1)}L
                </div>
              </div>
              <div className="text-lg font-semibold">
                Resulting ABV:{" "}
                <span
                  className={
                    isTypicalPommeauAbv ? "text-green-600" : "text-amber-600"
                  }
                >
                  {blendPreview.resultingAbv.toFixed(1)}%
                </span>
              </div>
              {!isTypicalPommeauAbv && blendPreview.resultingAbv > 0 && (
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Typical pommeau ABV is 16-22%. Current blend is{" "}
                    {blendPreview.resultingAbv < 16 ? "below" : "above"} this range.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Pommeau Batch Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Pommeau Batch Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pommeauName">Batch Name</Label>
                <Input
                  id="pommeauName"
                  placeholder="Auto-generated if blank"
                  value={pommeauName}
                  onChange={(e) => setPommeauName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blendDate">Blend Date</Label>
                <Input
                  id="blendDate"
                  type="datetime-local"
                  value={blendDate}
                  onChange={(e) => setBlendDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationVessel">Destination Vessel (Optional)</Label>
              <Select value={destinationVesselId} onValueChange={setDestinationVesselId}>
                <SelectTrigger id="destinationVessel">
                  <SelectValue placeholder="Select a vessel for aging" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No vessel (unassigned)</SelectItem>
                  {availableVessels.map(
                    (vessel: { id: string; name: string | null; material: string | null; capacity: string }) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name} ({vessel.material || "unknown"}, {vessel.capacity}L)
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this blend..."
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
            <Button type="submit" disabled={createPommeau.isPending}>
              {createPommeau.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Pommeau Blend
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
