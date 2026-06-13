"use client";

/**
 * Production Planning (Phase 4) — the payoff.
 *
 * Lay out planned batches (recipe × target volume × period × bottle/keg split)
 * inside named plans (scenarios), and see the per-period inventory requirements
 * the planner sums from every batch's bill-of-materials.
 *
 * Gross requirements only here — on-hand comparison / buy list is the next
 * phase. RBAC is the `plan` entity: viewers read, operators/admins edit. The
 * UI hides edit controls when the user lacks permission; the server enforces.
 */

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Calendar,
  Plus,
  Trash2,
  Star,
  AlertCircle,
  Package,
  FlaskConical,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { canWithOverrides } from "lib/src/rbac/roles";

// ─── Period helpers ─────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Build the selectable period buckets for a year given the org granularity. */
function periodOptions(
  year: number,
  granularity: string,
): { value: string; label: string }[] {
  if (granularity === "quarterly") {
    return [1, 2, 3, 4].map((q) => ({
      value: `${year}-Q${q}`,
      label: `${year} Q${q}`,
    }));
  }
  return MONTH_LABELS.map((m, i) => ({
    value: `${year}-${String(i + 1).padStart(2, "0")}`,
    label: `${m} ${year}`,
  }));
}

/** Human label for a stored period string ("2026-03" → "Mar 2026"). */
function formatPeriod(period: string): string {
  const monthly = period.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    const mi = Number(monthly[2]) - 1;
    if (mi >= 0 && mi < 12) return `${MONTH_LABELS[mi]} ${monthly[1]}`;
  }
  const quarterly = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarterly) return `${quarterly[1]} Q${quarterly[2]}`;
  return period;
}

function formatQty(quantity: number, unit: string): string {
  if (unit === "g" && quantity >= 1000) return `${(quantity / 1000).toFixed(2)} kg`;
  if (unit === "mL" && quantity >= 1000) return `${(quantity / 1000).toFixed(2)} L`;
  const rounded = Math.round(quantity * 100) / 100;
  return `${rounded.toLocaleString()} ${unit}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { data: session } = useSession();
  const user = session?.user as
    | { role?: string; permissionOverrides?: Record<string, boolean> }
    | undefined;
  const role = (user?.role ?? "viewer") as "admin" | "operator" | "viewer";
  const overrides = user?.permissionOverrides ?? {};
  const canEdit = canWithOverrides(role, "update", "plan", overrides);
  const canCreate = canWithOverrides(role, "create", "plan", overrides);
  const canDelete = canWithOverrides(role, "delete", "plan", overrides);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const plansQuery = trpc.planning.listPlans.useQuery();
  const plans = plansQuery.data?.items ?? [];

  // Auto-select the first plan once loaded.
  const effectivePlanId =
    selectedPlanId ?? (plans.length > 0 ? plans[0].id : null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Planning</h1>
            <p className="text-sm text-gray-600">
              Lay out planned batches and see what inventory each period needs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <PlanList
            plans={plans}
            isLoading={plansQuery.isLoading}
            selectedId={effectivePlanId}
            onSelect={setSelectedPlanId}
            canCreate={canCreate}
            canDelete={canDelete}
            onDeleted={(id) => {
              if (id === effectivePlanId) setSelectedPlanId(null);
            }}
          />

          {effectivePlanId ? (
            <PlanDetail key={effectivePlanId} planId={effectivePlanId} canEdit={canEdit} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-gray-500">
                {plansQuery.isLoading
                  ? "Loading plans…"
                  : "No plan selected. Create a plan to start laying out batches."}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Plan list (left column) ────────────────────────────────────────────────

type PlanListItem = {
  id: string;
  name: string;
  year: number | null;
  isOperational: boolean;
  batchCount: number;
};

function PlanList({
  plans,
  isLoading,
  selectedId,
  onSelect,
  canCreate,
  canDelete,
  onDeleted,
}: {
  plans: PlanListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canCreate: boolean;
  canDelete: boolean;
  onDeleted: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createMutation = trpc.planning.createPlan.useMutation({
    onSuccess: (created) => {
      utils.planning.listPlans.invalidate();
      setShowNew(false);
      setName("");
      setYear("");
      onSelect(created.id);
      toast({ title: "Plan created", description: created.name });
    },
    onError: (e) => toast({ title: "Couldn't create plan", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.planning.deletePlan.useMutation({
    onSuccess: (_r, vars) => {
      utils.planning.listPlans.invalidate();
      onDeleted(vars.id);
      toast({ title: "Plan deleted" });
    },
    onError: (e) => toast({ title: "Couldn't delete plan", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      {canCreate && (
        <Button className="w-full" onClick={() => setShowNew((v) => !v)} variant={showNew ? "secondary" : "default"}>
          <Plus className="w-4 h-4 mr-1" /> New plan
        </Button>
      )}

      {showNew && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label htmlFor="plan-name">Name</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., 2026 Annual Plan" />
            </div>
            <div>
              <Label htmlFor="plan-year">Year (optional)</Label>
              <Input id="plan-year" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" inputMode="numeric" />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: name.trim(), year: year ? Number(year) : null })}
            >
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </>
      ) : plans.length === 0 ? (
        <p className="text-sm text-gray-500 px-1">No plans yet.</p>
      ) : (
        plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-colors ${
              plan.id === selectedId ? "border-purple-500 ring-1 ring-purple-200" : "hover:border-gray-300"
            }`}
            onClick={() => onSelect(plan.id)}
          >
            <CardContent className="py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {plan.isOperational && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                  <span className="font-medium text-gray-900 truncate">{plan.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {plan.year ? `${plan.year} · ` : ""}
                  {plan.batchCount} {plan.batchCount === 1 ? "batch" : "batches"}
                </div>
              </div>
              {canDelete && (
                <button
                  className="text-gray-400 hover:text-red-600 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(plan.id);
                  }}
                  aria-label="Delete plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this plan?"
        description="This removes the plan and all its planned batches. This can't be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate({ id: deleteId });
          setDeleteId(null);
        }}
      />
    </div>
  );
}

