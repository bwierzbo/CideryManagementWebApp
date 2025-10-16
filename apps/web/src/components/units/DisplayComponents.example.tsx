/**
 * Display Components Usage Examples
 *
 * This file demonstrates various ways to use the display components.
 */

"use client";

import * as React from "react";
import {
  VolumeDisplay,
  WeightDisplay,
  TemperatureDisplay,
  UnitToggle,
  CompactUnitToggle,
} from "./index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Example 1: Basic Display Usage
 */
export function BasicDisplayExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Display Components</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Batch Volume:</p>
          <VolumeDisplay liters={189.271} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Apple Weight:</p>
          <WeightDisplay kg={453.592} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Fermentation Temperature:
          </p>
          <TemperatureDisplay celsius={20} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 2: Display with Both Units
 */
export function DualUnitDisplayExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Display with Conversions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Tank Capacity:</p>
          <VolumeDisplay liters={1000} showBothUnits />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Harvest Weight:</p>
          <WeightDisplay kg={1000} showBothUnits />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Storage Temp:</p>
          <TemperatureDisplay celsius={4} showBothUnits />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 3: Table with Display Components
 */
export function BatchTableExample() {
  const batches = [
    {
      id: "1",
      name: "Honeycrisp 2024-A",
      volumeLiters: 189.271,
      weightKg: 453.592,
      tempCelsius: 18,
    },
    {
      id: "2",
      name: "Granny Smith 2024-B",
      volumeLiters: 378.541,
      weightKg: 907.185,
      tempCelsius: 20,
    },
    {
      id: "3",
      name: "Golden Delicious 2024-C",
      volumeLiters: 75.708,
      weightKg: 181.437,
      tempCelsius: 16,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Batch Overview</CardTitle>
        <UnitToggle />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch Name</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Temperature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">{batch.name}</TableCell>
                <TableCell className="text-right">
                  <VolumeDisplay liters={batch.volumeLiters} />
                </TableCell>
                <TableCell className="text-right">
                  <WeightDisplay kg={batch.weightKg} />
                </TableCell>
                <TableCell className="text-right">
                  <TemperatureDisplay celsius={batch.tempCelsius} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Example 4: Unit Toggle Variations
 */
export function UnitToggleExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unit Toggle Variations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Full toggle with labels:
          </p>
          <UnitToggle />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Compact toggle:</p>
          <CompactUnitToggle />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">In a toolbar:</p>
          <CompactUnitToggle />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 5: Custom Decimals and Styling
 */
export function CustomFormattingExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Formatting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">High precision:</p>
          <VolumeDisplay liters={189.27135} decimals={3} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">No decimals:</p>
          <VolumeDisplay liters={189.271} decimals={0} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Without units:</p>
          <VolumeDisplay liters={189.271} showUnit={false} />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Custom styling:</p>
          <VolumeDisplay
            liters={189.271}
            className="text-lg font-bold text-green-600"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 6: Real-world Batch Details Card
 */
export function BatchDetailsExample() {
  const batch = {
    name: "Honeycrisp 2024-A",
    batchNumber: "HC-2024-001",
    initialVolumeLiters: 189.271,
    currentVolumeLiters: 185.5,
    appleWeightKg: 453.592,
    fermentationTempCelsius: 18,
    targetTempCelsius: 20,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{batch.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{batch.batchNumber}</p>
        </div>
        <CompactUnitToggle />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Initial Volume</p>
            <p className="text-lg font-semibold">
              <VolumeDisplay liters={batch.initialVolumeLiters} />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Current Volume</p>
            <p className="text-lg font-semibold">
              <VolumeDisplay liters={batch.currentVolumeLiters} />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Apple Weight</p>
            <p className="text-lg font-semibold">
              <WeightDisplay kg={batch.appleWeightKg} />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Temperature</p>
            <p className="text-lg font-semibold">
              <TemperatureDisplay celsius={batch.fermentationTempCelsius} />
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">
            Target Temperature:
          </p>
          <TemperatureDisplay
            celsius={batch.targetTempCelsius}
            showBothUnits
            className="text-base font-medium"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 7: All Examples Together
 */
export function DisplayComponentsExamples() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Display Components Examples</h1>
        <UnitToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BasicDisplayExample />
        <DualUnitDisplayExample />
        <UnitToggleExample />
        <CustomFormattingExample />
      </div>

      <BatchTableExample />
      <BatchDetailsExample />
    </div>
  );
}
