"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/date-format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Save,
  CheckCircle,
  AlertCircle,
  History,
  Loader2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { TTBFormPreview } from "@/components/reports/TTBFormPreview";
import { TTBPeriodFinalization } from "@/components/reports/TTBPeriodFinalization";
import { ReportExportDropdown } from "@/components/reports/ReportExportDropdown";
import { downloadTTBFormPDF, type TTBFormPDFData } from "@/utils/pdf/ttbForm512017";
import { downloadTTBFormExcel } from "@/utils/excel/ttbForm512017";

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];
const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];
const quarters = [
  { value: 1, label: "Q1 (Jan-Mar)" },
  { value: 2, label: "Q2 (Apr-Jun)" },
  { value: 3, label: "Q3 (Jul-Sep)" },
  { value: 4, label: "Q4 (Oct-Dec)" },
];

export default function TTBReportsPage() {
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState("generate");
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch organization settings for orgInfo
  const { data: orgSettings } = trpc.settings.getOrganizationSettings.useQuery();

  // Fetch the latest needed period from backend
  const { data: latestNeeded } = trpc.ttb.getLatestNeededPeriod.useQuery();

  // Initialize period type, year, and period from the latest needed period
  useEffect(() => {
    if (latestNeeded && !hasInitialized) {
      setPeriodType(latestNeeded.periodType);
      setSelectedYear(latestNeeded.year);
      if (latestNeeded.periodNumber) {
        setSelectedPeriod(latestNeeded.periodNumber);
      }
      setHasInitialized(true);
    }
  }, [latestNeeded, hasInitialized]);

  // Generate TTB Form data
  const {
    data: formData,
    isLoading: isLoadingForm,
    refetch: refetchForm,
  } = trpc.ttb.generateForm512017.useQuery(
    {
      periodType,
      year: selectedYear,
      periodNumber: periodType !== "annual" ? selectedPeriod : undefined,
    },
    {
      enabled: hasInitialized,
    }
  );

  // Get report history
  const { data: historyData, isLoading: isLoadingHistory } = trpc.ttb.getReportHistory.useQuery(
    { limit: 10, year: selectedYear },
    { enabled: activeTab === "history" }
  );

  // Save snapshot mutation
  const saveSnapshotMutation = trpc.ttb.saveReportSnapshot.useMutation({
    onSuccess: () => {
      toast({
        title: "Report Saved",
        description: "TTB report snapshot saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit report mutation
  const submitReportMutation = trpc.ttb.submitReport.useMutation({
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "TTB report marked as submitted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveSnapshot = () => {
    if (!formData) return;

    const { startDate, endDate } = formData.formData.reportingPeriod;
    // Dates come as strings from tRPC serialization
    const startDateStr = typeof startDate === 'string' ? startDate : new Date(startDate).toISOString();
    const endDateStr = typeof endDate === 'string' ? endDate : new Date(endDate).toISOString();
    saveSnapshotMutation.mutate({
      periodType,
      periodStart: startDateStr,
      periodEnd: endDateStr,
      data: {
        beginningInventoryBulkGallons: formData.formData.beginningInventory.bulk,
        beginningInventoryBottledGallons: formData.formData.beginningInventory.bottled,
        beginningInventoryTotalGallons: formData.formData.beginningInventory.total,
        wineProducedGallons: formData.formData.wineProduced.total,
        taxPaidTastingRoomGallons: formData.formData.taxPaidRemovals.tastingRoom,
        taxPaidWholesaleGallons: formData.formData.taxPaidRemovals.wholesale,
        taxPaidOnlineDtcGallons: formData.formData.taxPaidRemovals.onlineDtc,
        taxPaidEventsGallons: formData.formData.taxPaidRemovals.events,
        taxPaidRemovalsTotalGallons: formData.formData.taxPaidRemovals.total,
        otherRemovalsSamplesGallons: formData.formData.otherRemovals.samples,
        otherRemovalsBreakageGallons: formData.formData.otherRemovals.breakage,
        otherRemovalsLossesGallons: formData.formData.otherRemovals.processLosses,
        otherRemovalsTotalGallons: formData.formData.otherRemovals.total,
        endingInventoryBulkGallons: formData.formData.endingInventory.bulk,
        endingInventoryBottledGallons: formData.formData.endingInventory.bottled,
        endingInventoryTotalGallons: formData.formData.endingInventory.total,
        taxableGallons: formData.formData.taxSummary.taxableGallons,
        taxRate: 0.226,
        smallProducerCreditGallons: formData.formData.taxSummary.creditEligibleGallons,
        smallProducerCreditAmount: formData.formData.taxSummary.smallProducerCredit,
        taxOwed: formData.formData.taxSummary.netTaxOwed,
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatGallons = (gallons: number) => {
    return gallons.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  const handleExportPDF = async () => {
    if (!formData) return;

    const filename = `TTB-Form-5120.17-${formData.periodLabel.replace(/\s+/g, "-")}.pdf`;
    await downloadTTBFormPDF(
      formData.formData as TTBFormPDFData,
      formData.periodLabel,
      filename
    );
    toast({
      title: "PDF Downloaded",
      description: `${filename} has been downloaded`,
    });
  };

  const handleExportExcel = async () => {
    if (!formData) return;

    const filename = `TTB-Form-5120.17-${formData.periodLabel.replace(/\s+/g, "-")}.xlsx`;
    await downloadTTBFormExcel(
      formData.formData as TTBFormPDFData,
      formData.periodLabel,
      filename
    );
    toast({
      title: "Excel Downloaded",
      description: `${filename} has been downloaded`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FileText className="w-8 h-8 text-amber-600 mr-3" />
            TTB Form 5120.17
          </h1>
          <p className="text-gray-600 mt-1">
            Report of Wine Premises Operations
          </p>
        </div>

        {/* Compact Period Selector */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Select
                value={periodType}
                onValueChange={(v) => {
                  setPeriodType(v as "monthly" | "quarterly" | "annual");
                  if (v === "quarterly") {
                    setSelectedPeriod(Math.ceil((new Date().getMonth() + 1) / 3));
                  } else if (v === "monthly") {
                    setSelectedPeriod(new Date().getMonth() + 1);
                  }
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {periodType === "monthly" && (
                <Select
                  value={selectedPeriod.toString()}
                  onValueChange={(v) => setSelectedPeriod(parseInt(v))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {periodType === "quarterly" && (
                <Select
                  value={selectedPeriod.toString()}
                  onValueChange={(v) => setSelectedPeriod(parseInt(v))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map((quarter) => (
                      <SelectItem key={quarter.value} value={quarter.value.toString()}>
                        {quarter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button size="sm" onClick={() => refetchForm()} disabled={isLoadingForm}>
                {isLoadingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
              </Button>

              <ReportExportDropdown
                onExportPDF={formData ? handleExportPDF : undefined}
                onExportExcel={formData ? handleExportExcel : undefined}
                disabled={!formData}
              />

              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSnapshot}
                disabled={!formData || saveSnapshotMutation.isPending}
              >
                <Save className="w-4 h-4 mr-1" />
                {saveSnapshotMutation.isPending ? "Saving..." : "Save Snapshot"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Form Preview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Report History
            </TabsTrigger>
          </TabsList>

          {/* Form Preview Tab */}
          <TabsContent value="generate">
            {isLoadingForm ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-4" />
                    <p className="text-gray-500">Generating TTB report data...</p>
                  </div>
                </CardContent>
              </Card>
            ) : formData ? (
              <>
                <TTBFormPreview
                  formData={formData.formData}
                  periodLabel={formData.periodLabel}
                  orgInfo={orgSettings ? {
                    name: orgSettings.name,
                    address: orgSettings.address,
                    einNumber: orgSettings.einNumber,
                    ttbPermitNumber: orgSettings.ttbPermitNumber,
                  } : undefined}
                />
                <TTBPeriodFinalization
                  periodType={periodType}
                  year={selectedYear}
                  periodNumber={periodType !== "annual" ? selectedPeriod : undefined}
                  periodStart={String(formData.formData.reportingPeriod.startDate)}
                  periodEnd={String(formData.formData.reportingPeriod.endDate)}
                  formData={formData.formData as any}
                />
              </>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    Select a period and click &quot;Generate Report&quot; to view the form data.
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
                <CardDescription>
                  Previously generated and saved TTB reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !historyData?.reports.length ? (
                  <div className="text-center py-8 text-gray-500">
                    No saved reports found for {selectedYear}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Period</th>
                          <th className="text-right py-3 px-4 font-medium">Tax-Paid Removals</th>
                          <th className="text-right py-3 px-4 font-medium">Tax Owed</th>
                          <th className="text-left py-3 px-4 font-medium">Status</th>
                          <th className="text-left py-3 px-4 font-medium">Created</th>
                          <th className="text-left py-3 px-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.reports.map((report) => (
                          <tr key={report.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium">
                                {report.periodType === "monthly"
                                  ? new Date(report.periodStart).toLocaleDateString("en-US", {
                                      month: "long",
                                      year: "numeric",
                                    })
                                  : report.periodType === "quarterly"
                                  ? `Q${Math.ceil((new Date(report.periodStart).getMonth() + 1) / 3)} ${new Date(report.periodStart).getFullYear()}`
                                  : new Date(report.periodStart).getFullYear()}
                              </div>
                              <div className="text-sm text-gray-500 capitalize">
                                {report.periodType}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {report.taxPaidRemovalsTotalGallons
                                ? formatGallons(parseFloat(report.taxPaidRemovalsTotalGallons))
                                : "-"}{" "}
                              gal
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {report.taxOwed
                                ? formatCurrency(parseFloat(report.taxOwed))
                                : "-"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={report.status === "submitted" ? "default" : "secondary"}
                              >
                                {report.status === "submitted" ? (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                )}
                                {report.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {formatDate(report.createdAt)}
                              {report.generatedByName && (
                                <div className="text-xs">by {report.generatedByName}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPeriodType(report.periodType);
                                    setSelectedYear(new Date(report.periodStart).getFullYear());
                                    if (report.periodType === "monthly") {
                                      setSelectedPeriod(new Date(report.periodStart).getMonth() + 1);
                                    } else if (report.periodType === "quarterly") {
                                      setSelectedPeriod(Math.ceil((new Date(report.periodStart).getMonth() + 1) / 3));
                                    }
                                    setActiveTab("generate");
                                  }}
                                >
                                  View
                                </Button>
                                {report.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => submitReportMutation.mutate(report.id)}
                                  >
                                    Submit
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
