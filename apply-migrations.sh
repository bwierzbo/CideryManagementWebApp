#!/bin/bash

# Apply the migrations to fix data issues

echo "Applying migrations to fix inventory data..."

# Load environment variables
source .env

# Apply the migrations
echo "1. Cleaning up additive names..."
psql "$DATABASE_URL" < packages/db/migrations/0007_clean_additive_names.sql

echo "2. Fixing orphaned press items..."
psql "$DATABASE_URL" < packages/db/migrations/0008_fix_orphaned_press_items.sql

echo "Migrations applied successfully!"
echo ""
echo "Now you can run: pnpm --filter db run db:push"
echo "to apply any schema changes."