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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Package,
  Filter,
  Flame,
  Beer,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Scale,
} from "lucide-react";
import { formatDateTime } from "@/utils/date-format";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BatchVolumeTraceProps {
  batchId: string;
}

const typeIcons = {
  transfer: ArrowRight,
  transfer_in: ArrowLeft,
  racking: FlaskConical,
  filtering: Filter,
  bottling: Package,
  kegging: Beer,
  distillation: Flame,
  adjustment: Scale,
};

const typeColors = {
  transfer: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  transfer_in: "bg-green-500/10 text-green-700 border-green-500/20",
  racking: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  filtering: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  bottling: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  kegging: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  distillation: "bg-red-500/10 text-red-700 border-red-500/20",
  adjustment: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

const typeLabels = {
  transfer: "Transfer",
  transfer_in: "Blend In",
  racking: "Racking",
  filtering: "Filtering",
  bottling: "Bottling",
  kegging: "Kegging",
  distillation: "Distillation",
  adjustment: "Adjustment",
};

export function BatchVolumeTrace({ batchId }: BatchVolumeTraceProps) {
  const {
    data,
    isLoading,
    error,
  } = trpc.batch.getVolumeTrace.useQuery({ batchId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load volume trace: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No data available</AlertDescription>
      </Alert>
    );
  }

  const { batch, entries, summary } = data;
  const hasDiscrepancy = Math.abs(summary.discrepancy) > 0.5;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Initial Volume</p>
            <p className="text-2xl font-bold">{summary.initialVolume.toFixed(1)} L</p>
          </CardContent>
        </Card>
        {(summary.totalInflow ?? 0) > 0 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Blended In</p>
              <p className="text-2xl font-bold text-green-600">
                +{(summary.totalInflow ?? 0).toFixed(1)} L
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Outflow</p>
            <p className="text-2xl font-bold text-blue-600">
              -{summary.totalOutflow.toFixed(1)} L
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Losses</p>
            <p className="text-2xl font-bold text-amber-600">
              -{summary.totalLoss.toFixed(1)} L
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Current Volume</p>
            <p className="text-2xl font-bold">{summary.currentVolume.toFixed(1)} L</p>
          </CardContent>
        </Card>
        <Card className={cn(hasDiscrepancy && "border-red-500 bg-red-50")}>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {hasDiscrepancy ? (
                <AlertCircle className="h-3 w-3 text-red-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              )}
              Discrepancy
            </p>
            <p className={cn(
              "text-2xl font-bold",
              hasDiscrepancy ? "text-red-600" : "text-green-600"
            )}>
              {summary.discrepancy > 0 ? "+" : ""}{summary.discrepancy.toFixed(1)} L
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Volume accounting explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Volume Accounting
          </CardTitle>
          <CardDescription>
            Initial ({summary.initialVolume.toFixed(1)} L)
            {(summary.totalInflow ?? 0) > 0 && (
              <> + Inflow ({(summary.totalInflow ?? 0).toFixed(1)} L)</>
            )}
            {" "}- Outflow ({summary.totalOutflow.toFixed(1)} L) - Loss ({summary.totalLoss.toFixed(1)} L) = Expected ({summary.accountedVolume.toFixed(1)} L)
            {hasDiscrepancy && (
              <span className="text-red-600 ml-2">
                (Actual: {summary.currentVolume.toFixed(1)} L)
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Volume Flow Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume Flow History</CardTitle>
          <CardDescription>
            Chronological record of where volume went
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No volume flow records found for this batch
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[100px]">Volume</TableHead>
                  <TableHead className="text-right w-[100px]">Loss</TableHead>
                  <TableHead className="w-[180px]">Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const Icon = typeIcons[entry.type] || ArrowRight;
                  const colorClass = typeColors[entry.type] || "bg-gray-500/10 text-gray-700";
                  const label = typeLabels[entry.type] || entry.type;

                  return (
                    <TableRow key={`${entry.type}-${entry.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(entry.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("flex items-center gap-1 w-fit", colorClass)}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(entry.volumeIn ?? 0) > 0 ? (
                          <span className="text-green-600">
                            +{(entry.volumeIn ?? 0).toFixed(1)} L
                          </span>
                        ) : entry.volumeOut > 0 ? (
                          <span className="text-blue-600">
                            -{entry.volumeOut.toFixed(1)} L
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.loss > 0 ? (
                          <span className="text-amber-600">
                            -{entry.loss.toFixed(1)} L
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.destinationId ? (
                          <Link
                            href={`/batch/${entry.destinationId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {entry.destinationName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Summary row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3} className="text-right">
                    Totals:
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(summary.totalInflow ?? 0) > 0 && (
                      <span className="text-green-600">+{(summary.totalInflow ?? 0).toFixed(1)} L / </span>
                    )}
                    <span className="text-blue-600">-{summary.totalOutflow.toFixed(1)} L</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-amber-600">
                    -{summary.totalLoss.toFixed(1)} L
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
