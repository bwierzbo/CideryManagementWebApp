"use client";

/**
 * Read-only recipe checklist for a batch (Phase 5, M1).
 *
 * Shows the scheduled per-step task list for a batch that was instantiated from
 * a recipe. M1 is read-only — completing/skipping tasks and the cross-batch
 * work queue come in M2/M3.
 */

import { trpc } from "@/utils/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-gray-300 text-gray-600",
  in_progress: "border-blue-300 text-blue-700",
  done: "border-green-300 text-green-700",
  skipped: "border-gray-200 text-gray-400",
};

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

export function BatchRecipeChecklist({ batchId }: { batchId: string }) {
  const { data, isLoading } = trpc.recipeExecution.getForBatch.useQuery({ batchId });

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

  const { execution, tasks } = data;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recipe checklist</CardTitle>
        <CardDescription>
          Recipe v{execution.recipeVersion} · started {fmtDate(execution.startDate)} ·{" "}
          {execution.bottleVolumeL ?? 0} L bottled / {execution.kegVolumeL ?? 0} L kegged ·{" "}
          {done}/{tasks.length} done
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">{t.sequence + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{t.label}</span>
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
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_STYLE[t.status] ?? ""}`}
                  >
                    {t.status.replace("_", " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
