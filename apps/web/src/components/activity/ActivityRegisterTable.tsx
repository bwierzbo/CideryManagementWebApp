"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShoppingCart,
  Factory,
  Wine,
  Package,
  Droplets,
  Loader2,
  Calendar,
  ArrowUpDown,
  Pencil,
  Trash2,
  Plus,
  User,
  Bot,
} from "lucide-react";
import { formatDateTime } from "@/utils/date-format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActivityCategory = "all" | "purchases" | "pressing" | "cellar" | "packaging" | "vessels";
type OperationType = "all" | "creates" | "updates" | "deletes";

const CATEGORY_OPTIONS: { value: ActivityCategory; label: string }[] = [
  { value: "all", label: "All Activities" },
  { value: "purchases", label: "Purchases" },
  { value: "pressing", label: "Pressing" },
  { value: "cellar", label: "Cellar Operations" },
  { value: "packaging", label: "Packaging" },
  { value: "vessels", label: "Vessel Operations" },
];

const OPERATION_OPTIONS: { value: OperationType; label: string }[] = [
  { value: "all", label: "All Operations" },
  { value: "creates", label: "Creates Only" },
  { value: "updates", label: "Updates Only" },
  { value: "deletes", label: "Deletes Only" },
];

const ACTIVITY_TYPE_CONFIG: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  purchase: { icon: ShoppingCart, color: "bg-blue-100 text-blue-800", label: "Purchase" },
  press_run: { icon: Factory, color: "bg-purple-100 text-purple-800", label: "Press Run" },
  batch: { icon: Wine, color: "bg-amber-100 text-amber-800", label: "Batch" },
  measurement: { icon: Droplets, color: "bg-cyan-100 text-cyan-800", label: "Measurement" },
  transfer: { icon: Wine, color: "bg-teal-100 text-teal-800", label: "Transfer" },
  additive: { icon: Droplets, color: "bg-green-100 text-green-800", label: "Additive" },
  carbonation: { icon: Droplets, color: "bg-indigo-100 text-indigo-800", label: "Carbonation" },
  bottle_run: { icon: Package, color: "bg-rose-100 text-rose-800", label: "Bottle Run" },
  keg_fill: { icon: Package, color: "bg-orange-100 text-orange-800", label: "Keg Fill" },
  cleaning: { icon: Droplets, color: "bg-gray-100 text-gray-800", label: "Cleaning" },
  distillation_sent: { icon: Wine, color: "bg-violet-100 text-violet-800", label: "Sent to Distillery" },
  distillation_received: { icon: Wine, color: "bg-fuchsia-100 text-fuchsia-800", label: "Brandy Received" },
  audit_update: { icon: Pencil, color: "bg-yellow-100 text-yellow-800", label: "Update" },
  audit_delete: { icon: Trash2, color: "bg-red-100 text-red-800", label: "Delete" },
};

const OPERATION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  create: { icon: Plus, color: "text-green-600", label: "Created" },
  update: { icon: Pencil, color: "text-yellow-600", label: "Updated" },
  delete: { icon: Trash2, color: "text-red-600", label: "Deleted" },
};

const CATEGORY_CONFIG: Record<ActivityCategory, { color: string; label: string }> = {
  all: { color: "bg-gray-100 text-gray-800", label: "All" },
  purchases: { color: "bg-blue-100 text-blue-800", label: "Purchases" },
  pressing: { color: "bg-purple-100 text-purple-800", label: "Pressing" },
  cellar: { color: "bg-amber-100 text-amber-800", label: "Cellar" },
  packaging: { color: "bg-rose-100 text-rose-800", label: "Packaging" },
  vessels: { color: "bg-gray-100 text-gray-800", label: "Vessels" },
};

