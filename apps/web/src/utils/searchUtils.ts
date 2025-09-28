/**
 * Search utilities for optimized inventory search functionality
 * Implements efficient search algorithms for large datasets with <300ms response time
 */

import type { MaterialType } from "@/types/inventory";

// Interface for searchable inventory items
export interface SearchableItem {
  id: string;
  materialType: MaterialType;
  location?: string | null;
  notes?: string | null;
  metadata?: unknown;
  packageId?: string | null;
  currentBottleCount: number;
  reservedBottleCount: number;
  createdAt: string;
  updatedAt: string;
}

// Search configuration
export interface SearchConfig {
  caseSensitive?: boolean;
  fuzzyThreshold?: number;
  maxResults?: number;
  weightedFields?: SearchFieldWeight[];
  highlightMatches?: boolean;
}

// Field weight configuration for relevance scoring
export interface SearchFieldWeight {
  field: keyof SearchableItem | string;
  weight: number;
}

// Search result with highlighting and relevance score
export interface SearchResult<T = SearchableItem> {
  item: T;
  score: number;
  matches: SearchMatch[];
}

// Search match information for highlighting
export interface SearchMatch {
  field: string;
  value: string;
  indices: [number, number][];
  highlighted?: string;
}

// Search performance metrics
export interface SearchMetrics {
  totalItems: number;
  filteredItems: number;
  searchTime: number;
  algorithmUsed: string;
}

// Default search configuration
const DEFAULT_SEARCH_CONFIG: Required<SearchConfig> = {
  caseSensitive: false,
  fuzzyThreshold: 0.3,
  maxResults: 100,
  weightedFields: [
    { field: "packageId", weight: 1.0 },
    { field: "notes", weight: 0.8 },
    { field: "location", weight: 0.6 },
    { field: "materialType", weight: 0.4 },
    { field: "metadata", weight: 0.3 },
  ],
  highlightMatches: true,
};

/**
 * High-performance search function optimized for large datasets
 * Uses multiple algorithms based on query characteristics
 */
export function searchItems<T extends SearchableItem>(
  items: T[],
  query: string,
  config: SearchConfig = {},
): {
  results: SearchResult<T>[];
  metrics: SearchMetrics;
} {
  const startTime = performance.now();
  const searchConfig = { ...DEFAULT_SEARCH_CONFIG, ...config };

  // Early return for empty query
  if (!query.trim()) {
    return {
      results: items.map((item) => ({ item, score: 1, matches: [] })),
      metrics: {
        totalItems: items.length,
        filteredItems: items.length,
        searchTime: performance.now() - startTime,
        algorithmUsed: "none",
      },
    };
  }

  const normalizedQuery = searchConfig.caseSensitive
    ? query
    : query.toLowerCase();
  let algorithmUsed = "exact";
  let results: SearchResult<T>[] = [];

  // Choose algorithm based on query characteristics
  if (query.length <= 2) {
    // Short queries: use exact prefix matching for performance
    results = exactPrefixSearch(items, normalizedQuery, searchConfig);
    algorithmUsed = "exact-prefix";
  } else if (query.includes(" ") || query.length > 20) {
    // Multi-word or long queries: use tokenized search
    results = tokenizedSearch(items, normalizedQuery, searchConfig);
    algorithmUsed = "tokenized";
  } else {
    // Standard queries: use fuzzy search with fallback
    results = fuzzySearchWithFallback(items, normalizedQuery, searchConfig);
    algorithmUsed = "fuzzy-fallback";
  }

  // Limit results for performance
  if (results.length > searchConfig.maxResults) {
    results = results.slice(0, searchConfig.maxResults);
  }

  const endTime = performance.now();

  return {
    results,
    metrics: {
      totalItems: items.length,
      filteredItems: results.length,
      searchTime: endTime - startTime,
      algorithmUsed,
    },
  };
}

/**
 * Exact prefix matching for short queries
 * Optimized for speed with early termination
 */
