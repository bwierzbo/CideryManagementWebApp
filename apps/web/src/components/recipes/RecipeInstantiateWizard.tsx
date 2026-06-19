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
import { X, Check } from "lucide-react";

/**
 * Inline, scrollable, searchable batch list. Lives directly in the dialog flow
 * (not a nested popover) so it scrolls reliably and shows every match.
 */
function InlineBatchList({
  options,
  selectedIds,
  onPick,
}: {
  options: { value: string; label: string; description?: string }[];
  selectedIds: string[];
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(ql) ||
          (o.description ?? "").toLowerCase().includes(ql),
      )
    : options;
  return (
    <div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search batches…"
        className="h-9 mb-1.5"
      />
      <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2.5 py-3">No batches found.</p>
        ) : (
          filtered.map((o) => {
            const selected = selectedIds.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onPick(o.value)}
                className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                  selected ? "bg-green-50" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.description && (
                    <span className="block text-xs text-muted-foreground truncate">
                      {o.description}
                    </span>
                  )}
                </span>
                {selected && <Check className="w-4 h-4 text-green-600 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{filtered.length} shown</p>
    </div>
  );
}

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
  // String-backed so the field can be cleared/retyped freely (a numeric state
  // would coerce an empty field back to 0, making the 0 impossible to delete).
  const [totalVolumeStr, setTotalVolumeStr] = useState("120");
  const [kegVolumeStr, setKegVolumeStr] = useState("0");
  const [newBatchName, setNewBatchName] = useState("");
  const [parentBatchIds, setParentBatchIds] = useState<string[]>([]);
  const [parentVolumes, setParentVolumes] = useState<Record<string, string>>({});
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
  // Attach mode: any active batch.
  const batchOptions = activeBatches.map((b) => ({
    value: b.id,
    label: b.customName || b.name,
    description: `${b.vesselName ?? "no vessel"} · ${b.currentVolume ?? "?"} ${b.currentVolumeUnit ?? "L"} · ${b.status}`,
  }));

  // "Start from cider": only batches sitting in a cellar vessel with liquid in
  // them (ready to use), filtered to the product type(s) the recipe declares.
  const parentReqTypes = inputs
    .filter((i) => i.kind === "parent_batch_requirement")
    .map((i) => i.sourceProductType)
    .filter((t): t is string => !!t);
  const parentCiderOptions = activeBatches
    .filter(
      (b) =>
        !!b.vesselName &&
        Number(b.currentVolume ?? 0) > 0 &&
        (parentReqTypes.length === 0 || parentReqTypes.includes(b.productType)),
    )
    .map((b) => ({
      value: b.id,
      label: `${b.customName || b.name} — ${b.vesselName}`,
      description: `${b.currentVolume ?? "?"} ${b.currentVolumeUnit ?? "L"} · ${b.productType} · ${b.status}`,
    }));

  const totalVolumeL = Number(totalVolumeStr) || 0;
  const kegVolumeL = Number(kegVolumeStr) || 0;
  const bottleVolumeL = Math.max(0, totalVolumeL - kegVolumeL);

  // Blend draws: each selected cider's volume must total the batch volume and
  // can't exceed what's on hand.
  const parentSumL = parentBatchIds.reduce((s, id) => s + (Number(parentVolumes[id]) || 0), 0);
  const blendMismatch =
    mode === "new" && hasParentReq && parentBatchIds.length > 0 && Math.abs(parentSumL - totalVolumeL) > 0.5;
  const parentOverdraw = parentBatchIds.some((id) => {
    const b = activeBatches.find((x) => x.id === id);
    return (Number(parentVolumes[id]) || 0) > Number(b?.currentVolume ?? 0) + 0.001;
  });

  const toggleParent = (id: string) =>
    setParentBatchIds((prev) => {
      if (prev.includes(id)) {
        setParentVolumes((v) => {
          const next = { ...v };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      // First cider added → default it to the whole batch volume; others blank.
      setParentVolumes((v) => ({ ...v, [id]: prev.length === 0 ? String(totalVolumeL || "") : "" }));
      return [...prev, id];
    });

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
    !blendMismatch &&
    !parentOverdraw &&
    !mutation.isPending;

  const submit = () => {
    mutation.mutate({
      recipeId: recipe.id,
      mode,
      startDate,
      totalVolumeL,
      kegVolumeL,
      parentBatches: parentBatchIds.map((id) => ({
        batchId: id,
        volumeL: Number(parentVolumes[id]) || 0,
      })),
      pressRunId: pressRunId ?? undefined,
      juicePurchaseItemId: juicePurchaseItemId ?? undefined,
      newBatchName: newBatchName.trim() || undefined,
      existingBatchId: existingBatchId ?? undefined,
      skippedStepIds: Array.from(skippedStepIds),
    });
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
                    <div className="space-y-1.5 my-1.5">
                      {parentBatchIds.map((id) => {
                        const b = activeBatches.find((x) => x.id === id);
                        const avail = Number(b?.currentVolume ?? 0);
                        const over = (Number(parentVolumes[id]) || 0) > avail + 0.001;
                        return (
                          <div key={id} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">
                              {b ? `${b.customName || b.name} — ${b.vesselName ?? "?"}` : id.slice(0, 8)}
                              <span className="text-xs text-muted-foreground ml-1">({avail.toFixed(0)} L avail)</span>
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={parentVolumes[id] ?? ""}
                              onChange={(e) => setParentVolumes((v) => ({ ...v, [id]: e.target.value }))}
                              className={`h-8 w-20 ${over ? "border-red-400" : ""}`}
                              placeholder="L"
                            />
                            <span className="text-xs text-muted-foreground">L</span>
                            <button type="button" onClick={() => toggleParent(id)}>
                              <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          </div>
                        );
                      })}
                      <p className={`text-[11px] ${blendMismatch ? "text-red-600" : "text-muted-foreground"}`}>
                        Blend total: {parentSumL.toFixed(0)} L of {totalVolumeL} L batch
                        {blendMismatch ? " — must equal the batch volume" : ""}
                        {parentOverdraw ? " · a draw exceeds what's on hand" : ""}
                      </p>
                    </div>
                  )}
                  <InlineBatchList
                    options={parentCiderOptions}
                    selectedIds={parentBatchIds}
                    onPick={toggleParent}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Ciders currently in a cellar vessel. Pick one for a single varietal, or
                    several to blend (set how much from each). Click again to remove.
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
                  placeholder={`${recipe.name} ${startDate.slice(0, 4)}-NNN`}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank to auto-name “{recipe.name} {startDate.slice(0, 4)}-NNN”,
                  where NNN is the next batch number for the year.
                </p>
              </div>
            </div>
          )}

          {/* Attach mode */}
          {mode === "attach" && (
            <div>
              <Label className="text-xs">Attach to batch</Label>
              <InlineBatchList
                options={batchOptions}
                selectedIds={existingBatchId ? [existingBatchId] : []}
                onPick={(id) => setExistingBatchId((cur) => (cur === id ? null : id))}
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
                value={totalVolumeStr}
                onChange={(e) => setTotalVolumeStr(e.target.value)}
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
                value={kegVolumeStr}
                onChange={(e) => setKegVolumeStr(e.target.value)}
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
