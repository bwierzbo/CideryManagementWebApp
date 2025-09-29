/**
 * Database Deprecation Naming Convention
 *
 * Provides consistent naming patterns for deprecated database elements.
 * Format: {original_name}_deprecated_{YYYYMMDD}_{reason_code}
 */

export type DeprecationReason =
  | "unused"
  | "performance"
  | "migration"
  | "refactor"
  | "security"
  | "optimization";

// Database identifier length limits (PostgreSQL standard)
const MAX_IDENTIFIER_LENGTH = 63;
const DEPRECATION_SUFFIX_LENGTH = "_deprecated_YYYYMMDD_REASON".length; // ~26 chars

// Reason code mappings for shorter suffixes
const REASON_CODES: Record<DeprecationReason, string> = {
  unused: "unu", // unused elements
  performance: "perf", // performance optimization
  migration: "migr", // migration/restructuring
  refactor: "refr", // code refactoring
  security: "sec", // security improvements
  optimization: "opt", // general optimization
};

/**
 * Generate a deprecated name following the naming convention
 */
export function generateDeprecatedName(
  originalName: string,
  reason: DeprecationReason,
  date?: Date,
): string {
  const targetDate = date || new Date();
  const dateStr = formatDeprecationDate(targetDate);
  const reasonCode = REASON_CODES[reason];

  // Base deprecated name
  const deprecatedSuffix = `_deprecated_${dateStr}_${reasonCode}`;

  // Check if the full name fits within limits
  const fullName = `${originalName}${deprecatedSuffix}`;

  if (fullName.length <= MAX_IDENTIFIER_LENGTH) {
    return fullName;
  }

  // If too long, truncate the original name
  const maxOriginalLength = MAX_IDENTIFIER_LENGTH - deprecatedSuffix.length;
  const truncatedOriginal = originalName.substring(0, maxOriginalLength);

  return `${truncatedOriginal}${deprecatedSuffix}`;
}

/**
 * Parse a deprecated name to extract components
 */
export function parseDeprecatedName(deprecatedName: string): {
  originalName: string;
  deprecationDate: Date;
  reason: DeprecationReason;
  isValid: boolean;
} {
  const regex = /^(.+)_deprecated_(\d{8})_([a-z]+)$/;
  const match = deprecatedName.match(regex);

  if (!match) {
    return {
      originalName: "",
      deprecationDate: new Date(),
      reason: "unused",
      isValid: false,
    };
  }

  const [, originalName, dateStr, reasonCode] = match;

  // Parse date
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  const deprecationDate = new Date(year, month, day);

  // Find reason from code
  const reason = Object.entries(REASON_CODES).find(
    ([, code]) => code === reasonCode,
  )?.[0] as DeprecationReason;

  return {
    originalName,
    deprecationDate,
    reason: reason || "unused",
    isValid: true,
  };
}

/**
 * Validate a deprecated name follows the naming convention
 */
export function validateNamingConvention(name: string): boolean {
  // Check length
  if (name.length > MAX_IDENTIFIER_LENGTH) {
    return false;
  }

  // Check format
  const regex = /^(.+)_deprecated_(\d{8})_([a-z]+)$/;
  if (!regex.test(name)) {
    return false;
  }

  // Parse and validate components
  const parsed = parseDeprecatedName(name);
  if (!parsed.isValid) {
    return false;
  }

  // Validate date is reasonable (not too far in future/past)
  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );
  const oneMonthFromNow = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );

  if (
    parsed.deprecationDate < oneYearAgo ||
    parsed.deprecationDate > oneMonthFromNow
  ) {
    return false;
  }

  // Validate reason code
  const validReasonCodes = Object.values(REASON_CODES);
  const reasonCode = name.split("_").pop();
  if (!reasonCode || !validReasonCodes.includes(reasonCode)) {
    return false;
  }

  return true;
}

/**
 * Check if a name is a deprecated name
 */
export function isDeprecatedName(name: string): boolean {
  return name.includes("_deprecated_") && validateNamingConvention(name);
}

/**
 * Generate a unique deprecated name to avoid collisions
 */
export function generateUniqueDeprecatedName(
  originalName: string,
  reason: DeprecationReason,
  existingNames: string[],
  date?: Date,
): string {
  let baseName = generateDeprecatedName(originalName, reason, date);

  // If no collision, return the base name
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  // Handle collisions by adding a suffix
  let counter = 1;
  let uniqueName: string;

  do {
    // Try with counter suffix
    const suffix = `_${counter.toString().padStart(2, "0")}`;

    // Need to make room for the counter
    const maxLength = MAX_IDENTIFIER_LENGTH - suffix.length;
    const truncatedBase = baseName.substring(0, maxLength);
    uniqueName = `${truncatedBase}${suffix}`;

    counter++;
  } while (existingNames.includes(uniqueName) && counter <= 99);

  if (counter > 99) {
    throw new Error(
      `Unable to generate unique deprecated name for: ${originalName}`,
    );
  }

  return uniqueName;
}

