'use client';

import { useSession } from 'next-auth/react';

/**
 * Hook to get current user
 */
export function useUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isLoading: status === 'loading',
    isAuthenticated: !!session?.user,
  };
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const { user } = useUser();
  return user?.role === 'admin';
}

/**
 * Hook to check if user has specific role
 */
export function useHasRole(role: 'admin' | 'operator') {
  const { user } = useUser();
  return user?.role === role || user?.role === 'admin';
}

/**
 * Hook to check permissions
 */
export function useHasPermission(permission: string) {
  const { user } = useUser();

  if (!user) return false;

  // Admin has all permissions
  if (user.role === 'admin') return true;

  // Operator permissions
  const operatorPermissions = [
    'batches:read',
    'batches:create',
    'batches:update',
    'measurements:create',
    'press_runs:create',
  ];

  return operatorPermissions.includes(permission);
}
