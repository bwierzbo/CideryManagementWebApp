"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Apple,
  Scale,
  Calendar,
  User,
  Package,
  TrendingUp,
  Clock,
  CheckSquare,
} from "lucide-react";

interface PressRunSummaryProps {
  pressRun: {
    id: string;
    vendorName: string;
    status: string;
    totalAppleWeightKg: number;
    loads: Array<{
      id: string;
      appleVarietyName: string;
      appleWeightKg: number;
      originalWeight: number;
      originalWeightUnit: string;
      loadSequence: number;
      appleCondition?: string;
      brixMeasured?: string;
      notes?: string;
      vendorId?: string;
      vendorName?: string;
      purchaseItemId?: string;
      purchaseItemOriginalQuantityKg?: number;
      purchaseItemOriginalQuantity?: number;
      purchaseItemOriginalUnit?: string;
    }>;
  };
  showActions?: boolean;
  showInventoryCheckboxes?: boolean;
  depletedPurchaseItems?: Set<string>;
  onPurchaseDepletionChange?: (
    purchaseItemId: string,
    isDepleted: boolean,
  ) => void;
}

export function PressRunSummary({
  pressRun,
  showActions = false,
  showInventoryCheckboxes = false,
  depletedPurchaseItems = new Set<string>(),
  onPurchaseDepletionChange,
}: PressRunSummaryProps) {
  const totalWeightKg = pressRun.totalAppleWeightKg;
  const totalWeightLbs = totalWeightKg * 2.20462;

  // Ensure loads is an array
  const loads = pressRun.loads || [];

  // Calculate unique vendor count from loads
  const uniqueVendorIds = new Set(
    loads
      .map((load) => load.vendorId)
      .filter((vendorId) => vendorId && vendorId.trim() !== ""),
  );
  const vendorCount = uniqueVendorIds.size || 1; // Default to 1 if no vendor IDs found

  // Calculate unique variety count from loads
  const uniqueVarieties = new Set(
    loads
      .map((load) => load.appleVarietyName)
      .filter((variety) => variety && variety.trim() !== ""),
  );
  const varietyCount = uniqueVarieties.size;

  // Helper function to check/uncheck all items
  const handleCheckAll = () => {
    if (!onPurchaseDepletionChange) return;

    const allPurchaseItemIds = loads
      .map((load) => load.purchaseItemId)
      .filter((id): id is string => !!id);

    const allChecked = allPurchaseItemIds.every((id) =>
      depletedPurchaseItems.has(id),
    );

    // Toggle all items
    allPurchaseItemIds.forEach((id) => {
      onPurchaseDepletionChange(id, !allChecked);
    });
  };

  // Check if all items are selected
  const allPurchaseItemIds = loads
    .map((load) => load.purchaseItemId)
    .filter((id): id is string => !!id);
  const allChecked =
    allPurchaseItemIds.length > 0 &&
    allPurchaseItemIds.every((id) => depletedPurchaseItems.has(id));

  const formatWeight = (
    kg: number,
    originalWeight?: number,
    originalUnit?: string,
  ) => {
    const lbs = kg * 2.20462;
    const display =
      originalWeight && originalUnit
        ? `${originalWeight.toFixed(1)} ${originalUnit}`
        : `${kg.toFixed(1)} kg`;

    return (
      <div className="text-sm">
        <div className="font-medium">{display}</div>
        {originalWeight && originalUnit && (
          <div className="text-gray-500 text-xs">
            {kg.toFixed(1)} kg • {lbs.toFixed(1)} lbs
          </div>
        )}
        {!originalWeight && (
          <div className="text-gray-500 text-xs">{lbs.toFixed(1)} lbs</div>
        )}
      </div>
    );
  };

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
              <div className="text-2xl font-bold text-amber-800">
                {loads.length}
              </div>
              <div className="text-sm text-amber-600">Total Loads</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-800">
                {totalWeightLbs.toFixed(0)}
              </div>
              <div className="text-sm text-blue-600">lbs Apples</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-800">
                {vendorCount}
              </div>
              <div className="text-sm text-green-600">
                Vendor{vendorCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-800">
                {varietyCount}
              </div>
              <div className="text-sm text-purple-600">
                Varietie{varietyCount !== 1 ? "s" : "y"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Load Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-base">
                <Package className="w-4 h-4 mr-2 text-blue-600" />
                Load Details
              </CardTitle>
              <CardDescription>
                Complete list of all fruit loads processed
              </CardDescription>
            </div>
            {showInventoryCheckboxes && allPurchaseItemIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCheckAll}
                className="h-8"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {allChecked ? "Uncheck All" : "Check All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {showInventoryCheckboxes && (
                    <TableHead className="w-12">Deplete</TableHead>
                  )}
                  <TableHead className="w-12">Load</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Weight</TableHead>
                  {showInventoryCheckboxes && (
                    <>
                      <TableHead>Original Purchase</TableHead>
                      <TableHead>Remaining</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loads
                  .sort((a, b) => a.loadSequence - b.loadSequence)
                  .map((load) => {
                    // Calculate remaining weight
                    const originalKg = load.purchaseItemOriginalQuantityKg || 0;
                    const usedKg = load.appleWeightKg || 0;
                    const remainingKg = Math.max(0, originalKg - usedKg);
                    const remainingLbs = remainingKg * 2.20462;

                    return (
                      <TableRow key={load.id}>
                        {showInventoryCheckboxes && (
                          <TableCell>
                            {load.purchaseItemId ? (
                              <Checkbox
                                checked={depletedPurchaseItems.has(
                                  load.purchaseItemId,
                                )}
                                onCheckedChange={(checked) => {
                                  if (
                                    onPurchaseDepletionChange &&
                                    load.purchaseItemId
                                  ) {
                                    onPurchaseDepletionChange(
                                      load.purchaseItemId,
                                      checked === true,
                                    );
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-sm">
                          #{load.loadSequence}
                        </TableCell>
                        <TableCell>
                          {load.vendorName || pressRun.vendorName || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {load.appleVarietyName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatWeight(
                            load.appleWeightKg,
                            load.originalWeight,
                            load.originalWeightUnit,
                          )}
                        </TableCell>
                        {showInventoryCheckboxes && (
                          <>
                            <TableCell>
                              {load.purchaseItemOriginalQuantity ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {load.purchaseItemOriginalQuantity.toFixed(
                                      1,
                                    )}{" "}
                                    {load.purchaseItemOriginalUnit}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {originalKg.toFixed(1)} kg
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {load.purchaseItemOriginalQuantityKg ? (
                                <div className="text-sm">
                                  <div className="font-medium text-green-700">
                                    {remainingKg.toFixed(1)} kg
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {remainingLbs.toFixed(0)} lbs
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
