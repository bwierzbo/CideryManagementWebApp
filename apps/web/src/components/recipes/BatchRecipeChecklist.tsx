"use client";

/**
 * Recipe checklist for a batch (Phase 5, M2).
 *
 * Shows the scheduled task list sorted by due-date (so parallel bottle/keg work
 * sits together) and lets the operator complete / skip / undo tasks. Soft
 * warnings only: completing out of order or skipping a non-optional step asks
 * for confirmation but never blocks. Completing a task reschedules the rest from
 * the actual completion time (server-side).
 */

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { StepDetailModal } from "@/components/recipes/StepDetailModal";
import { FilterModal } from "@/components/cellar/FilterModal";
import { CarbonateModal } from "@/components/batch/CarbonateModal";
import { UnifiedPackagingModal } from "@/components/packaging/UnifiedPackagingModal";
import { PasteurizeModal } from "@/components/packaging/PasteurizeModal";
import { LabelModal } from "@/components/packaging/LabelModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, SkipForward, RotateCcw } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-gray-300 text-gray-600",
  in_progress: "border-blue-300 text-blue-700",
  done: "border-green-300 text-green-700",
  skipped: "border-gray-200 text-gray-400",
};

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

type Task = {
  id: string;
  sequence: number;
  kind: string;
  label: string;
  description: string | null;
  packagingPath: string;
  isOptional: boolean;
  scheduledDate: string | Date | null;
  status: string;
  notes: string | null;
  actionData: Record<string, unknown> | null;
  actualData: Record<string, unknown> | null;
};

