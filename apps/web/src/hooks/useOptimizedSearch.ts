/**
 * Optimized search hook for inventory management
 * Provides advanced search capabilities with <300ms response time target
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  searchItems,
  generateSearchSuggestions,
  SearchHistory,
  SearchPerformanceMonitor,
  type SearchableItem,
  type SearchResult,
  type SearchConfig,
  type SearchMetrics,
} from "@/utils/searchUtils";

// Hook configuration interface
export interface OptimizedSearchConfig extends SearchConfig {
  debounceMs?: number;
  enableHistory?: boolean;
  enableSuggestions?: boolean;
  enablePerformanceMonitoring?: boolean;
  minQueryLength?: number;
  autoSearch?: boolean;
}

// Search state interface
export interface SearchState<T extends SearchableItem> {
  query: string;
  isSearching: boolean;
  results: SearchResult<T>[];
  suggestions: string[];
  history: string[];
  metrics: SearchMetrics | null;
  error: string | null;
}

// Hook return type
export interface OptimizedSearchHook<T extends SearchableItem> {
  // State
  searchState: SearchState<T>;

  // Actions
  setQuery: (query: string) => void;
  search: (query?: string) => void;
  clearSearch: () => void;
  clearHistory: () => void;
  selectSuggestion: (suggestion: string) => void;
  selectHistoryItem: (item: string) => void;

  // Utilities
  isValidQuery: (query: string) => boolean;
  getPerformanceReport: () => ReturnType<
    SearchPerformanceMonitor["getPerformanceReport"]
  >;
}

// Default configuration
const DEFAULT_CONFIG: Required<OptimizedSearchConfig> = {
  debounceMs: 150, // Optimized from 300ms for better UX
  enableHistory: true,
  enableSuggestions: true,
  enablePerformanceMonitoring: true,
  minQueryLength: 1,
  autoSearch: true,
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
 * High-performance search hook with advanced features
 */
