"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Package,
  Droplets,
  TrendingUp,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";

export default function COGSReportPage() {
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [productTypeFilter, setProductTypeFilter] = useState("all");

  const { data, isLoading, error } = trpc.pdfReports.cogsBreakdown.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
    productType: productTypeFilter !== "all" ? productTypeFilter : undefined,
  });

  const fmt = (n: number | null | undefined) =>
    n != null ? `$${n.toFixed(2)}` : "—";
  const fmtPct = (n: number | null | undefined) =>
    n != null ? `${n.toFixed(1)}%` : "—";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Reports
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Cost of Goods Sold
            </h1>
            <p className="text-gray-600 mt-1">
              Full cost breakdown by packaging run — fruit, additives, packaging
              materials, labor, and overhead
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Product Type
                </Label>
                <Select
                  value={productTypeFilter}
                  onValueChange={setProductTypeFilter}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="cider">Cider</SelectItem>
                    <SelectItem value="perry">Perry</SelectItem>
                    <SelectItem value="wine">Wine</SelectItem>
                    <SelectItem value="cyser">Cyser</SelectItem>
                    <SelectItem value="pommeau">Pommeau</SelectItem>
                    <SelectItem value="brandy">Brandy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              Loading COGS data...
            </p>
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-red-600">
                Error loading COGS data: {error.message}
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total COGS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {fmt(data.totals.totalCogs)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.totals.totalUnits} units produced
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Cost / Bottle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {fmt(data.totals.avgCostPerUnit)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    Cost / Liter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {fmt(data.totals.avgCostPerLiter)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Avg Margin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {data.totals.totalRevenue > 0
                      ? fmtPct(data.totals.avgMargin)
                      : "—"}
                  </p>
                  {data.totals.totalRevenue > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Revenue: {fmt(data.totals.totalRevenue)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cost Breakdown Summary */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    {
                      label: "Fruit",
                      value: data.totals.totalFruitCost,
                      pct:
                        data.totals.totalCogs > 0
                          ? (data.totals.totalFruitCost /
                              data.totals.totalCogs) *
                            100
                          : 0,
                      color: "bg-green-500",
                    },
                    {
                      label: "Additives",
                      value: data.totals.totalAdditiveCost,
                      pct:
                        data.totals.totalCogs > 0
                          ? (data.totals.totalAdditiveCost /
                              data.totals.totalCogs) *
                            100
                          : 0,
                      color: "bg-purple-500",
                    },
                    {
                      label: "Packaging",
                      value: data.totals.totalPackagingCost,
                      pct:
                        data.totals.totalCogs > 0
                          ? (data.totals.totalPackagingCost /
                              data.totals.totalCogs) *
                            100
                          : 0,
                      color: "bg-blue-500",
                    },
                    {
                      label: "Labor",
                      value: data.totals.totalLaborCost,
                      pct:
                        data.totals.totalCogs > 0
                          ? (data.totals.totalLaborCost /
                              data.totals.totalCogs) *
                            100
                          : 0,
                      color: "bg-amber-500",
                    },
                    {
                      label: "Overhead",
                      value: data.totals.totalOverheadCost,
                      pct:
                        data.totals.totalCogs > 0
                          ? (data.totals.totalOverheadCost /
                              data.totals.totalCogs) *
                            100
                          : 0,
                      color: "bg-gray-500",
                    },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-lg font-bold">{fmt(item.value)}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${Math.min(100, item.pct)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-Run Detail Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Per-Run Detail ({data.runs.length} runs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.runs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No packaging runs found for this period
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batch</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead className="text-right">Fruit</TableHead>
                          <TableHead className="text-right">
                            Additives
                          </TableHead>
                          <TableHead className="text-right">
                            Packaging
                          </TableHead>
                          <TableHead className="text-right">Labor</TableHead>
                          <TableHead className="text-right">
                            Overhead
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Total COGS
                          </TableHead>
                          <TableHead className="text-right">$/Unit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.runs.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium max-w-[150px] truncate">
                              <Link
                                href={`/packaging/${run.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {run.batchName}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-xs capitalize"
                              >
                                {run.productType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDate(run.packagedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {run.unitsProduced}
                            </TableCell>
                            <TableCell className="text-right">
                              {run.volumeTakenL.toFixed(1)}L
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.fruitCost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.additiveCost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.packagingCost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.laborCost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.overheadCost)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {fmt(run.totalCogs)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(run.costPerUnit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {run.margin != null ? (
                                <span
                                  className={
                                    run.margin >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {fmtPct(run.margin)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="font-bold bg-gray-50">
                          <TableCell colSpan={3}>TOTALS</TableCell>
                          <TableCell className="text-right">
                            {data.totals.totalUnits}
                          </TableCell>
                          <TableCell className="text-right">
                            {data.totals.totalVolume.toFixed(1)}L
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalFruitCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalAdditiveCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalPackagingCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalLaborCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalOverheadCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.totalCogs)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(data.totals.avgCostPerUnit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {data.totals.totalRevenue > 0
                              ? fmtPct(data.totals.avgMargin)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
