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
  Beaker,
  Package,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* Header with Period Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                TTB Form 5120.17 - {periodLabel}
              </CardTitle>
              <CardDescription>
                Report of Wine Premises Operations
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
                  Variance: {formatGallons(formData.reconciliation.variance)} gal
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Wine Produced</p>
                <p className="text-2xl font-bold">
                  {formatGallons(formData.wineProduced.total)}
                </p>
                <p className="text-xs text-gray-400">wine gallons</p>
              </div>
              <Beaker className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tax-Paid Removals</p>
                <p className="text-2xl font-bold">
                  {formatGallons(formData.taxPaidRemovals.total)}
                </p>
                <p className="text-xs text-gray-400">wine gallons</p>
              </div>
              <Package className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Other Removals</p>
                <p className="text-2xl font-bold">
                  {formatGallons(formData.otherRemovals.total)}
                </p>
                <p className="text-xs text-gray-400">wine gallons</p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tax Owed</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(formData.taxSummary.netTaxOwed)}
                </p>
                <p className="text-xs text-gray-400">after credits</p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Form Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part I - Beginning Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part I - Beginning Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Bulk (Tanks/Barrels)</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.beginningInventory.bulk)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Bottled/Packaged</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.beginningInventory.bottled)} gal
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium">Total</td>
                  <td className="py-2 text-right font-bold">
                    {formatGallons(formData.beginningInventory.total)} gal
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Part II - Wine Produced */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part II - Wine/Cider Produced</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium">Total Produced</td>
                  <td className="py-2 text-right font-bold">
                    {formatGallons(formData.wineProduced.total)} gal
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              Hard cider produced from fermentation of apple juice
            </p>
          </CardContent>
        </Card>

        {/* Part III - Tax-Paid Removals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part III - Tax-Paid Removals</CardTitle>
            <CardDescription>By Sales Channel</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Tasting Room</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.taxPaidRemovals.tastingRoom)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Wholesale/Distributors</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.taxPaidRemovals.wholesale)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Online/DTC Shipping</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.taxPaidRemovals.onlineDtc)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Events/Farmers Markets</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.taxPaidRemovals.events)} gal
                  </td>
                </tr>
                {formData.taxPaidRemovals.uncategorized > 0 && (
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Uncategorized</td>
                    <td className="py-2 text-right font-medium text-orange-600">
                      {formatGallons(formData.taxPaidRemovals.uncategorized)} gal
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium">Total</td>
                  <td className="py-2 text-right font-bold">
                    {formatGallons(formData.taxPaidRemovals.total)} gal
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Part IV - Other Removals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part IV - Other Removals</CardTitle>
            <CardDescription>Non-taxable removals and losses</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Samples/Tastings</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.otherRemovals.samples)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Breakage</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.otherRemovals.breakage)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Process Losses (Filter/Rack)</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.otherRemovals.processLosses)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Spoilage</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.otherRemovals.spoilage)} gal
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium">Total</td>
                  <td className="py-2 text-right font-bold">
                    {formatGallons(formData.otherRemovals.total)} gal
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Part V - Ending Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Part V - Ending Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Bulk (Tanks/Barrels)</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.endingInventory.bulk)} gal
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Bottled/Packaged</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.endingInventory.bottled)} gal
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium">Total</td>
                  <td className="py-2 text-right font-bold">
                    {formatGallons(formData.endingInventory.total)} gal
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Part VI - Tax Calculation */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Part VI - Tax Calculation
            </CardTitle>
            <CardDescription>Hard Cider Tax (Under 8.5% ABV)</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Taxable Gallons</td>
                  <td className="py-2 text-right font-medium">
                    {formatGallons(formData.taxSummary.taxableGallons)} gal
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
                      ({formatGallons(formData.taxSummary.creditEligibleGallons)} gal @ $0.056)
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-green-600">
                    -{formatCurrency(formData.taxSummary.smallProducerCredit)}
                  </td>
                </tr>
                <tr className="bg-amber-100">
                  <td className="py-3 font-bold">Net Tax Owed</td>
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
      </div>

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
                {formatGallons(formData.reconciliation.totalAvailable)} gal
              </p>
              <p className="text-xs text-gray-500">
                Beginning + Production + Receipts
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Accounted For</p>
              <p className="text-lg font-bold">
                {formatGallons(formData.reconciliation.totalAccountedFor)} gal
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
                {formatGallons(formData.reconciliation.variance)} gal
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
