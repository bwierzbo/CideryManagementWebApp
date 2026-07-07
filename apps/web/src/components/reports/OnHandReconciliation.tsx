"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// TTB Form 5120.17 Part I column labels
const TAX_CLASS_LABEL: Record<string, string> = {
  hardCider: "Hard Cider (col f)",
  wineUnder16: "Wine ≤16% (col a)",
  wine16To21: "Wine 16–21% (col b)",
  wine21To24: "Wine 21–24% (col c)",
  carbonatedWine: "Artif. Carbonated (col d)",
  sparklingWine: "Sparkling (col e)",
  appleBrandy: "Apple Brandy / spirits",
  unclassified: "Unclassified",
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function OnHandReconciliation() {
  const [asOfDate, setAsOfDate] = useState("2025-12-31");
  const { data, isLoading, error } =
    trpc.ttb.onHandReconciliation.useQuery({ asOfDate });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">On-Hand Reconciliation</h1>
        <p className="text-muted-foreground">
          Reconstructs every batch&apos;s volume physically on hand as of a date,
          grouped by TTB tax class. Read-only &mdash; nothing is changed. Use it
          to verify your inventory and catch data-timing issues before filing.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <Label htmlFor="asof">On hand as of</Label>
          <Input
            id="asof"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Reconstructing&hellip;</p>}
      {error && <p className="text-red-600">Error: {error.message}</p>}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>On hand by tax class &mdash; {data.asOfDate}</CardTitle>
              <CardDescription>
                Total {fmt(data.totalGal)} gal across {data.rows.length} batches.
                Compare the Hard Cider (col f) line to your filed 5120.17 ending.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax class</TableHead>
                    <TableHead className="text-right">Gallons</TableHead>
                    <TableHead className="text-right">Liters</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subtotals.map((s) => (
                    <TableRow key={s.taxClass}>
                      <TableCell>
                        {TAX_CLASS_LABEL[s.taxClass] ?? s.taxClass}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(s.gallons)}
                      </TableCell>
                      <TableCell className="text-right">{fmt(s.liters)}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Batches on hand</CardTitle>
              <CardDescription>
                <span className="rounded bg-amber-100 px-1">Amber</span> = fermented
                in a different year than its data-entry start date (a backlog-timing
                batch to review). <strong>dup</strong> = the name appears more than
                once (possible double-count to resolve).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Tax class</TableHead>
                      <TableHead className="text-right">Gal</TableHead>
                      <TableHead>Fermented</TableHead>
                      <TableHead>Start (entry)</TableHead>
                      <TableHead>Pressed</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className={r.timingMismatch ? "bg-amber-50" : undefined}
                      >
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {TAX_CLASS_LABEL[r.taxClass] ?? r.taxClass}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(r.onHandGal)}
                        </TableCell>
                        <TableCell>{r.fermentationStart ?? "—"}</TableCell>
                        <TableCell>{r.startDate ?? "—"}</TableCell>
                        <TableCell>{r.pressedDate ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.parentName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {r.timingMismatch && (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-700"
                              >
                                timing
                              </Badge>
                            )}
                            {r.duplicateName && (
                              <Badge
                                variant="outline"
                                className="border-red-400 text-red-600"
                              >
                                dup
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
