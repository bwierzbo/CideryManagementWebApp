/**
 * Shared enums and type definitions used across multiple schema files
 * This file helps avoid circular dependencies
 */

import { pgEnum } from "drizzle-orm/pg-core";

// Shared enums
export const unitEnum = pgEnum("unit", ["kg", "lb", "L", "gal", "bushel"]);