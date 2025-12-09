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

## Detailed Development Setup with Claude Code

This section provides a comprehensive, step-by-step guide for new developers to set up this project using Claude Code.

### Prerequisites Checklist

Before starting, ensure you have the following installed and configured:

- [ ] **Node.js 20+** - Check with `node --version`
- [ ] **pnpm 8+** - Check with `pnpm --version` (install with `npm install -g pnpm`)
- [ ] **Git** - Check with `git --version`
- [ ] **Claude Code CLI** - Install from [claude.ai/code](https://claude.ai/code)
- [ ] **DATABASE_URL** - Get the PostgreSQL connection string from the project owner

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/bwierzbo/CideryManagementWebApp.git

# Navigate to the project directory
cd CideryManagementWebApp
```

### Step 2: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for all packages in the monorepo:
- `apps/web` - The Next.js frontend
- `packages/api` - tRPC API routers
- `packages/db` - Database schema and migrations
- `packages/lib` - Shared utilities
- `packages/worker` - Background jobs

### Step 3: Configure Environment Variables

You need to create environment files in multiple locations. The DATABASE_URL must be the same across all files.

**3.1. Create root `.env.local`:**
```bash
# In the project root directory
touch .env.local
```

Add the following content:
```env
# Database Connection (get from project owner)
DATABASE_URL=postgresql://your-connection-string-here

# Auth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
```

**3.2. Create `apps/web/.env.local`:**
```bash
touch apps/web/.env.local
```

Add the same DATABASE_URL and auth variables:
```env
DATABASE_URL=postgresql://your-connection-string-here
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
```

**3.3. Create `packages/db/.env`:**
```bash
touch packages/db/.env
```

Add the DATABASE_URL:
```env
DATABASE_URL=postgresql://your-connection-string-here
```

### Step 4: Database Setup

Once your environment variables are configured, set up the database:

```bash
# Run database migrations (applies schema to database)
pnpm db:migrate

# Seed the database with sample data (optional but recommended)
pnpm db:seed
```

**Verify database connection:**
```bash
# Open Drizzle Studio to view your database
pnpm --filter db run db:studio
```

This opens a web interface at `https://local.drizzle.studio` where you can browse tables and data.

### Step 5: Start the Development Server

```bash
# Start the web app (runs on port 3001)
pnpm dev
```

The application will be available at **http://localhost:3001**

### Step 6: Verify Your Setup

1. **Check the terminal** - You should see "Ready" messages without errors
2. **Open http://localhost:3001** - You should see the login page
3. **Sign in** - Use credentials from the seeded data or create a new account
4. **Navigate the app** - Check that pages load without errors

### Working with Claude Code

Once your environment is set up, you can use Claude Code to help with development:

```bash
# Start Claude Code in the project directory
claude

# Claude reads CLAUDE.md automatically for project context
# Ask Claude to help with tasks like:
# - "Add a new field to the batch schema"
# - "Create a new tRPC endpoint"
# - "Fix the build error in..."
```

**Key files Claude uses for context:**
- `CLAUDE.md` - Project-specific instructions and patterns
- `README.md` - Project overview
- `packages/db/src/schema.ts` - Database schema
- `packages/api/src/routers/` - API endpoints

### Common Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (port 3001) |
| `pnpm build` | Build all packages for production |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm test` | Run test suite |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm --filter db run db:studio` | Open database GUI |
| `pnpm --filter web run dev` | Start only the web app |

### Troubleshooting

**"Cannot connect to database"**
- Verify DATABASE_URL is correct in all three `.env` files
- Check that the database server is accessible
- Ensure `?sslmode=require` is in the connection string for Neon

**"Module not found" errors**
- Run `pnpm install` again
- Delete `node_modules` and reinstall: `rm -rf node_modules && pnpm install`

**"Port 3001 already in use"**
- Kill the process using the port: `lsof -ti:3001 | xargs kill -9`
- Or use a different port: `pnpm --filter web run dev -- -p 3002`

**TypeScript errors after pulling changes**
- Run `pnpm typecheck` to see all errors
- Run `pnpm build` to ensure packages are compiled

**Database schema out of sync**
- Run `pnpm db:migrate` to apply latest migrations
- Check `packages/db/migrations/` for pending migrations

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