function exactPrefixSearch<T extends SearchableItem>(
  items: T[],
  query: string,
  config: Required<SearchConfig>,
): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const matches: SearchMatch[] = [];
    let totalScore = 0;

    // Check each weighted field
    for (const fieldWeight of config.weightedFields) {
      const value = getFieldValue(item, fieldWeight.field);
      if (!value) continue;

      const normalizedValue = config.caseSensitive
        ? value
        : value.toLowerCase();

      if (normalizedValue.startsWith(query)) {
        const match: SearchMatch = {
          field: fieldWeight.field,
          value,
          indices: [[0, query.length]],
        };

        if (config.highlightMatches) {
          match.highlighted = highlightText(value, [[0, query.length]]);
        }

        matches.push(match);
        totalScore += fieldWeight.weight;
      }
    }

    if (matches.length > 0) {
      results.push({ item, score: totalScore, matches });
    }

    // Early termination for performance
    if (results.length >= config.maxResults * 2) {
      break;
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Tokenized search for multi-word queries
 * Splits query into tokens and matches each separately
 */
function tokenizedSearch<T extends SearchableItem>(
  items: T[],
  query: string,
  config: Required<SearchConfig>,
): SearchResult<T>[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return [];

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const matches: SearchMatch[] = [];
    let totalScore = 0;
    let tokenMatches = 0;

    // Check each weighted field
    for (const fieldWeight of config.weightedFields) {
      const value = getFieldValue(item, fieldWeight.field);
      if (!value) continue;

      const normalizedValue = config.caseSensitive
        ? value
        : value.toLowerCase();
      const fieldMatches: [number, number][] = [];

      // Find matches for each token
      for (const token of tokens) {
        const index = normalizedValue.indexOf(token);
        if (index !== -1) {
          fieldMatches.push([index, index + token.length]);
          tokenMatches++;
        }
      }

      if (fieldMatches.length > 0) {
        const match: SearchMatch = {
          field: fieldWeight.field,
          value,
          indices: fieldMatches,
        };

        if (config.highlightMatches) {
          match.highlighted = highlightText(value, fieldMatches);
        }

        matches.push(match);
        // Score based on percentage of tokens matched and field weight
        totalScore +=
          (fieldMatches.length / tokens.length) * fieldWeight.weight;
      }
    }

    // Only include items that match at least half the tokens
    if (tokenMatches >= Math.ceil(tokens.length / 2)) {
      results.push({ item, score: totalScore, matches });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Fuzzy search with exact fallback
 * Uses approximate string matching with fallback to exact search
 */
function fuzzySearchWithFallback<T extends SearchableItem>(
  items: T[],
  query: string,
  config: Required<SearchConfig>,
): SearchResult<T>[] {
  // First try exact substring matching (faster)
  const exactResults = substringSearch(items, query, config);

  // If we have enough exact results, return them
  if (exactResults.length >= Math.min(config.maxResults / 2, 20)) {
    return exactResults;
  }

  // Otherwise, add fuzzy results
  const fuzzyResults = fuzzySearch(items, query, config);

  // Combine and deduplicate results
  const combinedResults = new Map<string, SearchResult<T>>();

  // Add exact results first (higher priority)
  for (const result of exactResults) {
    combinedResults.set(result.item.id, result);
  }

  // Add fuzzy results that aren't already included
  for (const result of fuzzyResults) {
    if (!combinedResults.has(result.item.id)) {
      combinedResults.set(result.item.id, result);
    }
  }

  return Array.from(combinedResults.values()).sort((a, b) => b.score - a.score);
}

/**
 * Exact substring search
 */
function substringSearch<T extends SearchableItem>(
  items: T[],
  query: string,
  config: Required<SearchConfig>,
): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const matches: SearchMatch[] = [];
    let totalScore = 0;

    for (const fieldWeight of config.weightedFields) {
      const value = getFieldValue(item, fieldWeight.field);
      if (!value) continue;

      const normalizedValue = config.caseSensitive
        ? value
        : value.toLowerCase();
      const index = normalizedValue.indexOf(query);

      if (index !== -1) {
        const match: SearchMatch = {
          field: fieldWeight.field,
          value,
          indices: [[index, index + query.length]],
        };

        if (config.highlightMatches) {
          match.highlighted = highlightText(value, [
            [index, index + query.length],
          ]);
        }

        matches.push(match);
        // Boost score for exact matches
        totalScore += fieldWeight.weight * (index === 0 ? 1.2 : 1.0);
      }
    }

    if (matches.length > 0) {
      results.push({ item, score: totalScore, matches });
    }
  }

  return results;
}

/**
 * Fuzzy search using Levenshtein distance
 */
function fuzzySearch<T extends SearchableItem>(
  items: T[],
  query: string,
  config: Required<SearchConfig>,
): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];
  const maxDistance = Math.floor(query.length * config.fuzzyThreshold);

  for (const item of items) {
    const matches: SearchMatch[] = [];
    let totalScore = 0;

    for (const fieldWeight of config.weightedFields) {
      const value = getFieldValue(item, fieldWeight.field);
      if (!value) continue;

      const normalizedValue = config.caseSensitive
        ? value
        : value.toLowerCase();

      // Check for fuzzy matches in words
      const words = normalizedValue.split(/\s+/);
      for (const word of words) {
        const distance = levenshteinDistance(query, word);
        if (distance <= maxDistance) {
          const similarity = 1 - distance / Math.max(query.length, word.length);

          const match: SearchMatch = {
            field: fieldWeight.field,
            value,
            indices: [
              [
                normalizedValue.indexOf(word),
                normalizedValue.indexOf(word) + word.length,
              ],
            ],
          };

          if (config.highlightMatches) {
            match.highlighted = highlightText(value, match.indices);
          }

          matches.push(match);
          totalScore += fieldWeight.weight * similarity;
        }
      }
    }

    if (matches.length > 0) {
      results.push({ item, score: totalScore, matches });
    }
  }

  return results;
}

