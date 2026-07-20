# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CiderPilot** (formerly "Cidery Management MVP") - A web application replacing Excel for tracking the full cidery production lifecycle: vendor purchases → pressing → fermentation → packaging → distribution, with COGS reporting per batch and TTB compliance reporting.

The app was rebranded from "Cidery Management" to **CiderPilot** in November 2025 (PR #117). Some older docs/strings may still say "Cidery Management" — the product name is now CiderPilot.

**Tech Stack**: Next.js 15 + TypeScript + Tailwind + tRPC + PostgreSQL (Neon) + Drizzle ORM + NextAuth

> For a detailed, current map of routes, tables, routers, and known tech debt, see `SYSTEM_MAP.md` at the repo root — it is regenerated more often than this file.

## Monorepo Structure

- `apps/web/` - Next.js frontend application (shadcn/ui components, NextAuth)
- `packages/api/` - tRPC API routers and procedures (~34 routers)
- `packages/db/` - Drizzle ORM schema, migrations (0001–0142+), and seed data
- `packages/lib/` - Shared domain logic (calculations, RBAC, audit, recipes, units)
- `packages/worker/` - Background jobs for exports and snapshots
- `packages/docs/` - Documentation package

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

**Purchasing → Pressing → Fermentation**
- **Vendor** → **BaseFruit / Juice / Additive / Packaging Purchase** (+ Items) → **Inventory**
- **PressRun** (loads, juice yield) → **Vessel** → **Batch** (central record: volume, status, gravity, ABV, product type)
- **Batch** → **BatchMeasurement** (SG, pH, temp, ABV) / **BatchAdditive** / **BatchTransfer** / **BatchMergeHistory** (blends)

**Packaging → Distribution → Compliance**
- **Batch** → **CarbonationOperation** → **BottleRun** (+ BottleRunMaterials) → **InventoryItem**
- **Batch** → **Keg / KegFill** → keg inventory → distribution locations
- **InventoryItem** → **Sales** (Square POS) → **TTB Reporting** (periods, snapshots, reconciliation)

**Parallel & supporting tracks**
- **Recipes** → **RecipeExecution** (step-by-step batch execution reusing the `/actions` flows) — BOM, labor, scaling, scheduling live in `packages/lib/src/recipes/`
- **Distillation**: Cider → distillery → brandy → barrel aging; **Pommeau** (brandy + cider/juice blend)
- **Planning** / **ProductionPlan** — production planning with configurable granularity
- **ActivityRegister** — activity logging
- Supporting: **RefValue**/variety tables (reference data), **User** (RBAC), **AuditLog** (change tracking), **Organization** (org-level defaults)

### Recent Additions (as of mid-2026)
- **CiderPilot rebrand** (PR #117, Nov 2025)
- **Recipes & RecipeExecution** - Reusable recipes with step triggers, packaging-path toggles, and a scannable execution checklist (migrations 0128–0139)
- **Distillation & Pommeau** - Send-to-distillery / receive-brandy / fortified-blend tracking
- **Kegs & KegFills** - Keg inventory and fill/distribution tracking
- **Planning / ProductionPlans** - Production planning (migrations 0135–0136)
- **TTB Compliance** - Federal alcohol tax reporting periods, snapshots, reconciliation
- **Square POS / Sales** - Sales channel + Square integration (see `SQUARE_INTEGRATION_*.md`)
- **CarbonationOperation** - Forced carbonation (CO2 under pressure); measurements now accept CO2 as psi or volumes (0140)
- **NextAuth Integration** - Complete authentication system with middleware, idle timeout, session indicators

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
Domain math lives in two sibling dirs under `packages/lib/src/`:

`calc/` — production & financial:
- **ABV** (`abv.ts`), **Yield** (`yield.ts`) - volume tracking through production stages
- **COGS** (`cogs.ts`), **Financial** (`financial.ts`) - cost of goods sold per batch
- **Fermentation** (`fermentation.ts`), **Measurement scheduling** (`measurement-schedule.ts`)
- **SG calibration / correction** (`sg-calibration.ts`, `sg-correction.ts`) - hydrometer temperature correction

`calculations/` — chemistry & compliance:
- **CO2** (`co2.ts`) - Henry's Law forced-carbonation model
- **SO2** (`so2.ts`), **Sugar** (`sugar.ts`), **Pasteurization** (`pasteurization.ts`)
- **TTB** (`ttb.ts`) - federal reporting math

Recipe logic lives in `packages/lib/src/recipes/` — **BOM** (`bom.ts`), **labor** (`labor.ts`), **scaling** (`scaling.ts`), **schedule** (`schedule.ts`), **triggers** (`triggers.ts`).

## Common Vercel Build Errors & Prevention

### 1. Database Schema Drift (Most Common)
**Problem:** Code references database fields removed in migrations.

**Examples:**
- `vessels.type` - removed in migration but still referenced
- `pasteurizedAt`, `labeledAt` - non-existent fields on tables

**Prevention:**
```bash
# When removing a field, search entire codebase for references
grep -r "vessels\.type" packages/
grep -r "fieldName" packages/
```
- Update both queries AND mutations that reference the field
- Search for both `table.field` patterns and string literals

### 2. Enum/Type Changes Not Propagated
**Problem:** Updating an enum in one place but not all usages.

**Examples:**
- Status changed from `["all", "completed", "voided"]` to `["active", "completed"]`
- Forgot to update: filters, API schemas, UI components, type guards

**Prevention:**
```bash
# Search for all string literal references
grep -r '"completed"' packages/
grep -r '"all"' packages/
```
- Check schema definitions, type definitions, AND runtime comparisons
- Look for both direct values and type guards

### 3. Uncommitted Files/Migrations
**Problem:** Local dev works but Vercel fails due to missing files.

**Examples:**
- Components imported but not committed
- Migrations applied locally but not pushed
- Missing utility files

**Prevention:**
```bash
# Always check before deployment
git status
```
- Commit migrations IMMEDIATELY after generating them
- Don't import files that haven't been committed

### 4. Dependency Management
**Problem:** Packages in wrong section or lockfile out of sync.

**Examples:**
- `next-auth` in devDependencies but imported in production code
- Lockfile doesn't match package.json

**Prevention:**
- **Rule:** Runtime imports go in `dependencies`, NOT `devDependencies`
- Types-only imports can stay in devDependencies
- Always run `pnpm install` after changing package.json
- Commit package.json AND pnpm-lock.yaml together

### 5. React Hooks Rules
**Problem:** Calling hooks conditionally breaks React's rules.

**Wrong:**
```typescript
const inputId = id || React.useId(); // ❌ Conditional hook call
```

**Correct:**
```typescript
const generatedId = React.useId();   // ✅ Unconditional hook call
const inputId = id || generatedId;    // Use value conditionally
```

### 6. Optional Field Assumptions
**Problem:** Using optional values as if they're guaranteed.

**Wrong:**
```typescript
hasMore: input.offset + input.limit < totalCount  // ❌ input.offset might be undefined
```

**Correct:**
```typescript
const offset = input.offset ?? 0;  // ✅ Compute required values first
hasMore: offset + limit < totalCount
```

### Pre-Deployment Checklist
```bash
# 1. Check uncommitted changes
git status

# 2. Type check locally
pnpm typecheck

# 3. Check for removed fields still referenced
grep -r "\.type" packages/api/src/routers/
grep -r "vessels\.type\|pasteurizedAt\|labeledAt" packages/

# 4. Verify dependencies are correct
grep -A20 '"dependencies"' packages/*/package.json
grep -A20 '"devDependencies"' packages/*/package.json

# 5. Ensure lockfile is synced
pnpm install
git diff pnpm-lock.yaml  # Should show no changes
```

**Golden Rule:** When making breaking schema/type changes:
1. Search the ENTIRE codebase for all references
2. Update them ALL before committing
3. Don't commit schema changes without updating dependent code

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
- no more commenting out code if somethings not working, ask me if you should implement whatever unfinished feature or remove it but do not commend out code to fix build errors
- always manually run the migration for me (I do NOT run them — you apply them via the apply-migration runner below, then tell me it's done)

## Session Learnings (audit — July 2026)

These codify recurring friction from past sessions. Follow them to avoid re-hitting the same walls.

### DB access & scripts — DON'T hand-roll throwaway scripts
- **`psql`, `neonctl`, and `timeout` are NOT installed.** Bare `tsx` is not on PATH either. Available: `npx tsx`, `pnpm`, `gh`.
- To inspect data, use the **db-query** skill instead of writing a new `_tmp-*.ts` / `npx tsx -e "..."` each time:
  `pnpm --filter db exec tsx scripts/query.ts "SELECT ..."` (read-only; `--write` to mutate, `--json` for JSON). Run from repo root.
- To apply a migration (drizzle-kit migrate is broken): `pnpm --filter db exec tsx scripts/apply-migration.ts migrations/NNNN_name.sql` (add `--dry-run` first). Then tell me it's applied.
- One-off DB scripts import `db` from `../src/index` and live in `packages/db/scripts/`, run via `pnpm --filter db exec tsx scripts/<name>.ts` (cwd = `packages/db`). Don't guess `./src/client` vs relative paths or use `/tmp`.

### Waiting on background work — NEVER chain `sleep`
- The harness blocks `sleep 30 && echo ...`. To wait on a background job/command, use `run_in_background: true` and poll with `until <check>; do sleep 2; done` (Monitor), or just wait — background sub-agents notify on completion. Don't ladder `sleep 20 → 45 → 90`.

### Editing & testing
- **Read the exact region before every Edit.** Never Edit from grep output alone — it causes "File has not been read yet" / "string not found" round-trips.
- Scope a test to one file with `pnpm --filter <pkg> exec vitest run <path>` — NOT `... run test -- <name>` (the name is ignored and the whole 715-test suite runs).
- After edits, `pnpm --filter web run typecheck` should be clean. Drizzle columns are frequently nullable — narrow before dereferencing (matches the "Optional Field Assumptions" rule above).

### UI conventions (make these the template — I keep asking for them)
- **One shared scrollable-container pattern for ALL scrollable areas.** Must support trackpad/two-finger scroll, not just arrow keys. New scroll areas reuse it — don't re-implement per list.
- **Prefill carries unit + value, never just the value.** Amount fields must set their unit too.
- **Recipe steps reuse the existing `/actions` functions** (add measurement, transfer, filter, carbonate, package) — fill values from the recipe; do NOT reimplement those flows.
- Prefer showing the **last-activity date** on time-based inputs.

### Sub-agents
- `test-runner` now has Bash — route ALL test execution to it. `code-analyzer`/`Explore` are read-only (no Bash) — use them for tracing/search, not for running commands.
- The heavy data-forensics work (trace lineage, check a vessel's volume) is a good fit for `Explore` / `code-analyzer` — don't do it all in the main loop.

## New Developer Onboarding

This section helps new developers get started with the project using Claude Code.

### Getting Started with Claude Code

1. **Install Claude Code CLI** from [claude.ai/code](https://claude.ai/code)
2. **Navigate to the project directory** in your terminal
3. **Run `claude`** to start an interactive session
4. Claude automatically reads this file (`CLAUDE.md`) for project context

### First-Time Setup Checklist

```bash
# 1. Clone and enter the project
git clone https://github.com/bwierzbo/CideryManagementWebApp.git
cd CideryManagementWebApp

# 2. Install dependencies
pnpm install

# 3. Set up environment files (see below)

# 4. Run database migrations
pnpm db:migrate

# 5. Seed sample data
pnpm db:seed

# 6. Start development server
pnpm dev
```

### Environment File Setup

You need to create `.env` files in three locations with the DATABASE_URL:

| File Location | Required Variables |
|---------------|-------------------|
| `.env.local` (root) | DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET |
| `apps/web/.env.local` | DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET |
| `packages/db/.env` | DATABASE_URL |

**Example `.env.local` content:**
```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-here
```

### Key Project Files to Understand

| File/Directory | Purpose |
|----------------|---------|
| `CLAUDE.md` | This file - Claude's project context |
| `README.md` | Project overview and setup instructions |
| `packages/db/src/schema.ts` | Main database schema (Drizzle ORM) |
| `packages/db/src/schema/` | Additional schema files (packaging, audit) |
| `packages/api/src/routers/` | tRPC API endpoints |
| `apps/web/src/app/` | Next.js pages (App Router) |
| `apps/web/src/components/` | React components |
| `packages/lib/src/` | Shared utilities and calculations |

### Database Operations with Claude

Claude can help with database tasks. Here are common requests:

**Viewing the database:**
```bash
pnpm --filter db run db:studio
```

**Common database commands:**
- `pnpm db:migrate` - Apply pending migrations
- `pnpm db:seed` - Seed sample data
- `pnpm --filter db run db:test` - Test database queries

**Ask Claude to:**
- "Add a new field to the batches table"
- "Create a migration for the new column"
- "Write a query to get all batches with their vessels"

### Common Development Tasks

**Starting development:**
```bash
pnpm dev                        # Start all services (port 3001)
pnpm --filter web run dev       # Start only web app
```

**Before committing:**
```bash
pnpm typecheck                  # Check for TypeScript errors
pnpm lint                       # Run linter
pnpm build                      # Full production build
```

**Database changes:**
```bash
# After modifying schema.ts:
pnpm db:generate                # Generate migration files
pnpm db:migrate                 # Apply migrations
```

### Asking Claude for Help

Good prompts for this project:

- "Help me add a new field to track [X] in the batch entity"
- "Create a new tRPC endpoint for [feature]"
- "Fix the TypeScript error in [file]"
- "Explain how the pressing flow works"
- "Update the UI to show [data] on the [page] page"

Claude will read the relevant files and provide code that follows the project patterns.