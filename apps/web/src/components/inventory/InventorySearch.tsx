"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Clock, TrendingUp, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useOptimizedSearch, useSimpleSearch, type OptimizedSearchConfig } from '@/hooks/useOptimizedSearch'
import type { SearchCallback, DebouncedSearchHook, MaterialType } from '@/types/inventory'
import type { SearchableItem } from '@/utils/searchUtils'

interface InventorySearchProps {
  onSearch: SearchCallback
  placeholder?: string
  className?: string
  debounceMs?: number
  initialValue?: string
  showClearButton?: boolean
  // New optimized search props
  items?: SearchableItem[]
  enableAdvancedSearch?: boolean
  searchConfig?: OptimizedSearchConfig
  onResultsChange?: (results: SearchableItem[]) => void
  showPerformanceMetrics?: boolean
}

// Custom hook for debounced search functionality
export function useDebouncedSearch(
  initialValue: string = '',
  debounceMs: number = 300
): DebouncedSearchHook {
  const [query, setQuery] = useState(initialValue)
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue)
  const [isDebouncing, setIsDebouncing] = useState(false)

  useEffect(() => {
    setIsDebouncing(true)
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setIsDebouncing(false)
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      setIsDebouncing(false)
    }
  }, [query, debounceMs])

  return {
    debouncedQuery,
    setQuery,
    isDebouncing
  }
}

