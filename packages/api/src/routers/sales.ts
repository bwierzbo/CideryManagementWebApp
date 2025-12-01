/**
 * Sales Reporting Router
 *
 * API endpoints for sales analytics, revenue tracking, and margin analysis.
 * Aggregates data from inventoryDistributions and kegFills for comprehensive
 * sales reporting by channel, product, and time period.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  db,
  inventoryDistributions,
  inventoryItems,
  kegFills,
  salesChannels,
  batches,
  bottleRuns,
  batchCompositions,
} from "db";
import {
  eq,
  and,
  gte,
  lte,
  sql,
  desc,
  asc,
  isNull,
  isNotNull,
  ilike,
  or,
} from "drizzle-orm";

// Input schemas
const dateRangeInput = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const summaryInput = dateRangeInput.extend({
  channelIds: z.array(z.string()).optional(),
});

const trendsInput = dateRangeInput.extend({
  groupBy: z.enum(["day", "week", "month"]),
});

const topProductsInput = dateRangeInput.extend({
  limit: z.number().int().min(1).max(50).default(10),
});

const transactionsInput = dateRangeInput.extend({
  channelIds: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(["date", "revenue", "quantity"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const salesRouter = router({
  /**
   * Get sales summary KPIs for a date range.
   * Returns total revenue, units sold, average order value, and volume.
   * Includes comparison to previous period of same length.
   */
  getSummary: protectedProcedure
    .input(summaryInput)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      // Calculate previous period (same length before start date)
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevEndDate = new Date(startDate.getTime() - 1);
      const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

      // Build channel filter condition
      const channelFilter = input.channelIds?.length
        ? sql`${inventoryDistributions.salesChannelId} IN (${sql.join(
            input.channelIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )})`
        : sql`1=1`;

      // Current period distributions
      const currentDistributions = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
          totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
          totalVolumeLiters: sql<number>`COALESCE(SUM(
            CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL) / 1000
          ), 0)`,
          transactionCount: sql<number>`COUNT(*)`,
        })
        .from(inventoryDistributions)
        .leftJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(
          and(
            gte(inventoryDistributions.distributionDate, startDate),
            lte(inventoryDistributions.distributionDate, endDate),
            channelFilter
          )
        );

      // Current period keg fills (distributed status only)
      const kegChannelFilter = input.channelIds?.length
        ? sql`${kegFills.salesChannelId} IN (${sql.join(
            input.channelIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )})`
        : sql`1=1`;

      const currentKegFills = await db
        .select({
          totalVolumeLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
          kegCount: sql<number>`COUNT(*)`,
        })
        .from(kegFills)
        .where(
          and(
            eq(kegFills.status, "distributed"),
            isNotNull(kegFills.distributedAt),
            gte(kegFills.distributedAt, startDate),
            lte(kegFills.distributedAt, endDate),
            kegChannelFilter
          )
        );

      // Previous period distributions for comparison
      const prevDistributions = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
          totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
          totalVolumeLiters: sql<number>`COALESCE(SUM(
            CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL) / 1000
          ), 0)`,
        })
        .from(inventoryDistributions)
        .leftJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(
          and(
            gte(inventoryDistributions.distributionDate, prevStartDate),
            lte(inventoryDistributions.distributionDate, prevEndDate),
            channelFilter
          )
        );

      const prevKegFills = await db
        .select({
          totalVolumeLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
        })
        .from(kegFills)
        .where(
          and(
            eq(kegFills.status, "distributed"),
            isNotNull(kegFills.distributedAt),
            gte(kegFills.distributedAt, prevStartDate),
            lte(kegFills.distributedAt, prevEndDate),
            kegChannelFilter
          )
        );

      // Calculate totals
      const current = currentDistributions[0] || {
        totalRevenue: 0,
        totalUnits: 0,
        totalVolumeLiters: 0,
        transactionCount: 0,
      };
      const currentKeg = currentKegFills[0] || {
        totalVolumeLiters: 0,
        kegCount: 0,
      };
      const prev = prevDistributions[0] || {
        totalRevenue: 0,
        totalUnits: 0,
        totalVolumeLiters: 0,
      };
      const prevKeg = prevKegFills[0] || { totalVolumeLiters: 0 };

      const totalRevenue = Number(current.totalRevenue);
      const totalUnits = Number(current.totalUnits);
      const totalVolumeLiters =
        Number(current.totalVolumeLiters) + Number(currentKeg.totalVolumeLiters);
      const avgOrderValue =
        Number(current.transactionCount) > 0
          ? totalRevenue / Number(current.transactionCount)
          : 0;

      const prevRevenue = Number(prev.totalRevenue);
      const prevUnits = Number(prev.totalUnits);
      const prevVolume =
        Number(prev.totalVolumeLiters) + Number(prevKeg.totalVolumeLiters);

      // Calculate percentage changes
      const revenueChange =
        prevRevenue > 0
          ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
          : totalRevenue > 0
            ? 100
            : 0;
      const unitsChange =
        prevUnits > 0
          ? ((totalUnits - prevUnits) / prevUnits) * 100
          : totalUnits > 0
            ? 100
            : 0;
      const volumeChange =
        prevVolume > 0
          ? ((totalVolumeLiters - prevVolume) / prevVolume) * 100
          : totalVolumeLiters > 0
            ? 100
            : 0;

      return {
        totalRevenue,
        totalUnits,
        totalVolumeLiters,
        avgOrderValue,
        kegCount: Number(currentKeg.kegCount),
        transactionCount: Number(current.transactionCount),
        changes: {
          revenue: revenueChange,
          units: unitsChange,
          volume: volumeChange,
        },
        period: {
          startDate: input.startDate,
          endDate: input.endDate,
        },
        previousPeriod: {
          startDate: prevStartDate.toISOString(),
          endDate: prevEndDate.toISOString(),
          revenue: prevRevenue,
          units: prevUnits,
          volume: prevVolume,
        },
      };
    }),

  /**
   * Get sales breakdown by channel.
   * Returns revenue, units, and percentage of total for each channel.
   */
  getByChannel: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      // Get all active sales channels
      const channels = await db
        .select()
        .from(salesChannels)
        .where(eq(salesChannels.isActive, true))
        .orderBy(asc(salesChannels.sortOrder));

      // Get distributions grouped by channel
      const distributionsByChannel = await db
        .select({
          salesChannelId: inventoryDistributions.salesChannelId,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
          totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
          totalVolumeLiters: sql<number>`COALESCE(SUM(
            CAST(${inventoryDistributions.quantityDistributed} AS DECIMAL) *
            CAST(${inventoryItems.packageSizeML} AS DECIMAL) / 1000
          ), 0)`,
        })
        .from(inventoryDistributions)
        .leftJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(
          and(
            gte(inventoryDistributions.distributionDate, startDate),
            lte(inventoryDistributions.distributionDate, endDate)
          )
        )
        .groupBy(inventoryDistributions.salesChannelId);

      // Get keg fills grouped by channel
      const kegFillsByChannel = await db
        .select({
          salesChannelId: kegFills.salesChannelId,
          totalVolumeLiters: sql<number>`COALESCE(SUM(CAST(${kegFills.volumeTaken} AS DECIMAL)), 0)`,
          kegCount: sql<number>`COUNT(*)`,
        })
        .from(kegFills)
        .where(
          and(
            eq(kegFills.status, "distributed"),
            isNotNull(kegFills.distributedAt),
            gte(kegFills.distributedAt, startDate),
            lte(kegFills.distributedAt, endDate)
          )
        )
        .groupBy(kegFills.salesChannelId);

      // Build lookup maps
      const distMap = new Map(
        distributionsByChannel.map((d) => [d.salesChannelId, d])
      );
      const kegMap = new Map(
        kegFillsByChannel.map((k) => [k.salesChannelId, k])
      );

      // Calculate total for percentage
      const grandTotalRevenue = distributionsByChannel.reduce(
        (sum, d) => sum + Number(d.totalRevenue),
        0
      );

      // Build result with all channels
      const channelData = channels.map((channel) => {
        const dist = distMap.get(channel.id) || {
          totalRevenue: 0,
          totalUnits: 0,
          totalVolumeLiters: 0,
        };
        const keg = kegMap.get(channel.id) || {
          totalVolumeLiters: 0,
          kegCount: 0,
        };

        const revenue = Number(dist.totalRevenue);
        const units = Number(dist.totalUnits);
        const volume =
          Number(dist.totalVolumeLiters) + Number(keg.totalVolumeLiters);
        const kegCount = Number(keg.kegCount);
        const percentOfTotal =
          grandTotalRevenue > 0 ? (revenue / grandTotalRevenue) * 100 : 0;

        return {
          channelId: channel.id,
          channelCode: channel.code,
          channelName: channel.name,
          revenue,
          units,
          volumeLiters: volume,
          kegCount,
          percentOfTotal,
        };
      });

      // Add uncategorized (null channel)
      const uncategorizedDist = distributionsByChannel.find(
        (d) => d.salesChannelId === null
      );
      const uncategorizedKeg = kegFillsByChannel.find(
        (k) => k.salesChannelId === null
      );

      if (uncategorizedDist || uncategorizedKeg) {
        const revenue = Number(uncategorizedDist?.totalRevenue || 0);
        const units = Number(uncategorizedDist?.totalUnits || 0);
        const volume =
          Number(uncategorizedDist?.totalVolumeLiters || 0) +
          Number(uncategorizedKeg?.totalVolumeLiters || 0);
        const kegCount = Number(uncategorizedKeg?.kegCount || 0);
        const percentOfTotal =
          grandTotalRevenue > 0 ? (revenue / grandTotalRevenue) * 100 : 0;

        channelData.push({
          channelId: null as unknown as string,
          channelCode: "uncategorized" as "tasting_room" | "wholesale" | "online_dtc" | "events",
          channelName: "Uncategorized",
          revenue,
          units,
          volumeLiters: volume,
          kegCount,
          percentOfTotal,
        });
      }

      return {
        channels: channelData,
        totals: {
          revenue: grandTotalRevenue,
          units: channelData.reduce((sum, c) => sum + c.units, 0),
          volumeLiters: channelData.reduce((sum, c) => sum + c.volumeLiters, 0),
          kegCount: channelData.reduce((sum, c) => sum + c.kegCount, 0),
        },
      };
    }),

  /**
   * Get sales trends over time for charting.
   * Returns time-series data grouped by day, week, or month.
   */
  getTrends: protectedProcedure.input(trendsInput).query(async ({ input }) => {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    // Determine date truncation based on groupBy
    const dateTrunc =
      input.groupBy === "day"
        ? sql`DATE_TRUNC('day', ${inventoryDistributions.distributionDate})`
        : input.groupBy === "week"
          ? sql`DATE_TRUNC('week', ${inventoryDistributions.distributionDate})`
          : sql`DATE_TRUNC('month', ${inventoryDistributions.distributionDate})`;

    const trends = await db
      .select({
        date: dateTrunc.as("date"),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
        totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
      })
      .from(inventoryDistributions)
      .where(
        and(
          gte(inventoryDistributions.distributionDate, startDate),
          lte(inventoryDistributions.distributionDate, endDate)
        )
      )
      .groupBy(dateTrunc)
      .orderBy(asc(dateTrunc));

    return {
      trends: trends.map((t) => ({
        date: t.date,
        revenue: Number(t.totalRevenue),
        units: Number(t.totalUnits),
      })),
      groupBy: input.groupBy,
    };
  }),

  /**
   * Get top products by revenue.
   */
  getTopProducts: protectedProcedure
    .input(topProductsInput)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const products = await db
        .select({
          inventoryItemId: inventoryDistributions.inventoryItemId,
          lotCode: inventoryItems.lotCode,
          packageType: inventoryItems.packageType,
          packageSizeML: inventoryItems.packageSizeML,
          batchId: inventoryItems.batchId,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
          totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
          avgPrice: sql<number>`COALESCE(AVG(CAST(${inventoryDistributions.pricePerUnit} AS DECIMAL)), 0)`,
        })
        .from(inventoryDistributions)
        .innerJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(
          and(
            gte(inventoryDistributions.distributionDate, startDate),
            lte(inventoryDistributions.distributionDate, endDate)
          )
        )
        .groupBy(
          inventoryDistributions.inventoryItemId,
          inventoryItems.lotCode,
          inventoryItems.packageType,
          inventoryItems.packageSizeML,
          inventoryItems.batchId
        )
        .orderBy(
          desc(
            sql`SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL))`
          )
        )
        .limit(input.limit);

      // Get batch names for products
      const batchIds = products
        .map((p) => p.batchId)
        .filter((id): id is string => id !== null);

      const batchesData =
        batchIds.length > 0
          ? await db
              .select({ id: batches.id, name: batches.name })
              .from(batches)
              .where(
                sql`${batches.id} IN (${sql.join(
                  batchIds.map((id) => sql`${id}::uuid`),
                  sql`, `
                )})`
              )
          : [];

      const batchMap = new Map(batchesData.map((b) => [b.id, b.name]));

      return {
        products: products.map((p) => ({
          inventoryItemId: p.inventoryItemId,
          productName:
            p.lotCode ||
            batchMap.get(p.batchId || "") ||
            `${p.packageType} ${p.packageSizeML}ml`,
          packageType: p.packageType,
          packageSizeML: p.packageSizeML,
          batchName: batchMap.get(p.batchId || "") || null,
          revenue: Number(p.totalRevenue),
          units: Number(p.totalUnits),
          avgPrice: Number(p.avgPrice),
        })),
      };
    }),

  /**
   * Get margin analysis by product.
   * Compares revenue to COGS for profitability analysis.
   */
  getMargins: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      // Get sales data grouped by inventory item
      const salesData = await db
        .select({
          inventoryItemId: inventoryDistributions.inventoryItemId,
          lotCode: inventoryItems.lotCode,
          packageType: inventoryItems.packageType,
          packageSizeML: inventoryItems.packageSizeML,
          batchId: inventoryItems.batchId,
          bottleRunId: inventoryItems.bottleRunId,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL)), 0)`,
          totalUnits: sql<number>`COALESCE(SUM(${inventoryDistributions.quantityDistributed}), 0)`,
        })
        .from(inventoryDistributions)
        .innerJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(
          and(
            gte(inventoryDistributions.distributionDate, startDate),
            lte(inventoryDistributions.distributionDate, endDate)
          )
        )
        .groupBy(
          inventoryDistributions.inventoryItemId,
          inventoryItems.lotCode,
          inventoryItems.packageType,
          inventoryItems.packageSizeML,
          inventoryItems.batchId,
          inventoryItems.bottleRunId
        )
        .orderBy(
          desc(
            sql`SUM(CAST(${inventoryDistributions.totalRevenue} AS DECIMAL))`
          )
        );

      // Get batch costs for COGS calculation
      const batchIds = salesData
        .map((s) => s.batchId)
        .filter((id): id is string => id !== null);

      const batchCosts =
        batchIds.length > 0
          ? await db
              .select({
                batchId: batches.id,
                batchName: batches.name,
                volumeLiters: batches.initialVolumeLiters,
                totalMaterialCost: sql<number>`COALESCE(SUM(CAST(${batchCompositions.materialCost} AS DECIMAL)), 0)`,
              })
              .from(batches)
              .leftJoin(
                batchCompositions,
                eq(batches.id, batchCompositions.batchId)
              )
              .where(
                sql`${batches.id} IN (${sql.join(
                  batchIds.map((id) => sql`${id}::uuid`),
                  sql`, `
                )})`
              )
              .groupBy(
                batches.id,
                batches.name,
                batches.initialVolumeLiters
              )
          : [];

      const batchCostMap = new Map(
        batchCosts.map((b) => [
          b.batchId,
          {
            name: b.batchName,
            volumeLiters: Number(b.volumeLiters) || 0,
            totalMaterialCost: Number(b.totalMaterialCost),
          },
        ])
      );

      // Get bottle run costs
      const bottleRunIds = salesData
        .map((s) => s.bottleRunId)
        .filter((id): id is string => id !== null);

      const bottleRunCosts =
        bottleRunIds.length > 0
          ? await db
              .select({
                id: bottleRuns.id,
                laborHours: bottleRuns.laborHours,
                laborCostPerHour: bottleRuns.laborCostPerHour,
                overheadCostAllocated: bottleRuns.overheadCostAllocated,
                unitsProduced: bottleRuns.unitsProduced,
              })
              .from(bottleRuns)
              .where(
                sql`${bottleRuns.id} IN (${sql.join(
                  bottleRunIds.map((id) => sql`${id}::uuid`),
                  sql`, `
                )})`
              )
          : [];

      const bottleRunCostMap = new Map(
        bottleRunCosts.map((br) => {
          const laborCost =
            (Number(br.laborHours) || 0) *
            (Number(br.laborCostPerHour) || 0);
          const overhead = Number(br.overheadCostAllocated) || 0;
          const unitsProduced = Number(br.unitsProduced) || 1;
          const costPerUnit = (laborCost + overhead) / unitsProduced;
          return [br.id, costPerUnit];
        })
      );

      // Calculate margins for each product
      const margins = salesData.map((s) => {
        const revenue = Number(s.totalRevenue);
        const units = Number(s.totalUnits);
        const batchData = batchCostMap.get(s.batchId || "");
        const bottleRunCostPerUnit = bottleRunCostMap.get(s.bottleRunId || "") || 0;

        // Calculate COGS per unit
        let cogsPerUnit = bottleRunCostPerUnit;
        if (batchData && batchData.volumeLiters > 0) {
          // Material cost per liter from batch
          const materialCostPerLiter =
            batchData.totalMaterialCost / batchData.volumeLiters;
          // Volume per unit in liters
          const volumePerUnitLiters = (s.packageSizeML || 0) / 1000;
          // Add material cost per unit
          cogsPerUnit += materialCostPerLiter * volumePerUnitLiters;
        }

        const totalCogs = cogsPerUnit * units;
        const grossProfit = revenue - totalCogs;
        const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
          inventoryItemId: s.inventoryItemId,
          productName:
            s.lotCode ||
            batchData?.name ||
            `${s.packageType} ${s.packageSizeML}ml`,
          packageType: s.packageType,
          packageSizeML: s.packageSizeML,
          batchName: batchData?.name || null,
          revenue,
          units,
          cogs: totalCogs,
          cogsPerUnit,
          grossProfit,
          marginPercent,
        };
      });

      // Calculate totals
      const totals = margins.reduce(
        (acc, m) => ({
          revenue: acc.revenue + m.revenue,
          cogs: acc.cogs + m.cogs,
          grossProfit: acc.grossProfit + m.grossProfit,
        }),
        { revenue: 0, cogs: 0, grossProfit: 0 }
      );

      return {
        products: margins,
        totals: {
          ...totals,
          marginPercent:
            totals.revenue > 0
              ? (totals.grossProfit / totals.revenue) * 100
              : 0,
        },
      };
    }),

  /**
   * Get paginated sales transactions.
   */
  getTransactions: protectedProcedure
    .input(transactionsInput)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      // Build where conditions
      const conditions = [
        gte(inventoryDistributions.distributionDate, startDate),
        lte(inventoryDistributions.distributionDate, endDate),
      ];

      if (input.channelIds?.length) {
        conditions.push(
          sql`${inventoryDistributions.salesChannelId} IN (${sql.join(
            input.channelIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )})`
        );
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(inventoryItems.lotCode, `%${input.search}%`),
            ilike(inventoryDistributions.distributionLocation, `%${input.search}%`)
          )!
        );
      }

      // Determine sort column
      const sortColumn =
        input.sortBy === "revenue"
          ? inventoryDistributions.totalRevenue
          : input.sortBy === "quantity"
            ? inventoryDistributions.quantityDistributed
            : inventoryDistributions.distributionDate;

      const sortOrder = input.sortDir === "asc" ? asc : desc;

      // Get transactions
      const transactions = await db
        .select({
          id: inventoryDistributions.id,
          distributionDate: inventoryDistributions.distributionDate,
          inventoryItemId: inventoryDistributions.inventoryItemId,
          lotCode: inventoryItems.lotCode,
          packageType: inventoryItems.packageType,
          packageSizeML: inventoryItems.packageSizeML,
          salesChannelId: inventoryDistributions.salesChannelId,
          channelCode: salesChannels.code,
          channelName: salesChannels.name,
          distributionLocation: inventoryDistributions.distributionLocation,
          quantity: inventoryDistributions.quantityDistributed,
          pricePerUnit: inventoryDistributions.pricePerUnit,
          totalRevenue: inventoryDistributions.totalRevenue,
          notes: inventoryDistributions.notes,
        })
        .from(inventoryDistributions)
        .innerJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .leftJoin(
          salesChannels,
          eq(inventoryDistributions.salesChannelId, salesChannels.id)
        )
        .where(and(...conditions))
        .orderBy(sortOrder(sortColumn))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const countResult = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(inventoryDistributions)
        .innerJoin(
          inventoryItems,
          eq(inventoryDistributions.inventoryItemId, inventoryItems.id)
        )
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          date: t.distributionDate,
          inventoryItemId: t.inventoryItemId,
          productName: t.lotCode || `${t.packageType} ${t.packageSizeML}ml`,
          packageType: t.packageType,
          packageSizeML: t.packageSizeML,
          channelId: t.salesChannelId,
          channelName: t.channelName || "Uncategorized",
          location: t.distributionLocation,
          quantity: t.quantity,
          pricePerUnit: Number(t.pricePerUnit),
          revenue: Number(t.totalRevenue),
          notes: t.notes,
        })),
        total,
        hasMore: input.offset + transactions.length < total,
        pagination: {
          limit: input.limit,
          offset: input.offset,
        },
      };
    }),
});
