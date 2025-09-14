import { z } from 'zod'
import { router, publicProcedure } from '../trpc'

export const pressRunRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      // Stub implementation - returns empty list for now
      return {
        pressRuns: [],
        pagination: {
          total: 0,
          limit: input.limit,
          offset: 0,
        }
      }
    }),

  create: publicProcedure
    .input(z.object({
      vendorId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Stub implementation
      return {
        id: 'stub-' + Date.now(),
        vendorId: input.vendorId,
        status: 'draft',
      }
    }),
})