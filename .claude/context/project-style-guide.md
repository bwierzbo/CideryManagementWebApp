---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-13T04:03:23Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Code Standards & Conventions

### TypeScript Configuration
- **Strict Mode**: All packages use strict TypeScript configuration
- **Target**: ES2022 with ESNext modules for modern JavaScript features
- **Import Extensions**: Allow TypeScript import extensions for better DX
- **Path Mapping**: Use absolute imports with baseUrl configuration
- **No Any**: Avoid `any` type, use `unknown` or proper type definitions

### Naming Conventions

#### File Naming
- **Components**: `PascalCase.tsx` (e.g., `VendorForm.tsx`, `BatchStatusCard.tsx`)
- **Pages**: `page.tsx` (Next.js App Router convention)
- **Layouts**: `layout.tsx` (Next.js App Router convention)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-vendor-data.ts`, `use-batch-status.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `format-currency.ts`, `calculate-abv.ts`)
- **API Routes**: `kebab-case.ts` (e.g., `vendor-management.ts`, `batch-operations.ts`)
- **Database Schema**: `kebab-case.ts` (e.g., `vendor-schema.ts`, `production-schema.ts`)
- **Types**: `kebab-case.types.ts` (e.g., `vendor.types.ts`, `batch.types.ts`)

#### Variable & Function Naming
- **Variables**: `camelCase` for all variables and functions
- **Constants**: `SCREAMING_SNAKE_CASE` for module-level constants
- **Components**: `PascalCase` for React components
- **Types/Interfaces**: `PascalCase` with descriptive names
- **Database Tables**: `snake_case` following PostgreSQL conventions
- **Environment Variables**: `SCREAMING_SNAKE_CASE` with namespace prefixes

#### Specific Naming Patterns
```typescript
// Components
export function VendorForm() { ... }
export function BatchStatusCard() { ... }

// Hooks
export function useVendorData() { ... }
export function useBatchOperations() { ... }

// Utilities
export function formatCurrency() { ... }
export function calculateYield() { ... }

// Types
export interface VendorData { ... }
export type BatchStatus = 'active' | 'complete' | 'on_hold'

// Constants
export const DEFAULT_ABV_THRESHOLD = 6.5
export const MEASUREMENT_TYPES = ['abv', 'ph', 'gravity'] as const
```

### Code Organization Patterns

#### Import Organization
```typescript
// 1. External libraries
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { type NextPage } from 'next'

// 2. Internal packages (workspace references)
import { api } from 'api'
import { db } from 'db'
import { type VendorData } from 'lib'

// 3. Relative imports (same package)
import { VendorForm } from '../components/VendorForm'
import { formatCurrency } from '../utils/format-currency'
import { type ComponentProps } from '../types/component.types'
```

#### Component Structure
```typescript
// 1. Imports
// 2. Types/Interfaces (if component-specific)
// 3. Component definition
// 4. Default export

interface VendorFormProps {
  onSubmit: (data: VendorData) => void
  initialData?: Partial<VendorData>
}

export function VendorForm({ onSubmit, initialData }: VendorFormProps) {
  // 1. Hooks
  // 2. State
  // 3. Event handlers
  // 4. Effects
  // 5. Render return
}

export default VendorForm
```

### Code Quality Standards

#### Error Handling
- **Fail Fast**: Validate inputs early and throw descriptive errors
- **Type Safety**: Use TypeScript for compile-time error prevention
- **User-Friendly Messages**: Provide actionable error messages for users
- **Logging**: Use structured logging for debugging and monitoring

#### Function Design
- **Single Responsibility**: Each function should have one clear purpose
- **Pure Functions**: Prefer pure functions for calculations and utilities
- **Descriptive Names**: Function names should clearly indicate their purpose
- **Parameter Validation**: Validate inputs with Zod schemas where appropriate

#### Database Conventions
- **Schema Definition**: Use Drizzle ORM schema with TypeScript types
- **Migration Naming**: `YYYY_MM_DD_HH_mm_ss_description.sql` format
- **Relationship Naming**: Clear foreign key relationships with descriptive names
- **Index Strategy**: Add indexes for frequently queried columns

## Development Workflow

