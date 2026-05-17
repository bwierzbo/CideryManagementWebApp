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

function describeTrigger(triggerKind: string, triggerData: any): string {
  switch (triggerKind) {
    case "manual":
      return "Manual — operator decides when";
    case "date_offset_from_start":
      return `Day ${triggerData?.days ?? "?"} from batch start`;
    case "date_offset_from_previous":
      return `${triggerData?.days ?? "?"} day(s) after previous step`;
    case "sg_threshold":
      return `When SG ${triggerData?.direction ?? "below"} ${triggerData?.sg ?? "?"}`;
    case "sg_terminal_confirmed":
      return "When terminal SG is confirmed";
    default:
      return triggerKind;
  }
}

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

  const [previewVolumeL, setPreviewVolumeL] = useState<number>(60);
  const [versionsOpen, setVersionsOpen] = useState(false);
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
  const isArchived = !!recipe.archivedAt;
  const ingredients = inputs.filter((i) => i.kind === "ingredient");
  const parentBatchInputs = inputs.filter((i) => i.kind === "parent_batch_requirement");

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
            <Button size="sm" disabled title="Coming in Phase 2 (batch wizard)">
              <Play className="w-4 h-4 mr-1" /> Use this recipe
            </Button>
          </div>
        </div>

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
                <div className="flex gap-1 ml-2">
                  {[20, 60, 120, 240, 1000].map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant={previewVolumeL === v ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPreviewVolumeL(v)}
                    >
                      {v}L
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
                            {ing.rateValue} {ing.rateUnit}
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
              <CardTitle className="text-base">Parent batch requirements</CardTitle>
              <CardDescription>
                This recipe must be instantiated on top of one or more existing batches.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {parentBatchInputs.map((p) => (
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
                        <p className="text-sm text-muted-foreground">
                          {p.rateValue} {p.rateUnit}
                        </p>
                        {p.rateUnit === "L/L" && (
                          <p className="text-sm font-semibold">
                            → {(Number(p.rateValue) * previewVolumeL).toFixed(1)} L
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {describeTrigger(s.triggerKind, s.triggerData)}
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
