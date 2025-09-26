"use client"

import { useState, useCallback } from "react"
import { Navbar } from "@/components/navbar"
import { PackagingTable } from "@/components/packaging/packaging-table"
import { PackagingFilters, PackagingFiltersState } from "@/components/packaging/packaging-filters"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Download, X, Loader2 } from "lucide-react"


export default function PackagingPage() {
  const [filters, setFilters] = useState<PackagingFiltersState>({
    dateFrom: null,
    dateTo: null,
    packageSizeML: null,
    batchSearch: '',
    status: 'all'
  })

  const [isExporting, setIsExporting] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [tableData, setTableData] = useState<{
    items: any[]
    count: number
    exportCSV: () => void
    exportSelectedCSV: (selectedIds: string[]) => void
    selectedCount: number
  }>({
    items: [],
    count: 0,
    exportCSV: () => {},
    exportSelectedCSV: () => {},
    selectedCount: 0
  })

  const handleFiltersChange = useCallback((newFilters: PackagingFiltersState) => {
    setFilters(newFilters)
  }, [])

  const handleTableDataChange = useCallback((data: {
    items: any[]
    count: number
    exportCSV: () => void
    exportSelectedCSV: (selectedIds: string[]) => void
    selectedCount: number
  }) => {
    setTableData(data)
  }, [])

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedItems(selectedIds)
    setShowBulkActions(selectedIds.length > 0)
  }, [])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      await tableData.exportCSV()
    } finally {
      setIsExporting(false)
    }
  }, [tableData])

  const handleBulkExport = useCallback(async () => {
    if (selectedItems.length === 0) return

    setIsExporting(true)
    try {
      await tableData.exportSelectedCSV(selectedItems)
    } finally {
      setIsExporting(false)
    }
  }, [selectedItems, tableData])

  const handleClearSelection = useCallback(() => {
    setSelectedItems([])
    setShowBulkActions(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Packaging Runs</h1>
              <p className="text-gray-600 mt-1">
                View and manage all packaging operations and production runs.
              </p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Packaging Run
            </Button>
          </div>
        </div>

        {/* Filters */}
        <PackagingFilters
          onFiltersChange={handleFiltersChange}
          onExportClick={handleExport}
          isExporting={isExporting}
          initialFilters={filters}
          itemCount={tableData.count}
        />

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {selectedItems.length} selected
                  </Badge>
                  <span className="text-sm text-blue-700">
                    {selectedItems.length === 1
                      ? '1 packaging run selected'
                      : `${selectedItems.length} packaging runs selected`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={isExporting}
                    className="border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export Selected
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-blue-700 hover:bg-blue-100"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <PackagingTable
          filters={filters}
          onDataChange={handleTableDataChange}
          enableSelection={true}
          selectedItems={selectedItems}
          onSelectionChange={handleSelectionChange}
        />
      </main>
    </div>
  )
}