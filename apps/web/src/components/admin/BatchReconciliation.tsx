"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Clock,
  Search,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  ClipboardCheck,
  ArrowLeft,
  CornerDownRight,
  ExternalLink,
  RotateCcw,
  EyeOff,
  Copy,
  Lock,
  Unlock,
  History,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import {
  handleTransactionError,
  showSuccess,
  showLoading,
} from "@/utils/error-handling";
import { litersToWineGallons } from "lib/src/calculations/ttb";

const PRODUCT_TYPES = [
  { value: "cider", label: "Cider" },
  { value: "perry", label: "Perry" },
  { value: "brandy", label: "Brandy" },
  { value: "pommeau", label: "Pommeau" },
  { value: "juice", label: "Juice" },
  { value: "other", label: "Other" },
] as const;

type SortField = "name" | "productType" | "startDate" | "initialVolumeLiters" | "currentVolumeLiters" | "gallons" | "vesselName" | "validation";
type SortDirection = "asc" | "desc";

function getProductTypeBadge(productType: string) {
  const colors: Record<string, string> = {
    cider: "bg-amber-100 text-amber-800",
    perry: "bg-lime-100 text-lime-800",
    brandy: "bg-purple-100 text-purple-800",
    pommeau: "bg-rose-100 text-rose-800",
    juice: "bg-blue-100 text-blue-800",
    other: "bg-gray-100 text-gray-800",
  };
  return (
    <Badge variant="outline" className={colors[productType] || colors.other}>
      {productType}
    </Badge>
  );
}

function formatVolume(liters: string | null): string {
  if (!liters) return "0";
  const val = parseFloat(liters);
  return val.toFixed(1);
}

function formatGallons(liters: string | null): string {
  if (!liters) return "0";
  const val = parseFloat(liters);
  return litersToWineGallons(val).toFixed(2);
}

type ReconciliationStatus = "verified" | "pending" | "duplicate" | "excluded";

