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
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/utils/date-format";
import { SendToDistilleryDialog } from "@/components/cellar/SendToDistilleryDialog";
import { ReceiveBrandyDialog } from "@/components/cellar/ReceiveBrandyDialog";
import { CreatePommeauBlendDialog } from "@/components/cellar/CreatePommeauBlendDialog";
import { toast } from "@/hooks/use-toast";

export default function DistillationPage() {
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={() => setShowSendDialog(true)}>
            <Truck className="w-4 h-4 mr-2" />
            Send to Distillery
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedRecordId("");
              setShowReceiveDialog(true);
            }}
          >
            <Wine className="w-4 h-4 mr-2" />
            Receive Brandy
          </Button>
          <Button variant="outline" onClick={() => setShowPommeauDialog(true)}>
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
