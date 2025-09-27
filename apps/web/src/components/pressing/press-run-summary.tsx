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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Apple,
  Scale,
  Calendar,
  User,
  Package,
  TrendingUp,
  Clock,
  CheckSquare,
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
      vendorId?: string
      vendorName?: string
      purchaseItemId?: string
      purchaseItemOriginalQuantityKg?: number
      purchaseItemOriginalQuantity?: number
      purchaseItemOriginalUnit?: string
    }>
  }
  showActions?: boolean
  showInventoryCheckboxes?: boolean
  depletedPurchaseItems?: Set<string>
  onPurchaseDepletionChange?: (purchaseItemId: string, isDepleted: boolean) => void
}

export function PressRunSummary({
  pressRun,
  showActions = false,
  showInventoryCheckboxes = false,
  depletedPurchaseItems = new Set<string>(),
  onPurchaseDepletionChange
}: PressRunSummaryProps) {
  const totalWeightKg = pressRun.totalAppleWeightKg
  const totalWeightLbs = totalWeightKg * 2.20462

  // Ensure loads is an array
  const loads = pressRun.loads || []

  // Calculate unique vendor count from loads
  const uniqueVendorIds = new Set(
    loads
      .map(load => load.vendorId)
      .filter(vendorId => vendorId && vendorId.trim() !== '')
  )
  const vendorCount = uniqueVendorIds.size || 1 // Default to 1 if no vendor IDs found

  // Calculate unique variety count from loads
  const uniqueVarieties = new Set(
    loads
      .map(load => load.appleVarietyName)
      .filter(variety => variety && variety.trim() !== '')
  )
  const varietyCount = uniqueVarieties.size

  // Group loads by vendor + variety for summary
  const vendorVarietySummary = loads && loads.length > 0 ? loads.reduce((acc, load) => {
    const vendor = load.vendorName || pressRun.vendorName || 'Unknown Vendor'
    const variety = load.appleVarietyName
    const key = `${vendor}::${variety}`

    if (!acc[key]) {
      acc[key] = {
        vendor,
        variety,
        totalWeightKg: 0,
        totalOriginalWeight: 0,
        originalUnit: load.originalWeightUnit,
        loads: 0,
        averageBrix: 0,
        brixMeasurements: [] as number[],
        conditions: [] as string[],
        purchaseItems: new Map<string, {
          purchaseItemId: string
          weight: number
          originalWeight: number
          originalWeightUnit: string
          originalPurchaseQuantityKg?: number
          originalPurchaseQuantity?: number
          originalPurchaseUnit?: string
        }>(),
      }
    }

    acc[key].totalWeightKg += load.appleWeightKg
    acc[key].totalOriginalWeight += load.originalWeight
    acc[key].loads += 1

    if (load.purchaseItemId) {
      const existingItem = acc[key].purchaseItems.get(load.purchaseItemId)
      if (existingItem) {
        // Consolidate weights for the same purchase item
        existingItem.weight += load.appleWeightKg
        existingItem.originalWeight += load.originalWeight
        // Original purchase quantities should be the same for all loads from the same purchase item
        if (!existingItem.originalPurchaseQuantityKg && load.purchaseItemOriginalQuantityKg) {
          existingItem.originalPurchaseQuantityKg = load.purchaseItemOriginalQuantityKg
          existingItem.originalPurchaseQuantity = load.purchaseItemOriginalQuantity
          existingItem.originalPurchaseUnit = load.purchaseItemOriginalUnit
        }
      } else {
        // Add new purchase item
        acc[key].purchaseItems.set(load.purchaseItemId, {
          purchaseItemId: load.purchaseItemId,
          weight: load.appleWeightKg,
          originalWeight: load.originalWeight,
          originalWeightUnit: load.originalWeightUnit,
          originalPurchaseQuantityKg: load.purchaseItemOriginalQuantityKg,
          originalPurchaseQuantity: load.purchaseItemOriginalQuantity,
          originalPurchaseUnit: load.purchaseItemOriginalUnit,
        })
      }
    }

    if (load.brixMeasured) {
      const brix = parseFloat(load.brixMeasured)
      if (!isNaN(brix)) {
        acc[key].brixMeasurements.push(brix)
      }
    }

    if (load.appleCondition) {
      acc[key].conditions.push(load.appleCondition)
    }

    return acc
  }, {} as Record<string, any>) : {}

  // Calculate averages for vendor+variety summary
  if (vendorVarietySummary && typeof vendorVarietySummary === 'object') {
    Object.keys(vendorVarietySummary).forEach(key => {
      const summary = vendorVarietySummary[key]
      if (summary && summary.brixMeasurements && summary.brixMeasurements.length > 0) {
        summary.averageBrix = summary.brixMeasurements.reduce((sum: number, brix: number) => sum + brix, 0) / summary.brixMeasurements.length
      }
    })
  }

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-800">{loads.length}</div>
              <div className="text-sm text-amber-600">Total Loads</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-800">{totalWeightLbs.toFixed(0)}</div>
              <div className="text-sm text-blue-600">lbs Apples</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-800">{vendorCount}</div>
              <div className="text-sm text-green-600">Vendor{vendorCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-800">{varietyCount}</div>
              <div className="text-sm text-purple-600">Varietie{varietyCount !== 1 ? 's' : 'y'}</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-800">{Object.keys(vendorVarietySummary).length}</div>
              <div className="text-sm text-orange-600">Combinations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor + Variety Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Apple className="w-4 h-4 mr-2 text-green-600" />
            Vendor & Variety Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {vendorVarietySummary && Object.keys(vendorVarietySummary).length > 0 ? (
              Object.entries(vendorVarietySummary).map(([key, summary]) => (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{summary.vendor}</h4>
                    <p className="text-sm text-gray-600">{summary.variety}</p>
                  </div>
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
                {showInventoryCheckboxes && summary.purchaseItems.size > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-600 mb-2">Mark transaction as depleted and archive:</p>
                    <div className="space-y-2">
                      {Array.from(summary.purchaseItems.values()).map((item: any, index: number) => {
                        // Calculate estimated remaining weight
                        const originalKg = item.originalPurchaseQuantityKg || 0
                        const usedKg = item.weight || 0
                        const remainingKg = Math.max(0, originalKg - usedKg)
                        const remainingLbs = remainingKg * 2.20462

                        return (
                          <div key={`${item.purchaseItemId}-${index}`} className="space-y-2 p-2 bg-gray-50 rounded">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={depletedPurchaseItems.has(item.purchaseItemId)}
                                  onCheckedChange={(checked) => {
                                    if (onPurchaseDepletionChange) {
                                      onPurchaseDepletionChange(item.purchaseItemId, checked === true)
                                    }
                                  }}
                                />
                                <span className="text-gray-700">
                                  {summary.vendor} - {summary.variety}
                                </span>
                              </div>
                              <span className="text-gray-500">
                                Used: {item.originalWeight.toFixed(1)} {item.originalWeightUnit}
                              </span>
                            </div>
                            {item.originalPurchaseQuantityKg && (
                              <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-medium">Original:</span> {item.originalPurchaseQuantity?.toFixed(1)} {item.originalPurchaseUnit}
                                </div>
                                <div>
                                  <span className="font-medium text-green-700">Remaining:</span> {remainingKg.toFixed(1)} kg ({remainingLbs.toFixed(0)} lbs)
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
            ) : (
              <p className="text-center text-gray-500 py-4">No variety data available</p>
            )}
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loads
                  .sort((a, b) => a.loadSequence - b.loadSequence)
                  .map((load) => (
                    <TableRow key={load.id}>
                      <TableCell className="font-mono text-sm">
                        #{load.loadSequence}
                      </TableCell>
                      <TableCell>
                        {load.vendorName || pressRun.vendorName || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{load.appleVarietyName}</div>
                      </TableCell>
                      <TableCell>
                        {formatWeight(load.appleWeightKg, load.originalWeight, load.originalWeightUnit)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}