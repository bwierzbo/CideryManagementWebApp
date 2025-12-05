/**
 * Parses a prefixed inventory item ID to extract the type and actual UUID
 * Inventory list returns IDs like "additive-{uuid}", "basefruit-{uuid}", etc.
 */
export function parseInventoryItemId(prefixedId: string): {
  type: "basefruit" | "additive" | "juice" | "packaging";
  id: string;
} | null {
  // Handle IDs with prefixes: "basefruit-uuid", "additive-uuid", "juice-uuid", "packaging-uuid"
  const prefixes = ["basefruit", "additive", "juice", "packaging"] as const;

  for (const prefix of prefixes) {
    if (prefixedId.startsWith(`${prefix}-`)) {
      const id = prefixedId.slice(prefix.length + 1); // +1 for the hyphen
      return { type: prefix, id };
    }
  }

  return null;
}

/**
 * Gets the display name for an inventory item type
 */
export function getInventoryTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    basefruit: "Base Fruit",
    additive: "Additive",
    juice: "Juice",
    packaging: "Packaging",
    apple: "Apple",
  };
  return typeNames[type] || type;
}
