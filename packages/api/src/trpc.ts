import { initTRPC, TRPCError } from '@trpc/server'
import { can } from 'lib/src/rbac/roles'

export interface Context {
  session?: {
    user?: {
      id?: string
      email?: string
      name?: string
      role?: string
    }
  } | null
}

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create()

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure

/**
 * Protected procedure that requires authentication
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})

/**
 * Admin-only procedure that requires admin role
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session?.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  })
})

/**
 * Create a procedure that checks specific RBAC permissions
 */
export const createRbacProcedure = (action: string, entity: string) =>
  protectedProcedure.use(({ ctx, next }) => {
    const userRole = ctx.session?.user?.role as 'admin' | 'operator'
    
    if (!userRole || !can(userRole, action as any, entity as any)) {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: `Insufficient permissions to ${action} ${entity}`
      })
    }
    
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    })
  })