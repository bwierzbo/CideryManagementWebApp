"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Filter,
  X,
  Calendar,
  Package,
  Search,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { HarvestDatePicker } from "@/components/ui/harvest-date-picker";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/utils/date-format";

export interface PackagingFiltersState {
  dateFrom: Date | null;
  dateTo: Date | null;
  packageSizeML: number | null;
  packageType: string | null; // Filter by package type (bottle, keg, can, or null for all)
  batchSearch: string;
  status: "active" | "ready" | "distributed" | "completed";
}

export interface PackagingFiltersProps {
  onFiltersChange: (filters: PackagingFiltersState) => void;
  onExportClick: () => void;
  initialFilters?: Partial<PackagingFiltersState>;
  className?: string;
  isExporting?: boolean;
  itemCount?: number;
}

const defaultFilters: PackagingFiltersState = {
  dateFrom: null,
  dateTo: null,
  packageSizeML: null,
  packageType: null, // null means "All Packaging"
  batchSearch: "",
  status: "active",
};

export function PackagingFilters({
  onFiltersChange,
  onExportClick,
  initialFilters = {},
  className,
  isExporting = false,
  itemCount = 0,
}: PackagingFiltersProps) {
  const [filters, setFilters] = useState<PackagingFiltersState>({
    ...defaultFilters,
    ...initialFilters,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce batch search to avoid excessive API calls
  const debouncedBatchSearch = useDebounce(filters.batchSearch, 300);

  // Get package sizes for dropdown
  const { data: packageSizes, isLoading: isLoadingPackageSizes } =
    trpc.packaging.getPackageSizes.useQuery();

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedBatchSearch !== filters.batchSearch) {
      const newFilters = { ...filters, batchSearch: debouncedBatchSearch };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    }
  }, [debouncedBatchSearch, filters, onFiltersChange]);

  // Handle immediate filter changes (non-search)
  const handleFilterChange = useCallback(
    (key: keyof PackagingFiltersState, value: any) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange],
  );

  // Handle search input change (immediate state update, debounced API call)
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, batchSearch: value }));
  }, []);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
    setShowAdvanced(false);
  }, [onFiltersChange]);

  // Calculate active filter count (excluding status since it's now a tab)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.packageType) count++;
    if (filters.packageSizeML) count++;
    if (filters.batchSearch.trim()) count++;
    return count;
  }, [filters]);

  // Format package size display
  const formatPackageSize = useCallback((sizeML: number) => {
    if (sizeML >= 1000) {
      return `${sizeML / 1000}L`;
    }
    return `${sizeML}ml`;
  }, []);

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4", className)}>
      <div className="space-y-3">
        {/* Compact filter bar - Single row on desktop */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => handleFilterChange("status", "active")}
              className={cn(
                "px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                filters.status === "active"
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              In Progress
            </button>
            <button
              onClick={() => handleFilterChange("status", "ready")}
              className={cn(
                "px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                filters.status === "ready"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Ready
            </button>
            <button
              onClick={() => handleFilterChange("status", "distributed")}
              className={cn(
                "px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                filters.status === "distributed"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Distributed
            </button>
            <button
              onClick={() => handleFilterChange("status", "completed")}
              className={cn(
                "px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                filters.status === "completed"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Completed
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-0 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search batches..."
                value={filters.batchSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 flex-shrink-0 h-9 border-gray-300"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 min-w-[20px] h-5 flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExportClick}
              disabled={isExporting || itemCount === 0}
              className="flex items-center gap-1.5 flex-shrink-0 h-9 border-gray-300"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Exporting...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </>
              )}
            </Button>
          </div>
        </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="border-t pt-3 md:pt-4 space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {/* Date From */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">From Date</Label>
                  <HarvestDatePicker
                    value={filters.dateFrom}
                    onChange={(date) => handleFilterChange("dateFrom", date)}
                    placeholder="Start date"
                    allowFutureDates={true}
                    showClearButton={true}
                  />
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">To Date</Label>
                  <HarvestDatePicker
                    value={filters.dateTo}
                    onChange={(date) => handleFilterChange("dateTo", date)}
                    placeholder="End date"
                    allowFutureDates={true}
                    showClearButton={true}
                  />
                </div>

                {/* Package Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Package Type</Label>
                  <Select
                    value={filters.packageType || "all"}
                    onValueChange={(value) =>
                      handleFilterChange(
                        "packageType",
                        value === "all" ? null : value,
                      )
                    }
                  >
                    <SelectTrigger className="h-9 md:h-10">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Packaging</SelectItem>
                      <SelectItem value="bottle">Bottles Only</SelectItem>
                      <SelectItem value="keg">Kegs Only</SelectItem>
                      <SelectItem value="can">Cans Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Package Size */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Package Size</Label>
                  <Select
                    value={filters.packageSizeML?.toString() || "all"}
                    onValueChange={(value) =>
                      handleFilterChange(
                        "packageSizeML",
                        value === "all" ? null : parseInt(value),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 md:h-10">
                      <SelectValue placeholder="All sizes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      {isLoadingPackageSizes ? (
                        <SelectItem value="loading" disabled>
                          Loading...
                        </SelectItem>
                      ) : (
                        packageSizes?.map((size) => (
                          <SelectItem
                            key={size.id}
                            value={size.sizeML.toString()}
                          >
                            {formatPackageSize(size.sizeML)} {size.packageType}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear All Button */}
              {activeFilterCount > 0 && (
                <div className="flex justify-center sm:justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="w-full sm:w-auto"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 md:gap-2 pt-2 border-t max-h-24 overflow-y-auto">
              {filters.dateFrom && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs h-6"
                >
                  <Calendar className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    From: {formatDate(filters.dateFrom)}
                  </span>
                  <span className="sm:hidden">
                    {formatDate(filters.dateFrom)}
                  </span>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 min-w-[12px]"
                    onClick={() => handleFilterChange("dateFrom", null)}
                    aria-label="Remove date from filter"
                  />
                </Badge>
              )}

              {filters.dateTo && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs h-6"
                >
                  <Calendar className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    To: {formatDate(filters.dateTo)}
                  </span>
                  <span className="sm:hidden">
                    {formatDate(filters.dateTo)}
                  </span>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 min-w-[12px]"
                    onClick={() => handleFilterChange("dateTo", null)}
                    aria-label="Remove date to filter"
                  />
                </Badge>
              )}

              {filters.packageType && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs h-6"
                >
                  <Package className="w-3 h-3" />
                  {filters.packageType === 'bottle' && 'Bottles Only'}
                  {filters.packageType === 'keg' && 'Kegs Only'}
                  {filters.packageType === 'can' && 'Cans Only'}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 min-w-[12px]"
                    onClick={() => handleFilterChange("packageType", null)}
                    aria-label="Remove package type filter"
                  />
                </Badge>
              )}

              {filters.packageSizeML && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs h-6"
                >
                  <Package className="w-3 h-3" />
                  {formatPackageSize(filters.packageSizeML)}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 min-w-[12px]"
                    onClick={() => handleFilterChange("packageSizeML", null)}
                    aria-label="Remove package size filter"
                  />
                </Badge>
              )}

              {filters.batchSearch.trim() && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs h-6 max-w-[200px]"
                >
                  <Search className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    <span className="hidden sm:inline">
                      Search: &quot;{filters.batchSearch}&quot;
                    </span>
                    <span className="sm:hidden">
                      &quot;{filters.batchSearch}&quot;
                    </span>
                  </span>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 min-w-[12px] flex-shrink-0"
                    onClick={() => handleSearchChange("")}
                    aria-label="Clear search filter"
                  />
                </Badge>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

// Simple version for basic use cases
export interface SimplePackagingFiltersProps {
  onSearchChange: (search: string) => void;
  searchValue?: string;
  className?: string;
}

export function SimplePackagingFilters({
  onSearchChange,
  searchValue = "",
  className,
}: SimplePackagingFiltersProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search batch names..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}
