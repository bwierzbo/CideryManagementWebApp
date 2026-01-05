"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Calculator,
  Save,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Building2,
  Zap,
  Shield,
  Wrench,
  FileText,
  MoreHorizontal,
  HelpCircle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OverheadFormData {
  overheadTrackingEnabled: boolean;
  overheadAnnualRent: string;
  overheadAnnualUtilities: string;
  overheadAnnualInsurance: string;
  overheadAnnualEquipment: string;
  overheadAnnualLicenses: string;
  overheadAnnualOther: string;
  overheadAnnualBudget: string;
  overheadExpectedAnnualGallons: string;
  overheadRatePerGallon: string;
  overheadBudgetYear: number | null;
}

export function OverheadSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Query settings directly from tRPC (includes overhead fields)
  const { data: settings, isLoading, refetch } = trpc.settings.getOrganizationSettings.useQuery();

  const [formData, setFormData] = useState<OverheadFormData>({
    overheadTrackingEnabled: false,
    overheadAnnualRent: "",
    overheadAnnualUtilities: "",
    overheadAnnualInsurance: "",
    overheadAnnualEquipment: "",
    overheadAnnualLicenses: "",
    overheadAnnualOther: "",
    overheadAnnualBudget: "",
    overheadExpectedAnnualGallons: "",
    overheadRatePerGallon: "",
    overheadBudgetYear: new Date().getFullYear(),
  });

  // Update form when settings load
  useEffect(() => {
    if (!isLoading && settings) {
      // Cast to access overhead fields that exist in DB but not in context type
      const s = settings as any;
      setFormData({
        overheadTrackingEnabled: s.overheadTrackingEnabled ?? false,
        overheadAnnualRent: s.overheadAnnualRent ?? "",
        overheadAnnualUtilities: s.overheadAnnualUtilities ?? "",
        overheadAnnualInsurance: s.overheadAnnualInsurance ?? "",
        overheadAnnualEquipment: s.overheadAnnualEquipment ?? "",
        overheadAnnualLicenses: s.overheadAnnualLicenses ?? "",
        overheadAnnualOther: s.overheadAnnualOther ?? "",
        overheadAnnualBudget: s.overheadAnnualBudget ?? "",
        overheadExpectedAnnualGallons: s.overheadExpectedAnnualGallons ?? "",
        overheadRatePerGallon: s.overheadRatePerGallon ?? "",
        overheadBudgetYear: s.overheadBudgetYear ?? new Date().getFullYear(),
      });
      if (s.overheadBudgetYear) {
        setSelectedYear(s.overheadBudgetYear);
      }
    }
  }, [isLoading, settings]);

  // Year-end summary query
  const { data: yearEndSummary, isLoading: isLoadingYearEnd } =
    trpc.settings.getOverheadYearEndSummary.useQuery(
      { year: selectedYear },
      { enabled: formData.overheadTrackingEnabled }
    );

  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation({
    onSuccess: () => {
      toast({
        title: "Overhead Settings Saved",
        description: "Your overhead configuration has been updated.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate total budget from components
  const calculateTotalBudget = () => {
    const components = [
      formData.overheadAnnualRent,
      formData.overheadAnnualUtilities,
      formData.overheadAnnualInsurance,
      formData.overheadAnnualEquipment,
      formData.overheadAnnualLicenses,
      formData.overheadAnnualOther,
    ];

    const total = components.reduce((sum, val) => {
      const num = parseFloat(val) || 0;
      return sum + num;
    }, 0);

    return total;
  };

  // Calculate rate per gallon
  const calculateRate = () => {
    const budget = parseFloat(formData.overheadAnnualBudget) || calculateTotalBudget();
    const gallons = parseFloat(formData.overheadExpectedAnnualGallons) || 0;

    if (budget > 0 && gallons > 0) {
      return (budget / gallons).toFixed(4);
    }
    return "0.0000";
  };

  // Auto-update budget when components change
  useEffect(() => {
    const total = calculateTotalBudget();
    if (total > 0) {
      setFormData((prev) => ({
        ...prev,
        overheadAnnualBudget: total.toFixed(2),
      }));
    }
  }, [
    formData.overheadAnnualRent,
    formData.overheadAnnualUtilities,
    formData.overheadAnnualInsurance,
    formData.overheadAnnualEquipment,
    formData.overheadAnnualLicenses,
    formData.overheadAnnualOther,
  ]);

  // Auto-update rate when budget or gallons change
  useEffect(() => {
    const rate = calculateRate();
    setFormData((prev) => ({
      ...prev,
      overheadRatePerGallon: rate,
    }));
  }, [formData.overheadAnnualBudget, formData.overheadExpectedAnnualGallons]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettingsMutation.mutateAsync({
        overheadTrackingEnabled: formData.overheadTrackingEnabled,
        overheadAnnualRent: formData.overheadAnnualRent || null,
        overheadAnnualUtilities: formData.overheadAnnualUtilities || null,
        overheadAnnualInsurance: formData.overheadAnnualInsurance || null,
        overheadAnnualEquipment: formData.overheadAnnualEquipment || null,
        overheadAnnualLicenses: formData.overheadAnnualLicenses || null,
        overheadAnnualOther: formData.overheadAnnualOther || null,
        overheadAnnualBudget: formData.overheadAnnualBudget || null,
        overheadExpectedAnnualGallons: formData.overheadExpectedAnnualGallons || null,
        overheadRatePerGallon: formData.overheadRatePerGallon || null,
        overheadBudgetYear: formData.overheadBudgetYear,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const costInputs = [
    {
      key: "overheadAnnualRent" as const,
      label: "Rent / Mortgage",
      icon: Building2,
      placeholder: "12000.00",
      description: "Annual facility rent or mortgage payments",
    },
    {
      key: "overheadAnnualUtilities" as const,
      label: "Utilities",
      icon: Zap,
      placeholder: "3600.00",
      description: "Electric, gas, water, internet",
    },
    {
      key: "overheadAnnualInsurance" as const,
      label: "Insurance",
      icon: Shield,
      placeholder: "2400.00",
      description: "Business liability, property insurance",
    },
    {
      key: "overheadAnnualEquipment" as const,
      label: "Equipment Depreciation",
      icon: Wrench,
      placeholder: "1500.00",
      description: "Annual depreciation of equipment",
    },
    {
      key: "overheadAnnualLicenses" as const,
      label: "Licenses & Permits",
      icon: FileText,
      placeholder: "500.00",
      description: "TTB, state licenses, permits",
    },
    {
      key: "overheadAnnualOther" as const,
      label: "Other Fixed Costs",
      icon: MoreHorizontal,
      placeholder: "1000.00",
      description: "Any other annual fixed costs",
    },
  ];

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
      {/* Main Overhead Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Overhead Cost Allocation</CardTitle>
                <CardDescription>
                  Configure how fixed costs are allocated to production for COGS
                  calculations
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="overhead-enabled" className="text-sm font-medium">
                Enable Overhead Tracking
              </Label>
              <Switch
                id="overhead-enabled"
                checked={formData.overheadTrackingEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, overheadTrackingEnabled: checked })
                }
              />
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "space-y-6 transition-opacity",
            !formData.overheadTrackingEnabled && "opacity-50 pointer-events-none"
          )}
        >
          {/* Budget Year */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div>
              <Label className="text-sm font-medium">Budget Year</Label>
              <p className="text-xs text-gray-500 mt-1">
                The year this overhead budget applies to
              </p>
            </div>
            <Select
              value={String(formData.overheadBudgetYear)}
              onValueChange={(value) =>
                setFormData({ ...formData, overheadBudgetYear: parseInt(value) })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h4 className="font-medium">Annual Fixed Costs</h4>
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {costInputs.map((input) => {
                const Icon = input.icon;
                return (
                  <div key={input.key} className="space-y-2">
                    <Label
                      htmlFor={input.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Icon className="w-4 h-4 text-gray-500" />
                      {input.label}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <Input
                        id={input.key}
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData[input.key]}
                        onChange={(e) =>
                          setFormData({ ...formData, [input.key]: e.target.value })
                        }
                        placeholder={input.placeholder}
                        className="pl-7"
                      />
                    </div>
                    <p className="text-xs text-gray-500">{input.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Budget */}
          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-blue-900">
                  Total Annual Overhead Budget
                </Label>
                <p className="text-xs text-blue-700 mt-1">
                  Sum of all fixed costs above
                </p>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                ${parseFloat(formData.overheadAnnualBudget || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Expected Production */}
          <div className="space-y-2">
            <Label htmlFor="expectedGallons" className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-600" />
              Expected Annual Production (Gallons)
            </Label>
            <Input
              id="expectedGallons"
              type="number"
              step="1"
              min="0"
              value={formData.overheadExpectedAnnualGallons}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  overheadExpectedAnnualGallons: e.target.value,
                })
              }
              placeholder="8000"
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500">
              Your estimated total production volume for the year
            </p>
          </div>

          {/* Calculated Rate */}
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-green-900">
                  Calculated Overhead Rate
                </Label>
                <p className="text-xs text-green-700 mt-1">
                  Budget ÷ Expected Gallons = Rate per gallon
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-900">
                  ${formData.overheadRatePerGallon}/gal
                </div>
                <p className="text-xs text-green-700">
                  Applied to each packaging run based on volume
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Overhead Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Year-End Summary Card */}
      {formData.overheadTrackingEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Year-End Overhead Summary</CardTitle>
                  <CardDescription>
                    Compare budgeted vs. actual overhead allocation
                  </CardDescription>
                </div>
              </div>
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            {isLoadingYearEnd ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : !yearEndSummary?.hasData ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{"message" in (yearEndSummary || {}) ? (yearEndSummary as any).message : "No data available"}</p>
              </div>
            ) : (() => {
              // Type narrow to the full data response
              const summary = yearEndSummary as {
                hasData: true;
                year: number;
                budgetYear: number | null;
                budget: { annualBudget: number; expectedGallons: number; ratePerGallon: number };
                actual: { totalVolumeGallons: number; packagingRunCount: number; allocatedOverhead: number };
                analysis: { variance: number; variancePercent: number; isUnderAllocated: boolean; suggestedRateForNextYear: number; recommendation: string };
              };
              return (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Budgeted */}
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Annual Budget</p>
                      <p className="text-2xl font-bold">
                        ${summary.budget.annualBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        @ ${summary.budget.ratePerGallon.toFixed(4)}/gal
                      </p>
                    </div>

                    {/* Actual Production */}
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Actual Production</p>
                      <p className="text-2xl font-bold">
                        {summary.actual.totalVolumeGallons.toLocaleString("en-US", { minimumFractionDigits: 2 })} gal
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {summary.actual.packagingRunCount} packaging runs
                      </p>
                    </div>

                    {/* Allocated */}
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-500">Allocated Overhead</p>
                      <p className="text-2xl font-bold">
                        ${summary.actual.allocatedOverhead.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on actual volume × rate
                      </p>
                    </div>
                  </div>

                  {/* Variance Analysis */}
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      summary.analysis.isUnderAllocated
                        ? "bg-amber-50 border-amber-200"
                        : summary.analysis.variance === 0
                        ? "bg-green-50 border-green-200"
                        : "bg-blue-50 border-blue-200"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {summary.analysis.variance === 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : summary.analysis.isUnderAllocated ? (
                        <TrendingDown className="w-5 h-5 text-amber-600 mt-0.5" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">
                            {summary.analysis.isUnderAllocated
                              ? "Under-Allocated"
                              : summary.analysis.variance === 0
                              ? "Perfect Match"
                              : "Over-Allocated"}
                          </h4>
                          <Badge
                            variant={
                              summary.analysis.variance === 0
                                ? "default"
                                : "secondary"
                            }
                          >
                            {summary.analysis.variancePercent > 0 ? "+" : ""}
                            {summary.analysis.variancePercent.toFixed(1)}%
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">
                          {summary.analysis.recommendation}
                        </p>
                        {summary.analysis.variance !== 0 && (
                          <p className="text-xs mt-2 text-gray-600">
                            Suggested rate for {selectedYear + 1}:{" "}
                            <strong>
                              ${summary.analysis.suggestedRateForNextYear.toFixed(4)}/gal
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
