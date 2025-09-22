# Issue #50 Analysis: Database Schema Extension

## Overview
Database schema extension to support multiple material types (apples, additives, juice, packaging) with flexible metadata storage.

## Work Streams

### Stream A: Migration Script
**Type:** sequential
**Agent:** general-purpose
**Files:**
- packages/db/migrations/[new]_add_material_type_and_metadata.sql

**Work:**
1. Create enum type for material_type
2. Add material_type column to inventory table
3. Add metadata JSONB column to inventory table
4. Set default values for existing data
5. Add indexes if needed

### Stream B: Drizzle Schema Updates
**Type:** parallel
**Agent:** general-purpose
**Files:**
- packages/db/src/schema.ts

**Work:**
1. Add material_type enum definition
2. Update inventory table schema with new columns
3. Update related types and relations
4. Ensure TypeScript types are generated correctly

### Stream C: Seed Data Updates
**Type:** sequential (depends on A & B)
**Agent:** general-purpose
**Files:**
- packages/db/src/seed.ts

**Work:**
1. Update seed data to include material_type values
2. Add example metadata for different material types
3. Ensure seed script runs without errors

## Dependencies
- Stream C depends on completion of Streams A and B
- Streams A and B can run in parallel

## Coordination Points
- Both A and B modify database structure - coordinate on column names
- Stream C needs final schema from both A and B

## Risk Mitigation
- Test migration on development database first
- Ensure rollback script is available
- Verify no breaking changes to existing queries