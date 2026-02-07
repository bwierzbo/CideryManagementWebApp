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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
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
  Wine,
  Grape,
  GlassWater,
  Calendar,
  Factory,
  Clock,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { formatDate, formatDateTime } from "@/utils/date-format";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ReportExportDropdown } from "@/components/reports/ReportExportDropdown";
import { useVolumeUnit } from "@/hooks/use-volume-unit";
import { VolumeUnitToggle } from "@/components/ui/volume-unit-toggle";
import { VolumeAdjustmentModal } from "@/components/cellar/VolumeAdjustmentModal";

// Type definitions matching the API response
type ProductTypeSummaryData = {
  productType: string;
  ttbTaxClass: string;
  batchCount: number;
  openingBalanceLiters: number;
  productionLiters: number;
  receiptsLiters: number;
  blendedInLiters: number;
  totalSourceLiters: number;
  packagedLiters: number;
  distilledLiters: number;
  blendedOutLiters: number;
  lossesLiters: number;
  endingBalanceLiters: number;
  totalDestinationLiters: number;
  discrepancyLiters: number;
  isBalanced: boolean;
};

type BatchData = {
  id: string;
  name: string;
  customName: string | null;
  batchNumber: string;
  productType: string | null;
  initialVolume: string | null;
  currentVolume: string | null;
  status: string | null;
  vesselName: string | null;
  vesselId: string | null;
  startDate: Date | string | null;
};

type DistilleryOpsData = {
  ciderSentLiters: number;
  brandyReceivedLiters: number;
  operations: Array<{
    id: string;
    type: "sent" | "received";
    sourceBatchId: string | null;
    sourceBatchName: string | null;
    resultBatchId: string | null;
    resultBatchName: string | null;
    volumeLiters: number;
    abv: number | null;
    date: Date | string;
    distilleryName: string;
    status: string;
  }>;
  pendingReturns: Array<{
    id: string;
    sourceBatchName: string;
    volumeSentLiters: number;
    sentAt: Date | string;
    distilleryName: string;
  }>;
};

type DiscrepancyData = {
  type: string;
  batchId: string;
  batchName: string;
  productType: string;
  description: string;
  volumeAffectedLiters: number;
  suggestedAction: string;
};

type TTBReportData = {
  periodStart: string;
  periodEnd: string;
  summaries: {
    cider: ProductTypeSummaryData;
    perry: ProductTypeSummaryData;
    brandy: ProductTypeSummaryData;
    pommeau: ProductTypeSummaryData;
    juice: ProductTypeSummaryData;
    other: ProductTypeSummaryData;
  };
  grandSummary: {
    totalBatches: number;
    totalSourceLiters: number;
    totalDestinationLiters: number;
    totalDiscrepancyLiters: number;
    isBalanced: boolean;
  };
  distilleryOps: DistilleryOpsData;
  batchesByType: {
    cider: BatchData[];
    perry: BatchData[];
    brandy: BatchData[];
    pommeau: BatchData[];
    juice: BatchData[];
    other: BatchData[];
  };
  discrepancies: DiscrepancyData[];
};

// Product type icons and colors
const productTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  cider: { icon: Wine, color: "text-amber-600", label: "Cider" },
  perry: { icon: Grape, color: "text-green-600", label: "Perry" },
  brandy: { icon: Flame, color: "text-red-600", label: "Brandy" },
  pommeau: { icon: GlassWater, color: "text-purple-600", label: "Pommeau" },
  juice: { icon: Droplets, color: "text-blue-600", label: "Juice" },
  other: { icon: Package, color: "text-gray-600", label: "Other" },
};

