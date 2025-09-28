# 🗄️ Database Package - Neon PostgreSQL Integration

This package contains the complete database schema and setup for the Cidery Management MVP using PostgreSQL with Drizzle ORM, configured for Neon database hosting.

## 🚀 Quick Setup for Neon Database

### 1. Get Your Neon Connection String

From your Vercel dashboard or Neon console, copy your database connection string. It should look like:

```
postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 2. Configure Environment Variables

Update `.env.local` in the project root:

```bash
# Replace with your actual Neon database URL
DATABASE_URL="postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

Also update `packages/db/.env` with the same URL.

### 3. Test Connection & Setup

```bash
# Test the database connection
pnpm --filter db run db:setup-neon

# Push schema to database (creates all tables)
pnpm --filter db run db:push

# Seed with sample data
pnpm --filter db run db:seed

# Test queries work
pnpm --filter db run db:test
```

## 📁 Database Schema Overview

### Core Tables

- **vendors** - Apple suppliers with contact information
- **apple_varieties** - Different apple types with Brix values
- **purchases** - Purchase records from vendors
- **purchase_items** - Individual items in each purchase
- **press_runs** - Apple pressing sessions
- **press_items** - Individual press items from purchases
- **vessels** - Fermentation tanks and containers
- **batches** - Cider batches with lifecycle tracking
- **batch_ingredients** - Juice ingredients used in each batch
- **batch_measurements** - Fermentation progress measurements
- **packages** - Packaged products (bottles)
- **inventory** - Current stock levels
- **inventory_transactions** - Stock movement tracking
- **batch_costs** - Cost calculations and COGS
- **cogs_items** - Detailed cost item tracking
- **audit_log** - Complete change history

### Key Features

- ✅ **UUID primary keys** with pgcrypto
- ✅ **Soft deletes** throughout
- ✅ **Canonical unit storage** (kg for weight, L for volume)
- ✅ **Complete audit trail**
- ✅ **COGS calculations**
- ✅ **SSL support for Neon**

## 🛠️ Available Commands

```bash
# Database Setup
pnpm --filter db run db:setup-neon    # Test Neon connection
pnpm --filter db run db:push          # Deploy schema to database
pnpm --filter db run db:seed          # Add sample data
pnpm --filter db run db:setup         # Push + Seed in one command

# Development Tools
pnpm --filter db run db:studio        # Open Drizzle Studio
pnpm --filter db run db:test          # Run test queries
pnpm --filter db run typecheck        # TypeScript validation
pnpm --filter db run build            # Build the package

# Schema Management
pnpm --filter db run db:generate      # Generate new migrations
pnpm --filter db run db:reset         # Reset and reseed database
```

## 🔧 Troubleshooting

### Connection Issues

If you get connection errors:

1. Verify your `DATABASE_URL` is correct
2. Ensure your Neon database is running
3. Check that SSL is enabled in your connection string (`?sslmode=require`)

### SSL/TLS Issues

The client is configured to handle Neon's SSL requirements automatically. The connection will use SSL when:

- URL contains `neon.tech`
- URL contains `sslmode=require`

### Migration Issues

If tables already exist:

```bash
# Force reset the database
pnpm --filter db run db:reset
```

## 📊 Sample Data Included

The seed data includes:

- **3 vendors** (Mountain View Orchards, Sunrise Apple Farm, Heritage Fruit Co.)
- **6 apple varieties** (Honeycrisp, Granny Smith, Gala, Fuji, Northern Spy, Rhode Island Greening)
- **3 purchases** with realistic pricing and quantities
- **3 press runs** showing juice extraction
- **4 vessels** for fermentation
- **3 batches** in different stages
- **Complete cost tracking** and inventory management
- **Fermentation measurements** and progress tracking

## 🔗 Integration with Web App

Once set up, import the database client in your web app:

```typescript
import { db, vendors, batches } from "db";

// Query vendors
const activeVendors = await db
  .select()
  .from(vendors)
  .where(eq(vendors.isActive, true));
```

The `db` package is already configured in your workspace and ready to import into your Next.js app.
