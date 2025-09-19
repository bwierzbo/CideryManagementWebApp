import { z } from 'zod'
import { router, createRbacProcedure, publicProcedure } from '../trpc'
import { db, baseFruitVarieties, auditLog } from 'db'
import { eq, and, isNull, ilike, or, sql, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { publishCreateEvent, publishUpdateEvent, publishDeleteEvent } from 'lib'
import { zCiderCategory, zIntensity, zHarvestWindow } from 'lib/src/apples'

const varietyCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  fruitType: z.enum(['apple', 'pear', 'plum']).default('apple'),
  ciderCategory: zCiderCategory.optional(),
  tannin: zIntensity.optional(),
  acid: zIntensity.optional(),
  sugarBrix: zIntensity.optional(),
  harvestWindow: zHarvestWindow.optional(),
  varietyNotes: z.string().optional(),
})

const varietyUpdateSchema = z.object({
  id: z.string().uuid('Invalid variety ID'),
  patch: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    fruitType: z.enum(['apple', 'pear', 'plum']).optional(),
    ciderCategory: z.union([zCiderCategory, z.literal(null)]).optional(),
    tannin: z.union([zIntensity, z.literal(null)]).optional(),
    acid: z.union([zIntensity, z.literal(null)]).optional(),
    sugarBrix: z.union([zIntensity, z.literal(null)]).optional(),
    harvestWindow: z.union([zHarvestWindow, z.literal(null)]).optional(),
    varietyNotes: z.union([z.string(), z.literal(null)]).optional(),
    isActive: z.boolean().optional(),
  }),
})

