"use client";

/**
 * Step detail modal (Phase 5, M3 — capture-first).
 *
 * Opening a step shows its plan and lets the operator record what they ACTUALLY
 * did before marking it done: an actual amount for additives, the destination
 * vessel for a transfer, readings for a measurement, plus free-text notes for
 * any step. Captured into batch_step_tasks.actual_data / notes (deviation
 * tracking). Real operations (insert the additive, perform the transfer + assign
 * the vessel, draw down inventory) get wired in next, kind by kind.
 */

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { AddBatchMeasurementForm } from "@/components/cellar/AddBatchMeasurementForm";
import { AddBatchAdditiveForm } from "@/components/cellar/AddBatchAdditiveForm";

interface Task {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  packagingPath: string;
  isOptional: boolean;
  status: string;
  notes: string | null;
  actionData: Record<string, unknown> | null;
  actualData: Record<string, unknown> | null;
}
interface Ingredient {
  label: string;
  additiveType: string | null;
  additiveName: string | null;
  additiveVarietyId: string | null;
  rateValue: string | number | null;
  rateUnit: string | null;
}
interface Source {
  id: string;
  name: string;
  customName: string | null;
  vesselName: string | null;
  currentVolume: string | null;
  currentVolumeUnit: string | null;
  plannedVolumeL: number | null;
}

