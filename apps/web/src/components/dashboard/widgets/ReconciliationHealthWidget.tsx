"use client";

import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/auth/hooks";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

type HealthStatus = "clean" | "attention" | "drift";

const STATUS_STYLES: Record<
  HealthStatus,
  { bg: string; text: string; icon: React.ReactNode; headline: string }
> = {
  clean: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    headline: "Reconciled clean",
  },
  attention: {
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-800",
    icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    headline: "Items need attention",
  },
  drift: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
    headline: "Drift detected",
  },
};

/**
 * Reconciliation Health Widget (Phase 5)
 *
 * Shows the latest automated/manual reconciliation health check: clean /
 * attention / drift, with the relative time it was last checked. Links to the
 * reconciliation report. Admins get a "Run check now" button so it works locally
 * without the nightly cron.
 */
export function ReconciliationHealthWidget({ compact, onRefresh }: WidgetProps) {
  const isAdmin = useIsAdmin();
  const utils = trpc.useUtils();
  const { data, isPending, isFetching, refetch } =
    trpc.ttb.getReconciliationHealth.useQuery({ limit: 5 });

  const runCheck = trpc.ttb.runReconciliationHealthCheck.useMutation({
    onSuccess: () => {
      utils.ttb.getReconciliationHealth.invalidate();
    },
  });

  const latest = data?.latest ?? null;
  const status = (latest?.status as HealthStatus | undefined) ?? undefined;

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const detailLines: string[] = [];
  if (latest) {
    if (latest.perBatchFailCount > 0)
      detailLines.push(`${latest.perBatchFailCount} batch(es) failing reconciliation`);
    if (latest.perBatchWarnCount > 0)
      detailLines.push(`${latest.perBatchWarnCount} batch(es) with warnings`);
    if (latest.totalUnexplainedGal != null) {
      const gal = Number(latest.totalUnexplainedGal);
      if (Math.abs(gal) > 1.0)
        detailLines.push(`${gal.toFixed(1)} gal unexplained variance`);
    }
    if (latest.checkpointDriftStatus === "drifted")
      detailLines.push("Checkpoint drift — history changed under a locked checkpoint");
    const filed = (latest.filedDrift ?? {}) as Record<string, { status: string }>;
    for (const [year, fd] of Object.entries(filed)) {
      if (fd.status === "new_drift") detailLines.push(`New drift vs filed ${year}`);
    }
  }

  return (
    <WidgetWrapper
      title="Reconciliation Health"
      icon={ShieldCheck}
      compact={compact}
      isLoading={isPending}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={!latest}
      emptyState={
        <div className="text-center py-4">
          <ShieldCheck className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600 font-medium">Not yet checked</p>
          <p className="text-xs text-gray-500 mb-3">
            Run a reconciliation health check to see status here.
          </p>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => runCheck.mutate({ trigger: "manual" })}
              disabled={runCheck.isPending}
            >
              <RefreshCw
                className={cn("w-3 h-3 mr-1", runCheck.isPending && "animate-spin")}
              />
              Run check now
            </Button>
          )}
        </div>
      }
    >
      {latest && status && (
        <div className="space-y-3">
          <Link href="/reports/reconciliation">
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 hover:opacity-80 transition-opacity cursor-pointer",
                STATUS_STYLES[status].bg,
              )}
            >
              <div className="shrink-0 mt-0.5">{STATUS_STYLES[status].icon}</div>
              <div className="min-w-0">
                <p className={cn("font-medium text-sm", STATUS_STYLES[status].text)}>
                  {STATUS_STYLES[status].headline}
                </p>
                <p className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Last checked{" "}
                  {formatDistanceToNow(new Date(latest.ranAt), { addSuffix: true })}
                </p>
                {detailLines.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {detailLines.map((line, i) => (
                      <li key={i} className="text-xs text-gray-600">
                        • {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Link>

          {status === "drift" && (
            <p className="text-xs text-red-700 font-medium">
              Review before trusting reports.
            </p>
          )}

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => runCheck.mutate({ trigger: "manual" })}
              disabled={runCheck.isPending}
            >
              <RefreshCw
                className={cn("w-3 h-3 mr-1", runCheck.isPending && "animate-spin")}
              />
              {runCheck.isPending ? "Running check…" : "Run check now"}
            </Button>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.RECONCILIATION_HEALTH,
  title: "Reconciliation Health",
  description: "Latest automated reconciliation check — clean, attention, or drift",
  icon: ShieldCheck,
  category: "reports",
  component: ReconciliationHealthWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md", "lg"],
  supportsRefresh: true,
  defaultRefreshInterval: 300000, // 5 minutes
};

registerWidget(config);
