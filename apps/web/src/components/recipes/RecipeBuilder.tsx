"use client";

/**
 * Recipe builder form — single-page, checklist-driven.
 *
 * The "What's in this recipe?" panel at the top toggles which sections of
 * the form appear below. Operator picks only the sections they need (e.g.,
 * a simple "blend hopped cider" recipe doesn't need carbonation/packaging
 * sections; a full-pipeline recipe does).
 *
 * Used by:
 *   - /recipes/new           (create flow)
 *   - /recipes/[id]/edit     (update flow — task #24)
 *
 * State is local; submit calls trpc.recipes.create or trpc.recipes.update
 * via the `onSubmit` prop. Parent owns navigation on success.
 */

import { useState, useEffect } from "react";
import { calculatePU } from "lib";
import { trpc } from "@/utils/trpc";
import { useOrganizationSettings } from "@/contexts/SettingsContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Pencil,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProductType =
  | "juice" | "cider" | "perry" | "wine" | "cyser" | "brandy" | "pommeau" | "other";

export type RecipeStatus = "draft" | "active";

export type InputKind =
  | "ingredient"
  | "parent_batch_requirement"
  | "press_run_requirement"
  | "juice_purchase_requirement";

export type StepKind =
  | "pitch_yeast" | "add_additive" | "measurement" | "rack" | "filter"
  | "transfer" | "carbonate" | "package" | "pasteurize" | "label"
  | "wait" | "qa_gate" | "note";

export type TriggerKind =
  | "date_offset_from_start"
  | "date_offset_from_previous"
  | "after_previous"
  | "sg_threshold"
  | "sg_terminal_confirmed"
  | "manual";

/** Which packaging format(s) a step applies to. */
export type PackagingPath = "all" | "bottle" | "keg";

export interface RecipeInputDraft {
  /** Local-only id used for React keys. Not sent to the API. */
  uiId: string;
  kind: InputKind;
  label: string;
  additiveType?: string | null;
  additiveName?: string | null;
  rateValue?: number | null;
  rateUnit?: string | null;
  sourceProductType?: ProductType | null;
  notes?: string | null;
}

export interface RecipeStepDraft {
  uiId: string;
  kind: StepKind;
  label: string;
  description?: string | null;
  triggerKind: TriggerKind;
  triggerData: Record<string, unknown>;
  actionData: Record<string, unknown>;
  estimatedDurationHours?: number | null;
  notes?: string | null;
  packagingPath: PackagingPath;
}

export interface RecipeDraft {
  name: string;
  description?: string | null;
  productType: ProductType;
  status: RecipeStatus;
  enabledSections: Record<string, boolean>;
  notes?: string | null;
  inputs: RecipeInputDraft[];
  steps: RecipeStepDraft[];
}

interface RecipeBuilderProps {
  initial?: RecipeDraft;
  onSubmit: (
    draft: Omit<RecipeDraft, "inputs" | "steps"> & {
      inputs: Array<Omit<RecipeInputDraft, "uiId"> & { sortOrder: number }>;
      steps: Array<Omit<RecipeStepDraft, "uiId"> & { sequence: number }>;
      changeSummary?: string | null;
    },
  ) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "cider",   label: "Cider" },
  { value: "perry",   label: "Perry" },
  { value: "wine",    label: "Wine (fruit)" },
  { value: "cyser",   label: "Cyser" },
  { value: "pommeau", label: "Pommeau" },
  { value: "brandy",  label: "Brandy" },
  { value: "juice",   label: "Juice" },
  { value: "other",   label: "Other" },
];

const ADDITIVE_TYPES = [
  "Fermentation Organisms", "Sugar & Sweeteners", "Fruit/Fruit Product",
  "Flavorings & Adjuncts", "Enzymes", "Nutrients", "Acids",
  "Tannins & Mouthfeel", "Preservatives",
];

const RATE_UNITS = ["g/L", "kg/L", "mL/L", "L/L", "ppm", "%v/v"];

