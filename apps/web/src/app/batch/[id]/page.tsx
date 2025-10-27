"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  FlaskConical,
  Droplets,
  Beaker,
  History,
  Plus,
  AlertCircle,
  Clock,
  TrendingUp,
  Package,
  ArrowRightLeft,
  Edit3,
  Check,
  X,
  Activity,
  Loader2,
  Sparkles,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Gauge,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { AddBatchMeasurementForm } from "@/components/cellar/AddBatchMeasurementForm";
import { AddBatchAdditiveForm } from "@/components/cellar/AddBatchAdditiveForm";
import { BatchActivityHistory } from "@/components/batch/BatchActivityHistory";
import { CarbonateModal } from "@/components/batch/CarbonateModal";
import { CompleteCarbonationModal } from "@/components/batch/CompleteCarbonationModal";
import { toast } from "@/hooks/use-toast";

export default function BatchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  console.log("🔍 BatchDetailsPage rendering with batchId:", batchId);

  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showAdditiveForm, setShowAdditiveForm] = useState(false);
  const [showCarbonateModal, setShowCarbonateModal] = useState(false);
  const [showCompleteCarbonationModal, setShowCompleteCarbonationModal] =
    useState(false);
  const [selectedCarbonationOperation, setSelectedCarbonationOperation] =
    useState<any>(null);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");

  const utils = trpc.useUtils();

  // Batch update mutation
  const updateBatchMutation = trpc.batch.update.useMutation({
    onSuccess: () => {
      utils.batch.get.invalidate({ batchId });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch batch data
  const {
    data: batch,
    isLoading: batchLoading,
    error: batchError,
  } = trpc.batch.get.useQuery({
    batchId,
  });

  // Fetch batch history
  const { data: history, isLoading: historyLoading } =
    trpc.batch.getHistory.useQuery({
      batchId,
    });

  // Fetch batch composition (with cache busting)
  const [compositionCacheBuster, setCompositionCacheBuster] = useState(0);
  const { data: composition, isLoading: compositionLoading, error: compositionError, refetch: refetchComposition } =
    trpc.batch.getComposition.useQuery(
      {
        batchId,
        _cacheBuster: compositionCacheBuster, // Force new query on change
      } as any,
      {
        enabled: !!batchId,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        staleTime: 0, // Always consider data stale
      }
    );

  // Debug composition data
  React.useEffect(() => {
    console.log("🎨 Composition query result:", {
      batchId,
      composition,
      isLoading: compositionLoading,
      error: compositionError,
    });
  }, [batchId, composition, compositionLoading, compositionError]);

  // Fetch transfer history
  const { data: transfers, isLoading: transfersLoading } =
    trpc.vessel.getTransferHistory.useQuery({
      batchId,
      limit: 50,
      offset: 0,
    });

  // Fetch carbonation operations (mock for now - will be implemented with tRPC router)
  // const { data: carbonationOperations, isLoading: carbonationsLoading } =
  //   trpc.carbonation.list.useQuery({ batchId });
  const carbonationOperations: any[] = []; // Mock empty array until router is implemented
  const carbonationsLoading = false;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "packaged":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const calculateDaysActive = (startDate: string, endDate?: string | null) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    return Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  const handleStartDateEdit = () => {
    if (batch) {
      setEditStartDate(format(new Date(batch.startDate), "yyyy-MM-dd"));
      setIsEditingStartDate(true);
    }
  };

  const handleStartDateSave = async () => {
    if (!editStartDate) return;

    try {
      await updateBatchMutation.mutateAsync({
        batchId,
        startDate: new Date(editStartDate),
      });
      setIsEditingStartDate(false);
    } catch (error) {
      // Error is handled by mutation onError
    }
  };

  const handleStartDateCancel = () => {
    setIsEditingStartDate(false);
    setEditStartDate("");
  };

  const isLoading =
    batchLoading || historyLoading || compositionLoading || transfersLoading;

  if (batchError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              Batch Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              {batchError.message || "The requested batch could not be found."}
            </p>
            <Button onClick={() => router.push("/cellar")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cellar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-gray-600">Loading batch details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <p className="text-gray-600">No batch data available</p>
        </div>
      </div>
    );
  }

  const daysActive = calculateDaysActive(batch.startDate, batch.endDate);
  const latestMeasurement = history?.measurements?.[0];
  const totalCompositionWeight =
    composition?.reduce((sum, comp) => sum + comp.inputWeightKg, 0) || 0;
  const totalCompositionWeightLbs = totalCompositionWeight * 2.20462;
  const totalCompositionVolume =
    composition?.reduce((sum, comp) => sum + comp.juiceVolume, 0) || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push("/cellar")}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cellar
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FlaskConical className="w-8 h-8 text-purple-600" />
              <span className="font-mono text-2xl">{batch.name}</span>
              {batch.customName && (
                <span className="text-xl">- {batch.customName}</span>
              )}
            </h1>
            <p className="text-gray-600">
              Batch details and fermentation tracking
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Actions
              <MoreVertical className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setShowMeasurementForm(true)}>
              <Beaker className="w-4 h-4 mr-2" />
              Add Measurement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAdditiveForm(true)}>
              <Droplets className="w-4 h-4 mr-2" />
              Add Additive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowCarbonateModal(true)}
              disabled={
                !(
                  (batch.status === "conditioning" ||
                    batch.status === "aging" ||
                    batch.status === "completed") &&
                  batch.vesselId &&
                  batch.vesselData?.isPressureVessel === "yes"
                )
              }
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Carbonate
              {batch.vesselData?.isPressureVessel !== "yes" && (
                <span className="ml-auto text-xs text-muted-foreground">
                  (Requires pressure vessel)
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Batch Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(batch.status)}>
              {batch.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Days Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysActive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Current Vessel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {batch.vesselName || (
                <span className="text-gray-400">Unassigned</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Current Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestMeasurement?.volume
                ? `${latestMeasurement.volume.toFixed(1)}${latestMeasurement.volumeUnit || 'L'}`
                : "No data"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="overview"
        className="space-y-6"
        onValueChange={(value) => {
          console.log("🔄 Tab changed to:", value);
          if (value === "composition") {
            console.log("🔄 Forcing composition refetch with cache buster");
            setCompositionCacheBuster(Date.now());
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity History
          </TabsTrigger>
          <TabsTrigger value="carbonations">
            <Sparkles className="w-4 h-4 mr-2" />
            Carbonations
            {carbonationOperations.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {carbonationOperations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="composition">Composition</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="additives">Additives</TabsTrigger>
          <TabsTrigger value="transfers">Transfer History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Batch Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                  Batch Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      Start Date
                      {!isEditingStartDate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={handleStartDateEdit}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </label>
                    {isEditingStartDate ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={handleStartDateSave}
                          disabled={updateBatchMutation.isPending}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={handleStartDateCancel}
                          disabled={updateBatchMutation.isPending}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-lg font-medium">
                        {format(new Date(batch.startDate), "MMM dd, yyyy")}
                      </div>
                    )}
                  </div>
                  {batch.endDate && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        End Date
                      </label>
                      <div className="text-lg font-medium">
                        {format(new Date(batch.endDate), "MMM dd, yyyy")}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Created
                    </label>
                    <div className="text-sm text-gray-700">
                      {format(new Date(batch.createdAt), "MMM dd, yyyy HH:mm")}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Last Updated
                    </label>
                    <div className="text-sm text-gray-700">
                      {format(new Date(batch.updatedAt), "MMM dd, yyyy HH:mm")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Latest Measurements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Latest Measurements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestMeasurement ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-3">
                      Taken on{" "}
                      {format(
                        new Date(latestMeasurement.measurementDate),
                        "MMM dd, yyyy",
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {latestMeasurement.specificGravity && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">
                            Specific Gravity
                          </label>
                          <div className="text-lg font-medium">
                            {latestMeasurement.specificGravity.toFixed(3)}
                          </div>
                        </div>
                      )}
                      {latestMeasurement.abv && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">
                            ABV
                          </label>
                          <div className="text-lg font-medium">
                            {latestMeasurement.abv.toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {latestMeasurement.ph && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">
                            pH
                          </label>
                          <div className="text-lg font-medium">
                            {latestMeasurement.ph.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {latestMeasurement.temperature && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">
                            Temperature
                          </label>
                          <div className="text-lg font-medium">
                            {latestMeasurement.temperature.toFixed(1)}°C
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No measurements recorded yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity History Tab */}
        <TabsContent value="activity">
          <BatchActivityHistory batchId={batchId} />
        </TabsContent>

        {/* Carbonations Tab */}
        <TabsContent value="carbonations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Carbonation Operations
              </CardTitle>
              <CardDescription>
                Track forced carbonation operations for this batch
              </CardDescription>
            </CardHeader>
            <CardContent>
              {carbonationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">
                    Loading carbonations...
                  </span>
                </div>
              ) : carbonationOperations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Target CO2</TableHead>
                      <TableHead>Pressure Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {carbonationOperations.map((op: any) => {
                      const isInProgress = !op.completedAt;
                      const duration = op.durationHours
                        ? `${op.durationHours.toFixed(1)}h`
                        : isInProgress
                          ? `${((Date.now() - new Date(op.startedAt).getTime()) / (1000 * 60 * 60)).toFixed(1)}h (ongoing)`
                          : "-";

                      return (
                        <TableRow key={op.id}>
                          <TableCell>
                            {format(new Date(op.startedAt), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{op.targetCO2Volumes} vol</TableCell>
                          <TableCell>{op.pressureApplied} PSI</TableCell>
                          <TableCell>
                            {isInProgress ? (
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />
                                In Progress
                              </Badge>
                            ) : (
                              <Badge variant="default">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{duration}</TableCell>
                          <TableCell>
                            {op.qualityCheck ? (
                              op.qualityCheck === "pass" ? (
                                <Badge
                                  variant="default"
                                  className="bg-green-100 text-green-700"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Pass
                                </Badge>
                              ) : op.qualityCheck === "needs_adjustment" ? (
                                <Badge
                                  variant="default"
                                  className="bg-yellow-100 text-yellow-700"
                                >
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Needs Adj.
                                </Badge>
                              ) : (
                                <Badge
                                  variant="default"
                                  className="bg-red-100 text-red-700"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Fail
                                </Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isInProgress && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCarbonationOperation(op);
                                  setShowCompleteCarbonationModal(true);
                                }}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Carbonation Operations
                  </h3>
                  <p className="text-gray-600 mb-4">
                    This batch has not been carbonated yet.
                  </p>
                  {batch.status === "conditioning" ||
                  batch.status === "aging" ||
                  batch.status === "completed" ? (
                    batch.vesselData?.isPressureVessel === "yes" ? (
                      <Button
                        onClick={() => setShowCarbonateModal(true)}
                        size="sm"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Start Carbonation
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Batch must be in a pressure-rated vessel to carbonate
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Batch must be in conditioning, aging, or completed status
                      to carbonate
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Composition Tab */}
        <TabsContent value="composition">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Batch Composition
              </CardTitle>
              <CardDescription>
                Apple varieties and sources that make up this batch
              </CardDescription>
            </CardHeader>
            <CardContent>
              {composition && composition.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium bg-gray-50 p-3 rounded-lg">
                    <div>
                      Total Input Weight: {totalCompositionWeightLbs.toFixed(1)} lbs
                      <span className="text-xs text-gray-500 ml-1">({totalCompositionWeight.toFixed(1)} kg)</span>
                    </div>
                    <div>
                      Total Juice Volume: {totalCompositionVolume.toFixed(1)} L
                    </div>
                    <div>
                      Extraction Rate:{" "}
                      {totalCompositionWeight > 0
                        ? (
                            (totalCompositionVolume / totalCompositionWeight) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead className="text-right">
                          Weight (lbs)
                        </TableHead>
                        <TableHead className="text-right">Volume (L)</TableHead>
                        <TableHead className="text-right">% of Batch</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Avg Brix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {composition.map((comp, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {comp.vendorName}
                          </TableCell>
                          <TableCell>{comp.varietyName}</TableCell>
                          <TableCell className="text-right">
                            {(comp.inputWeightKg * 2.20462).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.juiceVolume.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(comp.fractionOfBatch * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            ${comp.materialCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.avgBrix ? comp.avgBrix.toFixed(1) : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No composition data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Measurements Tab */}
        <TabsContent value="measurements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="w-5 h-5 text-blue-600" />
                Measurements History
              </CardTitle>
              <CardDescription>
                Track fermentation progress over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history?.measurements && history.measurements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">SG</TableHead>
                      <TableHead className="text-right">ABV %</TableHead>
                      <TableHead className="text-right">pH</TableHead>
                      <TableHead className="text-right">TA</TableHead>
                      <TableHead className="text-right">Temp °C</TableHead>
                      <TableHead className="text-right">Volume L</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.measurements.map((measurement) => (
                      <TableRow key={measurement.id}>
                        <TableCell>
                          {format(
                            new Date(measurement.measurementDate),
                            "MMM dd, yyyy",
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.specificGravity?.toFixed(3) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.abv?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.ph?.toFixed(2) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.totalAcidity?.toFixed(2) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.temperature?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {measurement.volume?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {measurement.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No measurements recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Additives Tab */}
        <TabsContent value="additives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-purple-600" />
                Additives History
              </CardTitle>
              <CardDescription>
                Track all additives added to this batch
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history?.additives && history.additives.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Added By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.additives.map((additive) => (
                      <TableRow key={additive.id}>
                        <TableCell>
                          {format(
                            new Date(additive.addedAt),
                            "MMM dd, yyyy HH:mm",
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {additive.additiveType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {additive.additiveName}
                        </TableCell>
                        <TableCell className="text-right">
                          {additive.amount}
                        </TableCell>
                        <TableCell>{additive.unit}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {additive.notes || "-"}
                        </TableCell>
                        <TableCell>{additive.addedBy || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No additives recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer History Tab */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                Transfer History
              </CardTitle>
              <CardDescription>
                Track all transfers involving this batch
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transfers?.transfers && transfers.transfers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Vessel</TableHead>
                      <TableHead>To Vessel</TableHead>
                      <TableHead>Source Batch</TableHead>
                      <TableHead>Destination Batch</TableHead>
                      <TableHead className="text-right">Volume (L)</TableHead>
                      <TableHead className="text-right">Loss (L)</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          {format(
                            new Date(transfer.transferredAt),
                            "MMM dd, yyyy HH:mm",
                          )}
                        </TableCell>
                        <TableCell>{transfer.sourceVesselName}</TableCell>
                        <TableCell>{transfer.destinationVesselName}</TableCell>
                        <TableCell>{transfer.sourceBatchName}</TableCell>
                        <TableCell>{transfer.destinationBatchName}</TableCell>
                        <TableCell className="text-right">
                          {parseFloat(transfer.volumeTransferred).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {parseFloat(transfer.loss || "0").toFixed(1)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transfer.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No transfer history found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Measurement Dialog */}
      {showMeasurementForm && (
        <Dialog
          open={showMeasurementForm}
          onOpenChange={setShowMeasurementForm}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Batch Measurement</DialogTitle>
              <DialogDescription>
                Record a new measurement for batch {batch.name}
                {batch.customName && ` (${batch.customName})`}
              </DialogDescription>
            </DialogHeader>
            <AddBatchMeasurementForm
              batchId={batchId}
              onSuccess={() => {
                setShowMeasurementForm(false);
                utils.batch.getHistory.invalidate({ batchId });
                toast({
                  title: "Success",
                  description: "Measurement added successfully",
                });
              }}
              onCancel={() => setShowMeasurementForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Additive Dialog */}
      {showAdditiveForm && (
        <Dialog open={showAdditiveForm} onOpenChange={setShowAdditiveForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Batch Additive</DialogTitle>
              <DialogDescription>
                Record an additive addition to batch {batch.name}
                {batch.customName && ` (${batch.customName})`}
              </DialogDescription>
            </DialogHeader>
            <AddBatchAdditiveForm
              batchId={batchId}
              onSuccess={() => {
                setShowAdditiveForm(false);
                utils.batch.getHistory.invalidate({ batchId });
                toast({
                  title: "Success",
                  description: "Additive added successfully",
                });
              }}
              onCancel={() => setShowAdditiveForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Carbonate Modal */}
      {showCarbonateModal && batch.vesselData && (
        <CarbonateModal
          open={showCarbonateModal}
          onOpenChange={setShowCarbonateModal}
          batch={{
            id: batch.id,
            name: batch.name,
            vesselId: batch.vesselId,
            currentVolume: latestMeasurement?.volume || 0,
            currentVolumeUnit: latestMeasurement?.volumeUnit || "L",
            status: batch.status,
          }}
          vessel={{
            id: batch.vesselData.id,
            name: batch.vesselData.name,
            isPressureVessel: batch.vesselData.isPressureVessel as "yes" | "no",
            maxPressure: parseFloat(batch.vesselData.maxPressure || "30"),
          }}
          onSuccess={() => {
            // TODO: Invalidate carbonation operations query when router is implemented
            // utils.carbonation.list.invalidate({ batchId });
            toast({
              title: "Success",
              description: "Carbonation operation started successfully",
            });
          }}
        />
      )}

      {/* Complete Carbonation Modal */}
      {showCompleteCarbonationModal && selectedCarbonationOperation && (
        <CompleteCarbonationModal
          open={showCompleteCarbonationModal}
          onOpenChange={setShowCompleteCarbonationModal}
          carbonationOperation={{
            id: selectedCarbonationOperation.id,
            batchId: selectedCarbonationOperation.batchId,
            batchName: batch.name,
            vesselName: batch.vesselName || "Unknown Vessel",
            startedAt: new Date(selectedCarbonationOperation.startedAt),
            targetCO2Volumes: selectedCarbonationOperation.targetCO2Volumes,
            pressureApplied: selectedCarbonationOperation.pressureApplied,
            startingVolume: selectedCarbonationOperation.startingVolume,
            startingVolumeUnit: selectedCarbonationOperation.startingVolumeUnit,
            startingTemperature: selectedCarbonationOperation.startingTemperature,
          }}
          onSuccess={() => {
            setSelectedCarbonationOperation(null);
            // TODO: Invalidate carbonation operations query when router is implemented
            // utils.carbonation.list.invalidate({ batchId });
            toast({
              title: "Success",
              description: "Carbonation operation completed successfully",
            });
          }}
        />
      )}
    </div>
  );
}
