"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PencilLine,
  Info,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { handleTransactionError } from "@/utils/error-handling";
import { useIsAdmin } from "@/lib/auth/hooks";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const s = typeof d === "string" ? d : d.toISOString();
  return s.slice(0, 10);
}

/**
 * Checkpoint history (Phase 6 C5). Lists locked reconciliation checkpoints from
 * getReconciliationHistory with drill-in (taxClassBreakdown + variance analysis)
 * and an Amend action that routes to the live reconciliation page to re-lock.
 */
export function CheckpointHistory() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const history = trpc.ttb.getReconciliationHistory.useQuery({ limit: 50, offset: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const amend = trpc.ttb.amendCheckpoint.useMutation({
    onSuccess: (res) => {
      const params = new URLSearchParams();
      params.set("amend", res.amendsId);
      params.set("amendAsOf", res.prefill.asOfDate);
      router.push(`/reports/reconciliation?${params.toString()}`);
    },
    onError: (error) => handleTransactionError(error, "Checkpoint", "Amend"),
  });

  const rows = history.data?.snapshots ?? [];

  // id → reconciliationDate, to render "Amended by {date}" on superseded rows.
  const dateById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.id, fmtDate(r.reconciliationDate));
    return m;
  }, [rows]);

  // Only the latest finalized, non-superseded checkpoint may be amended.
  const latestAmendableId = useMemo(
    () => rows.find((r) => r.status === "finalized" && !r.supersededBy)?.id ?? null,
    [rows],
  );

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <History className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Checkpoint History</CardTitle>
            <CardDescription>
              Locked reconciliation checkpoints, newest first. Expand a row to review its
              tax-class breakdown and variance evidence.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {history.isLoading ? (
          <p className="text-sm text-gray-500">Loading checkpoints…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">
            No checkpoints locked yet. Lock one from the reconciliation page to start a history.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Unexplained (gal)
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Basis</TableHead>
                  <TableHead className="text-xs font-semibold"></TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const expanded = expandedId === r.id;
                  const superseded = !!r.supersededBy;
                  const canAmend = isAdmin && r.id === latestAmendableId;
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow className={superseded ? "opacity-70" : undefined}>
                        <TableCell className="py-1">
                          <button
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                            className="text-gray-400 hover:text-gray-700"
                            title={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="py-1 text-sm font-medium">
                          {fmtDate(r.reconciliationDate)}
                          {r.name && (
                            <span className="text-gray-400 font-normal"> · {r.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-sm">
                          {r.status === "finalized" ? (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <CheckCircle className="w-3.5 h-3.5" /> Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" /> {r.status}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-sm text-right tabular-nums">
                          {r.unexplainedVarianceGal != null
                            ? Math.abs(r.unexplainedVarianceGal).toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell className="py-1 text-xs">
                          {r.isLegacy ? (
                            <Badge
                              variant="outline"
                              className="bg-gray-100 text-gray-600 border-gray-300 text-[10px] px-1.5 py-0 h-4"
                            >
                              legacy basis
                            </Badge>
                          ) : (
                            <span className="text-gray-400">engine</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-xs">
                          {superseded && (
                            <Badge
                              variant="outline"
                              className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0 h-4"
                            >
                              Amended by {dateById.get(r.supersededBy!) ?? "—"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-right">
                          {canAmend && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => amend.mutate({ checkpointId: r.id })}
                              disabled={amend.isPending}
                            >
                              <PencilLine className="w-3.5 h-3.5 mr-1" />
                              Amend
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-gray-50 p-3">
                            <CheckpointDetail id={r.id} isLegacy={r.isLegacy} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------------
function CheckpointDetail({ id, isLegacy }: { id: string; isLegacy: boolean }) {
  const detail = trpc.ttb.getReconciliationById.useQuery({ id });
  if (detail.isLoading) {
    return <p className="text-xs text-gray-500">Loading checkpoint detail…</p>;
  }
  if (!detail.data) {
    return <p className="text-xs text-gray-500">Detail unavailable.</p>;
  }
  const d = detail.data as any;
  const breakdown: any[] = Array.isArray(d.taxClassBreakdown) ? d.taxClassBreakdown : [];
  const va = d.varianceAnalysis ?? null;
  const totalUnexplained =
    va?.totalUnexplainedGal != null
      ? Number(va.totalUnexplainedGal)
      : d.unexplainedVarianceGal != null
        ? Number(d.unexplainedVarianceGal)
        : null;

  return (
    <div className="space-y-3">
      {isLegacy && (
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          <span>Legacy checkpoint — compared on a physical-inventory basis.</span>
        </div>
      )}

      {breakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
            Tax-class breakdown (gal)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-xs">Tax class</TableHead>
                <TableHead className="h-7 text-xs text-right">Calculated</TableHead>
                <TableHead className="h-7 text-xs text-right">Physical</TableHead>
                <TableHead className="h-7 text-xs text-right">Unexplained</TableHead>
                <TableHead className="h-7 text-xs text-right">Accepted</TableHead>
                <TableHead className="h-7 text-xs text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((w, i) => {
                const unexp = Number(w.unexplainedVariance ?? 0);
                const accepted = Number(w.acceptedGal ?? 0);
                const net =
                  w.netUnexplainedVariance != null
                    ? Number(w.netUnexplainedVariance)
                    : unexp - accepted;
                const over = Math.abs(net) > 0.5;
                const sgn = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
                return (
                  <TableRow key={w.key ?? w.taxClass ?? i}>
                    <TableCell className="py-1 text-xs">{w.label ?? w.key ?? w.taxClass}</TableCell>
                    <TableCell className="py-1 text-xs text-right tabular-nums">
                      {w.calculatedEnding != null ? Number(w.calculatedEnding).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="py-1 text-xs text-right tabular-nums">
                      {w.physical != null
                        ? Number(w.physical).toFixed(1)
                        : w.currentInventory != null
                          ? Number(w.currentInventory).toFixed(1)
                          : "—"}
                    </TableCell>
                    <TableCell className="py-1 text-xs text-right tabular-nums text-gray-600">
                      {sgn(unexp)}
                    </TableCell>
                    <TableCell className="py-1 text-xs text-right tabular-nums text-gray-500">
                      {accepted !== 0 ? sgn(accepted) : "—"}
                    </TableCell>
                    <TableCell
                      className={`py-1 text-xs text-right tabular-nums ${
                        over ? "text-red-700 font-semibold" : "text-gray-600"
                      }`}
                    >
                      {sgn(net)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalUnexplained != null && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 flex justify-between">
          <span className="font-semibold uppercase">Total unexplained at lock</span>
          <span className="tabular-nums">{Math.abs(totalUnexplained).toFixed(2)} gal</span>
        </div>
      )}

      {breakdown.length === 0 && totalUnexplained == null && (
        <p className="text-xs text-gray-500">No stored breakdown for this checkpoint.</p>
      )}
    </div>
  );
}
