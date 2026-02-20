"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  AlertCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import {
  handleTransactionError,
  showSuccess,
  showLoading,
} from "@/utils/error-handling";
import { litersToWineGallons, wineGallonsToLiters } from "lib/src/calculations/ttb";
import { ReportExportDropdown } from "@/components/reports/ReportExportDropdown";
import { arrayToCSV, downloadCSV, escapeCSVValue } from "@/utils/csv/exportHelpers";

const PRODUCT_TYPES = [
  { value: "cider", label: "Cider" },
  { value: "perry", label: "Perry" },
  { value: "brandy", label: "Brandy" },
  { value: "pommeau", label: "Pommeau" },
  { value: "juice", label: "Juice" },
  { value: "other", label: "Other" },
] as const;

type SortField = "name" | "productType" | "startDate" | "initialVolumeLiters" | "endingVolume" | "gallons" | "vesselName" | "validation";
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
  hasReconIssue,
}: {
  batch: any;
  onForceVerify: (batchId: string) => void;
  onResetToPending: (batchId: string) => void;
  onSetStatus: (batchId: string, status: ReconciliationStatus) => void;
  disabled: boolean;
  hasReconIssue?: boolean;
}) {
  const validation = batch.validation;
  const isVerified = batch.verifiedForYear === true;

  // Build the status label
  let icon: React.ReactNode;
  let label: string;
  let colorClass: string;

  if (isVerified) {
    const hasOverrides = validation && validation.status !== "pass";
    if (hasReconIssue) {
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      label = "Verified (drift)";
      colorClass = "text-amber-600";
    } else if (hasOverrides) {
      icon = <ShieldCheck className="w-4 h-4 text-blue-400" />;
      label = "Verified (override)";
      colorClass = "text-blue-500";
    } else {
      icon = <ShieldCheck className="w-4 h-4 text-blue-500" />;
      label = "Verified";
      colorClass = "text-blue-600";
    }
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

function ExpandableReconciliationRow({
  batch,
  selectedIds,
  toggleSelect,
  handleDeleteClick,
  onForceVerify,
  onResetToPending,
  onSetStatus,
  isVerifying,
  reconMap,
}: {
  batch: any;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  handleDeleteClick: (batch: any) => void;
  onForceVerify: (batchId: string) => void;
  onResetToPending: (batchId: string) => void;
  onSetStatus: (batchId: string, status: ReconciliationStatus) => void;
  isVerifying: boolean;
  reconMap: Map<string, any>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = batch.children && batch.children.length > 0;
  const validation = batch.validation;
  const hasIssues = validation && validation.status !== "pass";
  const recon = reconMap.get(batch.id);
  const hasReconIssue = recon && (
    Math.abs(recon.identityCheck) >= 0.25 ||
    Math.abs(recon.driftLiters) >= 0.5 ||
    recon.hasInitialVolumeAnomaly ||
    recon.exceedsVesselCapacity
  );
  const isExpandable = hasChildren || hasIssues || !!recon;

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
          {recon ? (recon.reconstructedEndingLiters ?? 0).toFixed(1) : formatVolume(batch.currentVolumeLiters)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {recon ? (recon.ending ?? 0).toFixed(2) : formatGallons(batch.currentVolumeLiters)}
        </TableCell>
        <TableCell className="text-sm text-gray-600">
          {batch.vesselName || "—"}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {recon ? (() => {
            const hasDrift = Math.abs(recon.driftLiters) >= 0.5;
            const driftGal = litersToWineGallons(Math.abs(recon.driftLiters));
            return (
              <span className={hasDrift ? "text-red-700 font-semibold" : "text-green-700"}>
                {hasDrift ? `${recon.driftLiters > 0 ? "+" : "−"}${driftGal.toFixed(1)}` : "0"}
              </span>
            );
          })() : "—"}
        </TableCell>
        <TableCell className="text-center">
          {recon ? (() => {
            const hasId = Math.abs(recon.identityCheck) >= 0.25;
            const hasDr = Math.abs(recon.driftLiters) >= 0.5;
            return (
              <div className="flex items-center justify-center gap-0.5">
                <span title={hasId ? `Identity: ${recon.identityCheck.toFixed(1)} gal` : "Identity OK"}>
                  {hasId ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                </span>
                <span title={hasDr ? `Drift: ${litersToWineGallons(recon.driftLiters).toFixed(1)} gal` : "No drift"}>
                  {hasDr ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                </span>
                <span title={recon.hasInitialVolumeAnomaly ? "Initial volume anomaly" : "Initial OK"}>
                  {recon.hasInitialVolumeAnomaly ? <XCircle className="w-3.5 h-3.5 text-orange-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                </span>
                <span title={recon.exceedsVesselCapacity ? "Exceeds vessel capacity" : "Capacity OK"}>
                  {recon.exceedsVesselCapacity ? <XCircle className="w-3.5 h-3.5 text-purple-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                </span>
              </div>
            );
          })() : "—"}
        </TableCell>
        <TableCell>
          <ValidationStatusMenu
            batch={batch}
            onForceVerify={onForceVerify}
            onResetToPending={onResetToPending}
            onSetStatus={onSetStatus}
            disabled={isVerifying}
            hasReconIssue={hasReconIssue}
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

      {/* TTB Forensic Details */}
      {expanded && recon && (
        <TableRow className="bg-gray-50/30">
          <TableCell></TableCell>
          <TableCell colSpan={11}>
            {/* TTB Volume Flow */}
            <div className="flex flex-wrap gap-4 py-2 text-xs">
              <span className="text-gray-500">Opening: <span className="font-mono font-medium text-gray-700">{recon.opening.toFixed(1)}</span></span>
              {recon.production > 0 && <span className="text-gray-500">+Prod: <span className="font-mono font-medium text-gray-700">{recon.production.toFixed(1)}</span></span>}
              {recon.losses > 0 && <span className="text-gray-500">-Loss: <span className="font-mono font-medium text-gray-700">{recon.losses.toFixed(1)}</span></span>}
              {recon.sales > 0 && <span className="text-gray-500">-Sales: <span className="font-mono font-medium text-gray-700">{recon.sales.toFixed(1)}</span></span>}
              {recon.distillation > 0 && <span className="text-gray-500">-DSP: <span className="font-mono font-medium text-gray-700">{recon.distillation.toFixed(1)}</span></span>}
              <span className="text-gray-500">=Ending: <span className="font-mono font-semibold text-gray-900">{recon.ending.toFixed(1)}</span> gal</span>
            </div>
            {/* Detail grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pb-2">
              <div>
                <p className="font-semibold text-gray-600 mb-1">Loss Breakdown (gal)</p>
                <div className="space-y-0.5 text-gray-500">
                  {recon.lossBreakdown?.racking > 0 && <p>Racking: {recon.lossBreakdown.racking.toFixed(1)}</p>}
                  {recon.lossBreakdown?.filter > 0 && <p>Filter: {recon.lossBreakdown.filter.toFixed(1)}</p>}
                  {recon.lossBreakdown?.bottling > 0 && <p>Bottling: {recon.lossBreakdown.bottling.toFixed(1)}</p>}
                  {recon.lossBreakdown?.kegging > 0 && <p>Kegging: {recon.lossBreakdown.kegging.toFixed(1)}</p>}
                  {recon.lossBreakdown?.transfer > 0 && <p>Transfer: {recon.lossBreakdown.transfer.toFixed(1)}</p>}
                  {recon.lossBreakdown?.adjustments !== 0 && recon.lossBreakdown?.adjustments != null && <p>Adjustments: {recon.lossBreakdown.adjustments.toFixed(1)}</p>}
                  {recon.lossBreakdown && Object.values(recon.lossBreakdown).every((v: any) => Math.abs(v) < 0.05) && <p className="text-gray-400">No losses</p>}
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-600 mb-1">Check Details</p>
                <div className="space-y-0.5 text-gray-500">
                  <p className={Math.abs(recon.identityCheck) >= 0.25 ? "text-red-700" : ""}>
                    Identity: {recon.identityCheck.toFixed(2)} gal {Math.abs(recon.identityCheck) >= 0.25 ? "FAIL" : "OK"}
                  </p>
                  <p className={Math.abs(recon.driftLiters) >= 0.5 ? "text-red-700" : ""}>
                    Drift: {recon.driftLiters < 0 ? "−" : ""}{litersToWineGallons(Math.abs(recon.driftLiters)).toFixed(2)} gal {Math.abs(recon.driftLiters) >= 0.5 ? "FAIL" : "OK"}
                  </p>
                  <p className={recon.hasInitialVolumeAnomaly ? "text-orange-700" : ""}>
                    Initial: {recon.hasInitialVolumeAnomaly ? "ANOMALY — transfer-created with non-zero initial" : "OK"}
                  </p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-600 mb-1">Vessel Capacity</p>
                <div className="space-y-0.5 text-gray-500">
                  {recon.vesselCapacityHistory?.length > 0 ? (
                    <div className="space-y-1">
                      {recon.vesselCapacityHistory.map((vh: any, idx: number) => (
                        <div key={idx} className={vh.exceeds ? "text-purple-700" : ""}>
                          <p className="font-medium text-xs">{vh.vesselName}</p>
                          <p className="text-xs">Cap: {vh.vesselCapacityGal.toFixed(1)} / Peak: {vh.peakVolumeGal.toFixed(1)} gal</p>
                          {vh.exceeds && <p className="text-xs font-semibold">EXCEEDS — peak on {vh.peakDate}</p>}
                        </div>
                      ))}
                    </div>
                  ) : recon.vesselCapacityGal ? (
                    <>
                      <p>Capacity: {recon.vesselCapacityGal.toFixed(1)} gal</p>
                      <p>Peak: {recon.maxVolumeReceivedGal.toFixed(1)} gal</p>
                      <p className={recon.exceedsVesselCapacity ? "text-purple-700" : ""}>{recon.exceedsVesselCapacity ? "EXCEEDS" : "OK"}</p>
                    </>
                  ) : (
                    <p className="text-gray-400">No vessel assigned</p>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-600 mb-1">Volume Comparison</p>
                <div className="space-y-0.5 text-gray-500">
                  <p>Stored: {litersToWineGallons(recon.currentVolumeLitersStored).toFixed(2)} gal</p>
                  <p>Reconstructed: {litersToWineGallons(recon.reconstructedEndingLiters).toFixed(2)} gal</p>
                  <p className={Math.abs(recon.driftLiters) >= 0.5 ? "text-red-700" : ""}>
                    Delta: {recon.driftLiters < 0 ? "−" : "+"}{litersToWineGallons(Math.abs(recon.driftLiters)).toFixed(2)} gal
                  </p>
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      )}

      {/* Validation details */}
      {expanded && nonPassChecks.length > 0 && (
        <TableRow className={validation.status === "fail" ? "bg-red-50/30" : "bg-amber-50/30"}>
          <TableCell></TableCell>
          <TableCell colSpan={11}>
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
            {(() => {
              const recon = reconMap.get(child.id);
              // For transfer-created batches, initialVolumeLiters is 0 in DB.
              // Show the volume received via transfers instead.
              if (recon && recon.isTransferCreated && recon.transfersIn > 0) {
                return wineGallonsToLiters(recon.transfersIn).toFixed(1);
              }
              return formatVolume(child.initialVolumeLiters);
            })()}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums text-gray-500">
            {(() => {
              const recon = reconMap.get(child.id);
              return recon ? recon.reconstructedEndingLiters.toFixed(1) : formatVolume(child.currentVolumeLiters);
            })()}
          </TableCell>
          <TableCell className="text-right text-sm tabular-nums text-gray-500">
            {(() => {
              const recon = reconMap.get(child.id);
              return recon ? recon.ending.toFixed(2) : formatGallons(child.currentVolumeLiters);
            })()}
          </TableCell>
          <TableCell className="text-sm text-gray-400">
            {child.vesselName || "—"}
          </TableCell>
          <TableCell className="text-right text-sm text-gray-400">—</TableCell>
          <TableCell className="text-center text-sm text-gray-400">—</TableCell>
          <TableCell>
            {(() => {
              const status = child.reconciliationStatus || "pending";
              if (status === "verified") return <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">Verified</Badge>;
              if (status === "excluded") return <Badge variant="outline" className="bg-gray-50 text-gray-500 text-xs">Excluded</Badge>;
              if (status === "duplicate") return <Badge variant="outline" className="bg-gray-50 text-gray-500 text-xs">Duplicate</Badge>;
              return <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">Pending</Badge>;
            })()}
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

  // URL persistence for period selection
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filters — committed state (drives queries)
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(() => {
    const y = searchParams.get("year");
    return y ? Number(y) : currentYear;
  });
  const [periodPreset, setPeriodPreset] = useState<string>(() => {
    return searchParams.get("period") || "annual";
  });

  // Pending period selectors (what dropdowns show before "Go")
  const [pendingYear, setPendingYear] = useState(yearFilter);
  const [pendingPeriod, setPendingPeriod] = useState(periodPreset);

  const getPeriodType = (period: string) => {
    if (period.startsWith("q")) return "quarterly";
    if (period.startsWith("m")) return "monthly";
    return "annual";
  };
  const pendingPeriodType = getPeriodType(pendingPeriod);

  // Apply period selection
  const applyPeriod = useCallback(() => {
    setYearFilter(pendingYear);
    setPeriodPreset(pendingPeriod);
    setSelectedIds(new Set());
    const params = new URLSearchParams();
    params.set("year", String(pendingYear));
    if (pendingPeriod !== "annual") params.set("period", pendingPeriod);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [pendingYear, pendingPeriod, router]);

  // Other filters (remain reactive)
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // TTB issue filter
  const [ttbFilter, setTtbFilter] = useState<string>("all");

  // Compute date range from year + period preset
  const { reconStartDate, reconEndDate } = useMemo(() => {
    const y = yearFilter;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (periodPreset.startsWith("q")) {
      switch (periodPreset) {
        case "q1": return { reconStartDate: `${y - 1}-12-31`, reconEndDate: `${y}-03-31` };
        case "q2": return { reconStartDate: `${y}-03-31`, reconEndDate: `${y}-06-30` };
        case "q3": return { reconStartDate: `${y}-06-30`, reconEndDate: `${y}-09-30` };
        case "q4": return { reconStartDate: `${y}-09-30`, reconEndDate: `${y}-12-31` };
      }
    }
    if (periodPreset.startsWith("m")) {
      const month = parseInt(periodPreset.slice(1));
      const endDay = new Date(y, month, 0).getDate();
      const endDate = `${y}-${pad(month)}-${pad(endDay)}`;
      if (month === 1) {
        return { reconStartDate: `${y - 1}-12-31`, reconEndDate: endDate };
      }
      const prevEndDay = new Date(y, month - 1, 0).getDate();
      const startDate = `${y}-${pad(month - 1)}-${pad(prevEndDay)}`;
      return { reconStartDate: startDate, reconEndDate: endDate };
    }
    return { reconStartDate: `${y - 1}-12-31`, reconEndDate: `${y}-12-31` };
  }, [yearFilter, periodPreset]);

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
    { startDate: reconStartDate, endDate: reconEndDate },
  );

  // Year classification
  const openingBalanceYear = reconciliationData?.openingBalanceDate
    ? new Date(reconciliationData.openingBalanceDate as string).getFullYear()
    : null;
  const isOpeningYear = openingBalanceYear !== null && yearFilter <= openingBalanceYear;
  const isCurrentYear = yearFilter === currentYear;

  // TTB Form 5120.17 data for Parts III & IV (materials, spirits, tax computation)
  const { data: formData512017 } = trpc.ttb.generateForm512017.useQuery(
    { periodType: "annual", year: yearFilter },
    { enabled: reconciliationData !== undefined },
  );

  // TTB Balance card metrics — ALL values from per-batch SBD (single source of truth).
  // Using a single accounting system (computeReconciliationFromBatches) for the entire
  // waterfall guarantees ~0 variance by the SBD identity. Mixing aggregate and per-batch
  // sources creates structural variance because they scope batches differently.
  type TtbTotals = {
    ttbOpeningBalance: number;
    systemCalculatedOnHand: number;
    removals: number;
    losses: number;
    distillation: number;
    production: number;
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
        netInternal: 0,
        adjustments: 0,
        clampedVolume: 0,
        distributed: 0,
        packagedBonded: 0,
        losses: 0,
        distillation: 0,
        ending: t.ttbOpeningBalance,
        systemCalculated: t.ttbOpeningBalance,
        variance: 0,
        systemVariance: 0,
        isConfigured: true,
        waterfallAdjustments: [],
      };
    }
    const br = (reconciliationData as any)?.batchReconciliation?.totals;
    if (!br) return null;
    // Use configured TTB opening balance (physical inventory) when available.
    const configuredOpening = t.ttbOpeningBalance;
    const sbdOpening = parseFloat((br.opening ?? 0).toFixed(1));
    const opening = configuredOpening > 0 ? configuredOpening : sbdOpening;
    // Production excludes mergesIn (internal movement, not new production).
    const production = parseFloat((br.production ?? 0).toFixed(1));
    const distributed = parseFloat((br.sales ?? 0).toFixed(1));
    const losses = parseFloat((br.losses ?? 0).toFixed(1));
    const distillation = parseFloat((br.distillation ?? 0).toFixed(1));
    const ending = parseFloat(br.ending.toFixed(1));
    // Net internal movement: transfers and merges between batches.
    const netInternal = parseFloat((
      ((br.transfersIn ?? 0) + (br.mergesIn ?? 0)) - ((br.transfersOut ?? 0) + (br.mergesOut ?? 0))
    ).toFixed(1));
    // Packaged (Bonded) = net volume moved from bulk to packaged form, minus what was distributed.
    const packagedBonded = parseFloat(((br.packaging ?? 0) - (br.sales ?? 0)).toFixed(1));
    // Sum waterfall adjustments from the database (explicit, auditable corrections).
    const waterfallAdjs = (reconciliationData as any)?.waterfallAdjustments ?? [];
    const adjustments = parseFloat(
      waterfallAdjs.reduce((sum: number, a: any) => sum + parseFloat(a.amountGallons ?? 0), 0).toFixed(1)
    );
    // Clamped volume: batches that went negative are clamped to 0, inflating the ending total.
    // We add it back as a positive term so the waterfall identity holds.
    const clampedVolume = parseFloat(((reconciliationData as any)?.clampedVolume ?? 0).toFixed(1));
    // Variance = waterfall identity check.
    // ending includes clamped values (max(0, raw)), so we add clampedVolume to balance:
    // opening + production + netInternal + adjustments + clampedVolume - distributed - packagedBonded - losses - distillation = ending
    const variance = parseFloat((opening + production + netInternal + adjustments + clampedVolume - distributed - packagedBonded - losses - distillation - ending).toFixed(1));
    return {
      opening,
      production,
      netInternal,
      adjustments,
      clampedVolume,
      distributed,
      packagedBonded,
      losses,
      distillation,
      ending,
      systemCalculated: ending,
      variance,
      systemVariance: 0,
      isConfigured: false,
      waterfallAdjustments: waterfallAdjs,
    };
  }, [reconciliationData, isOpeningYear]);

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

  // Batch-derived reconciliation data
  const batchRecon = (reconciliationData as any)?.batchReconciliation;
  const periodStatus = (reconciliationData as any)?.periodStatus;

  // Identity check: is the batch-derived identity within tolerance?
  const identityCheckPasses = batchRecon ? Math.abs(batchRecon.identityCheck) < 0.25 : false;
  const hasNoDoubleCountingIssues = batchRecon
    ? batchRecon.batchesWithDrift === 0 && batchRecon.batchesWithInitialAnomaly === 0 && batchRecon.vesselCapacityWarnings === 0
    : false;

  // Auto-verify: identity check passes + no double-counting + all per-batch checks pass
  const autoVerifyRef = useRef<string | null>(null);
  const rawBatchesForAutoVerify = data?.batches || [];

  useEffect(() => {
    if (!batchRecon || !rawBatchesForAutoVerify.length) return;

    // Check identity check passes and no double-counting issues
    if (!identityCheckPasses || !hasNoDoubleCountingIssues) return;

    // Don't auto-verify if period is already finalized
    if (periodStatus?.currentPeriodFinalized) return;

    // Find unverified batches that pass all checks
    const toVerify = rawBatchesForAutoVerify
      .filter((b: any) => !b.verifiedForYear && b.validation?.status === "pass")
      .map((b: any) => b.id);

    if (toVerify.length === 0) return;

    // Don't re-trigger for the same set of batches
    // Key includes the specific batch IDs to verify, so it changes when
    // more batches become eligible (e.g., after a previous auto-verify round)
    const key = `${reconStartDate}-${reconEndDate}-${toVerify.sort().join(",")}`;
    if (autoVerifyRef.current === key) return;

    // All conditions met — auto-verify
    autoVerifyRef.current = key;
    validateAndVerifyMutation.mutate({
      batchIds: toVerify,
      forceVerifyWarnings: false,
      year: yearFilter,
    });
  }, [batchRecon, rawBatchesForAutoVerify, reconStartDate, reconEndDate, identityCheckPasses, hasNoDoubleCountingIssues]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build a lookup map from batch-derived reconciliation data (full TTB data per batch)
  const reconMap = useMemo(() => {
    const map = new Map<string, any>();
    if (batchRecon?.batches) {
      for (const b of batchRecon.batches as any[]) {
        map.set(b.batchId, b);
      }
    }
    return map;
  }, [batchRecon]);

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

  // Apply TTB issue filter
  const ttbFiltered = useMemo(() => {
    if (ttbFilter === "all") return validationFiltered;
    return validationFiltered.filter((b: any) => {
      const r = reconMap.get(b.id);
      if (!r) return false;
      switch (ttbFilter) {
        case "identityIssues": return Math.abs(r.identityCheck) >= 0.25;
        case "drift": return Math.abs(r.driftLiters) >= 0.5;
        case "initialAnomaly": return r.hasInitialVolumeAnomaly;
        case "capacity": return r.exceedsVesselCapacity;
        default: return true;
      }
    });
  }, [validationFiltered, ttbFilter, reconMap]);

  // Sort batches
  const batches = useMemo(() => {
    const sorted = [...ttbFiltered].sort((a: any, b: any) => {
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
        case "endingVolume":
          cmp = (reconMap.get(a.id)?.reconstructedEndingLiters ?? parseFloat(a.currentVolumeLiters || "0"))
              - (reconMap.get(b.id)?.reconstructedEndingLiters ?? parseFloat(b.currentVolumeLiters || "0"));
          break;
        case "gallons":
          cmp = (reconMap.get(a.id)?.ending ?? parseFloat(a.currentVolumeLiters || "0") * 0.2642)
              - (reconMap.get(b.id)?.ending ?? parseFloat(b.currentVolumeLiters || "0") * 0.2642);
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
  }, [ttbFiltered, sortField, sortDirection, reconMap]);

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

  // CSV Export handler
  const handleExportCSV = useCallback(async () => {
    const lines: string[] = [];
    lines.push(`Batch Reconciliation - ${yearFilter}`);
    lines.push(`Period,${reconStartDate} to ${reconEndDate}`);
    lines.push(`Generated,${new Date().toISOString().split("T")[0]}`);
    lines.push("");

    if (yearMetrics) {
      lines.push("TTB Balance (gal)");
      lines.push(`Opening,${yearMetrics.opening}`);
      lines.push(`Production,${yearMetrics.production}`);
      if (yearMetrics.netInternal !== 0) lines.push(`Internal Movement (net),${yearMetrics.netInternal}`);
      if (yearMetrics.adjustments !== 0) lines.push(`Reconciliation Adj.,${yearMetrics.adjustments}`);
      lines.push(`Distributed,${yearMetrics.distributed}`);
      lines.push(`Packaged (Bonded),${yearMetrics.packagedBonded}`);
      lines.push(`Losses,${yearMetrics.losses}`);
      if (yearMetrics.clampedVolume > 0.5) lines.push(`Clamping offset,${yearMetrics.clampedVolume}`);
      lines.push(`Distillation,${yearMetrics.distillation}`);
      lines.push(`Ending (Bulk),${yearMetrics.ending}`);
      lines.push(`Variance,${yearMetrics.variance}`);
      lines.push("");
    }

    if (batchRecon) {
      if (yearMetrics) {
        lines.push("Batch Aggregate (gal)");
        lines.push(`Opening,${yearMetrics.opening}`);
        lines.push(`Production,${yearMetrics.production}`);
        if (yearMetrics.netInternal !== 0) lines.push(`Internal Movement (net),${yearMetrics.netInternal}`);
        if (yearMetrics.adjustments !== 0) lines.push(`Reconciliation Adj.,${yearMetrics.adjustments}`);
        lines.push(`Distributed,${yearMetrics.distributed}`);
        lines.push(`Packaged (Bonded),${yearMetrics.packagedBonded}`);
        lines.push(`Losses,${yearMetrics.losses}`);
        if (yearMetrics.clampedVolume > 0.5) lines.push(`Clamping offset,${yearMetrics.clampedVolume}`);
        lines.push(`Distillation,${yearMetrics.distillation}`);
        lines.push(`Ending (Bulk),${yearMetrics.ending}`);
        lines.push(`Variance,${yearMetrics.variance}`);
      } else {
        lines.push("Batch Aggregate (gal)");
        lines.push(`Opening,${batchRecon.totals.opening}`);
        lines.push(`Production,${batchRecon.totals.production}`);
        lines.push(`Losses,${batchRecon.totals.losses}`);
        lines.push(`Sales,${batchRecon.totals.sales}`);
        lines.push(`Distillation,${batchRecon.totals.distillation}`);
        lines.push(`Ending,${batchRecon.totals.ending}`);
      }
      lines.push("");
      lines.push("Loss Breakdown (gal)");
      lines.push(`Racking,${batchRecon.lossBreakdown.racking}`);
      lines.push(`Filter,${batchRecon.lossBreakdown.filter}`);
      lines.push(`Bottling,${batchRecon.lossBreakdown.bottling}`);
      lines.push(`Kegging,${batchRecon.lossBreakdown.kegging}`);
      lines.push(`Transfer,${batchRecon.lossBreakdown.transfer}`);
      lines.push(`Adjustments,${batchRecon.lossBreakdown.adjustments}`);
      lines.push("");
    }

    const batchRows = batches.map((b: any) => {
      const recon = reconMap.get(b.id);
      return {
        name: b.customName || b.name || b.batchNumber,
        batchNumber: b.batchNumber,
        type: b.productType || "cider",
        startDate: b.startDate ? new Date(b.startDate).toLocaleDateString() : "",
        initialL: parseFloat(b.initialVolumeLiters || 0).toFixed(1),
        endingL: recon ? (recon.reconstructedEndingLiters ?? 0).toFixed(1) : parseFloat(b.currentVolumeLiters || 0).toFixed(1),
        endingGal: recon ? (recon.ending ?? 0).toFixed(2) : "",
        vessel: b.vesselName || "",
        driftL: recon ? recon.driftLiters.toFixed(2) : "",
        identity: recon ? (Math.abs(recon.identityCheck) >= 0.25 ? "FAIL" : "OK") : "",
        driftCheck: recon ? (Math.abs(recon.driftLiters) >= 0.5 ? "FAIL" : "OK") : "",
        initialCheck: recon ? (recon.hasInitialVolumeAnomaly ? "ANOMALY" : "OK") : "",
        capacityCheck: recon ? (recon.exceedsVesselCapacity ? "OVER" : "OK") : "",
        status: b.reconciliationStatus || "pending",
      };
    });

    const batchCSV = arrayToCSV(batchRows as any[], [
      { key: "name", header: "Batch Name" },
      { key: "batchNumber", header: "Batch Number" },
      { key: "type", header: "Type" },
      { key: "startDate", header: "Start Date" },
      { key: "initialL", header: "Initial (L)" },
      { key: "endingL", header: "Ending (L)" },
      { key: "endingGal", header: "Ending (gal)" },
      { key: "vessel", header: "Vessel" },
      { key: "driftL", header: "Drift (L)" },
      { key: "identity", header: "Identity" },
      { key: "driftCheck", header: "Drift" },
      { key: "initialCheck", header: "Initial Volume" },
      { key: "capacityCheck", header: "Vessel Capacity" },
      { key: "status", header: "Status" },
    ]);

    const fullCSV = lines.join("\n") + "Batch Detail\n" + batchCSV;
    downloadCSV(fullCSV, `batch-reconciliation-${yearFilter}.csv`);
  }, [yearFilter, reconStartDate, reconEndDate, yearMetrics, batchRecon, batches, reconMap]);

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
            href="/reports"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Reports
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ClipboardCheck className="w-8 h-8 text-amber-600 mr-3" />
            Batch Reconciliation
          </h1>
          <p className="text-gray-600 mt-2">
            Automated validation for TTB Form 5120.17 reporting. Batches are verified when all data quality checks pass.
          </p>
        </div>

        {/* Filter Bar */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Period type */}
              <Select value={pendingPeriodType} onValueChange={(v) => {
                if (v === "annual") setPendingPeriod("annual");
                else if (v === "quarterly") setPendingPeriod("q1");
                else if (v === "monthly") setPendingPeriod("m1");
              }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              {/* Year */}
              <Select value={String(pendingYear)} onValueChange={(v) => setPendingYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Quarter selector (conditional) */}
              {pendingPeriodType === "quarterly" && (
                <Select value={pendingPeriod} onValueChange={setPendingPeriod}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="q1">Q1 (Jan–Mar)</SelectItem>
                    <SelectItem value="q2">Q2 (Apr–Jun)</SelectItem>
                    <SelectItem value="q3">Q3 (Jul–Sep)</SelectItem>
                    <SelectItem value="q4">Q4 (Oct–Dec)</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Month selector (conditional) */}
              {pendingPeriodType === "monthly" && (
                <Select value={pendingPeriod} onValueChange={setPendingPeriod}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m1">January</SelectItem>
                    <SelectItem value="m2">February</SelectItem>
                    <SelectItem value="m3">March</SelectItem>
                    <SelectItem value="m4">April</SelectItem>
                    <SelectItem value="m5">May</SelectItem>
                    <SelectItem value="m6">June</SelectItem>
                    <SelectItem value="m7">July</SelectItem>
                    <SelectItem value="m8">August</SelectItem>
                    <SelectItem value="m9">September</SelectItem>
                    <SelectItem value="m10">October</SelectItem>
                    <SelectItem value="m11">November</SelectItem>
                    <SelectItem value="m12">December</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Go button */}
              <Button size="sm" onClick={applyPeriod}>Go</Button>

              {/* Export */}
              <ReportExportDropdown
                onExportCSV={handleExportCSV}
                disabled={isLoading || !data?.batches?.length}
              />

              {/* Divider */}
              <div className="h-8 w-px bg-gray-200" />

              {/* Product type filter */}
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

              {/* Status filter */}
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

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search batch name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {(statusFilter !== "all" || validationFilter !== "all" || productTypeFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setValidationFilter("all"); setProductTypeFilter("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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

        {/* Period Status Banner */}
        {periodStatus && periodStatus.finalizedPeriods.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">Period Finalization</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {periodStatus.finalizedPeriods.map((p: any) => (
                <Badge key={p.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Lock className="w-3 h-3 mr-1" />
                  {p.periodStart} → {p.periodEnd}
                  <span className="text-xs text-green-500 ml-1">
                    ({new Date(p.finalizedAt).toLocaleDateString()})
                  </span>
                </Badge>
              ))}
            </div>
            {periodStatus.currentPeriodFinalized && (
              <p className="text-xs text-amber-700 mt-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                The selected period overlaps a finalized snapshot. Changes to underlying data may cause discrepancies.
              </p>
            )}
          </div>
        )}

        {/* Identity Check + Double-Counting Alerts */}
        {batchRecon && (
          <div className="mb-4 space-y-2">
            {/* Identity Check Banner */}
            <div className={`p-3 rounded-lg border ${
              identityCheckPasses
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center gap-2">
                {identityCheckPasses ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
                <span className={`text-sm font-semibold ${identityCheckPasses ? "text-green-800" : "text-amber-800"}`}>
                  {identityCheckPasses
                    ? "Identity check passed — all volume accounted for"
                    : `Identity imbalance: ${Math.abs(batchRecon.identityCheck).toFixed(1)} gal across ${batchRecon.batchesWithIdentityIssues} batch${batchRecon.batchesWithIdentityIssues !== 1 ? "es" : ""}`}
                </span>
              </div>
              {!identityCheckPasses && (
                <p className="text-xs text-amber-700 mt-1 ml-7">
                  Opening + Pressed Juice + Purchased Juice - Distributed - Packaged (Bonded) - Losses - Distillation should equal Ending (Bulk). Click below to drill down into per-batch contributions.
                </p>
              )}
            </div>

            {/* Double-Counting Alerts */}
            {(batchRecon.batchesWithDrift > 0 || batchRecon.batchesWithInitialAnomaly > 0 || batchRecon.vesselCapacityWarnings > 0) && (
              <div className="flex flex-wrap gap-2">
                {batchRecon.batchesWithDrift > 0 && (
                  <button
                    onClick={() => { setTtbFilter("drift"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-sm text-red-800"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {batchRecon.batchesWithDrift} batch{batchRecon.batchesWithDrift !== 1 ? "es" : ""} with volume drift
                  </button>
                )}
                {batchRecon.batchesWithInitialAnomaly > 0 && (
                  <button
                    onClick={() => { setTtbFilter("initialAnomaly"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-sm text-orange-800"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {batchRecon.batchesWithInitialAnomaly} initial volume anomal{batchRecon.batchesWithInitialAnomaly !== 1 ? "ies" : "y"}
                  </button>
                )}
                {batchRecon.vesselCapacityWarnings > 0 && (
                  <button
                    onClick={() => { setTtbFilter("capacity"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-sm text-purple-800"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {batchRecon.vesselCapacityWarnings} vessel capacity warning{batchRecon.vesselCapacityWarnings !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}
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
            // All batch-level checks pass but aggregate variance doesn't reconcile
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
                        <p className="text-gray-600 mt-2">System Total: {yearMetrics.systemCalculated.toLocaleString()} gal</p>
                        {Math.abs(yearMetrics.systemVariance) > 0.1 && (
                          <p className={`${Math.abs(yearMetrics.systemVariance) < 10 ? "text-green-700" : Math.abs(yearMetrics.systemVariance) < 100 ? "text-amber-700" : "text-red-700"}`}>
                            Variance: {yearMetrics.systemVariance > 0 ? "+" : ""}{yearMetrics.systemVariance.toFixed(1)} gal
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-gray-700 mb-1">TTB Balance ({yearFilter})</p>
                        <table className="text-xs w-full">
                          <tbody className="text-gray-700">
                            <tr>
                              <td className="pr-2">Opening</td>
                              <td className="text-right">{yearMetrics.opening.toLocaleString()} gal</td>
                            </tr>
                            <tr>
                              <td className="pr-2">+ Production</td>
                              <td className="text-right">{yearMetrics.production.toLocaleString()} gal</td>
                            </tr>
                            {yearMetrics.netInternal !== 0 && (
                              <tr>
                                <td className="pr-2">{yearMetrics.netInternal >= 0 ? "+" : "-"} Internal Movement (net)</td>
                                <td className="text-right">{Math.abs(yearMetrics.netInternal).toLocaleString()} gal</td>
                              </tr>
                            )}
                            {yearMetrics.adjustments !== 0 && (
                              <tr className="text-blue-700">
                                <td className="pr-2" title={
                                  (yearMetrics.waterfallAdjustments ?? []).map((a: any) =>
                                    `${a.reason}${a.notes ? `: ${a.notes.substring(0, 100)}` : ''}`
                                  ).join('\n') || 'No adjustments'
                                }>
                                  {yearMetrics.adjustments >= 0 ? "+" : "-"} Reconciliation Adj.
                                </td>
                                <td className="text-right">{Math.abs(yearMetrics.adjustments).toLocaleString()} gal</td>
                              </tr>
                            )}
                            <tr>
                              <td className="pr-2">- Distributed</td>
                              <td className="text-right">{yearMetrics.distributed.toLocaleString()} gal</td>
                            </tr>
                            <tr>
                              <td className="pr-2">- Packaged (Bonded)</td>
                              <td className="text-right">{yearMetrics.packagedBonded.toLocaleString()} gal</td>
                            </tr>
                            <tr>
                              <td className="pr-2">- Losses</td>
                              <td className="text-right">{yearMetrics.losses.toLocaleString()} gal</td>
                            </tr>
                            {yearMetrics.clampedVolume > 0.5 && (
                              <tr className="text-amber-600" title="Volume from batches that went negative during SBD reconstruction. Clamped to 0 in the ending total — this offset restores the waterfall identity.">
                                <td className="pr-2">+ Clamping offset</td>
                                <td className="text-right">{yearMetrics.clampedVolume.toLocaleString()} gal</td>
                              </tr>
                            )}
                            <tr>
                              <td className="pr-2">- Distillation</td>
                              <td className="text-right">{yearMetrics.distillation.toLocaleString()} gal</td>
                            </tr>
                            <tr className="border-t border-gray-300 font-semibold">
                              <td className="pr-2 pt-1">= Ending (Bulk)</td>
                              <td className="text-right pt-1">{yearMetrics.ending.toLocaleString()} gal</td>
                            </tr>
                            <tr className={`text-xs ${Math.abs(yearMetrics.variance) < 1 ? "text-green-600" : Math.abs(yearMetrics.variance) < 10 ? "text-amber-600" : "text-red-600"}`}>
                              <td className="pr-2 pt-1">Variance</td>
                              <td className="text-right pt-1">{yearMetrics.variance > 0 ? "+" : ""}{yearMetrics.variance.toFixed(1)} gal</td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Clamped volume warning */}
        {(() => {
          const clampedVol = (reconciliationData as any)?.clampedVolume ?? 0;
          if (clampedVol <= 0.5 || isOpeningYear) return null;
          return (
            <Card className="mb-4 border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-amber-700">
                  {clampedVol.toFixed(1)} gal lost to clamping (batches that went negative during volume reconstruction) — indicates data quality issues.
                </p>
              </CardContent>
            </Card>
          );
        })()}

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
              Expand rows to see TTB volume reconstruction, check details, and fix links.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TTB Filter Chips */}
            {batchRecon && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { key: "all", label: "All", count: batches.length },
                  { key: "identityIssues", label: "Identity Issues", count: batchRecon.batchesWithIdentityIssues },
                  { key: "drift", label: "Has Drift", count: batchRecon.batchesWithDrift },
                  { key: "initialAnomaly", label: "Initial Anomaly", count: batchRecon.batchesWithInitialAnomaly },
                  { key: "capacity", label: "Over Capacity", count: batchRecon.vesselCapacityWarnings },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setTtbFilter(chip.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      ttbFilter === chip.key
                        ? "bg-gray-900 text-white"
                        : chip.count > 0 || chip.key === "all"
                          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          : "bg-gray-50 text-gray-400 cursor-default"
                    }`}
                    disabled={chip.count === 0 && chip.key !== "all"}
                  >
                    {chip.label} ({chip.count})
                  </button>
                ))}
              </div>
            )}

            {/* Summary Row — mirrors the TTB Balance waterfall categories */}
            {batchRecon && yearMetrics && (
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <p className="text-xs text-gray-500">Opening</p>
                  <p className="font-semibold">{yearMetrics.opening.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Production</p>
                  <p className="font-semibold text-green-700">+{yearMetrics.production.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Distributed</p>
                  <p className="font-semibold text-red-700">-{yearMetrics.distributed.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Packaged (Bonded)</p>
                  <p className="font-semibold text-red-700">-{yearMetrics.packagedBonded.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Losses</p>
                  <p className="font-semibold text-red-700">-{yearMetrics.losses.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Distillation</p>
                  <p className="font-semibold text-red-700">-{yearMetrics.distillation.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ending (Bulk)</p>
                  <p className="font-semibold">{yearMetrics.ending.toFixed(1)} gal</p>
                </div>
              </div>
            )}
            {batchRecon && !yearMetrics && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <p className="text-xs text-gray-500">Opening</p>
                  <p className="font-semibold">{batchRecon.totals.opening.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Production</p>
                  <p className="font-semibold">{batchRecon.totals.production.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Losses</p>
                  <p className="font-semibold">{batchRecon.totals.losses.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Sales</p>
                  <p className="font-semibold">{batchRecon.totals.sales.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Distillation</p>
                  <p className="font-semibold">{batchRecon.totals.distillation.toFixed(1)} gal</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ending (Bulk)</p>
                  <p className="font-semibold">{batchRecon.totals.ending.toFixed(1)} gal</p>
                </div>
              </div>
            )}

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
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("endingVolume")}>
                        <span className="flex items-center justify-end">Ending (L){sortIcon("endingVolume")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => handleSort("gallons")}>
                        <span className="flex items-center justify-end">Gallons{sortIcon("gallons")}</span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("vesselName")}>
                        <span className="flex items-center">Vessel{sortIcon("vesselName")}</span>
                      </TableHead>
                      <TableHead className="text-right">Drift</TableHead>
                      <TableHead className="text-center">
                        <span>Checks</span>
                        <div className="flex items-center justify-center gap-0.5 text-[9px] text-gray-400 font-normal mt-0.5">
                          <span className="w-3.5 text-center" title="Identity Check">ID</span>
                          <span className="w-3.5 text-center" title="Drift">DR</span>
                          <span className="w-3.5 text-center" title="Initial Volume">IV</span>
                          <span className="w-3.5 text-center" title="Vessel Capacity">VC</span>
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort("validation")}>
                        <span className="flex items-center">Status{sortIcon("validation")}</span>
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
                        reconMap={reconMap}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Aggregate Loss Breakdown */}
            {batchRecon?.lossBreakdown && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 mb-2">Aggregate Loss Breakdown (gal)</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div>Racking: <span className="font-mono">{batchRecon.lossBreakdown.racking.toFixed(1)}</span></div>
                  <div>Filter: <span className="font-mono">{batchRecon.lossBreakdown.filter.toFixed(1)}</span></div>
                  <div>Bottling: <span className="font-mono">{batchRecon.lossBreakdown.bottling.toFixed(1)}</span></div>
                  <div>Kegging: <span className="font-mono">{batchRecon.lossBreakdown.kegging.toFixed(1)}</span></div>
                  <div>Transfer: <span className="font-mono">{batchRecon.lossBreakdown.transfer.toFixed(1)}</span></div>
                  <div>Adjustments: <span className="font-mono">{batchRecon.lossBreakdown.adjustments.toFixed(1)}</span></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TTB Form 5120.17 Reference */}
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
                    TTB Form 5120.17 Reference ({yearFilter})
                  </CardTitle>
                  <CardDescription>
                    Per-tax-class numbers for TTB Form 5120.17 — Report of Wine Premises Operations
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="border-t-0 rounded-t-none">
                <CardContent className="pt-4">
                  {(() => {
                    const waterfall = (reconciliationData as any)?.waterfall;
                    if (!waterfall?.byTaxClass?.length) {
                      if (reconciliationData && "hasOpeningBalances" in reconciliationData && reconciliationData.hasOpeningBalances) {
                        return <div className="text-center py-4 text-gray-500">Loading TTB data...</div>;
                      }
                      if (reconciliationData) {
                        return (
                          <div className="text-center py-4 text-gray-500">
                            No TTB opening balances configured. Set up opening balances in{" "}
                            <Link href="/admin/ttb-onboarding" className="text-blue-600 hover:underline">
                              TTB Onboarding
                            </Link>{" "}
                            first.
                          </div>
                        );
                      }
                      return <div className="text-center py-4 text-gray-500">Loading TTB summary...</div>;
                    }

                    // Build column order: (f) Hard Cider first (main product), then (b)-(e), then (a) Total
                    const allEntries: any[] = waterfall.byTaxClass;
                    // Official TTB column letters and labels
                    const ttbColumns: Record<string, { letter: string; label: string }> = {
                      hardCider: { letter: "(f)", label: "Hard Cider" },
                      wineUnder16: { letter: "(b)", label: "Table Wine\n\u226416%" },
                      wine16To21: { letter: "(c)", label: "Table Wine\n16-21%" },
                      wine21To24: { letter: "(d)", label: "Table Wine\n21-24%" },
                      carbonatedWine: { letter: "(e)", label: "Artificially\nCarbonated" },
                      sparklingWine: { letter: "(e)", label: "Sparkling\nWine" },
                    };
                    // Filter to columns with data, in official order
                    const columnOrder = ["hardCider", "wineUnder16", "wine16To21", "wine21To24", "carbonatedWine", "sparklingWine"];
                    const activeColumns = columnOrder.filter((tc) =>
                      allEntries.some((e: any) => e.taxClass === tc)
                    );
                    const getEntry = (taxClass: string) =>
                      allEntries.find((e: any) => e.taxClass === taxClass) || {};

                    // Form 5120.17 data from generateForm512017
                    const fd = (formData512017 as any)?.formData;
                    const bulkByClass: Record<string, any> = fd?.bulkWinesByTaxClass || {};
                    const bottledByClass: Record<string, any> = fd?.bottledWinesByTaxClass || {};

                    // Helper: render a row with per-column values from waterfall
                    const renderWaterfallRow = (
                      lineNum: string,
                      desc: string,
                      dataKey: string,
                      opts?: { bold?: boolean; bg?: string; border?: boolean; negate?: boolean }
                    ) => {
                      let total = 0;
                      return (
                        <tr key={lineNum + dataKey} className={`${opts?.border ? "border-t-2 border-gray-300" : "border-b"} ${opts?.bg || ""}`}>
                          <td className={`py-1.5 pr-4 text-gray-700 whitespace-nowrap ${opts?.bold ? "font-semibold" : ""}`}>
                            {lineNum}. {desc}
                          </td>
                          {activeColumns.map((tc) => {
                            const val = (getEntry(tc) as any)[dataKey] ?? 0;
                            const display = opts?.negate ? -val : val;
                            total += val;
                            return (
                              <td key={tc} className={`text-right py-1.5 px-3 tabular-nums ${opts?.bold ? "font-semibold" : ""}`}>
                                {display.toFixed(1)}
                              </td>
                            );
                          })}
                          <td className={`text-right py-1.5 pl-3 tabular-nums border-l ${opts?.bold ? "font-bold" : "font-semibold"}`}>
                            {(opts?.negate ? -total : total).toFixed(1)}
                          </td>
                        </tr>
                      );
                    };

                    // Helper: render a row with per-column values from form data (bulkWinesByTaxClass)
                    const renderFormRow = (
                      lineNum: string,
                      desc: string,
                      fieldName: string,
                      source: Record<string, any>,
                      opts?: { bold?: boolean; bg?: string; border?: boolean }
                    ) => {
                      let total = 0;
                      return (
                        <tr key={lineNum + fieldName} className={`${opts?.border ? "border-t-2 border-gray-300" : "border-b"} ${opts?.bg || ""}`}>
                          <td className={`py-1.5 pr-4 text-gray-700 whitespace-nowrap ${opts?.bold ? "font-semibold" : ""}`}>
                            {lineNum}. {desc}
                          </td>
                          {activeColumns.map((tc) => {
                            const section = source[tc];
                            const val = section?.[fieldName] ?? 0;
                            total += val;
                            return (
                              <td key={tc} className={`text-right py-1.5 px-3 tabular-nums ${opts?.bold ? "font-semibold" : ""}`}>
                                {val.toFixed(1)}
                              </td>
                            );
                          })}
                          <td className={`text-right py-1.5 pl-3 tabular-nums border-l ${opts?.bold ? "font-bold" : "font-semibold"}`}>
                            {total.toFixed(1)}
                          </td>
                        </tr>
                      );
                    };

                    // Helper: render a computed row (values from a callback per column)
                    const renderComputedRow = (
                      lineNum: string,
                      desc: string,
                      computeFn: (tc: string) => number,
                      opts?: { bold?: boolean; bg?: string; border?: boolean }
                    ) => {
                      let total = 0;
                      return (
                        <tr key={lineNum + desc} className={`${opts?.border ? "border-t-2 border-gray-300" : "border-b"} ${opts?.bg || ""}`}>
                          <td className={`py-1.5 pr-4 text-gray-700 whitespace-nowrap ${opts?.bold ? "font-semibold" : ""}`}>
                            {lineNum}. {desc}
                          </td>
                          {activeColumns.map((tc) => {
                            const val = computeFn(tc);
                            total += val;
                            return (
                              <td key={tc} className={`text-right py-1.5 px-3 tabular-nums ${opts?.bold ? "font-semibold" : ""}`}>
                                {val.toFixed(1)}
                              </td>
                            );
                          })}
                          <td className={`text-right py-1.5 pl-3 tabular-nums border-l ${opts?.bold ? "font-bold" : "font-semibold"}`}>
                            {total.toFixed(1)}
                          </td>
                        </tr>
                      );
                    };

                    // Column header
                    const headerRow = (
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 pr-4 font-medium text-gray-600 min-w-[260px]">Line</th>
                        {activeColumns.map((tc) => {
                          const col = ttbColumns[tc];
                          return (
                            <th key={tc} className="text-right py-2 px-3 font-medium text-gray-600 whitespace-pre-line text-xs min-w-[90px]">
                              {col?.letter} {col?.label}
                            </th>
                          );
                        })}
                        <th className="text-right py-2 pl-3 font-bold text-gray-800 whitespace-nowrap border-l text-xs min-w-[80px]">
                          (a) Total
                        </th>
                      </tr>
                    );

                    // Section A computed values
                    const getLine4 = (tc: string) => bulkByClass[tc]?.line4_wineSpirits ?? 0;
                    const getLine12 = (tc: string) => {
                      const e = getEntry(tc) as any;
                      return (e.openingBulk ?? 0) + (e.production ?? 0) + getLine4(tc)
                        + (bulkByClass[tc]?.line9_inventoryGains ?? 0);
                    };
                    const getLine30 = (tc: string) => {
                      const e = getEntry(tc) as any;
                      return e.losses ?? 0;
                    };
                    const getLine32 = (tc: string) => {
                      const e = getEntry(tc) as any;
                      return (e.packaging ?? 0) + (e.distillation ?? 0)
                        + (bulkByClass[tc]?.line14_removedTaxpaid ?? 0)
                        + (bulkByClass[tc]?.line19_wineSpirits ?? 0)
                        + getLine30(tc) + (e.bulkEnding ?? 0);
                    };

                    // Section B computed values
                    const getBLine7 = (tc: string) => {
                      const e = getEntry(tc) as any;
                      return (e.openingPackaged ?? 0) + (e.packaging ?? 0);
                    };
                    const getBLine21 = (tc: string) => {
                      const e = getEntry(tc) as any;
                      return (e.sales ?? 0) + (e.packagedEnding ?? 0);
                    };

                    // Part III (Spirits) — use distillery operations from form data
                    const distOps = fd?.distilleryOperations;
                    const spiritsOpening = fd?.beginningInventory;
                    const spiritsEnding = fd?.endingInventory;

                    // Part IV (Materials) — from form data
                    const materials = fd?.materials;

                    const batchDetails = (reconciliationData as any)?.batchDetailsByTaxClass || {};

                    return (
                      <div className="space-y-6">
                        {/* PART I, SECTION A — BULK WINES */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                            Part I, Section A — Bulk Wines in Storage (Wine Gallons)
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>{headerRow}</thead>
                              <tbody>
                                {renderWaterfallRow("1", "On hand beginning of period", "openingBulk")}
                                {renderWaterfallRow("2", "Produced by fermentation", "production")}
                                {renderComputedRow("4", "Produced by addition of wine spirits", getLine4)}
                                {renderComputedRow("12", "TOTAL (lines 1-11)", getLine12, { bold: true, border: true })}
                                {renderWaterfallRow("13", "Transferred to bottled wine storage", "packaging")}
                                {renderFormRow("14", "Removed taxpaid", "line14_removedTaxpaid", bulkByClass)}
                                {renderWaterfallRow("16", "Used for distilling material", "distillation")}
                                {renderFormRow("19", "Used for addition of wine spirits", "line19_wineSpirits", bulkByClass)}
                                {renderComputedRow("30", "Losses", getLine30)}
                                {renderWaterfallRow("31", "On hand end of period", "bulkEnding", { bold: true, bg: "bg-blue-50" })}
                                {renderComputedRow("32", "TOTAL (lines 13-31)", getLine32, { bold: true, border: true })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* PART I, SECTION B — BOTTLED/PACKED WINES */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                            Part I, Section B — Bottled Wines in Storage (Wine Gallons)
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>{headerRow}</thead>
                              <tbody>
                                {renderWaterfallRow("1", "On hand beginning of period", "openingPackaged")}
                                {renderWaterfallRow("2", "Bottled/kegged from bulk", "packaging")}
                                {renderComputedRow("7", "TOTAL (lines 1-6)", getBLine7, { bold: true, border: true })}
                                {renderWaterfallRow("8", "Removed taxpaid", "sales")}
                                {renderWaterfallRow("20", "On hand end of period", "packagedEnding", { bold: true, bg: "bg-blue-50" })}
                                {renderComputedRow("21", "TOTAL (lines 8-20)", getBLine21, { bold: true, border: true })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* PART III — DISTILLED SPIRITS */}
                        {distOps && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                              Part III — Distilled Spirits in Storage (Wine Gallons)
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm max-w-md">
                                <thead>
                                  <tr className="border-b-2 border-gray-300">
                                    <th className="text-left py-2 pr-4 font-medium text-gray-600 min-w-[260px]">Line</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">Apple Brandy</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">1. On hand beginning of period</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">
                                      {((getEntry("appleBrandy") as any).openingBulk ?? 0).toFixed(1)}
                                    </td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">3. Received from DSP</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">
                                      {(distOps.brandyReceived ?? 0).toFixed(1)}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-t-2 border-gray-300">
                                    <td className="py-1.5 pr-4 text-gray-700 font-semibold">4. Total</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">
                                      {(((getEntry("appleBrandy") as any).openingBulk ?? 0)
                                        + (distOps.brandyReceived ?? 0)).toFixed(1)}
                                    </td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">6. Used for fortification</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">
                                      {(distOps.brandyUsedInCider ?? 0).toFixed(1)}
                                    </td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">9. Losses</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">
                                      {((getEntry("appleBrandy") as any).losses ?? 0).toFixed(1)}
                                    </td>
                                  </tr>
                                  <tr className="border-t-2 border-gray-300 bg-blue-50">
                                    <td className="py-1.5 pr-4 text-gray-700 font-semibold">10. On hand end of period</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">
                                      {((getEntry("appleBrandy") as any).bulkEnding ?? 0).toFixed(1)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* PART IV — MATERIALS RECEIVED AND USED */}
                        {materials && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                              Part IV — Materials Received and Used
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b-2 border-gray-300">
                                    <th className="text-left py-2 pr-4 font-medium text-gray-600 min-w-[200px]">Line</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs whitespace-pre-line">{"(a) Apples\n(lbs)"}</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs whitespace-pre-line">{"(c) Other Fruit\n(lbs)"}</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs whitespace-pre-line">{"(e) Juice\n(gal)"}</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs whitespace-pre-line">{"(f) Sugar\n(lbs)"}</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs whitespace-pre-line">{"(d) Honey\n(lbs)"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">1. On hand first of period</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">2. Received</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.applesReceivedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.otherFruitReceivedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.appleJuiceGallons ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.sugarReceivedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.honeyReceivedLbs ?? 0).toFixed(0)}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">4. Used — Wine</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.applesUsedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.otherFruitUsedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.appleJuiceGallons ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.sugarUsedLbs ?? 0).toFixed(0)}</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">{(materials.honeyUsedLbs ?? 0).toFixed(0)}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">5. Used — Effervescent wine</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="py-1.5 pr-4 text-gray-700">9. Used — Other</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums">0.0</td>
                                  </tr>
                                  <tr className="border-t-2 border-gray-300 bg-blue-50">
                                    <td className="py-1.5 pr-4 text-gray-700 font-semibold">10. On hand end of period</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">0.0</td>
                                    <td className="text-right py-1.5 px-3 tabular-nums font-semibold">0.0</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Combined summary */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Total Ending (A.31 + B.20):</span>
                              <span className="ml-2 font-semibold">
                                {activeColumns.reduce((sum, tc) => {
                                  const e = getEntry(tc) as any;
                                  return sum + (e.bulkEnding ?? 0) + (e.packagedEnding ?? 0);
                                }, 0).toFixed(1)} gal
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">System On Hand:</span>
                              <span className="ml-2 font-semibold">
                                {activeColumns.reduce((sum, tc) => {
                                  const e = getEntry(tc) as any;
                                  return sum + (e.bulk ?? 0) + (e.packaged ?? 0);
                                }, 0).toFixed(1)} gal
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Batch Detail by Tax Class */}
                        {Object.keys(batchDetails).length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800">Inventory by Tax Class</h4>
                            {activeColumns.map((tc) => {
                              const col = ttbColumns[tc];
                              const batchList = batchDetails[tc];
                              if (!batchList?.length) return null;
                              const bulkBatches = batchList.filter((b: any) => b.type === "bulk");
                              const packagedBatches = batchList.filter((b: any) => b.type === "packaged");
                              const totalGal = batchList.reduce((s: number, b: any) => s + b.volumeGallons, 0);
                              const renderBatchRow = (b: any) => (
                                <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-1 pr-2 text-xs">
                                    <Link href={`/batch/${b.batchId || b.id}`} className="text-blue-600 hover:underline font-mono">
                                      {(b.batchNumber || "").substring(0, 30)}
                                    </Link>
                                  </td>
                                  <td className="py-1 px-2 text-xs text-gray-700 truncate max-w-[200px]">
                                    {b.name}{b.vesselName ? ` — ${b.vesselName}` : ""}{b.packageInfo ? ` (${b.packageInfo})` : ""}
                                  </td>
                                  <td className="py-1 px-2 text-xs text-gray-500 whitespace-nowrap">
                                    {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"}
                                  </td>
                                  <td className="py-1 pl-2 text-xs text-right tabular-nums whitespace-nowrap">
                                    {b.volumeGallons.toFixed(1)} gal
                                  </td>
                                </tr>
                              );
                              return (
                                <Collapsible key={tc}>
                                  <CollapsibleTrigger asChild>
                                    <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 w-full text-left py-1">
                                      <ChevronRight className="w-4 h-4" />
                                      {col?.letter} {col?.label.replace("\n", " ")} — {batchList.length} batch{batchList.length !== 1 ? "es" : ""}, {totalGal.toFixed(1)} gal
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-6 mt-1 space-y-2">
                                      {bulkBatches.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-500 mb-1">Bulk ({bulkBatches.reduce((s: number, b: any) => s + b.volumeGallons, 0).toFixed(1)} gal)</p>
                                          <table className="w-full">
                                            <tbody>
                                              {bulkBatches.map(renderBatchRow)}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                      {packagedBatches.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-500 mb-1">Packaged ({packagedBatches.reduce((s: number, b: any) => s + b.volumeGallons, 0).toFixed(1)} gal)</p>
                                          <table className="w-full">
                                            <tbody>
                                              {packagedBatches.map(renderBatchRow)}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        )}

                        {/* Variance summary */}
                        {yearMetrics && !yearMetrics.isConfigured && (
                          <div className={`p-3 rounded-lg ${
                            Math.abs(yearMetrics.systemVariance) < 10
                              ? "bg-green-50"
                              : Math.abs(yearMetrics.systemVariance) < 100
                                ? "bg-amber-50"
                                : "bg-red-50"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Variance (TTB Calculated vs System)</span>
                              <span className={`text-lg font-bold ${
                                Math.abs(yearMetrics.systemVariance) < 10
                                  ? "text-green-700"
                                  : Math.abs(yearMetrics.systemVariance) < 100
                                    ? "text-amber-700"
                                    : "text-red-700"
                              }`}>
                                {yearMetrics.systemVariance > 0 ? "+" : ""}{yearMetrics.systemVariance} gal
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-gray-400">
                          All values in wine gallons. Use these numbers to fill in TTB Form 5120.17.
                        </p>
                      </div>
                    );
                  })()}
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
