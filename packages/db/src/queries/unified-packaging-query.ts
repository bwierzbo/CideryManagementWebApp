/**
 * NEW Unified Packaging Query Implementation
 * This is the replacement for getBottleRunsOptimized that includes both bottles and kegs
 */

import {
  db,
  bottleRuns,
  batches,
  vessels,
  users,
  kegFills,
  kegs,
  batchCarbonationOperations,
} from "..";
import {
  eq,
  and,
  or,
  ne,
  desc,
  isNull,
  sql,
  gte,
  lte,
  like,
} from "drizzle-orm";
import type { PackagingRunFilters, CursorPaginationParams, PaginatedResult, PackagingRunListItem, BottleRunListItem, KegFillListItem } from "./packaging-optimized";

/**
 * Unified packaging query that combines bottle runs and keg fills
 * Queries both tables, combines results, and applies pagination
 */
export async function getUnifiedPackagingRuns(
  filters: PackagingRunFilters = {},
  pagination: CursorPaginationParams = {},
): Promise<PaginatedResult<PackagingRunListItem>> {
  const limit = Math.min(pagination.limit || 50, 100);

  // Determine which sources to query based on packageType filter
  const shouldQueryBottles = !filters.packageType || filters.packageType !== 'keg';
  const shouldQueryKegs = !filters.packageType || filters.packageType === 'keg';

  let bottleResults: BottleRunListItem[] = [];
  let kegResults: KegFillListItem[] = [];
  let bottleCount = 0;
  let kegCount = 0;

  // Query bottle runs if needed
  if (shouldQueryBottles) {
    const bottleConditions = [];

    // Filter out voided runs
    bottleConditions.push(isNull(bottleRuns.voidedAt));

    // Status filter
    if (filters.status) {
      if (filters.status === "active") {
        bottleConditions.push(
          or(isNull(bottleRuns.status), ne(bottleRuns.status, "completed"))!,
        );
      } else if (filters.status === "completed") {
        bottleConditions.push(eq(bottleRuns.status, "completed"));
      }
    }

    // Package type filter (for bottles, exclude 'keg')
    if (filters.packageType && filters.packageType !== 'keg') {
      // Handle comma-separated package types (e.g., "bottle,can")
      const types = filters.packageType.split(',').map(t => t.trim());
      if (types.length === 1) {
        bottleConditions.push(eq(bottleRuns.packageType, types[0] as any));
      } else {
        bottleConditions.push(
          or(...types.map(type => eq(bottleRuns.packageType, type as any)))!
        );
      }
    }

    // Date filters
    if (filters.dateFrom) {
      bottleConditions.push(gte(bottleRuns.packagedAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      bottleConditions.push(lte(bottleRuns.packagedAt, filters.dateTo));
    }

    // Batch filters
    if (filters.batchId) {
      bottleConditions.push(eq(bottleRuns.batchId, filters.batchId));
    }

    // Package size filter
    if (filters.packageSizeML) {
      bottleConditions.push(eq(bottleRuns.packageSizeML, filters.packageSizeML));
    }

    // Build query
    let bottleQuery = db
      .select({
        id: bottleRuns.id,
        batchId: bottleRuns.batchId,
        vesselId: bottleRuns.vesselId,
        packagedAt: bottleRuns.packagedAt,
        packageType: bottleRuns.packageType,
        packageSizeML: bottleRuns.packageSizeML,
        unitsProduced: bottleRuns.unitsProduced,
        volumeTaken: bottleRuns.volumeTaken,
        loss: bottleRuns.loss,
        lossPercentage: bottleRuns.lossPercentage,
        status: bottleRuns.status,
        createdAt: bottleRuns.createdAt,
        fillCheck: bottleRuns.fillCheck,
        abvAtPackaging: bottleRuns.abvAtPackaging,
        pasteurizedAt: bottleRuns.pasteurizedAt,
        labeledAt: bottleRuns.labeledAt,
        unitsLabeled: bottleRuns.unitsLabeled,
        carbonationLevel: bottleRuns.carbonationLevel,
        carbonationCo2Volumes: batchCarbonationOperations.finalCo2Volumes,
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
        batchCarbonationOperations,
        eq(bottleRuns.sourceCarbonationOperationId, batchCarbonationOperations.id),
      );

    // Add batch search filter
    if (filters.batchSearch) {
      bottleConditions.push(
        or(
          like(batches.name, `%${filters.batchSearch}%`),
          like(batches.customName, `%${filters.batchSearch}%`)
        )!
      );
    }

    // Apply conditions
    if (bottleConditions.length > 0) {
      bottleQuery = bottleQuery.where(and(...bottleConditions));
    }

    // Execute with large limit (we'll paginate after combining)
    bottleQuery = bottleQuery
      .orderBy(desc(bottleRuns.packagedAt))
      .limit(limit * 2); // Get more than needed for combining

    const results = await bottleQuery;

    // Format results with source discriminator
    bottleResults = results.map((item): BottleRunListItem => ({
      source: 'bottle_run',
      id: item.id,
      batchId: item.batchId,
      batchName: item.batchName,
      batchCustomName: item.batchCustomName,
      vesselId: item.vesselId,
      vesselName: item.vesselName,
      packagedAt: item.packagedAt,
      packageType: item.packageType || 'bottle',
      packageSizeML: item.packageSizeML,
      packagingMaterialName: null,
      unitsProduced: item.unitsProduced,
      volumeTakenL: parseFloat(item.volumeTaken?.toString() || "0"),
      lossL: parseFloat(item.loss?.toString() || "0"),
      lossPercentage: parseFloat(item.lossPercentage?.toString() || "0"),
      status: item.status,
      createdAt: item.createdAt,
      fillCheck: item.fillCheck,
      abvAtPackaging: item.abvAtPackaging
        ? parseFloat(item.abvAtPackaging.toString())
        : null,
      qaTechnicianName: item.qaTechnicianName,
      pasteurizedAt: item.pasteurizedAt,
      labeledAt: item.labeledAt,
      unitsLabeled: item.unitsLabeled,
      carbonationLevel: item.carbonationLevel,
      carbonationCo2Volumes: item.carbonationCo2Volumes
        ? parseFloat(item.carbonationCo2Volumes.toString())
        : null,
    }));

    // Get count (use same conditions as main query)
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(bottleRuns);

    if (filters.batchSearch) {
      countQuery = countQuery.leftJoin(batches, eq(bottleRuns.batchId, batches.id));
    }

    // Apply the same conditions as the main query (includes voidedAt filter)
    if (bottleConditions.length > 0) {
      countQuery = countQuery.where(and(...bottleConditions));
    }

    const [countResult] = await countQuery;
    bottleCount = Number(countResult?.count) || 0;
  }

  // Query keg fills if needed
  if (shouldQueryKegs) {
    const kegConditions = [];

    // Filter out voided and soft-deleted fills
    kegConditions.push(isNull(kegFills.voidedAt));
    kegConditions.push(isNull(kegFills.deletedAt));

    // Status filter
    if (filters.status) {
      if (filters.status === "active") {
        // For kegs, active means filled or distributed
        kegConditions.push(
          or(
            eq(kegFills.status, "filled"),
            eq(kegFills.status, "distributed")
          )!
        );
      } else if (filters.status === "completed") {
        // For kegs, completed means returned
        kegConditions.push(eq(kegFills.status, "returned"));
      }
    }

    // Date filters
    if (filters.dateFrom) {
      kegConditions.push(gte(kegFills.filledAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      kegConditions.push(lte(kegFills.filledAt, filters.dateTo));
    }

    // Batch filters
    if (filters.batchId) {
      kegConditions.push(eq(kegFills.batchId, filters.batchId));
    }

    // Build query
    let kegQuery = db
      .select({
        id: kegFills.id,
        kegId: kegFills.kegId,
        batchId: kegFills.batchId,
        vesselId: kegFills.vesselId,
        filledAt: kegFills.filledAt,
        volumeTaken: kegFills.volumeTaken,
        loss: kegFills.loss,
        remainingVolume: kegFills.remainingVolume,
        status: kegFills.status,
        createdAt: kegFills.createdAt,
        abvAtPackaging: kegFills.abvAtPackaging,
        distributedAt: kegFills.distributedAt,
        distributionLocation: kegFills.distributionLocation,
        batchName: batches.name,
        batchCustomName: batches.customName,
        vesselName: vessels.name,
        kegNumber: kegs.kegNumber,
        kegCapacityML: kegs.capacityML,
      })
      .from(kegFills)
      .leftJoin(batches, eq(kegFills.batchId, batches.id))
      .leftJoin(vessels, eq(kegFills.vesselId, vessels.id))
      .leftJoin(kegs, eq(kegFills.kegId, kegs.id));

    // Add batch search filter
    if (filters.batchSearch) {
      kegConditions.push(
        or(
          like(batches.name, `%${filters.batchSearch}%`),
          like(batches.customName, `%${filters.batchSearch}%`)
        )!
      );
    }

    // Apply conditions
    if (kegConditions.length > 0) {
      kegQuery = kegQuery.where(and(...kegConditions));
    }

    // Execute with large limit (we'll paginate after combining)
    kegQuery = kegQuery
      .orderBy(desc(kegFills.filledAt))
      .limit(limit * 2); // Get more than needed for combining

    const results = await kegQuery;

    // Format results with source discriminator
    kegResults = results.map((item): KegFillListItem => ({
      source: 'keg_fill',
      id: item.id,
      kegId: item.kegId,
      batchId: item.batchId,
      batchName: item.batchName,
      batchCustomName: item.batchCustomName,
      vesselId: item.vesselId,
      vesselName: item.vesselName,
      packagedAt: item.filledAt, // Map filledAt to packagedAt
      packageType: 'keg',
      packageSizeML: item.kegCapacityML || 19000, // Default to 19L if missing
      packagingMaterialName: item.kegNumber,
      unitsProduced: 1, // Kegs are always 1 unit
      volumeTakenL: parseFloat(item.volumeTaken?.toString() || "0"),
      lossL: parseFloat(item.loss?.toString() || "0"),
      lossPercentage: item.loss && item.volumeTaken
        ? (parseFloat(item.loss.toString()) / parseFloat(item.volumeTaken.toString())) * 100
        : 0,
      status: item.status,
      createdAt: item.createdAt,
      fillCheck: null,
      abvAtPackaging: item.abvAtPackaging
        ? parseFloat(item.abvAtPackaging.toString())
        : null,
      qaTechnicianName: null,
      kegNumber: item.kegNumber,
      remainingVolumeL: item.remainingVolume
        ? parseFloat(item.remainingVolume.toString())
        : null,
      distributedAt: item.distributedAt,
      distributionLocation: item.distributionLocation,
      carbonationLevel: null,
      carbonationCo2Volumes: null,
    }));

    // Get count (use same conditions as main query)
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(kegFills);

    if (filters.batchSearch) {
      countQuery = countQuery.leftJoin(batches, eq(kegFills.batchId, batches.id));
    }

    // Apply the same conditions as the main query (includes voidedAt filter)
    if (kegConditions.length > 0) {
      countQuery = countQuery.where(and(...kegConditions));
    }

    const [countResult] = await countQuery;
    kegCount = Number(countResult?.count) || 0;
  }

  // Combine results
  const combined: PackagingRunListItem[] = [...bottleResults, ...kegResults];

  // Sort by packagedAt desc
  combined.sort((a, b) => b.packagedAt.getTime() - a.packagedAt.getTime());

  // Apply pagination
  const offset = pagination.cursor ? parseInt(Buffer.from(pagination.cursor, 'base64').toString()) : 0;
  const paginatedItems = combined.slice(offset, offset + limit);

  // Calculate total
  const totalCount = bottleCount + kegCount;
  const hasNext = (offset + limit) < totalCount;
  const hasPrevious = offset > 0;

  return {
    items: paginatedItems,
    totalCount,
    hasNext,
    hasPrevious,
    nextCursor: hasNext ? Buffer.from((offset + limit).toString()).toString('base64') : undefined,
    previousCursor: hasPrevious ? Buffer.from(Math.max(0, offset - limit).toString()).toString('base64') : undefined,
  };
}
