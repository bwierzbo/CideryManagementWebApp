"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { Loader2, Wine } from "lucide-react";

interface CreateFortifiedBlendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBatchId?: string;
  preselectedBatchType?: "cider" | "perry" | "brandy";
}

export function CreateFortifiedBlendDialog({
  open,
  onOpenChange,
  preselectedBatchId,
  preselectedBatchType,
}: CreateFortifiedBlendDialogProps) {
  // Initialize with current date and time in local timezone
  const now = new Date();
  const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Form state
  const [ciderBatchId, setCiderBatchId] = useState("");
  const [ciderVolume, setCiderVolume] = useState("");
  const [ciderAbv, setCiderAbv] = useState("");
  const [deductFromCider, setDeductFromCider] = useState(true);

  const [brandyBatchId, setBrandyBatchId] = useState("");
  const [brandyVolume, setBrandyVolume] = useState("");
  const [deductFromBrandy, setDeductFromBrandy] = useState(true);

  const [destinationVesselId, setDestinationVesselId] = useState("");
  const [blendDate, setBlendDate] = useState(localISOTime);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();

  // Fetch available batches (use high limit to get all)
  const { data: batchesData } = trpc.batch.list.useQuery({
    sortBy: "startDate",
    sortOrder: "desc",
    limit: 200,
  });

  // Fetch available vessels
  const { data: vesselsData } = trpc.vessel.list.useQuery();

  // Filter batches by type
  const ciderBatches = batchesData?.batches?.filter(
    (batch) =>
      (batch.productType === "cider" || batch.productType === "perry" || !batch.productType) &&
      (batch.status === "fermentation" || batch.status === "aging" || batch.status === "conditioning") &&
      parseFloat(batch.currentVolume || "0") > 0
  ) || [];

  const brandyBatches = batchesData?.batches?.filter(
    (batch) =>
      batch.productType === "brandy" &&
      (batch.status === "aging" || batch.status === "conditioning" || batch.status === "completed") &&
      parseFloat(batch.currentVolume || "0") > 0
  ) || [];

  // Available vessels
  const availableVessels = vesselsData?.vessels || [];

  // Calculate blend preview
  const blendPreview = useMemo(() => {
    const ciderVol = parseFloat(ciderVolume) || 0;
    const brandyVol = parseFloat(brandyVolume) || 0;
    const ciderAbvNum = parseFloat(ciderAbv) || 0;

    // Get brandy ABV from selected batch
    const selectedBrandy = brandyBatches.find(b => b.id === brandyBatchId);
    const brandyAbvNum = selectedBrandy?.actualAbv
      ? parseFloat(String(selectedBrandy.actualAbv))
      : selectedBrandy?.estimatedAbv
      ? parseFloat(String(selectedBrandy.estimatedAbv))
      : 60;

    if (ciderVol > 0 && brandyVol > 0) {
      const totalVolume = ciderVol + brandyVol;
      const totalAlcohol = ciderVol * ciderAbvNum + brandyVol * brandyAbvNum;
      const resultingAbv = totalAlcohol / totalVolume;

      return {
        totalVolume: totalVolume.toFixed(1),
        resultingAbv: resultingAbv.toFixed(1),
        brandyAbv: brandyAbvNum.toFixed(1),
      };
    }
    return null;
  }, [ciderVolume, brandyVolume, ciderAbv, brandyBatchId, brandyBatches]);

  const createPommeau = trpc.distillation.createPommeau.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Fortified blend created with ${data.resultingAbv.toFixed(1)}% ABV`,
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
    setCiderBatchId("");
    setCiderVolume("");
    setCiderAbv("");
    setDeductFromCider(true);
    setBrandyBatchId("");
    setBrandyVolume("");
    setDeductFromBrandy(true);
    setDestinationVesselId("");
    setBlendDate(localISOTime);
    setName("");
    setNotes("");
  };

  // Auto-fill cider volume and ABV when batch is selected
  const handleCiderBatchChange = (batchId: string) => {
    setCiderBatchId(batchId);
    const batch = ciderBatches.find(b => b.id === batchId);
    if (batch) {
      setCiderVolume(String(parseFloat(batch.currentVolume || "0").toFixed(1)));
      // Get ABV from actualAbv, estimatedAbv, or latest measurement
      let abv = "";
      if (batch.actualAbv && batch.actualAbv !== "0") {
        abv = String(parseFloat(String(batch.actualAbv)).toFixed(1));
      } else if (batch.estimatedAbv && batch.estimatedAbv !== "0") {
        abv = String(parseFloat(String(batch.estimatedAbv)).toFixed(1));
      } else if (batch.latestMeasurement?.abv) {
        abv = String(parseFloat(String(batch.latestMeasurement.abv)).toFixed(1));
      }
      setCiderAbv(abv);
    }
  };

  // Auto-fill brandy volume when batch is selected
  const handleBrandyBatchChange = (batchId: string) => {
    setBrandyBatchId(batchId);
    const batch = brandyBatches.find(b => b.id === batchId);
    if (batch) {
      // Default to a portion of available volume for blending
      const availableVol = parseFloat(batch.currentVolume || "0");
      setBrandyVolume(String(Math.min(availableVol, 10).toFixed(1)));
    }
  };

  // Get batch display name
  const getBatchDisplayName = (batch: { customName: string | null; name: string; currentVolume?: string | null }) => {
    const vol = parseFloat(batch.currentVolume || "0").toFixed(1);
    return `${batch.customName || batch.name} (${vol}L)`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const ciderVol = parseFloat(ciderVolume);
    const brandyVol = parseFloat(brandyVolume);

    if (!ciderVol || ciderVol <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid cider/juice volume",
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

    if (!brandyVol || brandyVol <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid brandy volume",
        variant: "destructive",
      });
      return;
    }

    createPommeau.mutate({
      name: name.trim() || undefined,
      ciderBatchId: ciderBatchId || undefined,
      juiceVolumeLiters: ciderVol,
      juiceAbv: parseFloat(ciderAbv) || 0,
      deductFromCider,
      brandyBatchId,
      brandyVolumeLiters: brandyVol,
      deductFromBrandy,
      destinationVesselId: destinationVesselId || undefined,
      blendDate: new Date(blendDate),
      notes: notes.trim() || undefined,
    });
  };

  // Handle preselected batch
  useEffect(() => {
    if (preselectedBatchId && open) {
      if (preselectedBatchType === "brandy") {
        handleBrandyBatchChange(preselectedBatchId);
      } else {
        handleCiderBatchChange(preselectedBatchId);
      }
    }
  }, [preselectedBatchId, preselectedBatchType, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Create Fortified Blend
          </DialogTitle>
          <DialogDescription>
            Create pommeau or fortified cider by blending cider/juice with brandy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cider/Juice Source */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Cider/Juice Source</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ciderBatch">Source Batch (optional)</Label>
                <Select value={ciderBatchId} onValueChange={handleCiderBatchChange}>
                  <SelectTrigger>
                    {ciderBatchId ? (
                      <span className="truncate">
                        {getBatchDisplayName(ciderBatches.find(b => b.id === ciderBatchId) || { customName: null, name: "Loading..." })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select batch or enter manually</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Manual entry</SelectItem>
                    {ciderBatches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {getBatchDisplayName(batch)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciderVolume">Volume (L) *</Label>
                <Input
                  id="ciderVolume"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={ciderVolume}
                  onChange={(e) => setCiderVolume(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ciderAbv">ABV % (0 for fresh juice)</Label>
                <Input
                  id="ciderAbv"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={ciderAbv}
                  onChange={(e) => setCiderAbv(e.target.value)}
                />
              </div>
              {ciderBatchId && (
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="deductFromCider"
                    checked={deductFromCider}
                    onChange={(e) => setDeductFromCider(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="deductFromCider" className="font-normal">
                    Deduct from source batch
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Brandy Source */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Brandy Source</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brandyBatch">Brandy Batch *</Label>
                <Select value={brandyBatchId} onValueChange={handleBrandyBatchChange}>
                  <SelectTrigger>
                    {brandyBatchId ? (
                      <span className="truncate">
                        {getBatchDisplayName(brandyBatches.find(b => b.id === brandyBatchId) || { customName: null, name: "Loading..." })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select brandy batch</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {brandyBatches.length === 0 ? (
                      <div className="py-2 px-2 text-sm text-muted-foreground">
                        No brandy batches available
                      </div>
                    ) : (
                      brandyBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {getBatchDisplayName(batch)}
                          {batch.actualAbv && ` - ${parseFloat(String(batch.actualAbv)).toFixed(1)}% ABV`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandyVolume">Volume (L) *</Label>
                <Input
                  id="brandyVolume"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={brandyVolume}
                  onChange={(e) => setBrandyVolume(e.target.value)}
                />
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
                Deduct from brandy batch
              </Label>
            </div>
          </div>

          {/* Blend Preview */}
          {blendPreview && (
            <div className="rounded-lg border bg-purple-50 p-4 space-y-2">
              <h4 className="font-medium text-sm text-purple-900">Blend Preview</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-purple-700">Total Volume:</span>
                  <span className="ml-2 font-medium text-purple-900">{blendPreview.totalVolume}L</span>
                </div>
                <div>
                  <span className="text-purple-700">Brandy ABV:</span>
                  <span className="ml-2 font-medium text-purple-900">{blendPreview.brandyAbv}%</span>
                </div>
                <div>
                  <span className="text-purple-700">Resulting ABV:</span>
                  <span className="ml-2 font-medium text-purple-900">{blendPreview.resultingAbv}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Destination */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Destination & Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="destinationVessel">Destination Vessel</Label>
                <Select value={destinationVesselId} onValueChange={setDestinationVesselId}>
                  <SelectTrigger>
                    {destinationVesselId ? (
                      <span className="truncate">
                        {availableVessels.find(v => v.id === destinationVesselId)?.name || "Loading..."}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {availableVessels.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name} ({vessel.capacityLiters}L capacity)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="blendDate">Blend Date *</Label>
                <Input
                  id="blendDate"
                  type="datetime-local"
                  value={blendDate}
                  onChange={(e) => setBlendDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Batch Name (optional)</Label>
              <Input
                id="name"
                placeholder="Auto-generated if not provided"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this blend..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
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
              Create Blend
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
