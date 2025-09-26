"use client"

import { Navbar } from "@/components/navbar"
import { PackagingTable } from "@/components/packaging/packaging-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"


export default function PackagingPage() {
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

        {/* Main Content */}
        <PackagingTable />
      </main>
    </div>
  )
}