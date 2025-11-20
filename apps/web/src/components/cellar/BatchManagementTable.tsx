"use client";

import React, { useState } from "react";
import { trpc } from "@/utils/trpc";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  MoreVertical,
  Edit2,
  Trash2,
  Plus,
  Beaker,
  Search,
  Filter,
  Calendar,
  Droplets,
  FlaskConical,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { BatchHistoryModal } from "./BatchHistoryModal";
import { AddBatchMeasurementForm } from "./AddBatchMeasurementForm";
import { AddBatchAdditiveForm } from "./AddBatchAdditiveForm";
import { toast } from "@/hooks/use-toast";
import { VolumeDisplay } from "@/components/ui/volume-input";

interface BatchManagementTableProps {
  className?: string;
}

interface EditingState {
  batchId: string;
  customName: string;
}

export function BatchManagementTable({ className }: BatchManagementTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showAdditiveForm, setShowAdditiveForm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingBatch, setEditingBatch] = useState<EditingState | null>(null);

  const utils = trpc.useUtils();

  // Fetch batches
  const { data, isLoading, error } = trpc.batch.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    sortBy: "startDate",
    sortOrder: "desc",
  });

  // Delete mutation
  const deleteMutation = trpc.batch.delete.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
      setDeleteConfirmOpen(false);
      setBatchToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update batch mutation
  const updateMutation = trpc.batch.update.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      utils.bottles.list.invalidate(); // Invalidate bottles list since it shows batch names
      utils.dashboard.getRecentBatches.invalidate(); // Invalidate dashboard batch list
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

  const handleSaveCustomName = () => {
    if (editingBatch) {
      updateMutation.mutate({
        batchId: editingBatch.batchId,
        customName: editingBatch.customName,
      });
      setEditingBatch(null);
    }
  };

  const handleDeleteClick = (batch: { id: string; name: string }) => {
    setBatchToDelete(batch);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (batchToDelete) {
      deleteMutation.mutate({ batchId: batchToDelete.id });
    }
  };

  const handleStatusChange = (batchId: string, newStatus: string) => {
    updateMutation.mutate({
      batchId,
      status: newStatus as any,
    });
  };

  const handleViewHistory = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowHistory(true);
  };

  const handleAddMeasurement = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowMeasurementForm(true);
  };

  const handleAddAdditive = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowAdditiveForm(true);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Batch Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading batches...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Batch Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            Error loading batches: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  const batches = data?.batches || [];

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-600" />
                Batch Management
              </CardTitle>
              <CardDescription>
                Track and manage all active fermentation batches
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search batches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="packaged">Packaged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Batch Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="text-center">
                    Specific Gravity
                  </TableHead>
                  <TableHead className="text-center">ABV</TableHead>
                  <TableHead className="text-center">pH</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center text-gray-500 py-8"
                    >
                      No batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {batch.name}
                      </TableCell>
                      <TableCell>
                        {editingBatch?.batchId === batch.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingBatch.customName}
                              onChange={(e) =>
                                setEditingBatch({
                                  ...editingBatch,
                                  customName: e.target.value,
                                })
                              }
                              className="h-8 w-40"
                              placeholder="Batch name..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveCustomName();
                                } else if (e.key === "Escape") {
                                  setEditingBatch(null);
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveCustomName}
                              className="h-8 w-8 p-0"
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingBatch(null)}
                              className="h-8 w-8 p-0"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer flex items-center gap-1 hover:text-blue-600 font-medium"
                            onClick={() =>
                              setEditingBatch({
                                batchId: batch.id,
                                customName: batch.customName || "",
                              })
                            }
                          >
                            {batch.customName || (
                              <span className="text-gray-400 font-normal">
                                Click to add batch name
                              </span>
                            )}
                            <Edit2 className="w-3 h-3" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {batch.vesselName || (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(batch.status)}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(batch.startDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        {batch.latestMeasurement?.specificGravity
                          ? Number(
                              batch.latestMeasurement.specificGravity,
                            ).toFixed(3)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const measurement = batch.latestMeasurement;
                          const og = batch.originalGravity;

                          // Use latest measurement data (most recent source)
                          if (measurement) {
                            // Prefer measured ABV from the measurement
                            if (measurement.abv) {
                              return `${Number(measurement.abv).toFixed(2)}%`;
                            }
                            // Calculate from SG if available
                            if (measurement.specificGravity && og) {
                              const fg = Number(measurement.specificGravity);
                              const ogNum = Number(og);
                              const estimatedAbv = (ogNum - fg) * 131.25;
                              return (
                                <span className="text-gray-600" title="Estimated from latest SG measurement">
                                  ~{estimatedAbv.toFixed(2)}%
                                </span>
                              );
                            }
                          }

                          // Fall back to batch-level ABV only if no measurements exist
                          if (batch.actualAbv) {
                            return `${Number(batch.actualAbv).toFixed(2)}%`;
                          }
                          if (batch.estimatedAbv) {
                            return (
                              <span className="text-gray-600" title="Estimated ABV">
                                ~{Number(batch.estimatedAbv).toFixed(2)}%
                              </span>
                            );
                          }

                          return "-";
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {batch.latestMeasurement?.ph || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <VolumeDisplay
                          value={batch.currentVolume}
                          unit={batch.currentVolumeUnit || "L"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewHistory(batch.id)}
                            >
                              <History className="w-4 h-4 mr-2" />
                              View History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleAddMeasurement(batch.id)}
                            >
                              <Beaker className="w-4 h-4 mr-2" />
                              Add Measurement
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAddAdditive(batch.id)}
                            >
                              <Droplets className="w-4 h-4 mr-2" />
                              Add Additive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(batch.id, "fermentation")
                              }
                              disabled={batch.status === "fermentation"}
                            >
                              Set Fermenting
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(batch.id, "aging")
                              }
                              disabled={batch.status === "aging"}
                            >
                              Set Aging
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(batch.id, "conditioning")
                              }
                              disabled={batch.status === "conditioning"}
                            >
                              Set Conditioning
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(batch.id, "completed")
                              }
                              disabled={batch.status === "completed"}
                            >
                              Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(batch)}
                              className="text-red-600"
                              disabled={
                                batch.status !== "completed" &&
                                batch.status !== "discarded"
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Info */}
          {data && data.pagination && (
            <div className="mt-4 text-sm text-gray-600 text-center">
              Showing {batches.length} of {data.pagination.total} batches
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch History Modal */}
      {selectedBatchId && showHistory && (
        <BatchHistoryModal
          batchId={selectedBatchId}
          open={showHistory}
          onClose={() => {
            setShowHistory(false);
            setSelectedBatchId(null);
          }}
        />
      )}

      {/* Add Measurement Dialog */}
      {selectedBatchId && showMeasurementForm && (
        <Dialog
          open={showMeasurementForm}
          onOpenChange={setShowMeasurementForm}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Batch Measurement</DialogTitle>
              <DialogDescription>
                Record a new measurement for this batch
              </DialogDescription>
            </DialogHeader>
            <AddBatchMeasurementForm
              batchId={selectedBatchId}
              onSuccess={() => {
                setShowMeasurementForm(false);
                setSelectedBatchId(null);
                utils.batch.list.invalidate();
              }}
              onCancel={() => {
                setShowMeasurementForm(false);
                setSelectedBatchId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Additive Dialog */}
      {selectedBatchId && showAdditiveForm && (
        <Dialog open={showAdditiveForm} onOpenChange={setShowAdditiveForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Batch Additive</DialogTitle>
              <DialogDescription>
                Record an additive addition to this batch
              </DialogDescription>
            </DialogHeader>
            <AddBatchAdditiveForm
              batchId={selectedBatchId}
              onSuccess={() => {
                setShowAdditiveForm(false);
                setSelectedBatchId(null);
              }}
              onCancel={() => {
                setShowAdditiveForm(false);
                setSelectedBatchId(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Batch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete batch &ldquo;{batchToDelete?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setBatchToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
