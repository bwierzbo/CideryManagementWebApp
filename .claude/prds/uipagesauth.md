---
name: uipagesauth
description: Comprehensive UI pages with authentication, authorization, and complete coverage for Inventory, Reports, and Recipes management
status: backlog
created: 2025-09-13T15:50:46Z
---

# PRD: UI Pages Auth

## Executive Summary

Deliver secure, role-based access to the cidery management application with complete UI coverage for core business operations. This PRD defines the authentication system, authorization guards, and three critical pages (Inventory, Reports, Recipes) that enable operators and admins to manage cidery operations with proper access control and audit trails.

## Problem Statement

**What problem are we solving?**
Operators and admins need authenticated access to manage cidery operations through secure, functional pages. Critical workflows like tracking inventory, generating cost reports, and managing recipes currently lack a complete UI implementation with proper access controls.

**Why is this important now?**
Without these authenticated pages, the cidery management app cannot provide:
- Secure access control preventing unauthorized operations
- Complete production visibility for inventory and cost tracking
- A centralized location to record and manage repeatable recipes
- Role-based workflow enforcement for operational compliance

## User Stories

### Primary User Personas

**Admin Users**
- Full system access including user management
- Can view all reports and financial data
- Manages recipes and inventory corrections
- Oversees operational compliance and audit trails

**Operator Users**
- Day-to-day operational access for production workflows
- Records inventory movements and packaging operations
- Views recipes and applies them to batches
- Generates operational reports within their permissions

**Developers**
- Verify authentication guards function correctly
- Validate role-based access enforcement
- Test complete workflows from login to operations

### Detailed User Journeys

**Journey 1: Operator Daily Workflow**
1. Operator attempts to access any page → redirected to login if not authenticated
2. Signs in with credentials → redirected to dashboard
3. Navigates to Inventory page → views current inventory levels
4. Records inventory movement (inbound shipment) → updates database with audit trail
5. Navigates to Reports page → generates COGS report for recent batch
6. References Recipes page → applies standard recipe to new batch creation

**Journey 2: Admin Management Workflow**
1. Admin signs in → accesses all system areas
2. Reviews Reports page → exports financial data as CSV/PDF
3. Manages Recipes page → creates new seasonal recipe, updates existing
4. Monitors Inventory page → corrects erroneous movement, reviews audit history
5. Access user management (out of scope for this PRD but authentication foundation)

### Pain Points Being Addressed
- **Security Gap**: No authentication prevents unauthorized system access
- **Operational Blindness**: Missing inventory and reporting interfaces limit visibility
- **Recipe Management**: No centralized system for standardized recipes
- **Compliance Risk**: Lack of audit trails and role enforcement

## Requirements

### Functional Requirements

#### 1. Authentication & Authorization System
- **Login Flow**: NextAuth integration with credential-based authentication
- **Role Guards**: Enforce Admin/Operator role-based access throughout application
- **Route Protection**: Unauthorized users redirected to sign-in page
- **Session Management**: Secure session handling with automatic expiration
- **Admin Access**: Special permissions for user management and system administration

#### 2. Inventory Management Page
- **Inventory Display**: List all inventory items showing SKU, format, unit size, location, on-hand units
- **Movement History**: Display chronological movements with delta, reason, timestamp, user attribution
- **Movement Recording**: Operators can add new movements (inbound/outbound) with reason codes
- **Admin Corrections**: Admins can edit or delete movements with audit trails
- **Search & Filter**: Find inventory by SKU, format, or location
- **Real-time Updates**: Inventory levels update immediately after movements

#### 3. Reports Management Page
- **COGS Breakdown**: Display batch-level cost breakdown including fruit, packaging, additions, labor
- **Export Functionality**: CSV and PDF export endpoints for financial reporting
- **Date Filtering**: Filter reports by date range and specific batches
- **Role Permissions**: Read-only for Operators, Admin can trigger new cost snapshots
- **Historical Data**: Access to historical COGS calculations and trends

#### 4. Recipes Management Page
- **Recipe Storage**: Store standard cider recipes with name, description, base varieties
- **Recipe Details**: Target SG/Brix, target ABV, required additives and quantities
- **Recipe Listing**: Searchable list of all recipes with key metadata
- **Admin CRUD**: Admins can create, edit, and delete recipes
- **Operator Access**: Operators can view recipes and apply them when creating batches
- **Recipe Application**: Link recipes to batch creation workflow

### Non-Functional Requirements

#### Performance
- Page load times under 2 seconds for all authenticated pages
- Inventory movements process in under 1 second
- Report generation completes within 5 seconds for standard date ranges

#### Security
- All pages require authentication - no anonymous access
- Role-based authorization enforced at route and component levels
- Sensitive operations (deletions, corrections) logged with user attribution
- Session tokens encrypted and securely stored

#### Scalability
- Support 50+ concurrent users across all pages
- Inventory page handles 10,000+ inventory items efficiently
- Reports page processes multi-year historical data

