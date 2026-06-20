"use client";

/**
 * /recipes/[id] — recipe detail view.
 *
 * Shows the current version of a recipe with:
 *   - Basics, status, version
 *   - Volume-scaling preview (drag the slider to see ingredient amounts at
 *     any batch size — this is the whole point of scale-invariant rates)
 *   - Ingredients list
 *   - Parent batch requirements
 *   - Process steps in order
 *   - Version history (collapsible)
 *   - Action buttons: Edit / Clone / Archive / Restore (RBAC-gated)
 *   - "Use this recipe" CTA — placeholder until Phase 2 ships the wizard
 */

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Pencil,
  Copy,
  Archive,
  RotateCcw,
  Play,
  History,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { canWithOverrides } from "lib/src/rbac/roles";
import { computeScaledAmount } from "lib/src/recipes/scaling";
import { computeRecipeBOM, recipeRowsToBomInput } from "lib/src/recipes/bom";
import { computeRecipeLabor } from "lib/src/recipes/labor";
import { RecipeInstantiateWizard } from "@/components/recipes/RecipeInstantiateWizard";
import { computeBranchAwareOffsets, summarizeStepTrigger } from "lib/src/recipes/triggers";

// Color helpers (mirrored from the list page)
function productTypeBadgeClass(productType: string): string {
  switch (productType) {
    case "cider":   return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "perry":   return "bg-green-100 text-green-700 border-green-200";
    case "wine":    return "bg-rose-100 text-rose-700 border-rose-200";
    case "cyser":   return "bg-amber-100 text-amber-700 border-amber-200";
    case "pommeau": return "bg-orange-100 text-orange-700 border-orange-200";
    case "brandy":  return "bg-red-100 text-red-700 border-red-200";
    case "juice":   return "bg-blue-100 text-blue-700 border-blue-200";
    default:        return "bg-gray-100 text-gray-700 border-gray-200";
  }
}
function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":   return "bg-green-100 text-green-800 border-green-200";
    case "draft":    return "bg-gray-100 text-gray-700 border-gray-200";
    case "archived": return "bg-slate-200 text-slate-600 border-slate-300";
    default:         return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// Scaling logic moved to packages/lib/src/recipes/scaling.ts so it can be
// unit-tested and reused by the Phase 2 batch wizard.

