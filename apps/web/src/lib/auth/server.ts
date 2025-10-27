import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Get the current session on the server
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Require authentication - redirects to signin if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return session;
}

/**
 * Require specific role - redirects if user doesn't have required role
 */
export async function requireRole(role: 'admin' | 'operator') {
  const session = await requireAuth();

  if (session.user.role !== role && session.user.role !== 'admin') {
    // Admin can access everything, others need specific role
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Require admin role
 */
export async function requireAdmin() {
  return await requireRole('admin');
}

/**
 * Check if user has permission
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession();

  if (!session?.user) {
    return false;
  }

  // Admin has all permissions
  if (session.user.role === 'admin') {
    return true;
  }

  // Add your permission logic here
  // For now, operators have limited permissions
  const operatorPermissions = [
    'batches:read',
    'batches:create',
    'batches:update',
    'measurements:create',
    'press_runs:create',
  ];

  return operatorPermissions.includes(permission);
}
