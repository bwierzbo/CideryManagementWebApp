"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, Package } from "lucide-react";
import { trpc } from "@/utils/trpc";
import {
  handleTransactionError,
  showSuccess,
  showLoading,
} from "@/utils/error-handling";
import { formatDate } from "@/utils/date-format";

export default function BatchManagementPage() {
  const { data: session } = useSession();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const utils = trpc.useContext();

  // Get all batches (active only by default)
  const { data: batchesData, isLoading } = trpc.batch.list.useQuery({
    limit: 100,
  });

  const deleteBatchMutation = trpc.batch.delete.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      showSuccess("Batch Deleted", "Batch has been successfully deleted");
      setDeleteDialogOpen(false);
      setSelectedBatch(null);
    },
    onError: (error) => {
      handleTransactionError(error, "Batch", "Delete");
    },
  });

  const handleDeleteClick = (batch: any) => {
    setSelectedBatch(batch);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBatch) return;

    const dismissLoading = showLoading("Deleting batch...");
    try {
      await deleteBatchMutation.mutateAsync({ batchId: selectedBatch.id });
    } finally {
      dismissLoading();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "fermenting":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            Fermenting
          </Badge>
        );
      case "aging":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Aging
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Ready
          </Badge>
        );
      case "packaged":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            Packaged
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateDisplay = (dateString: string) => {
    return formatDate(new Date(dateString));
  };

  const batches = batchesData?.batches || [];

  // Only allow admins
  if ((session?.user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">Admin access required</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Package className="w-8 h-8 text-amber-600 mr-3" />
            Delete Batches
          </h1>
          <p className="text-gray-600 mt-2">
            Delete accidentally created batches
          </p>
        </div>

        {/* Batch List */}
        <Card>
          <CardHeader>
            <CardTitle>All Batches</CardTitle>
            <CardDescription>Select batches to delete</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading batches...
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No batches found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Volume (L)</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          {batch.name}
                        </TableCell>
                        <TableCell>{getStatusBadge(batch.status)}</TableCell>
                        <TableCell>{formatDateDisplay(batch.createdAt)}</TableCell>
                        <TableCell>{batch.currentVolume || "N/A"}</TableCell>
                        <TableCell>{batch.vesselName || "No vessel"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(batch)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Batch
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the batch &ldquo;
                {selectedBatch?.name}&rdquo;? This will permanently remove the
                batch and all its related data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteBatchMutation.isPending}
              >
                {deleteBatchMutation.isPending ? "Deleting..." : "Delete Batch"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
