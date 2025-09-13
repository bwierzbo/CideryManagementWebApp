# Role-Based Access Control (RBAC) Testing Suite

This directory contains comprehensive E2E tests for validating role-based access control throughout the Cidery Management application.

## Overview

The RBAC testing suite validates three user roles:
- **Admin**: Full system access including user management and system configuration
- **Operator**: Production workflow access with limited administrative privileges
- **Viewer**: Read-only access to operational data

## Test Structure

### Core Test Files

1. **`role-based-access.test.ts`** - Primary RBAC validation
   - Navigation item visibility per role
   - Page access restrictions
   - UI element role-based visibility
   - Cross-role navigation security

2. **`api-permissions.test.ts`** - API endpoint permission testing
   - HTTP method restrictions by role
   - Data access boundaries
   - Permission enforcement at API level
   - Security boundary validation

3. **`role-workflows.test.ts`** - Role-specific workflow testing
   - Admin: Full vendor management, user administration, system configuration
   - Operator: Production workflows (batches, measurements, packaging)
   - Viewer: Read-only data access with no modification capabilities

4. **`security-boundaries.test.ts`** - Comprehensive security validation
   - Authentication boundary testing
   - Authorization boundary testing
   - Input validation and injection prevention
   - Rate limiting and abuse prevention
   - Session and cookie security

5. **`session-management.test.ts`** - Session lifecycle and role transitions
   - Role switching and persistence
   - Session security and lifecycle
   - Permission changes and real-time updates
   - Cross-session security
   - Session recovery and error handling

## Role Permissions Summary

### Admin Role
- **Navigation**: Access to all pages including `/admin`
- **Features**:
  - User management (create, edit, delete users)
  - System configuration
  - Financial reporting
  - Full CRUD on all entities
- **API Access**: All endpoints including user management APIs

### Operator Role
- **Navigation**: Production pages (`/purchasing`, `/pressing`, `/cellar`, `/packaging`)
- **Features**:
  - Create/edit vendors (but cannot delete)
  - Full production workflow management
  - Create batches, record measurements, manage packaging
  - View financial data (read-only)
- **API Access**: Production APIs, limited vendor operations, no user management

### Viewer Role
- **Navigation**: Limited to `/dashboard`, `/cellar`, `/packaging` (read-only)
- **Features**:
  - View operational data only
  - No create, edit, or delete capabilities
  - Basic dashboard statistics
- **API Access**: Read-only endpoints, no modification operations

## Test Execution

### Prerequisites
- PostgreSQL database running locally
- Test users created via global setup
- Application server running on expected ports

### Running Tests

```bash
# Run all RBAC tests
pnpm test:e2e tests/e2e/rbac/

# Run specific test suites
pnpm test:e2e tests/e2e/rbac/role-based-access.test.ts
pnpm test:e2e tests/e2e/rbac/api-permissions.test.ts
pnpm test:e2e tests/e2e/rbac/security-boundaries.test.ts

# Run with debugging
pnpm test:e2e tests/e2e/rbac/ --debug
```

### Test Data Setup

Tests use predefined test users from `auth-helpers.ts`:
- `test-admin@example.com` (admin role)
- `test-operator@example.com` (operator role)
- `test-viewer@example.com` (viewer role)

## Key Testing Patterns

### Page Access Validation
```typescript
// Test that viewer cannot access admin pages
await authHelper.loginAs('viewer');
await page.goto('/admin');

const isBlocked = !page.url().includes('/admin') ||
                 await page.locator('[data-testid="access-denied"]').isVisible();
expect(isBlocked).toBe(true);
```

### API Permission Testing
```typescript
// Test that viewer cannot make create API calls
const response = await page.evaluate(async () => {
  const response = await fetch('/api/trpc/vendor.create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Vendor' })
  });
  return { status: response.status };
});

expect(response.status).toBeGreaterThanOrEqual(400);
```

### UI Element Visibility
```typescript
// Test that operators don't see admin navigation
await authHelper.loginAs('operator');
await page.goto('/dashboard');

await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
```

## Expected Test Data-TestIds

The tests expect the following data-testid attributes in the UI:

### Navigation
- `nav-dashboard` - Dashboard navigation
- `nav-purchasing` - Purchasing navigation
- `nav-pressing` - Pressing navigation
- `nav-cellar` - Cellar navigation
- `nav-packaging` - Packaging navigation
- `nav-admin` - Admin navigation

### Actions
- `create-*` - Create buttons (e.g., `create-vendor`, `create-batch`)
- `edit-*` - Edit buttons
- `delete-*` - Delete buttons
- `submit` - Form submit buttons

### Content Areas
- `dashboard-stats` - Dashboard statistics
- `access-denied` - Access denied message
- `error` - Error messages
- `success` - Success messages

### User Management
- `user-management` - User management section
- `user-menu` - User menu dropdown
- `logout-button` - Logout button

## Integration with CI/CD

These tests are designed to run in CI/CD pipelines with:
- Database seeded with test data
- Test users pre-created
- Application fully deployed and accessible

## Security Testing Coverage

The test suite validates:
- ✅ Authentication boundaries (login/logout)
- ✅ Authorization boundaries (role-based access)
- ✅ Session management and timeout
- ✅ CSRF protection
- ✅ XSS prevention
- ✅ SQL injection prevention
- ✅ Rate limiting
- ✅ Input validation
- ✅ Data leakage prevention
- ✅ Privilege escalation prevention

## Maintenance

When adding new features or pages:
1. Update role permissions in `/packages/lib/src/rbac/roles.ts`
2. Add corresponding test cases in the appropriate test files
3. Update navigation and UI element test coverage
4. Verify API endpoint permissions are tested

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check connection string in `.env.local`
   - Verify test database exists

2. **Test User Issues**
   - Check global setup is creating test users
   - Verify user roles are correctly assigned
   - Ensure password hashing matches application

3. **UI Element Not Found**
   - Verify data-testid attributes exist in components
   - Check element visibility timing
   - Add appropriate wait conditions

4. **API Permission False Positives**
   - Verify API middleware is enforcing permissions
   - Check session/authentication middleware order
   - Validate RBAC matrix implementation

### Debug Tips

- Use `await page.pause()` to inspect UI state
- Enable `--debug` flag for step-by-step execution
- Check network tab for API call status codes
- Verify console for JavaScript errors