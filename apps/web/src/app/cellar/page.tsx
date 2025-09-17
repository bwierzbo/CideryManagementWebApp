"use client"

import React, { useState } from "react"
import { trpc } from "@/utils/trpc"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import {
  Beaker,
  Droplets,
  Thermometer,
  Activity,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Waves,
  Zap,
  ArrowRight,
  Trash2,
  Settings,
  MoreVertical
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Form schemas
const measurementSchema = z.object({
  batchId: z.string().uuid("Select a batch"),
  measurementDate: z.string().min(1, "Date is required"),
  specificGravity: z.number().min(0.990).max(1.200),
  abv: z.number().min(0).max(20).optional(),
  ph: z.number().min(2).max(5).optional(),
  totalAcidity: z.number().min(0).max(20).optional(),
  temperature: z.number().min(0).max(40).optional(),
  volumeL: z.number().positive().optional(),
  notes: z.string().optional(),
})

const transferSchema = z.object({
  fromBatchId: z.string().uuid("Select source batch"),
  toVesselId: z.string().uuid("Select destination vessel"),
  volumeL: z.number().positive("Volume must be positive"),
  lossL: z.number().min(0, "Loss cannot be negative").optional(),
  notes: z.string().optional(),
})

const tankSchema = z.object({
  name: z.string().optional(),
  capacityL: z.number().positive('Capacity must be positive'),
  capacityUnit: z.enum(['L', 'gal']),
  material: z.enum(['stainless_steel', 'plastic']).optional(),
  jacketed: z.enum(['yes', 'no']).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
})

type MeasurementForm = z.infer<typeof measurementSchema>
type TransferForm = z.infer<typeof transferSchema>
type TankForm = z.infer<typeof tankSchema>

function TankForm({ vesselId, onClose }: { vesselId?: string; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<TankForm>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      capacityUnit: 'L',
    }
  })

  const utils = trpc.useUtils()
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId! },
    { enabled: !!vesselId }
  )

  const createMutation = trpc.vessel.create.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate()
      utils.vessel.liquidMap.invalidate()
      onClose()
      reset()
    }
  })

  const updateMutation = trpc.vessel.update.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate()
      utils.vessel.liquidMap.invalidate()
      onClose()
      reset()
    }
  })

  // Load existing vessel data for editing
  React.useEffect(() => {
    if (vesselQuery.data?.vessel) {
      const vessel = vesselQuery.data.vessel
      reset({
        name: vessel.name || undefined,
        capacityL: parseFloat(vessel.capacityL),
        capacityUnit: vessel.capacityUnit as any,
        material: vessel.material as any,
        jacketed: vessel.jacketed as any,
        location: vessel.location || undefined,
        notes: vessel.notes || undefined,
      })
    }
  }, [vesselQuery.data, reset])

  const watchedCapacityUnit = watch('capacityUnit')

  const onSubmit = (data: TankForm) => {
    if (vesselId) {
      updateMutation.mutate({ id: vesselId, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Tank Name</Label>
          <Input
            id="name"
            placeholder="Leave empty to auto-generate (Tank 1, Tank 2, etc.)"
            {...register("name")}
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="capacityL">Size</Label>
          <Input
            id="capacityL"
            type="number"
            step="0.1"
            placeholder="1000"
            {...register("capacityL", { valueAsNumber: true })}
          />
          {errors.capacityL && <p className="text-sm text-red-600 mt-1">{errors.capacityL.message}</p>}
        </div>
        <div>
          <Label htmlFor="capacityUnit">Unit</Label>
          <Select
            value={watchedCapacityUnit}
            onValueChange={(value) => setValue("capacityUnit", value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L">Liters</SelectItem>
              <SelectItem value="gal">Gallons</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="material">Material</Label>
          <Select onValueChange={(value) => setValue("material", value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stainless_steel">Stainless Steel</SelectItem>
              <SelectItem value="plastic">Plastic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="jacketed">Jacketed</Label>
          <Select onValueChange={(value) => setValue("jacketed", value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select jacketed option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="Building A, Row 1"
          {...register("location")}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          placeholder="Additional notes..."
          {...register("notes")}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Saving...'
            : vesselId ? 'Update Tank' : 'Add Tank'
          }
        </Button>
      </div>
    </form>
  )
}

function VesselMap() {
  const [showAddTank, setShowAddTank] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [vesselToDelete, setVesselToDelete] = useState<{id: string, name: string | null} | null>(null)

  const vesselListQuery = trpc.vessel.list.useQuery()
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery()
  const utils = trpc.useUtils()

  const deleteMutation = trpc.vessel.delete.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate()
      utils.vessel.liquidMap.invalidate()
    }
  })

  const updateStatusMutation = trpc.vessel.update.useMutation({
    onSuccess: () => {
      utils.vessel.list.invalidate()
      utils.vessel.liquidMap.invalidate()
    }
  })

  const vessels = vesselListQuery.data?.vessels || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "border-green-300 bg-green-50"
      case "in_use": return "border-blue-300 bg-blue-50"
      case "cleaning": return "border-yellow-300 bg-yellow-50"
      case "maintenance": return "border-red-300 bg-red-50"
      default: return "border-gray-300 bg-gray-50"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available": return <CheckCircle className="w-4 h-4 text-green-600" />
      case "in_use": return <Activity className="w-4 h-4 text-blue-600" />
      case "cleaning": return <RotateCcw className="w-4 h-4 text-yellow-600" />
      case "maintenance": return <AlertTriangle className="w-4 h-4 text-red-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }


  const formatMaterial = (material: string | null) => {
    if (!material) return ''
    return material.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatJacketed = (jacketed: string | null) => {
    if (!jacketed) return ''
    return jacketed.charAt(0).toUpperCase() + jacketed.slice(1)
  }

  const handleDeleteClick = (vesselId: string, vesselName: string | null) => {
    setVesselToDelete({ id: vesselId, name: vesselName })
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (vesselToDelete) {
      deleteMutation.mutate({ id: vesselToDelete.id })
      setDeleteConfirmOpen(false)
      setVesselToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false)
    setVesselToDelete(null)
  }

  const handleStatusChange = (vesselId: string, newStatus: string) => {
    updateStatusMutation.mutate({
      id: vesselId,
      status: newStatus as 'available' | 'in_use' | 'cleaning' | 'maintenance'
    })
  }

  if (vesselListQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-blue-600" />
            Vessel Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading vessels...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="w-5 h-5 text-blue-600" />
              Vessel Map
            </CardTitle>
            <CardDescription>Overview of all fermentation and storage vessels</CardDescription>
          </div>
          <Dialog open={showAddTank} onOpenChange={setShowAddTank}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Tank
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Tank</DialogTitle>
                <DialogDescription>
                  Create a new fermentation or storage vessel
                </DialogDescription>
              </DialogHeader>
              <TankForm onClose={() => setShowAddTank(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vessels.map((vessel) => {
            const liquidMapVessel = liquidMapQuery.data?.vessels.find(v => v.vesselId === vessel.id)
            // Use batch volume if available, otherwise use apple press run volume
            const currentVolumeL = liquidMapVessel?.currentVolumeL
              ? parseFloat(liquidMapVessel.currentVolumeL.toString())
              : liquidMapVessel?.applePressRunVolume
                ? parseFloat(liquidMapVessel.applePressRunVolume.toString())
                : 0
            const capacityL = parseFloat(vessel.capacityL)
            const fillPercentage = capacityL > 0 ? (currentVolumeL / capacityL) * 100 : 0

            return (
              <div
                key={vessel.id}
                className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${getStatusColor(vessel.status)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{vessel.name || 'Unnamed Vessel'}</h3>
                    <p className="text-sm text-gray-600">{vessel.location || 'No location'}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(vessel.status)}
                  </div>
                </div>

                {/* Tank Specifications */}
                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Capacity:</span>
                    <span className="font-medium">
                      {capacityL.toFixed(0)}L
                      {vessel.capacityUnit === 'gal' && ` (${(capacityL / 3.78541).toFixed(0)} gal)`}
                    </span>
                  </div>
                  {vessel.material && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Material:</span>
                      <span className="font-medium">{formatMaterial(vessel.material)}</span>
                    </div>
                  )}
                  {vessel.jacketed && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Jacketed:</span>
                      <span className="font-medium">{formatJacketed(vessel.jacketed)}</span>
                    </div>
                  )}
                </div>

                {/* Volume Indicator */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Volume</span>
                    <span className="text-sm font-semibold">
                      {currentVolumeL.toFixed(0)}L / {capacityL.toFixed(0)}L
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        fillPercentage > 90 ? "bg-red-500" :
                        fillPercentage > 75 ? "bg-yellow-500" :
                        "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {fillPercentage.toFixed(1)}% full
                  </div>
                </div>

                <div className="flex space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <MoreVertical className="w-3 h-3 mr-1" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(vessel.id, 'available')}
                        disabled={vessel.status === 'available'}
                      >
                        Available
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(vessel.id, 'cleaning')}
                        disabled={vessel.status === 'cleaning'}
                      >
                        Cleaning
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(vessel.id, 'maintenance')}
                        disabled={vessel.status === 'maintenance'}
                      >
                        Maintenance
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(vessel.id, vessel.name)}
                        disabled={vessel.status === 'in_use'}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>


        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tank</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{vesselToDelete?.name || 'Unknown'}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={handleDeleteCancel}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function BatchDetails() {
  const [selectedBatch, setSelectedBatch] = useState("B-2024-001")
  
  // Mock batch data with measurements timeline
  const batchDetails = {
    id: "B-2024-001",
    batchNumber: "B-2024-001", 
    status: "active",
    vesselId: "V001",
    vesselName: "Fermenter Tank 1",
    startDate: "2024-01-15",
    initialVolumeL: 750,
    currentVolumeL: 735,
    targetAbv: 6.5,
    actualAbv: 4.2,
    daysInFermentation: 12,
    estimatedCompletion: "2024-02-15"
  }

  // Mock measurement timeline
  const measurements = [
    {
      date: "2024-01-15",
      day: 0,
      specificGravity: 1.055,
      abv: 0.0,
      ph: 3.8,
      temperature: 18.5,
      notes: "Initial measurement"
    },
    {
      date: "2024-01-18", 
      day: 3,
      specificGravity: 1.035,
      abv: 2.6,
      ph: 3.6,
      temperature: 19.2,
      notes: "Active fermentation"
    },
    {
      date: "2024-01-22",
      day: 7, 
      specificGravity: 1.015,
      abv: 5.3,
      ph: 3.5,
      temperature: 18.8,
      notes: "Fermentation slowing"
    },
    {
      date: "2024-01-27",
      day: 12,
      specificGravity: 1.008,
      abv: 6.2,
      ph: 3.4,
      temperature: 18.5,
      notes: "Near completion"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Batch Timeline
            </CardTitle>
            <CardDescription>Track fermentation progress and measurements</CardDescription>
          </div>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B-2024-001">B-2024-001</SelectItem>
              <SelectItem value="B-2024-002">B-2024-002</SelectItem>
              <SelectItem value="B-2024-003">B-2024-003</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Batch Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-purple-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-semibold capitalize">{batchDetails.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Days in Fermentation</p>
            <p className="font-semibold">{batchDetails.daysInFermentation} days</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Volume</p>
            <p className="font-semibold">{batchDetails.currentVolumeL}L</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current ABV</p>
            <p className="font-semibold">{batchDetails.actualAbv}%</p>
          </div>
        </div>

        {/* Measurements Timeline */}
        <div className="space-y-4">
          <h3 className="font-medium text-lg">Measurement Timeline</h3>
          
          {/* Chart visualization (simplified) */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="text-center text-sm text-gray-600 mb-2">
              Specific Gravity & ABV Progress
            </div>
            <div className="h-32 flex items-end justify-between space-x-2">
              {measurements.map((measurement, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className="flex flex-col items-center space-y-1">
                    {/* SG Bar */}
                    <div 
                      className="w-6 bg-blue-500 rounded-t"
                      style={{ height: `${(1.060 - measurement.specificGravity) * 800}px` }}
                      title={`SG: ${measurement.specificGravity}`}
                    />
                    {/* ABV Bar */}
                    <div 
                      className="w-6 bg-green-500 rounded-t"
                      style={{ height: `${measurement.abv * 8}px` }}
                      title={`ABV: ${measurement.abv}%`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Day {measurement.day}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center space-x-4 mt-2 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded mr-1" />
                <span>Specific Gravity</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-1" />
                <span>ABV %</span>
              </div>
            </div>
          </div>

          {/* Detailed Measurements Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Specific Gravity</TableHead>
                <TableHead>ABV %</TableHead>
                <TableHead>pH</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((measurement, index) => (
                <TableRow key={index}>
                  <TableCell>{measurement.date}</TableCell>
                  <TableCell>{measurement.day}</TableCell>
                  <TableCell className="font-mono">{measurement.specificGravity}</TableCell>
                  <TableCell className="font-semibold text-green-600">{measurement.abv}%</TableCell>
                  <TableCell>{measurement.ph}</TableCell>
                  <TableCell>{measurement.temperature}°C</TableCell>
                  <TableCell className="max-w-xs truncate">{measurement.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function AddMeasurement() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<MeasurementForm>({
    resolver: zodResolver(measurementSchema)
  })

  const specificGravity = watch("specificGravity")
  
  // Calculate approximate ABV from SG
  const calculateAbv = (sg: number) => {
    if (!sg || sg >= 1.000) return 0
    // Simplified ABV calculation: (OG - FG) * 131.25
    const og = 1.055 // Assumed original gravity
    return ((og - sg) * 131.25).toFixed(1)
  }

  const onSubmit = (data: MeasurementForm) => {
    console.log("Measurement data:", data)
    // TODO: Implement measurement creation mutation
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-green-600" />
          Add Measurement
        </CardTitle>
        <CardDescription>Record new batch measurements and observations</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batchId">Batch</Label>
              <Select onValueChange={(value) => setValue("batchId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b-2024-001">B-2024-001 (Fermenter Tank 1)</SelectItem>
                  <SelectItem value="b-2024-002">B-2024-002 (Fermenter Tank 2)</SelectItem>
                  <SelectItem value="b-2024-003">B-2024-003 (Conditioning Tank 1)</SelectItem>
                </SelectContent>
              </Select>
              {errors.batchId && <p className="text-sm text-red-600 mt-1">{errors.batchId.message}</p>}
            </div>
            <div>
              <Label htmlFor="measurementDate">Measurement Date</Label>
              <Input 
                id="measurementDate" 
                type="datetime-local"
                {...register("measurementDate")} 
              />
              {errors.measurementDate && <p className="text-sm text-red-600 mt-1">{errors.measurementDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="specificGravity">Specific Gravity</Label>
              <Input 
                id="specificGravity" 
                type="number"
                step="0.001"
                placeholder="1.015"
                {...register("specificGravity", { valueAsNumber: true })} 
              />
              {errors.specificGravity && <p className="text-sm text-red-600 mt-1">{errors.specificGravity.message}</p>}
              {specificGravity && (
                <p className="text-sm text-gray-600 mt-1">
                  Est. ABV: {calculateAbv(specificGravity)}%
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ph">pH</Label>
              <Input 
                id="ph" 
                type="number"
                step="0.1"
                placeholder="3.5"
                {...register("ph", { valueAsNumber: true })} 
              />
              {errors.ph && <p className="text-sm text-red-600 mt-1">{errors.ph.message}</p>}
            </div>
            <div>
              <Label htmlFor="temperature">Temperature (°C)</Label>
              <Input 
                id="temperature" 
                type="number"
                step="0.1"
                placeholder="18.5"
                {...register("temperature", { valueAsNumber: true })} 
              />
              {errors.temperature && <p className="text-sm text-red-600 mt-1">{errors.temperature.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
              <Input 
                id="totalAcidity" 
                type="number"
                step="0.1"
                placeholder="5.2"
                {...register("totalAcidity", { valueAsNumber: true })} 
              />
            </div>
            <div>
              <Label htmlFor="volumeL">Volume (L)</Label>
              <Input 
                id="volumeL" 
                type="number"
                step="0.1"
                placeholder="750"
                {...register("volumeL", { valueAsNumber: true })} 
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input 
              id="notes" 
              {...register("notes")} 
              placeholder="Fermentation observations..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">
              Add Measurement
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function CellarPage() {
  const [activeTab, setActiveTab] = useState<"vessels" | "batches" | "measurements">("vessels")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cellar</h1>
          <p className="text-gray-600 mt-1">
            Monitor fermentation vessels, track batch progress, and record measurements.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "vessels", label: "Vessel Map", icon: Beaker },
            { key: "batches", label: "Batch Details", icon: Activity },
            { key: "measurements", label: "Add Measurement", icon: Plus },
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
          {activeTab === "vessels" && <VesselMap />}
          {activeTab === "batches" && <BatchDetails />}
          {activeTab === "measurements" && <AddMeasurement />}
        </div>
      </main>
    </div>
  )
}