// Output schemas for type safety
const varietyOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  fruitType: z.string(),
  isActive: z.boolean(),
  ciderCategory: z.string().nullable(),
  tannin: z.string().nullable(),
  acid: z.string().nullable(),
  sugarBrix: z.string().nullable(),
  harvestWindow: z.string().nullable(),
  varietyNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const varietiesRouter = router({
  // List all varieties with optional inactive inclusion
  listAll: publicProcedure
    .input(z.object({
      includeInactive: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      try {
        const whereConditions = []

        if (!input.includeInactive) {
          whereConditions.push(eq(baseFruitVarieties.isActive, true))
        }

        // Always exclude soft-deleted records
        whereConditions.push(isNull(baseFruitVarieties.deletedAt))

        const varietyList = await db
          .select({
            id: baseFruitVarieties.id,
            name: baseFruitVarieties.name,
            fruitType: baseFruitVarieties.fruitType,
            isActive: baseFruitVarieties.isActive,
            ciderCategory: baseFruitVarieties.ciderCategory,
            tannin: baseFruitVarieties.tannin,
            acid: baseFruitVarieties.acid,
            sugarBrix: baseFruitVarieties.sugarBrix,
            harvestWindow: baseFruitVarieties.harvestWindow,
            varietyNotes: baseFruitVarieties.varietyNotes,
            createdAt: baseFruitVarieties.createdAt,
            updatedAt: baseFruitVarieties.updatedAt,
          })
          .from(baseFruitVarieties)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .orderBy(baseFruitVarieties.name)

        return {
          baseFruitVarieties: varietyList,
          count: varietyList.length,
        }
      } catch (error) {
        console.error('Error listing fruit varieties:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list fruit varieties'
        })
      }
    }),

  // Create new variety with name uniqueness validation
  create: createRbacProcedure('create', 'apple_variety')
    .input(varietyCreateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check for duplicate name (case-insensitive)
        const existingVariety = await db
          .select({ id: baseFruitVarieties.id, name: baseFruitVarieties.name })
          .from(baseFruitVarieties)
          .where(and(
            sql`LOWER(${baseFruitVarieties.name}) = LOWER(${input.name})`,
            isNull(baseFruitVarieties.deletedAt)
          ))
          .limit(1)

        if (existingVariety.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `An apple variety with the name "${input.name}" already exists`
          })
        }

        const values = {
          name: input.name,
          ciderCategory: input.ciderCategory || null,
          tannin: input.tannin || null,
          acid: input.acid || null,
          sugarBrix: input.sugarBrix || null,
          harvestWindow: input.harvestWindow || null,
          varietyNotes: input.varietyNotes || null,
        }

        const newVariety = await db
          .insert(baseFruitVarieties)
          .values(values as any)
          .returning()

        // Publish audit event
        await publishCreateEvent(
          'base_fruit_varieties',
          newVariety[0].id,
          {
            varietyId: newVariety[0].id,
            varietyName: input.name,
            ciderCategory: input.ciderCategory,
            tannin: input.tannin,
            acid: input.acid,
            sugarBrix: input.sugarBrix,
            harvestWindow: input.harvestWindow,
          },
          ctx.session?.user?.id,
          'Apple variety created via API'
        )

        return {
          success: true,
          fruitVariety: newVariety[0],
          message: `Apple variety "${input.name}" created successfully`,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error creating apple variety:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create apple variety'
        })
      }
    }),

  // Update variety with partial patch support
  update: createRbacProcedure('update', 'apple_variety')
    .input((input: unknown) => {
      console.log('🔍 Raw update input:', JSON.stringify(input, null, 2))
      try {
        const result = varietyUpdateSchema.parse(input)
        console.log('✅ Validation passed:', JSON.stringify(result, null, 2))
        return result
      } catch (error: any) {
        console.error('❌ Validation failed:', error.errors)
        throw error
      }
    })
    .mutation(async ({ input, ctx }) => {
      console.log('🔍 Apple variety update mutation started')
      try {
        // Get existing variety for audit trail
        const existingVariety = await db
          .select()
          .from(baseFruitVarieties)
          .where(and(
            eq(baseFruitVarieties.id, input.id),
            isNull(baseFruitVarieties.deletedAt)
          ))
          .limit(1)

        if (!existingVariety.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Apple variety not found'
          })
        }

        // Check for name conflicts if name is being changed
        if (input.patch.name && input.patch.name !== existingVariety[0].name) {
          const duplicateVariety = await db
            .select({ id: baseFruitVarieties.id, name: baseFruitVarieties.name })
            .from(baseFruitVarieties)
            .where(and(
              sql`LOWER(${baseFruitVarieties.name}) = LOWER(${input.patch.name})`,
              ne(baseFruitVarieties.id, input.id),
              isNull(baseFruitVarieties.deletedAt)
            ))
            .limit(1)

          if (duplicateVariety.length > 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `An apple variety with the name "${input.patch.name}" already exists`
            })
          }
        }

        // Build update object from patch
        const updateData: any = {
          updatedAt: new Date(),
        }

        if (input.patch.name !== undefined) updateData.name = input.patch.name
        if (input.patch.fruitType !== undefined) updateData.fruitType = input.patch.fruitType
        if (input.patch.ciderCategory !== undefined) updateData.ciderCategory = input.patch.ciderCategory
        if (input.patch.tannin !== undefined) updateData.tannin = input.patch.tannin
        if (input.patch.acid !== undefined) updateData.acid = input.patch.acid
        if (input.patch.sugarBrix !== undefined) updateData.sugarBrix = input.patch.sugarBrix
        if (input.patch.harvestWindow !== undefined) updateData.harvestWindow = input.patch.harvestWindow
        if (input.patch.varietyNotes !== undefined) updateData.varietyNotes = input.patch.varietyNotes
        if (input.patch.isActive !== undefined) updateData.isActive = input.patch.isActive

        const updatedVariety = await db
          .update(baseFruitVarieties)
          .set(updateData)
          .where(eq(baseFruitVarieties.id, input.id))
          .returning()

        // Publish audit event
        await publishUpdateEvent(
          'base_fruit_varieties',
          input.id,
          existingVariety[0],
          updateData,
          ctx.session?.user?.id,
          'Apple variety updated via API'
        )

        return {
          success: true,
          fruitVariety: updatedVariety[0],
          message: `Fruit variety updated successfully`,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('❌ Error updating fruit variety:', error)
        console.error('Error details:', {
          message: (error as any)?.message,
          code: (error as any)?.code,
          stack: (error as any)?.stack
        })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update fruit variety'
        })
      }
    }),

  // Soft delete (set isActive=false)
  remove: createRbacProcedure('delete', 'apple_variety')
    .input(z.object({ id: z.string().uuid('Invalid variety ID') }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get existing variety for audit trail
        const existingVariety = await db
          .select()
          .from(baseFruitVarieties)
          .where(and(
            eq(baseFruitVarieties.id, input.id),
            isNull(baseFruitVarieties.deletedAt)
          ))
          .limit(1)

        if (!existingVariety.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Apple variety not found'
          })
        }

        // Soft delete by setting isActive to false
        const removedVariety = await db
          .update(baseFruitVarieties)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(baseFruitVarieties.id, input.id))
          .returning()

        // Publish audit event
        await publishDeleteEvent(
          'base_fruit_varieties',
          input.id,
          existingVariety[0],
          ctx.session?.user?.id,
          'Apple variety archived via API'
        )

        return {
          success: true,
          fruitVariety: removedVariety[0],
          message: `Apple variety "${existingVariety[0].name}" archived successfully`,
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        console.error('Error archiving apple variety:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to archive apple variety'
        })
      }
    }),

  // Search for typeahead functionality
  search: createRbacProcedure('list', 'apple_variety')
    .input(z.object({
      q: z.string().min(1, 'Search query is required'),
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      try {
        const searchPattern = `%${input.q}%`

        const varieties = await db
          .select({
            id: baseFruitVarieties.id,
            name: baseFruitVarieties.name,
            ciderCategory: baseFruitVarieties.ciderCategory,
            tannin: baseFruitVarieties.tannin,
            acid: baseFruitVarieties.acid,
            sugarBrix: baseFruitVarieties.sugarBrix,
            harvestWindow: baseFruitVarieties.harvestWindow,
          })
          .from(baseFruitVarieties)
          .where(and(
            ilike(baseFruitVarieties.name, searchPattern),
            eq(baseFruitVarieties.isActive, true),
            isNull(baseFruitVarieties.deletedAt)
          ))
          .orderBy(baseFruitVarieties.name)
          .limit(input.limit)

        return {
          varieties,
          count: varieties.length,
          query: input.q,
        }
      } catch (error) {
        console.error('Error searching fruit varieties:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search fruit varieties'
        })
      }
    }),
})