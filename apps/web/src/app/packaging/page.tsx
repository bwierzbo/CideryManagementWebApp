"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Package,
  Wine,
  Archive,
  MapPin,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  Search,
  Filter,
  Calendar,
  Hash,
  Droplets
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Form schemas
const packagingSchema = z.object({
  batchId: z.string().uuid("Select a batch"),
  packageDate: z.string().min(1, "Package date is required"),
  bottleSize: z.string().min(1, "Wine size is required"),
  bottleCount: z.number().positive("Wine count must be positive"),
  volumePackagedL: z.number().positive("Volume must be positive"),
  lossL: z.number().min(0, "Loss cannot be negative").optional(),
  abvAtPackaging: z.number().min(0).max(20).optional(),
  location: z.string().min(1, "Storage location is required"),
  notes: z.string().optional(),
})

type PackagingForm = z.infer<typeof packagingSchema>

function PackagingRunForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<PackagingForm>({
    resolver: zodResolver(packagingSchema)
  })

  const bottleCount = watch("bottleCount")
  const bottleSize = watch("bottleSize")
  const volumePackagedL = watch("volumePackagedL")
  const lossL = watch("lossL")

  // Mock batch data
  const availableBatches = [
    { id: "B-2024-001", batchNumber: "B-2024-001", currentVolumeL: 735, abv: 6.2, vessel: "Fermenter Tank 1" },
    { id: "B-2024-002", batchNumber: "B-2024-002", currentVolumeL: 890, abv: 5.8, vessel: "Conditioning Tank 1" },
    { id: "B-2024-003", batchNumber: "B-2024-003", currentVolumeL: 1150, abv: 6.5, vessel: "Bright Tank 1" }
  ]

  const calculateWineVolume = (size: string) => {
    switch (size) {
      case "375ml": return 0.375
      case "500ml": return 0.5
      case "750ml": return 0.75
      case "1L": return 1.0
      default: return 0
    }
  }

  const calculateExpectedVolume = () => {
    if (!bottleCount || !bottleSize) return 0
    return bottleCount * calculateWineVolume(bottleSize)
  }

  const calculateLossPercentage = () => {
    if (!volumePackagedL || !lossL) return 0
    return ((lossL / (volumePackagedL + lossL)) * 100).toFixed(1)
  }

  const onSubmit = (data: PackagingForm) => {
    console.log("Packaging data:", data)
    // TODO: Implement packaging run creation mutation
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Create Packaging Run
        </CardTitle>
        <CardDescription>Package finished cider from vessels into bottles</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Batch Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batchId">Source Batch</Label>
              <Select onValueChange={(value) => setValue("batchId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch to package" />
                </SelectTrigger>
                <SelectContent>
                  {availableBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batchNumber} - {batch.currentVolumeL}L ({batch.abv}% ABV)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.batchId && <p className="text-sm text-red-600 mt-1">{errors.batchId.message}</p>}
            </div>
            <div>
              <Label htmlFor="packageDate">Package Date</Label>
              <Input 
                id="packageDate" 
                type="date"
                {...register("packageDate")} 
              />
              {errors.packageDate && <p className="text-sm text-red-600 mt-1">{errors.packageDate.message}</p>}
            </div>
          </div>

          {/* Packaging Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bottleSize">Wine Size</Label>
              <Select onValueChange={(value) => setValue("bottleSize", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="375ml">375ml</SelectItem>
                  <SelectItem value="500ml">500ml</SelectItem>
                  <SelectItem value="750ml">750ml</SelectItem>
                  <SelectItem value="1L">1L</SelectItem>
                </SelectContent>
              </Select>
              {errors.bottleSize && <p className="text-sm text-red-600 mt-1">{errors.bottleSize.message}</p>}
            </div>
            <div>
              <Label htmlFor="bottleCount">Wine Count</Label>
              <Input 
                id="bottleCount" 
                type="number"
                {...register("bottleCount", { valueAsNumber: true })} 
                placeholder="e.g., 1000"
              />
              {errors.bottleCount && <p className="text-sm text-red-600 mt-1">{errors.bottleCount.message}</p>}
            </div>
            <div>
              <Label>Expected Volume</Label>
              <div className="h-10 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                <span className="text-gray-700">{calculateExpectedVolume().toFixed(1)}L</span>
              </div>
            </div>
          </div>

          {/* Volume and Loss */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="volumePackagedL">Actual Volume Packaged (L)</Label>
              <Input 
                id="volumePackagedL" 
                type="number"
                step="0.1"
                {...register("volumePackagedL", { valueAsNumber: true })} 
                placeholder="e.g., 745.5"
              />
              {errors.volumePackagedL && <p className="text-sm text-red-600 mt-1">{errors.volumePackagedL.message}</p>}
            </div>
            <div>
              <Label htmlFor="lossL">Loss Volume (L)</Label>
              <Input 
                id="lossL" 
                type="number"
                step="0.1"
                {...register("lossL", { valueAsNumber: true })} 
                placeholder="e.g., 5.2"
              />
              {lossL && volumePackagedL && (
                <p className="text-sm text-gray-600 mt-1">
                  Loss: {calculateLossPercentage()}%
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="abvAtPackaging">ABV at Packaging (%)</Label>
              <Input 
                id="abvAtPackaging" 
                type="number"
                step="0.1"
                {...register("abvAtPackaging", { valueAsNumber: true })} 
                placeholder="e.g., 6.2"
              />
            </div>
          </div>

          {/* Storage Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Storage Location</Label>
              <Select onValueChange={(value) => setValue("location", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select storage location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse-a1">Warehouse A - Section 1</SelectItem>
                  <SelectItem value="warehouse-a2">Warehouse A - Section 2</SelectItem>
                  <SelectItem value="warehouse-b1">Warehouse B - Section 1</SelectItem>
                  <SelectItem value="cold-storage-1">Cold Storage - Room 1</SelectItem>
                </SelectContent>
              </Select>
              {errors.location && <p className="text-sm text-red-600 mt-1">{errors.location.message}</p>}
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input 
                id="notes" 
                {...register("notes")} 
                placeholder="Packaging notes..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Save Draft
            </Button>
            <Button type="submit">
              Complete Packaging
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function InventoryView() {
  const [viewMode, setViewMode] = useState<"sku" | "lot" | "location">("sku")
  const [searchTerm, setSearchTerm] = useState("")

  // Mock inventory data
  const inventory = [
    {
      id: "INV-001",
      sku: "HC-750-001",
      batch: "B-2024-001",
      product: "Honeycrisp Cider",
      bottleSize: "750ml",
      currentStock: 460,
      reservedStock: 120,
      availableStock: 340,
      location: "Warehouse A - Section 1",
      abv: 6.2,
      packageDate: "2024-01-20",
      expiryDate: "2025-01-20",
      value: 6900.00,
      costPerWine: 15.00
    },
    {
      id: "INV-002", 
      sku: "GA-500-002",
      batch: "B-2024-002",
      product: "Gala Blend",
      bottleSize: "500ml",
      currentStock: 750,
      reservedStock: 0,
      availableStock: 750,
      location: "Warehouse A - Section 2",
      abv: 5.8,
      packageDate: "2024-01-18",
      expiryDate: "2025-01-18",
      value: 9375.00,
      costPerWine: 12.50
    },
    {
      id: "INV-003",
      sku: "WA-750-003", 
      batch: "B-2024-003",
      product: "Wild Apple Cider",
      bottleSize: "750ml",
      currentStock: 890,
      reservedStock: 200,
      availableStock: 690,
      location: "Cold Storage - Room 1",
      abv: 6.5,
      packageDate: "2024-01-15",
      expiryDate: "2025-01-15", 
      value: 14240.00,
      costPerWine: 16.00
    }
  ]

  const filteredInventory = inventory.filter(item =>
    item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batch.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalValue = inventory.reduce((sum, item) => sum + item.value, 0)
  const totalWines = inventory.reduce((sum, item) => sum + item.currentStock, 0)
  const totalAvailable = inventory.reduce((sum, item) => sum + item.availableStock, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-green-600" />
              Inventory Overview
            </CardTitle>
            <CardDescription>Track bottled cider inventory by SKU, lot, and location</CardDescription>
          </div>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sku">By SKU</SelectItem>
                <SelectItem value="lot">By Lot</SelectItem>
                <SelectItem value="location">By Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Wines</p>
                <p className="text-2xl font-bold text-blue-900">{totalWines.toLocaleString()}</p>
              </div>
              <Wine className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Available</p>
                <p className="text-2xl font-bold text-green-900">{totalAvailable.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Total Value</p>
                <p className="text-2xl font-bold text-amber-900">${totalValue.toLocaleString()}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">SKUs</p>
                <p className="text-2xl font-bold text-purple-900">{inventory.length}</p>
              </div>
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>ABV</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.product}</TableCell>
                <TableCell>{item.batch}</TableCell>
                <TableCell>{item.bottleSize}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.currentStock}</span>
                    {item.reservedStock > 0 && (
                      <span className="text-xs text-amber-600">
                        ({item.reservedStock} reserved)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`font-semibold ${
                    item.availableStock < 100 ? "text-red-600" : "text-green-600"
                  }`}>
                    {item.availableStock}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-sm">{item.location}</span>
                  </div>
                </TableCell>
                <TableCell>{item.abv}%</TableCell>
                <TableCell className="font-semibold text-green-600">
                  ${item.value.toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button size="sm" variant="outline">
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RecentPackagingRuns() {
  // Mock recent packaging data
  const recentRuns = [
    {
      id: "PKG-2024-001",
      date: "2024-01-20",
      batch: "B-2024-001",
      product: "Honeycrisp Cider",
      bottleSize: "750ml",
      bottleCount: 1000,
      volumePackaged: 745.5,
      loss: 4.5,
      location: "Warehouse A - Section 1",
      status: "Completed"
    },
    {
      id: "PKG-2024-002",
      date: "2024-01-18",
      batch: "B-2024-002", 
      product: "Gala Blend",
      bottleSize: "500ml",
      bottleCount: 1500,
      volumePackaged: 748.2,
      loss: 1.8,
      location: "Warehouse A - Section 2",
      status: "Completed"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Recent Packaging Runs
        </CardTitle>
        <CardDescription>History of packaging operations and results</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Wines</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Loss</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentRuns.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.id}</TableCell>
                <TableCell>{run.date}</TableCell>
                <TableCell>{run.product}</TableCell>
                <TableCell>{run.bottleSize}</TableCell>
                <TableCell className="font-semibold">{run.bottleCount}</TableCell>
                <TableCell>{run.volumePackaged}L</TableCell>
                <TableCell>
                  <span className={`font-semibold ${
                    run.loss > 5 ? "text-red-600" : "text-yellow-600"
                  }`}>
                    {run.loss}L
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-sm">{run.location}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {run.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function PackagingPage() {
  const [activeTab, setActiveTab] = useState<"package" | "inventory" | "history">("package")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Packaging</h1>
          <p className="text-gray-600 mt-1">
            Package finished cider into bottles and manage inventory levels.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "package", label: "New Packaging", icon: Package },
            { key: "inventory", label: "Inventory", icon: Archive },
            { key: "history", label: "History", icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "package" && <PackagingRunForm />}
          {activeTab === "inventory" && <InventoryView />}
          {activeTab === "history" && <RecentPackagingRuns />}
        </div>
      </main>
    </div>
  )
}