/**
 * Dual Support Schema
 * This schema supports BOTH old (_l) and new (with units) column names
 * This allows gradual migration without breaking existing functionality
 */

// Example for batches table - showing both patterns

export const batchesDualSupport = {
  // ... other fields ...

  // OLD COLUMNS - Keep these for backward compatibility
  initialVolumeL: decimal("initial_volume_l", {
    precision: 10,
    scale: 3,
  }).notNull(),
  currentVolumeL: decimal("current_volume_l", { precision: 10, scale: 3 }),

  // NEW COLUMNS - For new functionality
  initialVolume: decimal("initial_volume", {
    precision: 10,
    scale: 3,
  }),
  initialVolumeUnit: unitEnum("initial_volume_unit").notNull().default("L"),
  currentVolume: decimal("current_volume", { precision: 10, scale: 3 }),
  currentVolumeUnit: unitEnum("current_volume_unit").notNull().default("L"),

  // ... rest of fields ...
};

/**
 * Helper functions to work with both formats
 */

/**
 * Get volume value regardless of which column has data
 */
export function getVolume(row: any, field: 'initial' | 'current'): number | null {
  if (field === 'initial') {
    // Try new column first, fall back to old
    return row.initialVolume ?? row.initialVolumeL ?? null;
  } else {
    return row.currentVolume ?? row.currentVolumeL ?? null;
  }
}

/**
 * Get volume with unit
 */
export function getVolumeWithUnit(row: any, field: 'initial' | 'current'): {
  value: number | null;
  unit: string;
} {
  if (field === 'initial') {
    return {
      value: row.initialVolume ?? row.initialVolumeL ?? null,
      unit: row.initialVolumeUnit ?? 'L'
    };
  } else {
    return {
      value: row.currentVolume ?? row.currentVolumeL ?? null,
      unit: row.currentVolumeUnit ?? 'L'
    };
  }
}

/**
 * Set volume - updates both old and new columns for compatibility
 */
export function setVolumeDualUpdate(field: 'initial' | 'current', value: number, unit: string = 'L') {
  if (field === 'initial') {
    return {
      initialVolumeL: value,  // Keep old column in sync
      initialVolume: value,   // Update new column
      initialVolumeUnit: unit // Set unit
    };
  } else {
    return {
      currentVolumeL: value,
      currentVolume: value,
      currentVolumeUnit: unit
    };
  }
}