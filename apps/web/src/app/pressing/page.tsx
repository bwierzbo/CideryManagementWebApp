"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PressRunCompletion } from "@/components/pressing"
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
  Trash2
} from "lucide-react"
import { trpc } from "@/utils/trpc"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface PressRun {
  id: string
  startDate: string
  totalAppleKg: number
  varieties: string[]
  status: "in_progress" | "completed"
  duration?: string
  estimatedCompletion?: string
  totalJuiceL?: number
  yield?: string
}

type ViewMode = 'home' | 'completion'


// Mobile-optimized Active Runs Section
function ActiveRunsSection({
  onCompletePressRun,
  onCancelPressRun
}: {
  onCompletePressRun: (pressRunId: string) => void
  onCancelPressRun: (pressRunId: string) => void
}) {
  const { data: pressRunsData, isLoading, refetch } = trpc.pressRun.list.useQuery({
    status: 'in_progress',
    limit: 10,
  })

  // Convert tRPC data to expected format
  const activeRuns = pressRunsData?.pressRuns?.map(run => ({
    id: run.id,
    startDate: run.startTime ? new Date(run.startTime).toLocaleDateString() : 'Unknown',
    totalAppleKg: parseFloat(run.totalAppleWeightKg || '0'),
    varieties: run.varieties && run.varieties.length > 0 ? run.varieties : ['No varieties'],
    status: run.status as "in_progress" | "completed",
    duration: run.startTime ? calculateDuration(run.startTime) : 'Unknown',
    loadCount: run.loadCount || 0,
    vendorName: run.vendorName,
  })) || []

  function calculateDuration(startTime: string): string {
    const start = new Date(startTime)
    const now = new Date()
    const diffMs = now.getTime() - start.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading active press runs...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeRuns.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Press Runs</h3>
            <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
              Start a new press run to begin processing apples into juice
            </p>
          </div>
        </CardContent>
      </Card>
    )
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
          <Card key={run.id} className="border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="p-4">
              {/* Run Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{run.vendorName || `Run ${run.id.slice(0, 8)}`}</h4>
                  <p className="text-sm text-gray-600">Started {run.startDate}</p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
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
                    <p className="font-medium text-sm">{run.loadCount || 0} processed</p>
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
                  onClick={() => window.location.href = `/pressing/${run.id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Details
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
                    e.stopPropagation()
                    onCancelPressRun(run.id)
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
  )
}


// Mobile-optimized Completed Runs Section
function CompletedRunsSection() {
  const recentCompleted: PressRun[] = [
    {
      id: "PR-2024-003",
      startDate: "2024-01-12",
      totalAppleKg: 1100,
      varieties: ["Fuji", "Braeburn"],
      status: "completed",
      totalJuiceL: 785,
      yield: "71.4%"
    },
    {
      id: "PR-2024-004",
      startDate: "2024-01-10",
      totalAppleKg: 950,
      varieties: ["Honeycrisp"],
      status: "completed",
      totalJuiceL: 652,
      yield: "68.6%"
    }
  ]

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Completed</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-600 h-8 px-3"
        >
          View All
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="space-y-3">
        {recentCompleted.map((run) => (
          <Card key={run.id} className="border border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">{run.id}</h4>
                  <p className="text-sm text-gray-600">{run.startDate}</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Completed
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-600">Apples</p>
                  <p className="font-medium text-sm">{run.totalAppleKg} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Juice</p>
                  <p className="font-medium text-sm">{run.totalJuiceL} L</p>
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                  <div>
                    <p className="text-xs text-gray-600">Yield</p>
                    <p className="font-medium text-sm text-green-600">{run.yield}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Mobile-optimized Action Buttons - Bottom aligned for thumb access
function ActionButtons({ onStartNewRun, isCreating }: { onStartNewRun: () => void, isCreating: boolean }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:relative lg:bottom-auto lg:border-t-0 lg:p-0 lg:bg-transparent">
      <div className="max-w-7xl mx-auto lg:px-0">
        <div className="space-y-3 lg:space-y-0 lg:flex lg:space-x-3">
          {/* Primary Action - Start New Run */}
          <Button
            size="lg"
            className="w-full h-12 bg-amber-600 hover:bg-amber-700 lg:flex-1"
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

          {/* Secondary Action - View All Runs */}
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 lg:flex-1"
          >
            <Eye className="w-5 h-5 mr-2" />
            View All Runs
          </Button>
        </div>
      </div>
      {/* Bottom padding for mobile to prevent content cutoff */}
      <div className="h-4 lg:hidden" />
    </div>
  )
}

export default function PressingPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [selectedPressRunId, setSelectedPressRunId] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [pressRunToCancel, setPressRunToCancel] = useState<string | null>(null)

  // Cancel press run mutation
  const cancelPressRunMutation = trpc.pressRun.cancel.useMutation({
    onSuccess: () => {
      // Refresh the page data
      window.location.reload()
    },
    onError: (error) => {
      console.error('Failed to cancel press run:', error)
      alert('Failed to cancel press run. Please try again.')
    }
  })

  const handleCompletePressRun = (pressRunId: string) => {
    setSelectedPressRunId(pressRunId)
    setViewMode('completion')
  }

  const handleBackToHome = () => {
    setSelectedPressRunId(null)
    setViewMode('home')
  }

  const handleCompletionFinished = () => {
    setSelectedPressRunId(null)
    setViewMode('home')
  }

  const handleViewJuiceLot = (vesselId: string) => {
    // Navigate to batch/fermentation view
    window.location.href = `/fermentation/vessels/${vesselId}`
  }

  // Create press run mutation
  const createPressRunMutation = trpc.pressRun.create.useMutation({
    onSuccess: (result) => {
      if (result.success && result.pressRun) {
        // Navigate directly to the press run with addFirstLoad=true
        window.location.href = `/pressing/${result.pressRun.id}?addFirstLoad=true`
      }
    },
    onError: (error) => {
      console.error('Failed to create press run:', error)
      alert('Failed to create press run. Please try again.')
    }
  })

  const handleStartNewRun = () => {
    // Create press run directly and navigate to the details page
    createPressRunMutation.mutate({
      startTime: new Date(),
      notes: undefined,
    })
  }


  const handleCancelPressRun = (pressRunId: string) => {
    setPressRunToCancel(pressRunId)
    setShowCancelDialog(true)
  }

  const handleConfirmCancel = () => {
    if (pressRunToCancel) {
      cancelPressRunMutation.mutate({
        id: pressRunToCancel,
        reason: 'User requested cancellation from main page'
      })
    }
    setPressRunToCancel(null)
  }

  // Completion view
  if (viewMode === 'completion' && selectedPressRunId) {
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
    )
  }

  // Home view
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-8">
        {/* Page Header - Mobile optimized */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pressing</h1>
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
        <CompletedRunsSection />

        {/* Bottom-aligned Action Buttons (Mobile) */}
        <ActionButtons onStartNewRun={handleStartNewRun} isCreating={createPressRunMutation.isPending} />
      </main>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Delete Press Run"
        description="Are you sure you want to delete this press run? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}