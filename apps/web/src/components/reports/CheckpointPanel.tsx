"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Info,
  Trash2,
  ChevronDown,
  Plus,
  PencilLine,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { handleTransactionError, showSuccess } from "@/utils/error-handling";
import { useIsAdmin } from "@/lib/auth/hooks";

// Tolerances mirror the server-side lock gate (completeReconciliation).
const PER_CLASS_TOL = 0.5; // gal — per tax class (POST-adjustment net)
const AGG_TOL = 1.0; // gal — aggregate unexplained (post manual-adjustment)
const DISPLAY_TOL = 0.05; // gal — hide near-zero rows from the breakdown

// Sentinel Select value for an aggregate (classless) adjustment. Radix Select
// disallows an empty-string item value, so use an explicit token.
const AGG_CLASS = "__aggregate__";

const WATERFALL_LINES = [
  { value: "opening", label: "Opening balance" },
  { value: "production", label: "Production" },
  { value: "losses", label: "Losses" },
  { value: "distillation", label: "Distillation" },
  { value: "other", label: "Other" },
] as const;

const SCOPE_OPTIONS = [
  { value: "both", label: "Both (form + checkpoint)" },
  { value: "form", label: "Annual form only" },
  { value: "checkpoint", label: "Checkpoint only" },
] as const;

