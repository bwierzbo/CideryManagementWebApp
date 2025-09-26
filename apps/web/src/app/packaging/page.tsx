"use client"

import { useState, useCallback } from "react"
import { Navbar } from "@/components/navbar"
import { PackagingTable } from "@/components/packaging/packaging-table"
import { PackagingFilters, PackagingFiltersState } from "@/components/packaging/packaging-filters"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"


export default function PackagingPage() {
  const [filters, setFilters] = useState<PackagingFiltersState>({
    dateFrom: null,
    dateTo: null,
    packageSizeML: null,
    batchSearch: '',
    status: 'all'
  })

  const [isExporting, setIsExporting] = useState(false)
  const [tableData, setTableData] = useState<{
    items: any[]
    count: number
    exportCSV: () => void
  }>({
    items: [],
    count: 0,
    exportCSV: () => {}
  })

  const handleFiltersChange = useCallback((newFilters: PackagingFiltersState) => {
    setFilters(newFilters)
  }, [])

  const handleTableDataChange = useCallback((data: {
    items: any[]
    count: number
    exportCSV: () => void
  }) => {
    setTableData(data)
  }, [])

  const handleExport = useCallback(() => {
    setIsExporting(true)
    try {
      tableData.exportCSV()
    } finally {
      setIsExporting(false)
    }
  }, [tableData])

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

        {/* Main Content */}
        <PackagingTable
          filters={filters}
          onDataChange={handleTableDataChange}
        />
      </main>
    </div>
  )
}