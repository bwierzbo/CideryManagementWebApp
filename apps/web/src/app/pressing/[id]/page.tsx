"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FruitLoadFormWithTRPC } from "@/components/pressing/FruitLoadFormWithTRPC"
import { trpc } from "@/utils/trpc"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ArrowLeft,
  Plus,
  Loader2,
  Scale,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  Apple,
  Beaker,
  Edit3,
  Trash2,
  X
} from "lucide-react"

export default function PressRunDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const pressRunId = params.id as string

  // Check if we should show the add load form immediately (for first load)
  const shouldAddFirstLoad = searchParams.get('addFirstLoad') === 'true'

  const [showAddLoadForm, setShowAddLoadForm] = useState(shouldAddFirstLoad)
  const [isSubmittingLoad, setIsSubmittingLoad] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [editingLoad, setEditingLoad] = useState<any>(null)
  const [isUpdatingLoad, setIsUpdatingLoad] = useState(false)
  const [isDeletingLoad, setIsDeletingLoad] = useState(false)

  // Get tRPC context for cache invalidation
  const utils = trpc.useContext()

  // Get press run details
  const {
    data: pressRun,
    isLoading,
    error,
    refetch
  } = trpc.pressRun.get.useQuery({ id: pressRunId })

  // Add load mutation
  const addLoadMutation = trpc.pressRun.addLoad.useMutation({
    onSuccess: () => {
      setIsSubmittingLoad(false)
      setShowAddLoadForm(false)
      refetch() // Refresh press run data
      // Invalidate press runs list cache to update the pressing page
      utils.pressRun.list.invalidate()
    },
    onError: (error) => {
      setIsSubmittingLoad(false)
      console.error('Failed to add load:', error)
      alert('Failed to add load. Please try again.')
    }
  })

  // Update load mutation
  const updateLoadMutation = trpc.pressRun.updateLoad.useMutation({
    onSuccess: () => {
      setIsUpdatingLoad(false)
      setEditingLoad(null)
      refetch() // Refresh press run data
      // Invalidate press runs list cache to update the pressing page
      utils.pressRun.list.invalidate()
    },
    onError: (error) => {
      setIsUpdatingLoad(false)
      console.error('Failed to update load:', error)
      alert('Failed to update load. Please try again.')
    }
  })

  // Cancel press run mutation
  const cancelPressRunMutation = trpc.pressRun.cancel.useMutation({
    onSuccess: () => {
      setIsCancelling(false)
      // Navigate back to pressing home
      router.push('/pressing')
    },
    onError: (error) => {
      setIsCancelling(false)
      console.error('Failed to cancel press run:', error)
      alert('Failed to cancel press run. Please try again.')
    }
  })

  // Delete load mutation
  const deleteLoadMutation = trpc.pressRun.deleteLoad.useMutation({
    onSuccess: () => {
      setIsDeletingLoad(false)
      setEditingLoad(null)
      refetch() // Refresh press run data
      // Invalidate press runs list cache to update the pressing page
      utils.pressRun.list.invalidate()
    },
    onError: (error) => {
      setIsDeletingLoad(false)
      console.error('Failed to delete load:', error)
      alert('Failed to delete load. Please try again.')
    }
  })

  const handleAddLoad = async (loadData: any) => {
    setIsSubmittingLoad(true)

    addLoadMutation.mutate({
      pressRunId,
      vendorId: loadData.vendorId,
      purchaseItemId: loadData.purchaseItemId,
      appleVarietyId: loadData.appleVarietyId,
      appleWeightKg: loadData.appleWeightKg,
      originalWeight: loadData.originalWeight,
      originalWeightUnit: loadData.originalWeightUnit,
      notes: loadData.notes,
    })
  }

  const handleUpdateLoad = async (loadData: any) => {
    setIsUpdatingLoad(true)

    updateLoadMutation.mutate({
      loadId: editingLoad.id,
      vendorId: loadData.vendorId,
      purchaseItemId: loadData.purchaseItemId,
      appleVarietyId: loadData.appleVarietyId,
      appleWeightKg: loadData.appleWeightKg,
      originalWeight: loadData.originalWeight,
      originalWeightUnit: loadData.originalWeightUnit,
      notes: loadData.notes,
    })
  }

  const handleEditLoad = (load: any) => {
    setEditingLoad(load)
    setShowAddLoadForm(false) // Hide add form if it's open
  }

  const handleCancelEdit = () => {
    setEditingLoad(null)
  }

  const handleDeleteLoad = async (loadId: string) => {
    setIsDeletingLoad(true)
    deleteLoadMutation.mutate({ loadId })
  }

  const handleBack = () => {
    router.push('/pressing')
  }

  const handleComplete = () => {
    // Navigate to completion form
    router.push(`/pressing/${pressRunId}/complete`)
  }

  const handleCancel = () => {
    setShowCancelDialog(true)
  }

  const handleConfirmCancel = () => {
    setIsCancelling(true)
    cancelPressRunMutation.mutate({
      id: pressRunId,
      reason: 'User requested cancellation from details page'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading press run details...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !pressRun) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">Failed to load press run details</p>
            <Button onClick={handleBack}>Back to Pressing</Button>
          </div>
        </main>
      </div>
    )
  }

  const nextLoadSequence = (pressRun.loads?.length || 0) + 1
  const totalWeight = pressRun.loads?.reduce((sum, load) => sum + parseFloat(load.appleWeightKg || '0'), 0) || 0
  const totalWeightLbs = totalWeight * 2.20462

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pressing
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Press Run #{pressRunId.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-gray-600 mt-1">
                Manage loads and track pressing progress
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge
                variant="secondary"
                className={
                  pressRun?.pressRun?.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  pressRun?.pressRun?.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {pressRun?.pressRun?.status === 'in_progress' ? 'In Progress' :
                 pressRun?.pressRun?.status === 'completed' ? 'Completed' :
                 pressRun?.pressRun?.status}
              </Badge>
              {pressRun?.pressRun?.status === 'in_progress' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Cancel</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Press Run Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Press Run Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <Scale className="w-4 h-4 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Total Weight</p>
                  <p className="font-medium">{totalWeightLbs.toFixed(1)} lbs</p>
                </div>
              </div>
              <div className="flex items-center">
                <Apple className="w-4 h-4 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Loads</p>
                  <p className="font-medium">{pressRun.loads?.length || 0} added</p>
                </div>
              </div>
            </div>

            {pressRun?.pressRun?.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-sm">{pressRun?.pressRun?.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Loads Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Fruit Loads</h3>
            {!showAddLoadForm && (
              <Button
                onClick={() => setShowAddLoadForm(true)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Load
              </Button>
            )}
          </div>

          {/* Add Load Form */}
          {showAddLoadForm && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Plus className="h-5 w-5 mr-2 text-amber-600" />
                  Add Load #{nextLoadSequence}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FruitLoadFormWithTRPC
                  loadSequence={nextLoadSequence}
                  onSubmit={handleAddLoad}
                  onCancel={() => setShowAddLoadForm(false)}
                  isSubmitting={isSubmittingLoad}
                />
              </CardContent>
            </Card>
          )}

          {/* Edit Load Form */}
          {editingLoad && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Edit3 className="h-5 w-5 mr-2 text-blue-600" />
                  Edit Load #{editingLoad.loadSequence}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FruitLoadFormWithTRPC
                  loadSequence={editingLoad.loadSequence}
                  editingLoad={editingLoad}
                  onSubmit={handleUpdateLoad}
                  onCancel={handleCancelEdit}
                  onDelete={handleDeleteLoad}
                  isSubmitting={isUpdatingLoad || isDeletingLoad}
                />
              </CardContent>
            </Card>
          )}

          {/* Existing Loads */}
          {(pressRun.loads?.length || 0) > 0 ? (
            <div className="space-y-3">
              {pressRun.loads?.map((load, index) => (
                <Card
                  key={load.id || index}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    editingLoad?.id === load.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleEditLoad(load)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          Load #{load.loadSequence || index + 1}
                          <Edit3 className="w-4 h-4 ml-2 text-gray-400" />
                        </h4>
                        <p className="text-sm text-gray-600">
                          {load.appleVarietyName || 'Unknown Variety'}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {parseFloat(load.appleWeightKg || '0').toFixed(1)} kg
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {load.brixMeasured && (
                        <div>
                          <p className="text-gray-600">Brix</p>
                          <p className="font-medium">{load.brixMeasured}°</p>
                        </div>
                      )}
                      {load.phMeasured && (
                        <div>
                          <p className="text-gray-600">pH</p>
                          <p className="font-medium">{load.phMeasured}</p>
                        </div>
                      )}
                      {load.appleCondition && (
                        <div>
                          <p className="text-gray-600">Condition</p>
                          <p className="font-medium capitalize">{load.appleCondition}</p>
                        </div>
                      )}
                      {load.defectPercentage && (
                        <div>
                          <p className="text-gray-600">Defects</p>
                          <p className="font-medium">{load.defectPercentage}%</p>
                        </div>
                      )}
                    </div>

                    {load.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">{load.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Apple className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Loads Added Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Add fruit loads to start processing apples for this press run
                </p>
                {pressRun?.pressRun?.status === 'in_progress' && (
                  <Button
                    onClick={() => setShowAddLoadForm(true)}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Load
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        {pressRun?.pressRun?.status === 'in_progress' && (pressRun.loads?.length || 0) > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:relative lg:bottom-auto lg:border-t-0 lg:p-0 lg:bg-transparent">
            <div className="max-w-7xl mx-auto">
              <Button
                onClick={handleComplete}
                size="lg"
                className="w-full h-12 bg-green-600 hover:bg-green-700 lg:w-auto"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Complete Press Run
              </Button>
            </div>
          </div>
        )}

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
      </main>
    </div>
  )
}