export function BatchRecipeChecklist({ batchId }: { batchId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.recipeExecution.getForBatch.useQuery({ batchId });
  const { data: batchData } = trpc.batch.get.useQuery({ batchId });
  const { data: runsData } = trpc.packaging.list.useQuery({ batchId });
  // Pasteurize/label apply to bottle runs (not keg fills). Union type → access
  // the run's fields loosely.
  const latestRun = ((runsData?.runs ?? []) as Array<Record<string, any>>)
    .filter((r) => r.source === "bottle_run")
    .sort(
      (a, b) =>
        new Date(b.packagedAt ?? b.createdAt).getTime() -
        new Date(a.packagedAt ?? a.createdAt).getTime(),
    )[0];
  const [openTask, setOpenTask] = useState<Task | null>(null);
  // filter/carbonate/package open the real cellar modals (need a vessel);
  // pasteurize/label open the packaging modals (need a packaging run).
  const [actionTask, setActionTask] = useState<Task | null>(null);

  const refresh = () => {
    utils.recipeExecution.getForBatch.invalidate({ batchId });
    utils.recipeExecution.listOpenTasks.invalidate();
  };
  const complete = trpc.recipeExecution.completeTask.useMutation({ onSuccess: refresh });
  const skip = trpc.recipeExecution.skipTask.useMutation({ onSuccess: refresh });
  const reopen = trpc.recipeExecution.reopenTask.useMutation({ onSuccess: refresh });

  const VESSEL_KINDS = new Set(["filter", "carbonate", "package"]);
  const RUN_KINDS = new Set(["pasteurize", "label"]);
  const currentVolumeL = batchData
    ? (batchData.currentVolumeUnit === "gal" ? 3.785411784 : 1) * Number(batchData.currentVolume ?? 0)
    : 0;
  const openStep = (t: Task) => {
    if (VESSEL_KINDS.has(t.kind)) {
      if (!batchData?.vesselId) {
        toast({
          title: "No vessel yet",
          description: "Do the Transfer step first — this action needs the batch in a vessel.",
        });
        return;
      }
      setActionTask(t);
      return;
    }
    if (RUN_KINDS.has(t.kind)) {
      if (!latestRun) {
        toast({
          title: "No packaging run yet",
          description: "Package the batch first — pasteurize/label apply to a packaging run.",
        });
        return;
      }
      setActionTask(t);
      return;
    }
    setOpenTask(t);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!data?.execution) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipe checklist</CardTitle>
          <CardDescription>
            No recipe is attached to this batch. Open a recipe and choose “Use this
            recipe” to generate a scheduled checklist.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { execution } = data;
  const tasks = data.tasks as Task[];
  const done = tasks.filter((t) => t.status === "done").length;
  const openBySeq = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");

  // Sorted by due-date (nulls last), tie-break by sequence — parallel work groups.
  const sorted = [...tasks].sort((a, b) => {
    const da = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
    const db_ = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
    return da - db_ || a.sequence - b.sequence;
  });

  const onComplete = (t: Task) => {
    const earlierOpen = openBySeq.some((o) => o.sequence < t.sequence);
    if (earlierOpen && !confirm("Earlier steps aren't done yet. Complete this one anyway?")) return;
    complete.mutate({ taskId: t.id });
  };
  const onSkip = (t: Task) => {
    if (!t.isOptional && !confirm("This step isn't marked optional. Skip it anyway?")) return;
    skip.mutate({ taskId: t.id });
  };

  const busy = complete.isPending || skip.isPending || reopen.isPending;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recipe checklist</CardTitle>
        <CardDescription>
          Recipe v{execution.recipeVersion} · started {fmtDate(execution.startDate)} ·{" "}
          {execution.bottleVolumeL ?? 0} L bottled / {execution.kegVolumeL ?? 0} L kegged ·{" "}
          {done}/{tasks.length} done · sorted by due date
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((t) => {
              const terminal = t.status === "done" || t.status === "skipped";
              return (
                <TableRow
                  key={t.id}
                  onClick={() => openStep(t)}
                  className={`cursor-pointer hover:bg-gray-50 ${terminal ? "opacity-60" : ""}`}
                >
                  <TableCell className="text-muted-foreground">{t.sequence + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={t.status === "done" ? "line-through" : ""}>{t.label}</span>
                      {t.packagingPath !== "all" && (
                        <Badge variant="outline" className="text-[10px]">
                          {t.packagingPath === "bottle" ? "Bottle only" : "Keg only"}
                        </Badge>
                      )}
                      {t.isOptional && (
                        <Badge variant="outline" className="text-[10px] text-gray-500">
                          Optional
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(t.scheduledDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[t.status] ?? ""}`}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {terminal ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => reopen.mutate({ taskId: t.id })}
                        title="Undo"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onComplete(t)}
                        >
                          <Check className="w-4 h-4 mr-1" /> Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => onSkip(t)}
                          title="Skip"
                        >
                          <SkipForward className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <StepDetailModal
      open={!!openTask}
      onClose={() => setOpenTask(null)}
      batchId={batchId}
      task={openTask}
      sources={data.sources ?? []}
      plannedVolumeL={
        Number(execution.bottleVolumeL ?? 0) + Number(execution.kegVolumeL ?? 0)
      }
      ingredients={data.ingredients ?? []}
    />

    {/* Real cellar action modals — completing one marks the recipe step done. */}
    {batchData?.vesselId && (
      <>
        <FilterModal
          open={actionTask?.kind === "filter"}
          onClose={() => setActionTask(null)}
          vesselId={batchData.vesselId}
          vesselName={batchData.vesselName ?? ""}
          batchId={batchId}
          currentVolumeL={currentVolumeL}
          prefillFilterType={
            /coarse/i.test(actionTask?.label ?? "")
              ? "coarse"
              : /sterile/i.test(actionTask?.label ?? "")
                ? "sterile"
                : "fine"
          }
          onSuccess={() => actionTask && complete.mutate({ taskId: actionTask.id })}
        />
        <CarbonateModal
          open={actionTask?.kind === "carbonate"}
          onOpenChange={(o) => !o && setActionTask(null)}
          batch={{
            id: batchId,
            name: batchData.name ?? "",
            vesselId: batchData.vesselId,
            currentVolume: Number(batchData.currentVolume ?? 0),
            currentVolumeUnit: batchData.currentVolumeUnit ?? "L",
            status: batchData.status ?? "",
          }}
          vessel={{
            id: batchData.vesselId,
            name: batchData.vesselName ?? "",
            isPressureVessel: batchData.vesselIsPressureVessel === "yes" ? "yes" : "no",
            maxPressure: Number(batchData.vesselMaxPressure ?? 30),
          }}
          prefillTargetCo2Volumes={
            typeof actionTask?.actionData?.targetCo2Volumes === "number"
              ? (actionTask.actionData.targetCo2Volumes as number)
              : undefined
          }
          prefillMethod={
            actionTask?.actionData?.method === "natural"
              ? "natural"
              : actionTask?.actionData?.method === "forced"
                ? "forced"
                : undefined
          }
          onSuccess={() => actionTask && complete.mutate({ taskId: actionTask.id })}
        />
        <UnifiedPackagingModal
          open={actionTask?.kind === "package"}
          onClose={() => setActionTask(null)}
          vesselId={batchData.vesselId}
          vesselName={batchData.vesselName ?? ""}
          batchId={batchId}
          currentVolumeL={currentVolumeL}
          initialType={actionTask?.packagingPath === "keg" ? "kegs" : "bottles"}
          onSuccess={() => actionTask && complete.mutate({ taskId: actionTask.id })}
        />
      </>
    )}

    {/* Pasteurize / label operate on the batch's latest packaging run. */}
    {latestRun && (
      <>
        <PasteurizeModal
          open={actionTask?.kind === "pasteurize"}
          onClose={() => setActionTask(null)}
          bottleRunId={latestRun.id}
          bottleRunName={`${latestRun.batch?.name ?? "Run"} — ${new Date(latestRun.packagedAt ?? latestRun.createdAt).toLocaleDateString()}`}
          batchId={batchId}
          unitsProduced={Number(latestRun.unitsProduced ?? 0)}
          onSuccess={() => actionTask && complete.mutate({ taskId: actionTask.id })}
        />
        <LabelModal
          open={actionTask?.kind === "label"}
          onClose={() => setActionTask(null)}
          bottleRunId={latestRun.id}
          bottleRunName={`${latestRun.batch?.name ?? "Run"} — ${new Date(latestRun.packagedAt ?? latestRun.createdAt).toLocaleDateString()}`}
          unitsProduced={Number(latestRun.unitsProduced ?? 0)}
          unitsLabeled={Number(latestRun.unitsLabeled ?? 0)}
          onSuccess={() => actionTask && complete.mutate({ taskId: actionTask.id })}
        />
      </>
    )}
    </>
  );
}
