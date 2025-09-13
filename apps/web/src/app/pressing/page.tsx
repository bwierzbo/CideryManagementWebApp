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
  Grape,
  Play,
  CheckCircle2,
  Clock,
  Droplets,
  Scale,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Beaker,
  Plus,
  Eye
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Form schemas
const startPressRunSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
})

const completePressRunSchema = z.object({
  pressRunId: z.string(),
  totalJuiceProducedL: z.number().positive("Juice volume must be positive"),
  juiceLots: z.array(z.object({
    vesselId: z.string().uuid("Select a vessel"),
    volumeL: z.number().positive("Volume must be positive"),
    brixMeasured: z.number().positive("Brix must be positive"),
    notes: z.string().optional(),
  })).min(1, "At least one juice lot required"),
})

type StartPressRunForm = z.infer<typeof startPressRunSchema>
type CompletePressRunForm = z.infer<typeof completePressRunSchema>

function ActivePressRuns() {
  // Mock active press runs
  const activeRuns = [
    {
      id: "PR-2024-001",
      startDate: "2024-01-15",
      totalAppleKg: 1250,
      varieties: ["Honeycrisp", "Gala"],
      status: "In Progress",
      duration: "4h 23m",
      estimatedCompletion: "2024-01-15 18:30"
    },
    {
      id: "PR-2024-002", 
      startDate: "2024-01-14",
      totalAppleKg: 890,
      varieties: ["Granny Smith"],
      status: "Pressing",
      duration: "2h 15m", 
      estimatedCompletion: "2024-01-14 16:45"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Active Press Runs
            </CardTitle>
            <CardDescription>Currently running apple pressing operations</CardDescription>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Start New Run
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeRuns.length === 0 ? (
          <div className="text-center py-8">
            <Grape className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active press runs</p>
            <p className="text-sm text-gray-400">Start a new press run to begin processing apples</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeRuns.map((run) => (
              <div key={run.id} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{run.id}</h3>
                    <p className="text-sm text-gray-600">Started {run.startDate}</p>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                      run.status === "In Progress" 
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}>
                      {run.status}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center">
                    <Scale className="w-5 h-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Total Apples</p>
                      <p className="font-semibold">{run.totalAppleKg} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Grape className="w-5 h-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Varieties</p>
                      <p className="font-semibold">{run.varieties.join(", ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-semibold">{run.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Est. Completion</p>
                      <p className="font-semibold">{run.estimatedCompletion}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Eye className="w-3 h-3 mr-1" />
                      View Details
                    </Button>
                    <Button size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Complete Run
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Progress: 68% complete
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CompletePressRunForm() {
  const [juiceLots, setJuiceLots] = useState([
    { vesselId: "", volumeL: 0, brixMeasured: 0, notes: "" }
  ])

  // Mock vessels
  const vessels = [
    { id: "V001", name: "Vessel 1", capacity: 1000, available: 750 },
    { id: "V002", name: "Vessel 2", capacity: 1500, available: 1500 },
    { id: "V003", name: "Vessel 3", capacity: 2000, available: 1200 },
  ]

  // Mock active press run for completion
  const activeRun = {
    id: "PR-2024-001",
    totalAppleKg: 1250,
    varieties: ["Honeycrisp (750kg)", "Gala (500kg)"],
    startDate: "2024-01-15",
    duration: "4h 23m"
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<CompletePressRunForm>({
    resolver: zodResolver(completePressRunSchema),
    defaultValues: {
      pressRunId: activeRun.id,
      juiceLots: juiceLots
    }
  })

  const totalJuiceProducedL = watch("totalJuiceProducedL")
  const expectedYieldL = activeRun.totalAppleKg * 0.7 // 70% yield assumption

  const calculateYieldPercentage = () => {
    if (!totalJuiceProducedL || totalJuiceProducedL === 0) return 0
    return ((totalJuiceProducedL / expectedYieldL) * 100).toFixed(1)
  }

  const calculateVariance = () => {
    if (!totalJuiceProducedL || totalJuiceProducedL === 0) return 0
    const variance = ((totalJuiceProducedL - expectedYieldL) / expectedYieldL) * 100
    return variance.toFixed(1)
  }

  const addJuiceLot = () => {
    const newLots = [...juiceLots, { vesselId: "", volumeL: 0, brixMeasured: 0, notes: "" }]
    setJuiceLots(newLots)
    setValue("juiceLots", newLots as any)
  }

  const removeJuiceLot = (index: number) => {
    const newLots = juiceLots.filter((_, i) => i !== index)
    setJuiceLots(newLots)
    setValue("juiceLots", newLots as any)
  }

  const getTotalAllocatedVolume = () => {
    return juiceLots.reduce((total, lot) => total + lot.volumeL, 0)
  }

  const onSubmit = (data: CompletePressRunForm) => {
    console.log("Complete press run data:", data)
    // TODO: Implement press run completion mutation
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Complete Press Run
        </CardTitle>
        <CardDescription>Record juice production and create juice lots</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Press Run Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-3">Press Run Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Run ID</p>
                <p className="font-semibold">{activeRun.id}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Apples</p>
                <p className="font-semibold">{activeRun.totalAppleKg} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Duration</p>
                <p className="font-semibold">{activeRun.duration}</p>
              </div>
              <div>
                <p className="text-gray-600">Expected Yield</p>
                <p className="font-semibold">{expectedYieldL.toFixed(0)} L</p>
              </div>
            </div>
          </div>

          {/* Juice Production */}
          <div>
            <Label htmlFor="totalJuiceProducedL">Total Juice Produced (L)</Label>
            <Input 
              id="totalJuiceProducedL" 
              type="number"
              step="0.1"
              {...register("totalJuiceProducedL", { valueAsNumber: true })} 
              placeholder="e.g., 875.5"
            />
            {errors.totalJuiceProducedL && (
              <p className="text-sm text-red-600 mt-1">{errors.totalJuiceProducedL.message}</p>
            )}
            
            {totalJuiceProducedL && (
              <div className="mt-2 flex space-x-4 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-600">Yield: </span>
                  <span className="font-semibold ml-1">{calculateYieldPercentage()}%</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">Variance: </span>
                  <span className={`font-semibold ml-1 flex items-center ${
                    parseFloat(calculateVariance()) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {parseFloat(calculateVariance()) >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {calculateVariance()}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Juice Lots */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Juice Lot Assignment</h3>
                <p className="text-sm text-gray-600">Assign juice to vessels for fermentation</p>
              </div>
              <Button type="button" onClick={addJuiceLot} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Lot
              </Button>
            </div>
            
            <div className="space-y-4">
              {juiceLots.map((lot, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                  <div className="md:col-span-2">
                    <Label>Vessel</Label>
                    <Select onValueChange={(value) => {
                      const newLots = [...juiceLots]
                      newLots[index].vesselId = value
                      setJuiceLots(newLots)
                      setValue(`juiceLots.${index}.vesselId`, value)
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name} ({vessel.available}L available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Volume (L)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={lot.volumeL}
                      onChange={(e) => {
                        const newLots = [...juiceLots]
                        newLots[index].volumeL = parseFloat(e.target.value) || 0
                        setJuiceLots(newLots)
                        setValue(`juiceLots.${index}.volumeL`, newLots[index].volumeL)
                      }}
                    />
                  </div>
                  <div>
                    <Label>Brix (°)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={lot.brixMeasured}
                      onChange={(e) => {
                        const newLots = [...juiceLots]
                        newLots[index].brixMeasured = parseFloat(e.target.value) || 0
                        setJuiceLots(newLots)
                        setValue(`juiceLots.${index}.brixMeasured`, newLots[index].brixMeasured)
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full">
                      <Label>Notes</Label>
                      <Input 
                        value={lot.notes}
                        onChange={(e) => {
                          const newLots = [...juiceLots]
                          newLots[index].notes = e.target.value
                          setJuiceLots(newLots)
                          setValue(`juiceLots.${index}.notes`, e.target.value)
                        }}
                        placeholder="Optional notes"
                      />
                    </div>
                    {juiceLots.length > 1 && (
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeJuiceLot(index)}
                        className="ml-2"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Volume Validation */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Allocated Volume:</span>
                <span className="font-semibold">{getTotalAllocatedVolume().toFixed(1)} L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Juice Produced:</span>
                <span className="font-semibold">{totalJuiceProducedL || 0} L</span>
              </div>
              {totalJuiceProducedL && getTotalAllocatedVolume() > totalJuiceProducedL && (
                <div className="flex items-center mt-2 text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span className="text-sm">Allocated volume exceeds production!</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Save Draft
            </Button>
            <Button type="submit">
              Complete Press Run
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PressRunHistory() {
  // Mock historical press runs
  const history = [
    {
      id: "PR-2024-003",
      date: "2024-01-12",
      totalAppleKg: 1100,
      totalJuiceL: 785,
      yield: "71.4%",
      variance: "+2.0%",
      juiceLots: 3,
      status: "Completed"
    },
    {
      id: "PR-2024-004",
      date: "2024-01-10", 
      totalAppleKg: 950,
      totalJuiceL: 652,
      yield: "68.6%",
      variance: "-1.9%",
      juiceLots: 2,
      status: "Completed"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-purple-600" />
          Press Run History
        </CardTitle>
        <CardDescription>Previous apple pressing operations and results</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Apples (kg)</TableHead>
              <TableHead>Juice (L)</TableHead>
              <TableHead>Yield</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead>Lots</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.id}</TableCell>
                <TableCell>{run.date}</TableCell>
                <TableCell>{run.totalAppleKg}</TableCell>
                <TableCell>{run.totalJuiceL}</TableCell>
                <TableCell className="font-semibold">{run.yield}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center font-semibold ${
                    run.variance.startsWith("+") ? "text-green-600" : "text-red-600"
                  }`}>
                    {run.variance.startsWith("+") ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {run.variance}
                  </span>
                </TableCell>
                <TableCell>{run.juiceLots}</TableCell>
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

export default function PressingPage() {
  const [activeTab, setActiveTab] = useState<"active" | "complete" | "history">("active")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pressing</h1>
          <p className="text-gray-600 mt-1">
            Manage apple pressing operations, track yields, and create juice lots.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "active", label: "Active Runs", icon: Play },
            { key: "complete", label: "Complete Run", icon: CheckCircle2 },
            { key: "history", label: "History", icon: Clock },
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
          {activeTab === "active" && <ActivePressRuns />}
          {activeTab === "complete" && <CompletePressRunForm />}
          {activeTab === "history" && <PressRunHistory />}
        </div>
      </main>
    </div>
  )
}