export default function BatchTraceReportPage() {
  // Default to current year period
  const currentYear = new Date().getFullYear();
  const [periodStart, setPeriodStart] = useState(`${currentYear}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(`${currentYear}-12-31`);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [adjustmentBatch, setAdjustmentBatch] = useState<{
    id: string;
    name: string;
    currentVolume: number;
    vesselName?: string;
  } | null>(null);
  const { unit, toggleUnit, format: formatVol } = useVolumeUnit();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.batch.getTTBBatchTraceReport.useQuery(
    { periodStart, periodEnd },
    { enabled: false }
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

  // Get batches for current tab
  const getBatchesForTab = () => {
    if (!data) return [];
    if (activeTab === "all") {
      return Object.values(data.batchesByType).flat();
    }
    return data.batchesByType[activeTab as keyof typeof data.batchesByType] || [];
  };

  // Get summary for current tab
  const getSummaryForTab = () => {
    if (!data) return null;
    if (activeTab === "all") {
      return data.grandSummary;
    }
    return data.summaries[activeTab as keyof typeof data.summaries];
  };

  const expandAll = () => {
    const batches = getBatchesForTab();
    setExpandedBatches(new Set(batches.map((b) => b.id)));
  };

  const collapseAll = () => {
    setExpandedBatches(new Set());
  };

  // Calculate combined cider/perry summary
  const getCombinedCiderPerrySummary = () => {
    if (!data) return null;
    const cider = data.summaries.cider;
    const perry = data.summaries.perry;
    return {
      productType: "cider_perry" as const,
      ttbTaxClass: "Wine (7% or less)",
      batchCount: cider.batchCount + perry.batchCount,
      openingBalanceLiters: cider.openingBalanceLiters + perry.openingBalanceLiters,
      productionLiters: cider.productionLiters + perry.productionLiters,
      receiptsLiters: cider.receiptsLiters + perry.receiptsLiters,
      blendedInLiters: cider.blendedInLiters + perry.blendedInLiters,
      totalSourceLiters: cider.totalSourceLiters + perry.totalSourceLiters,
      packagedLiters: cider.packagedLiters + perry.packagedLiters,
      distilledLiters: cider.distilledLiters + perry.distilledLiters,
      blendedOutLiters: cider.blendedOutLiters + perry.blendedOutLiters,
      lossesLiters: cider.lossesLiters + perry.lossesLiters,
      endingBalanceLiters: cider.endingBalanceLiters + perry.endingBalanceLiters,
      totalDestinationLiters: cider.totalDestinationLiters + perry.totalDestinationLiters,
      discrepancyLiters: cider.discrepancyLiters + perry.discrepancyLiters,
      isBalanced: cider.isBalanced && perry.isBalanced,
    };
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
              TTB Batch Trace Report
            </h1>
            <p className="text-gray-600 mt-1">
              Track inventory by product type for TTB Form 5120.17 compliance
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Report Period
            </CardTitle>
            <CardDescription>
              Select the reporting period to track inventory changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-48"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
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
              <VolumeUnitToggle unit={unit} onToggle={toggleUnit} />
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
            {/* Product Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                <TabsTrigger value="all" className="flex items-center gap-1">
                  All
                  <Badge variant="secondary" className="ml-1">
                    {data.grandSummary.totalBatches}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="cider_perry" className="flex items-center gap-1">
                  <Wine className="h-3 w-3" />
                  Cider/Perry
                  <Badge variant="secondary" className="ml-1">
                    {data.summaries.cider.batchCount + data.summaries.perry.batchCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="brandy" className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Brandy
                  <Badge variant="secondary" className="ml-1">
                    {data.summaries.brandy.batchCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pommeau" className="flex items-center gap-1">
                  <GlassWater className="h-3 w-3" />
                  Pommeau
                  <Badge variant="secondary" className="ml-1">
                    {data.summaries.pommeau.batchCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="other" className="flex items-center gap-1">
                  Other
                  <Badge variant="secondary" className="ml-1">
                    {data.summaries.juice.batchCount + data.summaries.other.batchCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Summary Cards based on tab */}
              <div className="mt-6">
                {activeTab === "all" && (
                  <GrandSummarySection data={data} formatVol={formatVol} />
                )}
                {activeTab === "cider_perry" && (
                  <ProductTypeSummarySection
                    summary={getCombinedCiderPerrySummary()!}
                    formatVol={formatVol}
                    showDistillery={true}
                    distilleryOps={data.distilleryOps}
                  />
                )}
                {activeTab === "brandy" && (
                  <ProductTypeSummarySection
                    summary={data.summaries.brandy}
                    formatVol={formatVol}
                    showDistillery={true}
                    distilleryOps={data.distilleryOps}
                    isBrandy={true}
                  />
                )}
                {activeTab === "pommeau" && (
                  <ProductTypeSummarySection
                    summary={data.summaries.pommeau}
                    formatVol={formatVol}
                  />
                )}
                {activeTab === "other" && (
                  <ProductTypeSummarySection
                    summary={{
                      ...data.summaries.juice,
                      batchCount: data.summaries.juice.batchCount + data.summaries.other.batchCount,
                      openingBalanceLiters: data.summaries.juice.openingBalanceLiters + data.summaries.other.openingBalanceLiters,
                      productionLiters: data.summaries.juice.productionLiters + data.summaries.other.productionLiters,
                      endingBalanceLiters: data.summaries.juice.endingBalanceLiters + data.summaries.other.endingBalanceLiters,
                      totalSourceLiters: data.summaries.juice.totalSourceLiters + data.summaries.other.totalSourceLiters,
                      totalDestinationLiters: data.summaries.juice.totalDestinationLiters + data.summaries.other.totalDestinationLiters,
                      discrepancyLiters: data.summaries.juice.discrepancyLiters + data.summaries.other.discrepancyLiters,
                      isBalanced: data.summaries.juice.isBalanced && data.summaries.other.isBalanced,
                    }}
                    formatVol={formatVol}
                  />
                )}
              </div>

              {/* Distillery Operations Section (for All tab) */}
              {activeTab === "all" && data.distilleryOps.operations.length > 0 && (
                <DistilleryOperationsSection
                  distilleryOps={data.distilleryOps}
                  formatVol={formatVol}
                />
              )}

              {/* Discrepancies Section */}
              {data.discrepancies.length > 0 && (activeTab === "all" ||
                data.discrepancies.some(d =>
                  activeTab === "cider_perry" ? (d.productType === "cider" || d.productType === "perry") :
                  activeTab === "other" ? (d.productType === "juice" || d.productType === "other") :
                  d.productType === activeTab
                )
              ) && (
                <DiscrepanciesSection
                  discrepancies={data.discrepancies.filter(d =>
                    activeTab === "all" ? true :
                    activeTab === "cider_perry" ? (d.productType === "cider" || d.productType === "perry") :
                    activeTab === "other" ? (d.productType === "juice" || d.productType === "other") :
                    d.productType === activeTab
                  )}
                  formatVol={formatVol}
                  onFixDiscrepancy={(batch) => setAdjustmentBatch(batch)}
                />
              )}

              {/* Batch List */}
              <TabsContent value={activeTab} className="mt-6">
                <BatchListSection
                  batches={
                    activeTab === "all" ? Object.values(data.batchesByType).flat() :
                    activeTab === "cider_perry" ? [...data.batchesByType.cider, ...data.batchesByType.perry] :
                    activeTab === "other" ? [...data.batchesByType.juice, ...data.batchesByType.other] :
                    data.batchesByType[activeTab as keyof typeof data.batchesByType] || []
                  }
                  expandedBatches={expandedBatches}
                  toggleBatch={toggleBatch}
                  expandAll={expandAll}
                  collapseAll={collapseAll}
                  formatVol={formatVol}
                  onFixDiscrepancy={(batch) => setAdjustmentBatch(batch)}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Initial state - no data yet */}
        {!data && !isLoading && !error && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a period and click "Generate Report" to see TTB batch tracing data.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Volume Adjustment Modal */}
      {adjustmentBatch && (
        <VolumeAdjustmentModal
          open={!!adjustmentBatch}
          onClose={() => {
            setAdjustmentBatch(null);
            refetch();
          }}
          batchId={adjustmentBatch.id}
          batchName={adjustmentBatch.name}
          currentVolumeL={adjustmentBatch.currentVolume}
          vesselName={adjustmentBatch.vesselName}
        />
      )}
    </div>
  );
}

// Grand Summary Section (All Products)
function GrandSummarySection({
  data,
  formatVol,
}: {
  data: TTBReportData;
  formatVol: (liters: number) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Product Type Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cider/Perry */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wine className="h-4 w-4 text-amber-600" />
              Cider/Perry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening:</span>
                <span className="font-mono">{formatVol(data.summaries.cider.openingBalanceLiters + data.summaries.perry.openingBalanceLiters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ending:</span>
                <span className="font-mono">{formatVol(data.summaries.cider.endingBalanceLiters + data.summaries.perry.endingBalanceLiters)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground">Discrepancy:</span>
                <span className={cn(
                  "font-mono",
                  Math.abs(data.summaries.cider.discrepancyLiters + data.summaries.perry.discrepancyLiters) > 1 ? "text-amber-600" : "text-green-600"
                )}>
                  {formatVol(data.summaries.cider.discrepancyLiters + data.summaries.perry.discrepancyLiters)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brandy */}
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-600" />
              Brandy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening:</span>
                <span className="font-mono">{formatVol(data.summaries.brandy.openingBalanceLiters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipts:</span>
                <span className="font-mono text-green-600">+{formatVol(data.summaries.brandy.receiptsLiters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ending:</span>
                <span className="font-mono">{formatVol(data.summaries.brandy.endingBalanceLiters)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pommeau */}
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GlassWater className="h-4 w-4 text-purple-600" />
              Pommeau
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening:</span>
                <span className="font-mono">{formatVol(data.summaries.pommeau.openingBalanceLiters)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ending:</span>
                <span className="font-mono">{formatVol(data.summaries.pommeau.endingBalanceLiters)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grand Total */}
        <Card className={cn(
          data.grandSummary.isBalanced ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {data.grandSummary.isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              Grand Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Batches:</span>
                <span className="font-mono">{data.grandSummary.totalBatches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-mono">{formatVol(data.grandSummary.totalSourceLiters)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground">Discrepancy:</span>
                <span className={cn(
                  "font-mono font-bold",
                  data.grandSummary.isBalanced ? "text-green-600" : "text-amber-600"
                )}>
                  {formatVol(data.grandSummary.totalDiscrepancyLiters)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Product Type Summary Section
function ProductTypeSummarySection({
  summary,
  formatVol,
  showDistillery = false,
  distilleryOps,
  isBrandy = false,
}: {
  summary: {
    productType: string;
    ttbTaxClass: string;
    batchCount: number;
    openingBalanceLiters: number;
    productionLiters: number;
    receiptsLiters: number;
    blendedInLiters: number;
    totalSourceLiters: number;
    packagedLiters: number;
    distilledLiters: number;
    blendedOutLiters: number;
    lossesLiters: number;
    endingBalanceLiters: number;
    totalDestinationLiters: number;
    discrepancyLiters: number;
    isBalanced: boolean;
  };
  formatVol: (liters: number) => string;
  showDistillery?: boolean;
  distilleryOps?: {
    ciderSentLiters: number;
    brandyReceivedLiters: number;
    operations: Array<{
      id: string;
      type: "sent" | "received";
      sourceBatchName: string | null;
      resultBatchName: string | null;
      volumeLiters: number;
      date: Date | string;
      distilleryName: string;
    }>;
    pendingReturns: Array<{
      id: string;
      sourceBatchName: string;
      volumeSentLiters: number;
      sentAt: Date | string;
      distilleryName: string;
    }>;
  };
  isBrandy?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* TTB Balance Equation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>TTB Balance: {summary.ttbTaxClass}</span>
            <Badge variant={summary.isBalanced ? "default" : "destructive"}>
              {summary.isBalanced ? "Balanced" : "Discrepancy"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Source Side */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="text-lg font-bold text-blue-700">{formatVol(summary.openingBalanceLiters)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-muted-foreground">+ Production</p>
              <p className="text-lg font-bold text-blue-600">{formatVol(summary.productionLiters)}</p>
            </div>
            {(summary.receiptsLiters > 0 || isBrandy) && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-muted-foreground">+ Receipts {isBrandy && "(from DSP)"}</p>
                <p className="text-lg font-bold text-green-600">{formatVol(summary.receiptsLiters)}</p>
              </div>
            )}

            {/* Destination Side */}
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs text-muted-foreground">- Packaged</p>
              <p className="text-lg font-bold text-emerald-600">{formatVol(summary.packagedLiters)}</p>
            </div>
            {showDistillery && !isBrandy && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-muted-foreground">- To Distillery</p>
                <p className="text-lg font-bold text-red-600">{formatVol(summary.distilledLiters)}</p>
              </div>
            )}
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-muted-foreground">- Losses</p>
              <p className="text-lg font-bold text-amber-600">{formatVol(summary.lossesLiters)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground">= Ending Balance</p>
              <p className="text-lg font-bold">{formatVol(summary.endingBalanceLiters)}</p>
            </div>
          </div>

          {/* Balance equation */}
          <div className="mt-4 p-3 bg-muted/30 rounded-md">
            <p className="text-sm text-center font-mono">
              <span className="text-blue-600">{formatVol(summary.openingBalanceLiters)}</span>
              {" + "}
              <span className="text-blue-600">{formatVol(summary.productionLiters)}</span>
              {summary.receiptsLiters > 0 && (
                <> + <span className="text-green-600">{formatVol(summary.receiptsLiters)}</span></>
              )}
              {" = "}
              <span className="text-emerald-600">{formatVol(summary.packagedLiters)}</span>
              {showDistillery && !isBrandy && (
                <> + <span className="text-red-600">{formatVol(summary.distilledLiters)}</span></>
              )}
              {" + "}
              <span className="text-amber-600">{formatVol(summary.lossesLiters)}</span>
              {" + "}
              <span>{formatVol(summary.endingBalanceLiters)}</span>
              {Math.abs(summary.discrepancyLiters) > 0.5 && (
                <>
                  {" ± "}
                  <span className="text-amber-600">{formatVol(summary.discrepancyLiters)}</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {summary.batchCount} batches | {summary.ttbTaxClass}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Distillery Operations Section
function DistilleryOperationsSection({
  distilleryOps,
  formatVol,
}: {
  distilleryOps: {
    ciderSentLiters: number;
    brandyReceivedLiters: number;
    operations: Array<{
      id: string;
      type: "sent" | "received";
      sourceBatchName: string | null;
      resultBatchName: string | null;
      volumeLiters: number;
      date: Date | string;
      distilleryName: string;
    }>;
    pendingReturns: Array<{
      id: string;
      sourceBatchName: string;
      volumeSentLiters: number;
      sentAt: Date | string;
      distilleryName: string;
    }>;
  };
  formatVol: (liters: number) => string;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4" />
          Distillery Operations
        </CardTitle>
        <CardDescription>
          Cider sent to distillery and brandy received back
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Cider Sent</p>
            <p className="text-xl font-bold text-red-600">{formatVol(distilleryOps.ciderSentLiters)}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Brandy Received</p>
            <p className="text-xl font-bold text-green-600">{formatVol(distilleryOps.brandyReceivedLiters)}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Pending Returns</p>
            <p className="text-xl font-bold text-amber-600">{distilleryOps.pendingReturns.length}</p>
          </div>
        </div>

        {distilleryOps.operations.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Distillery</TableHead>
                <TableHead className="text-right">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distilleryOps.operations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(op.date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={op.type === "sent" ? "destructive" : "default"}>
                      {op.type === "sent" ? "Sent" : "Received"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {op.type === "sent" ? op.sourceBatchName : op.resultBatchName}
                  </TableCell>
                  <TableCell>{op.distilleryName}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={op.type === "sent" ? "text-red-600" : "text-green-600"}>
                      {op.type === "sent" ? "-" : "+"}{formatVol(op.volumeLiters)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {distilleryOps.pendingReturns.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Returns
            </h4>
            <div className="space-y-2">
              {distilleryOps.pendingReturns.map((pending) => (
                <div key={pending.id} className="flex items-center justify-between p-2 bg-amber-50 rounded">
                  <div>
                    <span className="font-medium">{pending.sourceBatchName}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      → {pending.distilleryName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono">{formatVol(pending.volumeSentLiters)}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      sent {formatDate(pending.sentAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Discrepancies Section
function DiscrepanciesSection({
  discrepancies,
  formatVol,
  onFixDiscrepancy,
}: {
  discrepancies: Array<{
    type: string;
    batchId: string;
    batchName: string;
    productType: string;
    description: string;
    volumeAffectedLiters: number;
    suggestedAction: string;
  }>;
  formatVol: (liters: number) => string;
  onFixDiscrepancy: (batch: { id: string; name: string; currentVolume: number }) => void;
}) {
  return (
    <Card className="mt-6 border-amber-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Discrepancies ({discrepancies.length})
        </CardTitle>
        <CardDescription>
          Issues requiring attention for accurate TTB reporting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {discrepancies.map((d, idx) => {
            const config = productTypeConfig[d.productType] || productTypeConfig.other;
            const Icon = config.icon;

            return (
              <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/batch/${d.batchId}`} className="font-medium text-blue-600 hover:underline">
                          {d.batchName}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {d.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                      <p className="text-xs text-amber-700 mt-1">
                        <strong>Suggested:</strong> {d.suggestedAction}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-amber-600">{formatVol(d.volumeAffectedLiters)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs"
                      onClick={() => onFixDiscrepancy({
                        id: d.batchId,
                        name: d.batchName,
                        currentVolume: 0, // Will be fetched from batch
                      })}
                    >
                      Fix
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Batch List Section
function BatchListSection({
  batches,
  expandedBatches,
  toggleBatch,
  expandAll,
  collapseAll,
  formatVol,
  onFixDiscrepancy,
}: {
  batches: Array<{
    id: string;
    name: string;
    customName: string | null;
    batchNumber: string;
    productType: string | null;
    initialVolume: string | null;
    currentVolume: string | null;
    status: string | null;
    vesselName: string | null;
    startDate: Date | string | null;
  }>;
  expandedBatches: Set<string>;
  toggleBatch: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  formatVol: (liters: number) => string;
  onFixDiscrepancy: (batch: { id: string; name: string; currentVolume: number; vesselName?: string }) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Batch Details ({batches.length} batches)
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

      <div className="space-y-3">
        {batches.map((batch) => {
          const isExpanded = expandedBatches.has(batch.id);
          const config = productTypeConfig[batch.productType || "other"] || productTypeConfig.other;
          const Icon = config.icon;
          const initialVol = parseFloat(batch.initialVolume || "0");
          const currentVol = parseFloat(batch.currentVolume || "0");

          return (
            <Card key={batch.id}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleBatch(batch.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <Icon className={cn("h-5 w-5", config.color)} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/batch/${batch.id}`}
                              className="font-medium text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {batch.customName || batch.name}
                            </Link>
                            {batch.vesselName && (
                              <span className="text-muted-foreground text-sm">
                                ({batch.vesselName})
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {batch.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{batch.batchNumber}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="flex gap-4">
                          <div>
                            <span className="text-muted-foreground">Initial:</span>{" "}
                            <span className="font-mono">{formatVol(initialVol)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Current:</span>{" "}
                            <span className="font-mono">{formatVol(currentVol)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="p-3 bg-muted/30 rounded-md text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-muted-foreground">Product Type:</span>
                          <p className="font-medium capitalize">{batch.productType || "Other"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Start Date:</span>
                          <p className="font-medium">{batch.startDate ? formatDate(batch.startDate) : "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Initial Volume:</span>
                          <p className="font-medium">{formatVol(initialVol)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Current Volume:</span>
                          <p className="font-medium">{formatVol(currentVol)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

        {batches.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No batches found for this product type.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
