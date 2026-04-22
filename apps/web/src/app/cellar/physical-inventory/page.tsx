"use client";

import React, { useState, useMemo, useCallback } from "react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  SkipForward,
  ClipboardCheck,
  List,
  LayoutGrid,
  Beaker,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// --- Constants ---

const LITERS_PER_GALLON = 3.78541;
const MEASUREMENT_METHODS = [
  { value: "dipstick", label: "Dipstick" },
  { value: "sight_glass", label: "Sight Glass" },
  { value: "flowmeter", label: "Flowmeter" },
  { value: "estimated", label: "Estimated" },
  { value: "weighed", label: "Weighed" },
] as const;

type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number]["value"];

// --- Helpers ---

function litersToGallons(liters: number): number {
  return liters / LITERS_PER_GALLON;
}

function gallonsToLiters(gallons: number): number {
  return gallons * LITERS_PER_GALLON;
}

function formatGallons(gallons: number): string {
  return gallons.toFixed(2);
}

function varianceColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs <= 2) return "text-green-700 bg-green-50 border-green-200";
  if (abs <= 5) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function varianceBadgeVariant(
  pct: number
): "default" | "secondary" | "destructive" | "outline" {
  const abs = Math.abs(pct);
  if (abs <= 2) return "secondary";
  if (abs <= 5) return "outline";
  return "destructive";
}

// --- Types ---

interface CountEntry {
  physicalGallons: number;
  method: MeasurementMethod;
  notes: string;
  saved: boolean;
}

type Vessel = {
  vesselId: string;
  vesselName: string;
  vesselCapacity: number | null;
  vesselMaterial: string | null;
  bookVolumeLiters: number;
  batches: Array<{
    id: string;
    name: string;
    productType: string;
    volumeLiters: number;
  }>;
};

// --- Component ---

