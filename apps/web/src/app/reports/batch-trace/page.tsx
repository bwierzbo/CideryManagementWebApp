"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Package,
  Filter,
  Flame,
  Beer,
  TrendingDown,
  CornerDownRight,
  Droplets,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { formatDate, formatDateTime } from "@/utils/date-format";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ReportExportDropdown } from "@/components/reports/ReportExportDropdown";
import { downloadBatchTraceReportPDF } from "@/utils/pdf/batchTraceReport";
import { downloadBatchTraceReportExcel } from "@/utils/excel/batchTraceReport";
import { downloadBatchTraceReportCSV } from "@/utils/csv/batchTraceReport";

const typeIcons: Record<string, React.ElementType> = {
  transfer: ArrowRight,
  transfer_in: ArrowLeft,
  racking: FlaskConical,
  filtering: Filter,
  bottling: Package,
  kegging: Beer,
  distillation: Flame,
};

const typeColors: Record<string, string> = {
  transfer: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  transfer_in: "bg-green-500/10 text-green-700 border-green-500/20",
  racking: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  filtering: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  bottling: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  kegging: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  distillation: "bg-red-500/10 text-red-700 border-red-500/20",
};

const typeLabels: Record<string, string> = {
  transfer: "Transfer",
  transfer_in: "Blend In",
  racking: "Racking",
  filtering: "Filtering",
  bottling: "Bottling",
  kegging: "Kegging",
  distillation: "Distillation",
};