// ─── Plan detail (right column) ───────────────────────────────────────────────

function PlanDetail({ planId, canEdit }: { planId: string; canEdit: boolean }) {
  const { settings } = useSettings();
  const granularity = settings?.planningGranularity ?? "monthly";
  const utils = trpc.useUtils();
  const { toast } = useToast();

  const planQuery = trpc.planning.getPlan.useQuery({ id: planId });
  const requirementsQuery = trpc.planning.getRequirements.useQuery({ planId });
  const recipesQuery = trpc.recipes.list.useQuery({ status: "active", limit: 200, includeArchived: false, offset: 0 });

  const plan = planQuery.data?.plan;
  const batches = planQuery.data?.batches ?? [];
  const recipeChoices = recipesQuery.data?.items ?? [];

  const refresh = () => {
    utils.planning.getPlan.invalidate({ id: planId });
    utils.planning.getRequirements.invalidate({ planId });
    utils.planning.listPlans.invalidate();
  };

  const setOperational = trpc.planning.setOperational.useMutation({
    onSuccess: () => {
      refresh();
      toast({ title: "Marked operational" });
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeBatch = trpc.planning.removeBatch.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  if (planQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!plan) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">Plan not found.</CardContent>
      </Card>
    );
  }

  const planYear = plan.year ?? new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {plan.name}
                {plan.isOperational && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    <Star className="w-3 h-3 mr-1 fill-amber-500" /> Operational
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {plan.year ? `Target year ${plan.year} · ` : ""}
                {batches.length} planned {batches.length === 1 ? "batch" : "batches"} ·{" "}
                {granularity} buckets
              </CardDescription>
            </div>
            {canEdit && !plan.isOperational && (
              <Button variant="outline" size="sm" onClick={() => setOperational.mutate({ id: planId })} disabled={setOperational.isPending}>
                <Star className="w-4 h-4 mr-1" /> Mark operational
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Planned batches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Planned batches
          </CardTitle>
          <CardDescription>Each batch is a recipe at a target volume in a period, optionally split bottle vs keg.</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">No batches yet. Add one below.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipe</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Target (L)</TableHead>
                  <TableHead className="text-right">Bottle / Keg (L)</TableHead>
                  {canEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span className="font-medium">{b.label || b.recipeName}</span>
                      {b.recipeArchivedAt && (
                        <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">recipe archived</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatPeriod(b.period)}</TableCell>
                    <TableCell className="text-right">{Number(b.targetVolumeL).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-gray-600">
                      {b.bottleVolumeL != null || b.kegVolumeL != null
                        ? `${Number(b.bottleVolumeL ?? 0).toLocaleString()} / ${Number(b.kegVolumeL ?? 0).toLocaleString()}`
                        : "all bottled"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => removeBatch.mutate({ id: b.id })}
                          aria-label="Remove batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {canEdit && (
            <AddBatchForm
              planId={planId}
              recipes={recipeChoices}
              periods={periodOptions(planYear, granularity)}
              onAdded={refresh}
            />
          )}
        </CardContent>
      </Card>

      {/* Requirements */}
      <RequirementsPanel
        isLoading={requirementsQuery.isLoading}
        requirements={requirementsQuery.data?.requirements ?? []}
        warnings={requirementsQuery.data?.warnings ?? []}
      />
    </div>
  );
}

// ─── Add batch form ─────────────────────────────────────────────────────────

function AddBatchForm({
  planId,
  recipes,
  periods,
  onAdded,
}: {
  planId: string;
  recipes: { id: string; name: string }[];
  periods: { value: string; label: string }[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [recipeId, setRecipeId] = useState("");
  const [period, setPeriod] = useState(periods[0]?.value ?? "");
  const [volume, setVolume] = useState("");
  const [kegL, setKegL] = useState("");

  const addMutation = trpc.planning.addBatch.useMutation({
    onSuccess: () => {
      onAdded();
      setRecipeId("");
      setVolume("");
      setKegL("");
      toast({ title: "Batch added" });
    },
    onError: (e) => toast({ title: "Couldn't add batch", description: e.message, variant: "destructive" }),
  });

  const volumeNum = Number(volume);
  const kegNum = kegL ? Number(kegL) : null;
  const valid = recipeId && period && volumeNum > 0 && (kegNum == null || kegNum <= volumeNum);

  return (
    <div className="mt-4 border-t pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.2fr_1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Recipe</Label>
          <Select value={recipeId} onValueChange={setRecipeId}>
            <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
            <SelectContent>
              {recipes.length === 0 ? (
                <SelectItem value="__none" disabled>No active recipes</SelectItem>
              ) : (
                recipes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Target (L)</Label>
          <Input value={volume} onChange={(e) => setVolume(e.target.value.replace(/[^\d.]/g, ""))} placeholder="1000" inputMode="decimal" />
        </div>
        <div>
          <Label className="text-xs">Keg (L)</Label>
          <Input value={kegL} onChange={(e) => setKegL(e.target.value.replace(/[^\d.]/g, ""))} placeholder="optional" inputMode="decimal" />
        </div>
        <Button
          disabled={!valid || addMutation.isPending}
          onClick={() =>
            addMutation.mutate({
              planId,
              recipeId,
              period,
              targetVolumeL: volumeNum,
              // Keg volume given → remainder bottled. Omitted → BOM bottles all.
              kegVolumeL: kegNum,
              bottleVolumeL: kegNum != null ? Math.max(0, volumeNum - kegNum) : null,
            })
          }
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      {kegNum != null && kegNum > volumeNum && (
        <p className="text-xs text-red-600 mt-1">Keg volume can't exceed the target volume.</p>
      )}
    </div>
  );
}

// ─── Requirements panel ───────────────────────────────────────────────────────

type Requirement = {
  period: string;
  category: "additive" | "packaging";
  varietyId: string | null;
  name: string;
  unit: string;
  quantity: number;
  sources: number;
};

function RequirementsPanel({
  isLoading,
  requirements,
  warnings,
}: {
  isLoading: boolean;
  requirements: Requirement[];
  warnings: string[];
}) {
  // Group by period, then split additives vs packaging.
  const byPeriod = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    for (const r of requirements) {
      const list = map.get(r.period) ?? [];
      list.push(r);
      map.set(r.period, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [requirements]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" /> Inventory requirements
        </CardTitle>
        <CardDescription>
          Gross quantities each period needs, summed across every planned batch. On-hand
          comparison and a buy list come next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-0.5">
                {warnings.map((w, i) => <li key={i} className="text-xs">{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : byPeriod.length === 0 ? (
          <p className="text-sm text-gray-500">Add planned batches to see requirements.</p>
        ) : (
          byPeriod.map(([period, lines]) => {
            const additives = lines.filter((l) => l.category === "additive");
            const packaging = lines.filter((l) => l.category === "packaging");
            return (
              <div key={period}>
                <h3 className="font-semibold text-gray-900 mb-2">{formatPeriod(period)}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RequirementTable title="Additives" lines={additives} />
                  <RequirementTable title="Packaging" lines={packaging} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function RequirementTable({ title, lines }: { title: string; lines: Requirement[] }) {
  if (lines.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-1">{title}</h4>
        <p className="text-xs text-gray-400">None.</p>
      </div>
    );
  }
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-600 mb-1">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Batches</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={`${l.varietyId ?? "x"}-${l.name}-${i}`}>
              <TableCell>
                {l.name}
                {l.varietyId == null && (
                  <span className="ml-1 text-xs text-amber-600" title="Not linked to inventory">⚠</span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">{formatQty(l.quantity, l.unit)}</TableCell>
              <TableCell className="text-right text-gray-500">{l.sources}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
