import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Package,
  Calendar,
  Beaker,
  BarChart3,
  Apple,
  Thermometer,
  Droplets,
  Scale,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Archive
} from "lucide-react"

interface PackagingDetailCardsProps {
  packageInfo: any
  batch: any
  vessel: any
  batchMeasurements: any[]
  batchComposition: any[]
  inventory: any
  transactions: any[]
  calculatedMetrics: any
}

export function PackagingDetailCards({
  packageInfo,
  batch,
  vessel,
  batchMeasurements,
  batchComposition,
  inventory,
  transactions,
  calculatedMetrics
}: PackagingDetailCardsProps) {
  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString()
  }

  const formatDateTime = (date: string | Date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString()
  }

  const formatVolume = (volumeL: number | string) => {
    const vol = typeof volumeL === 'string' ? parseFloat(volumeL) : volumeL
    return `${vol?.toFixed(1) || '0'} L`
  }

  const formatWeight = (weightKg: number | string) => {
    const weight = typeof weightKg === 'string' ? parseFloat(weightKg) : weightKg
    return `${weight?.toFixed(1) || '0'} kg`
  }

  const getLossColor = (lossPercentage: number) => {
    if (lossPercentage <= 5) return 'text-green-600'
    if (lossPercentage <= 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  const latestMeasurement = batchMeasurements?.[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Production Summary Card */}
      <Card className="mb-6 lg:mb-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Package className="h-5 w-5 mr-2 text-blue-600" />
            Production Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-gray-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Package Date</p>
                <p className="font-medium">{formatDate(packageInfo.packageDate)}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Archive className="w-4 h-4 text-gray-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Package Type</p>
                <p className="font-medium">{packageInfo.bottleSize || 'N/A'}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Units Produced</p>
              <p className="font-medium">{packageInfo.bottleCount || 0} bottles</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Volume Packaged</p>
              <p className="font-medium">{formatVolume(packageInfo.volumePackagedL)}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Yield
              </p>
              <p className="font-medium text-green-600">
                {calculatedMetrics?.yieldPercentage?.toFixed(1) || '0'}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                Loss
              </p>
              <p className={`font-medium ${getLossColor(calculatedMetrics?.lossPercentage || 0)}`}>
                {calculatedMetrics?.lossPercentage?.toFixed(1) || '0'}%
              </p>
            </div>
          </div>

          {packageInfo.abvAtPackaging && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-gray-600">ABV at Packaging</p>
                <p className="font-medium">{packageInfo.abvAtPackaging}%</p>
              </div>
            </>
          )}

          {packageInfo.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-sm">{packageInfo.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Traceability Card */}
      <Card className="mb-6 lg:mb-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Batch Traceability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="text-sm text-gray-600">Source Batch</p>
              <p className="font-medium">
                {batch?.name || batch?.customName || `Batch #${batch?.batchNumber}`}
              </p>
              {batch?.startDate && (
                <p className="text-xs text-gray-500">Started: {formatDate(batch.startDate)}</p>
              )}
            </div>

            {vessel && (
              <div>
                <p className="text-sm text-gray-600">Vessel</p>
                <p className="font-medium">{vessel.name}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Capacity: {formatVolume(vessel.capacityL)}</p>
                  <p>Material: {vessel.material}</p>
                  {vessel.location && <p>Location: {vessel.location}</p>}
                </div>
              </div>
            )}
          </div>

          {batchComposition && batchComposition.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-gray-600 mb-2">Fruit Composition</p>
                <div className="space-y-2">
                  {batchComposition.map((comp, index) => (
                    <div key={comp.compositionId || index} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{comp.varietyName}</span>
                      <div className="text-right">
                        <p>{formatWeight(comp.inputWeightKg)}</p>
                        {comp.fractionOfBatch && (
                          <p className="text-xs text-gray-500">
                            {(comp.fractionOfBatch * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Initial Volume</p>
              <p className="font-medium">{formatVolume(batch?.initialVolumeL || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Volume</p>
              <p className="font-medium">{formatVolume(batch?.currentVolumeL || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QA Measurements Card */}
      <Card className="mb-6 lg:mb-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Beaker className="h-5 w-5 mr-2 text-green-600" />
            QA Measurements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestMeasurement ? (
            <>
              <div>
                <p className="text-sm text-gray-600 mb-2">Latest Measurements</p>
                <p className="text-xs text-gray-500 mb-3">
                  Taken: {formatDateTime(latestMeasurement.measurementDate)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {latestMeasurement.abv && (
                  <div className="flex items-center">
                    <Droplets className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">ABV</p>
                      <p className="font-medium">{latestMeasurement.abv}%</p>
                    </div>
                  </div>
                )}

                {latestMeasurement.ph && (
                  <div className="flex items-center">
                    <Beaker className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">pH</p>
                      <p className="font-medium">{latestMeasurement.ph}</p>
                    </div>
                  </div>
                )}

                {latestMeasurement.ta && (
                  <div className="flex items-center">
                    <Scale className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">TA</p>
                      <p className="font-medium">{latestMeasurement.ta} g/L</p>
                    </div>
                  </div>
                )}

                {latestMeasurement.temperature && (
                  <div className="flex items-center">
                    <Thermometer className="w-4 h-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-sm text-gray-600">Temperature</p>
                      <p className="font-medium">{latestMeasurement.temperature}°C</p>
                    </div>
                  </div>
                )}
              </div>

              {latestMeasurement.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Measurement Notes</p>
                    <p className="text-sm">{latestMeasurement.notes}</p>
                  </div>
                </>
              )}

              {batchMeasurements.length > 1 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Previous Measurements</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {batchMeasurements.slice(1, 4).map((measurement, index) => (
                        <div key={measurement.id || index} className="text-xs text-gray-500 flex justify-between">
                          <span>{formatDate(measurement.measurementDate)}</span>
                          <span>
                            {measurement.abv && `ABV: ${measurement.abv}%`}
                            {measurement.ph && ` pH: ${measurement.ph}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <Beaker className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Measurements Available
              </h3>
              <p className="text-gray-600">
                QA measurements will appear here once recorded
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Card */}
      <Card className="mb-6 lg:mb-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Archive className="h-5 w-5 mr-2 text-orange-600" />
            Inventory Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {inventory ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Package className="w-4 h-4 text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Current Stock</p>
                    <p className="font-medium">{inventory.currentQuantity || 0} units</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-medium">{inventory.location || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {inventory.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Inventory Notes</p>
                    <p className="text-sm">{inventory.notes}</p>
                  </div>
                </>
              )}

              {transactions && transactions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Recent Transactions</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {transactions.slice(0, 5).map((transaction, index) => (
                        <div key={transaction.id || index} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-medium capitalize">{transaction.transactionType}</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(transaction.transactionDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              transaction.transactionType === 'inbound' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.transactionType === 'inbound' ? '+' : '-'}{transaction.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="font-medium text-sm">{formatDateTime(inventory.updatedAt)}</p>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Inventory Record
              </h3>
              <p className="text-gray-600">
                Inventory tracking will appear here once enabled
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}