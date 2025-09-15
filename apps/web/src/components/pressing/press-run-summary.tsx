"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Apple,
  Scale,
  Calendar,
  User,
  Package,
  TrendingUp,
  Clock,
} from "lucide-react"

interface PressRunSummaryProps {
  pressRun: {
    id: string
    vendorName: string
    status: string
    startTime?: string
    totalAppleWeightKg: number
    loads: Array<{
      id: string
      appleVarietyName: string
      appleWeightKg: number
      originalWeight: number
      originalWeightUnit: string
      loadSequence: number
      appleCondition?: string
      brixMeasured?: string
      notes?: string
    }>
  }
  showActions?: boolean
}

export function PressRunSummary({ pressRun, showActions = false }: PressRunSummaryProps) {
  const totalWeightKg = pressRun.totalAppleWeightKg
  const totalWeightLbs = totalWeightKg * 2.20462

  // Group loads by variety for summary
  const varietySummary = pressRun.loads.reduce((acc, load) => {
    const variety = load.appleVarietyName
    if (!acc[variety]) {
      acc[variety] = {
        totalWeightKg: 0,
        totalOriginalWeight: 0,
        originalUnit: load.originalWeightUnit,
        loads: 0,
        averageBrix: 0,
        brixMeasurements: [] as number[],
        conditions: [] as string[],
      }
    }

    acc[variety].totalWeightKg += load.appleWeightKg
    acc[variety].totalOriginalWeight += load.originalWeight
    acc[variety].loads += 1

    if (load.brixMeasured) {
      const brix = parseFloat(load.brixMeasured)
      if (!isNaN(brix)) {
        acc[variety].brixMeasurements.push(brix)
      }
    }

    if (load.appleCondition) {
      acc[variety].conditions.push(load.appleCondition)
    }

    return acc
  }, {} as Record<string, any>)

  // Calculate averages for variety summary
  Object.keys(varietySummary).forEach(variety => {
    const summary = varietySummary[variety]
    if (summary.brixMeasurements.length > 0) {
      summary.averageBrix = summary.brixMeasurements.reduce((sum: number, brix: number) => sum + brix, 0) / summary.brixMeasurements.length
    }
  })

  const formatCondition = (condition: string) => {
    const conditionColors = {
      excellent: "bg-green-100 text-green-800",
      good: "bg-blue-100 text-blue-800",
      fair: "bg-yellow-100 text-yellow-800",
      poor: "bg-red-100 text-red-800",
    }
    return conditionColors[condition as keyof typeof conditionColors] || "bg-gray-100 text-gray-800"
  }

  const formatWeight = (kg: number, originalWeight?: number, originalUnit?: string) => {
    const lbs = kg * 2.20462
    const display = originalWeight && originalUnit
      ? `${originalWeight.toFixed(1)} ${originalUnit}`
      : `${kg.toFixed(1)} kg`

    return (
      <div className="text-sm">
        <div className="font-medium">{display}</div>
        {originalWeight && originalUnit && (
          <div className="text-gray-500 text-xs">{kg.toFixed(1)} kg • {lbs.toFixed(1)} lbs</div>
        )}
        {!originalWeight && (
          <div className="text-gray-500 text-xs">{lbs.toFixed(1)} lbs</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Scale className="w-5 h-5 mr-2 text-amber-600" />
            Press Run Summary
          </CardTitle>
          <CardDescription>
            Overview of apple loads and processing details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-800">{pressRun.loads.length}</div>
              <div className="text-sm text-amber-600">Total Loads</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-800">{totalWeightLbs.toFixed(0)}</div>
              <div className="text-sm text-blue-600">lbs Apples</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-800">{Object.keys(varietySummary).length}</div>
              <div className="text-sm text-purple-600">Varieties</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variety Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Apple className="w-4 h-4 mr-2 text-green-600" />
            Variety Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(varietySummary).map(([variety, summary]) => (
              <div key={variety} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{variety}</h4>
                  <div className="flex items-center gap-2">
                    {summary.averageBrix > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {summary.averageBrix.toFixed(1)}° Brix
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {summary.loads} load{summary.loads !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Weight</p>
                    <p className="font-medium">
                      {summary.totalOriginalWeight.toFixed(1)} {summary.originalUnit}
                    </p>
                    <p className="text-xs text-gray-500">
                      {summary.totalWeightKg.toFixed(1)} kg • {(summary.totalWeightKg * 2.20462).toFixed(1)} lbs
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Percentage of Total</p>
                    <p className="font-medium">
                      {((summary.totalWeightKg / totalWeightKg) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                {summary.conditions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1">Conditions:</p>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(summary.conditions)].map((condition, index) => (
                        <Badge
                          key={`${condition}-${index}`}
                          variant="secondary"
                          className={`text-xs ${formatCondition(condition as string)}`}
                        >
                          {condition as string}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Load List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Package className="w-4 h-4 mr-2 text-blue-600" />
            Load Details
          </CardTitle>
          <CardDescription>
            Complete list of all fruit loads processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Load</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Brix</TableHead>
                  <TableHead className="w-32">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pressRun.loads
                  .sort((a, b) => a.loadSequence - b.loadSequence)
                  .map((load) => (
                    <TableRow key={load.id}>
                      <TableCell className="font-mono text-sm">
                        #{load.loadSequence}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{load.appleVarietyName}</div>
                      </TableCell>
                      <TableCell>
                        {formatWeight(load.appleWeightKg, load.originalWeight, load.originalWeightUnit)}
                      </TableCell>
                      <TableCell>
                        {load.appleCondition ? (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${formatCondition(load.appleCondition)}`}
                          >
                            {load.appleCondition}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {load.brixMeasured ? (
                          <span className="font-mono text-sm">{load.brixMeasured}°</span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {load.notes ? (
                          <div className="text-xs text-gray-600 max-w-32 truncate" title={load.notes}>
                            {load.notes}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Press Run Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Clock className="w-4 h-4 mr-2 text-orange-600" />
            Press Run Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Run ID</p>
              <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{pressRun.id}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <Badge variant="secondary" className="mt-1">
                {pressRun.status}
              </Badge>
            </div>
            <div>
              <p className="text-gray-600">Vendor</p>
              <p className="font-medium">{pressRun.vendorName}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}