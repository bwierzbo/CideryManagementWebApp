"use client";

/**
 * Cross-batch work queue (Phase 5, M2).
 *
 * Every open recipe task across all active batches, grouped by due-date
 * (Overdue / Today / This week / Upcoming / No date) and time-ordered. Complete
 * or skip from here; both reuse the same mutations as the per-batch checklist
 * and reschedule downstream work. The pre-filled action modals come in M3 — for
 * now a task is completed as a checkmark.
 */

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, SkipForward, ListChecks } from "lucide-react";

type QueueTask = {
  id: string;
  batchId: string;
  batchName: string;
  batchCustomName: string | null;
  label: string;
  packagingPath: string;
  isOptional: boolean;
  scheduledDate: string | null;
  status: string;
};

type Bucket = "overdue" | "today" | "week" | "upcoming" | "none";

const BUCKETS: { key: Bucket; title: string; tone: string }[] = [
  { key: "overdue", title: "Overdue", tone: "text-red-700" },
  { key: "today", title: "Today", tone: "text-blue-700" },
  { key: "week", title: "This week", tone: "text-gray-800" },
  { key: "upcoming", title: "Upcoming", tone: "text-gray-500" },
  { key: "none", title: "No scheduled date (operator-driven)", tone: "text-gray-500" },
];

export default function WorkQueuePage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.recipeExecution.listOpenTasks.useQuery();
  const refresh = () => utils.recipeExecution.listOpenTasks.invalidate();
  const complete = trpc.recipeExecution.completeTask.useMutation({ onSuccess: refresh });
  const skip = trpc.recipeExecution.skipTask.useMutation({ onSuccess: refresh });
  const busy = complete.isPending || skip.isPending;

  const grouped = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);
    const bucketOf = (d: string | null): Bucket => {
      if (!d) return "none";
      const t = new Date(d);
      if (t < startToday) return "overdue";
      if (t < endToday) return "today";
      if (t < endWeek) return "week";
      return "upcoming";
    };
    const out: Record<Bucket, QueueTask[]> = {
      overdue: [], today: [], week: [], upcoming: [], none: [],
    };
    for (const t of (data?.tasks ?? []) as QueueTask[]) out[bucketOf(t.scheduledDate)].push(t);
    return out;
  }, [data]);

  const total = data?.tasks?.length ?? 0;

  const onSkip = (t: QueueTask) => {
    if (!t.isOptional && !confirm("This step isn't marked optional. Skip it anyway?")) return;
    skip.mutate({ taskId: t.id });
  };

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-semibold">Work queue</h1>
          <Badge variant="secondary" className="ml-1">{total}</Badge>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No open recipe tasks. Start a recipe from the Recipes page to populate the queue.
            </CardContent>
          </Card>
        ) : (
          BUCKETS.filter((b) => grouped[b.key].length > 0).map((b) => (
            <Card key={b.key}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-semibold ${b.tone}`}>
                  {b.title} · {grouped[b.key].length}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {grouped[b.key].map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{t.label}</span>
                        {t.packagingPath !== "all" && (
                          <Badge variant="outline" className="text-[10px]">
                            {t.packagingPath === "bottle" ? "Bottle only" : "Keg only"}
                          </Badge>
                        )}
                        {t.isOptional && (
                          <Badge variant="outline" className="text-[10px] text-gray-500">Optional</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <Link href={`/batch/${t.batchId}`} className="hover:underline">
                          {t.batchCustomName || t.batchName}
                        </Link>{" "}
                        · due {fmtDate(t.scheduledDate)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => complete.mutate({ taskId: t.id })}
                      >
                        <Check className="w-4 h-4 mr-1" /> Done
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onSkip(t)} title="Skip">
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