/**
 * Get field value from item, handling nested metadata
 */
function getFieldValue(item: SearchableItem, field: string): string {
  if (field in item) {
    const value = (item as any)[field];
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (value === null || value === undefined) return "";
    return String(value);
  }

  // Check in metadata
  if (item.metadata && typeof item.metadata === "object") {
    const metadata = item.metadata as Record<string, any>;
    if (field in metadata) {
      const value = metadata[field];
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      return String(value);
    }
  }

  return "";
}

/**
 * Highlight matching text segments
 */
function highlightText(text: string, indices: [number, number][]): string {
  if (indices.length === 0) return text;

  // Sort indices by start position
  const sortedIndices = indices.sort((a, b) => a[0] - b[0]);

  let result = "";
  let lastEnd = 0;

  for (const [start, end] of sortedIndices) {
    // Add text before match
    result += text.slice(lastEnd, start);
    // Add highlighted match
    result += `<mark>${text.slice(start, end)}</mark>`;
    lastEnd = end;
  }

  // Add remaining text
  result += text.slice(lastEnd);

  return result;
}

/**
 * Calculate Levenshtein distance between two strings
 * Optimized implementation for performance
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimize for common case where strings are identical
  if (a === b) return 0;

  // Use shorter string as columns for better memory usage
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // Use single array instead of matrix for memory efficiency
  let previousRow = Array.from({ length: m + 1 }, (_, i) => i);

  for (let j = 1; j <= n; j++) {
    const currentRow = [j];

    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[i] = Math.min(
        currentRow[i - 1] + 1, // insertion
        previousRow[i] + 1, // deletion
        previousRow[i - 1] + cost, // substitution
      );
    }

    previousRow = currentRow;
  }

  return previousRow[m];
}

/**
 * Create search suggestions based on item data
 */
export function generateSearchSuggestions(
  items: SearchableItem[],
  maxSuggestions = 10,
): string[] {
  const suggestions = new Set<string>();

  for (const item of items) {
    // Add material type
    suggestions.add(item.materialType);

    // Add location if available
    if (item.location) {
      suggestions.add(item.location);
    }

    // Add package ID if available
    if (item.packageId) {
      suggestions.add(item.packageId);
    }

    // Add metadata values
    if (item.metadata && typeof item.metadata === "object") {
      const metadata = item.metadata as Record<string, any>;
      for (const value of Object.values(metadata)) {
        if (
          typeof value === "string" &&
          value.length > 2 &&
          value.length < 50
        ) {
          suggestions.add(value);
        }
      }
    }

    // Stop if we have enough suggestions
    if (suggestions.size >= maxSuggestions * 2) {
      break;
    }
  }

  return Array.from(suggestions).slice(0, maxSuggestions);
}

/**
 * Search history management
 */
export class SearchHistory {
  private history: string[] = [];
  private maxSize: number;
  private storageKey: string;

  constructor(maxSize = 20, storageKey = "inventory-search-history") {
    this.maxSize = maxSize;
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  add(query: string): void {
    if (!query.trim() || query.length < 2) return;

    // Remove existing occurrence
    this.history = this.history.filter((h) => h !== query);

    // Add to beginning
    this.history.unshift(query);

    // Limit size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(0, this.maxSize);
    }

    this.saveToStorage();
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Performance monitoring for search operations
 */
export class SearchPerformanceMonitor {
  private metrics: SearchMetrics[] = [];
  private maxMetrics = 100;

  recordMetrics(metrics: SearchMetrics): void {
    this.metrics.push({
      ...metrics,
      // Add timestamp for trend analysis
      ...(metrics as any),
      timestamp: Date.now(),
    });

    // Limit stored metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getAverageSearchTime(algorithm?: string): number {
    const relevantMetrics = algorithm
      ? this.metrics.filter((m) => m.algorithmUsed === algorithm)
      : this.metrics;

    if (relevantMetrics.length === 0) return 0;

    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.searchTime, 0);
    return totalTime / relevantMetrics.length;
  }

  getPerformanceReport(): {
    totalSearches: number;
    averageTime: number;
    algorithmUsage: Record<string, number>;
    slowestSearches: SearchMetrics[];
  } {
    const algorithmUsage: Record<string, number> = {};

    for (const metric of this.metrics) {
      algorithmUsage[metric.algorithmUsed] =
        (algorithmUsage[metric.algorithmUsed] || 0) + 1;
    }

    const slowestSearches = [...this.metrics]
      .sort((a, b) => b.searchTime - a.searchTime)
      .slice(0, 10);

    return {
      totalSearches: this.metrics.length,
      averageTime: this.getAverageSearchTime(),
      algorithmUsage,
      slowestSearches,
    };
  }
}
