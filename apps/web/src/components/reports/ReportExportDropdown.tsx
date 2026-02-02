"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface ReportExportDropdownProps {
  onExportPDF?: () => Promise<void>;
  onExportExcel?: () => Promise<void>;
  onExportCSV?: () => Promise<void>;
  disabled?: boolean;
  /** Optional label override (default: "Export") */
  label?: string;
}

export function ReportExportDropdown({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  disabled = false,
  label = "Export",
}: ReportExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);

  const handleExport = async (
    type: "pdf" | "excel" | "csv",
    exportFn?: () => Promise<void>
  ) => {
    if (!exportFn) return;

    setIsExporting(true);
    setExportType(type);

    try {
      await exportFn();
      toast({
        title: "Export complete",
        description: `Your ${type.toUpperCase()} file has been downloaded.`,
      });
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      toast({
        title: "Export failed",
        description: `Failed to generate ${type.toUpperCase()} file. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const hasAnyExport = onExportPDF || onExportExcel || onExportCSV;

  if (!hasAnyExport) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isExporting ? `Exporting ${exportType?.toUpperCase()}...` : label}
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportPDF && (
          <DropdownMenuItem
            onClick={() => handleExport("pdf", onExportPDF)}
            disabled={isExporting}
          >
            <FileText className="w-4 h-4 mr-2 text-red-600" />
            Export as PDF
          </DropdownMenuItem>
        )}
        {onExportExcel && (
          <DropdownMenuItem
            onClick={() => handleExport("excel", onExportExcel)}
            disabled={isExporting}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            Export as Excel
          </DropdownMenuItem>
        )}
        {onExportCSV && (
          <DropdownMenuItem
            onClick={() => handleExport("csv", onExportCSV)}
            disabled={isExporting}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-blue-600" />
            Export as CSV
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
