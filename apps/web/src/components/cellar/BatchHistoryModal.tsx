"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Calendar,
  Droplets,
  Factory,
  FlaskConical,
  Grape,
  TrendingUp,
  Activity,
  Beaker,
  Pencil,
  Check,
  X,
  BarChart3,
  List,
} from "lucide-react";
import { format } from "date-fns";
import { BatchActivityHistory } from "@/components/batch/BatchActivityHistory";
import { useToast } from "@/hooks/use-toast";
import { EditMeasurementDialog } from "@/components/cellar/EditMeasurementDialog";
import { EditAdditiveDialog } from "@/components/cellar/EditAdditiveDialog";
import { MeasurementChart } from "@/components/batch/MeasurementChart";

interface BatchHistoryModalProps {
  batchId: string;
  open: boolean;
  onClose: () => void;
}

export function BatchHistoryModal({
  batchId,
  open,
  onClose,
}: BatchHistoryModalProps) {
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editingMeasurement, setEditingMeasurement] = useState<any>(null);
  const [editingAdditive, setEditingAdditive] = useState<any>(null);
  const [measurementView, setMeasurementView] = useState<"chart" | "list">("chart");

  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch } = trpc.batch.getHistory.useQuery(
    { batchId },
    { enabled: open },
  );

  const updateBatch = trpc.batch.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Batch name updated successfully",
      });
      refetch();
      utils.bottles.list.invalidate(); // Invalidate bottles list since it shows batch names
      utils.dashboard.getRecentBatches.invalidate(); // Invalidate dashboard batch list
      setIsEditingName(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update batch name",
        variant: "destructive",
      });
    },
  });

  const handleEditName = () => {
    setEditedName(data?.batch.customName || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    updateBatch.mutate({
      batchId,
      customName: editedName,
    });
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  if (!open) return null;

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center py-8">Loading batch history...</div>;
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600">
          Error loading batch history: {error.message}
        </div>
      );
    }

    if (!data) {
      return <div className="text-center py-8">No data available</div>;
    }

    const { batch, origin, composition, measurements, additives } = data;

    return (
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="composition">Composition</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="additives">Additives</TabsTrigger>
        </TabsList>

        <div className="mt-4 max-h-[600px] overflow-y-auto">
          <TabsContent value="overview" className="space-y-4">
            {/* Batch Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Batch Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Batch ID</p>
                    <p className="font-semibold font-mono text-sm">
                      {batch.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Batch Name</p>
                    {isEditingName ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder="Enter batch name"
                          className="h-8 max-w-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSaveName}
                          disabled={updateBatch.isPending}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          disabled={updateBatch.isPending}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {batch.customName || (
                            <span className="text-gray-400 font-normal">
                              No name set
                            </span>
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditName}
                          className="h-6 w-6 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className="mt-1">{batch.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Vessel</p>
                    <p className="font-semibold">
                      {batch.vesselName || "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-semibold">
                      {format(new Date(batch.startDate), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Origin Info */}
            {origin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    Press Run Origin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Press Run</p>
                      <p className="font-semibold">
                        {origin.pressRunName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Apples</p>
                      <p className="font-semibold">
                        {origin.totalAppleWeightKg
                          ? `${parseFloat(origin.totalAppleWeightKg).toFixed(1)} kg`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Juice</p>
                      <p className="font-semibold">
                        {origin.totalJuiceVolume
                          ? `${parseFloat(origin.totalJuiceVolume).toFixed(1)} ${origin.totalJuiceVolumeUnit || 'L'}`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <BatchActivityHistory batchId={batchId} />
          </TabsContent>

          <TabsContent value="composition" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grape className="w-5 h-5" />
                  Batch Composition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Variety</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">Volume (L)</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead className="text-right">pH</TableHead>
                      <TableHead className="text-right">SG</TableHead>
                      <TableHead className="text-right">Brix</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Lot Code</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {composition.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {item.sourceType === "juice_purchase" ? (
                            <Badge variant="outline" className="bg-blue-50">
                              🧃 Juice
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50">
                              🍎 Fruit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.vendorName}</TableCell>
                        <TableCell>{item.varietyName}</TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase"
                            ? "—"
                            : item.inputWeightKg.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.juiceVolume.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.fractionOfBatch * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase" && item.ph
                            ? Number(item.ph).toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase" && item.specificGravity
                            ? Number(item.specificGravity).toFixed(3)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase" && item.brix
                            ? Number(item.brix).toFixed(1)
                            : item.avgBrix
                              ? Number(item.avgBrix).toFixed(1)
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.materialCost
                            ? `$${Number(item.materialCost).toFixed(2)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.lotCode || "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={item.notes || ""}>
                          {item.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4">
            {/* View Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={measurementView === "chart" ? "default" : "ghost"}
                  onClick={() => setMeasurementView("chart")}
                  className="h-8"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Chart
                </Button>
                <Button
                  size="sm"
                  variant={measurementView === "list" ? "default" : "ghost"}
                  onClick={() => setMeasurementView("list")}
                  className="h-8"
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
              </div>
            </div>

            {/* Chart View */}
            {measurementView === "chart" && (
              <MeasurementChart measurements={measurements} />
            )}

            {/* List View */}
            {measurementView === "list" && (
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  Measurement History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">SG</TableHead>
                      <TableHead className="text-right">ABV %</TableHead>
                      <TableHead className="text-right">pH</TableHead>
                      <TableHead className="text-right">TA (g/L)</TableHead>
                      <TableHead className="text-right">Temp (°C)</TableHead>
                      <TableHead className="text-right">Volume (L)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {measurements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-gray-500"
                        >
                          No measurements recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      measurements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            {format(
                              new Date(m.measurementDate),
                              "MMM dd, yyyy",
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.specificGravity?.toFixed(3) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.abv?.toFixed(1) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.ph?.toFixed(2) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.totalAcidity?.toFixed(1) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.temperature?.toFixed(1) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.volume?.toFixed(1) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingMeasurement(m)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}
          </TabsContent>

          <TabsContent value="additives" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5" />
                  Additive History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {additives.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-gray-500"
                        >
                          No additives recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      additives.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            {format(new Date(a.addedAt), "MMM dd, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{a.additiveType}</TableCell>
                          <TableCell>{a.additiveName}</TableCell>
                          <TableCell className="text-right">
                            {a.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>{a.unit}</TableCell>
                          <TableCell>{a.addedBy || "-"}</TableCell>
                          <TableCell>{a.notes || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingAdditive(a)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Batch History</DialogTitle>
            <DialogDescription>
              Complete history and details for this batch
            </DialogDescription>
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>

      {/* Edit Dialogs */}
      <EditMeasurementDialog
        measurement={editingMeasurement}
        open={!!editingMeasurement}
        onClose={() => setEditingMeasurement(null)}
        onSuccess={() => {
          refetch();
          setEditingMeasurement(null);
        }}
      />

      <EditAdditiveDialog
        additive={editingAdditive}
        open={!!editingAdditive}
        onClose={() => setEditingAdditive(null)}
        onSuccess={() => {
          refetch();
          setEditingAdditive(null);
        }}
      />
    </>
  );
}
