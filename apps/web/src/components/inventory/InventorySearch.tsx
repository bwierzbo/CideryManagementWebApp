"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SearchCallback, DebouncedSearchHook } from '@/types/inventory'

interface InventorySearchProps {
  onSearch: SearchCallback
  placeholder?: string
  className?: string
  debounceMs?: number
  initialValue?: string
  showClearButton?: boolean
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
  debounceMs = 300,
  initialValue = '',
  showClearButton = true
}: InventorySearchProps) {
  const { debouncedQuery, setQuery, isDebouncing } = useDebouncedSearch(initialValue, debounceMs)
  const [currentQuery, setCurrentQuery] = useState(initialValue)

  // Call onSearch when debounced query changes
  useEffect(() => {
    onSearch(debouncedQuery)
  }, [debouncedQuery, onSearch])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCurrentQuery(value)
    setQuery(value)
  }, [setQuery])

  // Handle clear button click
  const handleClear = useCallback(() => {
    setCurrentQuery('')
    setQuery('')
  }, [setQuery])

  // Handle key down events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear()
    }
  }, [handleClear])

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={currentQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-10",
            showClearButton && currentQuery && "pr-10",
            isDebouncing && "opacity-75"
          )}
          aria-label="Search inventory"
        />
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

      {/* Optional: Show loading indicator when debouncing */}
      {isDebouncing && (
        <div className="absolute top-full left-0 mt-1 text-xs text-gray-500">
          Searching...
        </div>
      )}
    </div>
  )
}

// Enhanced search component with additional features
interface AdvancedInventorySearchProps extends InventorySearchProps {
  recentSearches?: string[]
  onRecentSearchSelect?: (search: string) => void
  showSuggestions?: boolean
  suggestions?: string[]
  onSuggestionSelect?: (suggestion: string) => void
}

export function AdvancedInventorySearch({
  recentSearches = [],
  onRecentSearchSelect,
  showSuggestions = false,
  suggestions = [],
  onSuggestionSelect,
  ...searchProps
}: AdvancedInventorySearchProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentQuery, setCurrentQuery] = useState(searchProps.initialValue || '')

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setCurrentQuery(suggestion)
    onSuggestionSelect?.(suggestion)
    setShowDropdown(false)
  }, [onSuggestionSelect])

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback((search: string) => {
    setCurrentQuery(search)
    onRecentSearchSelect?.(search)
    setShowDropdown(false)
  }, [onRecentSearchSelect])

  // Filter suggestions based on current query
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(currentQuery.toLowerCase())
  )

  return (
    <div className="relative">
      <InventorySearch
        {...searchProps}
        initialValue={currentQuery}
        onSearch={(query) => {
          setCurrentQuery(query)
          searchProps.onSearch(query)
        }}
      />

      {/* Dropdown for suggestions and recent searches */}
      {showDropdown && (recentSearches.length > 0 || filteredSuggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="p-2 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">Recent Searches</div>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchSelect(search)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                >
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Suggestions</div>
              {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}