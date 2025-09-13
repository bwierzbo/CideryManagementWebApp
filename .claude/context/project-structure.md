---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-13T04:03:23Z
version: 1.0
author: Claude Code PM System
---

# Project Structure

## Root Directory Structure

```
cidery-management-app/
├── .claude/                    # Claude Code configuration and scripts
│   ├── context/               # Project context documentation
│   └── scripts/               # PM and automation scripts
├── .git/                      # Git repository data
├── apps/                      # Application packages
│   └── web/                   # Next.js frontend application
├── packages/                  # Shared packages
│   ├── api/                   # tRPC API routers and procedures
│   ├── db/                    # Database schema, migrations, seeds
│   ├── lib/                   # Shared domain logic and utilities
│   └── worker/                # Background job processing
├── node_modules/              # Dependencies (managed by pnpm)
├── .editorconfig             # Editor configuration
├── .env.local                # Environment variables (local)
├── .gitignore                # Git ignore patterns
├── .nvmrc                    # Node.js version specification
├── CLAUDE.md                 # Claude Code project guidance
├── README.md                 # Project documentation
├── package.json              # Root workspace configuration
├── pnpm-lock.yaml           # Dependency lock file
├── pnpm-workspace.yaml      # Workspace package definitions
└── tsconfig.base.json       # Shared TypeScript configuration
```

## Application Structure (`apps/web/`)

```
web/
├── src/
│   ├── app/                  # Next.js 15 App Router pages
│   ├── components/           # React components (shadcn/ui based)
│   ├── lib/                  # Frontend utilities and configuration
│   └── types/                # TypeScript type definitions
├── public/                   # Static assets
├── .eslintrc.json           # ESLint configuration
├── next.config.js           # Next.js configuration
├── package.json             # Web app dependencies
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

## API Package Structure (`packages/api/`)

```
api/
├── src/
│   ├── routers/             # tRPC router definitions
│   │   ├── auth.ts          # Authentication routes
│   │   ├── vendor.ts        # Vendor management routes
│   │   ├── purchase.ts      # Purchase tracking routes
│   │   ├── production.ts    # Production workflow routes
│   │   └── reporting.ts     # COGS and reporting routes
│   ├── procedures/          # Shared tRPC procedures
│   ├── middleware/          # Authentication and validation middleware
│   └── index.ts             # API entry point and router composition
├── package.json             # API package dependencies
└── tsconfig.json            # TypeScript configuration
```

## Database Package Structure (`packages/db/`)

```
db/
├── src/
│   ├── schema/              # Drizzle ORM schema definitions
│   │   ├── auth.ts          # User and authentication tables
│   │   ├── vendors.ts       # Vendor management tables
│   │   ├── purchases.ts     # Purchase tracking tables
│   │   ├── production.ts    # Production workflow tables
│   │   ├── inventory.ts     # Inventory management tables
│   │   ├── ref-values.ts    # Reference data tables
│   │   └── audit.ts         # Audit logging tables
│   ├── migrations/          # Database migration files
│   ├── seeds/               # Seed data for development
│   ├── index.ts             # Database connection and exports
│   ├── seed.ts              # Seed script runner
│   └── test-queries.ts      # Database testing utilities
├── drizzle.config.ts        # Drizzle kit configuration
├── package.json             # Database package dependencies
└── tsconfig.json            # TypeScript configuration
```

## Shared Library Structure (`packages/lib/`)

```
lib/
├── src/
│   ├── calculations/        # Domain calculations (ABV, yield, COGS)
│   ├── validation/          # Zod schemas and validation logic
│   ├── rbac/                # Role-based access control utilities
│   ├── audit/               # Audit logging utilities
│   ├── types/               # Shared TypeScript types
│   └── utils/               # General utility functions
├── package.json             # Library package dependencies
└── tsconfig.json            # TypeScript configuration
```

## Worker Package Structure (`packages/worker/`)

```
worker/
├── src/
│   ├── jobs/                # Background job definitions
│   │   ├── exports/         # CSV/PDF export jobs
│   │   ├── snapshots/       # Inventory snapshot jobs
│   │   └── notifications/   # Email/alert jobs
│   ├── queue/               # Job queue management
│   ├── scheduler/           # Job scheduling logic
│   └── index.ts             # Worker process entry point
├── package.json             # Worker package dependencies
└── tsconfig.json            # TypeScript configuration
```

## File Naming Patterns

### Frontend Components
- **Pages**: `page.tsx` (Next.js App Router convention)
- **Layouts**: `layout.tsx` (Next.js App Router convention)
- **Components**: `PascalCase.tsx` (e.g., `VendorForm.tsx`)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-vendor-data.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `format-currency.ts`)

### Backend Files
- **Routers**: `kebab-case.ts` (e.g., `vendor-management.ts`)
- **Procedures**: `kebab-case.ts` (e.g., `create-vendor.ts`)
- **Schema**: `kebab-case.ts` (e.g., `vendor-schema.ts`)
- **Migrations**: `YYYY_MM_DD_HH_mm_ss_description.sql`

### Configuration Files
- **Environment**: `.env.local`, `.env.example`
- **Config files**: `kebab-case.config.js` (e.g., `tailwind.config.js`)
- **TypeScript**: `tsconfig.json`, `tsconfig.base.json`

## Module Organization

### Monorepo Dependencies
- **Web app imports**: `api`, `db`, `lib` packages via workspace references
- **API imports**: `db`, `lib` packages for data access and business logic
- **Worker imports**: `db`, `lib` packages for background processing
- **Shared types**: Exported from `lib` package for consistency

### Import Patterns
- **Absolute imports**: Configured with TypeScript path mapping
- **Package imports**: Use workspace references (e.g., `import { db } from 'db'`)
- **Relative imports**: Limited to same package/module
- **Index files**: Provide clean public APIs for packages

### Code Organization
- **Feature-based**: Group related functionality together
- **Domain-driven**: Align with cidery business processes
- **Separation of concerns**: Clear boundaries between packages
- **Type safety**: Shared types ensure consistency across packages