export function InventorySearch({
  onSearch,
  placeholder = "Search inventory...",
  className,
  debounceMs = 150, // Optimized from 300ms
  initialValue = '',
  showClearButton = true,
  items = [],
  enableAdvancedSearch = false,
  searchConfig,
  onResultsChange,
  showPerformanceMetrics = false
}: InventorySearchProps) {
  // Use optimized search when items are provided
  const optimizedSearch = useOptimizedSearch(items, {
    debounceMs,
    autoSearch: false, // Manual control for compatibility
    enableHistory: enableAdvancedSearch,
    enableSuggestions: enableAdvancedSearch,
    enablePerformanceMonitoring: showPerformanceMetrics,
    ...searchConfig
  })

  // Fallback to legacy debounced search
  const { debouncedQuery, setQuery: setLegacyQuery, isDebouncing } = useDebouncedSearch(initialValue, debounceMs)

  // Current query state
  const [currentQuery, setCurrentQuery] = useState(initialValue)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Determine which search system to use
  const usingOptimizedSearch = items.length > 0
  const searchState = usingOptimizedSearch ? optimizedSearch.searchState : null
  const isSearching = usingOptimizedSearch ? searchState?.isSearching || false : isDebouncing

  // Handle results change for optimized search
  useEffect(() => {
    if (usingOptimizedSearch && searchState && onResultsChange) {
      const results = searchState.results.map(r => r.item)
      onResultsChange(results)
    }
  }, [usingOptimizedSearch, searchState?.results, onResultsChange, searchState])

  // Call onSearch when debounced query changes (legacy mode)
  useEffect(() => {
    if (!usingOptimizedSearch) {
      onSearch(debouncedQuery)
    }
  }, [usingOptimizedSearch, debouncedQuery, onSearch])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCurrentQuery(value)

    if (usingOptimizedSearch) {
      optimizedSearch.setQuery(value)
      // Also call legacy callback for compatibility
      onSearch(value)
    } else {
      setLegacyQuery(value)
    }
  }, [usingOptimizedSearch, optimizedSearch, onSearch, setLegacyQuery])

  // Handle clear button click
  const handleClear = useCallback(() => {
    setCurrentQuery('')
    setShowDropdown(false)

    if (usingOptimizedSearch) {
      optimizedSearch.clearSearch()
    } else {
      setLegacyQuery('')
    }

    // Focus input after clearing
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [usingOptimizedSearch, optimizedSearch, setLegacyQuery])

  // Handle key down events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (showDropdown) {
        setShowDropdown(false)
      } else {
        handleClear()
      }
    } else if (e.key === 'ArrowDown' && enableAdvancedSearch) {
      e.preventDefault()
      setShowDropdown(true)
    }
  }, [handleClear, showDropdown, enableAdvancedSearch])

  // Handle focus events for dropdown
  const handleFocus = useCallback(() => {
    if (enableAdvancedSearch && (searchState?.suggestions.length || searchState?.history.length)) {
      setShowDropdown(true)
    }
  }, [enableAdvancedSearch, searchState?.suggestions.length, searchState?.history.length])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle suggestion/history selection
  const handleSelectItem = useCallback((item: string) => {
    setCurrentQuery(item)
    setShowDropdown(false)

    if (usingOptimizedSearch) {
      optimizedSearch.selectSuggestion(item)
    } else {
      setLegacyQuery(item)
    }

    inputRef.current?.focus()
  }, [usingOptimizedSearch, optimizedSearch, setLegacyQuery])

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={currentQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className={cn(
            "pl-10",
            showClearButton && currentQuery && "pr-16",
            isSearching && "opacity-75",
            showPerformanceMetrics && searchState?.metrics && "pr-24"
          )}
          aria-label="Search inventory"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        {/* Performance indicator */}
        {showPerformanceMetrics && searchState?.metrics && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <Badge
              variant={searchState.metrics.searchTime < 100 ? "default" :
                      searchState.metrics.searchTime < 300 ? "secondary" : "destructive"}
              className="text-xs px-1 py-0 h-5"
              title={`Search took ${searchState.metrics.searchTime.toFixed(1)}ms using ${searchState.metrics.algorithmUsed}`}
            >
              {searchState.metrics.searchTime < 100 ? (
                <Zap className="w-2 h-2" />
              ) : searchState.metrics.searchTime < 300 ? (
                <TrendingUp className="w-2 h-2" />
              ) : (
                <Clock className="w-2 h-2" />
              )}
            </Badge>
          </div>
        )}

        {showClearButton && currentQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Loading indicator */}
      {isSearching && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500 flex items-center gap-1">
          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Searching...
        </div>
      )}

      {/* Advanced search dropdown */}
      {enableAdvancedSearch && showDropdown && searchState && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
          role="listbox"
        >
          {/* Search history */}
          {searchState.history.length > 0 && (
            <div className="p-2 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recent Searches
              </div>
              {searchState.history.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectItem(item)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                  role="option"
                  aria-selected={false}
                >
                  <Search className="w-3 h-3 text-gray-400" />
                  {item}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => optimizedSearch.clearHistory()}
                className="w-full mt-1 h-6 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear History
              </Button>
            </div>
          )}

          {/* Suggestions */}
          {searchState.suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Suggestions
              </div>
              {searchState.suggestions
                .filter(suggestion =>
                  !currentQuery || suggestion.toLowerCase().includes(currentQuery.toLowerCase())
                )
                .slice(0, 5)
                .map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectItem(suggestion)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                  role="option"
                  aria-selected={false}
                >
                  <TrendingUp className="w-3 h-3 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Performance metrics */}
          {showPerformanceMetrics && searchState.metrics && (
            <div className="p-2 border-t border-gray-100 bg-gray-50">
              <div className="text-xs text-gray-600 space-y-1">
                <div>Found {searchState.metrics.filteredItems} of {searchState.metrics.totalItems} items</div>
                <div>Search time: {searchState.metrics.searchTime.toFixed(1)}ms</div>
                <div>Algorithm: {searchState.metrics.algorithmUsed}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Enhanced search component with additional features (legacy - kept for compatibility)
interface AdvancedInventorySearchProps extends InventorySearchProps {
  recentSearches?: string[]
  onRecentSearchSelect?: (search: string) => void
  showSuggestions?: boolean
  suggestions?: string[]
  onSuggestionSelect?: (suggestion: string) => void
}

/**
 * @deprecated Use InventorySearch with enableAdvancedSearch=true instead
 */
export function AdvancedInventorySearch({
  recentSearches = [],
  onRecentSearchSelect,
  showSuggestions = false,
  suggestions = [],
  onSuggestionSelect,
  ...searchProps
}: AdvancedInventorySearchProps) {
  console.warn('AdvancedInventorySearch is deprecated. Use InventorySearch with enableAdvancedSearch=true instead.')

  return (
    <InventorySearch
      {...searchProps}
      enableAdvancedSearch={true}
    />
  )
}

/**
 * High-performance search component specifically optimized for inventory items
 * Uses the optimized search algorithms and provides real-time search with <300ms response
 */
export function OptimizedInventorySearch({
  items,
  onResultsChange,
  placeholder = "Search inventory...",
  className,
  searchConfig = {},
  showPerformanceMetrics = false
}: {
  items: SearchableItem[]
  onResultsChange: (results: SearchableItem[]) => void
  placeholder?: string
  className?: string
  searchConfig?: OptimizedSearchConfig
  showPerformanceMetrics?: boolean
}) {
  return (
    <InventorySearch
      onSearch={() => {}} // Handled internally
      placeholder={placeholder}
      className={className}
      items={items}
      enableAdvancedSearch={true}
      searchConfig={{
        debounceMs: 150,
        enableHistory: true,
        enableSuggestions: true,
        enablePerformanceMonitoring: true,
        ...searchConfig
      }}
      onResultsChange={onResultsChange}
      showPerformanceMetrics={showPerformanceMetrics}
      showClearButton={true}
    />
  )
}

/**
 * Simple search component for basic use cases
 * Optimized for performance with minimal features
 */
export function SimpleInventorySearch({
  items,
  onResultsChange,
  placeholder = "Search...",
  className,
  debounceMs = 150
}: {
  items: SearchableItem[]
  onResultsChange: (results: SearchableItem[]) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}) {
  const { query, setQuery, results, isSearching, clearSearch } = useSimpleSearch(items, debounceMs)

  useEffect(() => {
    onResultsChange(results)
  }, [results, onResultsChange])

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(
            "pl-10",
            query && "pr-10",
            isSearching && "opacity-75"
          )}
          aria-label="Search"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {isSearching && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500">
          Searching...
        </div>
      )}
    </div>
  )
}