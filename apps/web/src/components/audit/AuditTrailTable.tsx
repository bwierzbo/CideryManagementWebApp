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
  Loader2,
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
} from "lucide-react";
import { formatDateTime } from "@/utils/date-format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditDiffView } from "./AuditDiffView";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AuditOperation = "create" | "update" | "delete" | "soft_delete" | "restore";

const OPERATION_OPTIONS: { value: AuditOperation | "all"; label: string }[] = [
  { value: "all", label: "All Operations" },
  { value: "create", label: "Creates" },
  { value: "update", label: "Updates" },
  { value: "delete", label: "Deletes" },
  { value: "soft_delete", label: "Soft Deletes" },
  { value: "restore", label: "Restores" },
];

const TABLE_OPTIONS = [
  { value: "all", label: "All Tables" },
  { value: "batches", label: "Batches" },
  { value: "batch_measurements", label: "Measurements" },
  { value: "batch_transfers", label: "Transfers" },
  { value: "batch_additives", label: "Additives" },
  { value: "basefruit_purchases", label: "Base Fruit Purchases" },
  { value: "basefruit_purchase_items", label: "Base Fruit Items" },
  { value: "juice_purchases", label: "Juice Purchases" },
  { value: "juice_purchase_items", label: "Juice Items" },
  { value: "additive_purchases", label: "Additive Purchases" },
  { value: "packaging_purchases", label: "Packaging Purchases" },
  { value: "press_runs", label: "Press Runs" },
  { value: "bottle_runs", label: "Bottle Runs" },
  { value: "keg_fills", label: "Keg Fills" },
  { value: "vessels", label: "Vessels" },
  { value: "vendors", label: "Vendors" },
];

const OPERATION_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  create: { icon: Plus, color: "text-green-700", bgColor: "bg-green-100", label: "Created" },
  update: { icon: Pencil, color: "text-yellow-700", bgColor: "bg-yellow-100", label: "Updated" },
  delete: { icon: Trash2, color: "text-red-700", bgColor: "bg-red-100", label: "Deleted" },
  soft_delete: { icon: Trash2, color: "text-orange-700", bgColor: "bg-orange-100", label: "Soft Deleted" },
  restore: { icon: RotateCcw, color: "text-blue-700", bgColor: "bg-blue-100", label: "Restored" },
};

export function AuditTrailTable() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [tableName, setTableName] = useState<string>("all");
  const [operation, setOperation] = useState<AuditOperation | "all">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = trpc.audit.queryLogs.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    tableName: tableName !== "all" ? tableName : undefined,
    operation: operation !== "all" ? operation : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    orderBy: sortOrder,
    includeData: true,
    includeDiff: true,
  });

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    setPage(0);
  };

  const resetFilters = () => {
    setTableName("all");
    setOperation("all");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading audit logs: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  const auditLogs = data?.auditLogs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <div className="flex flex-wrap gap-4 mt-4">
          {/* Table Filter */}
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="tableName" className="text-sm font-medium mb-2 block">
              Table
            </Label>
            <Select
              value={tableName}
              onValueChange={(value) => {
                setTableName(value);
                setPage(0);
              }}
            >
              <SelectTrigger id="tableName">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operation Filter */}
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="operation" className="text-sm font-medium mb-2 block">
              Operation
            </Label>
            <Select
              value={operation}
              onValueChange={(value) => {
                setOperation(value as AuditOperation | "all");
                setPage(0);
              }}
            >
              <SelectTrigger id="operation">
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
          <div className="flex-1 min-w-[140px]">
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

          <div className="flex-1 min-w-[140px]">
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
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No audit logs found matching your filters
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
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
                    <TableHead>Table</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => {
                    const opConfig = OPERATION_CONFIG[log.operation] || OPERATION_CONFIG.update;
                    const OpIcon = opConfig.icon;
                    const isExpanded = expandedRows.has(log.id);
                    const isClaudeAssistant = log.changedByEmail === "claude-assistant";
                    const userName = isClaudeAssistant
                      ? "Claude Assistant"
                      : log.changedByUser?.name || log.changedByUser?.email || log.changedByEmail || "System";

                    return (
                      <Collapsible key={log.id} asChild open={isExpanded}>
                        <>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleRow(log.id)}
                          >
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDateTime(log.changedAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatTableName(log.tableName)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${opConfig.bgColor} ${opConfig.color}`} variant="secondary">
                                <OpIcon className="w-3 h-3 mr-1" />
                                {opConfig.label}
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
                                  {userName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {log.reason || "-"}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={6} className="p-0">
                                <div className="bg-gray-50 border-t border-b px-6 py-4">
                                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-600">Record ID:</span>
                                      <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                        {log.recordId}
                                      </span>
                                    </div>
                                    {log.ipAddress && (
                                      <div>
                                        <span className="font-medium text-gray-600">IP Address:</span>
                                        <span className="ml-2 font-mono text-xs">{log.ipAddress}</span>
                                      </div>
                                    )}
                                  </div>
                                  <AuditDiffView
                                    oldData={log.oldData}
                                    newData={log.newData}
                                    diffData={log.diffData}
                                    operation={log.operation}
                                  />
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
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
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">
                  entries (showing {page * pageSize + 1}-
                  {Math.min((page + 1) * pageSize, totalCount)} of {totalCount})
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
                  Page {page + 1} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages - 1)}
                  disabled={page >= totalPages - 1}
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

function formatTableName(tableName: string): string {
  return tableName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
