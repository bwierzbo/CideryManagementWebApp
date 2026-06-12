"use client";

/**
 * /recipes/[id]/edit — modify an existing recipe.
 *
 * Loads the current state via trpc.recipes.get, hands it to RecipeBuilder
 * as `initial`, and submits via trpc.recipes.update. Each save creates a
 * new version snapshot (handled server-side).
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import {
  RecipeBuilder,
  type RecipeDraft,
  type ProductType,
  type RecipeStatus,
  type InputKind,
  type StepKind,
  type TriggerKind,
  type PackagingPath,
} from "@/components/recipes/RecipeBuilder";

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params?.id as string;
  const utils = trpc.useUtils();

  const { data, isPending, error } = trpc.recipes.get.useQuery(
    { id: recipeId },
    { enabled: !!recipeId },
  );

  const updateMutation = trpc.recipes.update.useMutation({
    onSuccess: () => {
      utils.recipes.get.invalidate({ id: recipeId });
      utils.recipes.list.invalidate();
      utils.recipes.listVersions.invalidate({ recipeId });
      toast({ title: "Recipe saved" });
      router.push(`/recipes/${recipeId}`);
    },
    onError: (e) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Failed to load recipe</p>
          {error && <p className="text-sm text-gray-500 mt-1">{error.message}</p>}
          <Button asChild variant="outline" className="mt-4">
            <Link href="/recipes"><ArrowLeft className="w-4 h-4 mr-1" /> Back to recipes</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Hydrate the builder's draft shape from the server data
  const initial: RecipeDraft = {
    name: data.recipe.name,
    description: data.recipe.description,
    productType: data.recipe.productType as ProductType,
    status: (data.recipe.status === "archived" ? "draft" : data.recipe.status) as RecipeStatus,
    enabledSections: (data.recipe.enabledSections as Record<string, boolean>) ?? {},
    notes: data.recipe.notes,
    inputs: data.inputs.map((i, idx) => ({
      uiId: `existing-input-${i.id}`,
      kind: i.kind as InputKind,
      label: i.label,
      additiveType: i.additiveType,
      additiveName: i.additiveName,
      rateValue: i.rateValue !== null ? Number(i.rateValue) : null,
      rateUnit: i.rateUnit,
      sourceProductType: (i.sourceProductType as ProductType | null) ?? null,
      notes: i.notes,
    })),
    steps: data.steps.map((s) => ({
      uiId: `existing-step-${s.id}`,
      kind: s.kind as StepKind,
      label: s.label,
      description: s.description,
      triggerKind: s.triggerKind as TriggerKind,
      triggerData: (s.triggerData as Record<string, unknown>) ?? {},
      actionData: (s.actionData as Record<string, unknown>) ?? {},
      estimatedDurationHours: s.estimatedDurationHours !== null ? Number(s.estimatedDurationHours) : null,
      notes: s.notes,
      packagingPath: ((s as { packagingPath?: string }).packagingPath as PackagingPath) ?? "all",
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/recipes/${recipeId}`}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to recipe
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Edit: {data.recipe.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Saving creates version v{data.recipe.currentVersion + 1}.
              Previous versions are preserved.
            </p>
          </div>
        </div>

        <RecipeBuilder
          initial={initial}
          onSubmit={async (draft) => {
            await updateMutation.mutateAsync({
              id: recipeId,
              ...(draft as any),
            });
          }}
          onCancel={() => router.push(`/recipes/${recipeId}`)}
          isSubmitting={updateMutation.isPending}
          submitLabel={`Save as v${data.recipe.currentVersion + 1}`}
        />
      </div>
    </div>
  );
}
