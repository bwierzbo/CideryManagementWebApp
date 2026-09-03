/**
 * One-off: create the "Pear Cider" recipe from the Sept 2026 formulation
 * session — dry apple base backsweetened with pear juice at 300 mL/L
 * (no brandy; stays hard cider class), malic acid to taste, carbonated
 * to 2.0 vol. Mirrors the recipe builder's write shape.
 *
 * Run: pnpm --filter db exec tsx scripts/create-pear-cider-recipe.ts
 */
import { db, recipes, recipeInputs, recipeSteps, recipeVersions } from "../src/index";
import { eq } from "drizzle-orm";

const ADMIN_USER = "8356e824-6b53-4751-b3ac-08a0df9327b9";
const MALIC_ACID_VARIETY = "84849f90-d1e8-4f6a-8df1-b2ce7394d65b";

async function main() {
  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.name, "Pear Cider"))
    .limit(1);
  if (existing.length) {
    console.log("Recipe 'Pear Cider' already exists — aborting.");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({
        name: "Pear Cider",
        description:
          "Dry apple base backsweetened with pear juice at 300 mL/L (≈23% of blend). On a 6.7% base: ~5.1% ABV, SG ~1.008, ~20 g/L RS — semi-dry/semi-sweet, pear-forward. No brandy, so it stays hard cider class (apple+pear permitted) and carbonates to 2.0 vol.",
        productType: "cider",
        status: "draft",
        currentVersion: 1,
        isTemplate: false,
        enabledSections: {
          labeling: true,
          ingredients: true,
          parent_batch: true,
          process_steps: true,
          packaging_plan: true,
          pasteurization: true,
          carbonation_plan: true,
        },
        notes:
          "Formulated 2026-09: pear juice SG 1.034 / pH 4.2. Malic rate is a placeholder — bench-trial 1.5/2.5/3.5 g/L (10% solution, 1 mL per 100 mL = 1 g/L) targeting pH ~3.4-3.5 from a 3.8 blend, then set the actual rate. Backsweetened: pasteurize bottles, keep kegs cold.",
        createdBy: ADMIN_USER,
        updatedBy: ADMIN_USER,
      })
      .returning();

    const inputs = await tx
      .insert(recipeInputs)
      .values([
        {
          recipeId: recipe.id,
          kind: "parent_batch_requirement",
          label: "Base batch",
          sourceProductType: "cider",
          sortOrder: 0,
          notes: "Dry apple base, fully fermented (2026 run uses Golden Delicious Base @ ~6.7%)",
        },
        {
          recipeId: recipe.id,
          kind: "ingredient",
          label: "Pear Juice",
          additiveType: "Juice",
          additiveName: "Pear Juice",
          rateValue: "300",
          rateUnit: "mL/L",
          sortOrder: 1,
          notes: "SG ~1.034 juice; rate is per liter of base cider",
        },
        {
          recipeId: recipe.id,
          kind: "ingredient",
          label: "Malic Acid",
          additiveType: "Acids",
          additiveName: "Malic Acid",
          additiveVarietyId: MALIC_ACID_VARIETY,
          rateValue: "3",
          rateUnit: "g/L",
          sortOrder: 2,
          notes: "Placeholder — confirm 2.5-3.5 g/L via bench trial before dosing",
        },
      ])
      .returning();

    const stepRows: (typeof recipeSteps.$inferInsert)[] = [
      {
        kind: "transfer",
        sequence: 0,
        label: "Transfer base cider to blending tank",
        triggerKind: "manual",
      },
      {
        kind: "add_juice",
        sequence: 1,
        label: "Backsweeten with Pear Juice at 300 ml/l",
        description:
          "Dose pear juice for sweetness and pear character (~23% of final blend). Pick the lot in the Add Juice dialog; enter SG 1.034 if not prefilled.",
        triggerKind: "after_previous",
        actionData: { ingredientLabel: "Pear Juice", juiceName: "Pear Juice", doseMlPerL: 300 },
      },
      {
        kind: "add_additive",
        sequence: 2,
        label: "Add Malic Acid (rate from bench trial)",
        description:
          "Bench-trial 1.5/2.5/3.5 g/L on the actual blend targeting pH ~3.4-3.5, then dose the tank at the winning rate.",
        triggerKind: "after_previous",
        actionData: { ingredientLabel: "Malic Acid" },
      },
      {
        kind: "measurement",
        sequence: 3,
        label: "Measure SG and pH",
        description: "Expect SG ~1.008 and target pH from the acid trial.",
        triggerKind: "after_previous",
        actionData: { measures: ["sg", "ph"] },
      },
      {
        kind: "carbonate",
        sequence: 4,
        label: "Carbonate to 2.0 vol",
        description:
          "Force-carbonate to 2.0 vol CO2 — permitted for hard cider (apple+pear); no brandy in this recipe, do not fortify or it reclassifies as wine.",
        triggerKind: "after_previous",
        actionData: { targetCo2Volumes: 2, method: "forced" },
      },
      {
        kind: "measurement",
        sequence: 5,
        label: "Measure CO2",
        triggerKind: "after_previous",
        actionData: { measures: ["co2"] },
      },
      {
        kind: "package",
        sequence: 6,
        label: "Package (kegs and/or bottles)",
        description: "Backsweetened product: pasteurize bottles, keep kegs cold.",
        triggerKind: "after_previous",
      },
      {
        kind: "pasteurize",
        sequence: 7,
        label: "Pasteurize bottles",
        description: "Pasteurize to at least 20 PU (bottles only).",
        triggerKind: "after_previous",
        packagingPath: "bottle",
      },
      {
        kind: "label",
        sequence: 8,
        label: "Label",
        triggerKind: "after_previous",
      },
    ].map((s) => ({ ...s, recipeId: recipe.id }));

    const steps = await tx.insert(recipeSteps).values(stepRows).returning();

    await tx.insert(recipeVersions).values({
      recipeId: recipe.id,
      version: 1,
      snapshot: { recipe, inputs, steps },
      changeSummary: "Initial version from the Sept 2026 pear cider formulation (3 bbl run planned)",
      createdBy: ADMIN_USER,
    });

    console.log(
      `✅ Created recipe 'Pear Cider' (${recipe.id}) with ${inputs.length} inputs, ${steps.length} steps, v1 snapshot.`,
    );
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