const STEP_KINDS: { value: StepKind; label: string }[] = [
  { value: "pitch_yeast",  label: "Pitch yeast / fermentation organism" },
  { value: "add_additive", label: "Add additive" },
  { value: "measurement",  label: "Take measurement" },
  { value: "rack",         label: "Rack" },
  { value: "filter",       label: "Filter" },
  { value: "transfer",     label: "Transfer / blend" },
  { value: "carbonate",    label: "Carbonate" },
  { value: "package",      label: "Package (bottle / keg)" },
  { value: "pasteurize",   label: "Pasteurize" },
  { value: "label",        label: "Label" },
  { value: "wait",         label: "Wait / age" },
  { value: "qa_gate",      label: "QA gate (operator confirms)" },
  { value: "note",         label: "Note / instruction" },
];

const PACKAGING_PATHS: { value: PackagingPath; label: string; short: string }[] = [
  { value: "all",    label: "All packaging (always runs)", short: "All packaging" },
  { value: "bottle", label: "Bottle only",                 short: "Bottle only" },
  { value: "keg",    label: "Keg only",                    short: "Keg only" },
];

const TRIGGER_KINDS: { value: TriggerKind; label: string }[] = [
  { value: "manual",                    label: "Manual (operator decides when)" },
  { value: "after_previous",            label: "Immediately after previous step" },
  { value: "date_offset_from_previous", label: "N days/hours after previous step" },
  { value: "date_offset_from_start",    label: "N days from batch start" },
  { value: "sg_threshold",              label: "When SG crosses a value" },
  { value: "sg_terminal_confirmed",     label: "When terminal SG is confirmed" },
];

// Sections shown via the "What's in this recipe?" checklist
const SECTIONS = [
  { key: "ingredients",       label: "Ingredients",                    desc: "Additives like yeast, fruit, sugar, brandy" },
  { key: "parent_batch",      label: "Parent batch input",             desc: "This recipe starts from another batch (e.g., base cider)" },
  { key: "process_steps",     label: "Process steps",                  desc: "Ordered fermentation / racking / packaging steps" },
  { key: "carbonation_plan",  label: "Carbonation plan",               desc: "Forced or natural carbonation" },
  { key: "packaging_plan",    label: "Packaging plan",                 desc: "Bottle / keg / format" },
  { key: "pasteurization",    label: "Pasteurization",                 desc: "Pasteurize step + parameters" },
  { key: "labeling",          label: "Labeling",                       desc: "Label application" },
];

// ─── Default draft ──────────────────────────────────────────────────────────

const EMPTY_DRAFT: RecipeDraft = {
  name: "",
  description: "",
  productType: "cider",
  status: "draft",
  enabledSections: { ingredients: true, process_steps: true },
  notes: "",
  inputs: [],
  steps: [],
};

let _uid = 0;
const uid = () => `tmp-${++_uid}`;

// ─── Component ──────────────────────────────────────────────────────────────

