/**
 * Optimized packaging queries for improved performance
 *
 * This module provides optimized query helpers for packaging operations:
 * - Cursor-based pagination for large datasets
 * - Efficient batch loading
 * - Query result caching
 * - Selective field loading for list views
 * - Optimized joins and index usage
 */

import {
  db,
  packagingRuns,
  inventoryItems,
  packageSizes,
  batches,
  vessels,
  users,
  packagingRunPhotos,
} from "..";
import {
  eq,
  and,
  desc,
  asc,
  isNull,
  sql,
  gte,
  lte,
  like,
  gt,
  lt,
} from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

// Types for optimized queries
export interface PackagingRunListItem {
  id: string;
  batchId: string;
  batchName: string | null;
  vesselId: string;
  vesselName: string | null;
  packagedAt: Date;
  packageType: string;
  packageSizeML: number;
  unitsProduced: number;
  volumeTakenL: number;
  lossL: number;
  lossPercentage: number;
  status: string | null;
  createdAt: Date;
  // QA summary fields
  fillCheck: string | null;
  abvAtPackaging: number | null;
  qaTechnicianName: string | null;
}

export interface CursorPaginationParams {
  cursor?: string; // Base64 encoded cursor
  limit?: number;
  direction?: "forward" | "backward";
}

export interface PackagingRunFilters {
  dateFrom?: Date;
  dateTo?: Date;
  batchId?: string;
  batchSearch?: string;
  packageType?: string;
  packageSizeML?: number;
  status?: "completed" | "voided";
  qaTechnicianId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

/**
 * Enhanced pagination query builder with cursor support
 * Uses packaged_at + id as composite cursor for stable pagination
 */
export function withCursorPagination<T extends PgSelect<any, any, any>>(
  qb: T,
  params: CursorPaginationParams,
) {
  const limit = Math.min(params.limit || 50, 100); // Cap at 100 items

  if (params.cursor) {
    try {
      const decodedCursor = JSON.parse(
        Buffer.from(params.cursor, "base64").toString(),
      );
      const { packagedAt, id } = decodedCursor;

      if (params.direction === "backward") {
        // For backward pagination, reverse the comparison
        return qb
          .where(
            sql`(${packagingRuns.packagedAt}, ${packagingRuns.id}) > (${packagedAt}, ${id})`,
          )
          .orderBy(asc(packagingRuns.packagedAt), asc(packagingRuns.id))
          .limit(limit);
      } else {
        // Forward pagination (default)
        return qb
          .where(
            sql`(${packagingRuns.packagedAt}, ${packagingRuns.id}) < (${packagedAt}, ${id})`,
          )
          .orderBy(desc(packagingRuns.packagedAt), desc(packagingRuns.id))
          .limit(limit);
      }
    } catch (error) {
      console.warn("Invalid cursor format, ignoring:", error);
    }
  }

  // No cursor, start from beginning
  return qb
    .orderBy(desc(packagingRuns.packagedAt), desc(packagingRuns.id))
    .limit(limit);
}

/**
 * Generate cursor for pagination
 */
export function generateCursor(packagedAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ packagedAt: packagedAt.toISOString(), id }),
  ).toString("base64");
}

/**
 * Optimized list query with selective field loading and cursor pagination
 * Uses composite indexes for efficient filtering and sorting
 */
