# Cidery Management App - Setup Instructions

## Prerequisites
- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Git installed

## Step 1: Clone the Repository

```bash
git clone https://github.com/bwierzbo/CideryManagementWebApp.git
cd CideryManagementWebApp
```

## Step 2: Install Dependencies

```bash
pnpm install
```

## Step 3: Set Up Environment Variables

Create a `.env` file in the root directory with the following content:

```env
# Database Connection (Neon PostgreSQL)
DATABASE_URL="postgresql://neondb_owner:npg_Vp9dbKcf2YRN@ep-super-smoke-adgofb1l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# NextAuth Configuration
NEXTAUTH_SECRET="your-nextauth-secret-key-here"
NEXTAUTH_URL="http://localhost:3001"
```

### Generating NEXTAUTH_SECRET

If you need to generate a new NEXTAUTH_SECRET, run:

```bash
openssl rand -base64 32
```

Or use the existing one from your current setup.

## Step 4: Run Database Migrations

```bash
pnpm db:migrate
```

This will apply all database migrations to set up the schema.

## Step 5: (Optional) Seed Database

If you want to populate the database with sample data:

```bash
pnpm db:seed
```

## Step 6: Start Development Server

```bash
pnpm dev
```

The app will be available at: http://localhost:3001

## Verification Commands

### Check if everything is working:

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Useful Development Commands:

```bash
# Open Drizzle Studio (database GUI)
pnpm --filter db run db:studio

# Start only web app
pnpm --filter web run dev

# Start only worker
pnpm --filter worker run dev

# Build all packages
pnpm build
```

## Troubleshooting

### Port 3001 already in use
If port 3001 is busy, you can change it in `apps/web/package.json`:
```json
"dev": "next dev -p 3002"
```

### Database connection issues
- Verify the DATABASE_URL is correct
- Check network/firewall settings
- Ensure Neon database is accessible

### Migration issues
If migrations fail, you can reset:
```bash
# Drop all tables and rerun migrations (CAUTION: destroys data)
pnpm --filter db run db:drop
pnpm db:migrate
pnpm db:seed
```

## Project Structure

- `apps/web/` - Next.js frontend application
- `packages/api/` - tRPC API routers
- `packages/db/` - Database schema and migrations
- `packages/lib/` - Shared utilities
- `packages/worker/` - Background jobs

## Default Login Credentials

After seeding, you can log in with:
- **Admin User**: Check the seed data in `packages/db/src/seed/index.ts`
- Default passwords are typically hashed, check seed file for details

## Next Steps

1. Run the app: `pnpm dev`
2. Open browser: http://localhost:3001
3. Log in with seeded credentials
4. Start developing!

## Need Help?

- Check CLAUDE.md for development guidelines
- Review `.claude/CLAUDE.md` for coding standards
- See the GitHub repo for issues and documentation
