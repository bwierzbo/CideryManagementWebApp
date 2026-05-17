"use client";

/**
 * Recipe library — the IP repository.
 *
 * Lists all recipes the current user is allowed to see (RBAC enforced
 * server-side). Filters by product type, status, and a search box. Clicking
 * a recipe routes to its detail view (`/recipes/[id]`). Authoring flows
 * (new, edit, archive) are gated by `recipe:create` / `recipe:update` /
 * `recipe:delete` permissions — UI hides the controls when the user lacks
 * the permission, but the server is the source of truth.
 */

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Search,
  Plus,
  Archive,
  RotateCcw,
  Eye,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { canWithOverrides } from "lib/src/rbac/roles";

const PRODUCT_TYPES = [
  { value: "all",     label: "All product types" },
  { value: "cider",   label: "Cider" },
  { value: "perry",   label: "Perry" },
  { value: "wine",    label: "Wine (fruit)" },
  { value: "cyser",   label: "Cyser" },
  { value: "pommeau", label: "Pommeau" },
  { value: "brandy",  label: "Brandy" },
  { value: "juice",   label: "Juice" },
  { value: "other",   label: "Other" },
] as const;

const STATUS_FILTERS = [
  { value: "all",    label: "All statuses" },
  { value: "draft",  label: "Draft" },
  { value: "active", label: "Active" },
] as const;

// Color-code the product type badge to match the rest of the app's styling.
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

export default function RecipesPage() {
  const { data: session } = useSession();
  const user = session?.user as
    | { role?: string; permissionOverrides?: Record<string, boolean> }
    | undefined;
  const role = (user?.role ?? "viewer") as "admin" | "operator" | "viewer";
  const overrides = user?.permissionOverrides ?? {};

  const canCreate  = canWithOverrides(role, "create", "recipe", overrides);
  const canArchive = canWithOverrides(role, "delete", "recipe", overrides);
  const canRestore = canWithOverrides(role, "update", "recipe", overrides);

  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const utils = trpc.useUtils();
  const { data, isPending, error } = trpc.recipes.list.useQuery({
    search: search.trim() || undefined,
    productType: productType === "all" ? undefined : (productType as any),
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    includeArchived,
    limit: 100,
    offset: 0,
  });

  const archiveMutation = trpc.recipes.archive.useMutation({
    onSuccess: () => utils.recipes.list.invalidate(),
  });
  const restoreMutation = trpc.recipes.restore.useMutation({
    onSuccess: () => utils.recipes.list.invalidate(),
  });

  const recipes = data?.items ?? [];

  // Summary stats — recomputed on the filtered set
  const summary = useMemo(() => {
    const byProduct = new Map<string, number>();
    let active = 0;
    let drafts = 0;
    for (const r of recipes) {
      byProduct.set(r.productType, (byProduct.get(r.productType) ?? 0) + 1);
      if (r.status === "active") active++;
      if (r.status === "draft")  drafts++;
    }
    return { total: recipes.length, active, drafts, byProductCount: byProduct.size };
  }, [recipes]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-8 h-8 text-amber-600 mr-3" />
              Recipe Library
            </h1>
            <p className="text-gray-600 mt-2">
              Your company&apos;s cidermaking IP. Browse, edit, and instantiate
              recipes onto specific batches.
            </p>
          </div>

          {canCreate && (
            <Button asChild>
              <Link href="/recipes/new">
                <Plus className="w-4 h-4 mr-2" />
                New Recipe
              </Link>
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Recipes shown" value={summary.total} />
          <SummaryCard label="Active" value={summary.active} />
          <SummaryCard label="Drafts" value={summary.drafts} />
          <SummaryCard label="Product types" value={summary.byProductCount} />
        </div>

        {/* Search + filters */}
        <Card className="mb-6">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="search" className="text-xs">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Recipe name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Product type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant={includeArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeArchived((v) => !v)}
                className="w-full"
              >
                <Archive className="w-3.5 h-3.5 mr-1.5" />
                {includeArchived ? "Including archived" : "Show archived"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Body */}
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium">Failed to load recipes</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            </CardContent>
          </Card>
        ) : isPending ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes found</h3>
              <p className="text-gray-600 mb-4">
                {search || productType !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Get started by creating your first recipe."}
              </p>
              {canCreate && (
                <Button asChild>
                  <Link href="/recipes/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Recipe
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {recipes.map((r) => {
              const isArchived = !!r.archivedAt;
              return (
                <Card
                  key={r.id}
                  className={
                    "hover:shadow-md transition-shadow " +
                    (isArchived ? "opacity-70" : "")
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/recipes/${r.id}`}
                        className="flex-1 group"
                      >
                        <CardTitle className="text-lg group-hover:text-blue-700 group-hover:underline cursor-pointer">
                          {r.name}
                        </CardTitle>
                        {r.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {r.description}
                          </CardDescription>
                        )}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={"text-xs " + productTypeBadgeClass(r.productType)}
                      >
                        {r.productType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={"text-xs " + statusBadgeClass(r.status)}
                      >
                        {r.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{r.currentVersion}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                      <span>
                        by {r.createdByName ?? "—"} ·{" "}
                        Updated {new Date(r.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/recipes/${r.id}`} title="View recipe">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                        {!isArchived && canArchive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Archive"
                            disabled={archiveMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Archive "${r.name}"?`)) {
                                archiveMutation.mutate({ id: r.id });
                              }
                            }}
                          >
                            <Archive className="w-3.5 h-3.5 text-gray-500" />
                          </Button>
                        )}
                        {isArchived && canRestore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Restore"
                            disabled={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate({ id: r.id })}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
