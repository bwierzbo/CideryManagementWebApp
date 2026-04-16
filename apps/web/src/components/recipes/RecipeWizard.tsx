"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Beaker,
  Droplets,
  FlaskConical,
  CheckCircle,
} from "lucide-react";

interface RecipeWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

const STYLES = [
  { value: "dry", label: "Dry", targetFG: "0.998", description: "Crisp, no residual sugar" },
  { value: "semi_dry", label: "Semi-Dry", targetFG: "1.005", description: "Slight sweetness" },
  { value: "semi_sweet", label: "Semi-Sweet", targetFG: "1.012", description: "Noticeable sweetness" },
  { value: "sweet", label: "Sweet", targetFG: "1.020", description: "Dessert-level sweetness" },
  { value: "sparkling", label: "Sparkling", targetFG: "0.998", description: "Carbonated, dry finish" },
  { value: "still", label: "Still", targetFG: "1.005", description: "No carbonation" },
];

const CATEGORIES = [
  { value: "traditional", label: "Traditional" },
  { value: "seasonal", label: "Seasonal" },
  { value: "experimental", label: "Experimental" },
  { value: "house_blend", label: "House Blend" },
  { value: "single_variety", label: "Single Variety" },
  { value: "fruit_wine", label: "Fruit Wine" },
  { value: "specialty", label: "Specialty" },
];

const YEAST_SUGGESTIONS: Record<string, string[]> = {
  dry: ["EC-1118 (Lalvin)", "D-47 (Lalvin)", "AB-1 (SafCider)"],
  semi_dry: ["D-47 (Lalvin)", "AB-1 (SafCider)", "71B (Lalvin)"],
  semi_sweet: ["71B (Lalvin)", "D-47 (Lalvin)"],
  sweet: ["71B (Lalvin)", "Sweet Mead (Lalvin)"],
  sparkling: ["EC-1118 (Lalvin)", "F2 (Lalvin)"],
  still: ["D-47 (Lalvin)", "AB-1 (SafCider)"],
};

interface Ingredient {
  fruitVarietyId: string;
  varietyName: string;
  percentage: number;
  role: string;
}

interface Additive {
  additiveVarietyId?: string;
  customName: string;
  amount: string;
  unit: string;
  timing: string;
}

