# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cidery Management MVP - A web application replacing Excel for tracking vendor purchases → pressing → fermentation → packaging → inventory with COGS reporting per batch.

**Tech Stack**: Next.js 15 + TypeScript + Tailwind + tRPC + PostgreSQL + Drizzle ORM

## Monorepo Structure

- `apps/web/` - Next.js frontend application (shadcn/ui components, Auth.js)
- `packages/api/` - tRPC API routers and procedures
- `packages/db/` - Drizzle ORM schema, migrations, and seed data
- `packages/lib/` - Shared domain logic (ABV calculations, yield, RBAC, audit)
- `packages/worker/` - Background jobs for exports and snapshots

## Development Commands

```bash
# Development
pnpm dev                    # Start web + worker dev servers
pnpm --filter web run dev   # Start only web app
pnpm --filter worker run dev # Start only worker

# Building & Quality
pnpm build         # Build all packages
pnpm lint          # Lint all packages
pnpm typecheck     # TypeScript check all packages
pnpm test          # Run tests for all packages
pnpm format        # Format with Prettier

# Database Operations
pnpm db:generate   # Generate Drizzle schema
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed database
pnpm --filter db run db:studio  # Open Drizzle Studio
pnpm --filter db run db:test    # Test database queries

# Package-specific
pnpm --filter <package> run <script>  # Run script in specific package
```

## Core Domain Entities

The system tracks the cidery production flow through these key entities:

- **Vendor** → **Purchase/PurchaseLines** → **PressRun** → **JuiceLot**
- **JuiceLot** → **Vessel** → **Batch** → **Measurement/Transfer**
- **Batch** → **CarbonationOperation** → **PackagingRun** → **InventoryItem**
- **Batch** → **BlendComponent** → **PackagingRun** → **InventoryItem**
- Supporting: **RefValue** (reference data), **User** (RBAC), **AuditLog** (change tracking)

### Recent Additions (October 2025)
- **CarbonationOperation** - Tracks forced carbonation (CO2 addition under pressure)
- **NextAuth Integration** - Complete authentication system with middleware
- **Session Management** - Idle timeout and session indicators

## Architecture Patterns

- **tRPC** for type-safe API layer between frontend and backend
- **Drizzle ORM** with PostgreSQL for data persistence
- **Workspace packages** for code sharing (`api`, `db`, `lib` packages)
- **Domain-driven structure** following cidery production workflow
- **Role-based access control** (Admin, Operator, Viewer)
- **Heavy autofill** and smart defaults throughout UI
- **Audit logging** for all entity changes

### Authentication & Authorization (NextAuth)
- **NextAuth** with credentials provider for authentication
- **JWT sessions** for stateless session management
- **Middleware protection** at edge level (all routes protected by default)
- **tRPC procedures** - protectedProcedure, adminProcedure, auditedProcedure
- **RBAC system** - Permission checks at API and UI levels
- **Idle timeout** - 30-minute automatic sign-out with 5-minute warning
- **Session indicators** - Visual auth status in navigation

**Auth Files:**
- `/apps/web/src/lib/auth.ts` - NextAuth configuration
- `/apps/web/middleware.ts` - Route protection middleware
- `/apps/web/src/lib/auth/server.ts` - Server-side auth utilities (requireAuth, requireAdmin)
- `/apps/web/src/lib/auth/hooks.ts` - Client-side auth hooks (useUser, useIsAdmin)
- `/packages/api/src/trpc.ts` - Protected tRPC procedures

## Development Guidelines

### Testing
- Always use the test-runner sub-agent to execute tests
- No mock services - test against real implementations
- Tests must be verbose for debugging purposes
- Complete current test before moving to next

### Code Quality
- Use sub-agents: file-analyzer for reading files, code-analyzer for code analysis
- Follow existing patterns and naming conventions
- No partial implementations or simplifications
- No code duplication - reuse existing functions
- Proper separation of concerns (no mixed responsibilities)
- Clean up resources (connections, listeners, handles)

### Database
- Use Drizzle ORM for all database operations
- Generate schema changes with `pnpm db:generate`
- Test database changes with `pnpm --filter db run db:test`
- Seed data available via `pnpm db:seed`

### Frontend
- shadcn/ui component library with Tailwind CSS
- React Hook Form with Zod validation
- TanStack Query for data fetching
- NextAuth for authentication

### Domain-Specific Features
- **CO2 Calculations** - Henry's Law implementation for carbonation (`packages/lib/src/calculations/co2.ts`)
- **ABV Calculations** - Alcohol by volume calculations for batches
- **Yield Tracking** - Volume tracking through production stages
- **COGS Reporting** - Cost of goods sold per batch

## Environment Variables

Required for development:
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `NEXTAUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_URL` - App URL (http://localhost:3001 for dev)

## Important Notes for Claude
- App typically runs on port 3001 (not 3000)
- User manages migrations manually - just tell them when to run migrations
- Don't worry about port availability - user hosts in separate terminal
- Database schema is in `public` schema (neon_auth was cleaned up in Oct 2025)