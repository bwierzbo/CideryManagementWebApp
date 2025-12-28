"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import {
  type DateRangePreset,
  getDateRangeFromPreset,
  formatDateRangeDisplay,
  formatDateForInput,
} from "@/utils/reports/dateHelpers";

export interface DateRangePickerProps {
  onDateRangeChange: (startDate: Date, endDate: Date, label: string) => void;
  defaultPreset?: DateRangePreset;
}

export function DateRangePicker({
  onDateRangeChange,
  defaultPreset = "this-month",
}: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(defaultPreset);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Get current date range for display
  const getCurrentDateRange = () => {
    if (selectedPreset === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      return formatDateRangeDisplay(start, end);
    }

    const range = getDateRangeFromPreset(selectedPreset);
    return range ? range.label : "Select Range";
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustomDialog(true);
      return;
    }

    setSelectedPreset(preset);
    const range = getDateRangeFromPreset(preset);
    if (range) {
      onDateRangeChange(range.startDate, range.endDate, range.label);
    }
  };

  const handleCustomRangeApply = () => {
    if (!customStartDate || !customEndDate) {
      return;
    }

    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date

    if (startDate > endDate) {
      alert("Start date must be before end date");
      return;
    }

    setSelectedPreset("custom");
    setShowCustomDialog(false);
    onDateRangeChange(startDate, endDate, formatDateRangeDisplay(startDate, endDate));
  };

  // Initialize with default preset
  useEffect(() => {
    const range = getDateRangeFromPreset(defaultPreset);
    if (range) {
      onDateRangeChange(range.startDate, range.endDate, range.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const presetButtons: Array<{ value: DateRangePreset; label: string }> = [
    { value: "yesterday", label: "Yesterday" },
    { value: "last-week", label: "Last Week" },
    { value: "last-30-days", label: "Last 30 Days" },
    { value: "last-90-days", label: "Last 90 Days" },
    { value: "this-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
    { value: "q1", label: "Q1" },
    { value: "q2", label: "Q2" },
    { value: "q3", label: "Q3" },
    { value: "q4", label: "Q4" },
    { value: "this-year", label: "This Year" },
    { value: "last-year", label: "Last Year" },
    { value: "lifetime", label: "Lifetime" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-2">
      <Label>Date Range</Label>
      <div className="flex flex-wrap gap-2">
        {presetButtons.map((preset) => (
          <Button
            key={preset.value}
            size="sm"
            variant={selectedPreset === preset.value ? "default" : "outline"}
            onClick={() => handlePresetSelect(preset.value)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
        <Calendar className="w-4 h-4" />
        <span>{getCurrentDateRange()}</span>
      </div>

      {/* Custom Date Range Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
            <DialogDescription>
              Select a custom start and end date for the report
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomRangeApply}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