export function RecipeWizard({ onClose, onSuccess }: RecipeWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1: Style & basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [category, setCategory] = useState("traditional");

  // Step 2: Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedVarietyId, setSelectedVarietyId] = useState("");

  // Step 3: Additives
  const [additives, setAdditives] = useState<Additive[]>([
    { customName: "Potassium Metabisulfite", amount: "50", unit: "ppm", timing: "pre_fermentation" },
  ]);
  const [suggestedYeast, setSuggestedYeast] = useState("");

  // Step 4: Targets
  const [targetOG, setTargetOG] = useState("1.050");
  const [estimatedDays, setEstimatedDays] = useState("21");
  const [notes, setNotes] = useState("");

  // Queries
  const varietiesQuery = trpc.vendorVariety.search.useQuery(
    { q: "", limit: 100 },
    { enabled: step === 2 },
  );
  const varieties = varietiesQuery.data?.varieties || [];

  const createRecipeMutation = trpc.recipes.create.useMutation({
    onSuccess: () => {
      toast({ title: "Recipe Created", description: `"${name}" saved successfully` });
      onSuccess();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const styleInfo = STYLES.find((s) => s.value === style);
  const targetFG = styleInfo?.targetFG || "1.000";
  const estimatedABV = targetOG && targetFG
    ? (((parseFloat(targetOG) - parseFloat(targetFG)) * 131.25).toFixed(1))
    : "0.0";

  const totalPercentage = ingredients.reduce((sum, i) => sum + i.percentage, 0);

  const addIngredient = () => {
    const variety = varieties.find((v: any) => v.id === selectedVarietyId);
    if (!variety) return;
    if (ingredients.some((i) => i.fruitVarietyId === selectedVarietyId)) {
      toast({ title: "Already added", variant: "destructive" });
      return;
    }
    setIngredients([
      ...ingredients,
      {
        fruitVarietyId: variety.id,
        varietyName: variety.name,
        percentage: Math.max(0, 100 - totalPercentage),
        role: "base",
      },
    ]);
    setSelectedVarietyId("");
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.fruitVarietyId !== id));
  };

  const updateIngredientPercentage = (id: string, pct: number) => {
    setIngredients(
      ingredients.map((i) =>
        i.fruitVarietyId === id ? { ...i, percentage: pct } : i,
      ),
    );
  };

  const addAdditive = () => {
    setAdditives([
      ...additives,
      { customName: "", amount: "", unit: "g", timing: "pre_fermentation" },
    ]);
  };

  const removeAdditive = (index: number) => {
    setAdditives(additives.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim() || !style || !category) {
      toast({ title: "Missing fields", description: "Name, style, and category are required", variant: "destructive" });
      return;
    }

    createRecipeMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      style: style as any,
      category: category as any,
      targetOG: targetOG ? parseFloat(targetOG) : undefined,
      targetFG: targetFG ? parseFloat(targetFG) : undefined,
      targetABV: estimatedABV ? parseFloat(estimatedABV) : undefined,
      estimatedFermentationDays: estimatedDays ? parseInt(estimatedDays) : undefined,
      suggestedYeast: suggestedYeast || undefined,
      notes: notes.trim() || undefined,
      ingredients: ingredients.map((i) => ({
        fruitVarietyId: i.fruitVarietyId,
        percentage: i.percentage,
        role: i.role,
      })),
      additives: additives
        .filter((a) => a.customName.trim())
        .map((a) => ({
          customAdditiveName: a.customName.trim(),
          amount: a.amount ? parseFloat(a.amount) : undefined,
          unit: a.unit || undefined,
          timing: a.timing || undefined,
        })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: "Style", icon: Beaker },
            { num: 2, label: "Varieties", icon: Droplets },
            { num: 3, label: "Additives", icon: FlaskConical },
            { num: 4, label: "Review", icon: CheckCircle },
          ].map(({ num, label, icon: Icon }) => (
            <button
              key={num}
              onClick={() => setStep(num)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === num
                  ? "bg-blue-600 text-white"
                  : step > num
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Style & Basics */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label>Recipe Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kingston Black Single Variety"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Cider Style *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    style === s.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                  <p className="text-xs text-blue-600 mt-1">Target FG: {s.targetFG}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Apple Varieties */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <Label>Select Apple Varieties</Label>
            <div className="flex gap-2 mt-2">
              <Select value={selectedVarietyId} onValueChange={setSelectedVarietyId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a variety..." />
                </SelectTrigger>
                <SelectContent>
                  {varieties
                    .filter((v: any) => !ingredients.some((i) => i.fruitVarietyId === v.id))
                    .map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={addIngredient} disabled={!selectedVarietyId}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {ingredients.length > 0 && (
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <Card key={ing.fruitVarietyId} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ing.varietyName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={ing.percentage}
                            onChange={(e) =>
                              updateIngredientPercentage(
                                ing.fruitVarietyId,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-20 h-7 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <Select
                          value={ing.role}
                          onValueChange={(val) =>
                            setIngredients(
                              ingredients.map((i) =>
                                i.fruitVarietyId === ing.fruitVarietyId
                                  ? { ...i, role: val }
                                  : i,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">Base</SelectItem>
                            <SelectItem value="accent">Accent</SelectItem>
                            <SelectItem value="tannin">Tannin</SelectItem>
                            <SelectItem value="acid">Acid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIngredient(ing.fruitVarietyId)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total: {totalPercentage.toFixed(0)}%
                </span>
                {Math.abs(totalPercentage - 100) > 0.1 && (
                  <span className="text-amber-600">
                    Should equal 100%
                  </span>
                )}
              </div>
            </div>
          )}

          {ingredients.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No varieties added yet. Select from your fruit inventory above.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Additives & Yeast */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label>Suggested Yeast</Label>
            {style && YEAST_SUGGESTIONS[style] && (
              <div className="flex flex-wrap gap-2 mt-2">
                {YEAST_SUGGESTIONS[style].map((yeast) => (
                  <button
                    key={yeast}
                    onClick={() => setSuggestedYeast(yeast)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      suggestedYeast === yeast
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {yeast}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={suggestedYeast}
              onChange={(e) => setSuggestedYeast(e.target.value)}
              placeholder="Or type a yeast name..."
              className="mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Additives</Label>
              <Button variant="outline" size="sm" onClick={addAdditive}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Additive
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {additives.map((add, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={add.customName}
                    onChange={(e) => {
                      const updated = [...additives];
                      updated[idx].customName = e.target.value;
                      setAdditives(updated);
                    }}
                    placeholder="Additive name"
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    value={add.amount}
                    onChange={(e) => {
                      const updated = [...additives];
                      updated[idx].amount = e.target.value;
                      setAdditives(updated);
                    }}
                    placeholder="Amount"
                    className="w-20 h-8 text-sm"
                  />
                  <Select
                    value={add.unit}
                    onValueChange={(val) => {
                      const updated = [...additives];
                      updated[idx].unit = val;
                      setAdditives(updated);
                    }}
                  >
                    <SelectTrigger className="w-16 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="g/L">g/L</SelectItem>
                      <SelectItem value="ppm">ppm</SelectItem>
                      <SelectItem value="mL">mL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={add.timing}
                    onValueChange={(val) => {
                      const updated = [...additives];
                      updated[idx].timing = val;
                      setAdditives(updated);
                    }}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre_fermentation">Pre-ferm</SelectItem>
                      <SelectItem value="during_fermentation">During</SelectItem>
                      <SelectItem value="post_fermentation">Post-ferm</SelectItem>
                      <SelectItem value="at_packaging">Packaging</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeAdditive(idx)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review & Targets */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{name || "Untitled Recipe"}</CardTitle>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{style?.replace("_", " ")}</Badge>
                <Badge variant="outline" className="capitalize">{category?.replace("_", " ")}</Badge>
                {suggestedYeast && <Badge variant="outline">{suggestedYeast}</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Target OG</Label>
                  <Input
                    value={targetOG}
                    onChange={(e) => setTargetOG(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Target FG</Label>
                  <p className="text-sm font-medium mt-2">{targetFG}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Est. ABV</Label>
                  <p className="text-sm font-medium mt-2">{estimatedABV}%</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Est. Fermentation Days</Label>
                <Input
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  type="number"
                  className="h-8 text-sm mt-1 w-24"
                />
              </div>

              {ingredients.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Varieties ({ingredients.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ingredients.map((i) => (
                      <Badge key={i.fruitVarietyId} variant="secondary" className="text-xs">
                        {i.varietyName} ({i.percentage}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {additives.filter((a) => a.customName).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Additives</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {additives.filter((a) => a.customName).map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {a.customName} {a.amount && `(${a.amount} ${a.unit})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this recipe..."
                  className="mt-1 min-h-[60px] text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createRecipeMutation.isPending || !name.trim() || !style}
            >
              {createRecipeMutation.isPending ? "Saving..." : "Save Recipe"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
