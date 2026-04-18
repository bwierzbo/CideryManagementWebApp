"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Beaker,
  Clock,
  Package,
  Beer,
  TrendingDown,
  ArrowLeft,
  Loader2,
  Droplets,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/utils/trpc";

export default function ProductionSummaryPage() {
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const { data, isLoading } = trpc.pdfReports.productionSummary.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtL = (n: number) => `${fmt(n)} L`;
  const fmtGal = (n: number) => `${(n / 3.78541).toFixed(0)} gal`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
              Production Summary
            </h1>
            <p className="text-gray-600 mt-1">
              Total liquid by state — in process, packaged, losses, distributed
            </p>
          </div>
        </div>

        {/* Date Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
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
              <p className="text-xs text-muted-foreground pb-2">
                Date range applies to packaging and losses. In-process shows current state.
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* In Process */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-600" />
                  In Process (Current)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Beaker className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-purple-900">Fermenting</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">{fmtL(data.inProcess.fermenting.volumeL)}</p>
                    <p className="text-sm text-purple-600">{data.inProcess.fermenting.count} batches · {fmtGal(data.inProcess.fermenting.volumeL)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="font-medium text-amber-900">Aging</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-900">{fmtL(data.inProcess.aging.volumeL)}</p>
                    <p className="text-sm text-amber-600">{data.inProcess.aging.count} batches · {fmtGal(data.inProcess.aging.volumeL)}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Total in Cellar</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{fmtL(data.inProcess.totalVolumeL)}</p>
                    <p className="text-sm text-blue-600">{data.inProcess.totalBatches} batches · {fmtGal(data.inProcess.totalVolumeL)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Packaged */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  Packaged
                  <Badge variant="outline" className="text-xs ml-2">
                    {dateFrom} to {dateTo}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Bottles</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{fmt(data.packaged.bottles.units)} bottles</p>
                    <p className="text-sm text-green-600">
                      {fmtL(data.packaged.bottles.volumeL)} · {data.packaged.bottles.runs} runs
                    </p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-green-700">{fmt(data.packaged.bottles.inStock)} in stock</span>
                      <span className="text-muted-foreground">{fmt(data.packaged.bottles.distributed)} distributed</span>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Beer className="w-5 h-5 text-amber-600" />
                      <span className="font-medium text-amber-900">Kegs</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-900">{fmt(data.packaged.kegs.fills)} fills</p>
                    <p className="text-sm text-amber-600">
                      {fmtL(data.packaged.kegs.volumeL)}
                    </p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-amber-700">{fmt(data.packaged.kegs.inStock)} in stock</span>
                      <span className="text-muted-foreground">{fmt(data.packaged.kegs.distributed)} distributed</span>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Total Packaged</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{fmtL(data.packaged.totalVolumeL)}</p>
                    <p className="text-sm text-blue-600">{fmtGal(data.packaged.totalVolumeL)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Losses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Losses
                  <Badge variant="outline" className="text-xs ml-2">
                    {dateFrom} to {dateTo}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <p className="text-2xl font-bold text-red-900">{fmtL(data.losses.totalVolumeL)}</p>
                    <p className="text-sm text-red-600">{fmtGal(data.losses.totalVolumeL)} total losses</p>
                  </div>
                </div>
                {data.losses.byType.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">By type:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {data.losses.byType.map((loss: any) => (
                        <div key={loss.type} className="p-2 bg-red-50 rounded text-sm">
                          <p className="font-medium text-red-900 capitalize">{loss.type.replace("_", " ")}</p>
                          <p className="text-red-700">{fmtL(loss.volumeL)}</p>
                          <p className="text-xs text-muted-foreground">{loss.count} events</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.losses.byType.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recorded losses in this period</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