export async function getPackagingRunsOptimized(
  filters: PackagingRunFilters = {},
  pagination: CursorPaginationParams = {},
): Promise<PaginatedResult<PackagingRunListItem>> {
  // Build WHERE conditions leveraging indexes
  const conditions = [];

  // Use packaging_runs_status_type_date_idx for status + type + date filtering
  if (filters.status) {
    conditions.push(eq(packagingRuns.status, filters.status as any));
  }

  if (filters.packageType) {
    conditions.push(eq(packagingRuns.packageType, filters.packageType as any));
  }

  if (filters.dateFrom) {
    conditions.push(gte(packagingRuns.packagedAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(packagingRuns.packagedAt, filters.dateTo));
  }

  if (filters.batchId) {
    conditions.push(eq(packagingRuns.batchId, filters.batchId));
  }

  if (filters.packageSizeML) {
    conditions.push(eq(packagingRuns.packageSizeML, filters.packageSizeML));
  }

  if (filters.qaTechnicianId) {
    conditions.push(eq(packagingRuns.qaTechnicianId, filters.qaTechnicianId));
  }

  // Base query with optimized joins and selective fields
  let query = db
    .select({
      id: packagingRuns.id,
      batchId: packagingRuns.batchId,
      vesselId: packagingRuns.vesselId,
      packagedAt: packagingRuns.packagedAt,
      packageType: packagingRuns.packageType,
      packageSizeML: packagingRuns.packageSizeML,
      unitsProduced: packagingRuns.unitsProduced,
      volumeTaken: packagingRuns.volumeTaken,
      volumeTakenUnit: packagingRuns.volumeTakenUnit,
      loss: packagingRuns.loss,
      lossUnit: packagingRuns.lossUnit,
      lossPercentage: packagingRuns.lossPercentage,
      status: packagingRuns.status,
      createdAt: packagingRuns.createdAt,
      // QA summary fields
      fillCheck: packagingRuns.fillCheck,
      abvAtPackaging: packagingRuns.abvAtPackaging,
      qaTechnicianId: packagingRuns.qaTechnicianId,
      // Related data
      batchName: batches.name,
      vesselName: vessels.name,
      qaTechnicianName: sql<string>`qa_tech.name`.as("qaTechnicianName"),
    })
    .from(packagingRuns)
    .leftJoin(batches, eq(packagingRuns.batchId, batches.id))
    .leftJoin(vessels, eq(packagingRuns.vesselId, vessels.id))
    .leftJoin(
      sql`users AS qa_tech`,
      sql`qa_tech.id = ${packagingRuns.qaTechnicianId}`,
    );

  // Add batch search if needed (uses packaging_runs_batch_status_idx)
  if (filters.batchSearch) {
    conditions.push(like(batches.name, `%${filters.batchSearch}%`));
  }

  // Apply filters
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // Apply cursor pagination
  query = withCursorPagination(query, pagination);

  // Execute query
  const results = await query;

  // Get total count for metadata (optimized with same indexes)
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(packagingRuns);

  if (filters.batchSearch) {
    countQuery = countQuery.leftJoin(
      batches,
      eq(packagingRuns.batchId, batches.id),
    );
  }

  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions));
  }

  const [countResult] = await countQuery;
  const totalCount = countResult?.count || 0;

  // Generate pagination metadata
  const hasNext = results.length === (pagination.limit || 50);
  const hasPrevious = !!pagination.cursor;

  let nextCursor: string | undefined;
  let previousCursor: string | undefined;

  if (hasNext && results.length > 0) {
    const lastItem = results[results.length - 1];
    nextCursor = generateCursor(lastItem.packagedAt, lastItem.id);
  }

  if (hasPrevious && results.length > 0) {
    const firstItem = results[0];
    previousCursor = generateCursor(firstItem.packagedAt, firstItem.id);
  }

  // Format results
  const formattedResults: PackagingRunListItem[] = results.map((item) => ({
    ...item,
    volumeTakenL: parseFloat(item.volumeTaken?.toString() || "0"),
    lossL: parseFloat(item.loss?.toString() || "0"),
    lossPercentage: parseFloat(item.lossPercentage?.toString() || "0"),
    abvAtPackaging: item.abvAtPackaging
      ? parseFloat(item.abvAtPackaging.toString())
      : null,
  }));

  return {
    items: formattedResults,
    totalCount,
    hasNext,
    hasPrevious,
    nextCursor,
    previousCursor,
  };
}

/**
 * Efficient batch loading for packaging run details
 * Uses packaging_runs_batch_created_idx for optimal performance
 */
export async function getBatchPackagingRuns(
  batchIds: string[],
): Promise<Map<string, PackagingRunListItem[]>> {
  if (batchIds.length === 0) return new Map();

  const results = await db
    .select({
      id: packagingRuns.id,
      batchId: packagingRuns.batchId,
      vesselId: packagingRuns.vesselId,
      packagedAt: packagingRuns.packagedAt,
      packageType: packagingRuns.packageType,
      packageSizeML: packagingRuns.packageSizeML,
      unitsProduced: packagingRuns.unitsProduced,
      volumeTaken: packagingRuns.volumeTaken,
      volumeTakenUnit: packagingRuns.volumeTakenUnit,
      loss: packagingRuns.loss,
      lossUnit: packagingRuns.lossUnit,
      lossPercentage: packagingRuns.lossPercentage,
      status: packagingRuns.status,
      createdAt: packagingRuns.createdAt,
      fillCheck: packagingRuns.fillCheck,
      abvAtPackaging: packagingRuns.abvAtPackaging,
      qaTechnicianId: packagingRuns.qaTechnicianId,
      batchName: batches.name,
      vesselName: vessels.name,
      qaTechnicianName: sql<string>`qa_tech.name`.as("qaTechnicianName"),
    })
    .from(packagingRuns)
    .leftJoin(batches, eq(packagingRuns.batchId, batches.id))
    .leftJoin(vessels, eq(packagingRuns.vesselId, vessels.id))
    .leftJoin(
      sql`users AS qa_tech`,
      sql`qa_tech.id = ${packagingRuns.qaTechnicianId}`,
    )
    .where(sql`${packagingRuns.batchId} = ANY(${batchIds})`)
    .orderBy(desc(packagingRuns.packagedAt));

  // Group by batch ID
  const grouped = new Map<string, PackagingRunListItem[]>();

  for (const item of results) {
    if (!grouped.has(item.batchId)) {
      grouped.set(item.batchId, []);
    }

    grouped.get(item.batchId)!.push({
      ...item,
      volumeTakenL: parseFloat(item.volumeTaken?.toString() || "0"),
      lossL: parseFloat(item.loss?.toString() || "0"),
      lossPercentage: parseFloat(item.lossPercentage?.toString() || "0"),
      abvAtPackaging: item.abvAtPackaging
        ? parseFloat(item.abvAtPackaging.toString())
        : null,
    });
  }

  return grouped;
}

