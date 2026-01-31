"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Beaker,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  Ruler,
  TrendingDown,
  Wine,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface BatchLifecycleAuditProps {
  reconciliationSnapshotId?: string;
  periodStartDate: string;
  periodEndDate: string;
}

// Liters to gallons conversion
const litersToGallons = (liters: number) => liters * 0.264172;
const formatVolume = (liters: number) => {
  const gal = litersToGallons(liters);
  return `${gal.toFixed(2)} gal`;
};

type TimelineEventType =
  | "creation"
  | "transfer_in"
  | "transfer_out"
  | "racking"
  | "filtering"
  | "packaging"
  | "volume_adjustment"
  | "carbonation";

const eventTypeLabels: Record<TimelineEventType, string> = {
  creation: "Created",
  transfer_in: "Received",
  transfer_out: "Transferred Out",
  racking: "Racked",
  filtering: "Filtered",
  packaging: "Packaged",
  volume_adjustment: "Adjustment",
  carbonation: "Carbonation",
};

const eventTypeColors: Record<TimelineEventType, string> = {
  creation: "bg-green-100 text-green-800 border-green-200",
  transfer_in: "bg-blue-100 text-blue-800 border-blue-200",
  transfer_out: "bg-orange-100 text-orange-800 border-orange-200",
  racking: "bg-purple-100 text-purple-800 border-purple-200",
  filtering: "bg-cyan-100 text-cyan-800 border-cyan-200",
  packaging: "bg-pink-100 text-pink-800 border-pink-200",
  volume_adjustment: "bg-yellow-100 text-yellow-800 border-yellow-200",
  carbonation: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export function BatchLifecycleAudit({
  reconciliationSnapshotId,
  periodStartDate,
  periodEndDate,
}: BatchLifecycleAuditProps) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [physicalCountDialogOpen, setPhysicalCountDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<{
    vesselId: string;
    vesselName: string;
    bookVolumeLiters: number;
  } | null>(null);

  // Get batches for selector
  const { data: batchList, isLoading: batchListLoading } = trpc.batch.list.useQuery({
    includeArchived: false,
    limit: 500, // Get more batches for selection
  });

  // Get batch lifecycle timeline
  const { data: timelineData, isLoading: timelineLoading } =
    trpc.ttb.getBatchLifecycleTimeline.useQuery(
      {
        batchId: selectedBatchId!,
        startDate: periodStartDate,
        endDate: periodEndDate,
      },
      { enabled: !!selectedBatchId }
    );

  // Get tax class overview
  const { data: taxClassData, isLoading: taxClassLoading } =
    trpc.ttb.getBatchLifecycleByTaxClass.useQuery({
      startDate: periodStartDate,
      endDate: periodEndDate,
    });

  // Get batch disposition summary
  const { data: dispositionData } = trpc.ttb.getBatchDispositionSummary.useQuery({
    endDate: periodEndDate,
  });

  // Get vessels for physical count
  const { data: vesselsData } = trpc.ttb.getVesselsForPhysicalCount.useQuery({
    reconciliationSnapshotId,
    includeEmpty: false,
  });

  // Get physical inventory summary if we have a reconciliation snapshot
  const { data: physicalSummary } = trpc.ttb.getPhysicalInventorySummary.useQuery(
    { reconciliationSnapshotId: reconciliationSnapshotId! },
    { enabled: !!reconciliationSnapshotId }
  );

  const utils = trpc.useUtils();

  // Save physical count mutation
  const savePhysicalCount = trpc.ttb.savePhysicalInventoryCount.useMutation({
    onSuccess: () => {
      toast({ title: "Physical count saved" });
      utils.ttb.getPhysicalInventorySummary.invalidate();
      utils.ttb.getVesselsForPhysicalCount.invalidate();
      setPhysicalCountDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error saving count", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5" />
          Batch Lifecycle Audit
        </CardTitle>
        <CardDescription>
          Track batch movements and compare book inventory to physical counts.
          Use this to identify and explain variances for TTB reconciliation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline">Batch Timeline</TabsTrigger>
            <TabsTrigger value="taxclass">Tax Class Overview</TabsTrigger>
            <TabsTrigger value="physical">Physical Inventory</TabsTrigger>
            <TabsTrigger value="disposition">Disposition</TabsTrigger>
          </TabsList>

          {/* Batch Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select
                  value={selectedBatchId || ""}
                  onValueChange={(v) => setSelectedBatchId(v)}
                  disabled={batchListLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={batchListLoading ? "Loading batches..." : "Select a batch to view timeline"} />
                  </SelectTrigger>
                  <SelectContent>
                    {batchList?.batches && batchList.batches.length > 0 ? (
                      batchList.batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.customName || batch.name} ({batch.productType})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {batchListLoading ? "Loading..." : "No batches found"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedBatchId && timelineLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {selectedBatchId && timelineData && (
              <div className="space-y-4">
                {/* Batch Summary Card */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Batch</div>
                        <div className="font-medium">{timelineData.batch.name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Initial Volume</div>
                        <div className="font-medium">
                          {formatVolume(timelineData.batch.initialVolumeLiters)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Current Volume</div>
                        <div className="font-medium">
                          {formatVolume(timelineData.batch.currentVolumeLiters)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Loss</div>
                        <div className="font-medium text-amber-600">
                          {formatVolume(timelineData.summary.totalLossLiters)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Events */}
                <div className="space-y-2">
                  {timelineData.events.map((event, idx) => (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border",
                        eventTypeColors[event.type as TimelineEventType]
                      )}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {eventTypeLabels[event.type as TimelineEventType]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="font-medium mt-1">{event.description}</div>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          {event.volumeChange !== null && (
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                event.volumeChange > 0
                                  ? "text-green-600"
                                  : event.volumeChange < 0
                                  ? "text-red-600"
                                  : ""
                              )}
                            >
                              {event.volumeChange > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : event.volumeChange < 0 ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : null}
                              {event.volumeChange > 0 ? "+" : ""}
                              {formatVolume(event.volumeChange)}
                            </span>
                          )}
                          {event.runningVolume !== null && (
                            <span className="text-muted-foreground">
                              Running: {formatVolume(event.runningVolume)}
                            </span>
                          )}
                          {event.lossLiters && event.lossLiters > 0 && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Loss: {formatVolume(event.lossLiters)}
                            </span>
                          )}
                        </div>
                        {event.vesselFrom && event.vesselTo && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            {event.vesselFrom} <ArrowRight className="h-3 w-3" /> {event.vesselTo}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!selectedBatchId && (
              <div className="text-center py-8 text-muted-foreground">
                Select a batch to view its lifecycle timeline
              </div>
            )}
          </TabsContent>

          {/* Tax Class Overview Tab */}
          <TabsContent value="taxclass" className="space-y-4">
            {taxClassLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : taxClassData ? (
              <div className="space-y-4">
                {/* Summary Row */}
                <div className="grid grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Opening</div>
                    <div className="font-medium">
                      {formatVolume(taxClassData.summary.totalOpeningLiters)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">+ Production</div>
                    <div className="font-medium text-green-600">
                      +{formatVolume(taxClassData.summary.totalProductionLiters)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">- Packaging</div>
                    <div className="font-medium text-blue-600">
                      -{formatVolume(taxClassData.summary.totalPackagingLiters)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">- Losses</div>
                    <div className="font-medium text-amber-600">
                      -{formatVolume(taxClassData.summary.totalLossesLiters)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">= Ending</div>
                    <div className="font-medium">
                      {formatVolume(taxClassData.summary.totalEndingLiters)}
                    </div>
                  </div>
                </div>

                {/* Tax Class Cards */}
                {taxClassData.taxClasses.map((tc) => (
                  <Collapsible key={tc.taxClass}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Wine className="h-4 w-4" />
                              {tc.taxClass === "hardCider"
                                ? "Hard Cider"
                                : tc.taxClass === "wine16To21"
                                ? "Wine 16-21%"
                                : tc.taxClass === "wineUnder16"
                                ? "Wine Under 16%"
                                : tc.taxClass === "appleBrandy"
                                ? "Apple Brandy"
                                : tc.taxClass}
                              <Badge variant="secondary" className="ml-2">
                                {tc.batches.length} batches
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-4">
                              {Math.abs(tc.variance) > 0.1 && (
                                <Badge
                                  variant={tc.variance < 0 ? "destructive" : "default"}
                                  className="flex items-center gap-1"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Variance: {formatVolume(tc.variance)}
                                </Badge>
                              )}
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {/* Flow Summary */}
                          <div className="grid grid-cols-7 gap-2 text-sm mb-4 p-3 bg-muted/30 rounded">
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">Opening</div>
                              <div className="font-mono">{formatVolume(tc.openingLiters)}</div>
                            </div>
                            <div className="text-center text-green-600">
                              <div className="text-xs">+ Produced</div>
                              <div className="font-mono">{formatVolume(tc.productionLiters)}</div>
                            </div>
                            <div className="text-center text-blue-600">
                              <div className="text-xs">+ Transfers In</div>
                              <div className="font-mono">{formatVolume(tc.transfersInLiters)}</div>
                            </div>
                            <div className="text-center text-orange-600">
                              <div className="text-xs">- Transfers Out</div>
                              <div className="font-mono">{formatVolume(tc.transfersOutLiters)}</div>
                            </div>
                            <div className="text-center text-pink-600">
                              <div className="text-xs">- Packaged</div>
                              <div className="font-mono">{formatVolume(tc.packagingLiters)}</div>
                            </div>
                            <div className="text-center text-amber-600">
                              <div className="text-xs">- Losses</div>
                              <div className="font-mono">{formatVolume(tc.lossesLiters)}</div>
                            </div>
                            <div className="text-center font-bold">
                              <div className="text-xs">= Ending</div>
                              <div className="font-mono">{formatVolume(tc.endingLiters)}</div>
                            </div>
                          </div>

                          {/* Batch Table */}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Batch</TableHead>
                                <TableHead>Vessel</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tc.batches.map((batch) => (
                                <TableRow
                                  key={batch.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => {
                                    setSelectedBatchId(batch.id);
                                    setActiveTab("timeline");
                                  }}
                                >
                                  <TableCell className="font-medium">{batch.name}</TableCell>
                                  <TableCell>{batch.vessel || "-"}</TableCell>
                                  <TableCell className="text-right">
                                    {formatVolume(batch.openingVolume)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatVolume(batch.currentVolume)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            ) : null}
          </TabsContent>

          {/* Physical Inventory Tab */}
          <TabsContent value="physical" className="space-y-4">
            {!reconciliationSnapshotId ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                Save a reconciliation snapshot to enable physical inventory tracking
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                {physicalSummary && (
                  <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Vessels Counted</div>
                      <div className="text-xl font-bold">{physicalSummary.summary.totalCounts}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Book Total</div>
                      <div className="text-xl font-bold">
                        {formatVolume(physicalSummary.summary.totalBookLiters)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Physical Total</div>
                      <div className="text-xl font-bold">
                        {formatVolume(physicalSummary.summary.totalPhysicalLiters)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Variance</div>
                      <div
                        className={cn(
                          "text-xl font-bold",
                          physicalSummary.summary.totalVarianceLiters > 0
                            ? "text-green-600"
                            : physicalSummary.summary.totalVarianceLiters < 0
                            ? "text-red-600"
                            : ""
                        )}
                      >
                        {physicalSummary.summary.totalVarianceLiters > 0 ? "+" : ""}
                        {formatVolume(physicalSummary.summary.totalVarianceLiters)}
                        <span className="text-sm font-normal ml-1">
                          ({physicalSummary.summary.overallVariancePercentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vessel List */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Batch(es)</TableHead>
                      <TableHead className="text-right">Book Volume</TableHead>
                      <TableHead className="text-right">Physical Count</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vesselsData?.vessels.map((vessel) => {
                      const existingCount = physicalSummary?.counts.find(
                        (c) => c.vesselId === vessel.vesselId
                      );
                      return (
                        <TableRow key={vessel.vesselId}>
                          <TableCell className="font-medium">{vessel.vesselName}</TableCell>
                          <TableCell>
                            {vessel.batches.length > 0
                              ? vessel.batches.map((b) => b.name).join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatVolume(vessel.bookVolumeLiters)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {existingCount
                              ? formatVolume(existingCount.physicalVolumeLiters)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {existingCount ? (
                              <span
                                className={cn(
                                  "font-mono",
                                  existingCount.varianceLiters > 0
                                    ? "text-green-600"
                                    : existingCount.varianceLiters < 0
                                    ? "text-red-600"
                                    : ""
                                )}
                              >
                                {existingCount.varianceLiters > 0 ? "+" : ""}
                                {formatVolume(existingCount.varianceLiters)}
                                <span className="text-xs ml-1">
                                  ({existingCount.variancePercentage.toFixed(1)}%)
                                </span>
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedVessel({
                                  vesselId: vessel.vesselId,
                                  vesselName: vessel.vesselName,
                                  bookVolumeLiters: vessel.bookVolumeLiters,
                                });
                                setPhysicalCountDialogOpen(true);
                              }}
                            >
                              <Ruler className="h-4 w-4 mr-1" />
                              Count
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          {/* Disposition Tab */}
          <TabsContent value="disposition" className="space-y-4">
            {dispositionData && (
              <>
                {/* Summary by Product Type */}
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(dispositionData.byProductType).map(([type, data]) => (
                    <Card key={type}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm capitalize">{type}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">In Vessel</span>
                          <span className="font-mono">{formatVolume(data.inVesselLiters)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Packaged</span>
                          <span className="font-mono">{formatVolume(data.packagedLiters)}</span>
                        </div>
                        <div className="flex justify-between text-amber-600">
                          <span>Lost</span>
                          <span className="font-mono">{formatVolume(data.lostLiters)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Batch Disposition Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Initial</TableHead>
                      <TableHead className="text-right">In Vessel</TableHead>
                      <TableHead className="text-right">Packaged</TableHead>
                      <TableHead className="text-right">Lost</TableHead>
                      <TableHead className="text-right">% Packaged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispositionData.batches.slice(0, 20).map((batch) => (
                      <TableRow
                        key={batch.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedBatchId(batch.id);
                          setActiveTab("timeline");
                        }}
                      >
                        <TableCell className="font-medium">{batch.name}</TableCell>
                        <TableCell className="capitalize">{batch.productType}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatVolume(batch.initialVolumeLiters)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatVolume(batch.disposition.inVesselLiters)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {formatVolume(batch.disposition.packagedLiters)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          {formatVolume(batch.disposition.lostLiters)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              batch.percentagePackaged > 90
                                ? "default"
                                : batch.percentagePackaged > 50
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {batch.percentagePackaged.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {dispositionData.batches.length > 20 && (
                  <div className="text-center text-sm text-muted-foreground">
                    Showing 20 of {dispositionData.batches.length} batches
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Physical Count Dialog */}
        <PhysicalCountDialog
          open={physicalCountDialogOpen}
          onOpenChange={setPhysicalCountDialogOpen}
          vessel={selectedVessel}
          reconciliationSnapshotId={reconciliationSnapshotId}
          onSave={savePhysicalCount.mutate}
          isLoading={savePhysicalCount.isPending}
        />
      </CardContent>
    </Card>
  );
}

// Physical Count Dialog Component
function PhysicalCountDialog({
  open,
  onOpenChange,
  vessel,
  reconciliationSnapshotId,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vessel: { vesselId: string; vesselName: string; bookVolumeLiters: number } | null;
  reconciliationSnapshotId?: string;
  onSave: (data: {
    reconciliationSnapshotId: string;
    vesselId: string;
    physicalVolumeLiters: number;
    measurementMethod?: "dipstick" | "sight_glass" | "flowmeter" | "estimated" | "weighed";
    notes?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [physicalGallons, setPhysicalGallons] = useState("");
  const [measurementMethod, setMeasurementMethod] = useState<string>("");
  const [notes, setNotes] = useState("");

  if (!vessel || !reconciliationSnapshotId) return null;

  const physicalLiters = parseFloat(physicalGallons || "0") / 0.264172;
  const variance = physicalLiters - vessel.bookVolumeLiters;
  const variancePercent =
    vessel.bookVolumeLiters > 0 ? (variance / vessel.bookVolumeLiters) * 100 : 0;

  const handleSave = () => {
    onSave({
      reconciliationSnapshotId,
      vesselId: vessel.vesselId,
      physicalVolumeLiters: physicalLiters,
      measurementMethod: measurementMethod as
        | "dipstick"
        | "sight_glass"
        | "flowmeter"
        | "estimated"
        | "weighed"
        | undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Physical Count - {vessel.vesselName}</DialogTitle>
          <DialogDescription>
            Book volume: {litersToGallons(vessel.bookVolumeLiters).toFixed(2)} gal
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Physical Volume (gallons)</label>
            <Input
              type="number"
              step="0.01"
              value={physicalGallons}
              onChange={(e) => setPhysicalGallons(e.target.value)}
              placeholder="Enter measured volume"
            />
          </div>
          {physicalGallons && (
            <div
              className={cn(
                "p-3 rounded-lg text-sm",
                variance > 0 ? "bg-green-50" : variance < 0 ? "bg-red-50" : "bg-gray-50"
              )}
            >
              <div className="font-medium">
                Variance: {variance > 0 ? "+" : ""}
                {litersToGallons(variance).toFixed(2)} gal ({variancePercent.toFixed(1)}%)
              </div>
              {Math.abs(variancePercent) > 2 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.abs(variancePercent) > 5
                    ? "Significant variance - please verify measurement"
                    : "Minor variance - may be normal evaporation"}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Measurement Method</label>
            <Select value={measurementMethod} onValueChange={setMeasurementMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dipstick">Dipstick</SelectItem>
                <SelectItem value="sight_glass">Sight Glass</SelectItem>
                <SelectItem value="flowmeter">Flowmeter</SelectItem>
                <SelectItem value="weighed">Weighed</SelectItem>
                <SelectItem value="estimated">Estimated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!physicalGallons || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Count
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