function fmtGal(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

function netOf(w: any): number {
  return Number(w.netUnexplainedVariance ?? w.unexplainedVariance ?? 0);
}

interface CheckpointPanelProps {
  /** As-of date the summary was computed for (period end date). */
  asOfDate: string;
  /** Year the checkpoint's waterfall adjustments are stored under. */
  periodYear: number;
  /** getReconciliationSummary result for the current period (may be undefined while loading). */
  summary: any;
  /** Invalidate the parent's summary + batch list after a checkpoint write. */
  onChanged: () => void;
}

export function CheckpointPanel({
  asOfDate,
  periodYear,
  summary,
  onChanged,
}: CheckpointPanelProps) {
  const isAdmin = useIsAdmin();
  const utils = trpc.useContext();
  const searchParams = useSearchParams();

  // Amend context (set by the checkpoint-history "Amend" action, C5).
  const amendId = searchParams.get("amend");
  const amendAsOf = searchParams.get("amendAsOf");
  const isAmending = !!amendId;
  const amendDateMatches = !isAmending || amendAsOf === asOfDate;

  // ---- Derived status from the summary ----------------------------------
  const hasSummary = !!summary && summary.hasOpeningBalances !== false;
  const byTaxClass: any[] = summary?.waterfall?.byTaxClass ?? [];
  const totalUnexplained = Number(summary?.totals?.totalUnexplained ?? 0);
  const drift = summary?.checkpointDrift ?? null;
  const drifted = drift?.status === "drifted";

  // Over-tolerance is judged on the POST-adjustment NET (class-scoped accepts
  // net a class down; migration 0150).
  const overClasses = useMemo(
    () => byTaxClass.filter((w) => Math.abs(netOf(w)) > PER_CLASS_TOL),
    [byTaxClass],
  );
  const aggOver = Math.abs(totalUnexplained) > AGG_TOL;

  // Class options for the accept dialog (from the current waterfall rows).
  const classOptions = useMemo(
    () => byTaxClass.map((w) => ({ value: w.taxClass as string, label: (w.label ?? w.taxClass) as string })),
    [byTaxClass],
  );

  // Legacy vs post-Phase-6 drift: a legacy checkpoint has no variance_analysis
  // (compared on a physical-inventory basis) → neutral note, not a red alarm.
  const driftDetail = trpc.ttb.getReconciliationById.useQuery(
    { id: drift?.checkpointId ?? "" },
    { enabled: drifted && !!drift?.checkpointId },
  );
  const driftResolved = drifted && driftDetail.data !== undefined;
  const driftIsLegacy = driftResolved && (driftDetail.data as any)?.varianceAnalysis == null;
  const driftIsRed = driftResolved && (driftDetail.data as any)?.varianceAnalysis != null;

  const adjustments = trpc.ttb.listWaterfallAdjustments.useQuery({ periodYear });

  // Lockable = every class within per-class tolerance (net) AND aggregate within
  // tolerance AND no post-Phase-6 drift. (Legacy drift is informational only.)
  const lockable = hasSummary && overClasses.length === 0 && !aggOver && !driftIsRed;
  const attentionCount = overClasses.length + (aggOver ? 1 : 0);

  // ---- Accept-with-reason (createWaterfallAdjustment) --------------------
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptClass, setAcceptClass] = useState<string>(AGG_CLASS);
  const [acceptAmount, setAcceptAmount] = useState("");
  const [acceptLine, setAcceptLine] = useState<(typeof WATERFALL_LINES)[number]["value"]>("other");
  const [acceptReason, setAcceptReason] = useState("");
  const [acceptScope, setAcceptScope] = useState<(typeof SCOPE_OPTIONS)[number]["value"]>("both");
  const [acceptAdvanced, setAcceptAdvanced] = useState(false);

  const createAdjustment = trpc.ttb.createWaterfallAdjustment.useMutation({
    onSuccess: () => {
      utils.ttb.listWaterfallAdjustments.invalidate();
      onChanged();
      showSuccess("Variance Accepted", "Recorded a manual explanation for the residual.");
      setAcceptOpen(false);
      setAcceptReason("");
      setAcceptAdvanced(false);
    },
    onError: (error) => handleTransactionError(error, "Reconciliation", "Accept Variance"),
  });

  // Open the dialog prefilled to net a specific class (or the aggregate) to zero.
  // With an 'other' line the effect equals the amount, so amount = current net
  // drives that residual to ~0.
  const openAccept = (opts: { taxClass?: string; amount: number }) => {
    setAcceptClass(opts.taxClass ?? AGG_CLASS);
    setAcceptAmount(opts.amount.toFixed(2));
    setAcceptLine("other");
    setAcceptReason("");
    setAcceptScope("both");
    setAcceptAdvanced(false);
    setAcceptOpen(true);
  };

  const acceptAmountValid =
    acceptAmount !== "" && !isNaN(parseFloat(acceptAmount)) && parseFloat(acceptAmount) !== 0;
  const acceptReasonValid = acceptReason.trim().length >= 10;

  // ---- Soft-delete an accepted variance ---------------------------------
  const [deleteAdjId, setDeleteAdjId] = useState<string | null>(null);
  const deleteAdjustment = trpc.ttb.deleteWaterfallAdjustment.useMutation({
    onSuccess: () => {
      utils.ttb.listWaterfallAdjustments.invalidate();
      onChanged();
      showSuccess("Variance Removed", "The accepted variance was removed.");
      setDeleteAdjId(null);
    },
    onError: (error) => handleTransactionError(error, "Reconciliation", "Remove Variance"),
  });

  // ---- Complete & lock (completeReconciliation) -------------------------
  const [lockOpen, setLockOpen] = useState(false);
  const [lockPreview, setLockPreview] = useState<any>(null);

  const dryRunLock = trpc.ttb.completeReconciliation.useMutation({
    onSuccess: (result) => {
      setLockPreview(result);
      setLockOpen(true);
    },
    onError: (error) => handleTransactionError(error, "Reconciliation", "Preview Lock"),
  });

  const commitLock = trpc.ttb.completeReconciliation.useMutation({
    onSuccess: (result: any) => {
      if (result?.ok === false) {
        // Server is authoritative — over-tolerance blockers surfaced despite green.
        setLockPreview(result);
        return;
      }
      utils.ttb.getLastReconciliation.invalidate();
      utils.ttb.getReconciliationHistory.invalidate();
      onChanged();
      setLockOpen(false);
      setLockPreview(null);
      showSuccess(
        isAmending ? "Checkpoint Amended" : "Checkpoint Locked",
        `Your numbers are locked through ${fmtDate(asOfDate)}.`,
      );
    },
    onError: (error) => handleTransactionError(error, "Reconciliation", "Complete Reconciliation"),
  });

  const startLock = () => {
    setLockPreview(null);
    dryRunLock.mutate({ asOfDate, dryRun: true });
  };
  const confirmLock = () => {
    commitLock.mutate({
      asOfDate,
      ...(isAmending && amendId ? { amendsId: amendId } : {}),
    });
  };

  const previewBlockers: any[] = lockPreview?.blockers ?? [];
  const previewCheckpoint = lockPreview?.checkpoint ?? null;

  // ---- Status banner rendering ------------------------------------------
  let banner: React.ReactNode;
  if (!hasSummary) {
    banner = (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
        Reconciliation summary is not available for this period.
      </div>
    );
  } else if (driftIsRed) {
    banner = (
      <div className="flex items-start gap-2 text-sm text-red-700">
        <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <span>
          Records changed behind your locked {fmtDate(drift.checkpointDate)} checkpoint — review
          before trusting these numbers.
        </span>
      </div>
    );
  } else if (lockable) {
    banner = (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span>
          Reconciled through {fmtDate(asOfDate)} — inventory matches your records.
        </span>
      </div>
    );
  } else {
    banner = (
      <div className="flex items-center gap-2 text-sm text-amber-700">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span>
          {attentionCount} item{attentionCount !== 1 ? "s" : ""} need attention —{" "}
          {Math.abs(totalUnexplained).toFixed(1)} gal unexplained.
        </span>
      </div>
    );
  }

  return (
    <Card className="mb-4 border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gray-500" />
            Reconciliation Checkpoint
          </CardTitle>
          <div className="text-xs text-gray-500">
            As of <span className="font-medium text-gray-700">{fmtDate(asOfDate)}</span>
            <span className="text-gray-400"> · set by the period filter above</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAmending && (
          <div
            className={`flex items-start gap-2 text-xs rounded border px-2.5 py-2 ${
              amendDateMatches
                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <PencilLine className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {amendDateMatches ? (
              <span>
                Amending the {fmtDate(amendAsOf)} checkpoint. Re-run the numbers and lock to
                replace it with a corrected version.
              </span>
            ) : (
              <span>
                Amending the {fmtDate(amendAsOf)} checkpoint — set the period above to end on{" "}
                {fmtDate(amendAsOf)} to continue.
              </span>
            )}
          </div>
        )}

        {banner}

        {driftIsLegacy && (
          <div className="flex items-start gap-2 text-xs text-gray-600 rounded border border-gray-200 bg-gray-50 px-2.5 py-2">
            <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              Legacy checkpoint ({fmtDate(drift.checkpointDate)}) — compared on a
              physical-inventory basis. Lock a new checkpoint to reconcile on the current engine.
            </span>
          </div>
        )}

        {/* Variance breakdown — shown whenever there is something to explain. */}
        {hasSummary && !lockable && !driftIsRed && (
          <VarianceBreakdown
            byTaxClass={byTaxClass}
            totalUnexplained={totalUnexplained}
            aggOver={aggOver}
            onAcceptClass={(w) => openAccept({ taxClass: w.taxClass, amount: netOf(w) })}
            onAcceptAggregate={() => openAccept({ amount: totalUnexplained })}
          />
        )}

        {/* Accepted variances */}
        <AcceptedVariances
          rows={adjustments.data ?? []}
          classLabels={classOptions}
          onDelete={(id) => setDeleteAdjId(id)}
          deleting={deleteAdjustment.isPending}
        />

        {/* Complete & lock */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t">
          <p className="text-xs text-gray-500">
            {lockable
              ? "Ready to lock — this freezes your numbers through the as-of date."
              : "Resolve the items above before locking this checkpoint."}
          </p>
          <Button
            size="sm"
            onClick={startLock}
            disabled={
              !isAdmin ||
              !lockable ||
              !amendDateMatches ||
              dryRunLock.isPending ||
              commitLock.isPending
            }
            className="flex items-center gap-1.5"
            title={
              !isAdmin
                ? "Admin only"
                : !lockable
                  ? "Checkpoint is not within tolerance yet"
                  : undefined
            }
          >
            <Lock className="w-3.5 h-3.5" />
            {isAmending ? "Amend & lock" : "Complete & lock"}
          </Button>
        </div>
      </CardContent>

      {/* Accept-with-reason dialog */}
      <AlertDialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Accept variance with a reason
            </AlertDialogTitle>
            <AlertDialogDescription>
              Record a manual explanation for a residual you understand and stand behind. A
              class-scoped accept nets that tax class down (and the aggregate); an aggregate accept
              only moves the overall total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-sm">Applies to</Label>
              <Select value={acceptClass} onValueChange={setAcceptClass}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AGG_CLASS}>Aggregate (no class)</SelectItem>
                  {classOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Amount (gal, signed)</Label>
              <Input
                type="number"
                step="0.1"
                value={acceptAmount}
                onChange={(e) => setAcceptAmount(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Waterfall line</Label>
              <Select value={acceptLine} onValueChange={(v) => setAcceptLine(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WATERFALL_LINES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">
                Reason <span className="text-gray-400">(required, min 10 characters)</span>
              </Label>
              <Textarea
                value={acceptReason}
                onChange={(e) => setAcceptReason(e.target.value)}
                placeholder="e.g. Documented packaging-loss basis difference for hard cider"
                rows={2}
              />
            </div>
            <Collapsible open={acceptAdvanced} onOpenChange={setAcceptAdvanced}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${acceptAdvanced ? "" : "-rotate-90"}`}
                />
                Advanced
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Label className="text-sm">Surface</Label>
                <Select value={acceptScope} onValueChange={(v) => setAcceptScope(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                createAdjustment.mutate({
                  periodYear,
                  waterfallLine: acceptLine,
                  amountGallons: parseFloat(acceptAmount),
                  reason: acceptReason.trim(),
                  scope: acceptScope,
                  ...(acceptClass !== AGG_CLASS ? { taxClass: acceptClass as any } : {}),
                });
              }}
              disabled={!acceptAmountValid || !acceptReasonValid || createAdjustment.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createAdjustment.isPending ? "Saving…" : "Accept variance"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete accepted-variance confirm */}
      <AlertDialog
        open={deleteAdjId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteAdjId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Remove accepted variance?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the manual explanation. The residual it covered will reappear as
              unexplained until you accept or fix it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteAdjId) deleteAdjustment.mutate({ id: deleteAdjId });
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAdjustment.isPending}
            >
              {deleteAdjustment.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete & lock — dry-run preview */}
      <AlertDialog
        open={lockOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLockOpen(false);
            setLockPreview(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-700" />
              {isAmending ? "Amend checkpoint" : "Complete & lock reconciliation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Locks your numbers through {fmtDate(asOfDate)}. To change them later you&apos;ll create
              an amendment.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {previewBlockers.length > 0 ? (
            <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 space-y-1">
              <p className="font-semibold">Cannot lock — over tolerance:</p>
              {previewBlockers.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>
                    {b.kind === "aggregate"
                      ? "Aggregate unexplained"
                      : `${b.label ?? b.taxClass}`}
                  </span>
                  <span className="tabular-nums">
                    {fmtGal(b.unexplainedGal)} gal (tol {b.toleranceGal})
                  </span>
                </div>
              ))}
            </div>
          ) : previewCheckpoint ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Period</span>
                <span className="tabular-nums">
                  {fmtDate(previewCheckpoint.periodStartDate)} → {fmtDate(asOfDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Unexplained variance</span>
                <span className="tabular-nums">
                  {Math.abs(Number(previewCheckpoint.unexplainedVarianceGal ?? 0)).toFixed(2)} gal
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Accepted variances applied</span>
                <span className="tabular-nums">
                  {previewCheckpoint.acceptedAdjustmentIds?.length ?? 0}
                </span>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmLock();
              }}
              disabled={previewBlockers.length > 0 || commitLock.isPending}
            >
              {commitLock.isPending ? "Locking…" : isAmending ? "Amend & lock" : "Lock checkpoint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// -------------------------------------------------------------------------
function VarianceBreakdown({
  byTaxClass,
  totalUnexplained,
  aggOver,
  onAcceptClass,
  onAcceptAggregate,
}: {
  byTaxClass: any[];
  totalUnexplained: number;
  aggOver: boolean;
  onAcceptClass: (w: any) => void;
  onAcceptAggregate: () => void;
}) {
  // Show a row if raw, accepted, or net is non-trivial.
  const rows = byTaxClass.filter((w) => {
    const raw = Number(w.unexplainedVariance ?? 0);
    const accepted = Number(w.acceptedGal ?? 0);
    return Math.abs(raw) > DISPLAY_TOL || Math.abs(accepted) > DISPLAY_TOL;
  });

  return (
    <div className="rounded border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
      <p className="text-xs font-semibold uppercase text-amber-800">Unexplained variance</p>
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-7 text-xs">Tax class</TableHead>
              <TableHead className="h-7 text-xs text-right">Raw</TableHead>
              <TableHead className="h-7 text-xs text-right">Accepted</TableHead>
              <TableHead className="h-7 text-xs text-right">Net</TableHead>
              <TableHead className="h-7 text-xs text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => {
              const raw = Number(w.unexplainedVariance ?? 0);
              const accepted = Number(w.acceptedGal ?? 0);
              const net = netOf(w);
              const over = Math.abs(net) > PER_CLASS_TOL;
              return (
                <TableRow key={w.taxClass}>
                  <TableCell className="py-1 text-xs">{w.label ?? w.taxClass}</TableCell>
                  <TableCell className="py-1 text-xs text-right tabular-nums text-gray-600">
                    {fmtGal(raw)}
                  </TableCell>
                  <TableCell className="py-1 text-xs text-right tabular-nums text-gray-500">
                    {accepted !== 0 ? fmtGal(accepted) : "—"}
                  </TableCell>
                  <TableCell
                    className={`py-1 text-xs text-right tabular-nums ${
                      over ? "text-red-700 font-semibold" : "text-green-700"
                    }`}
                  >
                    {fmtGal(net)}
                  </TableCell>
                  <TableCell className="py-1 text-right">
                    {over ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAcceptClass(w)}
                        className="h-6 text-[11px] px-2"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Accept
                      </Button>
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 inline" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-xs text-amber-700">No per-class variance above {DISPLAY_TOL} gal.</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-amber-200 pt-2">
        <span className="text-xs text-amber-900">
          Aggregate unexplained residual:{" "}
          <span className="font-semibold tabular-nums">
            {Math.abs(totalUnexplained).toFixed(2)} gal
          </span>
          {aggOver && <span className="text-red-700"> (over {AGG_TOL} gal tolerance)</span>}
        </span>
        <Button size="sm" variant="outline" onClick={onAcceptAggregate} className="h-7 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Accept aggregate
        </Button>
      </div>
      <p className="text-[11px] text-amber-700">
        Prefer a per-class accept when a single tax class drives the residual; use the aggregate
        accept only when the driver is genuinely classless (e.g. rounding across classes). A
        per-class accept nets that class to green.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------
function AcceptedVariances({
  rows,
  classLabels,
  onDelete,
  deleting,
}: {
  rows: any[];
  classLabels: Array<{ value: string; label: string }>;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  if (!rows || rows.length === 0) return null;
  const labelFor = (taxClass: string | null) =>
    taxClass ? classLabels.find((c) => c.value === taxClass)?.label ?? taxClass : "Aggregate";
  return (
    <div className="rounded border border-gray-200 p-2.5 space-y-1.5">
      <p className="text-xs font-semibold uppercase text-gray-500">Accepted variances</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-7 text-xs">Applies to</TableHead>
            <TableHead className="h-7 text-xs">Line</TableHead>
            <TableHead className="h-7 text-xs text-right">Amount</TableHead>
            <TableHead className="h-7 text-xs">Reason</TableHead>
            <TableHead className="h-7 text-xs">Scope</TableHead>
            <TableHead className="h-7 text-xs">Date</TableHead>
            <TableHead className="h-7 w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="py-1 text-xs">
                {r.taxClass ? (
                  labelFor(r.taxClass)
                ) : (
                  <span className="text-gray-500">Aggregate</span>
                )}
              </TableCell>
              <TableCell className="py-1 text-xs capitalize">{r.waterfallLine}</TableCell>
              <TableCell className="py-1 text-xs text-right tabular-nums">
                {fmtGal(parseFloat(r.amountGallons ?? "0"))}
              </TableCell>
              <TableCell className="py-1 text-xs max-w-[200px] truncate" title={r.reason}>
                {r.reason}
              </TableCell>
              <TableCell className="py-1 text-xs">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {r.scope}
                </Badge>
              </TableCell>
              <TableCell className="py-1 text-xs text-gray-500">
                {r.adjustedAt ? new Date(r.adjustedAt).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="py-1">
                <button
                  onClick={() => onDelete(r.id)}
                  disabled={deleting}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
