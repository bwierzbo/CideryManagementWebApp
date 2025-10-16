# Cidery Management MVP

Replace Excel with a web app to track vendor purchases → pressing → fermentation → packaging → inventory.

Primary Report: COGS per batch (CSV + PDF export, dashboard).

## Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind + shadcn/ui
- **Backend**: tRPC + PostgreSQL + Drizzle ORM
- **Auth**: Auth.js (credentials)
- **Deploy**: Vercel (frontend) + Neon/RDS (database)

## Monorepo Structure

```
/apps/web          # Next.js application
/packages/api      # tRPC routers + procedures
/packages/db       # Drizzle schema, migrations, seed
/packages/lib      # Domain logic (ABV, yield, RBAC, audit)
/packages/worker   # Background jobs (exports, snapshots)
```

## Quick Start

### Prerequisites

- Node.js 20+ (use `nvm use` to set the correct version)
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Generate database schema
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed the database
pnpm db:seed

# Start development servers
pnpm dev
```

## Scripts

- `pnpm dev` - Start web app + worker in development
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm typecheck` - TypeScript check all packages
- `pnpm test` - Run tests for all packages
- `pnpm format` - Format code with Prettier

## Required Environment Variables

### Database
- `DATABASE_URL` - PostgreSQL connection string

### Auth
- `NEXTAUTH_SECRET` - Random secret for Auth.js
- `NEXTAUTH_URL` - Application URL (http://localhost:3000 for dev)

### Optional
- `NODE_ENV` - Environment (development, production)

## Core Entities

- **Vendor** - Suppliers of raw materials
- **Purchase** + **PurchaseLines** - Procurement records
- **PressRun** - Apple pressing operations
- **JuiceLot** - Batches of pressed juice
- **Vessel** - Fermentation containers
- **Batch** - Fermentation batches
- **Measurement** - Quality metrics (ABV, pH, etc.)
- **Transfer** - Movement between vessels
- **BlendComponent** - Blend recipe components
- **PackagingRun** - Bottling/canning operations
- **InventoryItem** - Finished goods
- **InventoryMovement** - Stock movements
- **RefValue** - Reference data (units, categories, etc.)
- **User** - System users
- **AuditLog** - Change tracking

## Features

- **Always online** - Cloud hosted, no offline mode
- **Single facility** - One location, scalable architecture
- **Role-based access** - Admin, Operator, Viewer roles
- **Heavy autofill** - Smart defaults and suggestions
- **Audit logging** - Full change history
- **COGS reporting** - Detailed cost analysis per batch
- **Multi-unit support** - Automatic conversion between metric and imperial

## Unit Management

The application includes a comprehensive unit management system that automatically handles conversions between metric and imperial units:

### Supported Units

- **Volume**: Liters (L), Gallons (gal), Milliliters (mL)
- **Weight**: Kilograms (kg), Pounds (lb)
- **Temperature**: Celsius (°C), Fahrenheit (°F)

### Features

- **User Preferences**: Remembers your preferred units across sessions
- **Automatic Conversion**: All conversions handled transparently
- **Dual Storage**: Stores both original values and normalized values for accurate calculations
- **Database Triggers**: Auto-maintains normalized fields for consistent sorting/filtering
- **Smart Components**: React components that handle conversions automatically

### Quick Example

```tsx
import { VolumeInput, VolumeDisplay, UnitToggle } from "@/components/units";

// Editable input - value always in base unit (liters)
<VolumeInput
  value={volumeLiters}
  onChange={setVolumeLiters}
  label="Batch Volume"
  required
/>

// Display - automatically shows in user's preferred unit
<VolumeDisplay liters={batch.volumeLiters} showBothUnits />
// Shows: "50.00 gal (189.27 L)" or "189.27 L (50.00 gal)"

// Quick toggle between metric/imperial
<UnitToggle />
```

### How It Works

1. **User Input**: User enters "50" and selects "gallons"
2. **Conversion**: Automatically converted to liters (189.271 L)
3. **Storage**: Stored in database with both original (50 gal) and normalized (189.271 L) values
4. **Retrieval**: Queried using normalized values for consistency
5. **Display**: Converted back to user's preferred unit for display

See [Unit Management Documentation](packages/docs/UNITS.md) for complete details.

# CideryManagementWebApp
