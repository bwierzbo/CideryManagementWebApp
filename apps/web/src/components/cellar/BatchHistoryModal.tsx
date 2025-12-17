"use client";

import React, { useState } from "react";
import {
  WeightDisplay,
  type WeightUnit,
} from "@/components/ui/weight-display";
import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Trash2,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/utils/date-format";
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
  const [deletingMeasurement, setDeletingMeasurement] = useState<any>(null);
  const [deletingAdditive, setDeletingAdditive] = useState<any>(null);
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<WeightUnit>("lb");

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
      utils.packaging.list.invalidate(); // Invalidate bottles list since it shows batch names
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

  const deleteMeasurement = trpc.batch.deleteMeasurement.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Measurement deleted successfully",
      });
      refetch();
      setDeletingMeasurement(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete measurement",
        variant: "destructive",
      });
    },
  });

  const deleteAdditive = trpc.batch.deleteAdditive.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Additive deleted successfully",
      });
      refetch();
      setDeletingAdditive(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete additive",
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

  const handleConfirmDeleteMeasurement = () => {
    if (deletingMeasurement) {
      deleteMeasurement.mutate({ measurementId: deletingMeasurement.id });
    }
  };

  const handleConfirmDeleteAdditive = () => {
    if (deletingAdditive) {
      deleteAdditive.mutate({ additiveId: deletingAdditive.id });
    }
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

    const { batch, origin, contributingPressRuns, composition, measurements, additives } = data;

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
                      {formatDate(batch.startDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Latest Measurements */}
            {measurements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Beaker className="w-5 h-5" />
                    Latest Measurements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-white rounded-lg border">
                    <div>
                      <p className="text-xs text-gray-500">ABV</p>
                      <p className="font-semibold text-lg">
                        {measurements[0]?.abv !== null && measurements[0]?.abv !== undefined
                          ? `${measurements[0].abv.toFixed(2)}%`
                          : "Not measured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">pH</p>
                      <p className="font-semibold text-lg">
                        {measurements[0]?.ph !== null && measurements[0]?.ph !== undefined
                          ? measurements[0].ph.toFixed(2)
                          : "Not measured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">SG</p>
                      <p className="font-semibold text-lg">
                        {measurements[0]?.specificGravity !== null && measurements[0]?.specificGravity !== undefined
                          ? measurements[0].specificGravity.toFixed(3)
                          : "Not measured"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Temp (°C)</p>
                      <p className="font-semibold text-lg">
                        {measurements[0]?.temperature !== null && measurements[0]?.temperature !== undefined
                          ? `${measurements[0].temperature.toFixed(1)}°C`
                          : "Not measured"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Origin Info - Show all contributing press runs */}
            {(origin || (contributingPressRuns && contributingPressRuns.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    Press Run Origin{contributingPressRuns && contributingPressRuns.length > 0 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Press Run</TableHead>
                        <TableHead className="text-right">Apple Weight</TableHead>
                        <TableHead className="text-right">Juice Volume</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {origin && (
                        <TableRow>
                          <TableCell className="font-medium">
                            {origin.pressRunName || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            {origin.totalAppleWeightKg ? (
                              <WeightDisplay
                                weightKg={parseFloat(origin.totalAppleWeightKg)}
                                originalUnit="lb"
                                displayUnit={weightDisplayUnit}
                                onToggle={(newUnit) => setWeightDisplayUnit(newUnit)}
                              />
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {origin.totalJuiceVolume
                              ? `${parseFloat(origin.totalJuiceVolume).toFixed(1)} ${origin.totalJuiceVolumeUnit || 'L'}`
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      )}
                      {contributingPressRuns && contributingPressRuns.map((pr) => (
                        <TableRow key={pr.id}>
                          <TableCell className="font-medium">
                            {pr.pressRunName || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            {pr.totalAppleWeightKg ? (
                              <WeightDisplay
                                weightKg={pr.totalAppleWeightKg}
                                originalUnit="lb"
                                displayUnit={weightDisplayUnit}
                                onToggle={(newUnit) => setWeightDisplayUnit(newUnit)}
                              />
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {`${pr.volumeAdded.toFixed(1)} ${pr.volumeAddedUnit || 'L'}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">Volume (L)</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead className="text-right">pH</TableHead>
                      <TableHead className="text-right">SG</TableHead>
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
                          {item.sourceType === "juice_purchase" ? (
                            "—"
                          ) : (
                            <WeightDisplay
                              weightKg={item.inputWeightKg}
                              originalUnit="lb"
                              displayUnit={weightDisplayUnit}
                              onToggle={(newUnit) => setWeightDisplayUnit(newUnit)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.juiceVolume.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(item.fractionOfBatch * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase" && (item as any).ph
                            ? Number((item as any).ph).toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sourceType === "juice_purchase" && (item as any).specificGravity
                            ? Number((item as any).specificGravity).toFixed(3)
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={(item as any).notes || ""}>
                          {(item as any).notes || "—"}
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
                            {formatDate(m.measurementDate)}
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
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingMeasurement(m)}
                                className="h-8 w-8 p-0"
                                title="Edit measurement"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingMeasurement(m)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete measurement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                            {formatDateTime(a.addedAt)}
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
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingAdditive(a)}
                                className="h-8 w-8 p-0"
                                title="Edit additive"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingAdditive(a)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete additive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

      {/* Delete Confirmation Dialogs */}
      <AlertDialog
        open={!!deletingMeasurement}
        onOpenChange={(open) => !open && setDeletingMeasurement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Measurement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this measurement from{" "}
              {deletingMeasurement &&
                formatDate(deletingMeasurement.measurementDate)}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMeasurement.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMeasurement}
              disabled={deleteMeasurement.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMeasurement.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingAdditive}
        onOpenChange={(open) => !open && setDeletingAdditive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Additive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the additive &quot;{deletingAdditive?.additiveName}&quot;
              added on{" "}
              {deletingAdditive &&
                formatDate(deletingAdditive.addedAt)}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAdditive.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteAdditive}
              disabled={deleteAdditive.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAdditive.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
