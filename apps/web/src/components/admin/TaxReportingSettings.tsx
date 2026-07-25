"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Edit,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  DollarSign,
  MapPin,
  Calendar,
  Scale,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { US_STATES, getRecommendedTtbFrequency } from "lib";

type ReportingFrequency = "monthly" | "quarterly" | "annual";

const FREQUENCY_OPTIONS: {
  value: ReportingFrequency;
  label: string;
  description: string;
}[] = [
  {
    value: "annual",
    label: "Annual",
    description: "File once per year (tax liability ≤$1,000)",
  },
  {
    value: "quarterly",
    label: "Quarterly",
    description: "File 4 times per year (tax liability $1,000-$50,000)",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "File 12 times per year (tax liability >$50,000)",
  },
];

export function TaxReportingSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings
  const {
    data: settings,
    isLoading,
    refetch,
  } = trpc.settings.getOrganizationSettings.useQuery();

  const updateMutation = trpc.settings.updateOrganizationSettings.useMutation({
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Tax reporting preferences have been updated.",
      });
      refetch();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState<{
    taxState: string | null;
    ttbReportingFrequency: ReportingFrequency;
    stateTaxReportingFrequency: ReportingFrequency;
    estimatedAnnualTaxLiability: string;
  }>({
    taxState: null,
    ttbReportingFrequency: "quarterly",
    stateTaxReportingFrequency: "quarterly",
    estimatedAnnualTaxLiability: "",
  });

  // Update form when data loads
  useEffect(() => {
    if (settings) {
      setFormData({
        taxState: settings.taxState || null,
        ttbReportingFrequency:
          (settings.ttbReportingFrequency as ReportingFrequency) || "quarterly",
        stateTaxReportingFrequency:
          (settings.stateTaxReportingFrequency as ReportingFrequency) || "quarterly",
        estimatedAnnualTaxLiability: settings.estimatedAnnualTaxLiability || "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        taxState: formData.taxState,
        ttbReportingFrequency: formData.ttbReportingFrequency,
        stateTaxReportingFrequency: formData.stateTaxReportingFrequency,
        estimatedAnnualTaxLiability: formData.estimatedAnnualTaxLiability || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        taxState: settings.taxState || null,
        ttbReportingFrequency:
          (settings.ttbReportingFrequency as ReportingFrequency) || "quarterly",
        stateTaxReportingFrequency:
          (settings.stateTaxReportingFrequency as ReportingFrequency) || "quarterly",
        estimatedAnnualTaxLiability: settings.estimatedAnnualTaxLiability || "",
      });
    }
    setIsEditing(false);
  };

  // Calculate recommended frequency based on estimated tax
  const estimatedTax = parseFloat(formData.estimatedAnnualTaxLiability) || 0;
  const recommendedFrequency = estimatedTax > 0 ? getRecommendedTtbFrequency(estimatedTax) : null;

  const hasSettings = !!settings?.taxState || !!settings?.ttbReportingFrequency;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Tax Reporting Preferences</CardTitle>
              <CardDescription>
                Configure your TTB and state tax reporting settings
              </CardDescription>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              {hasSettings ? "Edit" : "Configure"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {!hasSettings && !isEditing && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Tax Reporting Not Configured
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Set your state and reporting frequencies to enable proper tax
                form defaults.
              </p>
            </div>
          </div>
        )}

        {hasSettings && !isEditing && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Tax Reporting Configured
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {formData.taxState && `State: ${US_STATES.find(s => s.code === formData.taxState)?.name || formData.taxState}`}
                {formData.taxState && " | "}
                TTB: {formData.ttbReportingFrequency} | State: {formData.stateTaxReportingFrequency}
              </p>
            </div>
          </div>
        )}

        {/* State Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            State for Tax Filing
          </Label>
          {isEditing ? (
            <Select
              value={formData.taxState || ""}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, taxState: value || null }))
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select your state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm py-2">
              {formData.taxState
                ? US_STATES.find((s) => s.code === formData.taxState)?.name ||
                  formData.taxState
                : "Not set"}
            </p>
          )}
          <p className="text-xs text-gray-500">
            The state where your cidery is licensed and files taxes
          </p>
        </div>

        {/* TTB Reporting Frequency */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            TTB Reporting Frequency
          </Label>

          {/* TTB Guidelines Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">TTB Frequency Guidelines:</p>
                <ul className="space-y-0.5">
                  <li>Annual - Tax liability ≤$1,000/year</li>
                  <li>Quarterly - Tax liability $1,000-$50,000/year</li>
                  <li>Monthly - Tax liability &gt;$50,000/year</li>
                </ul>
              </div>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Select
                value={formData.ttbReportingFrequency}
                onValueChange={(value: ReportingFrequency) =>
                  setFormData((prev) => ({
                    ...prev,
                    ttbReportingFrequency: value,
                  }))
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {recommendedFrequency === option.value && estimatedTax > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {FREQUENCY_OPTIONS.find((o) => o.value === formData.ttbReportingFrequency)?.description}
              </p>
            </div>
          ) : (
            <p className="text-sm py-2 capitalize">{formData.ttbReportingFrequency}</p>
          )}
        </div>

        {/* Estimated Annual Tax Liability (optional) */}
        {isEditing && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              Estimated Annual Tax Liability
              <span className="text-xs text-gray-400">(optional)</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.estimatedAnnualTaxLiability}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedAnnualTaxLiability: e.target.value,
                  }))
                }
                className="max-w-[150px]"
              />
            </div>
            <p className="text-xs text-gray-500">
              Enter your estimated annual tax to get a frequency recommendation
            </p>
            {recommendedFrequency && estimatedTax > 0 && (
              <p className="text-xs text-green-600">
                Based on ${estimatedTax.toLocaleString()}, we recommend{" "}
                <span className="font-medium">{recommendedFrequency}</span> filing.
              </p>
            )}
          </div>
        )}

        {/* State Tax Reporting Frequency */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            State Tax Reporting Frequency
          </Label>

          {isEditing ? (
            <div className="space-y-2">
              <Select
                value={formData.stateTaxReportingFrequency}
                onValueChange={(value: ReportingFrequency) =>
                  setFormData((prev) => ({
                    ...prev,
                    stateTaxReportingFrequency: value,
                  }))
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                State requirements may differ from TTB. Check with your state&apos;s
                alcohol control board.
              </p>
            </div>
          ) : (
            <p className="text-sm py-2 capitalize">
              {formData.stateTaxReportingFrequency}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

      <FilingFrequencyDeterminationCard />
    </div>
  );
}

/**
 * Filing-frequency determination card.
 *
 * Shows the last-confirmed determination and a re-verify banner cheaply (from
 * ttb.getFilingFrequencyStatus), and lets an admin run a fresh determination
 * (ttb.getFilingFrequencyDetermination — expensive, so it is behind a button
 * rather than auto-run) and confirm it (ttb.confirmFilingFrequency).
 */
function FilingFrequencyDeterminationCard() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: status } = trpc.ttb.getFilingFrequencyStatus.useQuery();

  const {
    data: fresh,
    isFetching: isComputing,
    refetch: runDetermination,
  } = trpc.ttb.getFilingFrequencyDetermination.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const confirmMutation = trpc.ttb.confirmFilingFrequency.useMutation({
    onSuccess: () => {
      toast({
        title: "Filing Frequency Confirmed",
        description: "The determined TTB and WA filing cadence has been saved.",
      });
      utils.ttb.getFilingFrequencyStatus.invalidate();
      utils.settings.getOrganizationSettings.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const showBanner = status && (status.mismatch || status.stale);
  // The freshly-computed determination (if the admin ran it) takes precedence in
  // the display; otherwise fall back to the last-confirmed stored determination.
  const federal = fresh?.determination ?? status?.determination ?? null;
  const wa = fresh?.waDetermination ?? status?.waDetermination ?? null;
  const inputs = fresh?.inputs ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Filing Frequency Determination</CardTitle>
            <CardDescription>
              Compute the required cadence from your filed data (27 CFR 24.271 /
              24.300 and WA LIQ-774)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Re-verify banner */}
        {showBanner && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {status?.mismatch
                  ? "Saved frequency no longer matches the determination"
                  : "Filing frequency needs re-verification"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {status?.mismatch
                  ? "Your saved TTB/state reporting frequency differs from the last computed determination. Re-run and confirm below."
                  : status?.confirmedAt
                    ? "It has been over a year since the filing frequency was confirmed. Re-run and confirm to keep it current."
                    : "The filing frequency has not been determined yet. Run and confirm it below."}
              </p>
            </div>
          </div>
        )}

        {/* Determination result */}
        {federal && wa ? (
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Federal (TTB Form 5120.17)
                </p>
                <p className="text-sm text-gray-700 mt-0.5">
                  Tax returns:{" "}
                  <span className="font-semibold capitalize">
                    {federal.returnPeriod}
                  </span>{" "}
                  &middot; Operations reports:{" "}
                  <span className="font-semibold capitalize">
                    {federal.reportFrequency}
                  </span>
                </p>
                <ul className="mt-2 space-y-1">
                  {federal.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                      <span className="text-gray-400">&bull;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-900">
                  Washington State (LIQ-774)
                </p>
                <p className="text-sm text-gray-700 mt-0.5">
                  Filing:{" "}
                  <span className="font-semibold capitalize">{wa.frequency}</span>
                  {wa.eligible ? (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Annual-eligible
                    </span>
                  ) : null}
                </p>
                <ul className="mt-2 space-y-1">
                  {wa.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                      <span className="text-gray-400">&bull;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {inputs && (
                <p className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                  Based on {inputs.priorYear} tax of $
                  {inputs.priorYearTaxUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  , {inputs.currentYear} YTD tax of $
                  {inputs.expectedCurrentYearTaxUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  , peak on-hand{" "}
                  {inputs.maxMonthlyOnHandGal.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{" "}
                  gal, and WA taxable sales{" "}
                  {inputs.waTaxableGallons.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{" "}
                  gal.
                </p>
              )}
            </div>
            {status?.confirmedAt && !fresh && (
              <p className="text-xs text-gray-500">
                Last confirmed{" "}
                {new Date(status.confirmedAt).toLocaleDateString()}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No determination has been computed yet. Run it to see the required
            filing cadence based on your filed forms.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => runDetermination()}
            disabled={isComputing}
          >
            {isComputing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Computing (may take up to a minute)...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {federal ? "Re-run determination" : "Run determination"}
              </>
            )}
          </Button>
          <Button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm &amp; Save Frequency
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
