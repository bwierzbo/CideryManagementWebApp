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
import { StepDetailModal } from "@/components/recipes/StepDetailModal";
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
  actualData: Record<string, unknown> | null;
};

export function BatchRecipeChecklist({ batchId }: { batchId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.recipeExecution.getForBatch.useQuery({ batchId });
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const refresh = () => utils.recipeExecution.getForBatch.invalidate({ batchId });
  const complete = trpc.recipeExecution.completeTask.useMutation({ onSuccess: refresh });
  const skip = trpc.recipeExecution.skipTask.useMutation({ onSuccess: refresh });
  const reopen = trpc.recipeExecution.reopenTask.useMutation({ onSuccess: refresh });

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
                  onClick={() => setOpenTask(t)}
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
    />
    </>
  );
}
