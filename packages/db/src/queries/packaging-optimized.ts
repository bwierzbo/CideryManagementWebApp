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
  bottleRuns,
  inventoryItems,
  packageSizes,
  batches,
  vessels,
  users,
  bottleRunPhotos,
  bottleRunMaterials,
  packagingPurchaseItems,
} from "..";
import {
  eq,
  and,
  or,
  ne,
  desc,
  asc,
  isNull,
  sql,
  gte,
  lte,
  inArray,
  like,
  gt,
  lt,
} from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

// Types for optimized queries
export interface BottleRunListItem {
  id: string;
  batchId: string;
  batchName: string | null;
  batchCustomName: string | null;
  vesselId: string;
  vesselName: string | null;
  packagedAt: Date;
  packageType: string;
  packageSizeML: number;
  packagingMaterialName: string | null;
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
  status?: "active" | "completed";
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
            sql`(${bottleRuns.packagedAt}, ${bottleRuns.id}) > (${packagedAt}, ${id})`,
          )
          .orderBy(asc(bottleRuns.packagedAt), asc(bottleRuns.id))
          .limit(limit);
      } else {
        // Forward pagination (default)
        return qb
          .where(
            sql`(${bottleRuns.packagedAt}, ${bottleRuns.id}) < (${packagedAt}, ${id})`,
          )
          .orderBy(desc(bottleRuns.packagedAt), desc(bottleRuns.id))
          .limit(limit);
      }
    } catch (error) {
      console.warn("Invalid cursor format, ignoring:", error);
    }
  }

  // No cursor, start from beginning
  return qb
    .orderBy(desc(bottleRuns.packagedAt), desc(bottleRuns.id))
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
export async function getBottleRunsOptimized(
  filters: PackagingRunFilters = {},
  pagination: CursorPaginationParams = {},
): Promise<PaginatedResult<BottleRunListItem>> {
  // Build WHERE conditions leveraging indexes
  const conditions = [];

  // Use packaging_runs_status_type_date_idx for status + type + date filtering
  if (filters.status) {
    if (filters.status === "active") {
      // Active means NOT completed (null or any other status)
      conditions.push(
        or(isNull(bottleRuns.status), ne(bottleRuns.status, "completed"))!,
      );
    } else if (filters.status === "completed") {
      // Completed means explicitly completed
      conditions.push(eq(bottleRuns.status, "completed"));
    }
  }

  if (filters.packageType) {
    conditions.push(eq(bottleRuns.packageType, filters.packageType as any));
  }

  if (filters.dateFrom) {
    conditions.push(gte(bottleRuns.packagedAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(bottleRuns.packagedAt, filters.dateTo));
  }

  if (filters.batchId) {
    conditions.push(eq(bottleRuns.batchId, filters.batchId));
  }

  if (filters.packageSizeML) {
    conditions.push(eq(bottleRuns.packageSizeML, filters.packageSizeML));
  }

  if (filters.qaTechnicianId) {
    conditions.push(eq(bottleRuns.qaTechnicianId, filters.qaTechnicianId));
  }

  // Base query with optimized joins and selective fields
  let query = db
    .select({
      id: bottleRuns.id,
      batchId: bottleRuns.batchId,
      vesselId: bottleRuns.vesselId,
      packagedAt: bottleRuns.packagedAt,
      packageType: bottleRuns.packageType,
      packageSizeML: bottleRuns.packageSizeML,
      packagingMaterialName: sql<string>`ppi.size`.as("packagingMaterialName"),
      unitsProduced: bottleRuns.unitsProduced,
      volumeTaken: bottleRuns.volumeTaken,
      volumeTakenUnit: bottleRuns.volumeTakenUnit,
      loss: bottleRuns.loss,
      lossUnit: bottleRuns.lossUnit,
      lossPercentage: bottleRuns.lossPercentage,
      status: bottleRuns.status,
      createdAt: bottleRuns.createdAt,
      // QA summary fields
      fillCheck: bottleRuns.fillCheck,
      abvAtPackaging: bottleRuns.abvAtPackaging,
      qaTechnicianId: bottleRuns.qaTechnicianId,
      // Related data
      batchName: batches.name,
      batchCustomName: batches.customName,
      vesselName: vessels.name,
      qaTechnicianName: sql<string>`qa_tech.name`.as("qaTechnicianName"),
    })
    .from(bottleRuns)
    .leftJoin(batches, eq(bottleRuns.batchId, batches.id))
    .leftJoin(vessels, eq(bottleRuns.vesselId, vessels.id))
    .leftJoin(
      sql`users AS qa_tech`,
      sql`qa_tech.id = ${bottleRuns.qaTechnicianId}`,
    )
    .leftJoin(
      sql`bottle_run_materials AS brm`,
      sql`brm.bottle_run_id = ${bottleRuns.id} AND brm.material_type = 'Primary Packaging'`,
    )
    .leftJoin(
      sql`packaging_purchase_items AS ppi`,
      sql`ppi.id = brm.packaging_purchase_item_id AND ((ppi.size ILIKE '%bottle%' AND ppi.size NOT ILIKE '%cap%' AND ppi.size NOT ILIKE '%label%') OR ppi.size ILIKE '%can%' OR ppi.size ILIKE '%keg%')`,
    );

  // Add batch search if needed (uses packaging_runs_batch_status_idx)
  if (filters.batchSearch) {
    conditions.push(
      or(
        like(batches.name, `%${filters.batchSearch}%`),
        like(batches.customName, `%${filters.batchSearch}%`)
      )!
    );
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
    .from(bottleRuns);

  if (filters.batchSearch) {
    countQuery = countQuery.leftJoin(
      batches,
      eq(bottleRuns.batchId, batches.id),
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
  const formattedResults: BottleRunListItem[] = results.map((item) => ({
    ...item,
    volumeTakenL: parseFloat(item.volumeTaken?.toString() || "0"),
    lossL: parseFloat(item.loss?.toString() || "0"),
    lossPercentage: parseFloat(item.lossPercentage?.toString() || "0"),
    abvAtPackaging: item.abvAtPackaging
      ? parseFloat(item.abvAtPackaging.toString())
      : null,
  }));

  // Deduplicate by bottle run ID (can have multiple rows due to multiple materials)
  // Prefer rows with non-null packaging material names
  const deduplicatedResults: BottleRunListItem[] = [];
  const seen = new Map<string, BottleRunListItem>();

  for (const item of formattedResults) {
    const existing = seen.get(item.id);
    if (!existing) {
      seen.set(item.id, item);
    } else if (item.packagingMaterialName && !existing.packagingMaterialName) {
      // Replace with item that has packaging material name
      seen.set(item.id, item);
    }
  }

  deduplicatedResults.push(...seen.values());

  return {
    items: deduplicatedResults,
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
export async function getBatchBottleRuns(
  batchIds: string[],
): Promise<Map<string, BottleRunListItem[]>> {
  if (batchIds.length === 0) return new Map();

  const results = await db
    .select({
      id: bottleRuns.id,
      batchId: bottleRuns.batchId,
      vesselId: bottleRuns.vesselId,
      packagedAt: bottleRuns.packagedAt,
      packageType: bottleRuns.packageType,
      packageSizeML: bottleRuns.packageSizeML,
      packagingMaterialName: sql<string>`ppi.size`.as("packagingMaterialName"),
      unitsProduced: bottleRuns.unitsProduced,
      volumeTaken: bottleRuns.volumeTaken,
      volumeTakenUnit: bottleRuns.volumeTakenUnit,
      loss: bottleRuns.loss,
      lossUnit: bottleRuns.lossUnit,
      lossPercentage: bottleRuns.lossPercentage,
      status: bottleRuns.status,
      createdAt: bottleRuns.createdAt,
      fillCheck: bottleRuns.fillCheck,
      abvAtPackaging: bottleRuns.abvAtPackaging,
      qaTechnicianId: bottleRuns.qaTechnicianId,
      batchName: batches.name,
      batchCustomName: batches.customName,
      vesselName: vessels.name,
      qaTechnicianName: sql<string>`qa_tech.name`.as("qaTechnicianName"),
    })
    .from(bottleRuns)
    .leftJoin(batches, eq(bottleRuns.batchId, batches.id))
    .leftJoin(vessels, eq(bottleRuns.vesselId, vessels.id))
    .leftJoin(
      sql`users AS qa_tech`,
      sql`qa_tech.id = ${bottleRuns.qaTechnicianId}`,
    )
    .leftJoin(
      sql`bottle_run_materials AS brm`,
      sql`brm.bottle_run_id = ${bottleRuns.id} AND brm.material_type = 'Primary Packaging'`,
    )
    .leftJoin(
      sql`packaging_purchase_items AS ppi`,
      sql`ppi.id = brm.packaging_purchase_item_id AND ((ppi.size ILIKE '%bottle%' AND ppi.size NOT ILIKE '%cap%' AND ppi.size NOT ILIKE '%label%') OR ppi.size ILIKE '%can%' OR ppi.size ILIKE '%keg%')`,
    )
    .where(sql`${bottleRuns.batchId} = ANY(${batchIds})`)
    .orderBy(desc(bottleRuns.packagedAt));

  // Deduplicate by bottle run ID (can have multiple rows due to multiple materials)
  // Prefer rows with non-null packaging material names
  const seen = new Map<string, typeof results[0]>();
  for (const item of results) {
    const existing = seen.get(item.id);
    if (!existing) {
      seen.set(item.id, item);
    } else if (item.packagingMaterialName && !existing.packagingMaterialName) {
      // Replace with item that has packaging material name
      seen.set(item.id, item);
    }
  }

  // Group by batch ID
  const grouped = new Map<string, BottleRunListItem[]>();

  for (const item of seen.values()) {
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
export async function getBottleRunInventory(bottleRunIds: string[]) {
  if (bottleRunIds.length === 0) return new Map();

  const inventory = await db
    .select({
      id: inventoryItems.id,
      bottleRunId: inventoryItems.bottleRunId,
      lotCode: inventoryItems.lotCode,
      packageType: inventoryItems.packageType,
      packageSizeML: inventoryItems.packageSizeML,
      expirationDate: inventoryItems.expirationDate,
      createdAt: inventoryItems.createdAt,
    })
    .from(inventoryItems)
    .where(
      and(
        inArray(inventoryItems.bottleRunId, bottleRunIds),
        isNull(inventoryItems.deletedAt),
      ),
    )
    .orderBy(desc(inventoryItems.createdAt));

  // Group by packaging run ID
  const grouped = new Map<string, typeof inventory>();

  for (const item of inventory) {
    if (!item.bottleRunId) continue;

    if (!grouped.has(item.bottleRunId)) {
      grouped.set(item.bottleRunId, []);
    }

    grouped.get(item.bottleRunId)!.push(item);
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
