"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Truck,
  Wine,
  Beaker,
  MoreVertical,
  Eye,
  XCircle,
  ArrowRight,
  Clock,
  CheckCircle,
  LayoutDashboard,
} from "lucide-react";
import { formatDate } from "@/utils/date-format";
import { SendToDistilleryDialog } from "@/components/cellar/SendToDistilleryDialog";
import { ReceiveBrandyDialog } from "@/components/cellar/ReceiveBrandyDialog";
import { CreatePommeauBlendDialog } from "@/components/cellar/CreatePommeauBlendDialog";
import { toast } from "@/hooks/use-toast";

export default function DistillationPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showPommeauDialog, setShowPommeauDialog] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");

  const utils = trpc.useUtils();

  // Fetch distillation records
  const { data: records, isLoading } = trpc.distillation.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as "sent" | "received" | "cancelled") : undefined,
    limit: 100,
  });

  // Fetch stats
  const { data: stats } = trpc.distillation.getStats.useQuery();

  // Cancel mutation
  const cancelMutation = trpc.distillation.cancel.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Distillation record cancelled",
      });
      utils.distillation.list.invalidate();
      utils.distillation.getStats.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "received":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleReceiveBrandy = (recordId: string) => {
    setSelectedRecordId(recordId);
    setActiveTab("receive");
    setShowReceiveDialog(true);
  };

  const handleCancelRecord = (recordId: string) => {
    if (confirm("Are you sure you want to cancel this distillation record?")) {
      cancelMutation.mutate({ id: recordId, reason: "Cancelled by user" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Distillation & Spirits</h1>
          <p className="text-gray-600 mt-1">
            Track cider sent to distillery, brandy received back, and pommeau blending.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Send to Distillery</span>
            </TabsTrigger>
            <TabsTrigger value="receive" className="flex items-center gap-2">
              <Wine className="h-4 w-4" />
              <span className="hidden sm:inline">Receive Brandy</span>
            </TabsTrigger>
            <TabsTrigger value="pommeau" className="flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              <span className="hidden sm:inline">Pommeau Blend</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Shipments</p>
                      <p className="text-2xl font-bold">{stats?.pendingRecords || 0}</p>
                    </div>
                    <Truck className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{stats?.completedRecords || 0}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">PG Sent</p>
                      <p className="text-2xl font-bold">
                        {(stats?.totalProofGallonsSent || 0).toFixed(1)}
                      </p>
                    </div>
                    <ArrowRight className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">PG Received</p>
                      <p className="text-2xl font-bold">
                        {(stats?.totalProofGallonsReceived || 0).toFixed(1)}
                      </p>
                    </div>
                    <Wine className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setActiveTab("send")}>
                <Truck className="w-4 h-4 mr-2" />
                Send to Distillery
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("receive")}>
                <Wine className="w-4 h-4 mr-2" />
                Receive Brandy
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("pommeau")}>
                <Beaker className="w-4 h-4 mr-2" />
                Create Pommeau Blend
              </Button>
            </div>

            {/* Distillation Records Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distillation Records</CardTitle>
                    <CardDescription>
                      Track cider shipments to distilleries and brandy received
                    </CardDescription>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Records</SelectItem>
                      <SelectItem value="sent">Pending</SelectItem>
                      <SelectItem value="received">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : !records || records.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No distillation records found</p>
                    <p className="text-sm mt-2">
                      Click &ldquo;Send to Distillery&rdquo; to create your first record
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Batch</TableHead>
                        <TableHead>Distillery</TableHead>
                        <TableHead>Volume Sent</TableHead>
                        <TableHead>Date Sent</TableHead>
                        <TableHead>TIB Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Volume Received</TableHead>
                        <TableHead>ABV</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.sourceBatchName || record.sourceBatchNumber || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{record.distilleryName}</p>
                              {record.distilleryPermitNumber && (
                                <p className="text-xs text-muted-foreground">
                                  {record.distilleryPermitNumber}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {parseFloat(record.sourceVolume || "0").toFixed(1)}{" "}
                            {record.sourceVolumeUnit}
                            {record.sourceAbv && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({record.sourceAbv}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.sentAt ? formatDate(new Date(record.sentAt)) : "-"}
                          </TableCell>
                          <TableCell>
                            {record.tibOutboundNumber || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            {record.receivedVolume ? (
                              <>
                                {parseFloat(record.receivedVolume).toFixed(1)}{" "}
                                {record.receivedVolumeUnit}
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.receivedAbv ? (
                              <span className="font-medium">{record.receivedAbv}%</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {record.status === "sent" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleReceiveBrandy(record.id)}
                                    >
                                      <Wine className="w-4 h-4 mr-2" />
                                      Receive Brandy
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleCancelRecord(record.id)}
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Cancel Record
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Send to Distillery Tab */}
          <TabsContent value="send" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Send Cider to Distillery
                </CardTitle>
                <CardDescription>
                  Record cider being sent to an external distillery for brandy production.
                  You can send multiple batches in a single shipment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowSendDialog(true)}>
                  <Truck className="w-4 h-4 mr-2" />
                  Create New Shipment
                </Button>
              </CardContent>
            </Card>

            {/* Pending Shipments */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Shipments</CardTitle>
                <CardDescription>
                  Cider sent to distillery awaiting brandy return
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  (() => {
                    const pendingRecords = records?.filter((r) => r.status === "sent") || [];
                    return pendingRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending shipments</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source Batch</TableHead>
                            <TableHead>Distillery</TableHead>
                            <TableHead>Volume Sent</TableHead>
                            <TableHead>Date Sent</TableHead>
                            <TableHead>TIB Outbound</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.sourceBatchName || record.sourceBatchNumber || "Unknown"}
                              </TableCell>
                              <TableCell>{record.distilleryName}</TableCell>
                              <TableCell>
                                {parseFloat(record.sourceVolume || "0").toFixed(1)}{" "}
                                {record.sourceVolumeUnit}
                              </TableCell>
                              <TableCell>
                                {record.sentAt ? formatDate(new Date(record.sentAt)) : "-"}
                              </TableCell>
                              <TableCell>
                                {record.tibOutboundNumber || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReceiveBrandy(record.id)}
                                >
                                  <Wine className="w-3 h-3 mr-1" />
                                  Receive
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receive Brandy Tab */}
          <TabsContent value="receive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wine className="h-5 w-5" />
                  Receive Brandy from Distillery
                </CardTitle>
                <CardDescription>
                  Record brandy received back from the distillery. Select one or more
                  cider shipments that were combined into a single brandy batch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => {
                  setSelectedRecordId("");
                  setShowReceiveDialog(true);
                }}>
                  <Wine className="w-4 h-4 mr-2" />
                  Receive Brandy
                </Button>
              </CardContent>
            </Card>

            {/* Pending Shipments to Receive */}
            <Card>
              <CardHeader>
                <CardTitle>Awaiting Brandy Return</CardTitle>
                <CardDescription>
                  Select shipments below to record brandy received
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  (() => {
                    const pendingRecords = records?.filter((r) => r.status === "sent") || [];
                    return pendingRecords.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Wine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending shipments awaiting brandy</p>
                        <p className="text-sm mt-2">
                          Send cider to a distillery first
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source Batch</TableHead>
                            <TableHead>Distillery</TableHead>
                            <TableHead>Volume Sent</TableHead>
                            <TableHead>ABV</TableHead>
                            <TableHead>Date Sent</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.sourceBatchName || record.sourceBatchNumber || "Unknown"}
                              </TableCell>
                              <TableCell>{record.distilleryName}</TableCell>
                              <TableCell>
                                {parseFloat(record.sourceVolume || "0").toFixed(1)}{" "}
                                {record.sourceVolumeUnit}
                              </TableCell>
                              <TableCell>
                                {record.sourceAbv ? `${record.sourceAbv}%` : "-"}
                              </TableCell>
                              <TableCell>
                                {record.sentAt ? formatDate(new Date(record.sentAt)) : "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    setShowReceiveDialog(true);
                                  }}
                                >
                                  <Wine className="w-3 h-3 mr-1" />
                                  Receive
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pommeau Blend Tab */}
          <TabsContent value="pommeau" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5" />
                  Create Pommeau Blend
                </CardTitle>
                <CardDescription>
                  Blend fresh apple juice with apple brandy to create pommeau.
                  Traditional ratio is approximately 2/3 fresh juice to 1/3 brandy,
                  targeting 16-18% ABV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowPommeauDialog(true)}>
                  <Beaker className="w-4 h-4 mr-2" />
                  Create New Pommeau Blend
                </Button>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>About Pommeau</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pommeau is a traditional Norman aperitif made by blending unfermented apple
                  juice (must) with apple brandy (calvados). The high alcohol content of the
                  brandy prevents the juice from fermenting, preserving the fresh apple flavor.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium">Traditional Ratio</p>
                    <p className="text-muted-foreground">2/3 juice : 1/3 brandy</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium">Target ABV</p>
                    <p className="text-muted-foreground">16-18%</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium">Aging</p>
                    <p className="text-muted-foreground">14+ months minimum</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <SendToDistilleryDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
      />
      <ReceiveBrandyDialog
        open={showReceiveDialog}
        onOpenChange={setShowReceiveDialog}
        preselectedRecordId={selectedRecordId || undefined}
      />
      <CreatePommeauBlendDialog
        open={showPommeauDialog}
        onOpenChange={setShowPommeauDialog}
      />
    </div>
  );
}
