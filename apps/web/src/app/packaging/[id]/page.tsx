"use client"

import { useRouter, useParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PackagingDetailCards } from "@/components/packaging/packaging-detail-cards"
import { trpc } from "@/utils/trpc"
import {
  ArrowLeft,
  Loader2,
  Edit3,
  Printer,
  Download
} from "lucide-react"

export default function PackagingRunDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const packagingId = params.id as string

  // Get packaging run details
  const {
    data: packagingData,
    isLoading,
    error,
    refetch
  } = trpc.packaging.getById.useQuery({ id: packagingId })

  const handleBack = () => {
    router.push('/packaging')
  }

  const handleEdit = () => {
    // Navigate to edit page when implemented
    router.push(`/packaging/${packagingId}/edit`)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExport = () => {
    // Export functionality when implemented
    console.log('Export packaging run data')
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'packaged':
        return 'bg-green-100 text-green-800'
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'planned':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading packaging run details...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !packagingData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">Failed to load packaging run details</p>
            <Button onClick={handleBack}>Back to Packaging</Button>
          </div>
        </main>
      </div>
    )
  }

  const { package: packageInfo, batch, vessel, batchMeasurements, batchComposition, inventory, transactions, calculatedMetrics } = packagingData

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
            Back to Packaging
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {batch?.name || batch?.customName || `Batch #${batch?.batchNumber || packagingId.slice(0, 8).toUpperCase()}`}
              </h1>
              <p className="text-gray-600 mt-1">
                Packaging run details and batch information
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge
                variant="secondary"
                className={getStatusColor(batch?.status || 'unknown')}
              >
                {batch?.status === 'packaged' ? 'Packaged' :
                 batch?.status === 'active' ? 'Active' :
                 batch?.status === 'planned' ? 'Planned' :
                 batch?.status || 'Unknown'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Packaging Detail Cards */}
        <PackagingDetailCards
          packageInfo={packageInfo}
          batch={batch}
          vessel={vessel}
          batchMeasurements={batchMeasurements}
          batchComposition={batchComposition}
          inventory={inventory}
          transactions={transactions}
          calculatedMetrics={calculatedMetrics}
        />

        {/* Desktop Action Buttons */}
        <div className="hidden lg:flex space-x-4 mt-6">
          <Button
            onClick={handleEdit}
            variant="outline"
            className="flex items-center"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex items-center"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Mobile Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:hidden">
          <div className="max-w-7xl mx-auto flex space-x-3">
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .navbar,
          .fixed,
          .lg\\:hidden,
          .hidden.lg\\:flex {
            display: none !important;
          }

          .min-h-screen {
            min-height: auto;
          }

          .bg-gray-50 {
            background: white;
          }

          .shadow-sm,
          .shadow-md {
            box-shadow: none;
          }

          .border {
            border: 1px solid #e5e5e5;
          }
        }
      `}</style>
    </div>
  )
}