# tRPC API Authentication & Authorization

This document describes the authentication and authorization setup for the tRPC API.

## Overview

All tRPC procedures are protected by authentication and authorization middleware. The API uses NextAuth for session management and implements role-based access control (RBAC).

## Context

Every tRPC procedure receives a context with the current session and user:

```typescript
interface Context {
  session: Session | null;
  user: Session["user"] | null;
}
```

The context is created in `/apps/web/src/app/api/trpc/[trpc]/route.ts`:

```typescript
createContext: async () => {
  const session = await getServerSession(authOptions);
  return {
    session,
    user: session?.user || null,
  };
}
```

## Procedures

### Public Procedure

Use for endpoints that don't require authentication:

```typescript
import { publicProcedure } from '../trpc';

export const healthCheck = publicProcedure
  .query(() => {
    return { status: 'ok' };
  });
```

### Protected Procedure

Requires user to be authenticated. Throws `UNAUTHORIZED` error if not signed in.

```typescript
import { protectedProcedure } from '../trpc';

export const getProfile = protectedProcedure
  .query(({ ctx }) => {
    // ctx.user is guaranteed to exist
    return {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
    };
  });
```

### Admin Procedure

Requires user to have `admin` role. Throws `FORBIDDEN` error if not admin.

```typescript
import { adminProcedure } from '../trpc';

export const deleteUser = adminProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Only admins can execute this
    await db.delete(users).where(eq(users.id, input.userId));
    return { success: true };
  });
```

### Audited Procedure

Protected procedure with automatic audit logging. All changes are logged to the audit table.

```typescript
import { auditedProcedure } from '../trpc';

export const updateBatch = auditedProcedure
  .input(z.object({ id: z.string(), name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Changes will be automatically logged
    await db.update(batches)
      .set({ name: input.name })
      .where(eq(batches.id, input.id));
    return { success: true };
  });
```

### RBAC Procedure

Create a procedure that checks specific RBAC permissions using the `can()` function from the RBAC system:

```typescript
import { createRbacProcedure } from '../trpc';

// Requires 'update' permission on 'batches' entity
export const updateBatch = createRbacProcedure('update', 'batches')
  .input(z.object({ id: z.string(), name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await db.update(batches)
      .set({ name: input.name })
      .where(eq(batches.id, input.id));
    return { success: true };
  });
```

### Audited RBAC Procedure

Combines RBAC permission checking with automatic audit logging:

```typescript
import { createAuditedRbacProcedure } from '../trpc';

export const deleteBatch = createAuditedRbacProcedure('delete', 'batches')
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Permission checked + changes logged
    await db.delete(batches).where(eq(batches.id, input.id));
    return { success: true };
  });
```

### Permission Procedure

Create a procedure that requires a specific permission string:

```typescript
import { createPermissionProcedure } from '../trpc';

// Only users with 'batches:create' permission
export const createBatch = createPermissionProcedure('batches:create')
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const batch = await db.insert(batches).values({
      name: input.name,
      createdBy: ctx.user.id,
    });
    return batch;
  });
```

### Custom Audit Procedure

Create a procedure with custom audit configuration:

```typescript
import { createCustomAuditProcedure } from '../trpc';

export const softDeleteBatch = createCustomAuditProcedure(
  'batches',
  'soft_delete',
  async (recordId) => {
    // Custom data fetcher for audit log
    const batch = await db.select().from(batches).where(eq(batches.id, recordId));
    return batch[0];
  }
)
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await db.update(batches)
      .set({ deletedAt: new Date() })
      .where(eq(batches.id, input.id));
    return { success: true };
  });
```

## Error Handling

### Error Codes

- `UNAUTHORIZED` (401): User is not signed in
- `FORBIDDEN` (403): User doesn't have required role/permission
- `BAD_REQUEST` (400): Invalid input
- `NOT_FOUND` (404): Resource not found
- `INTERNAL_SERVER_ERROR` (500): Server error

### Error Messages

All auth-related procedures include descriptive error messages:

```typescript
throw new TRPCError({
  code: 'UNAUTHORIZED',
  message: 'You must be signed in to perform this action',
});

throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'You must be an admin to perform this action',
});

throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'You don\'t have permission to: batches:create',
});
```

## Role System

### Roles

- **Admin**: Full access to all resources and operations
- **Operator**: Can create and update batches, measurements, press runs
- **Viewer**: Read-only access

### Permissions

Current operator permissions:
- `batches:read`
- `batches:create`
- `batches:update`
- `measurements:create`
- `press_runs:create`

Admins have all permissions automatically.

## Example Router

```typescript
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';

export const batchRouter = router({
  // Public endpoint
  health: publicProcedure.query(() => ({ status: 'ok' })),

  // Authenticated users can list their batches
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'admin') {
      // Admins see all batches
      return await db.select().from(batches);
    }
    // Operators see only their own
    return await db.select()
      .from(batches)
      .where(eq(batches.createdBy, ctx.user.id));
  }),

  // Authenticated users can create batches
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await db.insert(batches).values({
        name: input.name,
        createdBy: ctx.user.id,
      });
      return batch;
    }),

  // Only admins can delete batches
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(batches).where(eq(batches.id, input.id));
      return { success: true };
    }),
});
```

## Testing

When testing procedures, provide a mock context:

```typescript
import { createTRPCCaller } from '../trpc';

const mockContext = {
  session: {
    user: {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    },
  },
  user: {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
  },
};

const caller = createTRPCCaller(mockContext);
const result = await caller.batch.list();
```

## Best Practices

1. **Use the most restrictive procedure** - Start with `adminProcedure` and relax if needed
2. **Add audit logging** - Use `auditedProcedure` for data-changing operations
3. **Check ownership** - Even in protected procedures, verify resource ownership
4. **Descriptive errors** - Always include helpful error messages
5. **Type safety** - Let TypeScript infer context types from procedures

## Security Considerations

- Session is verified on every request via NextAuth
- Role checks happen before procedure execution
- Audit logs track all data changes with user info
- Error messages don't leak sensitive information
- Rate limiting should be added for production
