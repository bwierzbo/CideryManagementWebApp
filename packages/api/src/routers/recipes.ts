import { z } from "zod";
import { router, createRbacProcedure } from "../trpc";
import {
  db,
  recipes,
  recipeIngredients,
  recipeAdditives,
  batches,
  baseFruitVarieties,
  additiveVarieties,
  batchCompositions,
  vessels,
} from "db";
import {
  eq,
  and,
  isNull,
  desc,
  ilike,
  sql,
  inArray,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const styleEnum = z.enum([
  "dry",
  "semi_dry",
  "semi_sweet",
  "sweet",
  "sparkling",
  "still",
]);

const categoryEnum = z.enum([
  "traditional",
  "seasonal",
  "experimental",
  "house_blend",
  "single_variety",
  "fruit_wine",
  "specialty",
]);

const ingredientSchema = z.object({
  fruitVarietyId: z.string().uuid().optional(),
  customFruitName: z.string().optional(),
  percentage: z.number().min(0).max(100),
  role: z.string().optional(),
  notes: z.string().optional(),
});

const additiveSchema = z.object({
  additiveVarietyId: z.string().uuid().optional(),
  customAdditiveName: z.string().optional(),
  amount: z.number().optional(),
  unit: z.string().optional(),
  timing: z.string().optional(),
  notes: z.string().optional(),
});

export const recipesRouter = router({
  list: createRbacProcedure("list", "batch")
    .input(
      z.object({
        search: z.string().optional(),
        style: styleEnum.optional(),
        category: categoryEnum.optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const { search, style, category, limit, offset } = input || {};

      const conditions = [isNull(recipes.deletedAt)];
      if (search) {
        conditions.push(ilike(recipes.name, `%${search}%`));
      }
      if (style) {
        conditions.push(eq(recipes.style, style));
      }
      if (category) {
        conditions.push(eq(recipes.category, category));
      }

      const results = await db
        .select()
        .from(recipes)
        .where(and(...conditions))
        .orderBy(desc(recipes.updatedAt))
        .limit(limit || 50)
        .offset(offset || 0);

      // Get ingredient and additive counts
      const recipeIds = results.map((r) => r.id);
      let ingredientCounts = new Map<string, number>();
      let additiveCounts = new Map<string, number>();

      if (recipeIds.length > 0) {
        const ingCounts = await db
          .select({
            recipeId: recipeIngredients.recipeId,
            count: sql<number>`count(*)`,
          })
          .from(recipeIngredients)
          .where(inArray(recipeIngredients.recipeId, recipeIds))
          .groupBy(recipeIngredients.recipeId);

        const addCounts = await db
          .select({
            recipeId: recipeAdditives.recipeId,
            count: sql<number>`count(*)`,
          })
          .from(recipeAdditives)
          .where(inArray(recipeAdditives.recipeId, recipeIds))
          .groupBy(recipeAdditives.recipeId);

        ingredientCounts = new Map(ingCounts.map((r) => [r.recipeId, Number(r.count)]));
        additiveCounts = new Map(addCounts.map((r) => [r.recipeId, Number(r.count)]));
      }

      return {
        recipes: results.map((r) => ({
          ...r,
          ingredientCount: ingredientCounts.get(r.id) || 0,
          additiveCount: additiveCounts.get(r.id) || 0,
        })),
        count: results.length,
      };
    }),

  get: createRbacProcedure("read", "batch")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, input.id), isNull(recipes.deletedAt)))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      const ingredients = await db
        .select({
          id: recipeIngredients.id,
          fruitVarietyId: recipeIngredients.fruitVarietyId,
          customFruitName: recipeIngredients.customFruitName,
          percentage: recipeIngredients.percentage,
          role: recipeIngredients.role,
          notes: recipeIngredients.notes,
          varietyName: baseFruitVarieties.name,
        })
        .from(recipeIngredients)
        .leftJoin(baseFruitVarieties, eq(recipeIngredients.fruitVarietyId, baseFruitVarieties.id))
        .where(eq(recipeIngredients.recipeId, input.id));

      const additivesResult = await db
        .select({
          id: recipeAdditives.id,
          additiveVarietyId: recipeAdditives.additiveVarietyId,
          customAdditiveName: recipeAdditives.customAdditiveName,
          amount: recipeAdditives.amount,
          unit: recipeAdditives.unit,
          timing: recipeAdditives.timing,
          notes: recipeAdditives.notes,
          varietyName: additiveVarieties.name,
        })
        .from(recipeAdditives)
        .leftJoin(additiveVarieties, eq(recipeAdditives.additiveVarietyId, additiveVarieties.id))
        .where(eq(recipeAdditives.recipeId, input.id));

      return { ...recipe, ingredients, additives: additivesResult };
    }),

  create: createRbacProcedure("create", "batch")
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        style: styleEnum,
        category: categoryEnum,
        targetOG: z.number().optional(),
        targetFG: z.number().optional(),
        targetABV: z.number().optional(),
        estimatedFermentationDays: z.number().int().optional(),
        suggestedYeast: z.string().optional(),
        notes: z.string().optional(),
        ingredients: z.array(ingredientSchema).optional(),
        additives: z.array(additiveSchema).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [recipe] = await db
        .insert(recipes)
        .values({
          name: input.name,
          description: input.description,
          style: input.style,
          category: input.category,
          targetOG: input.targetOG?.toString(),
          targetFG: input.targetFG?.toString(),
          targetABV: input.targetABV?.toString(),
          estimatedFermentationDays: input.estimatedFermentationDays,
          suggestedYeast: input.suggestedYeast,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      if (input.ingredients && input.ingredients.length > 0) {
        await db.insert(recipeIngredients).values(
          input.ingredients.map((ing) => ({
            recipeId: recipe.id,
            fruitVarietyId: ing.fruitVarietyId,
            customFruitName: ing.customFruitName,
            percentage: ing.percentage.toString(),
            role: ing.role,
            notes: ing.notes,
          }))
        );
      }

      if (input.additives && input.additives.length > 0) {
        await db.insert(recipeAdditives).values(
          input.additives.map((add) => ({
            recipeId: recipe.id,
            additiveVarietyId: add.additiveVarietyId,
            customAdditiveName: add.customAdditiveName,
            amount: add.amount?.toString(),
            unit: add.unit,
            timing: add.timing,
            notes: add.notes,
          }))
        );
      }

      return recipe;
    }),

  update: createRbacProcedure("update", "batch")
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        style: styleEnum.optional(),
        category: categoryEnum.optional(),
        targetOG: z.number().optional(),
        targetFG: z.number().optional(),
        targetABV: z.number().optional(),
        estimatedFermentationDays: z.number().int().optional(),
        suggestedYeast: z.string().optional(),
        notes: z.string().optional(),
        ingredients: z.array(ingredientSchema).optional(),
        additives: z.array(additiveSchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ingredients, additives, ...updates } = input;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.style !== undefined) updateData.style = updates.style;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.targetOG !== undefined) updateData.targetOG = updates.targetOG.toString();
      if (updates.targetFG !== undefined) updateData.targetFG = updates.targetFG.toString();
      if (updates.targetABV !== undefined) updateData.targetABV = updates.targetABV.toString();
      if (updates.estimatedFermentationDays !== undefined) updateData.estimatedFermentationDays = updates.estimatedFermentationDays;
      if (updates.suggestedYeast !== undefined) updateData.suggestedYeast = updates.suggestedYeast;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const [updated] = await db
        .update(recipes)
        .set(updateData)
        .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      // Replace ingredients if provided
      if (ingredients) {
        await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
        if (ingredients.length > 0) {
          await db.insert(recipeIngredients).values(
            ingredients.map((ing) => ({
              recipeId: id,
              fruitVarietyId: ing.fruitVarietyId,
              customFruitName: ing.customFruitName,
              percentage: ing.percentage.toString(),
              role: ing.role,
              notes: ing.notes,
            }))
          );
        }
      }

      // Replace additives if provided
      if (additives) {
        await db.delete(recipeAdditives).where(eq(recipeAdditives.recipeId, id));
        if (additives.length > 0) {
          await db.insert(recipeAdditives).values(
            additives.map((add) => ({
              recipeId: id,
              additiveVarietyId: add.additiveVarietyId,
              customAdditiveName: add.customAdditiveName,
              amount: add.amount?.toString(),
              unit: add.unit,
              timing: add.timing,
              notes: add.notes,
            }))
          );
        }
      }

      return updated;
    }),

  delete: createRbacProcedure("delete", "batch")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .update(recipes)
        .set({ deletedAt: new Date() })
        .where(and(eq(recipes.id, input.id), isNull(recipes.deletedAt)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      return deleted;
    }),

  createBatchFromRecipe: createRbacProcedure("create", "batch")
    .input(
      z.object({
        recipeId: z.string().uuid(),
        vesselId: z.string().uuid(),
        targetVolumeL: z.number().positive(),
        startDate: z.date().or(z.string().transform((val) => new Date(val))).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Get recipe with ingredients
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, input.recipeId), isNull(recipes.deletedAt)))
        .limit(1);

      if (!recipe) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }

      // Verify vessel
      const [vessel] = await db
        .select()
        .from(vessels)
        .where(and(eq(vessels.id, input.vesselId), isNull(vessels.deletedAt)))
        .limit(1);

      if (!vessel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vessel not found" });
      }

      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, input.recipeId));

      // Create batch
      const batchNumber = `R-${Date.now().toString(36).toUpperCase()}`;
      const [batch] = await db
        .insert(batches)
        .values({
          vesselId: input.vesselId,
          name: `Batch #${batchNumber}`,
          batchNumber,
          customName: recipe.name,
          initialVolume: input.targetVolumeL.toString(),
          initialVolumeUnit: "L",
          initialVolumeLiters: input.targetVolumeL.toString(),
          currentVolume: input.targetVolumeL.toString(),
          currentVolumeUnit: "L",
          currentVolumeLiters: input.targetVolumeL.toString(),
          status: "fermentation",
          productType: "cider",
          originalGravity: recipe.targetOG,
          targetFinalGravity: recipe.targetFG,
          startDate: input.startDate || new Date(),
        })
        .returning();

      // Note: batchCompositions are not created here because they require
      // vendor, cost, and volume data that only exist when fruit is actually
      // purchased and pressed. The recipe ingredients serve as the plan;
      // compositions are populated during press run completion.

      return { batch, recipe: recipe.name };
    }),
});