export function ActivityRegisterTable() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [category, setCategory] = useState<ActivityCategory>("all");
  const [operationType, setOperationType] = useState<OperationType>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = trpc.activityRegister.listActivities.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    category,
    operationType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    sortOrder,
  });

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    setPage(0); // Reset to first page when sorting changes
  };

  const resetFilters = () => {
    setCategory("all");
    setOperationType("all");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading activities: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.activities || [];
  const pagination = data?.pagination;

  const totalPages = pagination
    ? Math.ceil(pagination.total / pageSize)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Activities</CardTitle>
        <div className="flex flex-wrap gap-4 mt-4">
          {/* Category Filter */}
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="category" className="text-sm font-medium mb-2 block">
              Category
            </Label>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as ActivityCategory);
                setPage(0);
              }}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operation Type Filter */}
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="operationType" className="text-sm font-medium mb-2 block">
              Operation
            </Label>
            <Select
              value={operationType}
              onValueChange={(value) => {
                setOperationType(value as OperationType);
                setPage(0);
              }}
            >
              <SelectTrigger id="operationType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filters */}
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="endDate" className="text-sm font-medium mb-2 block">
              End Date
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <Button variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No activities found matching your filters
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={toggleSortOrder}
                      >
                        Date/Time
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Activity Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity: any) => {
                    const activityConfig = ACTIVITY_TYPE_CONFIG[activity.type] || {
                      icon: Calendar,
                      color: "bg-gray-100 text-gray-800",
                      label: activity.type,
                    };
                    const categoryConfig = CATEGORY_CONFIG[activity.category as ActivityCategory];
                    const operationConfig = OPERATION_CONFIG[activity.operation] || OPERATION_CONFIG.create;
                    const Icon = activityConfig.icon;
                    const OperationIcon = operationConfig.icon;
                    const isClaudeAssistant = activity.performed_by_name === "Claude Assistant";
                    const performedByName = activity.performed_by_name || "System";

                    return (
                      <TableRow key={activity.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <OperationIcon className={`w-3 h-3 ${operationConfig.color}`} />
                            {formatDateTime(activity.activity_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={activityConfig.color} variant="secondary">
                            <Icon className="w-3 h-3 mr-1" />
                            {activity.activity_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={categoryConfig.color} variant="secondary">
                            {categoryConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isClaudeAssistant ? (
                              <Bot className="w-4 h-4 text-purple-500" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={isClaudeAssistant ? "text-purple-600 font-medium" : "text-gray-600"}>
                              {performedByName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {activity.vendor_name}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatActivityDetails(activity)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize" className="text-sm">
                  Show
                </Label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <SelectTrigger id="pageSize" className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">
                  entries (showing {page * pageSize + 1}-
                  {Math.min((page + 1) * pageSize, pagination?.total || 0)} of{" "}
                  {pagination?.total || 0})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination?.hasMore}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages - 1)}
                  disabled={!pagination?.hasMore}
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatActivityDetails(activity: any): string {
  const metadata = activity.metadata;

  switch (activity.type) {
    case "purchase":
      return metadata.totalCost
        ? `Total: $${Number(metadata.totalCost).toFixed(2)}`
        : "-";
    case "press_run":
      return `${metadata.totalWeight ? `${Number(metadata.totalWeight).toFixed(1)} kg` : ""} → ${metadata.totalVolume ? `${Number(metadata.totalVolume).toFixed(1)} L` : ""}`;
    case "batch":
      return `${metadata.batchName || metadata.batchCode} - ${metadata.status}`;
    case "measurement":
      return `SG: ${metadata.specificGravity ? Number(metadata.specificGravity).toFixed(3) : "-"} | ABV: ${metadata.abv ? Number(metadata.abv).toFixed(1) + "%" : "-"}`;
    case "transfer":
      return `${metadata.volumeTransferred ? Number(metadata.volumeTransferred).toFixed(1) + " L transferred" : "Transfer"}`;
    case "additive":
      return `${metadata.additiveName || "Additive"}: ${metadata.amount} ${metadata.unit}`;
    case "carbonation":
      return `Target: ${metadata.targetVolumes ? Number(metadata.targetVolumes).toFixed(1) + " vol" : "-"}`;
    case "bottle_run":
      return `${metadata.totalBottles || 0} bottles`;
    case "keg_fill":
      return `Keg ${metadata.kegNumber}: ${metadata.volumeTaken ? Number(metadata.volumeTaken).toFixed(1) : "-"} ${metadata.volumeUnit || "L"}`;
    case "cleaning":
      return metadata.notes || "-";
    case "distillation_sent":
      return `${metadata.sourceVolume ? Number(metadata.sourceVolume).toFixed(1) : "-"} ${metadata.sourceVolumeUnit || "L"} → ${metadata.distilleryName}`;
    case "distillation_received":
      return `${metadata.receivedVolume ? Number(metadata.receivedVolume).toFixed(1) : "-"} ${metadata.receivedVolumeUnit || "L"} @ ${metadata.receivedAbv ? Number(metadata.receivedAbv).toFixed(1) + "%" : "-"} ABV`;
    case "audit_update":
    case "audit_delete":
      return metadata.reason || `${metadata.tableName} record ${metadata.recordId?.substring(0, 8)}...`;
    default:
      return "-";
  }
}
