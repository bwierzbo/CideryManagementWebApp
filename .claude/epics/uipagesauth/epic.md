---
name: uipagesauth
status: backlog
created: 2025-09-13T15:58:19Z
progress: 0%
prd: .claude/prds/uipagesauth.md
github: https://github.com/bwierzbo/CideryManagementWebApp/issues/15
---

# Epic: UI Pages Auth

## Overview

Implement comprehensive authentication system and three core operational pages (Inventory, Reports, Recipes) for the cidery management application. This epic leverages existing NextAuth scaffolding, tRPC procedures, and audit logging to deliver secure, role-based access to critical business workflows within 4-6 weeks.

## Architecture Decisions

### Authentication Strategy
- **NextAuth.js Integration**: Extend existing Auth.js setup with credential provider and role-based session management
- **Route Protection**: Next.js 15 App Router middleware for page-level authentication guards
- **Session Management**: Database-backed sessions with automatic expiration and role persistence

### Frontend Architecture
- **Page Structure**: App Router pages under `/inventory`, `/reports`, `/recipes` with role-specific layouts
- **Component Reuse**: Leverage existing shadcn/ui components and establish consistent patterns
- **State Management**: TanStack Query for server state, React Hook Form for form state
- **Authorization**: Component-level role guards using session context

### Backend Integration
- **tRPC Procedures**: Extend existing routers with inventory, reports, and recipes endpoints
- **Database Schema**: Leverage existing Drizzle schemas, add recipes table and inventory movement tracking
- **Audit Logging**: Integrate with existing audit system for 100% mutation coverage
- **Export Services**: PDF generation for reports using existing patterns

## Technical Approach

### Frontend Components

**Authentication Components**
- Enhanced sign-in page with credential validation
- Session provider with role context
- Route protection middleware and unauthorized redirect handling

**Inventory Management UI**
- Inventory list with search, filter, and pagination
- Movement recording form with validation
- Movement history timeline with audit attribution
- Admin-only correction/deletion capabilities

**Reports Management UI**
- COGS breakdown table with date filtering
- Export buttons (CSV/PDF) with role-based visibility
- Batch selection and historical data navigation
- Read-only display for Operators, admin controls for cost snapshots

**Recipes Management UI**
- Recipe list with search and categorization
- Recipe detail view with ingredients and process steps
- Admin CRUD forms with validation
- Operator "Apply Recipe" integration with batch creation

### Backend Services

**Authentication Services**
- NextAuth configuration with credential provider
- Role-based session management and token handling
- Middleware for route protection and role validation

**Inventory API Endpoints**
```typescript
// Extend existing inventory router
inventoryRouter = {
  list: // Get inventory with filtering
  getMovements: // Get movement history
  addMovement: // Record new movement
  updateMovement: // Admin corrections
  deleteMovement: // Admin deletions
}
```

**Reports API Endpoints**
```typescript
// New reports router
reportsRouter = {
  getCOGS: // Get batch COGS breakdown
  exportCSV: // Generate CSV export
  exportPDF: // Generate PDF export
  triggerSnapshot: // Admin-only cost recalculation
}
```

**Recipes API Endpoints**
```typescript
// New recipes router
recipesRouter = {
  list: // Get all recipes
  get: // Get single recipe
  create: // Admin-only creation
  update: // Admin-only updates
  delete: // Admin-only deletion
  apply: // Apply recipe to batch
}
```

### Infrastructure

**Database Schema Extensions**
- Add `recipes` table with ingredients and process steps
- Extend inventory movement tracking with audit attribution
- Leverage existing audit logging for all mutations

**Authentication Infrastructure**
- NextAuth session management with database persistence
- Role-based middleware integration
- Secure credential handling and session encryption

## Implementation Strategy

### Phase 1: Authentication Foundation (Week 1)
- Configure NextAuth with credentials and role management
- Implement route protection middleware
- Create authenticated layouts and navigation

### Phase 2: Core Pages (Weeks 2-3)
- Build Inventory page with movement tracking
- Implement Reports page with COGS display
- Create Recipes page with CRUD operations
- Parallel development after auth foundation complete

### Phase 3: Integration & Polish (Week 4)
- Role-based feature toggles and permissions
- Export functionality (CSV/PDF)
- Recipe application to batch workflow
- Performance optimization and error handling

### Risk Mitigation
- **Authentication Complexity**: Use existing Auth.js patterns, minimal custom code
- **Performance**: Implement pagination and caching for large datasets
- **Role Management**: Clear separation of Admin/Operator capabilities
- **Data Consistency**: Leverage existing audit system and transaction patterns

## Task Breakdown Preview

High-level task categories that will be created:
- [ ] Authentication & Route Protection: NextAuth configuration, middleware, session management
- [ ] Database Schema & API: Recipes table, extended inventory endpoints, reports router
- [ ] Inventory Management Page: List, movements, search, admin corrections
- [ ] Reports Management Page: COGS display, filtering, CSV/PDF export
- [ ] Recipes Management Page: CRUD operations, recipe application
- [ ] Integration & Testing: Role enforcement, audit logging, end-to-end workflows

## Dependencies

### External Dependencies
- NextAuth.js configuration and credential provider setup
- Existing database schema with inventory and audit tables
- PDF generation library for report exports
- COGS calculation logic implementation

### Internal Dependencies
- Existing tRPC router patterns and procedure structure
- Audit logging system integration for mutation tracking
- shadcn/ui component library and design system
- RBAC system with Admin/Operator role definitions

### Prerequisite Work
- Database migrations for recipes table
- COGS calculation service accessibility
- Test data seeding for development and demonstration

## Success Criteria (Technical)

### Performance Benchmarks
- Page load times <2 seconds for authenticated pages
- Inventory movement recording <1 second response time
- Report generation <5 seconds for standard date ranges
- Support 50+ concurrent users efficiently

### Quality Gates
- 100% authentication coverage on protected routes
- Zero unauthorized access bypasses
- Complete audit trail for all mutations
- Role-based feature visibility enforcement

### Acceptance Criteria
- Operator can complete full workflow: login → inventory → reports → recipes
- Admin can perform management tasks: corrections, exports, recipe CRUD
- All pages mobile-responsive and consistent with design system
- Integration with existing batch creation workflow for recipe application

## Estimated Effort

### Overall Timeline: 4-6 weeks
- **Week 1**: Authentication foundation and route protection
- **Weeks 2-3**: Core page development (parallel after auth)
- **Week 4**: Integration, testing, and polish
- **Weeks 5-6**: Buffer for refinement and edge cases

### Resource Requirements
- 1 full-stack developer (primary)
- Existing UI/UX patterns and component library
- Database access for schema extensions

### Critical Path Items
1. NextAuth configuration and role management
2. Database schema extensions for recipes
3. tRPC router extensions for new endpoints
4. Page-level authentication middleware
5. Recipe application integration with batch workflow

## Tasks Created
- [ ] #16 - Authentication & Route Protection (parallel: false)
- [ ] #17 - Database Schema & API Extensions (parallel: true)
- [ ] #18 - Inventory Management Page (parallel: false)
- [ ] #19 - Reports Management Page (parallel: true)
- [ ] #20 - Recipes Management Page (parallel: true)
- [ ] #21 - Integration & Testing (parallel: false)

Total tasks: 6
Parallel tasks: 3
Sequential tasks: 3
Estimated total effort: 90-114 hours
