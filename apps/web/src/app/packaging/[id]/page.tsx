"use client"

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { QAUpdateModal } from '@/components/packaging/qa-update-modal'
import {
  Package,
  Calendar,
  Beaker,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Edit,
  User,
  TestTube,
  Droplets,
  Target,
  FileText,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/utils/trpc'

export default function PackagingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string
  const [qaModalOpen, setQaModalOpen] = useState(false)

  // Auth for permission checks
  const { data: session } = useSession()

  // Fetch packaging run data
  const {
    data: runData,
    isLoading,
    error,
    refetch
  } = trpc.packaging.get.useQuery(runId, {
    enabled: !!runId
  })

  // Permission check: Admins and operators can update QA data
  const userRole = (session?.user as any)?.role
  const canUpdateQA = userRole === 'admin' || userRole === 'operator'

  // Format date display
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format package size display
  const formatPackageSize = (sizeML: number, packageType: string) => {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L ${packageType}`
    }
    return `${sizeML}ml ${packageType}`
  }

  // Get status badge color
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'voided':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get loss percentage color
  const getLossColor = (lossPercentage: number) => {
    if (lossPercentage <= 2) return 'text-green-600'
    if (lossPercentage <= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Get fill check color
  const getFillCheckColor = (fillCheck: string | null) => {
    switch (fillCheck) {
      case 'pass':
        return 'text-green-600'
      case 'fail':
        return 'text-red-600'
      case 'not_tested':
        return 'text-yellow-600'
      default:
        return 'text-gray-500'
    }
  }

  // Get carbonation level display
  const getCarbonationDisplay = (level: string | null) => {
    switch (level) {
      case 'still':
        return 'Still (no carbonation)'
      case 'petillant':
        return 'Pétillant (light carbonation)'
      case 'sparkling':
        return 'Sparkling (full carbonation)'
      default:
        return 'Not specified'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !runData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span>Error loading packaging run: {error?.message || 'Not found'}</span>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8" />
                Packaging Run Details
              </h1>
              <p className="text-gray-600 mt-1">
                {runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`} • {formatPackageSize(runData.packageSizeML, runData.packageType)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={cn("text-sm", getStatusColor(runData.status))}>
                {runData.status || 'pending'}
              </Badge>
              {canUpdateQA && (
                <Button onClick={() => setQaModalOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Update QA
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Production Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Production Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Production Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Batch</p>
                    <p className="font-medium">{runData.batch.name || `Batch ${runData.batchId.slice(0, 8)}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vessel</p>
                    <p className="font-medium">{runData.vessel.name || `Vessel ${runData.vesselId.slice(0, 8)}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Packaged Date</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(runData.packagedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Package Type & Size</p>
                    <p className="font-medium">{formatPackageSize(runData.packageSizeML, runData.packageType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Units Produced</p>
                    <p className="font-medium text-lg">{runData.unitsProduced.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Volume Taken</p>
                    <p className="font-medium">{runData.volumeTakenL.toFixed(1)}L</p>
                  </div>
                </div>

                <Separator />

                {/* Loss Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Loss Amount</p>
                    <p className="font-medium">{runData.lossL.toFixed(2)}L</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loss Percentage</p>
                    <p className={cn("font-medium text-lg", getLossColor(runData.lossPercentage))}>
                      {runData.lossPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quality Assurance Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  Quality Assurance
                </CardTitle>
                <CardDescription>
                  Quality control measurements and testing results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Fill Check
                    </p>
                    <p className={cn("font-medium", getFillCheckColor(runData.fillCheck))}>
                      {runData.fillCheck ?
                        runData.fillCheck.charAt(0).toUpperCase() + runData.fillCheck.slice(1).replace('_', ' ') :
                        'Not tested'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fill Variance</p>
                    <p className="font-medium">
                      {runData.fillVarianceML !== undefined ?
                        `${runData.fillVarianceML > 0 ? '+' : ''}${runData.fillVarianceML.toFixed(1)}ml` :
                        'Not measured'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <TestTube className="w-4 h-4" />
                      ABV at Packaging
                    </p>
                    <p className="font-medium">
                      {runData.abvAtPackaging !== undefined ?
                        `${runData.abvAtPackaging.toFixed(2)}%` :
                        'Not measured'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Droplets className="w-4 h-4" />
                      Carbonation Level
                    </p>
                    <p className="font-medium">{getCarbonationDisplay(runData.carbonationLevel)}</p>
                  </div>
                </div>

                {(runData.testMethod || runData.testDate) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      {runData.testMethod && (
                        <div>
                          <p className="text-sm text-gray-500">Test Method</p>
                          <p className="font-medium">{runData.testMethod}</p>
                        </div>
                      )}
                      {runData.testDate && (
                        <div>
                          <p className="text-sm text-gray-500">Test Date</p>
                          <p className="font-medium">{formatDate(runData.testDate)}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(runData.qaTechnicianName || runData.qaNotes) && (
                  <>
                    <Separator />
                    {runData.qaTechnicianName && (
                      <div>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          QA Technician
                        </p>
                        <p className="font-medium">{runData.qaTechnicianName}</p>
                      </div>
                    )}
                    {runData.qaNotes && (
                      <div>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          QA Notes
                        </p>
                        <p className="font-medium whitespace-pre-wrap">{runData.qaNotes}</p>
                      </div>
                    )}
                  </>
                )}

                {!runData.fillCheck && !runData.fillVarianceML && !runData.abvAtPackaging && !runData.carbonationLevel && !runData.testMethod && !runData.qaNotes && (
                  <div className="text-center py-8 text-gray-500">
                    <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No QA data recorded yet</p>
                    {canUpdateQA && (
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => setQaModalOpen(true)}
                      >
                        Add QA Data
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Production Notes */}
            {runData.productionNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Production Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{runData.productionNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Inventory & Metadata */}
          <div className="space-y-6">
            {/* Inventory Items */}
            {runData.inventory && runData.inventory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Inventory Items
                  </CardTitle>
                  <CardDescription>
                    {runData.inventory.length} item{runData.inventory.length !== 1 ? 's' : ''} created
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runData.inventory.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <p className="font-medium">{item.lotCode}</p>
                      <p className="text-sm text-gray-500">
                        {formatPackageSize(item.packageSizeML, item.packageType)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Expires: {new Date(item.expirationDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="font-medium">{runData.createdByName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium">{formatDate(runData.createdAt)}</p>
                </div>
                {runData.updatedAt && runData.updatedAt !== runData.createdAt && (
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium">{formatDate(runData.updatedAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photos */}
            {runData.photos && runData.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Photos
                  </CardTitle>
                  <CardDescription>
                    {runData.photos.length} photo{runData.photos.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runData.photos.map((photo) => (
                    <div key={photo.id} className="space-y-2">
                      <img
                        src={photo.photoUrl}
                        alt={photo.caption || 'Packaging photo'}
                        className="w-full rounded-lg"
                      />
                      {photo.caption && (
                        <p className="text-sm text-gray-600">{photo.caption}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {photo.uploaderName} • {formatDate(photo.uploadedAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* QA Update Modal */}
      <QAUpdateModal
        open={qaModalOpen}
        onClose={() => setQaModalOpen(false)}
        runId={runId}
        runData={runData}
      />
    </div>
  )
}