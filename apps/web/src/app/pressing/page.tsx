"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PressRunCompletion } from "@/components/pressing"
import { usePressRunDrafts, useNetworkSync, useOfflineCapability } from "@/hooks/use-press-run-drafts"
import {
  Grape,
  Play,
  CheckCircle2,
  Clock,
  Scale,
  Calendar,
  Plus,
  Eye,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff,
  Download,
  AlertTriangle,
  Trash2,
  Edit3
} from "lucide-react"
import { trpc } from "@/utils/trpc"

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

// Mobile-optimized Press Run Header with network status
function PressRunHeader() {
  const { isOnline, syncing, syncAllDrafts } = useNetworkSync()
  const { storageQuota } = useOfflineCapability()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const handleManualSync = async () => {
    if (!isOnline) return
    await syncAllDrafts()
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-amber-900">Press Operations</h2>
          <p className="text-sm text-amber-700 flex items-center mt-1">
            <Calendar className="w-4 h-4 mr-2" />
            {today}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Network Status */}
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <div className="flex items-center text-green-600">
                <Wifi className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">Online</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <WifiOff className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">Offline</span>
              </div>
            )}

            {/* Sync Button */}
            {isOnline && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualSync}
                disabled={syncing}
                className="text-xs h-6 px-2"
              >
                {syncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
              </Button>
            )}

            {/* Storage Quota Warning */}
            {storageQuota.isNearLimit && (
              <div className="flex items-center text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium ml-1">
                  {storageQuota.percentUsed.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-amber-100 rounded-full p-3">
            <Grape className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Mobile-optimized Active Runs Section
function ActiveRunsSection({ onCompletePressRun }: { onCompletePressRun: (pressRunId: string) => void }) {
  const { data: pressRunsData, isLoading, refetch } = trpc.pressRun.list.useQuery({
    status: 'in_progress',
    limit: 10,
  })

  // Convert tRPC data to expected format
  const activeRuns = pressRunsData?.pressRuns?.map(run => ({
    id: run.id,
    startDate: run.startTime ? new Date(run.startTime).toLocaleDateString() : 'Unknown',
    totalAppleKg: parseFloat(run.totalAppleWeightKg || '0'),
    varieties: ['Mixed Varieties'], // This would need to be expanded with actual variety data
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
                  <p className="text-xs text-gray-500">{run.loadCount || 0} loads processed</p>
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
                    <p className="text-xs text-gray-600">Duration</p>
                    <p className="font-medium text-sm">{run.duration}</p>
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
                <Button size="sm" variant="outline" className="flex-1 h-10">
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Draft Press Runs Section for Resume Functionality
function DraftRunsSection({ onResumeDraft }: { onResumeDraft: (draftId: string) => void }) {
  const { drafts, loading, deleteDraft } = usePressRunDrafts()
  const { isOnline } = useNetworkSync()

  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      deleteDraft(draftId)
    }
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading drafts...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (drafts.length === 0) {
    return null // Don't show section if no drafts
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Resumable Press Runs</h3>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-3">
        {drafts.map((draft) => {
          const statusColors = {
            draft: 'bg-gray-100 text-gray-800',
            syncing: 'bg-blue-100 text-blue-800',
            synced: 'bg-green-100 text-green-800',
            error: 'bg-red-100 text-red-800',
          }

          const lastModified = new Date(draft.lastModified)
          const timeSinceModified = Math.round((Date.now() - lastModified.getTime()) / (1000 * 60)) // minutes

          return (
            <Card
              key={draft.id}
              className="border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onResumeDraft(draft.id)}
            >
              <CardContent className="p-4">
                {/* Draft Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center">
                      <Edit3 className="w-4 h-4 mr-2 text-orange-600" />
                      {draft.vendorName || `Draft ${draft.id.slice(0, 8)}`}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Started {new Date(draft.startTime).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Modified {timeSinceModified < 60
                        ? `${timeSinceModified}m ago`
                        : `${Math.round(timeSinceModified / 60)}h ago`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className={statusColors[draft.status]}>
                      {draft.status === 'draft' && 'Draft'}
                      {draft.status === 'syncing' && 'Syncing...'}
                      {draft.status === 'synced' && 'Synced'}
                      {draft.status === 'error' && 'Sync Failed'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteDraft(draft.id, e)}
                      className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Draft Stats */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center">
                    <Scale className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Total Weight</p>
                      <p className="font-medium text-sm">{draft.totalAppleWeightKg.toFixed(1)} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-600">Loads</p>
                      <p className="font-medium text-sm">{draft.loads.length} added</p>
                    </div>
                  </div>
                </div>

                {/* Sync Status Messages */}
                {draft.status === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                    <p className="text-xs text-red-800 flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Failed to sync ({draft.syncAttempts} attempts)
                      {isOnline && ' - Will retry automatically'}
                    </p>
                  </div>
                )}

                {!isOnline && draft.status === 'draft' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-3">
                    <p className="text-xs text-yellow-800 flex items-center">
                      <WifiOff className="w-3 h-3 mr-1" />
                      Saved locally - will sync when online
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button size="sm" className="w-full h-10 bg-orange-600 hover:bg-orange-700">
                  <Play className="w-4 h-4 mr-2" />
                  Resume Press Run
                </Button>
              </CardContent>
            </Card>
          )
        })}
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
function ActionButtons() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:relative lg:bottom-auto lg:border-t-0 lg:p-0 lg:bg-transparent">
      <div className="max-w-7xl mx-auto lg:px-0">
        <div className="space-y-3 lg:space-y-0 lg:flex lg:space-x-3">
          {/* Primary Action - Start New Run */}
          <Button
            size="lg"
            className="w-full h-12 bg-amber-600 hover:bg-amber-700 lg:flex-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            Start New Press Run
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
  const [resumingDraftId, setResumingDraftId] = useState<string | null>(null)

  const handleCompletePressRun = (pressRunId: string) => {
    setSelectedPressRunId(pressRunId)
    setViewMode('completion')
  }

  const handleBackToHome = () => {
    setSelectedPressRunId(null)
    setResumingDraftId(null)
    setViewMode('home')
  }

  const handleCompletionFinished = () => {
    setSelectedPressRunId(null)
    setResumingDraftId(null)
    setViewMode('home')
  }

  const handleViewJuiceLot = (vesselId: string) => {
    // Navigate to batch/fermentation view
    window.location.href = `/fermentation/vessels/${vesselId}`
  }

  const handleStartNewRun = () => {
    // Navigate to new press run creation
    window.location.href = '/pressing/new'
  }

  const handleResumeDraft = (draftId: string) => {
    // For now, navigate to a new press run page with the draft ID
    // In the future, this could be a dedicated resume page
    window.location.href = `/pressing/resume/${draftId}`
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

        {/* Press Run Header */}
        <PressRunHeader />

        {/* Draft Runs - Resume Functionality */}
        <DraftRunsSection onResumeDraft={handleResumeDraft} />

        {/* Active Runs */}
        <ActiveRunsSection onCompletePressRun={handleCompletePressRun} />

        {/* Recent Completed Runs */}
        <CompletedRunsSection />

        {/* Bottom-aligned Action Buttons (Mobile) */}
        <ActionButtons />
      </main>
    </div>
  )
}