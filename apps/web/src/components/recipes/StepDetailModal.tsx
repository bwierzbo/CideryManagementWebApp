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
  actualData: Record<string, unknown> | null;
}
interface Source {
  id: string;
  name: string;
  customName: string | null;
  vesselName: string | null;
  currentVolume: string | null;
  currentVolumeUnit: string | null;
}

export function StepDetailModal({
  open,
  onClose,
  batchId,
  task,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  batchId: string;
  task: Task | null;
  sources: Source[];
}) {
  const utils = trpc.useUtils();
  const ad = (task?.actualData ?? {}) as Record<string, unknown>;
  const [destVesselId, setDestVesselId] = useState<string | null>(
    (ad.destinationVesselId as string) ?? null,
  );
  const [vesselSearch, setVesselSearch] = useState("");
  const [notes, setNotes] = useState(task?.notes ?? "");

  const vesselsQuery = trpc.vessel.list.useQuery({}, { enabled: open && task?.kind === "transfer" });
  const vessels = vesselsQuery.data?.vessels ?? [];

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
  const filteredVessels = q
    ? vessels.filter((v) => (v.name ?? "").toLowerCase().includes(q))
    : vessels;

  // Measurement + additive steps open the SAME forms as the manual cellar flow;
  // completing one records the real operation and marks the step done.
  const useRealForm =
    !isDone &&
    (task.kind === "measurement" || task.kind === "add_additive" || task.kind === "pitch_yeast");
  const onRealSuccess = () => complete.mutate({ taskId: task.id });

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
            <AddBatchAdditiveForm batchId={batchId} onSuccess={onRealSuccess} onCancel={onClose} />
          )
        ) : (
          <div className="space-y-4">
            {/* Transfer: source + destination vessel (capture-first; real transfer wired next) */}
            {task.kind === "transfer" && (
              <>
                <div className="rounded-md bg-gray-50 border p-2.5 text-sm">
                  <p className="text-xs font-medium text-gray-500 mb-1">Source cider</p>
                  {sources.length === 0 ? (
                    <p className="text-muted-foreground">No source recorded.</p>
                  ) : (
                    sources.map((s) => (
                      <p key={s.id}>
                        {s.customName || s.name}
                        {s.vesselName ? ` — ${s.vesselName}` : ""}
                        {s.currentVolume ? ` (${s.currentVolume} ${s.currentVolumeUnit ?? "L"})` : ""}
                      </p>
                    ))
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
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {filteredVessels.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-2.5 py-3">No vessels found.</p>
                    ) : (
                      filteredVessels.map((v) => {
                        const selected = destVesselId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={isDone}
                            onClick={() => setDestVesselId(selected ? null : v.id)}
                            className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                              selected ? "bg-green-50" : ""
                            }`}
                          >
                            <span className="truncate">
                              {v.name}
                              <span className="text-xs text-muted-foreground ml-1">
                                {v.capacity} {v.capacityUnit} · {v.status}
                              </span>
                            </span>
                            {selected && <Check className="w-4 h-4 text-green-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
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
