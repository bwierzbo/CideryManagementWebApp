import { describe, it, expect } from 'vitest'
import {
  can,
  getPermissions,
  getAllowedActions,
  hasAccess,
  getAccessibleEntities,
  isAdministrativeRole,
  canPerformBulkOperations,
  getRoleLevel,
  hasHigherPermissions,
  RBAC_MATRIX
} from '../../rbac/roles'

describe('RBAC System', () => {
  describe('can function', () => {
    describe('admin permissions', () => {
      it('should allow admin to perform all actions on vendors', () => {
        expect(can('admin', 'create', 'vendor')).toBe(true)
        expect(can('admin', 'read', 'vendor')).toBe(true)
        expect(can('admin', 'update', 'vendor')).toBe(true)
        expect(can('admin', 'delete', 'vendor')).toBe(true)
        expect(can('admin', 'list', 'vendor')).toBe(true)
      })

      it('should allow admin to perform all actions on users', () => {
        expect(can('admin', 'create', 'user')).toBe(true)
        expect(can('admin', 'read', 'user')).toBe(true)
        expect(can('admin', 'update', 'user')).toBe(true)
        expect(can('admin', 'delete', 'user')).toBe(true)
        expect(can('admin', 'list', 'user')).toBe(true)
      })

      it('should allow admin to manage all production entities', () => {
        const entities = ['purchase', 'press_run', 'batch', 'vessel', 'inventory', 'measurement', 'package']
        const actions = ['create', 'read', 'update', 'delete', 'list']
        
        entities.forEach(entity => {
          actions.forEach(action => {
            expect(can('admin', action as any, entity as any)).toBe(true)
          })
        })
      })

      it('should only allow admin to read audit logs', () => {
        expect(can('admin', 'read', 'audit_log')).toBe(true)
        expect(can('admin', 'list', 'audit_log')).toBe(true)
        expect(can('admin', 'create', 'audit_log')).toBe(false)
        expect(can('admin', 'update', 'audit_log')).toBe(false)
        expect(can('admin', 'delete', 'audit_log')).toBe(false)
      })
    })

    describe('viewer permissions', () => {
      it('should only allow viewer to read and list entities', () => {
        const entities = ['vendor', 'user', 'apple_variety', 'purchase', 'press_run', 'batch', 'vessel', 'inventory', 'measurement', 'package', 'cost', 'report', 'audit_log']

        entities.forEach(entity => {
          expect(can('viewer', 'read', entity as any)).toBe(true)
          expect(can('viewer', 'list', entity as any)).toBe(true)
          expect(can('viewer', 'create', entity as any)).toBe(false)
          expect(can('viewer', 'update', entity as any)).toBe(false)
          expect(can('viewer', 'delete', entity as any)).toBe(false)
        })
      })

      it('should have no create, update, or delete permissions for any entity', () => {
        const entities = ['vendor', 'user', 'apple_variety', 'purchase', 'press_run', 'batch', 'vessel', 'inventory', 'measurement', 'package', 'cost', 'report', 'audit_log']
        const writeActions = ['create', 'update', 'delete']

        entities.forEach(entity => {
          writeActions.forEach(action => {
            expect(can('viewer', action as any, entity as any)).toBe(false)
          })
        })
      })

      it('should be able to view all operational data but not modify', () => {
        expect(can('viewer', 'read', 'batch')).toBe(true)
        expect(can('viewer', 'list', 'inventory')).toBe(true)
        expect(can('viewer', 'read', 'purchase')).toBe(true)
        expect(can('viewer', 'update', 'batch')).toBe(false)
        expect(can('viewer', 'delete', 'inventory')).toBe(false)
        expect(can('viewer', 'create', 'purchase')).toBe(false)
      })
    })

    describe('operator permissions', () => {
      it('should allow operator to create/update vendors but not delete them', () => {
        expect(can('operator', 'create', 'vendor')).toBe(true)
        expect(can('operator', 'read', 'vendor')).toBe(true)
        expect(can('operator', 'update', 'vendor')).toBe(true)
        expect(can('operator', 'list', 'vendor')).toBe(true)
        expect(can('operator', 'delete', 'vendor')).toBe(false)
      })

      it('should only allow operator to view users', () => {
        expect(can('operator', 'read', 'user')).toBe(true)
        expect(can('operator', 'list', 'user')).toBe(true)
        expect(can('operator', 'create', 'user')).toBe(false)
        expect(can('operator', 'update', 'user')).toBe(false)
        expect(can('operator', 'delete', 'user')).toBe(false)
      })

      it('should allow operator to manage production entities', () => {
        const entities = ['apple_variety', 'purchase', 'press_run', 'batch', 'vessel', 'inventory', 'measurement', 'package']
        const actions = ['create', 'read', 'update', 'delete', 'list']
        
        entities.forEach(entity => {
          actions.forEach(action => {
            expect(can('operator', action as any, entity as any)).toBe(true)
          })
        })
      })

      it('should only allow operator to view costs', () => {
        expect(can('operator', 'read', 'cost')).toBe(true)
        expect(can('operator', 'list', 'cost')).toBe(true)
        expect(can('operator', 'create', 'cost')).toBe(false)
        expect(can('operator', 'update', 'cost')).toBe(false)
        expect(can('operator', 'delete', 'cost')).toBe(false)
      })

      it('should allow operator to create and view reports but not delete them', () => {
        expect(can('operator', 'create', 'report')).toBe(true)
        expect(can('operator', 'read', 'report')).toBe(true)
        expect(can('operator', 'list', 'report')).toBe(true)
        expect(can('operator', 'update', 'report')).toBe(false)
        expect(can('operator', 'delete', 'report')).toBe(false)
      })
    })

    it('should return false for invalid roles', () => {
      expect(can('invalid_role' as any, 'read', 'vendor')).toBe(false)
    })

    it('should return false for entities not in permissions', () => {
      // Test with a hypothetical entity that doesn't exist
      expect(can('admin', 'read', 'nonexistent_entity' as any)).toBe(false)
    })
  })

  describe('getPermissions', () => {
    it('should return all permissions for admin', () => {
      const adminPerms = getPermissions('admin')
      expect(adminPerms).toBeDefined()
      expect(adminPerms.length).toBeGreaterThan(10)
      
      // Check that admin has permissions for key entities
      const vendorPerm = adminPerms.find(p => p.entity === 'vendor')
      expect(vendorPerm).toBeDefined()
      expect(vendorPerm?.actions).toContain('delete')
    })

    it('should return all permissions for operator', () => {
      const operatorPerms = getPermissions('operator')
      expect(operatorPerms).toBeDefined()
      expect(operatorPerms.length).toBeGreaterThan(10)
      
      // Check that operator has limited permissions for vendors
      const vendorPerm = operatorPerms.find(p => p.entity === 'vendor')
      expect(vendorPerm).toBeDefined()
      expect(vendorPerm?.actions).not.toContain('delete')
    })

    it('should return empty array for invalid role', () => {
      expect(getPermissions('invalid_role' as any)).toEqual([])
    })
  })

  describe('getAllowedActions', () => {
    it('should return all actions admin can perform on vendors', () => {
      const actions = getAllowedActions('admin', 'vendor')
      expect(actions).toContain('create')
      expect(actions).toContain('read')
      expect(actions).toContain('update')
      expect(actions).toContain('delete')
      expect(actions).toContain('list')
    })

    it('should return limited actions operator can perform on vendors', () => {
      const actions = getAllowedActions('operator', 'vendor')
      expect(actions).toContain('create')
      expect(actions).toContain('read')
      expect(actions).toContain('update')
      expect(actions).toContain('list')
      expect(actions).not.toContain('delete')
    })

    it('should return empty array for invalid combinations', () => {
      expect(getAllowedActions('invalid_role' as any, 'vendor')).toEqual([])
      expect(getAllowedActions('admin', 'nonexistent_entity' as any)).toEqual([])
    })
  })

  describe('hasAccess', () => {
    it('should return true when role has any access to entity', () => {
      expect(hasAccess('admin', 'vendor')).toBe(true)
      expect(hasAccess('operator', 'vendor')).toBe(true)
      expect(hasAccess('operator', 'user')).toBe(true) // Can read users
    })

    it('should return false when role has no access', () => {
      expect(hasAccess('invalid_role' as any, 'vendor')).toBe(false)
    })
  })

  describe('getAccessibleEntities', () => {
    it('should return all entities admin can access', () => {
      const entities = getAccessibleEntities('admin')
      expect(entities).toContain('vendor')
      expect(entities).toContain('user')
      expect(entities).toContain('purchase')
      expect(entities).toContain('batch')
      expect(entities).toContain('audit_log')
    })

    it('should return entities operator can access', () => {
      const entities = getAccessibleEntities('operator')
      expect(entities).toContain('vendor')
      expect(entities).toContain('user')
      expect(entities).toContain('purchase')
      expect(entities).toContain('batch')
      expect(entities).toContain('audit_log')
    })

    it('should return empty array for invalid role', () => {
      expect(getAccessibleEntities('invalid_role' as any)).toEqual([])
    })
  })

  describe('isAdministrativeRole', () => {
    it('should identify admin as administrative', () => {
      expect(isAdministrativeRole('admin')).toBe(true)
    })

    it('should identify operator as non-administrative', () => {
      expect(isAdministrativeRole('operator')).toBe(false)
    })

    it('should identify viewer as non-administrative', () => {
      expect(isAdministrativeRole('viewer')).toBe(false)
    })
  })

  describe('canPerformBulkOperations', () => {
    it('should allow admin to perform bulk operations', () => {
      expect(canPerformBulkOperations('admin')).toBe(true)
    })

    it('should not allow operator to perform bulk operations', () => {
      expect(canPerformBulkOperations('operator')).toBe(false)
    })

    it('should not allow viewer to perform bulk operations', () => {
      expect(canPerformBulkOperations('viewer')).toBe(false)
    })
  })

  describe('getRoleLevel', () => {
    it('should return correct levels for each role', () => {
      expect(getRoleLevel('admin')).toBe(100)
      expect(getRoleLevel('operator')).toBe(50)
      expect(getRoleLevel('viewer')).toBe(10)
    })

    it('should return 0 for invalid roles', () => {
      expect(getRoleLevel('invalid_role' as any)).toBe(0)
    })
  })

  describe('hasHigherPermissions', () => {
    it('should correctly compare role permissions', () => {
      expect(hasHigherPermissions('admin', 'operator')).toBe(true)
      expect(hasHigherPermissions('operator', 'admin')).toBe(false)
      expect(hasHigherPermissions('admin', 'admin')).toBe(false)
      expect(hasHigherPermissions('operator', 'viewer')).toBe(true)
      expect(hasHigherPermissions('viewer', 'operator')).toBe(false)
      expect(hasHigherPermissions('admin', 'viewer')).toBe(true)
      expect(hasHigherPermissions('viewer', 'admin')).toBe(false)
    })
  })

  describe('RBAC Matrix Validation', () => {
    it('should have consistent matrix structure', () => {
      Object.entries(RBAC_MATRIX).forEach(([role, permissions]) => {
        permissions.forEach(permission => {
          expect(permission).toHaveProperty('entity')
          expect(permission).toHaveProperty('actions')
          expect(Array.isArray(permission.actions)).toBe(true)
          expect(permission.actions.length).toBeGreaterThan(0)
        })
      })
    })

    it('should ensure admin has more permissions than operator', () => {
      const adminEntities = getAccessibleEntities('admin')
      const operatorEntities = getAccessibleEntities('operator')
      
      // Admin should have access to all entities operator has
      operatorEntities.forEach(entity => {
        expect(adminEntities).toContain(entity)
      })
      
      // Admin should have more delete permissions
      let adminDeleteCount = 0
      let operatorDeleteCount = 0
      
      adminEntities.forEach(entity => {
        if (getAllowedActions('admin', entity).includes('delete')) {
          adminDeleteCount++
        }
        if (getAllowedActions('operator', entity).includes('delete')) {
          operatorDeleteCount++
        }
      })
      
      expect(adminDeleteCount).toBeGreaterThan(operatorDeleteCount)
    })

    it('should validate audit log restrictions', () => {
      // Neither role should be able to modify audit logs
      expect(can('admin', 'create', 'audit_log')).toBe(false)
      expect(can('admin', 'update', 'audit_log')).toBe(false)
      expect(can('admin', 'delete', 'audit_log')).toBe(false)
      
      expect(can('operator', 'create', 'audit_log')).toBe(false)
      expect(can('operator', 'update', 'audit_log')).toBe(false)
      expect(can('operator', 'delete', 'audit_log')).toBe(false)
      
      // Both should be able to read audit logs
      expect(can('admin', 'read', 'audit_log')).toBe(true)
      expect(can('operator', 'read', 'audit_log')).toBe(true)
    })

    it('should validate operator restrictions on critical entities', () => {
      // Operator should not be able to delete vendors or manage users
      expect(can('operator', 'delete', 'vendor')).toBe(false)
      expect(can('operator', 'create', 'user')).toBe(false)
      expect(can('operator', 'update', 'user')).toBe(false)
      expect(can('operator', 'delete', 'user')).toBe(false)
      
      // But operator should still be able to manage production entities
      expect(can('operator', 'create', 'purchase')).toBe(true)
      expect(can('operator', 'delete', 'batch')).toBe(true)
      expect(can('operator', 'update', 'inventory')).toBe(true)
    })

    it('should ensure all core entities are covered', () => {
      const coreEntities = [
        'vendor', 'user', 'apple_variety', 'purchase', 'press_run', 
        'batch', 'vessel', 'inventory', 'measurement', 'package', 
        'cost', 'report', 'audit_log'
      ]
      
      coreEntities.forEach(entity => {
        expect(hasAccess('admin', entity as any)).toBe(true)
        // Most entities should be accessible to operators too
        if (!['cost'].includes(entity)) {
          expect(hasAccess('operator', entity as any)).toBe(true)
        }
      })
    })
  })
})