const STEP_KIND_LABEL: Record<string, string> = {
  pitch_yeast:  "Pitch yeast",
  add_additive: "Add additive",
  measurement:  "Take measurement",
  rack:         "Rack",
  filter:       "Filter",
  transfer:     "Transfer / blend",
  carbonate:    "Carbonate",
  package:      "Package",
  pasteurize:   "Pasteurize",
  label:        "Label",
  wait:         "Wait / age",
  qa_gate:      "QA gate",
  note:         "Note",
};

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params?.id as string;
  const { data: session } = useSession();
  const user = session?.user as
    | { role?: string; permissionOverrides?: Record<string, boolean> }
    | undefined;
  const role = (user?.role ?? "viewer") as "admin" | "operator" | "viewer";
  const overrides = user?.permissionOverrides ?? {};

  const canEdit    = canWithOverrides(role, "update", "recipe", overrides);
  const canCreate  = canWithOverrides(role, "create", "recipe", overrides);
  const canArchive = canWithOverrides(role, "delete", "recipe", overrides);

  const utils = trpc.useUtils();
  const { data, isPending, error } = trpc.recipes.get.useQuery(
    { id: recipeId },
    { enabled: !!recipeId },
  );
  const { data: versions } = trpc.recipes.listVersions.useQuery(
    { recipeId },
    { enabled: !!recipeId },
  );

  const [previewVolumeL, setPreviewVolumeL] = useState<number>(120);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");

  const archiveMutation = trpc.recipes.archive.useMutation({
    onSuccess: () => {
      utils.recipes.get.invalidate({ id: recipeId });
      utils.recipes.list.invalidate();
      toast({ title: "Recipe archived" });
    },
    onError: (e) => toast({ title: "Archive failed", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = trpc.recipes.restore.useMutation({
    onSuccess: () => {
      utils.recipes.get.invalidate({ id: recipeId });
      utils.recipes.list.invalidate();
      toast({ title: "Recipe restored" });
    },
    onError: (e) => toast({ title: "Restore failed", description: e.message, variant: "destructive" }),
  });

  const cloneMutation = trpc.recipes.clone.useMutation({
    onSuccess: ({ id }) => {
      utils.recipes.list.invalidate();
      toast({ title: "Recipe cloned" });
      router.push(`/recipes/${id}`);
    },
    onError: (e) => toast({ title: "Clone failed", description: e.message, variant: "destructive" }),
  });

  // ── Loading / error / not-found states ──────────────────────────────────
  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Failed to load recipe</p>
          <p className="text-sm text-gray-500 mt-1">{error.message}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/recipes"><ArrowLeft className="w-4 h-4 mr-1" /> Back to recipes</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { recipe, inputs, steps } = data;
  const stepCumulativeHours = computeBranchAwareOffsets(
    steps.map((s) => ({
      triggerKind: s.triggerKind,
      triggerData: s.triggerData as Record<string, unknown>,
      packagingPath: s.packagingPath,
    })),
  );
  const isArchived = !!recipe.archivedAt;
  const ingredients = inputs.filter((i) => i.kind === "ingredient");
  const parentBatchInputs = inputs.filter((i) => i.kind === "parent_batch_requirement");
  // Blend ratio: components measured in "parts" or "%" share the batch volume by
  // their proportion of the total (works whether parts sum to anything or % sum
  // to 100).
  const isRatioUnit = (u: string | null) => u === "parts" || u === "%";
  const ratioInputs = parentBatchInputs.filter((p) => isRatioUnit(p.rateUnit));
  const parentRatioTotal = ratioInputs.reduce((s, p) => s + (Number(p.rateValue) || 0), 0);
  const isBlend = ratioInputs.length > 1;

  // Bill of materials for the previewed batch size. Kegs are returnable
  // vessels (keg tracker), not consumables, so the BOM previews the full batch
  // as bottled; the real bottle/keg split is set per planned batch in Planning.
  const bom = computeRecipeBOM(
    recipeRowsToBomInput(inputs, steps, { targetVolumeL: previewVolumeL }),
  );
  // Labor rollup — sum of per-task estimates, grouped by packaging path.
  const labor = computeRecipeLabor(steps);
  const fmtHours = (h: number) =>
    h === 0 ? "0 h" : `${h.toFixed(h < 10 ? 2 : 1).replace(/\.0+$/, "")} h`;
  const fmtQty = (q: number, unit: string) => {
    if (unit === "g" && q >= 1000) return `${(q / 1000).toFixed(2)} kg`;
    if (unit === "mL" && q >= 1000) return `${(q / 1000).toFixed(2)} L`;
    if (unit === "units") return `${q.toLocaleString()}`;
    return `${q >= 10 ? Math.round(q).toLocaleString() : q.toFixed(2)} ${unit}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Back + actions row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/recipes">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to recipes
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && !isArchived && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/recipes/${recipeId}/edit`}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCloneName(`${recipe.name} (copy)`);
                  setCloneDialogOpen(true);
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Clone
              </Button>
            )}
            {canArchive && !isArchived && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Archive "${recipe.name}"?`)) {
                    archiveMutation.mutate({ id: recipeId });
                  }
                }}
              >
                <Archive className="w-4 h-4 mr-1" /> Archive
              </Button>
            )}
            {canEdit && isArchived && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreMutation.mutate({ id: recipeId })}
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Restore
              </Button>
            )}
            {!isArchived && (
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Play className="w-4 h-4 mr-1" /> Use this recipe
              </Button>
            )}
          </div>
        </div>

        <RecipeInstantiateWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          recipe={{ id: recipe.id, name: recipe.name, productType: recipe.productType }}
          inputs={inputs}
          steps={steps}
        />

        {/* Recipe header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-2xl">{recipe.name}</CardTitle>
                {recipe.description && (
                  <CardDescription className="mt-2">{recipe.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={"text-xs " + productTypeBadgeClass(recipe.productType)}>
                  {recipe.productType}
                </Badge>
                <Badge variant="outline" className={"text-xs " + statusBadgeClass(recipe.status)}>
                  {recipe.status}
                </Badge>
                <Badge variant="outline" className="text-xs">v{recipe.currentVersion}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Last updated {new Date(recipe.updatedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Volume scaling preview */}
        {ingredients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scale preview</CardTitle>
              <CardDescription>
                See ingredient amounts at any batch size. Rates below are
                multiplied by this volume.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Batch volume:</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={previewVolumeL}
                  onChange={(e) => setPreviewVolumeL(Math.max(1, Number(e.target.value) || 1))}
                  className="w-32"
                />
                <span className="text-sm">L</span>
                <div className="flex gap-1 ml-2 flex-wrap">
                  {[
                    { l: 20, note: "Carboy" },
                    { l: 120, note: "Barrel" },
                    { l: 240 },
                    { l: 350, note: "3 BBL brite tank" },
                    { l: 360 },
                    { l: 1000 },
                  ].map(({ l, note }) => (
                    <Button
                      key={l}
                      type="button"
                      title={note}
                      variant={previewVolumeL === l ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPreviewVolumeL(l)}
                    >
                      {l}L
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingredients</CardTitle>
              <CardDescription>
                Scaled to {previewVolumeL}L batch volume
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {ingredients.map((ing) => {
                const scaled = computeScaledAmount(
                  ing.rateValue ? Number(ing.rateValue) : null,
                  ing.rateUnit,
                  previewVolumeL,
                );
                return (
                  <div key={ing.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{ing.label}</p>
                      {ing.additiveType && (
                        <p className="text-xs text-muted-foreground">{ing.additiveType}</p>
                      )}
                      {ing.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">{ing.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {ing.rateValue !== null && ing.rateUnit && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {Number(ing.rateValue).toFixed(1)} {ing.rateUnit}
                          </p>
                          {scaled && (
                            <p className="text-base font-semibold">
                              → {scaled.amount} {scaled.unit}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Parent batch requirements */}
        {parentBatchInputs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isBlend ? "Base cider blend" : "Parent batch requirements"}</CardTitle>
              <CardDescription>
                {isBlend
                  ? `Blended from these base ciders by ratio → ${previewVolumeL}L batch.`
                  : "This recipe must be instantiated on top of one or more existing batches."}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {parentBatchInputs.map((p) => {
                const val = Number(p.rateValue) || 0;
                const isRatio = isRatioUnit(p.rateUnit) && parentRatioTotal > 0;
                const pct = isRatio ? (val / parentRatioTotal) * 100 : null;
                const liters = isRatio ? (val / parentRatioTotal) * previewVolumeL : null;
                return (
                  <div key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sourceProductType ?? "any"} batch
                        </p>
                        {p.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">{p.notes}</p>
                        )}
                      </div>
                      {p.rateValue !== null && p.rateUnit && (
                        <div className="text-right">
                          {isRatio ? (
                            <>
                              <p className="text-sm text-muted-foreground">
                                {p.rateUnit === "%"
                                  ? `${val}%`
                                  : `${val} ${val === 1 ? "part" : "parts"} · ${pct!.toFixed(0)}%`}
                              </p>
                              <p className="text-sm font-semibold">→ {liters!.toFixed(1)} L</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground">
                                {Number(p.rateValue).toFixed(1)} {p.rateUnit}
                              </p>
                              {p.rateUnit === "L/L" && (
                                <p className="text-sm font-semibold">
                                  → {(Number(p.rateValue) * previewVolumeL).toFixed(1)} L
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Process steps */}
        {steps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Process steps</CardTitle>
              <CardDescription>
                Ordered. Each step's trigger determines when it fires in the schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.map((s, i) => (
                <div key={s.id} className="flex gap-3 p-3 border rounded-md bg-gray-50/50">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm">{s.label}</p>
                      <Badge variant="outline" className="text-xs">
                        {STEP_KIND_LABEL[s.kind] ?? s.kind}
                      </Badge>
                      {s.packagingPath && s.packagingPath !== "all" && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            s.packagingPath === "bottle"
                              ? "border-blue-300 text-blue-700"
                              : "border-amber-300 text-amber-700"
                          }`}
                        >
                          {s.packagingPath === "bottle" ? "Bottle only" : "Keg only"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {summarizeStepTrigger(
                        { triggerKind: s.triggerKind, triggerData: s.triggerData as Record<string, unknown> },
                        stepCumulativeHours[i],
                      )}
                      {s.estimatedDurationHours
                        ? ` · est. ${s.estimatedDurationHours}h`
                        : ""}
                    </p>
                    {s.description && (
                      <p className="text-sm mt-1">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Bill of materials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill of materials</CardTitle>
            <CardDescription>
              Consumables for a {previewVolumeL}L batch, previewed as fully bottled.
              Adjust the batch size above. Kegs are returnable vessels, not
              consumables — the bottle/keg split is set per planned batch in Planning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Additives
                </h4>
                {bom.additives.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">None.</p>
                ) : (
                  <ul className="space-y-1">
                    {bom.additives.map((l, idx) => (
                      <li key={idx} className="flex justify-between text-sm gap-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{l.name}</span>
                          {!l.varietyId && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                              unlinked
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono shrink-0">{fmtQty(l.quantity, l.unit)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Packaging
                </h4>
                {bom.packaging.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    None — add a Package step with a container size.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {bom.packaging.map((l, idx) => (
                      <li key={idx} className="flex justify-between text-sm gap-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{l.name}</span>
                          {!l.varietyId && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                              unlinked
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono shrink-0">{fmtQty(l.quantity, l.unit)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {bom.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
                {bom.warnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Labor estimate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labor</CardTitle>
            <CardDescription>
              Sum of the per-task labor estimates entered on the steps. Per-task
              hours only — these don&apos;t yet scale with batch size.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{fmtHours(labor.totalHours)}</span>
              <span className="text-sm text-muted-foreground">estimated per batch</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex justify-between gap-2">
                <span className="text-gray-500">Shared</span>
                <span className="font-mono">{fmtHours(labor.byPath.all)}</span>
              </span>
              <span className="flex justify-between gap-2">
                <span className="text-gray-500">Bottle path</span>
                <span className="font-mono">{fmtHours(labor.byPath.bottle)}</span>
              </span>
              <span className="flex justify-between gap-2">
                <span className="text-gray-500">Keg path</span>
                <span className="font-mono">{fmtHours(labor.byPath.keg)}</span>
              </span>
            </div>
            {labor.stepsMissingEstimate > 0 && (
              <p className="text-xs text-amber-700 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {labor.stepsMissingEstimate} step{labor.stepsMissingEstimate === 1 ? "" : "s"} have
                no labor estimate yet — add one on each step to complete the total.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {recipe.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{recipe.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Version history (collapsible) */}
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setVersionsOpen((v) => !v)}
              className="flex items-center gap-2 text-left w-full hover:bg-gray-50 -m-2 p-2 rounded"
            >
              {versionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <History className="w-4 h-4" />
              <CardTitle className="text-base">
                Version history ({versions?.length ?? 0})
              </CardTitle>
            </button>
          </CardHeader>
          {versionsOpen && (
            <CardContent className="divide-y">
              {(!versions || versions.length === 0) && (
                <p className="text-sm text-muted-foreground italic py-2">
                  No versions yet.
                </p>
              )}
              {versions?.map((v) => (
                <div key={v.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                      {v.version === recipe.currentVersion && (
                        <Badge className="text-xs bg-green-100 text-green-800 border-green-200">current</Badge>
                      )}
                    </div>
                    {v.changeSummary && (
                      <p className="text-sm mt-1">{v.changeSummary}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    <p>{v.createdByName ?? "—"}</p>
                    <p>{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Clone dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone recipe</DialogTitle>
            <DialogDescription>
              Creates a new draft recipe with the same ingredients and steps.
              You can edit the copy without affecting the original.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>New recipe name</Label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="e.g. Strawberry Rhubarb v2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (cloneName.trim()) {
                  cloneMutation.mutate({ sourceId: recipeId, newName: cloneName.trim() });
                  setCloneDialogOpen(false);
                }
              }}
              disabled={!cloneName.trim() || cloneMutation.isPending}
            >
              {cloneMutation.isPending ? "Cloning…" : "Clone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
