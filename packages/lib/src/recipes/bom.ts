/**
 * Recipe bill-of-materials (BOM).
 *
 * Resolves a recipe + a target finished volume + a bottle/keg split into the
 * exact inventory it consumes: additive amounts (rate × volume) and packaging
 * unit counts (⌈volume ÷ container size⌉). Only consumables count: bottles,
 * caps, and labels. Kegs are returnable reusable vessels (tracked like a
 * fermentation tank in the keg tracker), so keg-path package steps are
 * excluded from the BOM — only the bottled portion drives packaging.
 *
 * Every line carries a `varietyId` + numeric `quantity` + `unit`, so the
 * annual planner can SUM lines across many batches by (varietyId, unit).
 *
 * Pure function. No DB, no side effects — easy to unit test.
 */

import { computeScaledAmount } from "./scaling";

export interface BomIngredientInput {
  label: string;
  /** Inventory additive variety this ingredient resolves to (null = unlinked). */
  additiveVarietyId?: string | null;
  rateValue?: number | null;
  rateUnit?: string | null;
}

export interface BomStepInput {
  kind: string;
  label?: string;
  /** "all" | "bottle" | "keg" */
  packagingPath?: string | null;
  actionData?: Record<string, unknown> | null;
}

export interface BomLine {
  category: "additive" | "packaging";
  /** Inventory variety id, or null when the recipe line isn't linked to stock. */
  varietyId: string | null;
  name: string;
  quantity: number;
  /** Canonical unit: "g" | "mL" | "L" | "%" for additives, "units" for packaging. */
  unit: string;
}

export interface RecipeBomInput {
  ingredients: BomIngredientInput[];
  steps: BomStepInput[];
  targetVolumeL: number;
  /** Volume bottled. If both bottleL/kegL omitted, the whole batch is bottled. */
  bottleL?: number;
  /** Volume kegged. */
  kegL?: number;
}

export interface RecipeBom {
  targetVolumeL: number;
  bottleL: number;
  kegL: number;
  additives: BomLine[];
  packaging: BomLine[];
  warnings: string[];
}

/**
 * Compute the bill-of-materials for one batch of a recipe.
 *
 * @example
 *   computeRecipeBOM({
 *     ingredients: [{ label: "Cascade Hops", additiveVarietyId: "v1", rateValue: 1.5, rateUnit: "g/L" }],
 *     steps: [
 *       { kind: "package", packagingPath: "bottle", actionData: { containerVarietyId: "b1", containerVarietyName: "750ml Glass Bottles", sizeML: 750, capVarietyId: "c1", capVarietyName: "Caps" } },
 *       { kind: "label", packagingPath: "bottle", actionData: { labelVarietyId: "l1", labelVarietyName: "Heritage Label" } },
 *     ],
 *     targetVolumeL: 400,
 *   })
 *   // additives: 600 g Cascade Hops; packaging: 534 bottles, 534 caps, 534 labels
 */
export function computeRecipeBOM(input: RecipeBomInput): RecipeBom {
  const warnings: string[] = [];
  const totalV = input.targetVolumeL;

  // Resolve the bottle/keg split. Sensible fallbacks: nothing given → all
  // bottled; one given → the remainder is the other.
  let bottleL = input.bottleL;
  let kegL = input.kegL;
  if (bottleL == null && kegL == null) {
    bottleL = totalV;
    kegL = 0;
  } else if (bottleL == null) {
    bottleL = Math.max(0, totalV - (kegL ?? 0));
  } else if (kegL == null) {
    kegL = Math.max(0, totalV - bottleL);
  }
  bottleL = bottleL ?? 0;
  kegL = kegL ?? 0;
  if (Math.abs(bottleL + kegL - totalV) > 0.001) {
    warnings.push(
      `Bottle (${bottleL} L) + keg (${kegL} L) = ${(bottleL + kegL).toFixed(1)} L, ` +
        `which doesn't match the target ${totalV} L.`,
    );
  }

  // ── Additives: rate × volume ──────────────────────────────────────────────
  const additives: BomLine[] = [];
  for (const ing of input.ingredients) {
    const name = ing.label || "(unnamed ingredient)";
    const scaled = computeScaledAmount(ing.rateValue, ing.rateUnit, totalV);
    if (!scaled) {
      warnings.push(`"${name}" has no usable rate; skipped.`);
      continue;
    }
    if (!ing.additiveVarietyId) {
      warnings.push(`"${name}" isn't linked to an inventory item; it can't be resolved to stock.`);
    }
    additives.push({
      category: "additive",
      varietyId: ing.additiveVarietyId ?? null,
      name,
      quantity: scaled.rawAmount,
      unit: scaled.rawUnit,
    });
  }

  // ── Packaging: ⌈volume ÷ size⌉, aggregated by variety ─────────────────────
  const pkg = new Map<string, BomLine>();
  const addPkg = (varietyId: string | null, name: string, qty: number) => {
    const key = `${varietyId ?? "null"}|${name}`;
    const existing = pkg.get(key);
    if (existing) existing.quantity += qty;
    else pkg.set(key, { category: "packaging", varietyId, name, quantity: qty, unit: "units" });
  };

  // Pass 1: containers + caps from package steps. Track bottle units so labels
  // (applied per bottle) can be counted in pass 2.
  let bottleUnits = 0;
  for (const s of input.steps) {
    if (s.kind !== "package") continue;
    const path = s.packagingPath ?? "all";
    // Kegs are returnable, reusable vessels — tracked like a fermentation tank
    // in the keg tracker, not a consumable. They never belong in the BOM; keg
    // counts are a capacity/keg-tracker concern, not a purchasing one.
    if (path === "keg") continue;
    const d = (s.actionData ?? {}) as Record<string, unknown>;
    const portionL = path === "bottle" ? bottleL : bottleL + kegL;
    const sizeML = typeof d.sizeML === "number" ? d.sizeML : null;
    if (!sizeML || sizeML <= 0) {
      warnings.push(`Package step "${s.label ?? "package"}" has no container size; can't count units.`);
      continue;
    }
    if (portionL <= 0) continue;
    const count = Math.ceil((portionL * 1000) / sizeML);
    const containerName = (d.containerVarietyName as string) || `${sizeML} mL container`;
    addPkg((d.containerVarietyId as string) ?? null, containerName, count);
    if (d.capVarietyId || d.capVarietyName) {
      addPkg((d.capVarietyId as string) ?? null, (d.capVarietyName as string) || "Cap / closure", count);
    }
    if (path === "bottle" || path === "all") bottleUnits += count;
  }

  // Pass 2: labels — one per bottle.
  for (const s of input.steps) {
    if (s.kind !== "label") continue;
    const d = (s.actionData ?? {}) as Record<string, unknown>;
    if (bottleUnits <= 0) {
      warnings.push(`A label step is present but no bottle units were computed (missing a bottle Package step with a size?).`);
      continue;
    }
    addPkg((d.labelVarietyId as string) ?? null, (d.labelVarietyName as string) || "Label", bottleUnits);
    if (!d.labelVarietyId) warnings.push(`A label step isn't linked to an inventory label.`);
  }

  return {
    targetVolumeL: totalV,
    bottleL: bottleL as number,
    kegL: kegL as number,
    additives,
    packaging: Array.from(pkg.values()),
    warnings,
  };
}

