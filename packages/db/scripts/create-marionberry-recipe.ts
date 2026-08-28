/**
 * One-off: create the "Marionberry" recipe reconstructed from the
 * Marrionberry batch (2026-02, batch 76015236-…). Mirrors the recipe
 * builder's write shape: recipes + recipe_inputs + recipe_steps + a v1
 * recipe_versions snapshot of the inserted rows.
 *
 * Run: pnpm --filter db exec tsx scripts/create-marionberry-recipe.ts
 */
import { db, recipes, recipeInputs, recipeSteps, recipeVersions } from "../src/index";
import { eq } from "drizzle-orm";

const ADMIN_USER = "8356e824-6b53-4751-b3ac-08a0df9327b9";
const CANE_SUGAR_VARIETY = "38fce6e3-914a-4560-96b7-c077cf300331";
const MARRIONBERRY_VARIETY = "4ad19012-f6a0-4f0c-8344-eb1c6b072a40";

async function main() {
  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.name, "Marionberry"))
    .limit(1);
  if (existing.length) {
    console.log("Recipe 'Marionberry' already exists — aborting.");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({
        name: "Marionberry",
        description:
          "Marionberry fruited cider reconstructed from the Feb 2026 batch: dry base cider + marionberries at 100 g/L (~1 day contact), backsweetened with cane sugar at 12 g/L, fine filtered, carbonated to 2.0 vol, packaged in 750 ml bottles and 19.5 L kegs.",
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
          pasteurization: false,
          carbonation_plan: true,
        },
        notes:
          "Rates from the 2026-02 Marrionberry batch (120 L of Summer Community Blend 1). Batch note at fruit addition: sulphur smell, tasted good. Batch was classified as wine (fruit added) for TTB.",
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
          notes: "Any dry base cider on hand (2026 batch used Summer Community Blend 1)",
        },
        {
          recipeId: recipe.id,
          kind: "ingredient",
          label: "Cane Sugar",
          additiveType: "Sugar & Sweeteners",
          additiveName: "Cane Sugar",
          additiveVarietyId: CANE_SUGAR_VARIETY,
          rateValue: "12",
          rateUnit: "g/L",
          sortOrder: 1,
        },
        {
          recipeId: recipe.id,
          kind: "ingredient",
          label: "Marionberry",
          additiveType: "Fruit/Fruit Product",
          additiveName: "Marrionberry",
          additiveVarietyId: MARRIONBERRY_VARIETY,
          rateValue: "100",
          rateUnit: "g/L",
          sortOrder: 2,
        },
      ])
      .returning();

    const stepRows: (typeof recipeSteps.$inferInsert)[] = [
      {
        kind: "transfer",
        sequence: 0,
        label: "Transfer Base cider to Mixing Vessel",
        triggerKind: "manual",
      },
      {
        kind: "add_additive",
        sequence: 1,
        label: "Add Marionberries at 100 g/l",
        description: "Add the marionberries (or puree) to the mixing vessel.",
        triggerKind: "after_previous",
        actionData: { ingredientLabel: "Marionberry" },
      },
      {
        kind: "rack",
        sequence: 2,
        label: "Rack off fruit",
        description:
          "Rack the cider off the fruit. The 2026 batch used ~1 day of fruit contact.",
        triggerKind: "date_offset_from_previous",
        triggerData: { days: 1 },
        isOptional: true,
      },
      {
        kind: "add_additive",
        sequence: 3,
        label: "Add Cane Sugar at 12 g/l",
        description:
          "Mix sugar with equal parts warm water to make a simple syrup, then add to the mixing tank.",
        triggerKind: "after_previous",
        actionData: { ingredientLabel: "Cane Sugar" },
      },
      {
        kind: "measurement",
        sequence: 4,
        label: "Measure SG and pH",
        description: "Use hydrometer and litmus strips.",
        triggerKind: "after_previous",
        actionData: { measures: ["sg", "ph"] },
      },
      {
        kind: "filter",
        sequence: 5,
        label: "Fine Filter Cider",
        description: "Use 1 micron pads.",
        triggerKind: "after_previous",
      },
      {
        kind: "carbonate",
        sequence: 6,
        label: "Carbonate Cider",
        description: "Force-carbonate to 2.0 vol CO2.",
        triggerKind: "after_previous",
        actionData: { targetCo2Volumes: 2, method: "forced" },
        packagingPath: "bottle",
      },
      {
        kind: "measurement",
        sequence: 7,
        label: "Measure CO2",
        triggerKind: "after_previous",
        actionData: { measures: ["co2"] },
        packagingPath: "bottle",
      },
      {
        kind: "package",
        sequence: 8,
        label: "Package Cider in 750ml bottles",
        description: "Package into 750ml bottles + caps.",
        triggerKind: "after_previous",
        packagingPath: "bottle",
      },
      {
        kind: "label",
        sequence: 9,
        label: "Label Bottles",
        description: "Apply the appropriate bottle labels.",
        triggerKind: "after_previous",
        packagingPath: "bottle",
      },
      {
        kind: "package",
        sequence: 10,
        label: "Package Cider in Kegs",
        description: "Fill 19.5 L kegs and purge headspace with CO2.",
        triggerKind: "after_previous",
        packagingPath: "keg",
      },
      {
        kind: "carbonate",
        sequence: 11,
        label: "Force-Carbonate Kegs",
        description: "Force-carbonate in the keg to 2.0 vol CO2.",
        triggerKind: "after_previous",
        actionData: { targetCo2Volumes: 2, method: "forced" },
        packagingPath: "keg",
      },
      {
        kind: "measurement",
        sequence: 12,
        label: "Measure CO2",
        triggerKind: "after_previous",
        actionData: { measures: ["co2"] },
        packagingPath: "keg",
      },
      {
        kind: "wait",
        sequence: 13,
        label: "Label Kegs",
        description: "Label kegs with name, date, ABV, keg size.",
        triggerKind: "after_previous",
        packagingPath: "keg",
      },
    ].map((s) => ({ ...s, recipeId: recipe.id }));

    const steps = await tx.insert(recipeSteps).values(stepRows).returning();

    await tx.insert(recipeVersions).values({
      recipeId: recipe.id,
      version: 1,
      snapshot: { recipe, inputs, steps },
      changeSummary: "Initial version reconstructed from the Feb 2026 Marrionberry batch",
      createdBy: ADMIN_USER,
    });

    console.log(
      `✅ Created recipe 'Marionberry' (${recipe.id}) with ${inputs.length} inputs, ${steps.length} steps, v1 snapshot.`,
    );
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
