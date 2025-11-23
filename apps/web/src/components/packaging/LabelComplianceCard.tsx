"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  Info,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateAbv } from "lib";

interface Measurement {
  abv: number | null;
  ph: number | null;
  specificGravity: number | null;
  totalAcidity: number | null;
  temperature: number | null;
  measurementDate: Date | string;
}

interface Additive {
  additiveName: string;
  labelImpact?: boolean;
  labelImpactNotes?: string | null;
  allergensVegan?: boolean;
  allergensVeganNotes?: string | null;
  itemType?: string | null;
}

interface Composition {
  ph?: number | null;
  specificGravity?: number | null;
}

interface LabelComplianceCardProps {
  measurements: Measurement[];
  additives: Additive[];
  abvAtPackaging: number | null | undefined;
  carbonationCo2Volumes: number | null | undefined;
  packageSizeML: number;
  composition?: Composition[];
  showLabelCharacteristics?: boolean;
  showMandatoryElements?: boolean;
}

export function LabelComplianceCard({
  measurements,
  additives,
  abvAtPackaging,
  carbonationCo2Volumes,
  packageSizeML,
  composition,
  showLabelCharacteristics = true,
  showMandatoryElements = true,
}: LabelComplianceCardProps) {
  // Get latest measurement values
  const latestMeasurement = measurements && measurements.length > 0 ? measurements[0] : null;

  // Try to get measured ABV first
  let latestAbv = latestMeasurement?.abv ?? abvAtPackaging ?? null;

  let abvIsEstimated = false;

  // If no measured ABV, try to calculate from SG measurements
  if (latestAbv === null && measurements && measurements.length > 0) {
    // Get all SG values
    const sgValues = measurements
      .filter(m => m.specificGravity !== null)
      .map(m => m.specificGravity!);

    if (sgValues.length >= 2) {
      // OG is the highest SG (before fermentation)
      const og = Math.max(...sgValues);
      // FG is the lowest SG (after fermentation)
      const fg = Math.min(...sgValues);

      try {
        // Only calculate if OG > FG
        if (og > fg) {
          latestAbv = calculateAbv(og, fg);
          abvIsEstimated = true;
        }
      } catch (error) {
        // If calculation fails, leave ABV as null
        console.warn("Failed to calculate ABV from SG:", error);
      }
    }
  }

  // Try to get pH from measurements - find first measurement with a pH value
  const measurementWithPH = measurements?.find(m => m.ph !== null && m.ph !== undefined);
  let latestPH = measurementWithPH?.ph ?? null;

  // If no pH in measurements, check composition (for juice purchases)
  if (latestPH === null && composition && composition.length > 0) {
    const compositionWithPH = composition.find(c => c.ph !== null && c.ph !== undefined);
    if (compositionWithPH?.ph) {
      latestPH = compositionWithPH.ph;
    }
  }

  const latestSG = latestMeasurement?.specificGravity ?? null;

  // Carbonation display state - toggle between volumes and g/L
  const [carbonationUnit, setCarbonationUnit] = React.useState<'vol' | 'g/L'>('vol');

  // Convert between vol and g/L: 1 volume = 1.96 g/L
  const carbonationValue = carbonationCo2Volumes
    ? carbonationUnit === 'vol'
      ? carbonationCo2Volumes
      : carbonationCo2Volumes * 1.96
    : null;

  const toggleCarbonationUnit = () => {
    setCarbonationUnit(prev => prev === 'vol' ? 'g/L' : 'vol');
  };

  // Determine regulatory status
  const requiresCOLA = latestAbv !== null && latestAbv >= 7.0;
  const isFDA = latestAbv !== null && latestAbv < 7.0;

  // Convert package size to FL OZ
  const fluidOunces = (packageSizeML / 29.5735).toFixed(1);

  // Check for sulfites
  const hasSulfites = additives.some(
    (a) =>
      a.itemType === "preservative" &&
      (a.additiveName.toLowerCase().includes("sulfite") ||
        a.additiveName.toLowerCase().includes("so2") ||
        a.additiveName.toLowerCase().includes("so₂"))
  );

  // Get label impact additives
  const labelImpactAdditives = additives.filter((a) => a.labelImpact);

  // Get allergen info
  const allergenAdditives = additives.filter(
    (a) => a.allergensVeganNotes || a.allergensVegan
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          {showLabelCharacteristics ? "Summary & Label Characteristics" : "Summary"}
        </CardTitle>
        {showLabelCharacteristics && (
          <CardDescription>
            Federal labeling requirements for hard cider products
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Latest Measurements */}
        <div>
          <p className="text-sm font-medium mb-2">Latest Measurements</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-white rounded-lg border">
            <div>
              <p className="text-xs text-gray-500">ABV</p>
              <p className="font-semibold text-lg">
                {latestAbv !== null ? `${latestAbv.toFixed(2)}%` : "Not measured"}
              </p>
              {abvIsEstimated && (
                <p className="text-xs text-gray-500 mt-0.5">Estimated from SG</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">pH</p>
              <p className="font-semibold text-lg">
                {latestPH !== null ? latestPH.toFixed(2) : "Not measured"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SG</p>
              <p className="font-semibold text-lg">
                {latestSG !== null ? latestSG.toFixed(3) : "Not measured"}
              </p>
            </div>
            <div
              onClick={carbonationValue !== null ? toggleCarbonationUnit : undefined}
              className={cn(
                carbonationValue !== null && "cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
              )}
            >
              <p className="text-xs text-gray-500">
                CO₂ ({carbonationUnit})
                {carbonationValue !== null && (
                  <span className="ml-1 text-blue-500">⇄</span>
                )}
              </p>
              <p className="font-semibold text-lg">
                {carbonationValue !== null ? carbonationValue.toFixed(2) : "Not measured"}
              </p>
            </div>
          </div>
        </div>

        {showLabelCharacteristics && (
          <>
            <Separator />

            {/* Regulatory Status */}
            {requiresCOLA ? (
              <Alert variant="destructive" className="border-amber-500 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>TTB COLA Required - Wine Labeling Rules Apply</AlertTitle>
                <AlertDescription>
                  ABV ≥7% requires Certificate of Label Approval (COLA) from TTB under
                  27 CFR Part 4. Product is classified as &apos;Wine&apos; or &apos;Apple Wine&apos;.
                </AlertDescription>
              </Alert>
            ) : isFDA ? (
              <Alert className="border-blue-500 bg-blue-50">
                <Info className="h-4 w-4" />
                <AlertTitle>FDA Labeling - No COLA Required</AlertTitle>
                <AlertDescription>
                  ABV &lt;7% follows simplified FDA labeling under 21 CFR 101. Must include
                  ingredient list and allergen statements.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No ABV Data Available</AlertTitle>
                <AlertDescription>
                  Measure ABV to determine TTB vs FDA labeling requirements.
                </AlertDescription>
              </Alert>
            )}

            <Separator />
          </>
        )}

        {/* Mandatory Label Elements */}
        {showMandatoryElements && (
          <div>
            <p className="text-sm font-medium mb-2">Mandatory Label Elements</p>
            <div className="space-y-1.5">
              <LabelRequirement
                met={true}
                text="Brand Name"
                notes="Prominent on front label"
              />
              <LabelRequirement
                met={true}
                text={`Class/Type: ${requiresCOLA ? "Apple Wine" : "Hard Cider"}`}
                notes="Product classification based on ABV"
              />
              <LabelRequirement
                met={true}
                text={`Net Contents: ${packageSizeML} mL (${fluidOunces} FL OZ)`}
                notes="Standard size declaration"
              />
              <LabelRequirement
                met={latestAbv !== null}
                text={`Alcohol Content${requiresCOLA ? " (Required)" : " (Optional)"}`}
                notes={
                  latestAbv
                    ? `ALC ${latestAbv.toFixed(1)}% BY VOL`
                    : "Measure ABV for label"
                }
              />
              <LabelRequirement
                met={true}
                text="Producer/Bottler Statement"
                notes="Company name and location"
              />
              <LabelRequirement
                met={true}
                text="Government Warning"
                notes="Required for all ≥0.5% ABV (27 CFR Part 16)"
              />
            </div>
          </div>
        )}

        {/* Additive-Based Requirements */}
        {showLabelCharacteristics && (hasSulfites || labelImpactAdditives.length > 0 || allergenAdditives.length > 0) && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Additive-Based Requirements</p>
              <div className="space-y-2">
                {hasSulfites && (
                  <Alert className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Sulfite Declaration</AlertTitle>
                    <AlertDescription className="text-xs">
                      &quot;Contains Sulfites&quot; required if ≥10 ppm SO₂
                    </AlertDescription>
                  </Alert>
                )}

                {labelImpactAdditives.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600">Label Impact Additives:</p>
                    {labelImpactAdditives.map((additive, idx) => (
                      <div
                        key={idx}
                        className="text-xs pl-4 border-l-2 border-blue-400 py-1"
                      >
                        <p className="font-medium">{additive.additiveName}</p>
                        {additive.labelImpactNotes && (
                          <p className="text-gray-600">{additive.labelImpactNotes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {allergenAdditives.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600">
                      Allergen Information {isFDA && "(Required for FDA Labeling)"}:
                    </p>
                    {allergenAdditives.map((additive, idx) => (
                      <div
                        key={idx}
                        className="text-xs pl-4 border-l-2 border-red-400 py-1"
                      >
                        <p className="font-medium">{additive.additiveName}</p>
                        {additive.allergensVeganNotes && (
                          <p className="text-gray-600">{additive.allergensVeganNotes}</p>
                        )}
                        {!additive.allergensVeganNotes && additive.allergensVegan && (
                          <p className="text-gray-600">Not vegan-friendly</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Quick Reference */}
        {showLabelCharacteristics && (
          <>
            <Separator />
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium">Quick Reference:</p>
              <p>• Font Size: ≥2mm for &gt;187mL; ≥1mm for smaller</p>
              <p>• High contrast text required on all labels</p>
              <p>• Batch/lot code recommended for traceability</p>
              {requiresCOLA && (
                <p className="text-amber-700 font-medium">
                  • COLA application required before interstate distribution
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LabelRequirement({
  met,
  text,
  notes,
}: {
  met: boolean;
  text: string;
  notes?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {met ? (
        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", met ? "text-gray-900" : "text-gray-500")}>
          {text}
        </p>
        {notes && <p className="text-xs text-gray-500 mt-0.5">{notes}</p>}
      </div>
    </div>
  );
}
