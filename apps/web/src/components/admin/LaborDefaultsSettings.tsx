"use client";

import React, { useEffect, useState } from "react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { humanizeMutationError } from "@/utils/mutation-errors";
import { Users } from "lucide-react";

/** Display labels for the labor activity keys, in workflow order. */
const ACTIVITY_LABELS: Array<{ key: string; label: string }> = [
  { key: "press_run", label: "Press run" },
  { key: "racking", label: "Racking / transfer" },
  { key: "additive", label: "Additive addition" },
  { key: "measurement", label: "Measurement" },
  { key: "filtering", label: "Filtering" },
  { key: "carbonation", label: "Carbonation" },
  { key: "keg_fill", label: "Keg fill" },
  { key: "bottle_run", label: "Bottle run" },
  { key: "pasteurization", label: "Pasteurization" },
  { key: "labeling", label: "Labeling" },
  { key: "cleaning", label: "Tank cleaning" },
  { key: "recipe_step", label: "Generic recipe step" },
  { key: "destruction", label: "Batch destruction" },
];

/**
 * Admin → Labor Defaults: the worker and expected hours every activity's
 * labor section prepopulates with.
 */
export function LaborDefaultsSettings() {
  const utils = trpc.useUtils();
  const { data: defaults, isLoading } = trpc.settings.getLaborDefaults.useQuery();
  const { data: workersData } = trpc.workers.list.useQuery();
  const workers = workersData?.workers ?? [];

  const [defaultWorkerId, setDefaultWorkerId] = useState<string>("");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  // Load current values once fetched (don't clobber unsaved edits).
  useEffect(() => {
    if (!defaults || dirty) return;
    setDefaultWorkerId(defaults.defaultWorkerId ?? "");
    setHours(
      Object.fromEntries(
        ACTIVITY_LABELS.map(({ key }) => [
          key,
          String(defaults.hoursByActivity?.[key] ?? ""),
        ]),
      ),
    );
  }, [defaults, dirty]);

  const update = trpc.settings.updateLaborDefaults.useMutation({
    onSuccess: () => {
      toast({ title: "Labor defaults saved" });
      setDirty(false);
      utils.settings.getLaborDefaults.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: humanizeMutationError(error),
        variant: "destructive",
      });
    },
  });

  const onSave = () => {
    const hoursByActivity: Record<string, number> = {};
    for (const { key, label } of ACTIVITY_LABELS) {
      const v = parseFloat(hours[key] ?? "");
      if (Number.isNaN(v) || v < 0) {
        toast({
          title: "Invalid hours",
          description: `"${label}" needs a valid non-negative number.`,
          variant: "destructive",
        });
        return;
      }
      hoursByActivity[key] = v;
    }
    update.mutate({
      defaultWorkerId: defaultWorkerId || null,
      hoursByActivity,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Labor Defaults
        </CardTitle>
        <CardDescription>
          Every activity&apos;s labor section prepopulates with this worker and
          the activity&apos;s expected hours — adjustable per entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Label>Default worker</Label>
          <Select
            value={defaultWorkerId}
            onValueChange={(v) => {
              setDefaultWorkerId(v);
              setDirty(true);
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={isLoading ? "Loading…" : "Select worker…"} />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} (${parseFloat(w.hourlyRate ?? "20").toFixed(2)}/hr)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Expected hours per activity</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 mt-2">
            {ACTIVITY_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-sm">{label}</span>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  className="w-24 h-8 text-right"
                  value={hours[key] ?? ""}
                  onChange={(e) => {
                    setHours((prev) => ({ ...prev, [key]: e.target.value }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={update.isPending || !dirty}>
            {update.isPending ? "Saving…" : "Save defaults"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
