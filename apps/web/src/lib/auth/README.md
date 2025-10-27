# Authentication & Authorization Utilities

This directory contains utilities for authentication and role-based access control (RBAC) in the Cidery Management App.

## Server-Side Utilities (`server.ts`)

Use these utilities in Server Components and Server Actions.

### `getSession()`
Get the current session on the server.

```typescript
import { getSession } from '@/lib/auth/server';

export default async function MyPage() {
  const session = await getSession();

  if (!session) {
    return <div>Not signed in</div>;
  }

  return <div>Hello {session.user.name}</div>;
}
```

### `requireAuth()`
Require authentication. Automatically redirects to `/auth/signin` if not authenticated.

```typescript
import { requireAuth } from '@/lib/auth/server';

export default async function ProtectedPage() {
  const session = await requireAuth();

  // User is guaranteed to be authenticated here
  return <div>Welcome {session.user.name}</div>;
}
```

### `requireRole(role)`
Require a specific role. Redirects to `/unauthorized` if user doesn't have the role.

```typescript
import { requireRole } from '@/lib/auth/server';

export default async function OperatorPage() {
  const session = await requireRole('operator');

  // User has operator or admin role
  return <div>Operator Dashboard</div>;
}
```

### `requireAdmin()`
Require admin role. Redirects to `/unauthorized` if user is not an admin.

```typescript
import { requireAdmin } from '@/lib/auth/server';

export default async function AdminPage() {
  const session = await requireAdmin();

  // User is guaranteed to be admin
  return <div>Admin Panel</div>;
}
```

### `hasPermission(permission)`
Check if the current user has a specific permission.

```typescript
import { hasPermission } from '@/lib/auth/server';

export default async function BatchPage() {
  const canDelete = await hasPermission('batches:delete');

  return (
    <div>
      {canDelete && <button>Delete Batch</button>}
    </div>
  );
}
```

## Client-Side Hooks (`hooks.ts`)

Use these hooks in Client Components.

### `useUser()`
Get the current user with loading and authentication status.

```typescript
'use client';

import { useUser } from '@/lib/auth/hooks';

export function UserProfile() {
  const { user, isLoading, isAuthenticated } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;

  return <div>Hello {user?.name}</div>;
}
```

### `useIsAdmin()`
Check if the current user is an admin.

```typescript
'use client';

import { useIsAdmin } from '@/lib/auth/hooks';

export function AdminActions() {
  const isAdmin = useIsAdmin();

  return (
    <div>
      {isAdmin && <button>Delete All</button>}
    </div>
  );
}
```

### `useHasRole(role)`
Check if the user has a specific role.

```typescript
'use client';

import { useHasRole } from '@/lib/auth/hooks';

export function OperatorActions() {
  const isOperator = useHasRole('operator');

  return (
    <div>
      {isOperator && <button>Create Batch</button>}
    </div>
  );
}
```

### `useHasPermission(permission)`
Check if the user has a specific permission.

```typescript
'use client';

import { useHasPermission } from '@/lib/auth/hooks';

export function BatchActions() {
  const canCreate = useHasPermission('batches:create');
  const canDelete = useHasPermission('batches:delete');

  return (
    <div>
      {canCreate && <button>Create</button>}
      {canDelete && <button>Delete</button>}
    </div>
  );
}
```

## Permission System

Current permissions:

**Admin**: Has all permissions

**Operator**: Has these permissions:
- `batches:read`
- `batches:create`
- `batches:update`
- `measurements:create`
- `press_runs:create`

**Viewer**: No special permissions (read-only)

To add more permissions, update both `server.ts` and `hooks.ts` files.

## Examples

### Server Component with Auth

```typescript
// app/batches/page.tsx
import { requireAuth } from '@/lib/auth/server';

export default async function BatchesPage() {
  const session = await requireAuth();

  return (
    <div>
      <h1>Batches</h1>
      <p>User: {session.user.name}</p>
    </div>
  );
}
```

### Admin-Only Page

```typescript
// app/admin/settings/page.tsx
import { requireAdmin } from '@/lib/auth/server';

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div>
      <h1>Admin Settings</h1>
      <p>Only admins can see this</p>
    </div>
  );
}
```

### Client Component with Role Check

```typescript
// components/batch-actions.tsx
'use client';

import { useIsAdmin, useHasPermission } from '@/lib/auth/hooks';
import { Button } from '@/components/ui/button';

export function BatchActions() {
  const isAdmin = useIsAdmin();
  const canDelete = useHasPermission('batches:delete');

  return (
    <div className="flex gap-2">
      {isAdmin && (
        <Button variant="destructive">
          Delete Batch
        </Button>
      )}
      {canDelete && (
        <Button variant="outline">
          Archive Batch
        </Button>
      )}
    </div>
  );
}
```

## Error Handling

- **Not authenticated**: Redirects to `/auth/signin`
- **Not authorized**: Redirects to `/unauthorized`
- **Middleware**: Also protects routes at the edge
