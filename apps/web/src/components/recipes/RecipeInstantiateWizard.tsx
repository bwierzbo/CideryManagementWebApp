"use client";

/**
 * "Use this recipe" wizard — instantiates a recipe into a live, scheduled batch.
 *
 * Mode is chosen each time: create a NEW batch (seeded from the source the
 * recipe declares — existing ciders to blend, a press run, or a juice lot) or
 * ATTACH the schedule to an existing batch. The bottle/keg split and which
 * optional steps to include are set here. On success, navigates to the batch.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface RecipeInput {
  id: string;
  kind: string;
  label: string;
  sourceProductType?: string | null;
}
interface RecipeStep {
  id: string;
  sequence: number;
  label: string;
  isOptional: boolean;
  packagingPath: string;
}
interface Props {
  open: boolean;
  onClose: () => void;
  recipe: { id: string; name: string; productType: string };
  inputs: RecipeInput[];
  steps: RecipeStep[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function RecipeInstantiateWizard({ open, onClose, recipe, inputs, steps }: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<"new" | "attach">("new");
  const [startDate, setStartDate] = useState(todayStr());
  const [totalVolumeL, setTotalVolumeL] = useState<number>(120);
  const [kegVolumeL, setKegVolumeL] = useState<number>(0);
  const [newBatchName, setNewBatchName] = useState("");
  const [parentBatchIds, setParentBatchIds] = useState<string[]>([]);
  const [pressRunId, setPressRunId] = useState<string | null>(null);
  const [juicePurchaseItemId, setJuicePurchaseItemId] = useState<string | null>(null);
  const [existingBatchId, setExistingBatchId] = useState<string | null>(null);
  const [skippedStepIds, setSkippedStepIds] = useState<Set<string>>(new Set());

  const hasParentReq = inputs.some((i) => i.kind === "parent_batch_requirement");
  const hasPressReq = inputs.some((i) => i.kind === "press_run_requirement");
  const hasJuiceReq = inputs.some((i) => i.kind === "juice_purchase_requirement");
  const optionalSteps = useMemo(() => steps.filter((s) => s.isOptional), [steps]);

  // Source data — only fetch what's relevant while the dialog is open.
  const batchesQuery = trpc.batch.list.useQuery(
    { limit: 100 },
    { enabled: open && (mode === "attach" || hasParentReq) },
  );
  const pressRunsQuery = trpc.pressRun.list.useQuery(
    { status: "completed", limit: 100 },
    { enabled: open && mode === "new" && hasPressReq },
  );
  const juiceQuery = trpc.juicePurchases.listInventory.useQuery(
    { limit: 100 },
    { enabled: open && mode === "new" && hasJuiceReq },
  );

  const activeBatches = (batchesQuery.data?.batches ?? []).filter(
    (b) => b.status !== "completed" && b.status !== "discarded",
  );
  const batchOptions = activeBatches.map((b) => ({
    value: b.id,
    label: b.customName || b.name,
    description: `${b.productType} · ${b.currentVolume ?? "?"} ${b.currentVolumeUnit ?? "L"} · ${b.status}`,
  }));

  const bottleVolumeL = Math.max(0, totalVolumeL - kegVolumeL);

  const mutation = trpc.recipeExecution.instantiate.useMutation({
    onSuccess: (res) => {
      toast({ title: "Recipe started", description: `${res.taskCount} steps scheduled.` });
      onClose();
      router.push(`/batch/${res.batchId}`);
    },
    onError: (err) => {
      toast({ title: "Couldn't start recipe", description: err.message, variant: "destructive" });
    },
  });

  const sourceMissing =
    mode === "new" &&
    (hasParentReq || hasPressReq || hasJuiceReq) &&
    parentBatchIds.length === 0 &&
    !pressRunId &&
    !juicePurchaseItemId;
  const canSubmit =
    totalVolumeL > 0 &&
    kegVolumeL >= 0 &&
    kegVolumeL <= totalVolumeL &&
    (mode === "attach" ? !!existingBatchId : !sourceMissing) &&
    !mutation.isPending;

  const submit = () => {
    mutation.mutate({
      recipeId: recipe.id,
      mode,
      startDate,
      totalVolumeL,
      kegVolumeL,
      parentBatchIds,
      pressRunId: pressRunId ?? undefined,
      juicePurchaseItemId: juicePurchaseItemId ?? undefined,
      newBatchName: newBatchName.trim() || undefined,
      existingBatchId: existingBatchId ?? undefined,
      skippedStepIds: Array.from(skippedStepIds),
    });
  };

  const addParentBatch = (id: string) => {
    setParentBatchIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Use “{recipe.name}”</DialogTitle>
          <DialogDescription>
            Create a scheduled batch from this recipe, or attach it to a batch you
            already have.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
              size="sm"
            >
              Create new batch
            </Button>
            <Button
              type="button"
              variant={mode === "attach" ? "default" : "outline"}
              onClick={() => setMode("attach")}
              size="sm"
            >
              Attach to existing
            </Button>
          </div>

          {/* Source (new mode) */}
          {mode === "new" && (
            <div className="space-y-3">
              {hasParentReq && (
                <div>
                  <Label className="text-xs">
                    Start from cider {parentBatchIds.length > 1 ? "(blend)" : ""}
                  </Label>
                  {parentBatchIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 my-1.5">
                      {parentBatchIds.map((id) => {
                        const b = activeBatches.find((x) => x.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1">
                            {b?.customName || b?.name || id.slice(0, 8)}
                            <button
                              type="button"
                              onClick={() =>
                                setParentBatchIds((p) => p.filter((x) => x !== id))
                              }
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <SearchableSelect
                    options={batchOptions.filter((o) => !parentBatchIds.includes(o.value))}
                    value=""
                    onValueChange={addParentBatch}
                    placeholder="Add a base cider…"
                    searchPlaceholder="Search batches…"
                    emptyText="No batches available."
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Pick one for a single varietal, or several to blend.
                  </p>
                </div>
              )}
              {hasPressReq && (
                <div>
                  <Label className="text-xs">Start from a press run (juice)</Label>
                  <SearchableSelect
                    options={(pressRunsQuery.data?.pressRuns ?? []).map((p) => ({
                      value: p.id,
                      label: p.pressRunName || p.id.slice(0, 8),
                      description: `${p.totalJuiceVolume ?? "?"} ${p.totalJuiceVolumeUnit ?? "L"}`,
                    }))}
                    value={pressRunId ?? ""}
                    onValueChange={(v) => setPressRunId(v || null)}
                    placeholder="Select a press run…"
                  />
                </div>
              )}
              {hasJuiceReq && (
                <div>
                  <Label className="text-xs">Start from purchased juice</Label>
                  <SearchableSelect
                    options={(juiceQuery.data?.items ?? []).map((j) => ({
                      value: j.id,
                      label: j.varietyName || j.juiceType || j.id.slice(0, 8),
                      description: `${j.availableVolume ?? "?"} ${j.volumeUnit ?? "L"} available`,
                    }))}
                    value={juicePurchaseItemId ?? ""}
                    onValueChange={(v) => setJuicePurchaseItemId(v || null)}
                    placeholder="Select a juice lot…"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">New batch name (optional)</Label>
                <Input
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Attach mode */}
          {mode === "attach" && (
            <div>
              <Label className="text-xs">Attach to batch</Label>
              <SearchableSelect
                options={batchOptions}
                value={existingBatchId ?? ""}
                onValueChange={(v) => setExistingBatchId(v || null)}
                placeholder="Select a batch…"
                searchPlaceholder="Search batches…"
              />
            </div>
          )}

          {/* Start date + volume split */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Total volume (L)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={totalVolumeL}
                onChange={(e) => setTotalVolumeL(e.target.value === "" ? 0 : Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Keg portion (L)</Label>
              <Input
                type="number"
                min="0"
                max={totalVolumeL}
                step="1"
                value={kegVolumeL}
                onChange={(e) => setKegVolumeL(e.target.value === "" ? 0 : Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            → {bottleVolumeL} L bottled · {kegVolumeL} L kegged. Keg-only and
            bottle-only steps are included only if that portion is &gt; 0.
          </p>

          {/* Optional steps */}
          {optionalSteps.length > 0 && (
            <div>
              <Label className="text-xs">Optional steps</Label>
              <div className="space-y-1.5 mt-1">
                {optionalSteps.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!skippedStepIds.has(s.id)}
                      onCheckedChange={(c) =>
                        setSkippedStepIds((prev) => {
                          const next = new Set(prev);
                          if (c === true) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                    />
                    <span>{s.label}</span>
                    {s.packagingPath !== "all" && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.packagingPath}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Unchecked steps are skipped for this batch.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={!canSubmit}>
              {mutation.isPending ? "Starting…" : "Start batch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
