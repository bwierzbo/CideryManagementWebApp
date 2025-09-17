---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-17T02:50:09Z
version: 1.1
author: Claude Code PM System
---

# System Patterns & Architecture

## Architectural Style

### Monorepo Architecture
- **Pattern**: Multi-package monorepo with workspace dependencies
- **Package Isolation**: Clear boundaries between frontend, API, database, and shared logic
- **Dependency Flow**: Unidirectional dependencies (web → api → db, lib)
- **Code Sharing**: Common utilities and types via shared packages

### Full-Stack Type Safety
- **End-to-End Types**: TypeScript from database schema to frontend components
- **tRPC Integration**: Type-safe API calls with automatic type inference
- **Schema-First**: Zod schemas define validation and types
- **Shared Types**: Domain types exported from lib package

## API Design Patterns

### tRPC Router Architecture
- **Procedure-Based**: Individual procedures for specific operations
- **Router Composition**: Feature-based router organization
- **Middleware Chaining**: Authentication, validation, and logging middleware
- **Context Injection**: Request context passed through middleware chain

### Request/Response Pattern
```typescript
// Procedure signature pattern
input: z.object({...})     // Zod validation schema
middleware: [auth, rbac]   // Authentication and authorization
handler: async (opts) =>   // Business logic implementation
output: z.object({...})    // Response type definition
```

### Error Handling
- **Centralized Errors**: tRPC error types with status codes
- **Validation Errors**: Automatic Zod validation error responses
- **Business Logic Errors**: Custom error types for domain-specific failures
- **Client Error Mapping**: Type-safe error handling on frontend

## Database Patterns

### Schema-First Design
- **Drizzle ORM**: Type-safe database schema definitions
- **Migration Strategy**: Version-controlled schema changes
- **Relationship Mapping**: Foreign keys with TypeScript relationships
- **Index Strategy**: Performance optimization via database indexes

### Data Access Patterns
- **Repository Pattern**: Database access abstracted through ORM
- **Query Composition**: Reusable query building with Drizzle
- **Transaction Management**: ACID compliance for multi-table operations
- **Connection Pooling**: Efficient database connection management

### Audit Trail Pattern
- **Change Tracking**: All entity modifications logged to audit tables
- **User Attribution**: Track who made changes and when
- **Field-Level Auditing**: Before/after values for specific fields
- **Immutable History**: Audit logs never modified, only appended

## Frontend Patterns

### Component Architecture
- **shadcn/ui Pattern**: Composition-based component library
- **Compound Components**: Related components grouped together
- **Variant System**: Class Variance Authority for consistent styling
- **Slot Pattern**: Radix UI slot composition for flexibility

### State Management
- **Server State**: TanStack Query for remote data caching
- **Form State**: React Hook Form for local form management
- **URL State**: Next.js router for navigation state
- **Client State**: React state for UI-specific data

### Data Fetching
- **tRPC Hooks**: Type-safe query and mutation hooks
- **Optimistic Updates**: Immediate UI updates with server synchronization
- **Background Refetching**: Automatic data freshness maintenance
- **Error Boundaries**: Graceful error handling with user feedback

## Authentication & Authorization

### Role-Based Access Control (RBAC)
- **User Roles**: Admin, Operator, Viewer with hierarchical permissions
- **Route Protection**: Next.js middleware for page-level authorization
- **API Authorization**: tRPC middleware for procedure-level access control
- **Component Guards**: Conditional rendering based on user permissions

### Authentication Flow
- **Credentials-Based**: Username/password with bcrypt hashing
- **Session Management**: NextAuth.js session handling
- **JWT Tokens**: Secure token-based authentication
- **CSRF Protection**: Built-in security against cross-site request forgery

## Business Logic Patterns

### Domain-Driven Design
- **Entity-Centric**: Core business entities drive system design
- **Workflow Modeling**: Production process as data flow
- **Calculation Engine**: Shared business logic in lib package
- **Validation Rules**: Domain-specific validation via Zod schemas

### Cidery Production Flow
```
Vendor → Purchase → PressRun → JuiceLot → Vessel → Batch
  ↓         ↓         ↓         ↓        ↓       ↓
Supply   Procurement Pressing  Juice   Ferment Product
Chain    Tracking   Operations Lots   Management Batches
```

### COGS Calculation Pattern
- **Cost Allocation**: Track costs from raw materials through production
- **Batch Costing**: Calculate per-batch cost of goods sold
- **Overhead Distribution**: Allocate facility costs across batches
- **Report Generation**: PDF and CSV export of cost analysis

## Data Flow Architecture

### Request Lifecycle
1. **Frontend**: User interaction triggers tRPC call
2. **Middleware**: Authentication, validation, and authorization
3. **Business Logic**: Domain calculations and validations
4. **Database**: ORM queries with transaction management
5. **Response**: Type-safe data returned to frontend
6. **UI Update**: React Query cache update and re-render

### Background Job Pattern
- **Job Queue**: Asynchronous processing for exports and reports
- **Scheduled Tasks**: Inventory snapshots and maintenance
- **Error Handling**: Retry logic and failure notifications
- **Progress Tracking**: Real-time job status updates

## Testing Patterns

### Test Strategy (To Be Implemented)
- **Unit Tests**: Individual function and component testing
- **Integration Tests**: API endpoint and database testing
- **End-to-End Tests**: Full user workflow testing
- **Database Tests**: Real database testing without mocks

### Test Organization
- **Feature-Based**: Tests organized by business feature
- **Shared Utilities**: Common test helpers and fixtures
- **Environment Isolation**: Separate test databases and configurations
- **Verbose Output**: Detailed test output for debugging

## Configuration Patterns

### Environment Management
- **Layered Configuration**: Base config with environment overrides
- **Type-Safe Environment**: Zod validation for environment variables
- **Secret Management**: Secure handling of API keys and credentials
- **Development Defaults**: Sensible defaults for local development

### Package Configuration
- **Shared TypeScript**: Base configuration extended by packages
- **Consistent Formatting**: Shared Prettier and ESLint configuration
- **Build Orchestration**: Root-level scripts coordinate package builds
- **Dependency Management**: Workspace references for internal packages

## Performance Patterns

### Optimization Strategy
- **Bundle Splitting**: Automatic code splitting via Next.js
- **Image Optimization**: Next.js built-in image optimization
- **Database Indexing**: Strategic indexes for query performance
- **Query Optimization**: Efficient database queries via ORM

### Caching Strategy
- **Browser Caching**: Static asset caching via CDN
- **Query Caching**: React Query for API response caching
- **Database Caching**: Connection pooling and query optimization
- **Build Caching**: Incremental builds for faster development

## Security Patterns

### Data Protection
- **Input Validation**: Zod schemas for all user inputs
- **SQL Injection Prevention**: ORM query parameterization
- **XSS Protection**: React's built-in escaping + Content Security Policy
- **Authentication**: Secure session management via NextAuth.js

### Access Control
- **Principle of Least Privilege**: Role-based minimum permissions
- **API Security**: Authentication required for all protected endpoints
- **Route Protection**: Next.js middleware for page authorization
- **Audit Logging**: Complete audit trail for security monitoring