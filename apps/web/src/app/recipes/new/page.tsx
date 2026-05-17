"use client";

/**
 * /recipes/new — create a new recipe.
 *
 * Wraps RecipeBuilder with create-mutation wiring + nav. Permission gating
 * is server-side; if a user without `recipe:create` lands here, the mutation
 * will return FORBIDDEN. We could add a client-side gate too, but the server
 * is the source of truth and this page is only linked from the +New button
 * (which is itself gated).
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { RecipeBuilder } from "@/components/recipes/RecipeBuilder";

export default function NewRecipePage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createMutation = trpc.recipes.create.useMutation({
    onSuccess: ({ id }) => {
      utils.recipes.list.invalidate();
      toast({
        title: "Recipe created",
        description: "Your recipe has been saved.",
      });
      router.push(`/recipes/${id}`);
    },
    onError: (e) => {
      toast({
        title: "Failed to create recipe",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/recipes">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to recipes
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New recipe</h1>
            <p className="text-sm text-muted-foreground">
              Define a scale-invariant recipe template. Rates are per liter of
              finished batch volume — the wizard scales them at instantiation.
            </p>
          </div>
        </div>

        <RecipeBuilder
          onSubmit={async (draft) => {
            await createMutation.mutateAsync(draft as any);
          }}
          onCancel={() => router.push("/recipes")}
          isSubmitting={createMutation.isPending}
          submitLabel="Create recipe"
        />
      </div>
    </div>
  );
}
