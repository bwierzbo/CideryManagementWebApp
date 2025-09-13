/**
 * Role-Based Access Control (RBAC) system for the Cidery Management App
 * Defines user roles and their permissions for different entities and actions
 */

// Available user roles in the system
export type UserRole = 'admin' | 'operator' | 'viewer'

// Available actions that can be performed
export type Action = 'create' | 'read' | 'update' | 'delete' | 'list'

// Available entities in the system
export type Entity = 
  | 'vendor' 
  | 'user' 
  | 'apple_variety' 
  | 'purchase' 
  | 'press_run' 
  | 'batch' 
  | 'vessel' 
  | 'inventory' 
  | 'measurement' 
  | 'package' 
  | 'cost' 
  | 'report'
  | 'audit_log'

// Permission definition
type Permission = {
  entity: Entity
  actions: Action[]
}

// RBAC Matrix - defines what each role can do
export const RBAC_MATRIX: Record<UserRole, Permission[]> = {
  admin: [
    // Admins have full access to everything
    { entity: 'vendor', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'user', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'apple_variety', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'purchase', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'press_run', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'batch', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'vessel', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'inventory', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'measurement', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'package', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'cost', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'report', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'audit_log', actions: ['read', 'list'] } // Even admins can't modify audit logs
  ],
  
  operator: [
    // Operators can create/edit but not delete vendors/users
    { entity: 'vendor', actions: ['create', 'read', 'update', 'list'] },
    { entity: 'user', actions: ['read', 'list'] }, // Can only view users, not manage them
    { entity: 'apple_variety', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'purchase', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'press_run', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'batch', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'vessel', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'inventory', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'measurement', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'package', actions: ['create', 'read', 'update', 'delete', 'list'] },
    { entity: 'cost', actions: ['read', 'list'] }, // Can view costs but not modify
    { entity: 'report', actions: ['create', 'read', 'list'] }, // Can generate and view reports
    { entity: 'audit_log', actions: ['read', 'list'] } // Can view audit logs
  ],

  viewer: [
    // Viewers have read-only access to operational data
    { entity: 'vendor', actions: ['read', 'list'] },
    { entity: 'user', actions: ['read', 'list'] }, // Can only view users
    { entity: 'apple_variety', actions: ['read', 'list'] },
    { entity: 'purchase', actions: ['read', 'list'] },
    { entity: 'press_run', actions: ['read', 'list'] },
    { entity: 'batch', actions: ['read', 'list'] },
    { entity: 'vessel', actions: ['read', 'list'] },
    { entity: 'inventory', actions: ['read', 'list'] },
    { entity: 'measurement', actions: ['read', 'list'] },
    { entity: 'package', actions: ['read', 'list'] },
    { entity: 'cost', actions: ['read', 'list'] }, // Can view costs but not modify
    { entity: 'report', actions: ['read', 'list'] }, // Can view reports but not generate
    { entity: 'audit_log', actions: ['read', 'list'] } // Can view audit logs
  ]
}

/**
 * Check if a user role has permission to perform an action on an entity
 * 
 * @param userRole - The role of the user
 * @param action - The action to be performed
 * @param entity - The entity the action will be performed on
 * @returns boolean indicating if the action is allowed
 * 
 * @example
 * ```typescript
 * const canDelete = can('operator', 'delete', 'vendor'); // Returns false
 * const canCreate = can('operator', 'create', 'purchase'); // Returns true
 * const adminCanDelete = can('admin', 'delete', 'vendor'); // Returns true
 * ```
 */
export function can(userRole: UserRole, action: Action, entity: Entity): boolean {
  const rolePermissions = RBAC_MATRIX[userRole]
  
  if (!rolePermissions) {
    return false
  }
  
  const entityPermission = rolePermissions.find(permission => permission.entity === entity)
  
  if (!entityPermission) {
    return false
  }
  
  return entityPermission.actions.includes(action)
}

/**
 * Get all permissions for a specific user role
 * 
 * @param userRole - The role to get permissions for
 * @returns Array of permissions for the role
 */
export function getPermissions(userRole: UserRole): Permission[] {
  return RBAC_MATRIX[userRole] || []
}

/**
 * Get all actions a role can perform on a specific entity
 * 
 * @param userRole - The role to check
 * @param entity - The entity to check permissions for
 * @returns Array of allowed actions
 */
export function getAllowedActions(userRole: UserRole, entity: Entity): Action[] {
  const rolePermissions = RBAC_MATRIX[userRole]
  
  if (!rolePermissions) {
    return []
  }
  
  const entityPermission = rolePermissions.find(permission => permission.entity === entity)
  
  return entityPermission?.actions || []
}

/**
 * Check if a role has any permissions for an entity
 * 
 * @param userRole - The role to check
 * @param entity - The entity to check
 * @returns boolean indicating if the role has any access to the entity
 */
export function hasAccess(userRole: UserRole, entity: Entity): boolean {
  const allowedActions = getAllowedActions(userRole, entity)
  return allowedActions.length > 0
}

/**
 * Get all entities that a role has access to
 * 
 * @param userRole - The role to check
 * @returns Array of entities the role can access
 */
export function getAccessibleEntities(userRole: UserRole): Entity[] {
  const rolePermissions = RBAC_MATRIX[userRole]
  
  if (!rolePermissions) {
    return []
  }
  
  return rolePermissions.map(permission => permission.entity)
}

/**
 * Check if a role is considered administrative
 * Administrative roles have broader permissions and access to sensitive operations
 * 
 * @param userRole - The role to check
 * @returns boolean indicating if the role is administrative
 */
export function isAdministrativeRole(userRole: UserRole): boolean {
  return userRole === 'admin'
}

/**
 * Check if a role can perform bulk operations (affects multiple records)
 * Only administrative roles should be able to perform bulk operations
 * 
 * @param userRole - The role to check
 * @returns boolean indicating if bulk operations are allowed
 */
export function canPerformBulkOperations(userRole: UserRole): boolean {
  return isAdministrativeRole(userRole)
}

/**
 * Get role hierarchy level (higher number = more permissions)
 * Useful for UI display and role comparison
 * 
 * @param userRole - The role to get level for
 * @returns Numeric level of the role
 */
export function getRoleLevel(userRole: UserRole): number {
  const roleLevels: Record<UserRole, number> = {
    admin: 100,
    operator: 50,
    viewer: 10
  }
  
  return roleLevels[userRole] || 0
}

/**
 * Check if one role has higher permissions than another
 * 
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @returns boolean indicating if role1 has higher permissions than role2
 */
export function hasHigherPermissions(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2)
}