export default function PhysicalInventoryPage() {
  const { toast } = useToast();

  // --- State ---
  const [mode, setMode] = useState<"card" | "table">("card");
  const [currentVesselIndex, setCurrentVesselIndex] = useState(0);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [countedVessels, setCountedVessels] = useState<
    Map<string, CountEntry>
  >(new Map());
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Card mode form state
  const [cardPhysicalGallons, setCardPhysicalGallons] = useState("");
  const [cardMethod, setCardMethod] = useState<MeasurementMethod>("estimated");
  const [cardNotes, setCardNotes] = useState("");

  // Table mode inline edit state
  const [editingVesselId, setEditingVesselId] = useState<string | null>(null);
  const [tablePhysicalGallons, setTablePhysicalGallons] = useState("");
  const [tableMethod, setTableMethod] =
    useState<MeasurementMethod>("estimated");
  const [tableNotes, setTableNotes] = useState("");

  // --- Queries ---
  const vesselsQuery = trpc.ttb.getVesselsForPhysicalCount.useQuery(
    { includeEmpty: false },
    { enabled: true }
  );

  const summaryQuery = trpc.ttb.getPhysicalInventorySummary.useQuery(
    { reconciliationSnapshotId: snapshotId! },
    { enabled: !!snapshotId && isCompleted }
  );

  // --- Mutations ---
  const saveReconciliation = trpc.ttb.saveReconciliation.useMutation();
  const saveCount = trpc.ttb.savePhysicalInventoryCount.useMutation();

  // --- Derived ---
  const vessels: Vessel[] = vesselsQuery.data?.vessels ?? [];
  const currentVessel: Vessel | undefined = vessels[currentVesselIndex];
  const totalVessels = vessels.length;
  const countedCount = countedVessels.size;
  const progressPct =
    totalVessels > 0 ? (countedCount / totalVessels) * 100 : 0;

  const summaryStats = useMemo(() => {
    let totalBookGal = 0;
    let totalPhysicalGal = 0;
    const variances: Array<{
      vesselName: string;
      bookGal: number;
      physicalGal: number;
      varianceGal: number;
      variancePct: number;
    }> = [];

    for (const v of vessels) {
      const bookGal = litersToGallons(v.bookVolumeLiters);
      totalBookGal += bookGal;
      const entry = countedVessels.get(v.vesselId);
      if (entry?.saved) {
        totalPhysicalGal += entry.physicalGallons;
        const varianceGal = entry.physicalGallons - bookGal;
        const variancePct = bookGal > 0 ? (varianceGal / bookGal) * 100 : 0;
        variances.push({
          vesselName: v.vesselName,
          bookGal,
          physicalGal: entry.physicalGallons,
          varianceGal,
          variancePct,
        });
      }
    }

    variances.sort(
      (a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct)
    );
    const significantCount = variances.filter(
      (v) => Math.abs(v.variancePct) > 2
    ).length;

    return {
      totalBookGal,
      totalPhysicalGal,
      netVarianceGal: totalPhysicalGal - totalBookGal,
      variances,
      significantCount,
    };
  }, [vessels, countedVessels]);

  // --- Handlers ---

  const handleStartCount = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await saveReconciliation.mutateAsync({
        reconciliationDate: today,
        name: `Physical Count - ${today}`,
        summary: {
          openingBalanceDate: null,
          totals: {
            ttbBalance: 0,
            currentInventory: 0,
            removals: 0,
            legacyBatches: 0,
            difference: 0,
          },
        },
      });
      setSnapshotId(result.id);
      setIsActive(true);
      setCountedVessels(new Map());
      setCurrentVesselIndex(0);
      setIsCompleted(false);
      toast({
        title: "Count Started",
        description: `Counting ${totalVessels} vessels with inventory.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to start count.",
        variant: "destructive",
      });
    }
  }, [saveReconciliation, totalVessels, toast]);

  const handleSaveCount = useCallback(
    async (
      vesselId: string,
      physicalGallons: number,
      method: MeasurementMethod,
      notes: string
    ) => {
      if (!snapshotId) return;

      try {
        await saveCount.mutateAsync({
          reconciliationSnapshotId: snapshotId,
          vesselId,
          physicalVolumeLiters: gallonsToLiters(physicalGallons),
          measurementMethod: method,
          notes: notes || undefined,
        });

        setCountedVessels((prev) => {
          const next = new Map(prev);
          next.set(vesselId, {
            physicalGallons,
            method,
            notes,
            saved: true,
          });
          return next;
        });

        toast({ title: "Saved", description: "Count recorded." });
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to save count.",
          variant: "destructive",
        });
      }
    },
    [snapshotId, saveCount, toast]
  );

  const handleCardSave = useCallback(async () => {
    if (!currentVessel) return;
    const gallons = parseFloat(cardPhysicalGallons);
    if (isNaN(gallons) || gallons < 0) {
      toast({
        title: "Invalid Volume",
        description: "Please enter a valid volume in gallons.",
        variant: "destructive",
      });
      return;
    }
    await handleSaveCount(
      currentVessel.vesselId,
      gallons,
      cardMethod,
      cardNotes
    );
  }, [currentVessel, cardPhysicalGallons, cardMethod, cardNotes, handleSaveCount, toast]);

  const handleCardSaveAndNext = useCallback(async () => {
    await handleCardSave();
    if (currentVesselIndex < totalVessels - 1) {
      setCurrentVesselIndex((i) => i + 1);
      setCardPhysicalGallons("");
      setCardMethod("estimated");
      setCardNotes("");
    }
  }, [handleCardSave, currentVesselIndex, totalVessels]);

  const handleCardPrevious = useCallback(() => {
    if (currentVesselIndex > 0) {
      setCurrentVesselIndex((i) => i - 1);
      const prevVessel = vessels[currentVesselIndex - 1];
      if (prevVessel) {
        const entry = countedVessels.get(prevVessel.vesselId);
        if (entry) {
          setCardPhysicalGallons(String(entry.physicalGallons));
          setCardMethod(entry.method);
          setCardNotes(entry.notes);
        } else {
          setCardPhysicalGallons("");
          setCardMethod("estimated");
          setCardNotes("");
        }
      }
    }
  }, [currentVesselIndex, vessels, countedVessels]);

  const handleCardSkip = useCallback(() => {
    if (currentVesselIndex < totalVessels - 1) {
      setCurrentVesselIndex((i) => i + 1);
      setCardPhysicalGallons("");
      setCardMethod("estimated");
      setCardNotes("");
    }
  }, [currentVesselIndex, totalVessels]);

  const handleTableSave = useCallback(
    async (vesselId: string) => {
      const gallons = parseFloat(tablePhysicalGallons);
      if (isNaN(gallons) || gallons < 0) {
        toast({
          title: "Invalid Volume",
          description: "Please enter a valid volume in gallons.",
          variant: "destructive",
        });
        return;
      }
      await handleSaveCount(vesselId, gallons, tableMethod, tableNotes);
      setEditingVesselId(null);
      setTablePhysicalGallons("");
      setTableMethod("estimated");
      setTableNotes("");
    },
    [tablePhysicalGallons, tableMethod, tableNotes, handleSaveCount, toast]
  );

  const handleStartEditing = useCallback(
    (vessel: Vessel) => {
      setEditingVesselId(vessel.vesselId);
      const entry = countedVessels.get(vessel.vesselId);
      if (entry) {
        setTablePhysicalGallons(String(entry.physicalGallons));
        setTableMethod(entry.method);
        setTableNotes(entry.notes);
      } else {
        setTablePhysicalGallons("");
        setTableMethod("estimated");
        setTableNotes("");
      }
    },
    [countedVessels]
  );

  const handleCompleteCount = useCallback(() => {
    setIsCompleted(true);
    setIsActive(false);
    toast({
      title: "Count Complete",
      description: `${countedCount} of ${totalVessels} vessels counted.`,
    });
  }, [countedCount, totalVessels, toast]);

  // Load existing entry when navigating in card mode
  const loadCardEntry = useCallback(
    (index: number) => {
      const vessel = vessels[index];
      if (!vessel) return;
      const entry = countedVessels.get(vessel.vesselId);
      if (entry) {
        setCardPhysicalGallons(String(entry.physicalGallons));
        setCardMethod(entry.method);
        setCardNotes(entry.notes);
      } else {
        setCardPhysicalGallons("");
        setCardMethod("estimated");
        setCardNotes("");
      }
    },
    [vessels, countedVessels]
  );

  // Compute real-time variance for card mode
  const cardVariance = useMemo(() => {
    if (!currentVessel || !cardPhysicalGallons) return null;
    const physical = parseFloat(cardPhysicalGallons);
    if (isNaN(physical)) return null;
    const bookGal = litersToGallons(currentVessel.bookVolumeLiters);
    const diff = physical - bookGal;
    const pct = bookGal > 0 ? (diff / bookGal) * 100 : 0;
    return { diff, pct };
  }, [currentVessel, cardPhysicalGallons]);

  // --- Loading / Error ---

  if (vesselsQuery.isLoading) {
    return (
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  if (vesselsQuery.isError) {
    return (
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Vessels
          </h2>
          <p className="text-gray-600 mb-4">
            {vesselsQuery.error?.message ?? "Unknown error"}
          </p>
          <Button onClick={() => vesselsQuery.refetch()}>Retry</Button>
        </div>
      </main>
    );
  }

  // --- Completed view ---

  if (isCompleted && snapshotId) {
    const serverSummary = summaryQuery.data;
    return (
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/cellar"
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          &larr; Back to Cellar
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Count Complete
            </h1>
          </div>
          <p className="text-gray-600">Physical inventory count summary</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Vessels</p>
              <p className="text-2xl font-bold">{totalVessels}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Counted</p>
              <p className="text-2xl font-bold">{countedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Skipped</p>
              <p className="text-2xl font-bold">
                {totalVessels - countedCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Net Variance</p>
              <p
                className={`text-2xl font-bold ${
                  summaryStats.netVarianceGal >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {summaryStats.netVarianceGal >= 0 ? "+" : ""}
                {formatGallons(summaryStats.netVarianceGal)} gal
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Totals row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Book Volume</p>
              <p className="text-xl font-semibold">
                {formatGallons(summaryStats.totalBookGal)} gal
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Physical Volume</p>
              <p className="text-xl font-semibold">
                {formatGallons(summaryStats.totalPhysicalGal)} gal
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Significant Variances</p>
              <p className="text-xl font-semibold">
                {summaryStats.significantCount}
                {summaryStats.significantCount > 0 && (
                  <span className="text-sm text-red-600 ml-1">(&gt;2%)</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Variance table */}
        {summaryStats.variances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Variances by Magnitude</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vessel</TableHead>
                    <TableHead className="text-right">Book (gal)</TableHead>
                    <TableHead className="text-right">
                      Physical (gal)
                    </TableHead>
                    <TableHead className="text-right">
                      Variance (gal)
                    </TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryStats.variances.map((v) => (
                    <TableRow key={v.vesselName}>
                      <TableCell className="font-medium">
                        {v.vesselName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatGallons(v.bookGal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatGallons(v.physicalGal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.varianceGal >= 0 ? "+" : ""}
                        {formatGallons(v.varianceGal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={varianceBadgeVariant(v.variancePct)}>
                          {v.variancePct >= 0 ? "+" : ""}
                          {v.variancePct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Server-loaded summary if available */}
        {summaryQuery.isLoading && (
          <p className="text-sm text-gray-500 mt-4">Loading server summary...</p>
        )}

        <div className="mt-8">
          <Link href="/cellar">
            <Button>Return to Cellar</Button>
          </Link>
        </div>
      </main>
    );
  }

  // --- Pre-start view ---

  if (!isActive) {
    return (
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/cellar"
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          &larr; Back to Cellar
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Physical Inventory Count
          </h1>
          <p className="text-gray-600 mt-1">
            Walk through your cellar and record physical volume measurements for
            each vessel.
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Start a New Count
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>{totalVessels}</strong> vessels with inventory will be
                included in this count.
              </p>
              <p>
                Total book volume:{" "}
                <strong>
                  {formatGallons(
                    litersToGallons(
                      vesselsQuery.data?.summary.totalBookVolumeLiters ?? 0
                    )
                  )}{" "}
                  gallons
                </strong>
              </p>
            </div>
            <Button
              onClick={handleStartCount}
              disabled={
                saveReconciliation.isPending || totalVessels === 0
              }
              className="w-full"
              size="lg"
            >
              {saveReconciliation.isPending
                ? "Creating Snapshot..."
                : "Start Physical Count"}
            </Button>
            {totalVessels === 0 && (
              <p className="text-sm text-amber-600">
                No vessels with inventory found. Nothing to count.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  // --- Active count view ---

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Link
        href="/cellar"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        &larr; Back to Cellar
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Physical Inventory Count
          </h1>
          <p className="text-gray-600 mt-1">
            {countedCount} of {totalVessels} vessels counted
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "card"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Card
            </button>
            <button
              onClick={() => setMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <List className="w-4 h-4" />
              Table
            </button>
          </div>
          <Button
            onClick={handleCompleteCount}
            variant="outline"
            disabled={countedCount === 0}
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Complete Count
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Counted
          </p>
          <p className="text-lg font-semibold">
            {countedCount} / {totalVessels}
          </p>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Total Variance
          </p>
          <p
            className={`text-lg font-semibold ${
              summaryStats.netVarianceGal >= 0
                ? "text-green-700"
                : "text-red-700"
            }`}
          >
            {summaryStats.netVarianceGal >= 0 ? "+" : ""}
            {formatGallons(summaryStats.netVarianceGal)} gal
          </p>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Significant (&gt;2%)
          </p>
          <p className="text-lg font-semibold">
            {summaryStats.significantCount}
          </p>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Progress
          </p>
          <Progress value={progressPct} className="mt-2" />
        </div>
      </div>

      {/* Card Mode */}
      {mode === "card" && currentVessel && (
        <div className="max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              Vessel {currentVesselIndex + 1} of {totalVessels}
            </p>
            <Progress
              value={((currentVesselIndex + 1) / totalVessels) * 100}
              className="w-48"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Beaker className="w-6 h-6 text-blue-600" />
                  <div>
                    <CardTitle className="text-xl">
                      {currentVessel.vesselName}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {currentVessel.vesselMaterial ?? "Unknown material"}
                      {currentVessel.vesselCapacity
                        ? ` - ${formatGallons(litersToGallons(currentVessel.vesselCapacity))} gal capacity`
                        : ""}
                    </p>
                  </div>
                </div>
                {countedVessels.get(currentVessel.vesselId)?.saved && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Counted
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Batch info */}
              {currentVessel.batches.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Batches
                  </p>
                  <div className="space-y-1">
                    {currentVessel.batches.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between text-sm bg-gray-50 px-3 py-1.5 rounded"
                      >
                        <span className="font-medium">{b.name}</span>
                        <span className="text-gray-500">
                          {formatGallons(litersToGallons(b.volumeLiters))} gal (
                          {b.productType})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Book volume */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-700">Book Volume</p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatGallons(
                    litersToGallons(currentVessel.bookVolumeLiters)
                  )}{" "}
                  <span className="text-lg font-normal">gal</span>
                </p>
              </div>

              {/* Physical volume input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Physical Volume (gallons)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter measured volume..."
                  value={cardPhysicalGallons}
                  onChange={(e) => setCardPhysicalGallons(e.target.value)}
                  className="text-2xl h-14 font-mono"
                  autoFocus
                />
              </div>

              {/* Real-time variance */}
              {cardVariance && (
                <div
                  className={`border rounded-lg px-4 py-3 ${varianceColor(cardVariance.pct)}`}
                >
                  <p className="text-sm font-medium">Variance</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl font-bold">
                      {cardVariance.diff >= 0 ? "+" : ""}
                      {formatGallons(cardVariance.diff)} gal
                    </span>
                    <span className="text-sm font-medium">
                      ({cardVariance.pct >= 0 ? "+" : ""}
                      {cardVariance.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Measurement method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Measurement Method
                </label>
                <Select
                  value={cardMethod}
                  onValueChange={(v) =>
                    setCardMethod(v as MeasurementMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Any observations..."
                  value={cardNotes}
                  onChange={(e) => setCardNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={handleCardPrevious}
                  disabled={currentVesselIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleCardSkip}
                    disabled={currentVesselIndex >= totalVessels - 1}
                  >
                    <SkipForward className="w-4 h-4 mr-1" />
                    Skip
                  </Button>
                  {currentVesselIndex < totalVessels - 1 ? (
                    <Button
                      onClick={handleCardSaveAndNext}
                      disabled={
                        saveCount.isPending || !cardPhysicalGallons
                      }
                    >
                      {saveCount.isPending ? "Saving..." : "Save & Next"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCardSave}
                      disabled={
                        saveCount.isPending || !cardPhysicalGallons
                      }
                    >
                      {saveCount.isPending ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table Mode */}
      {mode === "table" && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Book (gal)</TableHead>
                  <TableHead className="text-right">Physical (gal)</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels.map((vessel) => {
                  const bookGal = litersToGallons(vessel.bookVolumeLiters);
                  const entry = countedVessels.get(vessel.vesselId);
                  const isEditing = editingVesselId === vessel.vesselId;

                  // Compute inline variance for editing row
                  let inlineVariance: { diff: number; pct: number } | null =
                    null;
                  if (isEditing && tablePhysicalGallons) {
                    const p = parseFloat(tablePhysicalGallons);
                    if (!isNaN(p)) {
                      const d = p - bookGal;
                      const pc = bookGal > 0 ? (d / bookGal) * 100 : 0;
                      inlineVariance = { diff: d, pct: pc };
                    }
                  }

                  return (
                    <TableRow
                      key={vessel.vesselId}
                      className={isEditing ? "bg-blue-50/50" : undefined}
                    >
                      <TableCell className="font-medium">
                        {vessel.vesselName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {vessel.batches.map((b) => b.name).join(", ") ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatGallons(bookGal)}
                      </TableCell>

                      {/* Physical input */}
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tablePhysicalGallons}
                            onChange={(e) =>
                              setTablePhysicalGallons(e.target.value)
                            }
                            className="w-28 text-right font-mono ml-auto"
                            autoFocus
                          />
                        ) : entry?.saved ? (
                          <span className="font-mono">
                            {formatGallons(entry.physicalGallons)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      {/* Variance */}
                      <TableCell className="text-right">
                        {isEditing && inlineVariance ? (
                          <Badge
                            variant={varianceBadgeVariant(inlineVariance.pct)}
                          >
                            {inlineVariance.diff >= 0 ? "+" : ""}
                            {formatGallons(inlineVariance.diff)} (
                            {inlineVariance.pct.toFixed(1)}%)
                          </Badge>
                        ) : entry?.saved ? (
                          (() => {
                            const d = entry.physicalGallons - bookGal;
                            const p =
                              bookGal > 0 ? (d / bookGal) * 100 : 0;
                            return (
                              <Badge variant={varianceBadgeVariant(p)}>
                                {d >= 0 ? "+" : ""}
                                {formatGallons(d)} ({p.toFixed(1)}%)
                              </Badge>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      {/* Method */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={tableMethod}
                            onValueChange={(v) =>
                              setTableMethod(v as MeasurementMethod)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEASUREMENT_METHODS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : entry?.saved ? (
                          <span className="text-sm capitalize">
                            {entry.method.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {entry?.saved ? (
                          <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-400 text-sm">
                            Pending
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleTableSave(vessel.vesselId)
                              }
                              disabled={
                                saveCount.isPending || !tablePhysicalGallons
                              }
                            >
                              {saveCount.isPending ? "..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingVesselId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEditing(vessel)}
                          >
                            {entry?.saved ? "Edit" : "Count"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