### Testing Standards
- **Test Every Function**: All business logic must have corresponding tests
- **Verbose Tests**: Tests should be descriptive and useful for debugging
- **Real Data**: No mock services, test against actual implementations
- **Test Organization**: Group tests by feature and maintain clear structure

### Git Conventions
- **Branch Naming**: `feature/description`, `fix/description`, `refactor/description`
- **Commit Messages**: Descriptive messages following conventional commits
- **Pull Requests**: Include description, testing notes, and breaking changes
- **Code Review**: All code must be reviewed before merging

### Documentation Standards
- **README Files**: Each package should have clear setup and usage instructions
- **API Documentation**: Document all tRPC procedures with examples
- **Component Documentation**: Document component props and usage patterns
- **Inline Comments**: Use comments for complex business logic only

## UI/UX Conventions

### Component Library Standards
- **shadcn/ui Base**: Use shadcn/ui components as foundation
- **Variant System**: Use Class Variance Authority for component variants
- **Composition**: Prefer composition over inheritance for component design
- **Accessibility**: Ensure all components meet WCAG 2.1 AA standards

### Design System
- **Color Palette**: Use Tailwind CSS color system with semantic naming
- **Typography**: Consistent font sizes and weights via Tailwind classes
- **Spacing**: Use Tailwind spacing scale for consistent layouts
- **Responsive Design**: Mobile-first responsive design approach

### Form Design Standards
```typescript
// Standard form pattern
export function VendorForm() {
  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {...}
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Vendor</Button>
      </form>
    </Form>
  )
}
```

## API Design Standards

### tRPC Procedure Patterns
```typescript
// Standard procedure structure
export const vendorRouter = router({
  create: publicProcedure
    .input(createVendorSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Authorization check
      // 2. Input validation (automatic via Zod)
      // 3. Business logic
      // 4. Database operation
      // 5. Audit logging
      // 6. Return typed result
    }),

  list: publicProcedure
    .input(listVendorsSchema)
    .query(async ({ input, ctx }) => {
      // Query implementation
    })
})
```

### Schema Validation
- **Zod Schemas**: Define validation schemas for all inputs and outputs
- **Shared Types**: Export types from schemas for frontend use
- **Error Messages**: Provide clear validation error messages
- **Optional Fields**: Clearly mark optional vs required fields

## Performance Guidelines

### Frontend Performance
- **Bundle Size**: Monitor and optimize bundle size with Next.js analyzer
- **Image Optimization**: Use Next.js Image component for all images
- **Code Splitting**: Leverage automatic code splitting via Next.js
- **Lazy Loading**: Use React.lazy for components not needed immediately

### Database Performance
- **Query Optimization**: Use Drizzle ORM query builder efficiently
- **Index Strategy**: Add indexes for frequently queried columns
- **Connection Pooling**: Use connection pooling for database connections
- **Migration Strategy**: Keep migrations fast and backward compatible

### API Performance
- **Response Size**: Minimize API response payload size
- **Caching**: Use React Query for client-side caching
- **Pagination**: Implement pagination for large data sets
- **Rate Limiting**: Implement rate limiting for API endpoints

## Security Standards

### Authentication & Authorization
- **Role-Based Access**: Implement proper RBAC throughout application
- **Session Management**: Use NextAuth.js for secure session handling
- **Input Validation**: Validate all user inputs with Zod schemas
- **SQL Injection Prevention**: Use ORM query builder exclusively

### Data Protection
- **Environment Variables**: Never commit secrets to version control
- **Audit Logging**: Log all significant user actions
- **Error Handling**: Don't expose sensitive information in error messages
- **HTTPS Only**: Enforce HTTPS in production environments

## Monitoring & Maintenance

### Logging Standards
- **Structured Logging**: Use consistent log format with proper levels
- **Error Tracking**: Implement comprehensive error tracking
- **Performance Monitoring**: Track key performance metrics
- **Audit Trail**: Maintain complete audit trail for all data changes

### Code Maintenance
- **Dependency Updates**: Regularly update dependencies for security
- **Code Review**: Require code review for all changes
- **Automated Testing**: Run tests on all commits and deployments
- **Documentation**: Keep documentation current with code changes