/**
 * Cached package sizes query with optimized index usage
 * Uses package_sizes_active_type_size_idx for efficient lookups
 */
let packageSizesCache: Array<{
  id: string;
  sizeML: number;
  sizeOz: number | null;
  displayName: string;
  packageType: string;
  sortOrder: number | null;
}> | null = null;

let packageSizesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPackageSizesCached() {
  const now = Date.now();

  if (packageSizesCache && now - packageSizesCacheTime < CACHE_TTL) {
    return packageSizesCache;
  }

  const sizes = await db
    .select({
      id: packageSizes.id,
      sizeML: packageSizes.sizeML,
      sizeOz: packageSizes.sizeOz,
      displayName: packageSizes.displayName,
      packageType: packageSizes.packageType,
      sortOrder: packageSizes.sortOrder,
    })
    .from(packageSizes)
    .where(eq(packageSizes.isActive, true))
    .orderBy(packageSizes.sortOrder, packageSizes.sizeML);

  packageSizesCache = sizes.map((size) => ({
    ...size,
    sizeOz: size.sizeOz ? parseFloat(size.sizeOz.toString()) : null,
  }));

  packageSizesCacheTime = now;

  return packageSizesCache;
}

/**
 * Clear package sizes cache (useful for tests or when data changes)
 */
export function clearPackageSizesCache() {
  packageSizesCache = null;
  packageSizesCacheTime = 0;
}

/**
 * Optimized inventory lookup for packaging runs
 * Uses inventory_items_packaging_run_created_idx for efficient joins
 */
export async function getPackagingRunInventory(packagingRunIds: string[]) {
  if (packagingRunIds.length === 0) return new Map();

  const inventory = await db
    .select({
      id: inventoryItems.id,
      packagingRunId: inventoryItems.packagingRunId,
      lotCode: inventoryItems.lotCode,
      packageType: inventoryItems.packageType,
      packageSizeML: inventoryItems.packageSizeML,
      expirationDate: inventoryItems.expirationDate,
      createdAt: inventoryItems.createdAt,
    })
    .from(inventoryItems)
    .where(
      and(
        sql`${inventoryItems.packagingRunId} = ANY(${packagingRunIds})`,
        isNull(inventoryItems.deletedAt),
      ),
    )
    .orderBy(desc(inventoryItems.createdAt));

  // Group by packaging run ID
  const grouped = new Map<string, typeof inventory>();

  for (const item of inventory) {
    if (!item.packagingRunId) continue;

    if (!grouped.has(item.packagingRunId)) {
      grouped.set(item.packagingRunId, []);
    }

    grouped.get(item.packagingRunId)!.push(item);
  }

  return grouped;
}

/**
 * Performance metrics for query optimization analysis
 */
export interface QueryMetrics {
  queryName: string;
  executionTime: number;
  rowsReturned: number;
  indexesUsed: string[];
}

/**
 * Wrapper function to measure query performance
 */
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
): Promise<{ result: T; metrics: QueryMetrics }> {
  const startTime = Date.now();

  const result = await queryFn();

  const executionTime = Date.now() - startTime;

  const metrics: QueryMetrics = {
    queryName,
    executionTime,
    rowsReturned: Array.isArray(result) ? result.length : 1,
    indexesUsed: [], // Could be populated with EXPLAIN analysis
  };

  // Log slow queries for monitoring
  if (executionTime > 1000) {
    console.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
  }

  return { result, metrics };
}