function ValidationStatusMenu({
  batch,
  onForceVerify,
  onResetToPending,
  onSetStatus,
  disabled,
}: {
  batch: any;
  onForceVerify: (batchId: string) => void;
  onResetToPending: (batchId: string) => void;
  onSetStatus: (batchId: string, status: ReconciliationStatus) => void;
  disabled: boolean;
}) {
  const validation = batch.validation;
  const isVerified = batch.verifiedForYear === true;

  // Build the status label
  let icon: React.ReactNode;
  let label: string;
  let colorClass: string;

  if (isVerified) {
    const hasOverrides = validation && validation.status !== "pass";
    icon = <ShieldCheck className={`w-4 h-4 ${hasOverrides ? "text-blue-400" : "text-blue-500"}`} />;
    label = hasOverrides ? "Verified (override)" : "Verified";
    colorClass = hasOverrides ? "text-blue-500" : "text-blue-600";
  } else if (!validation) {
    icon = <Clock className="w-4 h-4 text-gray-400" />;
    label = "Pending";
    colorClass = "text-gray-500";
  } else if (validation.status === "pass") {
    icon = <CheckCircle className="w-4 h-4 text-green-500" />;
    label = "Passing";
    colorClass = "text-green-600";
  } else if (validation.status === "warning") {
    const count = validation.checks.filter((c: any) => c.status === "warning").length;
    icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
    label = `${count} warning${count !== 1 ? "s" : ""}`;
    colorClass = "text-amber-600";
  } else {
    const failCount = validation.checks.filter((c: any) => c.status === "fail").length;
    icon = <XCircle className="w-4 h-4 text-red-500" />;
    label = `${failCount} issue${failCount !== 1 ? "s" : ""}`;
    colorClass = "text-red-600";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button className="flex items-center gap-1.5 hover:opacity-70 transition-opacity rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-gray-100">
          {icon}
          <span className={`text-xs ${colorClass}`}>{label}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Actions depend on current state */}
        {isVerified ? (
          <DropdownMenuItem onClick={() => onResetToPending(batch.id)}>
            <RotateCcw className="w-3.5 h-3.5 mr-2 text-gray-500" />
            Reset to Pending
          </DropdownMenuItem>
        ) : (
          <>
            {validation?.status === "warning" && (
              <>
                <DropdownMenuItem onClick={() => onForceVerify(batch.id)}>
                  <ShieldCheck className="w-3.5 h-3.5 mr-2 text-blue-500" />
                  Force Verify
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onSetStatus(batch.id, "excluded")}>
              <EyeOff className="w-3.5 h-3.5 mr-2 text-gray-500" />
              Exclude from TTB
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetStatus(batch.id, "duplicate")}>
              <Copy className="w-3.5 h-3.5 mr-2 text-gray-500" />
              Mark as Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onResetToPending(batch.id)}>
              <RotateCcw className="w-3.5 h-3.5 mr-2 text-gray-500" />
              Reset to Pending
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VolumeAuditPanel({ batchId }: { batchId: string }) {
  const { data: auditEntries, isLoading } = trpc.ttb.getBatchVolumeAudit.useQuery(
    { batchId },
  );

  if (isLoading) {
    return <div className="text-xs text-gray-400 py-2">Loading volume history...</div>;
  }

  if (!auditEntries || auditEntries.length === 0) {
    return <div className="text-xs text-gray-400 py-2">No volume changes recorded.</div>;
  }

  return (
    <div className="py-2">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase">Volume History</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1 pr-3">Date</th>
            <th className="text-left py-1 pr-3">Field</th>
            <th className="text-right py-1 pr-3">Old</th>
            <th className="text-center py-1 pr-3"></th>
            <th className="text-right py-1 pr-3">New</th>
            <th className="text-left py-1 pl-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {auditEntries.map((entry: any) => (
            <tr key={entry.id} className="border-b border-gray-100">
              <td className="py-1 pr-3 text-gray-600">
                {entry.changedAt
                  ? new Date(entry.changedAt).toLocaleDateString()
                  : "—"}
              </td>
              <td className="py-1 pr-3 text-gray-700 font-medium">{entry.fieldName}</td>
              <td className="py-1 pr-3 text-right font-mono text-gray-500">
                {entry.oldValue ?? "—"}
              </td>
              <td className="py-1 pr-3 text-center text-gray-400">&rarr;</td>
              <td className="py-1 pr-3 text-right font-mono text-gray-700">
                {entry.newValue ?? "—"}
              </td>
              <td className="py-1 pl-3 text-gray-400">{entry.changeSource || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandableReconciliationRow({
  batch,
  selectedIds,
  toggleSelect,
  handleDeleteClick,
  onForceVerify,
  onResetToPending,
  onSetStatus,
  isVerifying,
}: {
  batch: any;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  handleDeleteClick: (batch: any) => void;
  onForceVerify: (batchId: string) => void;
  onResetToPending: (batchId: string) => void;
  onSetStatus: (batchId: string, status: ReconciliationStatus) => void;
  isVerifying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = batch.children && batch.children.length > 0;
  const validation = batch.validation;
  const hasIssues = validation && validation.status !== "pass";
  const isExpandable = hasChildren || hasIssues;

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.closest('[role="checkbox"]') ||
      target.closest('[role="combobox"]')
    ) {
      return;
    }
    if (isExpandable) {
      setExpanded(!expanded);
    }
  };

  const nonPassChecks = validation?.checks?.filter((c: any) => c.status !== "pass") || [];

  return (
    <>
      <TableRow
        className={isExpandable ? "cursor-pointer hover:bg-muted/50" : undefined}
        onClick={handleRowClick}
      >
        <TableCell>
          <div className="flex items-center gap-1">
            {isExpandable && (
              expanded
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <Checkbox
              checked={selectedIds.has(batch.id)}
              onCheckedChange={() => toggleSelect(batch.id)}
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/batch/${batch.id}`}
                className="font-medium text-sm text-blue-700 hover:text-blue-900 hover:underline"
              >
                {batch.customName || batch.name}
              </Link>
              {batch.volumeManuallyCorrected && (
                <span title="Volume manually corrected">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                </span>
              )}
              {batch.category === "carried_forward" && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0 h-4">
                  Carried Forward
                </Badge>
              )}
            </div>
            <span className="text-xs text-gray-500">{batch.batchNumber}</span>
            {hasChildren && !expanded && (
              <span className="text-xs text-gray-400 mt-0.5">
                ({batch.children.length} transfer-derived batch{batch.children.length !== 1 ? "es" : ""})
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{getProductTypeBadge(batch.productType)}</TableCell>
        <TableCell className="text-sm">
          {batch.startDate
            ? new Date(batch.startDate).toLocaleDateString()
            : "N/A"}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatVolume(batch.initialVolumeLiters)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatVolume(batch.currentVolumeLiters)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatGallons(batch.currentVolumeLiters)}
        </TableCell>
        <TableCell className="text-sm text-gray-600">
          {batch.vesselName || "—"}
        </TableCell>
        <TableCell>
          <ValidationStatusMenu
            batch={batch}
            onForceVerify={onForceVerify}
            onResetToPending={onResetToPending}
            onSetStatus={onSetStatus}
            disabled={isVerifying}
          />
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteClick(batch)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
            title="Delete batch"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Validation details */}
      {expanded && nonPassChecks.length > 0 && (
        <TableRow className={validation.status === "fail" ? "bg-red-50/30" : "bg-amber-50/30"}>
          <TableCell></TableCell>
          <TableCell colSpan={8}>
            <div className="py-2 space-y-1.5">
              {nonPassChecks.map((check: any) => (
                <div key={check.id} className="flex items-start gap-2 text-sm">
                  {check.status === "fail" ? (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700 font-medium">{check.message}</span>
                    {check.details && (
                      <span className="text-gray-500 ml-1">— {check.details}</span>
                    )}
                  </div>
                  {check.link && (
                    <Link
                      href={check.link}
                      className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-0.5 flex-shrink-0"
                    >
                      Fix <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      )}

      {/* Volume Audit Trail */}
      {expanded && (
        <TableRow className="bg-gray-50/30">
          <TableCell></TableCell>
          <TableCell colSpan={8}>
            <VolumeAuditPanel batchId={batch.id} />
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      )}

      {/* Child batches */}
      {expanded && batch.children?.map((child: any) => (
        <TableRow key={child.id} className="bg-muted/30">
          <TableCell></TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <CornerDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex flex-col">
                <Link
                  href={`/batch/${child.id}`}
                  className="font-medium text-sm text-gray-600 hover:text-gray-900 hover:underline"
                >
                  {child.customName || child.name}
                </Link>
                <span className="text-xs text-gray-400">{child.batchNumber}</span>
              </div>
            </div>
          </TableCell>
          <TableCell>{child.productType ? getProductTypeBadge(child.productType) : "—"}</TableCell>
          <TableCell className="text-sm text-gray-500">
            {child.startDate
              ? new Date(child.startDate).toLocaleDateString()
              : "N/A"}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums text-gray-500">
            {formatVolume(child.initialVolumeLiters)}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums text-gray-500">
            {formatVolume(child.currentVolumeLiters)}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums text-gray-500">
            {formatGallons(child.currentVolumeLiters)}
          </TableCell>
          <TableCell className="text-sm text-gray-400">
            {child.vesselName || "—"}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="bg-gray-50 text-gray-500 text-xs">
              Auto-excluded
            </Badge>
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function BatchReconciliation() {
  const { data: session } = useSession();
  const utils = trpc.useContext();

  // Filters
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<any>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // TTB Preview
  const [ttbPreviewOpen, setTtbPreviewOpen] = useState(false);

  // Query
  const queryInput = useMemo(() => ({
    year: yearFilter,
    productType: productTypeFilter !== "all" ? productTypeFilter as any : undefined,
    reconciliationStatus: statusFilter !== "all" ? statusFilter as any : undefined,
    search: searchQuery || undefined,
  }), [yearFilter, productTypeFilter, statusFilter, searchQuery]);

  const { data, isLoading } = trpc.batch.listForReconciliation.useQuery(queryInput);

  // TTB reconciliation summary - always loaded for banner + preview
  const { data: reconciliationData } = trpc.ttb.getReconciliationSummary.useQuery(
    { asOfDate: `${yearFilter}-12-31` },
  );

  // Year lock state
  const lockedYears: number[] = (reconciliationData as any)?.lockedYears ?? [];
  const isYearLocked = lockedYears.includes(yearFilter);

  const lockYearMutation = trpc.ttb.lockReconciliationYear.useMutation({
    onSuccess: () => {
      utils.ttb.getReconciliationSummary.invalidate();
      showSuccess("Year Locked", `${yearFilter} is now locked for reconciliation`);
    },
    onError: (error) => {
      handleTransactionError(error, "Year Lock", "Lock");
    },
  });

  const unlockYearMutation = trpc.ttb.unlockReconciliationYear.useMutation({
    onSuccess: () => {
      utils.ttb.getReconciliationSummary.invalidate();
      showSuccess("Year Unlocked", `${yearFilter} is now unlocked`);
    },
    onError: (error) => {
      handleTransactionError(error, "Year Lock", "Unlock");
    },
  });

  const handleToggleYearLock = () => {
    if (isYearLocked) {
      unlockYearMutation.mutate({ year: yearFilter });
    } else {
      lockYearMutation.mutate({ year: yearFilter });
    }
  };

  // Year classification
  const openingBalanceYear = reconciliationData?.openingBalanceDate
    ? new Date(reconciliationData.openingBalanceDate as string).getFullYear()
    : null;
  const isOpeningYear = openingBalanceYear !== null && yearFilter <= openingBalanceYear;
  const isCurrentYear = yearFilter === currentYear;

  // Prior year query for year-specific TTB breakdown
  const { data: priorYearData } = trpc.ttb.getReconciliationSummary.useQuery(
    { asOfDate: `${yearFilter - 1}-12-31` },
    { enabled: !isOpeningYear && reconciliationData !== undefined },
  );

  // Compute year-specific metrics from cumulative TTB data
  type TtbTotals = {
    ttbOpeningBalance: number; production: number; removals: number;
    losses: number; distillation: number; ttbCalculatedEnding: number;
    systemOnHand: number; systemCalculatedOnHand: number; variance: number;
  };
  const yearMetrics = useMemo(() => {
    if (!reconciliationData || !("hasOpeningBalances" in reconciliationData) || !reconciliationData.hasOpeningBalances) {
      return null;
    }
    const t = reconciliationData.totals as TtbTotals;
    if (isOpeningYear) {
      return {
        opening: t.ttbOpeningBalance,
        production: 0,
        removals: 0,
        losses: 0,
        distillation: 0,
        ending: t.ttbOpeningBalance,
        onHand: t.systemOnHand,
        systemCalculated: t.systemCalculatedOnHand ?? t.systemOnHand,
        variance: 0,
        systemVariance: parseFloat(((t.systemCalculatedOnHand ?? t.systemOnHand) - t.ttbOpeningBalance).toFixed(1)),
        isConfigured: true,
      };
    }
    if (!priorYearData || !("totals" in priorYearData)) return null;
    const prior = priorYearData.totals as TtbTotals;
    const ending = parseFloat(t.ttbCalculatedEnding.toFixed(1));
    const systemCalc = t.systemCalculatedOnHand ?? t.systemOnHand;
    return {
      opening: parseFloat(prior.ttbCalculatedEnding.toFixed(1)),
      production: parseFloat((t.production - prior.production).toFixed(1)),
      removals: parseFloat((t.removals - prior.removals).toFixed(1)),
      losses: parseFloat((t.losses - prior.losses).toFixed(1)),
      distillation: parseFloat((t.distillation - prior.distillation).toFixed(1)),
      ending,
      onHand: parseFloat(t.systemOnHand.toFixed(1)),
      systemCalculated: parseFloat(systemCalc.toFixed(1)),
      variance: parseFloat((t.ttbCalculatedEnding - t.systemOnHand).toFixed(1)),
      systemVariance: parseFloat((systemCalc - ending).toFixed(1)),
      isConfigured: false,
    };
  }, [reconciliationData, priorYearData, isOpeningYear]);

  // Variance threshold from org settings (percentage-based, default 0.5%)
  const varianceThresholdPct = (reconciliationData as any)?.varianceThresholdPct ?? 0.5;

  // Compute the variance threshold in gallons from the percentage
  const varianceThresholdGal = useMemo(() => {
    if (!yearMetrics || yearMetrics.ending === 0) return 0;
    // Use the larger of TTB ending and system calculated as the base
    const base = Math.max(Math.abs(yearMetrics.ending), Math.abs(yearMetrics.systemCalculated));
    return base * (varianceThresholdPct / 100);
  }, [yearMetrics, varianceThresholdPct]);

  // Is the variance within tolerance?
  const varianceWithinTolerance = yearMetrics
    ? Math.abs(yearMetrics.systemVariance) <= varianceThresholdGal
    : false;

  // Auto-verify: only when all batches pass AND aggregate variance is within tolerance
  const autoVerifyRef = useRef<string | null>(null);
  const rawBatchesForAutoVerify = data?.batches || [];

  useEffect(() => {
    if (!yearMetrics || !rawBatchesForAutoVerify.length) return;

    // Don't re-trigger for the same year after we've already auto-verified
    const key = `${yearFilter}-${rawBatchesForAutoVerify.length}`;
    if (autoVerifyRef.current === key) return;

    // Check aggregate variance is within tolerance
    if (!varianceWithinTolerance) return;

    // Find unverified batches that pass all checks
    const toVerify = rawBatchesForAutoVerify
      .filter((b: any) => !b.verifiedForYear && b.validation?.status === "pass")
      .map((b: any) => b.id);

    if (toVerify.length === 0) return;

    // All conditions met — auto-verify
    autoVerifyRef.current = key;
    validateAndVerifyMutation.mutate({
      batchIds: toVerify,
      forceVerifyWarnings: false,
      year: yearFilter,
    });
  }, [yearMetrics, rawBatchesForAutoVerify, yearFilter, varianceWithinTolerance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const bulkUpdateMutation = trpc.batch.bulkUpdateReconciliationStatus.useMutation({
    onSuccess: (result) => {
      utils.batch.listForReconciliation.invalidate();
      showSuccess(
        "Batches Updated",
        `${result.updatedCount} batch(es) updated successfully`
      );
      setSelectedIds(new Set());
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Bulk Update");
    },
  });

  const validateAndVerifyMutation = trpc.batch.validateAndVerify.useMutation({
    onSuccess: (result) => {
      utils.batch.listForReconciliation.invalidate();
      const blockedCount = result.blocked.length;
      if (blockedCount > 0) {
        showSuccess(
          "Validation Complete",
          `${result.verified.length} verified, ${blockedCount} blocked by issues`
        );
      } else {
        showSuccess(
          "Verification Complete",
          `${result.verified.length} batch(es) verified`
        );
      }
      setSelectedIds(new Set());
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Validate");
    },
  });

  const deleteMutation = trpc.batch.delete.useMutation({
    onSuccess: () => {
      utils.batch.listForReconciliation.invalidate();
      utils.batch.list.invalidate();
      showSuccess("Batch Deleted", "Batch has been deleted");
      setDeleteDialogOpen(false);
      setBatchToDelete(null);
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Delete");
    },
  });

  const rawBatches = data?.batches || [];
  const statusCounts = data?.statusCounts || { verified: 0, pending: 0, total: 0, newProduction: 0, carriedForward: 0, passing: 0, warnings: 0, failing: 0 };

  // Filter by validation status (client-side since data is already fetched)
  const validationFiltered = useMemo(() => {
    if (validationFilter === "all") return rawBatches;
    return rawBatches.filter((b: any) => {
      if (validationFilter === "verified") return b.verifiedForYear === true;
      if (validationFilter === "carried_forward") return b.category === "carried_forward";
      if (validationFilter === "new_production") return b.category === "new_production";
      return b.validation?.status === validationFilter;
    });
  }, [rawBatches, validationFilter]);

  // Sort batches
  const batches = useMemo(() => {
    const sorted = [...validationFiltered].sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.customName || a.name || "").localeCompare(b.customName || b.name || "");
          break;
        case "productType":
          cmp = (a.productType || "").localeCompare(b.productType || "");
          break;
        case "startDate":
          cmp = (a.startDate ?? "").localeCompare(b.startDate ?? "");
          break;
        case "initialVolumeLiters":
          cmp = (parseFloat(a.initialVolumeLiters || "0")) - (parseFloat(b.initialVolumeLiters || "0"));
          break;
        case "currentVolumeLiters":
          cmp = (parseFloat(a.currentVolumeLiters || "0")) - (parseFloat(b.currentVolumeLiters || "0"));
          break;
        case "gallons":
          cmp = (parseFloat(a.currentVolumeLiters || "0")) - (parseFloat(b.currentVolumeLiters || "0"));
          break;
        case "vesselName":
          cmp = (a.vesselName || "").localeCompare(b.vesselName || "");
          break;
        case "validation": {
          const order: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
          const aVal = a.verifiedForYear ? 3 : (order[a.validation?.status] ?? 2);
          const bVal = b.verifiedForYear ? 3 : (order[b.validation?.status] ?? 2);
          cmp = aVal - bVal;
          break;
        }
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [validationFiltered, sortField, sortDirection]);

  // Sort toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort icon helper
  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  // Selection handlers
  const allSelected = batches.length > 0 && batches.every((b: any) => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batches.map((b: any) => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Action handlers
  const handleVerifySelected = (forceWarnings: boolean) => {
    if (selectedIds.size === 0) return;
    validateAndVerifyMutation.mutate({
      batchIds: Array.from(selectedIds),
      forceVerifyWarnings: forceWarnings,
      year: yearFilter,
    });
  };

  // Single-batch actions (from validation dropdown)
  const handleForceVerify = (batchId: string) => {
    validateAndVerifyMutation.mutate({
      batchIds: [batchId],
      forceVerifyWarnings: true,
      year: yearFilter,
    });
  };

  const handleResetSingleToPending = (batchId: string) => {
    bulkUpdateMutation.mutate({
      batchIds: [batchId],
      reconciliationStatus: "pending",
    });
  };

  const handleSetSingleStatus = (batchId: string, status: "verified" | "pending" | "duplicate" | "excluded") => {
    bulkUpdateMutation.mutate({
      batchIds: [batchId],
      reconciliationStatus: status,
    });
  };

  // Bulk actions (from selection bar)
  const handleResetToPending = () => {
    if (selectedIds.size === 0) return;
    bulkUpdateMutation.mutate({
      batchIds: Array.from(selectedIds),
      reconciliationStatus: "pending",
    });
  };

  const handleDeleteClick = (batch: any) => {
    setBatchToDelete(batch);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!batchToDelete) return;
    const dismissLoading = showLoading("Deleting batch...");
    try {
      await deleteMutation.mutateAsync({ batchId: batchToDelete.id });
    } finally {
      dismissLoading();
    }
  };

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  // Derived counts for bulk actions
  const selectedHasWarnings = Array.from(selectedIds).some((id) => {
    const b = rawBatches.find((b: any) => b.id === id);
    return b?.validation?.status === "warning";
  });

  // Admin guard
  if ((session?.user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">Admin access required</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ClipboardCheck className="w-8 h-8 text-amber-600 mr-3" />
            Batch Reconciliation
          </h1>
          <p className="text-gray-600 mt-2">
            Automated validation for TTB Form 5120.17 reporting. Batches are verified when all data quality checks pass.
          </p>
        </div>

        {/* Validation Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${validationFilter === "pass" ? "ring-2 ring-green-400" : ""}`}
            onClick={() => setValidationFilter(validationFilter === "pass" ? "all" : "pass")}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Passing</p>
                  <p className="text-2xl font-bold text-green-700">{statusCounts.passing}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${validationFilter === "warning" ? "ring-2 ring-amber-400" : ""}`}
            onClick={() => setValidationFilter(validationFilter === "warning" ? "all" : "warning")}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Warnings</p>
                  <p className="text-2xl font-bold text-amber-700">{statusCounts.warnings}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${validationFilter === "fail" ? "ring-2 ring-red-400" : ""}`}
            onClick={() => setValidationFilter(validationFilter === "fail" ? "all" : "fail")}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Issues</p>
                  <p className="text-2xl font-bold text-red-700">{statusCounts.failing}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${validationFilter === "verified" ? "ring-2 ring-blue-400" : ""}`}
            onClick={() => setValidationFilter(validationFilter === "verified" ? "all" : "verified")}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Verified</p>
                  <p className="text-2xl font-bold text-blue-700">{statusCounts.verified}</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        {!isLoading && statusCounts.total > 0 && statusCounts.carriedForward > 0 && (
          <div className="flex items-center gap-4 mb-4 px-1 text-sm text-gray-600">
            <button
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-gray-100 transition-colors ${validationFilter === "new_production" ? "bg-gray-100 font-medium" : ""}`}
              onClick={() => setValidationFilter(validationFilter === "new_production" ? "all" : "new_production")}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {statusCounts.newProduction} New Production
            </button>
            <button
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-gray-100 transition-colors ${validationFilter === "carried_forward" ? "bg-indigo-50 font-medium" : ""}`}
              onClick={() => setValidationFilter(validationFilter === "carried_forward" ? "all" : "carried_forward")}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              {statusCounts.carriedForward} Carried Forward
            </button>
          </div>
        )}

        {/* Reconciliation Status Banner */}
        {!isLoading && (() => {
          const hasBatches = statusCounts.total > 0;

          let bannerStyle: string;
          let icon: React.ReactNode;
          let title: string;

          const allPassing = statusCounts.failing === 0 && statusCounts.warnings === 0;

          if (!hasBatches) {
            bannerStyle = "bg-gray-50 border-gray-200";
            icon = <Clock className="w-5 h-5 text-gray-400" />;
            title = `${yearFilter} — No batches`;
          } else if (statusCounts.failing > 0) {
            bannerStyle = "bg-red-50 border-red-200";
            icon = <XCircle className="w-5 h-5 text-red-600" />;
            title = `${yearFilter} — ${statusCounts.failing} batch${statusCounts.failing !== 1 ? "es" : ""} with issues`;
          } else if (statusCounts.warnings > 0) {
            bannerStyle = "bg-amber-50 border-amber-200";
            icon = <AlertTriangle className="w-5 h-5 text-amber-600" />;
            title = `${yearFilter} — ${statusCounts.warnings} batch${statusCounts.warnings !== 1 ? "es" : ""} with warnings`;
          } else if (isOpeningYear) {
            bannerStyle = "bg-green-50 border-green-200";
            icon = <CheckCircle className="w-5 h-5 text-green-600" />;
            title = `${yearFilter} — Opening Balance Configured`;
          } else if (allPassing && !varianceWithinTolerance && yearMetrics) {
            // All batch-level checks pass but aggregate doesn't reconcile
            const variancePct = yearMetrics.ending !== 0
              ? Math.abs(yearMetrics.systemVariance / yearMetrics.ending * 100).toFixed(1)
              : "?";
            bannerStyle = "bg-amber-50 border-amber-200";
            icon = <AlertTriangle className="w-5 h-5 text-amber-600" />;
            title = `${yearFilter} — ${Math.abs(yearMetrics.systemVariance).toFixed(0)} gal variance (${variancePct}%) between TTB and system`;
          } else if (statusCounts.verified === statusCounts.total && statusCounts.total > 0) {
            bannerStyle = "bg-green-50 border-green-200";
            icon = <ShieldCheck className="w-5 h-5 text-green-600" />;
            title = `${yearFilter} — Fully Reconciled`;
          } else {
            bannerStyle = "bg-green-50 border-green-200";
            icon = <CheckCircle className="w-5 h-5 text-green-600" />;
            title = `${yearFilter} — All checks passing`;
          }

          return (
            <div className={`mb-4 p-4 rounded-lg border ${bannerStyle}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="font-semibold text-gray-800">{title}</span>
                  </div>
                  {hasBatches && (
                    <div className="text-sm text-gray-600 mt-1">
                      <p>
                        {statusCounts.verified} of {statusCounts.total} verified — {statusCounts.passing} passing, {statusCounts.warnings} warnings, {statusCounts.failing} issues
                        {statusCounts.carriedForward > 0 && (
                          <span className="ml-2 text-gray-500">
                            ({statusCounts.newProduction} new, {statusCounts.carriedForward} carried forward)
                          </span>
                        )}
                      </p>
                      {allPassing && !varianceWithinTolerance && (
                        <p className="text-amber-700 mt-1">
                          All batch-level checks pass, but the TTB calculated ending does not match the system total.
                          Batches will auto-verify once the variance is within {varianceThresholdPct}%.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {yearMetrics && (
                  <div className="text-right text-sm">
                    {yearMetrics.isConfigured ? (
                      <>
                        <p className="font-medium text-gray-700">TTB Ending Balance</p>
                        <p className="font-semibold text-gray-800">{yearMetrics.opening.toLocaleString()} gal</p>
                        <p className="text-xs text-gray-500 mt-1">Configured from physical inventory</p>
                        <p className="text-gray-600 mt-2">System Calculated: {yearMetrics.systemCalculated.toLocaleString()} gal</p>
                        {Math.abs(yearMetrics.systemVariance) > 0.1 && (
                          <p className={`${Math.abs(yearMetrics.systemVariance) < 10 ? "text-green-700" : Math.abs(yearMetrics.systemVariance) < 100 ? "text-amber-700" : "text-red-700"}`}>
                            Variance: {yearMetrics.systemVariance > 0 ? "+" : ""}{yearMetrics.systemVariance.toFixed(1)} gal
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-gray-700">TTB Balance ({yearFilter})</p>
                        <p className="text-gray-600">Opening: {yearMetrics.opening.toLocaleString()} gal</p>
                        {yearMetrics.production > 0 && (
                          <p className="text-gray-600">+ Production: {yearMetrics.production.toLocaleString()} gal</p>
                        )}
                        {(yearMetrics.removals + yearMetrics.losses + yearMetrics.distillation) > 0 && (
                          <p className="text-gray-600">- Removals: {(yearMetrics.removals + yearMetrics.losses + yearMetrics.distillation).toFixed(1)} gal</p>
                        )}
                        <p className="font-semibold text-gray-800 border-t border-gray-300 mt-1 pt-1">
                          Calculated Ending: {yearMetrics.ending.toLocaleString()} gal
                        </p>
                        <p className="text-gray-600">System Calculated: {yearMetrics.systemCalculated.toLocaleString()} gal</p>
                        {Math.abs(yearMetrics.systemVariance) > 0.1 && (
                          <p className={`${Math.abs(yearMetrics.systemVariance) < 10 ? "text-green-700" : Math.abs(yearMetrics.systemVariance) < 100 ? "text-amber-700" : "text-red-700"}`}>
                            Variance: {yearMetrics.systemVariance > 0 ? "+" : ""}{yearMetrics.systemVariance.toFixed(1)} gal
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Variance Analysis — shown when there's a significant variance */}
        {(() => {
          if (varianceWithinTolerance || !yearMetrics || isOpeningYear) return null;
          const va = (reconciliationData as any)?.varianceAnalysis;
          if (!va) return null;

          const rows: { label: string; ttb: number; system: number; gap: number; note?: string }[] = [
            { label: "Production", ttb: va.production.ttb, system: va.production.system, gap: va.production.gap,
              note: va.production.gap !== 0 ? "TTB counts press runs + purchases; system counts batch initial volumes" : undefined },
            { label: "Sales / Distributions", ttb: va.sales.ttb, system: va.sales.system, gap: va.sales.gap },
            { label: "Process Losses", ttb: va.losses.ttb, system: va.losses.system, gap: va.losses.gap,
              note: va.losses.gap !== 0 ? "TTB loss queries may filter on verified status" : undefined },
            { label: "Distillation (DSP)", ttb: va.distillation.ttb, system: va.distillation.system, gap: va.distillation.gap },
            { label: "Packaging (bulk→packaged)", ttb: va.packaging.ttb, system: va.packaging.system, gap: va.packaging.gap },
          ];

          const hasGaps = rows.some(r => Math.abs(r.gap) > 0.5);
          if (!hasGaps && !va.clampedVolume && !va.gains) return null;

          return (
            <Card className="mb-4 border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold text-amber-800 mb-3">
                  Variance Analysis — Where does the {Math.abs(yearMetrics.systemVariance).toFixed(0)} gal gap come from?
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="text-left py-1 pr-4">Category</th>
                        <th className="text-right py-1 px-2">TTB (gal)</th>
                        <th className="text-right py-1 px-2">System (gal)</th>
                        <th className="text-right py-1 px-2">Gap (gal)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const absGap = Math.abs(r.gap);
                        const gapColor = absGap < 1 ? "text-green-700" : absGap < 50 ? "text-amber-700" : "text-red-700";
                        return (
                          <tr key={r.label} className="border-b border-gray-200/50">
                            <td className="py-1 pr-4 text-gray-700">
                              {r.label}
                              {r.note && absGap > 0.5 && (
                                <span className="block text-xs text-gray-500 italic">{r.note}</span>
                              )}
                            </td>
                            <td className="text-right py-1 px-2 font-mono">{r.ttb.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td className="text-right py-1 px-2 font-mono">{r.system.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td className={`text-right py-1 px-2 font-mono font-semibold ${gapColor}`}>
                              {absGap < 0.5 ? "—" : `${r.gap > 0 ? "+" : ""}${r.gap.toFixed(1)}`}
                            </td>
                          </tr>
                        );
                      })}
                      {va.clampedVolume > 0.5 && (
                        <tr className="border-b border-gray-200/50">
                          <td className="py-1 pr-4 text-gray-700">
                            Clamped (batches that went negative)
                            <span className="block text-xs text-gray-500 italic">Volume lost to Math.max(0) floor — indicates data issues</span>
                          </td>
                          <td className="text-right py-1 px-2 font-mono">—</td>
                          <td className="text-right py-1 px-2 font-mono">—</td>
                          <td className="text-right py-1 px-2 font-mono font-semibold text-red-700">
                            -{va.clampedVolume.toFixed(1)}
                          </td>
                        </tr>
                      )}
                      {va.gains > 0.5 && (
                        <tr className="border-b border-gray-200/50">
                          <td className="py-1 pr-4 text-gray-700">
                            Positive Adjustments (gains)
                            <span className="block text-xs text-gray-500 italic">Volume added via manual adjustments — not counted in TTB production</span>
                          </td>
                          <td className="text-right py-1 px-2 font-mono">0.0</td>
                          <td className="text-right py-1 px-2 font-mono">{va.gains.toFixed(1)}</td>
                          <td className="text-right py-1 px-2 font-mono font-semibold text-amber-700">
                            -{va.gains.toFixed(1)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {va.batchCount} batches analyzed. Gap = TTB value − System value. Positive gap means TTB overcounts (or system undercounts).
                </p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Filter Bar */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={String(yearFilter)} onValueChange={(v) => { setYearFilter(Number(v)); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={isYearLocked ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleYearLock}
                disabled={lockYearMutation.isPending || unlockYearMutation.isPending}
                title={isYearLocked ? `Unlock ${yearFilter} for editing` : `Lock ${yearFilter} to prevent edits`}
                className="flex items-center gap-1.5"
              >
                {isYearLocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 h-4">
                      Locked
                    </Badge>
                  </>
                ) : (
                  <Unlock className="w-4 h-4 text-gray-500" />
                )}
              </Button>

              <Select value={productTypeFilter} onValueChange={(v) => { setProductTypeFilter(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PRODUCT_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search batch name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {(statusFilter !== "all" || validationFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setValidationFilter("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Action Bar */}
        {someSelected && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} batch(es) selected
            </span>
            <div className="flex gap-2 ml-auto">
              {selectedHasWarnings && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleVerifySelected(true)}
                  disabled={validateAndVerifyMutation.isPending}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Force Verify
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetToPending}
                disabled={bulkUpdateMutation.isPending}
              >
                Reset to Pending
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Deselect All
              </Button>
            </div>
          </div>
        )}

        {/* Batch Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {batches.length} Batches ({yearFilter})
            </CardTitle>
            <CardDescription>
              Batches that pass all checks are auto-verified. Expand rows with issues to see details and fix links.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading batches...</div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No batches found for the selected filters</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("name")}>
                        <span className="flex items-center">Batch{sortIcon("name")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("productType")}>
                        <span className="flex items-center">Type{sortIcon("productType")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("startDate")}>
                        <span className="flex items-center">Date{sortIcon("startDate")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("initialVolumeLiters")}>
                        <span className="flex items-center justify-end">Initial (L){sortIcon("initialVolumeLiters")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("currentVolumeLiters")}>
                        <span className="flex items-center justify-end">Current (L){sortIcon("currentVolumeLiters")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("gallons")}>
                        <span className="flex items-center justify-end">Gallons{sortIcon("gallons")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("vesselName")}>
                        <span className="flex items-center">Vessel{sortIcon("vesselName")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("validation")}>
                        <span className="flex items-center">Validation{sortIcon("validation")}</span>
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch: any) => (
                      <ExpandableReconciliationRow
                        key={batch.id}
                        batch={batch}
                        selectedIds={selectedIds}
                        toggleSelect={toggleSelect}
                        handleDeleteClick={handleDeleteClick}
                        onForceVerify={handleForceVerify}
                        onResetToPending={handleResetSingleToPending}
                        onSetStatus={handleSetSingleStatus}
                        isVerifying={validateAndVerifyMutation.isPending || bulkUpdateMutation.isPending}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TTB Preview */}
        <div className="mt-6">
          <Collapsible open={ttbPreviewOpen} onOpenChange={setTtbPreviewOpen}>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    {ttbPreviewOpen ? (
                      <ChevronDown className="w-5 h-5 mr-2" />
                    ) : (
                      <ChevronRight className="w-5 h-5 mr-2" />
                    )}
                    TTB Summary Preview ({yearFilter})
                  </CardTitle>
                  <CardDescription>
                    Shows TTB Form 5120.17 numbers based on currently verified batches
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="border-t-0 rounded-t-none">
                <CardContent className="pt-4">
                  {yearMetrics ? (
                    yearMetrics.isConfigured ? (
                      <div className="text-center py-4">
                        <p className="text-lg font-bold">{yearMetrics.opening} gal</p>
                        <p className="text-sm text-gray-500">Ending balance configured from physical inventory</p>
                        <p className="text-xs text-gray-400 mt-1">This was entered as the starting point for TTB tracking</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">Opening Balance</p>
                          <p className="text-lg font-bold">{yearMetrics.opening} gal</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">Production ({yearFilter})</p>
                          <p className="text-lg font-bold">{yearMetrics.production} gal</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">Removals + Losses</p>
                          <p className="text-lg font-bold">{(yearMetrics.removals + yearMetrics.losses).toFixed(1)} gal</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">Sent to DSP</p>
                          <p className="text-lg font-bold">{yearMetrics.distillation} gal</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">Calculated Ending</p>
                          <p className="text-lg font-bold">{yearMetrics.ending} gal</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase">System Calculated</p>
                          <p className="text-lg font-bold">{yearMetrics.systemCalculated} gal</p>
                        </div>
                        <div className={`p-3 rounded-lg col-span-2 ${
                          Math.abs(yearMetrics.systemVariance) < 10
                            ? "bg-green-50"
                            : Math.abs(yearMetrics.systemVariance) < 100
                              ? "bg-amber-50"
                              : "bg-red-50"
                        }`}>
                          <p className="text-xs text-gray-500 uppercase">Variance (TTB vs System)</p>
                          <p className={`text-lg font-bold ${
                            Math.abs(yearMetrics.systemVariance) < 10
                              ? "text-green-700"
                              : Math.abs(yearMetrics.systemVariance) < 100
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}>
                            {yearMetrics.systemVariance > 0 ? "+" : ""}{yearMetrics.systemVariance} gal
                          </p>
                        </div>
                      </div>
                    )
                  ) : reconciliationData && "hasOpeningBalances" in reconciliationData && reconciliationData.hasOpeningBalances ? (
                    <div className="text-center py-4 text-gray-500">Loading year-specific data...</div>
                  ) : reconciliationData ? (
                    <div className="text-center py-4 text-gray-500">
                      No TTB opening balances configured. Set up opening balances in{" "}
                      <Link href="/admin/ttb-onboarding" className="text-blue-600 hover:underline">
                        TTB Onboarding
                      </Link>{" "}
                      first.
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Loading TTB summary...
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Batch
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{batchToDelete?.customName || batchToDelete?.name}&rdquo;?
                This will permanently remove the batch and all its related data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Batch"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