/**
 * Get all possible deprecated names for an original name
 * Useful for finding all historical deprecations of the same element
 */
export function getDeprecatedNamePattern(originalName: string): string {
  // PostgreSQL regex pattern to match all deprecated versions
  return `^${escapeRegex(originalName)}_deprecated_\\d{8}_[a-z]+(_\\d{2})?$`;
}

/**
 * Format date for deprecation naming
 */
function formatDeprecationDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate that a name can be safely deprecated
 */
export function validateCanDeprecate(name: string): {
  canDeprecate: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check if already deprecated
  if (isDeprecatedName(name)) {
    issues.push("Name is already deprecated");
  }

  // Check length constraints
  const testDeprecated = generateDeprecatedName(name, "unused");
  if (testDeprecated.length > MAX_IDENTIFIER_LENGTH) {
    issues.push(
      `Name too long (${name.length} chars, max effective: ${MAX_IDENTIFIER_LENGTH - DEPRECATION_SUFFIX_LENGTH})`,
    );
  }

  // Check for problematic characters
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    issues.push(
      "Name contains invalid characters (only alphanumeric and underscore allowed)",
    );
  }

  // Check reserved patterns
  if (name.startsWith("pg_") || name.startsWith("_")) {
    issues.push("Name uses reserved prefix");
  }

  return {
    canDeprecate: issues.length === 0,
    issues,
  };
}

/**
 * Get deprecation statistics for reporting
 */
export function getDeprecationStats(names: string[]): {
  totalDeprecated: number;
  byReason: Record<DeprecationReason, number>;
  byDate: Record<string, number>;
  oldestDeprecation: Date | null;
  newestDeprecation: Date | null;
} {
  const deprecatedNames = names.filter(isDeprecatedName);
  const parsed = deprecatedNames
    .map(parseDeprecatedName)
    .filter((p) => p.isValid);

  const byReason: Record<DeprecationReason, number> = {
    unused: 0,
    performance: 0,
    migration: 0,
    refactor: 0,
    security: 0,
    optimization: 0,
  };

  const byDate: Record<string, number> = {};
  let oldestDeprecation: Date | null = null;
  let newestDeprecation: Date | null = null;

  for (const p of parsed) {
    byReason[p.reason]++;

    const dateKey = formatDeprecationDate(p.deprecationDate);
    byDate[dateKey] = (byDate[dateKey] || 0) + 1;

    if (!oldestDeprecation || p.deprecationDate < oldestDeprecation) {
      oldestDeprecation = p.deprecationDate;
    }

    if (!newestDeprecation || p.deprecationDate > newestDeprecation) {
      newestDeprecation = p.deprecationDate;
    }
  }

  return {
    totalDeprecated: deprecatedNames.length,
    byReason,
    byDate,
    oldestDeprecation,
    newestDeprecation,
  };
}

/**
 * Generate deprecation report for a list of names
 */
export function generateDeprecationReport(names: string[]): {
  summary: string;
  details: Array<{
    name: string;
    originalName: string;
    reason: DeprecationReason;
    deprecationDate: Date;
    ageInDays: number;
  }>;
} {
  const stats = getDeprecationStats(names);
  const deprecatedNames = names.filter(isDeprecatedName);
  const now = new Date();

  const details = deprecatedNames
    .map((name) => {
      const parsed = parseDeprecatedName(name);
      if (!parsed.isValid) return null;

      const ageInDays = Math.floor(
        (now.getTime() - parsed.deprecationDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return {
        name,
        originalName: parsed.originalName,
        reason: parsed.reason,
        deprecationDate: parsed.deprecationDate,
        ageInDays,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.ageInDays - a.ageInDays); // Oldest first

  const summary = `
Deprecation Summary:
- Total deprecated elements: ${stats.totalDeprecated}
- By reason: ${Object.entries(stats.byReason)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ")}
- Age range: ${stats.oldestDeprecation ? `${Math.floor((now.getTime() - stats.oldestDeprecation.getTime()) / (1000 * 60 * 60 * 24))} days` : "N/A"} to ${stats.newestDeprecation ? `${Math.floor((now.getTime() - stats.newestDeprecation.getTime()) / (1000 * 60 * 60 * 24))} days` : "N/A"}
  `.trim();

  return { summary, details };
}
