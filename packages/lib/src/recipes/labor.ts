/**
 * Recipe labor rollup — the "labor bill-of-materials".
 *
 * Sums the per-task labor estimates (`recipe_steps.estimatedDurationHours`)
 * a recipe's author entered, into a per-batch total broken down by packaging
 * path (shared / bottle / keg). This is the interim model: it uses the hours
 * entered per task as-is.
 *
 * NOT YET MODELED (see the labor-requirements-tracking PRD): labor does not
 * scale linearly with batch volume — fixed setup/cleaning vs volume-variable
 * work, volume-stepped consumables (filter pads), etc. These estimates are
 * per-task and volume-independent for now.
 *
 * Pure function. No DB, no side effects — easy to unit test.
 */

export interface LaborStepInput {
  /** "all" | "bottle" | "keg" — defaults to "all". */
  packagingPath?: string | null;
  /** Decimal columns come back as strings from Drizzle; numbers accepted too. */
  estimatedDurationHours?: string | number | null;
}

export interface RecipeLabor {
  /** Sum of every step's estimate (shared + bottle + keg). */
  totalHours: number;
  /** Hours grouped by packaging path. */
  byPath: { all: number; bottle: number; keg: number };
  /** Steps that contributed a positive estimate. */
  stepsCounted: number;
  /** Steps with no usable estimate (null, zero, or non-numeric). */
  stepsMissingEstimate: number;
}

/**
 * Roll up per-task labor estimates for a recipe.
 *
 * @example
 *   computeRecipeLabor([
 *     { packagingPath: "all", estimatedDurationHours: "0.5" },
 *     { packagingPath: "bottle", estimatedDurationHours: 1 },
 *     { packagingPath: "keg", estimatedDurationHours: null },
 *   ])
 *   // { totalHours: 1.5, byPath: { all: 0.5, bottle: 1, keg: 0 },
 *   //   stepsCounted: 2, stepsMissingEstimate: 1 }
 */
export function computeRecipeLabor(steps: LaborStepInput[]): RecipeLabor {
  const byPath = { all: 0, bottle: 0, keg: 0 };
  let stepsCounted = 0;
  let stepsMissingEstimate = 0;

  for (const s of steps) {
    const h = s.estimatedDurationHours == null ? NaN : Number(s.estimatedDurationHours);
    if (!Number.isFinite(h) || h <= 0) {
      stepsMissingEstimate++;
      continue;
    }
    const path =
      s.packagingPath === "bottle" || s.packagingPath === "keg" ? s.packagingPath : "all";
    byPath[path] += h;
    stepsCounted++;
  }

  return {
    totalHours: byPath.all + byPath.bottle + byPath.keg,
    byPath,
    stepsCounted,
    stepsMissingEstimate,
  };
}