// ─── Mapping DB/API recipe rows → BOM input ─────────────────────────────────

/** Loose shape of a recipe_inputs row, as returned by the API/DB. */
export interface RecipeInputRow {
  kind: string;
  label: string;
  additiveVarietyId?: string | null;
  /** Decimal columns come back as strings from Drizzle; numbers are accepted too. */
  rateValue?: string | number | null;
  rateUnit?: string | null;
}

/** Loose shape of a recipe_steps row, as returned by the API/DB. */
export interface RecipeStepRow {
  kind: string;
  label?: string | null;
  packagingPath?: string | null;
  /** JSONB column — Drizzle surfaces it as `unknown`; cast at the boundary. */
  actionData?: unknown;
}

/**
 * Turn raw recipe rows (inputs + steps) into the `RecipeBomInput` that
 * `computeRecipeBOM` expects. Filters inputs down to `ingredient` kinds (the
 * only ones that consume additive stock) and normalizes decimal-string rates
 * to numbers. Shared by the recipe view page and the production planner so the
 * recipe → BOM mapping lives in exactly one place.
 */
export function recipeRowsToBomInput(
  inputs: RecipeInputRow[],
  steps: RecipeStepRow[],
  opts: { targetVolumeL: number; bottleL?: number; kegL?: number },
): RecipeBomInput {
  return {
    ingredients: inputs
      .filter((i) => i.kind === "ingredient")
      .map((i) => ({
        label: i.label,
        additiveVarietyId: i.additiveVarietyId ?? null,
        rateValue: i.rateValue != null ? Number(i.rateValue) : null,
        rateUnit: i.rateUnit ?? null,
      })),
    steps: steps.map((s) => ({
      kind: s.kind,
      label: s.label ?? undefined,
      packagingPath: s.packagingPath ?? "all",
      actionData: (s.actionData as Record<string, unknown> | null) ?? {},
    })),
    targetVolumeL: opts.targetVolumeL,
    bottleL: opts.bottleL,
    kegL: opts.kegL,
  };
}

// ─── Cross-batch aggregation (for annual planning) ──────────────────────────

export interface PlannedBatchBom {
  /** Period bucket, e.g. "2026-03" (monthly) or "2026-Q1" (quarterly). */
  period: string;
  bom: RecipeBom;
}

export interface AggregatedRequirement {
  period: string;
  category: "additive" | "packaging";
  varietyId: string | null;
  name: string;
  unit: string;
  quantity: number;
  /** Number of batch lines that contributed to this total. */
  sources: number;
}

/**
 * Sum many per-batch BOMs into per-period, per-variety requirements.
 *
 * Lines combine by (period, category, varietyId, name, unit) — so the same
 * bottle used across 10 planned batches in March becomes one March line with
 * the total count. This is what the annual planner compares against on-hand
 * stock to produce a buy list.
 */
export function aggregateRecipeBOMs(batches: PlannedBatchBom[]): AggregatedRequirement[] {
  const map = new Map<string, AggregatedRequirement>();
  for (const { period, bom } of batches) {
    for (const line of [...bom.additives, ...bom.packaging]) {
      const key = `${period}|${line.category}|${line.varietyId ?? "null"}|${line.name}|${line.unit}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += line.quantity;
        existing.sources += 1;
      } else {
        map.set(key, {
          period,
          category: line.category,
          varietyId: line.varietyId,
          name: line.name,
          unit: line.unit,
          quantity: line.quantity,
          sources: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      a.period.localeCompare(b.period) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name),
  );
}
