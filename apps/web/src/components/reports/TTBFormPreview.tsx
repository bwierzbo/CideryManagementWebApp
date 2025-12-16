"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  DollarSign,
  BarChart3,
  FileText,
} from "lucide-react";
import { formatDate } from "@/utils/date-format";
import type { TTBForm512017Data } from "lib";

// tRPC serializes dates as strings, so we need a serialized version of the type
type SerializedTTBForm512017Data = Omit<TTBForm512017Data, 'reportingPeriod'> & {
  reportingPeriod: Omit<TTBForm512017Data['reportingPeriod'], 'startDate' | 'endDate'> & {
    startDate: string | Date;
    endDate: string | Date;
  };
};

interface TTBFormPreviewProps {
  formData: SerializedTTBForm512017Data;
  periodLabel: string;
}

export function TTBFormPreview({ formData, periodLabel }: TTBFormPreviewProps) {
  const formatGallons = (gallons: number) => {
    if (gallons === 0) return "-";
    return gallons.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatGallonsDecimal = (gallons: number) => {
    return gallons.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatLbs = (lbs: number) => {
    if (lbs === 0) return "-";
    return lbs.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Get formatted dates
  const startDate = typeof formData.reportingPeriod.startDate === 'string'
    ? new Date(formData.reportingPeriod.startDate)
    : formData.reportingPeriod.startDate;
  const endDate = typeof formData.reportingPeriod.endDate === 'string'
    ? new Date(formData.reportingPeriod.endDate)
    : formData.reportingPeriod.endDate;

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <Card className="border-gray-300">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5" />
                TTB Form 5120.17 - Report of Wine Premises Operations
              </CardTitle>
              <CardDescription className="mt-1">
                {periodLabel} ({formatDate(startDate)} - {formatDate(endDate)})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {formData.reconciliation.balanced ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Balanced
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Variance: {formatGallonsDecimal(formData.reconciliation.variance)} gal
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Part I Section A - Bulk Wines */}
      <Card>
        <CardHeader className="pb-2 bg-gray-50">
          <CardTitle className="text-base">
            PART I - SECTION A: BULK WINES (in wine gallons)
          </CardTitle>
          <CardDescription>Hard Cider (Column f)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left py-2 px-3 w-12 font-medium">Line</th>
                <th className="text-left py-2 px-3 font-medium">Description</th>
                <th className="text-right py-2 px-3 w-32 font-medium">Hard Cider (f)</th>
              </tr>
            </thead>
            <tbody>
              {/* On Hand Beginning */}
              <tr className="border-b bg-blue-50">
                <td className="py-2 px-3 font-medium">1</td>
                <td className="py-2 px-3">On hand first of period</td>
                <td className="py-2 px-3 text-right font-medium">{formatGallons(formData.bulkWines.line1_onHandFirst)}</td>
              </tr>

              {/* Production */}
              <tr className="border-b">
                <td className="py-2 px-3">2</td>
                <td className="py-2 px-3">Produced by fermentation</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line2_produced)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">3</td>
                <td className="py-2 px-3">Produced by other processes</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line3_otherProduction)}</td>
              </tr>

              {/* Receipts */}
              <tr className="border-b">
                <td className="py-2 px-3">4</td>
                <td className="py-2 px-3">Received - bonded wine premises</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line4_receivedBonded)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">5</td>
                <td className="py-2 px-3">Received - customs custody</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line5_receivedCustoms)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">6</td>
                <td className="py-2 px-3">Received - returned after removal</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line6_receivedReturned)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">7</td>
                <td className="py-2 px-3">Received - by transfer in bond</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line7_receivedTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">8</td>
                <td className="py-2 px-3">Bottled wine dumped to bulk</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line8_dumpedToBulk)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">9</td>
                <td className="py-2 px-3">Wine transferred - from other tax classes</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line9_transferredIn)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">10</td>
                <td className="py-2 px-3">Withdrawn from fermenters</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line10_withdrawnFermenters)}</td>
              </tr>

              {/* Total Line 11 */}
              <tr className="border-b bg-gray-100">
                <td className="py-2 px-3 font-bold">11</td>
                <td className="py-2 px-3 font-bold">TOTAL (lines 1-10)</td>
                <td className="py-2 px-3 text-right font-bold">{formatGallons(formData.bulkWines.line11_total)}</td>
              </tr>

              {/* Removals */}
              <tr className="border-b">
                <td className="py-2 px-3">12</td>
                <td className="py-2 px-3">Bottled or packed</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line12_bottled)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">13</td>
                <td className="py-2 px-3">Transferred - for export</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line13_exportTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">14</td>
                <td className="py-2 px-3">Transferred - to bonded wine premises</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line14_bondedTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">15</td>
                <td className="py-2 px-3">Transferred - to customs bonded warehouse</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line15_customsTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">16</td>
                <td className="py-2 px-3">Transferred - to foreign trade zone</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line16_ftzTransfer)}</td>
              </tr>
              <tr className="border-b bg-green-50">
                <td className="py-2 px-3 font-medium">17</td>
                <td className="py-2 px-3 font-medium">Taxpaid removals</td>
                <td className="py-2 px-3 text-right font-medium">{formatGallons(formData.bulkWines.line17_taxpaid)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">18</td>
                <td className="py-2 px-3">Tax-free removals - for use US</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line18_taxFreeUS)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">19</td>
                <td className="py-2 px-3">Tax-free removals - for export use</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line19_taxFreeExport)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">20</td>
                <td className="py-2 px-3">Wine transferred - to other tax classes</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line20_transferredOut)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">21</td>
                <td className="py-2 px-3">Used for distilling material or vinegar stock</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line21_distillingMaterial)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">22</td>
                <td className="py-2 px-3">Wine spirits added</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line22_spiritsAdded)}</td>
              </tr>
              <tr className="border-b bg-red-50">
                <td className="py-2 px-3">23</td>
                <td className="py-2 px-3">Inventory losses</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line23_inventoryLosses)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">24</td>
                <td className="py-2 px-3">Destroyed</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line24_destroyed)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">25</td>
                <td className="py-2 px-3">Returned to bond</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line25_returnedToBond)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">26</td>
                <td className="py-2 px-3">Other (describe in remarks)</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line26_other)}</td>
              </tr>

              {/* Total Line 27 */}
              <tr className="border-b bg-gray-100">
                <td className="py-2 px-3 font-bold">27</td>
                <td className="py-2 px-3 font-bold">TOTAL (lines 12-26)</td>
                <td className="py-2 px-3 text-right font-bold">{formatGallons(formData.bulkWines.line27_total)}</td>
              </tr>

              {/* On Hand End */}
              <tr className="border-b">
                <td className="py-2 px-3">28</td>
                <td className="py-2 px-3">On hand end - in fermenters</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line28_onHandFermenters)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">29</td>
                <td className="py-2 px-3">On hand end - finished (not bottled)</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line29_onHandFinished)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">30</td>
                <td className="py-2 px-3">On hand end - unfinished (other)</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line30_onHandUnfinished)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">31</td>
                <td className="py-2 px-3">In transit</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bulkWines.line31_inTransit)}</td>
              </tr>

              {/* Total Line 32 */}
              <tr className="bg-blue-50">
                <td className="py-2 px-3 font-bold">32</td>
                <td className="py-2 px-3 font-bold">TOTAL on hand end of period (lines 28-31)</td>
                <td className="py-2 px-3 text-right font-bold">{formatGallons(formData.bulkWines.line32_totalOnHand)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Part I Section B - Bottled Wines */}
      <Card>
        <CardHeader className="pb-2 bg-gray-50">
          <CardTitle className="text-base">
            PART I - SECTION B: BOTTLED WINES (in wine gallons)
          </CardTitle>
          <CardDescription>Hard Cider (Column f)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="text-left py-2 px-3 w-12 font-medium">Line</th>
                <th className="text-left py-2 px-3 font-medium">Description</th>
                <th className="text-right py-2 px-3 w-32 font-medium">Hard Cider (f)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-blue-50">
                <td className="py-2 px-3 font-medium">1</td>
                <td className="py-2 px-3">On hand first of period</td>
                <td className="py-2 px-3 text-right font-medium">{formatGallons(formData.bottledWines.line1_onHandFirst)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">2</td>
                <td className="py-2 px-3">Bottled or packed (from bulk)</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line2_bottled)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">3</td>
                <td className="py-2 px-3">Received - bonded wine premises</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line3_receivedBonded)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">4</td>
                <td className="py-2 px-3">Received - customs custody</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line4_receivedCustoms)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">5</td>
                <td className="py-2 px-3">Received - returned after removal</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line5_receivedReturned)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">6</td>
                <td className="py-2 px-3">Received - by transfer in bond</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line6_receivedTransfer)}</td>
              </tr>
              <tr className="border-b bg-gray-100">
                <td className="py-2 px-3 font-bold">7</td>
                <td className="py-2 px-3 font-bold">TOTAL (lines 1-6)</td>
                <td className="py-2 px-3 text-right font-bold">{formatGallons(formData.bottledWines.line7_total)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">8</td>
                <td className="py-2 px-3">Dumped to bulk</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line8_dumpedToBulk)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">9</td>
                <td className="py-2 px-3">Transferred - for export</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line9_exportTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">10</td>
                <td className="py-2 px-3">Transferred - to bonded wine premises</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line10_bondedTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">11</td>
                <td className="py-2 px-3">Transferred - to customs bonded warehouse</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line11_customsTransfer)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">12</td>
                <td className="py-2 px-3">Transferred - to foreign trade zone</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line12_ftzTransfer)}</td>
              </tr>
              <tr className="border-b bg-green-50">
                <td className="py-2 px-3 font-medium">13</td>
                <td className="py-2 px-3 font-medium">Taxpaid removals</td>
                <td className="py-2 px-3 text-right font-medium">{formatGallons(formData.bottledWines.line13_taxpaid)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">14</td>
                <td className="py-2 px-3">Tax-free removals - for use US</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line14_taxFreeUS)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">15</td>
                <td className="py-2 px-3">Tax-free removals - for export use</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line15_taxFreeExport)}</td>
              </tr>
              <tr className="border-b bg-red-50">
                <td className="py-2 px-3">16</td>
                <td className="py-2 px-3">Inventory losses or shortages</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line16_inventoryLosses)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">17</td>
                <td className="py-2 px-3">Destroyed</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line17_destroyed)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">18</td>
                <td className="py-2 px-3">Returned to bond</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line18_returnedToBond)}</td>
              </tr>
              <tr className="border-b bg-gray-100">
                <td className="py-2 px-3 font-bold">19</td>
                <td className="py-2 px-3 font-bold">TOTAL (lines 8-18)</td>
                <td className="py-2 px-3 text-right font-bold">{formatGallons(formData.bottledWines.line19_total)}</td>
              </tr>
              <tr className="border-b bg-blue-50">
                <td className="py-2 px-3 font-medium">20</td>
                <td className="py-2 px-3 font-medium">On hand end of period</td>
                <td className="py-2 px-3 text-right font-medium">{formatGallons(formData.bottledWines.line20_onHandEnd)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-3">21</td>
                <td className="py-2 px-3">In transit</td>
                <td className="py-2 px-3 text-right">{formatGallons(formData.bottledWines.line21_inTransit)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Part IV - Materials and Part VII - Fermenters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part IV - Materials Received and Used */}
        <Card>
          <CardHeader className="pb-2 bg-gray-50">
            <CardTitle className="text-base">
              PART IV - MATERIALS RECEIVED AND USED
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left py-2 px-3 font-medium">Material</th>
                  <th className="text-right py-2 px-3 w-28 font-medium">Received</th>
                  <th className="text-right py-2 px-3 w-28 font-medium">Used</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-3">Apples (pounds)</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.applesReceivedLbs)}</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.applesUsedLbs)}</td>
                </tr>
                <tr className="border-b bg-blue-50">
                  <td className="py-2 px-3 pl-6 text-gray-600">Juice produced (gallons)</td>
                  <td className="py-2 px-3 text-right" colSpan={2}>{formatGallons(formData.materials.appleJuiceGallons)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Other fruit/berries (pounds)</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.otherFruitReceivedLbs)}</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.otherFruitUsedLbs)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Sugar (pounds)</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.sugarReceivedLbs)}</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.sugarUsedLbs)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Honey (pounds)</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.honeyReceivedLbs)}</td>
                  <td className="py-2 px-3 text-right">{formatLbs(formData.materials.honeyUsedLbs)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Part VII - In Fermenters */}
        <Card>
          <CardHeader className="pb-2 bg-gray-50">
            <CardTitle className="text-base">
              PART VII - IN FERMENTERS END OF PERIOD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-4">
              <span className="text-gray-600">Gallons of wine in fermenters</span>
              <span className="text-2xl font-bold">{formatGallonsDecimal(formData.fermenters.gallonsInFermenters)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Calculation */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            TAX COMPUTATION - Hard Cider (Under 8.5% ABV)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2 text-gray-600">Taxable Gallons (Line 17 Bulk + Line 13 Bottled)</td>
                <td className="py-2 text-right font-medium">
                  {formatGallonsDecimal(formData.taxSummary.taxableGallons)} gal
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-gray-600">Tax Rate</td>
                <td className="py-2 text-right font-medium">$0.226 / gal</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-gray-600">Gross Tax</td>
                <td className="py-2 text-right font-medium">
                  {formatCurrency(formData.taxSummary.grossTax)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-gray-600">
                  Small Producer Credit
                  <span className="text-xs text-gray-400 ml-1">
                    ({formatGallonsDecimal(formData.taxSummary.creditEligibleGallons)} gal @ $0.056)
                  </span>
                </td>
                <td className="py-2 text-right font-medium text-green-600">
                  -{formatCurrency(formData.taxSummary.smallProducerCredit)}
                </td>
              </tr>
              <tr className="bg-amber-100">
                <td className="py-3 font-bold">NET TAX OWED</td>
                <td className="py-3 text-right font-bold text-lg">
                  {formatCurrency(formData.taxSummary.netTaxOwed)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Effective Rate</td>
                <td className="py-2 text-right font-medium">
                  ${formData.taxSummary.effectiveRate.toFixed(4)} / gal
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Reconciliation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Inventory Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Available</p>
              <p className="text-lg font-bold">
                {formatGallonsDecimal(formData.reconciliation.totalAvailable)} gal
              </p>
              <p className="text-xs text-gray-500">
                Beginning + Production + Receipts
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Accounted For</p>
              <p className="text-lg font-bold">
                {formatGallonsDecimal(formData.reconciliation.totalAccountedFor)} gal
              </p>
              <p className="text-xs text-gray-500">
                Removals + Ending Inventory
              </p>
            </div>
            <div
              className={`text-center p-4 rounded-lg ${
                formData.reconciliation.balanced
                  ? "bg-green-100"
                  : "bg-red-100"
              }`}
            >
              <p className="text-sm text-gray-600 mb-1">Variance</p>
              <p
                className={`text-lg font-bold ${
                  formData.reconciliation.balanced
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {formatGallonsDecimal(formData.reconciliation.variance)} gal
              </p>
              <p className="text-xs text-gray-500">
                {formData.reconciliation.balanced
                  ? "Books balance"
                  : "Investigate discrepancy"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