export function StepDetailModal({
  open,
  onClose,
  batchId,
  task,
  sources,
  plannedVolumeL,
  ingredients,
}: {
  open: boolean;
  onClose: () => void;
  batchId: string;
  task: Task | null;
  sources: Source[];
  plannedVolumeL: number;
  ingredients: Ingredient[];
}) {
  const utils = trpc.useUtils();
  const ad = (task?.actualData ?? {}) as Record<string, unknown>;
  const [destVesselId, setDestVesselId] = useState<string | null>(
    (ad.destinationVesselId as string) ?? null,
  );
  const [vesselSearch, setVesselSearch] = useState("");
  const [notes, setNotes] = useState(task?.notes ?? "");

  // Total to transfer = sum of each source cider's planned draw (set at
  // instantiation); falls back to the batch's planned volume.
  const plannedTotalL =
    sources.reduce((s, x) => s + (x.plannedVolumeL ?? 0), 0) || plannedVolumeL;

  const vesselsQuery = trpc.vessel.listWithBatches.useQuery(undefined, {
    enabled: open && task?.kind === "transfer",
  });

  const refresh = () => {
    utils.recipeExecution.getForBatch.invalidate({ batchId });
    utils.recipeExecution.listOpenTasks.invalidate();
  };
  const complete = trpc.recipeExecution.completeTask.useMutation({
    onSuccess: () => {
      toast({ title: "Step completed" });
      refresh();
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't complete", description: e.message, variant: "destructive" }),
  });
  const reopen = trpc.recipeExecution.reopenTask.useMutation({
    onSuccess: () => { refresh(); onClose(); },
  });
  const transfer = trpc.recipeExecution.performTransfer.useMutation({
    onSuccess: () => {
      toast({ title: "Transfer recorded" });
      refresh();
      utils.batch.get.invalidate({ batchId });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't transfer", description: e.message, variant: "destructive" }),
  });

  if (!task) return null;
  const isDone = task.status === "done" || task.status === "skipped";

  const buildActualData = () => {
    const out: Record<string, unknown> = {};
    if (task.kind === "transfer" && destVesselId) out.destinationVesselId = destVesselId;
    return Object.keys(out).length ? out : null;
  };

  const onMarkDone = () => {
    complete.mutate({
      taskId: task.id,
      actualData: buildActualData(),
      notes: notes.trim() || null,
    });
  };

  const q = vesselSearch.trim().toLowerCase();
  const vesselOptions = (vesselsQuery.data?.vessels ?? [])
    .map((v) => {
      const capacityL = (v.capacityUnit === "gal" ? 3.785411784 : 1) * Number(v.capacity ?? 0);
      const contentsL = v.currentBatch ? Number(v.currentBatch.currentVolume ?? 0) : 0;
      const spaceL = capacityL - contentsL;
      return {
        id: v.id,
        name: v.name ?? "",
        capacityL,
        contentsL,
        spaceL,
        isEmpty: !v.currentBatch || contentsL < 0.1,
        batchName: v.currentBatch?.name ?? null,
        fits: spaceL + 0.001 >= plannedTotalL,
      };
    })
    .filter((v) => !q || v.name.toLowerCase().includes(q))
    // Empty vessels first, then most free space.
    .sort((a, b) => Number(b.isEmpty) - Number(a.isEmpty) || b.spaceL - a.spaceL);

  // Measurement + additive steps open the SAME forms as the manual cellar flow;
  // completing one records the real operation and marks the step done.
  const useRealForm =
    !isDone &&
    (task.kind === "measurement" || task.kind === "add_additive" || task.kind === "pitch_yeast");
  const onRealSuccess = () => complete.mutate({ taskId: task.id });

  // Prefill the add-additive form from the recipe ingredient this step references.
  const additivePrefill = (() => {
    if (task.kind !== "add_additive" && task.kind !== "pitch_yeast") return null;
    const ingLabel = (task.actionData?.ingredientLabel as string) ?? task.label ?? "";
    const ing =
      ingredients.find((i) => i.label === ingLabel || i.additiveName === ingLabel) ??
      ingredients.find((i) => ingLabel.includes(i.label));
    if (!ing) return null;
    const rate = ing.rateValue != null ? Number(ing.rateValue) : undefined;
    const rateUnit = ing.rateUnit ?? undefined;
    let amount: number | undefined;
    let unit: string | undefined;
    if (rate != null && rateUnit?.endsWith("/L") && plannedTotalL > 0) {
      amount = Number((rate * plannedTotalL).toFixed(2));
      unit = rateUnit.replace("/L", "");
    }
    return {
      additiveType: ing.additiveType ?? undefined,
      varietyName: ing.additiveName ?? ing.label,
      dosageRate: rate,
      dosageRateUnit: rateUnit,
      amount,
      unit,
    };
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${useRealForm ? "max-w-2xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {task.label}
            {task.packagingPath !== "all" && (
              <Badge variant="outline" className="text-[10px]">
                {task.packagingPath === "bottle" ? "Bottle only" : "Keg only"}
              </Badge>
            )}
          </DialogTitle>
          {task.description && <DialogDescription>{task.description}</DialogDescription>}
        </DialogHeader>

        {useRealForm ? (
          task.kind === "measurement" ? (
            <AddBatchMeasurementForm batchId={batchId} onSuccess={onRealSuccess} onCancel={onClose} />
          ) : (
            <AddBatchAdditiveForm
              batchId={batchId}
              onSuccess={onRealSuccess}
              onCancel={onClose}
              prefillAdditiveType={additivePrefill?.additiveType}
              prefillVarietyName={additivePrefill?.varietyName}
              prefillDosageRate={additivePrefill?.dosageRate}
              prefillDosageRateUnit={additivePrefill?.dosageRateUnit}
              prefillAmount={additivePrefill?.amount}
              prefillUnit={additivePrefill?.unit}
            />
          )
        ) : (
          <div className="space-y-4">
            {/* Transfer: source + destination vessel (capture-first; real transfer wired next) */}
            {task.kind === "transfer" && (
              <>
                <div className="rounded-md bg-gray-50 border p-2.5 text-sm">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {sources.length > 1 ? "Blend — drawn from:" : "Source cider"}
                  </p>
                  {sources.length === 0 ? (
                    <p className="text-muted-foreground">No source recorded.</p>
                  ) : (
                    sources.map((s) => (
                      <p key={s.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {s.customName || s.name}
                          {s.vesselName ? ` — ${s.vesselName}` : ""}
                        </span>
                        {s.plannedVolumeL != null && (
                          <span className="font-mono shrink-0">{s.plannedVolumeL} L</span>
                        )}
                      </p>
                    ))
                  )}
                  {sources.length > 1 && (
                    <p className="flex justify-between gap-2 border-t mt-1 pt-1 font-medium">
                      <span>Total</span>
                      <span className="font-mono">{plannedTotalL.toFixed(0)} L</span>
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Destination vessel (which tank this batch goes into)</Label>
                  <Input
                    value={vesselSearch}
                    onChange={(e) => setVesselSearch(e.target.value)}
                    placeholder="Search vessels…"
                    className="h-9 mb-1.5"
                    disabled={isDone}
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                    {vesselOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-2.5 py-3">No vessels found.</p>
                    ) : (
                      vesselOptions.map((v) => {
                        const selected = destVesselId === v.id;
                        const disabled = isDone || !v.fits;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => setDestVesselId(selected ? null : v.id)}
                            className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 ${
                              selected ? "bg-green-50" : "hover:bg-gray-50"
                            } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="font-medium truncate">{v.name}</span>
                                {v.isEmpty ? (
                                  <Badge variant="outline" className="text-[10px] border-green-400 text-green-700">
                                    Empty
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {v.contentsL.toFixed(0)} L · {v.batchName}
                                  </span>
                                )}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {v.spaceL.toFixed(0)} L free of {v.capacityL.toFixed(0)} L
                                {!v.fits && plannedTotalL > 0 ? " · not enough space" : ""}
                              </span>
                            </span>
                            {selected && <Check className="w-4 h-4 text-green-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {plannedTotalL.toFixed(0)} L is drawn into this vessel and the batch is
                    assigned to it. Vessels without room are disabled.
                  </p>
                </div>
              </>
            )}

            {/* Notes — every capture-first kind */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth recording about this step…"
                className="text-sm"
                disabled={isDone}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                {isDone ? "Close" : "Cancel"}
              </Button>
              {isDone ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reopen.isPending}
                  onClick={() => reopen.mutate({ taskId: task.id })}
                >
                  Reopen
                </Button>
              ) : task.kind === "transfer" ? (
                <Button
                  size="sm"
                  disabled={transfer.isPending || !destVesselId || !(plannedTotalL > 0)}
                  onClick={() =>
                    transfer.mutate({ taskId: task.id, destinationVesselId: destVesselId! })
                  }
                >
                  <Check className="w-4 h-4 mr-1" /> Perform transfer
                </Button>
              ) : (
                <Button size="sm" disabled={complete.isPending} onClick={onMarkDone}>
                  <Check className="w-4 h-4 mr-1" /> Mark done
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
