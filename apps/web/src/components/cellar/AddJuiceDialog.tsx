"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/useDateFormat";
import { humanizeMutationError } from "@/utils/mutation-errors";
import { Droplets } from "lucide-react";
import {
  addedSugarGramsPerLiter,
  sugarGramsFromJuiceAddition,
  calculateEstimatedSGAfterAddition,
} from "lib";

type SourceTab = "inventory" | "vessel";

interface AddJuiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  /** Vessel currently holding the batch (destination of the juice) */
  vesselId: string;
  batchName: string;
  currentVolumeL: number;
  /** Latest measured SG of the batch, for the estimated-SG readout */
  currentSG?: number | null;
  /** Prefill dose rate (mL/L), e.g. from a recipe step */
  prefillRateMlPerL?: number | null;
  /** Prefill the date field, e.g. a recipe step's scheduled date */
  prefillDate?: Date | null;
  /** Called after a successful save with the actual addition date */
  onSuccess?: (actualAt?: Date) => void;
}

export function AddJuiceDialog({
  open,
  onOpenChange,
  batchId,
  vesselId,
  batchName,
  currentVolumeL,
  currentSG,
  prefillRateMlPerL,
  prefillDate,
  onSuccess,
}: AddJuiceDialogProps) {
  const utils = trpc.useUtils();
  const { formatDateTimeForInput, parseDateTimeFromInput } = useDateFormat();

  const [sourceTab, setSourceTab] = useState<SourceTab>("inventory");
  const [juicePurchaseItemId, setJuicePurchaseItemId] = useState("");
  const [sourceVesselId, setSourceVesselId] = useState("");
  const [juiceSG, setJuiceSG] = useState("");
  const [rateMlPerL, setRateMlPerL] = useState("");
  const [totalL, setTotalL] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [notes, setNotes] = useState("");

  const inventoryQuery = trpc.juicePurchases.listInventory.useQuery(
    { limit: 100, offset: 0 },
    { enabled: open },
  );
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery(undefined, {
    enabled: open,
  });

  // Reset on open, carrying any recipe prefill
  useEffect(() => {
    if (open) {
      setSourceTab("inventory");
      setJuicePurchaseItemId("");
      setSourceVesselId("");
      setJuiceSG("");
      setNotes("");
      setDateStr(formatDateTimeForInput(prefillDate ?? new Date()));
      if (prefillRateMlPerL && prefillRateMlPerL > 0 && currentVolumeL > 0) {
        setRateMlPerL(prefillRateMlPerL.toString());
        setTotalL(((prefillRateMlPerL * currentVolumeL) / 1000).toFixed(2));
      } else {
        setRateMlPerL("");
        setTotalL("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const inventoryItems = useMemo(
    () =>
      (inventoryQuery.data?.items ?? []).filter(
        (item) => item.availableVolumeL > 0.01,
      ),
    [inventoryQuery.data],
  );

  const vesselSources = useMemo(
    () =>
      (liquidMapQuery.data?.vessels ?? []).filter(
        (v) =>
          v.batchId &&
          v.batchId !== batchId &&
          parseFloat(v.currentVolume?.toString() || "0") > 0.01,
      ),
    [liquidMapQuery.data, batchId],
  );

  // Land on the tab that has something to offer: when no purchased lots
  // have volume but vessels do (e.g. juice stored in a freezer vessel),
  // start on the vessel tab instead of an empty inventory list.
  useEffect(() => {
    if (
      open &&
      !juicePurchaseItemId &&
      !sourceVesselId &&
      sourceTab === "inventory" &&
      inventoryQuery.isFetched &&
      inventoryItems.length === 0 &&
      vesselSources.length > 0
    ) {
      setSourceTab("vessel");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inventoryQuery.isFetched, inventoryItems.length, vesselSources.length]);

  const selectedInventoryItem = inventoryItems.find(
    (item) => item.id === juicePurchaseItemId,
  );
  const selectedVesselSource = vesselSources.find(
    (v) => v.vesselId === sourceVesselId,
  );

  const availableL =
    sourceTab === "inventory"
      ? (selectedInventoryItem?.availableVolumeL ?? 0)
      : selectedVesselSource
        ? parseFloat(selectedVesselSource.currentVolume?.toString() || "0")
        : 0;

  // Prefill SG when a source is chosen (stays editable)
  const handleSelectInventoryItem = (id: string) => {
    setJuicePurchaseItemId(id);
    const item = inventoryItems.find((i) => i.id === id);
    if (item?.specificGravity) {
      setJuiceSG(parseFloat(item.specificGravity).toFixed(3));
    }
  };

  const handleSelectVesselSource = (id: string) => {
    setSourceVesselId(id);
    const v = vesselSources.find((s) => s.vesselId === id);
    const sg =
      (v as { latestMeasurement?: { specificGravity?: unknown } } | undefined)
        ?.latestMeasurement?.specificGravity ??
      v?.finalGravity ??
      v?.originalGravity;
    if (sg) {
      setJuiceSG(parseFloat(sg.toString()).toFixed(3));
    }
  };

  // Bidirectional rate ↔ total volume
  const handleRateChange = (value: string) => {
    setRateMlPerL(value);
    const rate = parseFloat(value);
    if (Number.isFinite(rate) && rate > 0 && currentVolumeL > 0) {
      setTotalL(((rate * currentVolumeL) / 1000).toFixed(2));
    } else {
      setTotalL("");
    }
  };

  const handleTotalChange = (value: string) => {
    setTotalL(value);
    const total = parseFloat(value);
    if (Number.isFinite(total) && total > 0 && currentVolumeL > 0) {
      setRateMlPerL(((total * 1000) / currentVolumeL).toFixed(1));
    } else {
      setRateMlPerL("");
    }
  };

  const rateNum = parseFloat(rateMlPerL);
  const totalNum = parseFloat(totalL);
  const sgNum = parseFloat(juiceSG);
  const hasDose = Number.isFinite(totalNum) && totalNum > 0;
  const hasSG = Number.isFinite(sgNum) && sgNum > 0.9 && sgNum < 1.2;

  const addedSugarGPerL =
    hasDose && hasSG && Number.isFinite(rateNum)
      ? addedSugarGramsPerLiter(sgNum, rateNum)
      : null;

  const estimatedSGAfter =
    hasDose && hasSG && currentSG
      ? calculateEstimatedSGAfterAddition(
          currentSG,
          sugarGramsFromJuiceAddition(sgNum, totalNum),
          currentVolumeL + totalNum,
        )
      : null;

  const sourceSelected =
    sourceTab === "inventory" ? !!juicePurchaseItemId : !!sourceVesselId;
  // Only meaningful once a source is chosen — otherwise availableL is 0
  // and the warning fires before the user has done anything wrong.
  const overAvailable =
    sourceSelected && hasDose && totalNum > availableL + 0.001;

  const transferJuiceMutation = trpc.batch.transferJuiceToTank.useMutation({
    onSuccess: handleSaved,
    onError: handleError,
  });
  const vesselTransferMutation = trpc.vessel.transfer.useMutation({
    onSuccess: handleSaved,
    onError: handleError,
  });

  function handleSaved() {
    toast({
      title: "Juice Added",
      description: `${totalNum.toFixed(2)} L added to ${batchName}.`,
    });
    utils.batch.get.invalidate({ batchId });
    utils.batch.getComposition.invalidate();
    utils.batch.getHistory.invalidate({ batchId });
    utils.vessel.liquidMap.invalidate();
    utils.juicePurchases.listInventory.invalidate();
    onOpenChange(false);
    onSuccess?.(submittedDateRef.current);
  }

  function handleError(error: unknown) {
    toast({
      title: "Failed to Add Juice",
      description: humanizeMutationError(error),
      variant: "destructive",
    });
  }

  const isPending =
    transferJuiceMutation.isPending || vesselTransferMutation.isPending;

  const submittedDateRef = React.useRef<Date | undefined>(undefined);

  const handleSubmit = () => {
    const transferDate = parseDateTimeFromInput(dateStr);
    if (!transferDate || Number.isNaN(transferDate.getTime())) {
      toast({
        title: "Invalid Date",
        description: "Enter a valid date and time.",
        variant: "destructive",
      });
      return;
    }
    submittedDateRef.current = transferDate;
    if (sourceTab === "inventory") {
      transferJuiceMutation.mutate({
        juicePurchaseItemId,
        vesselId,
        volumeToTransfer: totalNum,
        volumeUnit: "L",
        transferDate,
        notes: notes || undefined,
      });
    } else {
      vesselTransferMutation.mutate({
        fromVesselId: sourceVesselId,
        toVesselId: vesselId,
        volumeL: totalNum,
        transferDate,
        notes: notes || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-amber-600" />
            Add Juice to {batchName}
          </DialogTitle>
          <DialogDescription>
            Dose juice into this batch (e.g. backsweetening). Volume, cost, and
            composition are tracked from the source.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source */}
          <div>
            <Label className="text-sm font-medium">Juice source *</Label>
            <div className="flex rounded-lg border overflow-hidden mt-2">
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
                  sourceTab === "inventory"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setSourceTab("inventory")}
              >
                Juice Inventory
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 text-sm font-medium transition-colors border-l ${
                  sourceTab === "vessel"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setSourceTab("vessel")}
              >
                From Vessel
              </button>
            </div>
            <div className="mt-2">
              {sourceTab === "inventory" ? (
                <SearchableSelect
                  options={inventoryItems.map((item) => ({
                    value: item.id,
                    label: `${item.varietyName || item.juiceType || "Juice"} — ${item.availableVolumeL.toFixed(1)} L available`,
                    description: [
                      item.vendorName,
                      item.specificGravity
                        ? `SG ${parseFloat(item.specificGravity).toFixed(3)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                  value={juicePurchaseItemId}
                  onValueChange={handleSelectInventoryItem}
                  placeholder={
                    inventoryQuery.isLoading
                      ? "Loading juice inventory..."
                      : inventoryItems.length === 0
                        ? "No juice with available volume"
                        : "Select a juice lot"
                  }
                  searchPlaceholder="Search juice lots..."
                  emptyText="No matching juice lots"
                  disabled={inventoryQuery.isLoading}
                />
              ) : (
                <SearchableSelect
                  options={vesselSources.map((v) => ({
                    value: v.vesselId,
                    label: `${v.vesselName} — ${v.batchCustomName || v.batchNumber}`,
                    description: `${parseFloat(v.currentVolume?.toString() || "0").toFixed(1)} ${v.currentVolumeUnit || "L"} available`,
                  }))}
                  value={sourceVesselId}
                  onValueChange={handleSelectVesselSource}
                  placeholder={
                    liquidMapQuery.isLoading
                      ? "Loading vessels..."
                      : vesselSources.length === 0
                        ? "No other vessels hold liquid"
                        : "Select source vessel (e.g. freezer)"
                  }
                  searchPlaceholder="Search vessels..."
                  emptyText="No matching vessels"
                  disabled={liquidMapQuery.isLoading}
                />
              )}
            </div>
          </div>

          {/* Juice SG */}
          <div>
            <Label htmlFor="juiceSG" className="text-sm font-medium">
              Juice specific gravity
            </Label>
            <Input
              id="juiceSG"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 1.050"
              value={juiceSG}
              onChange={(e) => setJuiceSG(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Prefilled from the source when known — adjust if you re-measured.
            </p>
          </div>

          {/* Dose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rateMlPerL" className="text-sm font-medium">
                Dose (mL/L) *
              </Label>
              <Input
                id="rateMlPerL"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 34"
                value={rateMlPerL}
                onChange={(e) => handleRateChange(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="totalL" className="text-sm font-medium">
                Total juice (L) *
              </Label>
              <Input
                id="totalL"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="computed"
                value={totalL}
                onChange={(e) => handleTotalChange(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Batch volume: {currentVolumeL.toFixed(1)} L — enter either value and
            the other is computed.
          </p>
          {overAvailable && (
            <p className="text-sm text-red-600">
              Exceeds the {availableL.toFixed(1)} L available from this source.
            </p>
          )}

          {/* Readouts */}
          {hasDose && hasSG && (
            <div className="rounded-lg border bg-amber-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  ≈ Added sugar (sucrose-equivalent)
                </span>
                <span className="font-medium">
                  {addedSugarGPerL?.toFixed(1)} g/L
                </span>
              </div>
              {estimatedSGAfter !== null && currentSG ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Estimated batch SG
                  </span>
                  <span className="font-medium">
                    {currentSG.toFixed(3)} → {estimatedSGAfter.toFixed(3)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No recent batch SG measurement — SG-after estimate
                  unavailable.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Estimates from juice SG; actual fermentable sugar is slightly
                lower.
              </p>
            </div>
          )}

          {/* Date */}
          <div>
            <Label htmlFor="juiceDate" className="text-sm font-medium">
              Date/time *
            </Label>
            <Input
              id="juiceDate"
              type="datetime-local"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="juiceNotes" className="text-sm font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="juiceNotes"
              placeholder="e.g. backsweetening for apple character"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!sourceSelected || !hasDose || overAvailable || isPending}
            >
              {isPending ? "Adding..." : "Add Juice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