export function useOptimizedSearch<T extends SearchableItem>(
  items: T[],
  config: OptimizedSearchConfig = {},
): OptimizedSearchHook<T> {
  // Merge configuration with defaults
  const searchConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config],
  );

  // State management
  const [query, setQueryState] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult<T>[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);

  // Refs for stable instances
  const searchHistoryRef = useRef<SearchHistory | null>(null);
  const performanceMonitorRef = useRef<SearchPerformanceMonitor | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize search history and performance monitor
  useEffect(() => {
    if (searchConfig.enableHistory && !searchHistoryRef.current) {
      searchHistoryRef.current = new SearchHistory();
    }
    if (
      searchConfig.enablePerformanceMonitoring &&
      !performanceMonitorRef.current
    ) {
      performanceMonitorRef.current = new SearchPerformanceMonitor();
    }
  }, [searchConfig.enableHistory, searchConfig.enablePerformanceMonitoring]);

  // Generate suggestions when items change
  useEffect(() => {
    if (searchConfig.enableSuggestions && items.length > 0) {
      try {
        const newSuggestions = generateSearchSuggestions(items, 20);
        setSuggestions(newSuggestions);
      } catch (err) {
        console.warn("Failed to generate search suggestions:", err);
      }
    }
  }, [items, searchConfig.enableSuggestions]);

  // Get current search history
  const history = useMemo(() => {
    return searchConfig.enableHistory && searchHistoryRef.current
      ? searchHistoryRef.current.getHistory()
      : [];
  }, [searchConfig.enableHistory]); // Removed unnecessary query dependency

  // Validation function
  const isValidQuery = useCallback(
    (query: string): boolean => {
      return query.trim().length >= searchConfig.minQueryLength;
    },
    [searchConfig.minQueryLength],
  );

  // Core search function
  const performSearch = useCallback(
    async (searchQuery: string): Promise<void> => {
      // Abort previous search if running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsSearching(true);
      setError(null);

      try {
        // Check if we should abort
        if (signal.aborted) return;

        // Perform search with performance measurement
        const searchStart = performance.now();

        const { results: searchResults, metrics: searchMetrics } =
          await new Promise<{
            results: SearchResult<T>[];
            metrics: SearchMetrics;
          }>((resolve, reject) => {
            // Use setTimeout to make this async and allow for cancellation
            const timeoutId = setTimeout(() => {
              try {
                if (signal.aborted) {
                  reject(new Error("Search aborted"));
                  return;
                }

                const result = searchItems(items, searchQuery, searchConfig);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            }, 0);

            // Handle abort
            signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(new Error("Search aborted"));
            });
          });

        // Check if we should abort before setting results
        if (signal.aborted) return;

        // Update results and metrics
        setResults(searchResults);
        setMetrics(searchMetrics);

        // Record performance metrics
        if (
          searchConfig.enablePerformanceMonitoring &&
          performanceMonitorRef.current
        ) {
          performanceMonitorRef.current.recordMetrics(searchMetrics);
        }

        // Add to search history if valid
        if (
          searchConfig.enableHistory &&
          searchHistoryRef.current &&
          isValidQuery(searchQuery)
        ) {
          searchHistoryRef.current.add(searchQuery);
        }

        // Log performance warning if search is slow
        const totalTime = performance.now() - searchStart;
        if (totalTime > 300) {
          console.warn(
            `Search took ${totalTime.toFixed(2)}ms (over 300ms target)`,
            {
              query: searchQuery,
              itemCount: items.length,
              resultCount: searchResults.length,
              algorithm: searchMetrics.algorithmUsed,
            },
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Search aborted") {
          // Ignore abort errors
          return;
        }

        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setMetrics(null);
      } finally {
        setIsSearching(false);
      }
    },
    [items, searchConfig, isValidQuery],
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Clear results immediately for empty queries
      if (!isValidQuery(searchQuery)) {
        setResults([]);
        setMetrics(null);
        setIsSearching(false);
        return;
      }

      // Set up new timer
      debounceTimerRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, searchConfig.debounceMs);

      // Show searching state immediately
      setIsSearching(true);
    },
    [performSearch, searchConfig.debounceMs, isValidQuery],
  );

  // Public search function
  const search = useCallback(
    (searchQuery?: string) => {
      const queryToSearch = searchQuery ?? query;
      performSearch(queryToSearch);
    },
    [query, performSearch],
  );

  // Set query with optional auto-search
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      if (searchConfig.autoSearch) {
        debouncedSearch(newQuery);
      }
    },
    [searchConfig.autoSearch, debouncedSearch],
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setQueryState("");
    setResults([]);
    setMetrics(null);
    setError(null);
    setIsSearching(false);

    // Clear any pending debounced search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Abort any running search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    if (searchHistoryRef.current) {
      searchHistoryRef.current.clear();
    }
  }, []);

  // Select suggestion
  const selectSuggestion = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      // Force immediate search for suggestions
      performSearch(suggestion);
    },
    [setQuery, performSearch],
  );

  // Select history item
  const selectHistoryItem = useCallback(
    (item: string) => {
      setQuery(item);
      // Force immediate search for history items
      performSearch(item);
    },
    [setQuery, performSearch],
  );

  // Get performance report
  const getPerformanceReport = useCallback(() => {
    return (
      performanceMonitorRef.current?.getPerformanceReport() ?? {
        totalSearches: 0,
        averageTime: 0,
        algorithmUsage: {},
        slowestSearches: [],
      }
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Build search state
  const searchState: SearchState<T> = useMemo(
    () => ({
      query,
      isSearching,
      results,
      suggestions,
      history,
      metrics,
      error,
    }),
    [query, isSearching, results, suggestions, history, metrics, error],
  );

  return {
    searchState,
    setQuery,
    search,
    clearSearch,
    clearHistory,
    selectSuggestion,
    selectHistoryItem,
    isValidQuery,
    getPerformanceReport,
  };
}

/**
 * Lightweight search hook for simple use cases
 * Optimized for performance with minimal features
 */
export function useSimpleSearch<T extends SearchableItem>(
  items: T[],
  debounceMs = 150,
): {
  query: string;
  setQuery: (query: string) => void;
  results: T[];
  isSearching: boolean;
  clearSearch: () => void;
} {
  const { searchState, setQuery, clearSearch } = useOptimizedSearch(items, {
    debounceMs,
    enableHistory: false,
    enableSuggestions: false,
    enablePerformanceMonitoring: false,
    highlightMatches: false,
    maxResults: 50,
  });

  const results = useMemo(
    () => searchState.results.map((result) => result.item),
    [searchState.results],
  );

  return {
    query: searchState.query,
    setQuery,
    results,
    isSearching: searchState.isSearching,
    clearSearch,
  };
}

/**
 * Hook for search result highlighting
 * Extracts highlighted text from search results
 */
export function useSearchHighlighting<T extends SearchableItem>(
  results: SearchResult<T>[],
): {
  getHighlightedText: (item: T, field: string) => string | null;
  hasHighlights: (item: T) => boolean;
} {
  const getHighlightedText = useCallback(
    (item: T, field: string): string | null => {
      const result = results.find((r) => r.item.id === item.id);
      if (!result) return null;

      const match = result.matches.find((m) => m.field === field);
      return match?.highlighted || null;
    },
    [results],
  );

  const hasHighlights = useCallback(
    (item: T): boolean => {
      const result = results.find((r) => r.item.id === item.id);
      return Boolean(result && result.matches.length > 0);
    },
    [results],
  );

  return {
    getHighlightedText,
    hasHighlights,
  };
}
