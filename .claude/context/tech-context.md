---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-17T02:50:09Z
version: 1.2
author: Claude Code PM System
---

# Technology Context

## Runtime & Language

### Node.js Environment
- **Version**: Node.js 20+ (specified in `.nvmrc` and `engines`)
- **Package Manager**: pnpm 8.15.0
- **Target**: ES2022 with ESNext modules
- **TypeScript**: 5.3.0 with strict mode enabled

### Package Management
- **Workspace Strategy**: pnpm workspaces for monorepo management
- **Lock File**: pnpm-lock.yaml for deterministic installs
- **Package Resolution**: Workspace references between internal packages

## Frontend Technology Stack

### Core Framework
- **Next.js**: 15.0.0 (App Router architecture)
- **React**: 18.2.0 with React DOM 18.2.0
- **TypeScript**: Full type coverage with strict configuration

### UI & Styling
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4.0 with custom animations
- **Icons**: Lucide React 0.544.0
- **Utility Classes**:
  - `clsx` 2.1.1 for conditional classes
  - `tailwind-merge` 3.3.1 for class merging
  - `class-variance-authority` 0.7.1 for component variants

### Forms & Validation
- **Form Management**: React Hook Form 7.62.0
- **Validation**: Zod 4.1.8 with Hookform resolvers 5.2.1
- **Schema Integration**: Type-safe form validation

### State Management & Data Fetching
- **API Client**: tRPC 11.5.1 (client, next, react-query)
- **Query Management**: TanStack React Query 5.87.4
- **State Synchronization**: tRPC + React Query integration

### Authentication & Security
- **Auth Provider**: NextAuth.js 4.24.11
- **Password Hashing**: bcryptjs 3.0.2
- **Environment**: dotenv 17.2.2 for configuration

### PDF Generation
- **PDF Rendering**: React PDF Renderer 4.3.0 for COGS reports

## Backend Technology Stack

### API Layer
- **API Framework**: tRPC 11.5.1 server
- **Type Safety**: End-to-end TypeScript from database to frontend
- **Validation**: Zod 4.1.8 for runtime type checking

### Database & ORM
- **Database**: PostgreSQL (connection via DATABASE_URL)
- **ORM**: Drizzle ORM 0.28.6
- **Migrations**: Drizzle Kit 0.19.13
- **Query Builder**: Type-safe SQL generation
- **Connection**: PostgreSQL driver (pg 8.11.3)

### Shared Libraries
- **Decimal Operations**: Decimal.js 10.4.3 for financial calculations
- **Workspace Packages**: Internal lib and db packages

## Development Tooling

### Code Quality
- **Linting**: ESLint 9.35.0 with Next.js config
- **Formatting**: Prettier 3.2.0 with consistent configuration
- **Type Checking**: TypeScript strict mode across all packages

### Build Tools
- **Build System**: Next.js build system + TypeScript compiler
- **CSS Processing**: PostCSS 8.5.6 with Autoprefixer 10.4.21
- **Concurrent Tasks**: Concurrently 8.2.2 for parallel development

### Development Environment
- **Hot Reload**: Next.js dev server with watch mode
- **Environment Variables**: .env.local for development configuration
- **Database Tools**: Drizzle Studio for database inspection

## Database Technology

### PostgreSQL Setup
- **Version**: Modern PostgreSQL (via DATABASE_URL)
- **ORM Features**:
  - Type-safe queries
  - Migration management
  - Schema generation
  - Relationship mapping

### Schema Management
- **Migrations**: Versioned SQL migrations via Drizzle Kit
- **Seeds**: TypeScript seed scripts for development data
- **Testing**: Database query testing utilities

## Deployment Architecture

### Frontend Deployment
- **Platform**: Vercel (optimized for Next.js)
- **Build Output**: Static + Server-side rendering
- **CDN**: Vercel Edge Network

### Database Deployment
- **Options**: Neon DB or AWS RDS
- **Connection**: Pooled PostgreSQL connections
- **Environment**: Cloud-hosted database

## Package Dependencies Overview

### Root Dependencies
- **Development Tools**: TypeScript, Prettier, Concurrently
- **Type Definitions**: Node.js types

### Web App Dependencies (54 packages)
- **Core**: Next.js, React, TypeScript
- **UI**: Radix UI components, Tailwind CSS
- **Data**: tRPC, React Query, Zod
- **Auth**: NextAuth.js, bcryptjs
- **Utilities**: Date handling, PDF generation

### API Package Dependencies
- **Server**: tRPC server, Zod validation
- **Database**: Workspace db package
- **Utilities**: Decimal.js, workspace lib package

### Database Package Dependencies
- **ORM**: Drizzle ORM and Kit
- **Database**: PostgreSQL driver
- **Utilities**: TypeScript execution (tsx)

### Shared Library Dependencies
- **ORM**: Drizzle ORM 0.28.6 (added for audit system)
- **Validation**: Zod schemas
- **Types**: Shared TypeScript definitions
- **Business Logic**: Domain calculations
- **JSON Utilities**: json-diff for audit change tracking

## Configuration Files

### TypeScript Configuration
- **Base Config**: Strict TypeScript with ES2022 target
- **Module Resolution**: Bundler with import extensions
- **Path Mapping**: Absolute imports configured
- **Next.js Plugin**: Integrated for optimal development

### Package Manager Configuration
- **Workspace Definition**: Apps and packages structure
- **Type Overrides**: Consistent React types across packages
- **Engines**: Node 20+ and pnpm 8+ requirements

### Development Configuration
- **Editor**: EditorConfig for consistent formatting
- **Git**: Standard ignore patterns for Node.js projects
- **Environment**: Template for required variables

## Performance Considerations

### Bundle Optimization
- **Tree Shaking**: ES modules with Next.js optimization
- **Code Splitting**: Automatic route-based splitting
- **Asset Optimization**: Next.js built-in image and font optimization

### Database Performance
- **Connection Pooling**: PostgreSQL connection management
- **Query Optimization**: Type-safe query building
- **Migration Strategy**: Versioned schema changes

## Update History

- 2025-09-13T19:24:59Z: Added drizzle-orm 0.28.6 to lib package dependencies for audit system implementation