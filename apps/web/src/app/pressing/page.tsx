"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { PressRunCompletion } from "@/components/pressing";
import {
  Play,
  CheckCircle2,
  Clock,
  Scale,
  Plus,
  Eye,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate } from "@/utils/date-format";

interface PressRun {
  id: string;
  startDate: string;
  totalAppleKg: number;
  varieties: string[];
  status: "in_progress" | "completed";
  duration?: string;
  estimatedCompletion?: string;
  totalJuiceL?: number;
  yield?: string;
}

type ViewMode = "home" | "completion";

// Mobile-optimized Active Runs Section
function ActiveRunsSection({
  onCompletePressRun,
  onCancelPressRun,
}: {
  onCompletePressRun: (pressRunId: string) => void;
  onCancelPressRun: (pressRunId: string) => void;
}) {
  const {
    data: pressRunsData,
    isLoading,
    refetch,
  } = trpc.pressRun.list.useQuery({
    status: "in_progress",
    limit: 10,
  });

  // Convert tRPC data to expected format
  const activeRuns =
    pressRunsData?.pressRuns?.map((run) => ({
      id: run.id,
      pressRunName: run.pressRunName,
      totalAppleKg: parseFloat(run.totalAppleWeightKg || "0"),
      varieties:
        run.varieties && run.varieties.length > 0
          ? run.varieties
          : ["No varieties"],
      status: run.status as "in_progress" | "completed",
      loadCount: run.loadCount || 0,
      vendorName: run.vendorName,
    })) || [];

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">
              Loading active press runs...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeRuns.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Active Press Runs
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
              Start a new press run to begin processing apples into juice
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Active Runs</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 h-8 px-3"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {activeRuns.map((run) => (
          <Card
            key={run.id}
            className="border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50"
          >
            <CardContent className="p-4">
              {/* Run Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {run.pressRunName || `Run ${run.id.slice(0, 8)}`}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {run.vendorName || "No vendor"}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800"
                >
                  In Progress
                </Badge>
              </div>

              {/* Run Stats - Mobile Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center">
                  <Scale className="w-4 h-4 text-gray-500 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">Total Apples</p>
                    <p className="font-medium text-sm">{run.totalAppleKg} kg</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-gray-500 mr-2" />
                  <div>
                    <p className="text-xs text-gray-600">Loads</p>
                    <p className="font-medium text-sm">
                      {run.loadCount || 0} processed
                    </p>
                  </div>
                </div>
              </div>

              {/* Varieties */}
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">Varieties</p>
                <div className="flex flex-wrap gap-2">
                  {run.varieties.map((variety) => (
                    <Badge key={variety} variant="outline" className="text-xs">
                      {variety}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Mobile-optimized Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => (window.location.href = `/pressing/${run.id}`)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Continue Run
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-10 bg-green-600 hover:bg-green-700"
                  onClick={() => onCompletePressRun(run.id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 p-0 text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelPressRun(run.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Mobile-optimized Completed Runs Section
function CompletedRunsSection({
  onDeletePressRun,
}: {
  onDeletePressRun: (pressRunId: string) => void;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: pressRunsData,
    isLoading,
    refetch,
  } = trpc.pressRun.list.useQuery({
    status: "completed",
    limit: 100, // Get more items for client-side pagination and search
    sortBy: "updated",
    sortOrder: "desc",
  });

  const filteredPressRuns = useMemo(() => {
    if (!pressRunsData?.pressRuns) return [];

    const filtered = pressRunsData.pressRuns.filter((pressRun) => {
      const searchLower = searchTerm.toLowerCase();
      const varietiesText = pressRun.varieties.join(" ").toLowerCase();
      const vesselText = pressRun.vesselName?.toLowerCase() || "";
      const dateText = pressRun.dateCompleted
        ? formatDate(new Date(pressRun.dateCompleted)).toLowerCase()
        : "";

      return (
        varietiesText.includes(searchLower) ||
        vesselText.includes(searchLower) ||
        dateText.includes(searchLower)
      );
    });

    return filtered;
  }, [pressRunsData?.pressRuns, searchTerm]);

  const paginatedPressRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPressRuns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPressRuns, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPressRuns.length / itemsPerPage);

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Completed
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-purple-600 h-8 px-3"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 rounded mb-4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Completed
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredPressRuns.length} completed press run
            {filteredPressRuns.length !== 1 ? "s" : ""}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-600 h-8 px-3"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by variety, vessel, or date..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page when searching
            }}
            className="pl-10"
          />
        </div>
      </div>

      {filteredPressRuns.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-8 h-8 mx-auto mb-2" />
              {searchTerm ? (
                <>
                  <p>No press runs found for &quot;{searchTerm}&quot;</p>
                  <p className="text-sm">Try adjusting your search terms</p>
                </>
              ) : (
                <>
                  <p>No completed press runs found</p>
                  <p className="text-sm">
                    Completed press runs will appear here
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Debug: {pressRunsData?.pressRuns?.length || 0} total
                    completed runs loaded
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedPressRuns.map((run) => (
              <Card
                key={run.id}
                className="border border-green-200 cursor-pointer hover:bg-green-50 transition-colors"
                onClick={() => router.push(`/pressing/${run.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/pressing/${run.id}`);
                  }
                }}
                aria-label={`View press run details for ${run.pressRunName || (run.dateCompleted ? formatDate(new Date(run.dateCompleted)) : "Recent")}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {run.pressRunName ||
                          (run.dateCompleted
                            ? formatDate(new Date(run.dateCompleted))
                            : "Recent")}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {run.varieties.length > 0
                          ? run.varieties.join(", ")
                          : "Mixed varieties"}
                      </p>
                      {run.vesselName && (
                        <p className="text-xs text-gray-500">
                          → {run.vesselName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 border-blue-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/pressing/${run.id}`);
                        }}
                        title="View press run details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePressRun(run.id);
                        }}
                        title="Delete press run"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-600">Apples</p>
                      <p className="font-medium text-sm">
                        {run.totalAppleWeightKg
                          ? `${parseFloat(run.totalAppleWeightKg).toFixed(0)} kg`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Juice</p>
                      <p className="font-medium text-sm">
                        {run.totalJuiceVolume
                          ? `${parseFloat(run.totalJuiceVolume).toFixed(1)} L`
                          : "—"}
                      </p>
                      {run.totalJuiceVolume && (
                        <p className="text-xs text-gray-500">
                          {(parseFloat(run.totalJuiceVolume) / 3.78541).toFixed(1)} gal
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                      <div>
                        <p className="text-xs text-gray-600">Yield</p>
                        <p className="font-medium text-sm text-green-600">
                          {(() => {
                            // Use stored extraction rate if available, otherwise calculate it
                            const rate = run.extractionRate
                              ? parseFloat(run.extractionRate)
                              : run.totalJuiceVolume && run.totalAppleWeightKg
                                ? parseFloat(run.totalJuiceVolume) / parseFloat(run.totalAppleWeightKg)
                                : null;
                            return rate ? `${(rate * 100).toFixed(1)}%` : "—";
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* View Press Run Button */}
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-600 hover:bg-green-600 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/pressing/${run.id}`);
                      }}
                      data-testid="view-press-run"
                    >
                      View Press Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredPressRuns.length)}{" "}
                of {filteredPressRuns.length} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Mobile-optimized Action Buttons - Bottom aligned for thumb access
function ActionButtons({
  onStartNewRun,
  isCreating,
}: {
  onStartNewRun: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:relative lg:bottom-auto lg:border-t-0 lg:p-0 lg:bg-transparent">
      <div className="max-w-7xl mx-auto lg:px-0">
        {/* Primary Action - Start New Run */}
        <Button
          size="lg"
          className="w-full h-12 bg-amber-600 hover:bg-amber-700"
          onClick={onStartNewRun}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Creating Press Run...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Start New Press Run
            </>
          )}
        </Button>
      </div>
      {/* Bottom padding for mobile to prevent content cutoff */}
      <div className="h-4 lg:hidden" />
    </div>
  );
}

export default function PressingPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [selectedPressRunId, setSelectedPressRunId] = useState<string | null>(
    null,
  );
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pressRunToCancel, setPressRunToCancel] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pressRunToDelete, setPressRunToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Cancel press run mutation
  const cancelPressRunMutation = trpc.pressRun.cancel.useMutation({
    onSuccess: () => {
      toast({
        title: "Press run cancelled",
        description: "The press run has been successfully cancelled.",
        variant: "success",
      });
      // Refresh the page data
      window.location.reload();
    },
    onError: (error) => {
      console.error("Failed to cancel press run:", error);
      toast({
        title: "Error",
        description: "Failed to cancel press run. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete press run mutation
  const deletePressRunMutation = trpc.pressRun.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Press run deleted",
        description: "The press run has been permanently deleted.",
        variant: "success",
      });
      // Refresh the page data
      window.location.reload();
    },
    onError: (error) => {
      console.error("Failed to delete press run:", error);

      // Check if it's the specific error about completed press runs with juice assigned
      if (
        error.message.includes(
          "Cannot delete completed press run with juice assigned to vessel",
        )
      ) {
        toast({
          title: "Cannot delete press run",
          description:
            "This press run has juice assigned to a vessel. Completed press runs with juice assignments cannot be deleted to maintain production records.",
          variant: "destructive",
          duration: 8000, // Longer duration for important message
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete press run. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleCompletePressRun = (pressRunId: string) => {
    setSelectedPressRunId(pressRunId);
    setViewMode("completion");
  };

  const handleBackToHome = () => {
    setSelectedPressRunId(null);
    setViewMode("home");
  };

  const handleCompletionFinished = () => {
    setSelectedPressRunId(null);
    setViewMode("home");
  };

  const handleViewJuiceLot = (vesselId: string) => {
    // Navigate to batch/fermentation view
    window.location.href = `/fermentation/vessels/${vesselId}`;
  };

  // Create press run mutation
  const createPressRunMutation = trpc.pressRun.create.useMutation({
    onSuccess: (result) => {
      if (result.success && result.pressRun) {
        toast({
          title: "Press run created",
          description: "New press run started successfully.",
          variant: "success",
        });
        // Navigate directly to the press run with addFirstLoad=true
        window.location.href = `/pressing/${result.pressRun.id}?addFirstLoad=true`;
      }
    },
    onError: (error) => {
      console.error("Failed to create press run:", error);
      toast({
        title: "Error",
        description: "Failed to create press run. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartNewRun = () => {
    // Create press run directly and navigate to the details page
    createPressRunMutation.mutate({
      notes: undefined,
    });
  };

  const handleCancelPressRun = (pressRunId: string) => {
    setPressRunToCancel(pressRunId);
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    if (pressRunToCancel) {
      cancelPressRunMutation.mutate({
        id: pressRunToCancel,
        reason: "User requested cancellation from main page",
      });
    }
    setPressRunToCancel(null);
    setShowCancelDialog(false);
  };

  const handleDeleteCompletedPressRun = (pressRunId: string) => {
    setPressRunToDelete(pressRunId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (pressRunToDelete) {
      deletePressRunMutation.mutate({
        id: pressRunToDelete,
      });
    }
    setPressRunToDelete(null);
    setShowDeleteDialog(false);
  };

  // Completion view
  if (viewMode === "completion" && selectedPressRunId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 pb-8">
          <PressRunCompletion
            pressRunId={selectedPressRunId}
            onComplete={handleCompletionFinished}
            onCancel={handleBackToHome}
            onViewJuiceLot={handleViewJuiceLot}
            onStartNewRun={handleStartNewRun}
            onBackToPressingHome={handleBackToHome}
          />
        </main>
      </div>
    );
  }

  // Home view
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 pb-32 lg:pb-8">
        {/* Page Header - Mobile optimized */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Pressing
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Process apples into juice and manage pressing operations
          </p>
        </div>

        {/* Active Runs */}
        <ActiveRunsSection
          onCompletePressRun={handleCompletePressRun}
          onCancelPressRun={handleCancelPressRun}
        />

        {/* Recent Completed Runs */}
        <CompletedRunsSection
          onDeletePressRun={handleDeleteCompletedPressRun}
        />

        {/* Bottom-aligned Action Buttons (Mobile) */}
        <ActionButtons
          onStartNewRun={handleStartNewRun}
          isCreating={createPressRunMutation.isPending}
        />
      </main>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Press Run"
        description="Are you sure you want to cancel this press run? This action cannot be undone."
        confirmText="Yes, Cancel"
        cancelText="Keep Running"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Completed Press Run"
        description="Are you sure you want to delete this completed press run? Note: Press runs with juice assigned to vessels cannot be deleted to maintain production records. This will permanently remove all records and cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