// Collapsible row component for transfers with child outcomes
function ExpandableEntryRow({
  entry,
  idx,
}: {
  entry: {
    id: string;
    date: Date | string;
    type: string;
    description: string;
    volumeOut: number;
    volumeIn: number;
    loss: number;
    destinationId: string | null;
    destinationName: string | null;
    childOutcomes?: { type: string; description: string; volume: number }[];
  };
  idx: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = typeIcons[entry.type] || ArrowRight;
  const colorClass = typeColors[entry.type] || "bg-gray-500/10 text-gray-700";
  const label = typeLabels[entry.type] || entry.type;
  const childOutcomes = entry.childOutcomes || [];
  const hasChildren = childOutcomes.length > 0;

  // Calculate child summary
  const childTotalLoss = childOutcomes
    .filter((c) => c.type === "loss")
    .reduce((sum, c) => sum + c.volume, 0);

  return (
    <React.Fragment>
      <TableRow
        className={hasChildren ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(entry.date)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {hasChildren && (
              expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )
            )}
            <Badge
              variant="outline"
              className={cn("flex items-center gap-1 w-fit text-xs", colorClass)}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          {entry.destinationId ? (
            <Link
              href={`/batch/${entry.destinationId}`}
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {entry.description}
            </Link>
          ) : (
            entry.description
          )}
          {hasChildren && !expanded && (
            <span className="text-xs text-muted-foreground ml-2">
              ({childOutcomes.length} outcomes)
            </span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono">
          {(entry.volumeIn ?? 0) > 0 ? (
            <span className="text-green-600">
              +{(entry.volumeIn ?? 0).toFixed(1)} L
            </span>
          ) : entry.volumeOut > 0 ? (
            <span className="text-blue-600">
              -{entry.volumeOut.toFixed(1)} L
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono">
          {/* Show transfer loss + child losses summary when collapsed */}
          {hasChildren && !expanded ? (
            <span className="text-amber-600">
              -{(entry.loss + childTotalLoss).toFixed(1)} L
            </span>
          ) : entry.loss > 0 ? (
            <span className="text-amber-600">
              -{entry.loss.toFixed(1)} L
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {/* Expanded child outcome rows */}
      {expanded && childOutcomes.map((child, childIdx) => {
        const isLoss = child.type === "loss";
        const isPackaging = child.type === "bottling" || child.type === "kegging";
        const isTransfer = child.type === "transfer";

        return (
          <TableRow
            key={`${entry.id}-child-${childIdx}`}
            className="bg-muted/30 text-sm"
          >
            <TableCell />
            <TableCell>
              <div className="flex items-center gap-1 text-muted-foreground pl-4">
                <CornerDownRight className="h-3 w-3" />
                {isLoss && <Droplets className="h-3 w-3 text-amber-600" />}
                {isPackaging && <Package className="h-3 w-3 text-emerald-600" />}
                {isTransfer && <ArrowRight className="h-3 w-3 text-indigo-600" />}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {child.description}
            </TableCell>
            <TableCell className="text-right font-mono">
              {isPackaging ? (
                <span className="text-emerald-600">{child.volume.toFixed(1)} L</span>
              ) : isTransfer ? (
                <span className="text-indigo-600">{child.volume.toFixed(1)} L</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">
              {isLoss ? (
                <span className="text-amber-600">-{child.volume.toFixed(1)} L</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </React.Fragment>
  );
}

export default function BatchTraceReportPage() {
  const [asOfDate, setAsOfDate] = useState("2025-01-01");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.batch.getBatchTraceReport.useQuery(
    { asOfDate },
    { enabled: false } // Don't auto-fetch
  );

  const handleGenerateReport = () => {
    refetch();
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (data?.batches) {
      setExpandedBatches(new Set(data.batches.map((b) => b.id)));
    }
  };

  const collapseAll = () => {
    setExpandedBatches(new Set());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="h-8 w-8 text-blue-600" />
              Batch Tracing Report
            </h1>
            <p className="text-gray-600 mt-1">
              Track where all base batch volume went - transfers, packaging, and losses
            </p>
          </div>
        </div>

        {/* Date Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Report Parameters</CardTitle>
            <CardDescription>
              Select a date to see all base batches that existed on or before that date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="asOfDate">As of Date</Label>
                <Input
                  id="asOfDate"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={handleGenerateReport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
              {data && (
                <ReportExportDropdown
                  disabled={isLoading}
                  onExportPDF={async () => {
                    await downloadBatchTraceReportPDF(data);
                  }}
                  onExportExcel={async () => {
                    await downloadBatchTraceReportExcel(data);
                  }}
                  onExportCSV={async () => {
                    downloadBatchTraceReportCSV(data);
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>Error loading report: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Content */}
        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Base Batches</p>
                  <p className="text-2xl font-bold">{data.summary.totalBatches}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Initial Volume</p>
                  <p className="text-2xl font-bold">{data.summary.totalInitialVolume.toFixed(1)} L</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Transferred</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {data.summary.totalTransferred.toFixed(1)} L
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Packaged</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {data.summary.totalPackaged.toFixed(1)} L
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Losses</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {data.summary.totalLosses.toFixed(1)} L
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Current Volume</p>
                  <p className="text-2xl font-bold">{data.summary.totalCurrentVolume.toFixed(1)} L</p>
                </CardContent>
              </Card>
            </div>

            {/* Batch List Controls */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Batch Details ({data.batches.length} batches)
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>

            {/* Batch Cards */}
            <div className="space-y-3">
              {data.batches.map((batch) => {
                const isExpanded = expandedBatches.has(batch.id);
                const hasDiscrepancy = Math.abs(batch.summary.discrepancy) > 0.5;

                return (
                  <Card key={batch.id} className={cn(hasDiscrepancy && "border-amber-300")}>
                    <Collapsible open={isExpanded} onOpenChange={() => toggleBatch(batch.id)}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div className="flex-1">
                                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                  <Link
                                    href={`/batch/${batch.id}`}
                                    className="text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {batch.customName || batch.name}
                                  </Link>
                                  {batch.vesselName && (
                                    <span className="text-muted-foreground font-normal text-sm">
                                      ({batch.vesselName})
                                    </span>
                                  )}
                                  <Badge variant="outline" className="ml-2">
                                    {batch.status}
                                  </Badge>
                                </CardTitle>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{batch.name}</p>
                                {/* Summary stats row - mirrors top-level summary */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Initial:</span>{" "}
                                    <span className="font-medium">{batch.initialVolume.toFixed(1)} L</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Transferred:</span>{" "}
                                    <span className="font-medium text-indigo-600">{batch.summary.totalOutflow.toFixed(1)} L</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Packaged:</span>{" "}
                                    <span className="font-medium text-emerald-600">{batch.summary.totalPackaged.toFixed(1)} L</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Losses:</span>{" "}
                                    <span className="font-medium text-amber-600">{batch.summary.totalLoss.toFixed(1)} L</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Current:</span>{" "}
                                    <span className="font-medium">{batch.currentVolume.toFixed(1)} L</span>
                                  </div>
                                  {hasDiscrepancy && (
                                    <div className="flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3 text-amber-500" />
                                      <span className="text-amber-600 font-medium">
                                        Discrepancy: {batch.summary.discrepancy > 0 ? "+" : ""}
                                        {batch.summary.discrepancy.toFixed(1)} L
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {batch.entries.length > 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  {batch.entries.length} event{batch.entries.length !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">No activity</span>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {batch.entries.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                              No volume flow events recorded for this batch
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[120px]">Date</TableHead>
                                  <TableHead className="w-[100px]">Type</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="text-right w-[100px]">Volume</TableHead>
                                  <TableHead className="text-right w-[80px]">Loss</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {batch.entries.map((entry, idx) => (
                                  <ExpandableEntryRow
                                    key={`${entry.type}-${entry.id}-${idx}`}
                                    entry={entry}
                                    idx={idx}
                                  />
                                ))}
                                {/* Summary row */}
                                <TableRow className="bg-muted/50 font-medium">
                                  <TableCell colSpan={3} className="text-right">
                                    Batch Totals:
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {(batch.summary.totalInflow ?? 0) > 0 && (
                                      <span className="text-green-600">+{(batch.summary.totalInflow ?? 0).toFixed(1)} L / </span>
                                    )}
                                    <span className="text-blue-600">-{batch.summary.totalOutflow.toFixed(1)} L</span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-amber-600">
                                    -{batch.summary.totalLoss.toFixed(1)} L
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          )}

                          {/* Batch accounting summary */}
                          <div className="mt-4 p-3 bg-muted/30 rounded-md text-sm">
                            <div className="flex items-center gap-2">
                              {hasDiscrepancy ? (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              <span>
                                Initial ({batch.initialVolume.toFixed(1)} L)
                                {(batch.summary.totalInflow ?? 0) > 0 && (
                                  <> + Inflow ({(batch.summary.totalInflow ?? 0).toFixed(1)} L)</>
                                )}
                                {" "}- Outflow ({batch.summary.totalOutflow.toFixed(1)} L) -
                                Losses ({batch.summary.totalLoss.toFixed(1)} L) =
                                Expected ({batch.summary.accountedVolume.toFixed(1)} L)
                                {hasDiscrepancy && (
                                  <span className="text-amber-600 ml-2">
                                    | Actual: {batch.currentVolume.toFixed(1)} L
                                    (Discrepancy: {batch.summary.discrepancy > 0 ? "+" : ""}
                                    {batch.summary.discrepancy.toFixed(1)} L)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>

            {data.batches.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No base batches found for the selected date.
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Initial state - no data yet */}
        {!data && !isLoading && !error && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a date and click "Generate Report" to see batch tracing data.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