#### Usability
- Mobile-responsive design for tablets and smartphones
- Consistent navigation and UI patterns across all pages
- Clear error messages for authorization failures
- Intuitive workflows matching operational patterns

## Success Criteria

### Authentication & Authorization
- ✅ Users cannot access any page without valid authentication
- ✅ Role guards properly enforced on Inventory, Reports, and Recipes pages
- ✅ Unauthorized access attempts redirect to sign-in page
- ✅ Admin-only features properly restricted from Operators

### Inventory Page
- ✅ Displays seeded inventory data with accurate quantities
- ✅ Movement recording updates database and displays immediately
- ✅ Movement history shows complete audit trail
- ✅ Admin corrections function properly with appropriate permissions

### Reports Page
- ✅ COGS breakdown displays accurate cost allocation
- ✅ CSV and PDF export endpoints function correctly
- ✅ Date filtering returns accurate filtered results
- ✅ Role permissions enforced for read vs admin operations

### Recipes Page
- ✅ Recipe CRUD operations work for Admin users
- ✅ Operators can view and apply recipes to batch creation
- ✅ Recipe data persists correctly in database
- ✅ Recipe application integrates with existing batch workflow

### Golden Path Validation
Complete end-to-end workflow: Operator logs in → records purchase → creates press run → manages batch → runs packaging → updates inventory → generates report → references recipe

**Measurable Outcomes:**
- 100% page authentication coverage
- Zero unauthorized access incidents
- <2 second average page load times
- 100% audit trail coverage for mutations
- 95%+ user satisfaction with workflow efficiency

## Constraints & Assumptions

### Technical Constraints
- Must integrate with existing Next.js 15 App Router architecture
- Authentication must use NextAuth.js framework
- Database operations must use existing Drizzle ORM setup
- All mutations must integrate with existing audit logging system

### Timeline Constraints
- MVP delivery within 4-6 weeks
- Authentication system must be completed before page development
- Pages can be developed in parallel after auth foundation

### Resource Constraints
- Single full-stack developer implementation
- Existing design system and component library must be used
- No budget for external authentication services beyond NextAuth

### Assumptions
- Users have basic web application literacy
- Existing database schema supports required operations
- Audit logging system is functional and will capture page mutations
- COGS calculation logic is implemented and accessible

## Out of Scope

### Explicitly NOT Building
- **Multi-facility Inventory**: Single location inventory management only
- **Advanced Analytics**: Beyond basic COGS reporting
- **Recipe Versioning**: Simple CRUD without version control or scaling calculations
- **User Management UI**: Admin user creation/editing (authentication foundation only)
- **Mobile App**: Web-responsive only, no native mobile application
- **Offline Functionality**: Online-only operation required
- **Advanced Reporting**: Beyond COGS breakdown and basic filtering
- **Inventory Forecasting**: Current state tracking only
- **Recipe Collaboration**: Single-user recipe editing

### Future Considerations
Items that may be addressed in subsequent releases but are out of scope for this MVP:
- Multi-location inventory tracking
- Advanced cost analysis and profitability reporting
- Recipe scaling and yield calculations
- Collaborative recipe editing and approval workflows
- Mobile native application
- Offline-first inventory management

## Dependencies

### External Dependencies
- **Database Schema**: Inventory tables and audit logs from existing schema
- **COGS Calculation**: Cost calculation logic must be implemented and accessible
- **Authentication Scaffolding**: Basic NextAuth setup and configuration
- **Design System**: Existing UI component library and design patterns

### Internal Dependencies
- **tRPC Procedures**: API endpoints for inventory, reports, and recipes operations
- **Audit System**: Comprehensive audit logging for all mutations
- **Role-Based Access Control**: RBAC system for Admin/Operator permissions
- **Database Seeding**: Test data for development and demonstration

### Infrastructure Dependencies
- **PostgreSQL Database**: Operational with required tables and relationships
- **Session Storage**: Redis or database-backed session management
- **File Export**: PDF generation library for report exports
- **Authentication Provider**: NextAuth configuration with credential provider

## Technical Implementation Notes

### Authentication Architecture
```typescript
// Route protection middleware
export function withAuth(roles: Role[]) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)
    if (!session || !roles.includes(session.user.role)) {
      return redirect('/auth/signin')
    }
  }
}
```

### Page Structure
```
/inventory - Inventory management (Admin, Operator)
/reports - COGS and financial reports (Admin, Operator read-only)
/recipes - Recipe management (Admin CRUD, Operator read)
/auth/signin - Authentication entry point
/auth/signout - Secure session termination
```

### Database Integration
- Use existing Drizzle ORM schemas
- Implement optimistic updates for inventory movements
- Ensure all mutations trigger audit log entries
- Cache frequently accessed data (recipes, inventory categories)

This PRD provides comprehensive coverage for implementing secure, role-based UI pages that enable complete cidery management operations with proper authentication, authorization, and audit trails.