export function RecipeBuilder({
  initial,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}: RecipeBuilderProps) {
  const [draft, setDraft] = useState<RecipeDraft>(initial ?? EMPTY_DRAFT);
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Which rows (by uiId) are open for editing. Rows not in this set render as
  // a compact, read-only summary. Newly added rows are opened automatically;
  // rows hydrated from `initial` start collapsed.
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const setEditing = (uiId: string, on: boolean) =>
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(uiId);
      else next.delete(uiId);
      return next;
    });

  const sectionOn = (key: string) => !!draft.enabledSections[key];
  const toggleSection = (key: string) => {
    setDraft((d) => ({
      ...d,
      enabledSections: { ...d.enabledSections, [key]: !d.enabledSections[key] },
    }));
  };

  const setField = <K extends keyof RecipeDraft>(field: K, value: RecipeDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  // ── Inputs (ingredients + parent batch req) ─────────────────────────────
  const addIngredient = () => {
    const uiId = uid();
    setDraft((d) => ({
      ...d,
      inputs: [
        ...d.inputs,
        {
          uiId,
          kind: "ingredient",
          label: "",
          additiveType: null,
          additiveName: null,
          rateValue: null,
          rateUnit: "g/L",
          notes: null,
        },
      ],
    }));
    setEditing(uiId, true);
  };

  const addParentBatchRequirement = () => {
    const uiId = uid();
    setDraft((d) => ({
      ...d,
      inputs: [
        ...d.inputs,
        {
          uiId,
          kind: "parent_batch_requirement",
          label: "Base batch",
          sourceProductType: "cider",
          rateValue: null,
          rateUnit: "L/L",
          notes: null,
        },
      ],
    }));
    setEditing(uiId, true);
  };

  const updateInput = (uiId: string, patch: Partial<RecipeInputDraft>) => {
    setDraft((d) => ({
      ...d,
      inputs: d.inputs.map((i) => (i.uiId === uiId ? { ...i, ...patch } : i)),
    }));
  };

  const removeInput = (uiId: string) => {
    setDraft((d) => ({ ...d, inputs: d.inputs.filter((i) => i.uiId !== uiId) }));
  };

  // ── Steps ────────────────────────────────────────────────────────────────
  const addStep = () => {
    const uiId = uid();
    setDraft((d) => ({
      ...d,
      steps: [
        ...d.steps,
        {
          uiId,
          kind: "wait",
          label: "",
          triggerKind: "manual",
          triggerData: {},
          actionData: {},
          notes: null,
          packagingPath: "all",
        },
      ],
    }));
    setEditing(uiId, true);
  };

  const updateStep = (uiId: string, patch: Partial<RecipeStepDraft>) => {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.uiId === uiId ? { ...s, ...patch } : s)),
    }));
  };

  const removeStep = (uiId: string) => {
    setDraft((d) => ({ ...d, steps: d.steps.filter((s) => s.uiId !== uiId) }));
  };

  const moveStep = (uiId: string, direction: "up" | "down") => {
    setDraft((d) => {
      const idx = d.steps.findIndex((s) => s.uiId === uiId);
      if (idx === -1) return d;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= d.steps.length) return d;
      const next = [...d.steps];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return { ...d, steps: next };
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!draft.name.trim()) {
      setError("Recipe name is required");
      return;
    }

    // Validation: every step must have a label
    for (const s of draft.steps) {
      if (!s.label.trim()) {
        setError("Every process step needs a label");
        return;
      }
    }

    // Validation: every input must have a label
    for (const i of draft.inputs) {
      if (!i.label.trim()) {
        setError("Every ingredient / input needs a label");
        return;
      }
    }

    try {
      // Strip uiId, attach sortOrder/sequence for the API
      const inputs = draft.inputs.map(({ uiId: _, ...rest }, idx) => ({
        ...rest,
        sortOrder: idx,
      }));
      const steps = draft.steps.map(({ uiId: _, ...rest }, idx) => ({
        ...rest,
        sequence: idx,
      }));

      await onSubmit({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        productType: draft.productType,
        status: draft.status,
        enabledSections: draft.enabledSections,
        notes: draft.notes?.trim() || null,
        inputs,
        steps,
        changeSummary: changeSummary.trim() || null,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to save recipe");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Basics ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recipe basics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Recipe name *</Label>
            <Input
              value={draft.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Strawberry Rhubarb"
              required
            />
          </div>
          <div>
            <Label>Product type *</Label>
            <Select
              value={draft.productType}
              onValueChange={(v) => setField("productType", v as ProductType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setField("status", v as RecipeStatus)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (not yet usable in batches)</SelectItem>
                <SelectItem value="active">Active (available for instantiation)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="What this recipe is, who it's for, any context"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section checklist ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s in this recipe?</CardTitle>
          <CardDescription>
            Toggle sections on as needed. Sections you leave off don&apos;t
            appear below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SECTIONS.map((s) => (
            <label
              key={s.key}
              className="flex items-start gap-3 p-3 rounded-md border hover:bg-gray-50 cursor-pointer"
            >
              <Checkbox
                checked={sectionOn(s.key)}
                onCheckedChange={() => toggleSection(s.key)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* ── Ingredients section ────────────────────────────────────────── */}
      {sectionOn("ingredients") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ingredients</CardTitle>
                <CardDescription>
                  Rates are per liter of finished batch volume.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                <Plus className="w-4 h-4 mr-1" /> Add ingredient
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.inputs.filter((i) => i.kind === "ingredient").length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No ingredients added yet.
              </p>
            ) : (
              <>
                {draft.inputs
                  .filter((i) => i.kind === "ingredient")
                  .map((ing) => (
                    <IngredientRow
                      key={ing.uiId}
                      input={ing}
                      editing={editingIds.has(ing.uiId)}
                      onChange={(p) => updateInput(ing.uiId, p)}
                      onRemove={() => removeInput(ing.uiId)}
                      onEdit={() => setEditing(ing.uiId, true)}
                      onDone={() => setEditing(ing.uiId, false)}
                    />
                  ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addIngredient}
                  className="w-full border border-dashed text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add another ingredient
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Parent batch input section ─────────────────────────────────── */}
      {sectionOn("parent_batch") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Parent batch input</CardTitle>
                <CardDescription>
                  For sub-batches (e.g., Strawberry Rhubarb starts from base cider).
                  Volume rate is the parent batch volume per liter of finished
                  sub-batch (typically 1.0 if no other liquids added; lower if
                  fruit/honey contributes volume).
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addParentBatchRequirement}>
                <Plus className="w-4 h-4 mr-1" /> Add parent batch
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.inputs.filter((i) => i.kind === "parent_batch_requirement").length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No parent batches required.
              </p>
            ) : (
              <>
                {draft.inputs
                  .filter((i) => i.kind === "parent_batch_requirement")
                  .map((p) => (
                    <ParentBatchRow
                      key={p.uiId}
                      input={p}
                      editing={editingIds.has(p.uiId)}
                      onChange={(patch) => updateInput(p.uiId, patch)}
                      onRemove={() => removeInput(p.uiId)}
                      onEdit={() => setEditing(p.uiId, true)}
                      onDone={() => setEditing(p.uiId, false)}
                    />
                  ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addParentBatchRequirement}
                  className="w-full border border-dashed text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add another parent batch
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Process steps section ──────────────────────────────────────── */}
      {sectionOn("process_steps") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Process steps</CardTitle>
                <CardDescription>
                  Ordered actions. Drag to reorder; each step has a trigger
                  that determines when it&apos;s ready in the schedule.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="w-4 h-4 mr-1" /> Add step
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No steps yet.
              </p>
            ) : (
              <>
                {draft.steps.map((step, idx) => (
                  <StepRow
                    key={step.uiId}
                    step={step}
                    index={idx}
                    total={draft.steps.length}
                    editing={editingIds.has(step.uiId)}
                    ingredients={draft.inputs.filter((i) => i.kind === "ingredient")}
                    onChange={(p) => updateStep(step.uiId, p)}
                    onRemove={() => removeStep(step.uiId)}
                    onMoveUp={() => moveStep(step.uiId, "up")}
                    onMoveDown={() => moveStep(step.uiId, "down")}
                    onEdit={() => setEditing(step.uiId, true)}
                    onDone={() => setEditing(step.uiId, false)}
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addStep}
                  className="w-full border border-dashed text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add another step
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Notes (always visible) ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Anything operators should know that doesn&apos;t fit the structured
            sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* ── Change summary (only meaningful for updates, but harmless on create) */}
      {initial && (
        <Card>
          <CardContent className="p-4">
            <Label>Change summary (optional)</Label>
            <Input
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Bumped strawberry rate from 75 to 100 g/L"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Stored with the new version snapshot for future reference.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Error & actions ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-white p-4 -mx-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel ?? "Save Recipe"}
        </Button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function IngredientRow({
  input,
  editing,
  onChange,
  onRemove,
  onEdit,
  onDone,
}: {
  input: RecipeInputDraft;
  editing: boolean;
  onChange: (p: Partial<RecipeInputDraft>) => void;
  onRemove: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  if (!editing) {
    const meta = [
      input.additiveType,
      input.rateValue != null ? `${input.rateValue} ${input.rateUnit ?? ""}`.trim() : null,
      input.notes,
    ].filter(Boolean).join(" · ");
    return (
      <SummaryRow
        title={input.label || "Untitled ingredient"}
        meta={meta}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    );
  }
  return (
    <div className="grid grid-cols-12 gap-2 p-3 border rounded-md bg-gray-50/50">
      <div className="col-span-3">
        <Label className="text-xs">Type</Label>
        <Select
          value={input.additiveType ?? ""}
          onValueChange={(v) => onChange({ additiveType: v })}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {ADDITIVE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-3">
        <Label className="text-xs">Name / label *</Label>
        <Input
          value={input.label}
          onChange={(e) => onChange({ label: e.target.value, additiveName: e.target.value })}
          placeholder="e.g. Strawberries"
          className="h-9"
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Rate</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={input.rateValue ?? ""}
          onChange={(e) => onChange({ rateValue: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="0"
          className="h-9"
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Unit</Label>
        <Select
          value={input.rateUnit ?? "g/L"}
          onValueChange={(v) => onChange({ rateUnit: v })}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RATE_UNITS.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex items-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-9">
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
      <div className="col-span-12">
        <Input
          value={input.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Notes (optional) — e.g. cold-extracted only"
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-12 flex justify-end">
        <Button type="button" size="sm" onClick={onDone} disabled={!input.label.trim()}>
          <Check className="w-4 h-4 mr-1" /> Done
        </Button>
      </div>
    </div>
  );
}

function ParentBatchRow({
  input,
  editing,
  onChange,
  onRemove,
  onEdit,
  onDone,
}: {
  input: RecipeInputDraft;
  editing: boolean;
  onChange: (p: Partial<RecipeInputDraft>) => void;
  onRemove: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  if (!editing) {
    const meta = [
      input.sourceProductType,
      input.rateValue != null ? `${input.rateValue} ${input.rateUnit ?? ""}`.trim() : null,
      input.notes,
    ].filter(Boolean).join(" · ");
    return (
      <SummaryRow
        title={input.label || "Untitled parent batch"}
        meta={meta}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    );
  }
  return (
    <div className="grid grid-cols-12 gap-2 p-3 border rounded-md bg-gray-50/50">
      <div className="col-span-4">
        <Label className="text-xs">Label *</Label>
        <Input
          value={input.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Base cider"
          className="h-9"
        />
      </div>
      <div className="col-span-3">
        <Label className="text-xs">Source product type</Label>
        <Select
          value={input.sourceProductType ?? "cider"}
          onValueChange={(v) => onChange({ sourceProductType: v as ProductType })}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Volume rate</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={input.rateValue ?? ""}
          onChange={(e) => onChange({ rateValue: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="1.0"
          className="h-9"
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Unit</Label>
        <Select
          value={input.rateUnit ?? "L/L"}
          onValueChange={(v) => onChange({ rateUnit: v })}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="L/L">L per L (volume ratio)</SelectItem>
            <SelectItem value="%v/v">% v/v</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1 flex items-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-9">
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
      <div className="col-span-12">
        <Input
          value={input.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Notes — e.g. must be at terminal SG"
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-12 flex justify-end">
        <Button type="button" size="sm" onClick={onDone} disabled={!input.label.trim()}>
          <Check className="w-4 h-4 mr-1" /> Done
        </Button>
      </div>
    </div>
  );
}

// Compact, read-only summary used by collapsed ingredient / parent-batch rows.
function SummaryRow({
  title,
  meta,
  onEdit,
  onRemove,
}: {
  title: string;
  meta?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 border rounded-md bg-white">
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <div className="text-sm font-medium truncate">{title}</div>
        {meta ? (
          <div className="text-xs text-muted-foreground truncate">{meta}</div>
        ) : null}
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="h-8">
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8">
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// One-line summary of a step's action params for the collapsed view. Reads
// from actionData (names are denormalized there, so no query needed).
function summarizeStepAction(step: RecipeStepDraft): string | null {
  const d = step.actionData as Record<string, any>;
  switch (step.kind) {
    case "add_additive":
    case "pitch_yeast":
      return d.ingredientLabel ? `→ ${d.ingredientLabel}` : null;
    case "pasteurize":
      return d.targetPu != null
        ? `→ ${d.targetPu} PU @ ${d.tempC}°C / ${d.timeMinutes} min`
        : null;
    case "package":
      return d.containerVarietyName
        ? `→ ${d.containerVarietyName}${d.sizeML ? ` (${d.sizeML} mL)` : ""}${
            d.capVarietyName ? ` + ${d.capVarietyName}` : ""
          }`
        : null;
    case "label":
      return d.labelVarietyName ? `→ ${d.labelVarietyName}` : null;
    case "filter":
      return d.micronRating
        ? `→ ${d.micronRating} micron${d.padType ? ` (${d.padType})` : ""}`
        : null;
    default:
      return null;
  }
}

function StepRow({
  step,
  index,
  total,
  editing,
  ingredients,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDone,
}: {
  step: RecipeStepDraft;
  index: number;
  total: number;
  editing: boolean;
  ingredients: RecipeInputDraft[];
  onChange: (p: Partial<RecipeStepDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const kindLabel = STEP_KINDS.find((k) => k.value === step.kind)?.label ?? step.kind;
  const triggerLabel =
    TRIGGER_KINDS.find((t) => t.value === step.triggerKind)?.label ?? step.triggerKind;
  const actionSummary = summarizeStepAction(step);

  return (
    <div className="border rounded-md bg-gray-50/50">
      {/* Header row — always visible */}
      <div className="flex items-center gap-2 p-2 border-b bg-white rounded-t-md">
        <button
          type="button"
          onClick={editing ? onDone : onEdit}
          className="text-gray-500 hover:text-gray-900"
          aria-label="Expand/collapse"
        >
          {editing ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
        {editing ? (
          <Input
            value={step.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Step label (e.g. Pitch yeast at 18°C)"
            className="h-8 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 text-left text-sm font-medium truncate"
          >
            {step.label || "Untitled step"}
          </button>
        )}
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} disabled={index === 0} title="Move up" className="h-8 px-2">↑</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} disabled={index === total - 1} title="Move down" className="h-8 px-2">↓</Button>
          {!editing && (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} title="Edit" className="h-8 px-2">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 px-2">
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>

      {/* Collapsed summary — full description collapses to a 2-line preview */}
      {!editing && (
        <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{kindLabel} · {triggerLabel}</span>
            {step.packagingPath !== "all" && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  step.packagingPath === "bottle"
                    ? "border-blue-300 text-blue-700"
                    : "border-amber-300 text-amber-700"
                }`}
              >
                {PACKAGING_PATHS.find((p) => p.value === step.packagingPath)?.short}
              </Badge>
            )}
          </div>
          {actionSummary ? (
            <div className="truncate text-gray-600">{actionSummary}</div>
          ) : null}
          {step.description?.trim() ? (
            <div className="line-clamp-2 whitespace-pre-wrap text-gray-600">
              {step.description}
            </div>
          ) : null}
        </div>
      )}

      {editing && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <Label className="text-xs">Step kind</Label>
              <Select
                value={step.kind}
                onValueChange={(v) => onChange({ kind: v as StepKind, actionData: {} })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STEP_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6">
              <Label className="text-xs">Trigger</Label>
              <Select
                value={step.triggerKind}
                onValueChange={(v) => onChange({ triggerKind: v as TriggerKind, triggerData: {} })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_KINDS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <Label className="text-xs">Applies to packaging</Label>
              <Select
                value={step.packagingPath}
                onValueChange={(v) => onChange({ packagingPath: v as PackagingPath })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PACKAGING_PATHS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6 flex items-end text-xs text-muted-foreground">
              Use &quot;Bottle only&quot; / &quot;Keg only&quot; for steps that run on just
              one format (e.g. pasteurize &amp; label are bottle-only).
            </div>
          </div>

          {/* Action params — kind-specific (what to do / how much) */}
          <StepActionParams step={step} ingredients={ingredients} onChange={onChange} />

          {/* Trigger params — kind-specific (when it fires) */}
          <TriggerParams step={step} onChange={onChange} />

          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={step.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Step instructions for the operator"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <Label className="text-xs">Estimated duration (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={step.estimatedDurationHours ?? ""}
                onChange={(e) => onChange({ estimatedDurationHours: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="0"
                className="h-9"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={onDone} disabled={!step.label.trim()}>
              <Check className="w-4 h-4 mr-1" /> Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Kind-specific "what to do" fields, written to step.actionData. Mirrors the
// per-kind structure of TriggerParams. Grows one case per step kind as the
// structured-step-params feature is built out (additive, filter, pasteurize,
// package, label, carbonate, measurement…).
function StepActionParams({
  step,
  ingredients,
  onChange,
}: {
  step: RecipeStepDraft;
  ingredients: RecipeInputDraft[];
  onChange: (p: Partial<RecipeStepDraft>) => void;
}) {
  const orgSettings = useOrganizationSettings();
  // Packaging varieties for package/label dropdowns. React Query dedupes this
  // across every rendered step row, so it's a single shared request.
  const varietiesQuery = trpc.packagingVarieties.list.useQuery({ limit: 100 });
  const varieties = varietiesQuery.data?.varieties ?? [];
  // Bottles AND caps both live under "Primary Packaging" in inventory; labels
  // are "Secondary Packaging".
  const containerOpts = varieties.filter((v) => v.itemType === "Primary Packaging");
  const labelOpts = varieties.filter((v) => v.itemType === "Secondary Packaging");
  const data = step.actionData;
  const setData = (patch: Record<string, unknown>) =>
    onChange({ actionData: { ...data, ...patch } });

  // Auto-fill pasteurize params from the org defaults the first time a step
  // becomes a pasteurize step (empty actionData), so the values are captured
  // in the version snapshot even if the operator doesn't touch them.
  useEffect(() => {
    if (step.kind === "pasteurize" && Object.keys(step.actionData).length === 0) {
      onChange({
        actionData: {
          targetPu: Number(orgSettings.defaultPasteurizationTargetPu),
          tempC: Number(orgSettings.defaultPasteurizationTempC),
          timeMinutes: Number(orgSettings.defaultPasteurizationTimeMinutes),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  switch (step.kind) {
    case "add_additive":
    case "pitch_yeast": {
      // References an additive already declared in the Ingredients section —
      // amount/rate is defined once there, the step just says when to add it.
      const selected = (data.ingredientLabel as string) ?? "";
      const ing = ingredients.find((i) => i.label === selected);
      return (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <Label className="text-xs">Additive (from Ingredients)</Label>
            <Select value={selected} onValueChange={(v) => setData({ ingredientLabel: v })}>
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={ingredients.length ? "Select ingredient…" : "Add an ingredient first"}
                />
              </SelectTrigger>
              <SelectContent>
                {ingredients
                  .filter((i) => i.label.trim())
                  .map((i) => (
                    <SelectItem key={i.uiId} value={i.label}>{i.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6 flex items-end text-xs text-muted-foreground">
            {ing
              ? `Rate: ${ing.rateValue ?? "?"} ${ing.rateUnit ?? ""} — defined in the Ingredients section`
              : "Declare additives & rates in the Ingredients section, then pick one here."}
          </div>
        </div>
      );
    }

    case "pasteurize": {
      const targetPu = (data.targetPu as number | undefined) ??
        Number(orgSettings.defaultPasteurizationTargetPu);
      const tempC = (data.tempC as number | undefined) ??
        Number(orgSettings.defaultPasteurizationTempC);
      const timeMinutes = (data.timeMinutes as number | undefined) ??
        Number(orgSettings.defaultPasteurizationTimeMinutes);
      const achievedPu = calculatePU(tempC, timeMinutes);
      const meets = achievedPu >= targetPu;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <Label className="text-xs">Target PU</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={Number.isFinite(targetPu) ? targetPu : ""}
                onChange={(e) => setData({ targetPu: e.target.value === "" ? null : Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Hold temp (°C)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={Number.isFinite(tempC) ? tempC : ""}
                onChange={(e) => setData({ tempC: e.target.value === "" ? null : Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Hold time (min)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={Number.isFinite(timeMinutes) ? timeMinutes : ""}
                onChange={(e) => setData({ timeMinutes: e.target.value === "" ? null : Number(e.target.value) })}
                className="h-9"
              />
            </div>
          </div>
          <p className={`text-xs ${meets ? "text-green-700" : "text-amber-700"}`}>
            ≈ {achievedPu.toFixed(1)} PU at {tempC}°C for {timeMinutes} min (60°C ref).{" "}
            {meets
              ? `Meets target ${targetPu} PU.`
              : `Below target ${targetPu} PU — increase temp or time.`}{" "}
            <span className="text-muted-foreground">Prefilled from Settings → Pasteurization Defaults.</span>
          </p>
        </div>
      );
    }

    case "package":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <Label className="text-xs">Container (bottle / can / keg)</Label>
              <Select
                value={(data.containerVarietyId as string) ?? ""}
                onValueChange={(id) => {
                  const v = containerOpts.find((x) => x.id === id);
                  setData({ containerVarietyId: id, containerVarietyName: v?.name ?? null });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={containerOpts.length ? "Select container…" : "No packaging in inventory"} />
                </SelectTrigger>
                <SelectContent>
                  {containerOpts.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Size (mL)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={(data.sizeML as number) ?? ""}
                onChange={(e) => setData({ sizeML: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="750"
                className="h-9"
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Cap / closure</Label>
              <Select
                value={(data.capVarietyId as string) ?? ""}
                onValueChange={(id) => {
                  const v = containerOpts.find((x) => x.id === id);
                  setData({ capVarietyId: id, capVarietyName: v?.name ?? null });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select cap…" />
                </SelectTrigger>
                <SelectContent>
                  {containerOpts.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick the bottle/can and cap from packaging inventory. Size drives the unit
            count (⌈volume ÷ size⌉) when this feeds inventory planning.
          </p>
        </div>
      );

    case "label":
      return (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <Label className="text-xs">Label</Label>
            <Select
              value={(data.labelVarietyId as string) ?? ""}
              onValueChange={(id) => {
                const v = labelOpts.find((x) => x.id === id);
                setData({ labelVarietyId: id, labelVarietyName: v?.name ?? null });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={labelOpts.length ? "Select label…" : "No labels in inventory"} />
              </SelectTrigger>
              <SelectContent>
                {labelOpts.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6">
            <Label className="text-xs">Label note (optional)</Label>
            <Input
              value={(data.labelNote as string) ?? ""}
              onChange={(e) => setData({ labelNote: e.target.value })}
              placeholder="e.g. front + back label"
              className="h-9"
            />
          </div>
        </div>
      );

    case "filter":
      return (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4">
            <Label className="text-xs">Micron rating</Label>
            <Input
              value={(data.micronRating as string) ?? ""}
              onChange={(e) => setData({ micronRating: e.target.value })}
              placeholder="e.g. 5-7"
              className="h-9"
            />
          </div>
          <div className="col-span-4">
            <Label className="text-xs">Pad / media type</Label>
            <Input
              value={(data.padType as string) ?? ""}
              onChange={(e) => setData({ padType: e.target.value })}
              placeholder="e.g. cellulose pad"
              className="h-9"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

function TriggerParams({
  step,
  onChange,
}: {
  step: RecipeStepDraft;
  onChange: (p: Partial<RecipeStepDraft>) => void;
}) {
  const data = step.triggerData;
  const setData = (patch: Record<string, unknown>) =>
    onChange({ triggerData: { ...data, ...patch } });

  switch (step.triggerKind) {
    case "date_offset_from_start":
    case "date_offset_from_previous":
      return (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-3">
            <Label className="text-xs">Days</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={(data.days as number) ?? ""}
              onChange={(e) => setData({ days: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-9"
            />
          </div>
          <div className="col-span-9 flex items-end text-xs text-muted-foreground">
            {step.triggerKind === "date_offset_from_start"
              ? "Days after the batch start date."
              : "Days after the previous step completed."}
          </div>
        </div>
      );
    case "sg_threshold":
      return (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-3">
            <Label className="text-xs">SG value</Label>
            <Input
              type="number"
              step="0.001"
              value={(data.sg as number) ?? ""}
              onChange={(e) => setData({ sg: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="1.005"
              className="h-9"
            />
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Direction</Label>
            <Select
              value={(data.direction as string) ?? "below"}
              onValueChange={(v) => setData({ direction: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="below">Below</SelectItem>
                <SelectItem value="above">Above</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6 flex items-end text-xs text-muted-foreground">
            Fires when latest SG measurement crosses this value.
          </div>
        </div>
      );
    case "sg_terminal_confirmed":
    case "manual":
    default:
      return null;
  }
}
