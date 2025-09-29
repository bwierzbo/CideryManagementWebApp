"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  Clock,
  Beaker,
  Grape,
  Star,
  Eye,
} from "lucide-react";

// Mock recipe data - this would come from tRPC in a real implementation
const mockRecipes = [
  {
    id: "1",
    name: "Traditional Honeycrisp",
    description: "Classic single-variety cider with bright, crisp apple notes",
    category: "traditional",
    appleVarieties: ["Honeycrisp"],
    targetABV: 6.5,
    targetSG: 1.05,
    fermentationTime: 45,
    ingredients: [{ variety: "Honeycrisp", percentage: 100, pounds: 1000 }],
    steps: [
      {
        step: 1,
        type: "preparation",
        description: "Wash and sort apples, removing any damaged fruit",
        duration: 60,
      },
      {
        step: 2,
        type: "pressing",
        description: "Press apples to extract juice",
        duration: 120,
      },
      {
        step: 3,
        type: "fermentation",
        description: "Primary fermentation with wild yeast",
        duration: 2160,
      },
      {
        step: 4,
        type: "aging",
        description: "Secondary aging for clarity and flavor development",
        duration: 1440,
      },
    ],
    isPublic: true,
    createdBy: "admin",
    estimatedCost: 4.5,
    rating: 4.8,
  },
  {
    id: "2",
    name: "Autumn Blend",
    description: "Complex blend of heritage apples for rich, full flavor",
    category: "seasonal",
    appleVarieties: ["Northern Spy", "Granny Smith", "Gala"],
    targetABV: 7.2,
    targetSG: 1.055,
    fermentationTime: 60,
    ingredients: [
      { variety: "Northern Spy", percentage: 50, pounds: 500 },
      { variety: "Granny Smith", percentage: 30, pounds: 300 },
      { variety: "Gala", percentage: 20, pounds: 200 },
    ],
    steps: [
      {
        step: 1,
        type: "preparation",
        description: "Wash and sort all apple varieties separately",
        duration: 90,
      },
      {
        step: 2,
        type: "pressing",
        description: "Press varieties in sequence, blend juices",
        duration: 180,
      },
      {
        step: 3,
        type: "fermentation",
        description: "Primary fermentation with champagne yeast",
        duration: 2880,
      },
      {
        step: 4,
        type: "aging",
        description: "Extended aging on lees for complexity",
        duration: 2160,
      },
    ],
    isPublic: true,
    createdBy: "admin",
    estimatedCost: 5.25,
    rating: 4.9,
  },
  {
    id: "3",
    name: "Experimental Batch #7",
    description: "Testing new yeast strain with Granny Smith base",
    category: "experimental",
    appleVarieties: ["Granny Smith"],
    targetABV: 8.0,
    targetSG: 1.06,
    fermentationTime: 35,
    ingredients: [{ variety: "Granny Smith", percentage: 100, pounds: 800 }],
    steps: [
      {
        step: 1,
        type: "preparation",
        description: "Standard prep with extended maceration",
        duration: 120,
      },
      {
        step: 2,
        type: "pressing",
        description: "Cold press to preserve aromatics",
        duration: 90,
      },
      {
        step: 3,
        type: "fermentation",
        description: "Experimental strain EC-1118 at 65°F",
        duration: 1680,
      },
    ],
    isPublic: false,
    createdBy: "operator",
    estimatedCost: 6.0,
    rating: 0,
  },
];

export default function RecipesPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<
    (typeof mockRecipes)[0] | null
  >(null);

  // Filter recipes based on search and category
  const filteredRecipes = mockRecipes.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.appleVarieties.some((variety) =>
        variety.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesCategory =
      categoryFilter === "all" || recipe.category === categoryFilter;

    // Role-based filtering
    const canView = (session?.user as any)?.role === "admin" || recipe.isPublic;

    return matchesSearch && matchesCategory && canView;
  });

  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BookOpen className="w-8 h-8 text-amber-600 mr-3" />
                Recipe Management
              </h1>
              <p className="text-gray-600 mt-2">
                Create and manage your cider recipes
              </p>
            </div>

            {isAdmin && (
              <Button
                className="flex items-center"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Recipe
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Recipes
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {filteredRecipes.length}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Apple Varieties
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {
                      new Set(filteredRecipes.flatMap((r) => r.appleVarieties))
                        .size
                    }
                  </p>
                </div>
                <Grape className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg ABV</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(
                      filteredRecipes.reduce((sum, r) => sum + r.targetABV, 0) /
                      filteredRecipes.length
                    ).toFixed(1)}
                    %
                  </p>
                </div>
                <Beaker className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Cost</p>
                  <p className="text-3xl font-bold text-gray-900">
                    $
                    {(
                      filteredRecipes.reduce(
                        (sum, r) => sum + r.estimatedCost,
                        0,
                      ) / filteredRecipes.length
                    ).toFixed(2)}
                  </p>
                </div>
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <span className="text-amber-600 font-bold text-lg">$</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search Recipes</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by name, description, or apple variety..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="lg:w-48">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="traditional">Traditional</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="experimental">Experimental</SelectItem>
                    <SelectItem value="house_blend">House Blend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{recipe.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {recipe.description}
                    </CardDescription>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle edit
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle delete
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      recipe.category === "experimental"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {recipe.category.replace("_", " ")}
                  </Badge>
                  {recipe.rating > 0 && (
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                      <span className="text-sm font-medium">
                        {recipe.rating}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Varieties:</span>
                    <span className="font-medium">
                      {recipe.appleVarieties.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Target ABV:</span>
                    <span className="font-medium">{recipe.targetABV}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ferment Time:</span>
                    <span className="font-medium flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {recipe.fermentationTime} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Cost:</span>
                    <span className="font-medium">
                      ${recipe.estimatedCost}/bottle
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    {recipe.isPublic ? "Public" : "Private"} • by{" "}
                    {recipe.createdBy}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No recipes found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || categoryFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by creating your first recipe."}
              </p>
              {isAdmin && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Recipe
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recipe Detail Modal (simplified for demo) */}
        {selectedRecipe && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">
                      {selectedRecipe.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {selectedRecipe.description}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRecipe(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {selectedRecipe.targetABV}%
                    </div>
                    <div className="text-sm text-gray-600">Target ABV</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {selectedRecipe.fermentationTime}
                    </div>
                    <div className="text-sm text-gray-600">Days to Ferment</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      ${selectedRecipe.estimatedCost}
                    </div>
                    <div className="text-sm text-gray-600">Cost per Bottle</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Ingredients</h3>
                  <div className="space-y-2">
                    {selectedRecipe.ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="font-medium">
                          {ingredient.variety}
                        </span>
                        <span>
                          {ingredient.percentage}% ({ingredient.pounds} lbs)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Process Steps</h3>
                  <div className="space-y-3">
                    {selectedRecipe.steps.map((step) => (
                      <div
                        key={step.step}
                        className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium capitalize">
                              {step.type}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {step.duration} min
                            </span>
                          </div>
                          <p className="text-gray-700">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRecipe(null)}
                  >
                    Close
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="outline">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Recipe
                      </Button>
                      <Button>Apply to Batch</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
