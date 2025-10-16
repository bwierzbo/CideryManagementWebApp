/**
 * VolumeInput Component Usage Examples
 *
 * This file demonstrates various ways to use the VolumeInput component.
 * These examples can be copied into your actual components.
 */

"use client";

import * as React from "react";
import { VolumeInput } from "./VolumeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Example 1: Basic Usage
 */
export function BasicVolumeInputExample() {
  const [volumeLiters, setVolumeLiters] = React.useState(189.271); // 50 gallons

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Volume Input</CardTitle>
      </CardHeader>
      <CardContent>
        <VolumeInput
          value={volumeLiters}
          onChange={setVolumeLiters}
          label="Batch Volume"
        />

        <div className="mt-4 text-sm text-muted-foreground">
          Value in liters: {volumeLiters.toFixed(3)} L
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 2: With Validation
 */
export function ValidatedVolumeInputExample() {
  const [volumeLiters, setVolumeLiters] = React.useState(0);
  const [error, setError] = React.useState<string | undefined>();

  const handleChange = (liters: number) => {
    setVolumeLiters(liters);

    // Validate
    if (liters <= 0) {
      setError("Volume must be greater than zero");
    } else if (liters > 1000) {
      setError("Volume cannot exceed 1000 liters");
    } else {
      setError(undefined);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>With Validation</CardTitle>
      </CardHeader>
      <CardContent>
        <VolumeInput
          value={volumeLiters}
          onChange={handleChange}
          label="Tank Capacity"
          required
          error={error}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Example 3: Form with Multiple Inputs
 */
export function BatchFormExample() {
  const [formData, setFormData] = React.useState({
    name: "",
    initialVolumeLiters: 0,
    currentVolumeLiters: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting batch:", formData);
    // Submit to API...
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Creation Form</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <VolumeInput
            value={formData.initialVolumeLiters}
            onChange={(liters) =>
              setFormData((prev) => ({ ...prev, initialVolumeLiters: liters }))
            }
            label="Initial Volume"
            required
          />

          <VolumeInput
            value={formData.currentVolumeLiters}
            onChange={(liters) =>
              setFormData((prev) => ({ ...prev, currentVolumeLiters: liters }))
            }
            label="Current Volume"
            required
          />

          <Button type="submit">Create Batch</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Example 4: Disabled State
 */
export function DisabledVolumeInputExample() {
  const [isEditing, setIsEditing] = React.useState(false);
  const [volumeLiters, setVolumeLiters] = React.useState(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editable Volume</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <VolumeInput
          value={volumeLiters}
          onChange={setVolumeLiters}
          label="Batch Volume"
          disabled={!isEditing}
        />

        <Button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "Lock" : "Edit"}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Example 5: All Examples Together
 */
export function VolumeInputExamples() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">VolumeInput Component Examples</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BasicVolumeInputExample />
        <ValidatedVolumeInputExample />
        <BatchFormExample />
        <DisabledVolumeInputExample />
      </div>
    </div>
  );
}
