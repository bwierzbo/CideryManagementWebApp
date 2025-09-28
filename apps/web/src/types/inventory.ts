import { z } from "zod";

// Material type enum - matches the API types
export const materialTypeEnum = z.enum([
  "apple",
  "additive",
  "juice",
  "packaging",
]);
export type MaterialType = z.infer<typeof materialTypeEnum>;

// Search state interface for inventory search functionality
export interface InventorySearchState {
  query: string;
  materialTypes: MaterialType[];
  location: string;
  status: string;
}

// Filter state interface for inventory filters
export interface InventoryFiltersState {
  materialTypes: MaterialType[];
  location: string;
  status: string;
  isActive: boolean;
}

// Search input schema for validation
export const searchInputSchema = z.object({
  query: z.string(),
  materialTypes: z.array(materialTypeEnum).default([]),
  limit: z.number().int().positive().max(50).default(20),
});

// Filter input schema for validation
export const filterInputSchema = z.object({
  materialTypes: z.array(materialTypeEnum).default([]),
  location: z.string().optional(),
  status: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Combined search and filter state
export interface InventoryUIState
  extends InventorySearchState,
    InventoryFiltersState {}

// Search callback function type
export type SearchCallback = (query: string) => void;

// Filter callback function type
export type FilterCallback = (filters: Partial<InventoryFiltersState>) => void;

// Debounced search hook type
export type DebouncedSearchHook = {
  debouncedQuery: string;
  setQuery: (query: string) => void;
  isDebouncing: boolean;
};

// Material type display information
export interface MaterialTypeInfo {
  value: MaterialType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

// Material type configuration for filters
export const MATERIAL_TYPE_CONFIG: Record<MaterialType, MaterialTypeInfo> = {
  apple: {
    value: "apple",
    label: "Base Fruit",
    icon: "🍎",
    color: "bg-red-100 text-red-800 border-red-200",
    description: "Base fruit varieties for pressing",
  },
  additive: {
    value: "additive",
    label: "Additives",
    icon: "🧪",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Yeast, nutrients, enzymes, and other additives",
  },
  juice: {
    value: "juice",
    label: "Juice",
    icon: "🧃",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Pressed apple juice in various stages",
  },
  packaging: {
    value: "packaging",
    label: "Packaging",
    icon: "📦",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Bottles, caps, labels, and packaging materials",
  },
};

// Location filter options
export const LOCATION_OPTIONS = [
  { value: "all", label: "All Locations" },
  { value: "cellar", label: "Cellar" },
  { value: "packaging", label: "Packaging Area" },
  { value: "storage", label: "Cold Storage" },
  { value: "warehouse", label: "Warehouse" },
  { value: "receiving", label: "Receiving Area" },
] as const;

// Status filter options
export const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
] as const;

// Type exports
export type SearchInputType = z.infer<typeof searchInputSchema>;
export type FilterInputType = z.infer<typeof filterInputSchema>;
export type LocationOption = (typeof LOCATION_OPTIONS)[number]["value"];
export type StatusOption = (typeof STATUS_OPTIONS)[number]["value"];
