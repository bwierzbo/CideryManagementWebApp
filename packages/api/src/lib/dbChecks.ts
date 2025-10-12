import { db } from "db";
import { vendorVarieties } from "db/src/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Validates that a given vendor-variety combination exists in the vendor_varieties table
 * This ensures that vendors can only supply varieties they are approved/configured to provide
 *
 * @param vendorId - UUID of the vendor
 * @param varietyId - UUID of the apple variety
 * @returns Promise<boolean> - true if the vendor-variety relationship exists and is active
 *
 * @example
 * ```typescript
 * // Check if vendor can supply this variety before creating a purchase
 * const canSupply = await ensureVendorVariety(vendorId, varietyId)
 * if (!canSupply) {
 *   throw new Error('Vendor is not configured to supply this variety')
 * }
 * ```
 */
export async function ensureVendorVariety(
  vendorId: string,
  varietyId: string,
): Promise<boolean> {
  try {
    const relationship = await db
      .select({ id: vendorVarieties.id })
      .from(vendorVarieties)
      .where(
        and(
          eq(vendorVarieties.vendorId, vendorId),
          eq(vendorVarieties.varietyId, varietyId),
          isNull(vendorVarieties.deletedAt), // Only active relationships
        ),
      )
      .limit(1);

    return relationship.length > 0;
  } catch (error) {
    // Log the error but return false for safety
    console.error("Error checking vendor-variety relationship:", error);
    return false;
  }
}

/**
 * Gets all varieties that a vendor is approved to supply
 * Useful for populating dropdowns and validation in the UI
 *
 * @param vendorId - UUID of the vendor
 * @returns Promise<string[]> - Array of variety IDs that the vendor can supply
 *
 * @example
 * ```typescript
 * const availableVarieties = await getVendorVarieties(vendorId)
 * // Use in UI to filter variety options
 * ```
 */
export async function getVendorVarieties(vendorId: string): Promise<string[]> {
  try {
    const varieties = await db
      .select({ varietyId: vendorVarieties.varietyId })
      .from(vendorVarieties)
      .where(
        and(
          eq(vendorVarieties.vendorId, vendorId),
          isNull(vendorVarieties.deletedAt), // Only active relationships
        ),
      );

    return varieties.map((v) => v.varietyId);
  } catch (error) {
    console.error("Error fetching vendor varieties:", error);
    return [];
  }
}

/**
 * Creates a new vendor-variety relationship
 * Used when a vendor starts supplying a new variety
 *
 * @param vendorId - UUID of the vendor
 * @param varietyId - UUID of the apple variety
 * @param notes - Optional notes about this relationship
 * @returns Promise<boolean> - true if successfully created, false if already exists
 *
 * @example
 * ```typescript
 * const created = await createVendorVariety(vendorId, varietyId, 'New variety added for 2024 season')
 * ```
 */
export async function createVendorVariety(
  vendorId: string,
  varietyId: string,
  notes?: string,
): Promise<boolean> {
  try {
    // Check if relationship already exists
    const exists = await ensureVendorVariety(vendorId, varietyId);
    if (exists) {
      return false; // Already exists
    }

    await db.insert(vendorVarieties).values({
      vendorId,
      varietyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error("Error creating vendor-variety relationship:", error);
    return false;
  }
}
