/**
 * Search result highlighting component
 * Highlights search matches in text with customizable styling
 */

import React from 'react'
import { cn } from '@/lib/utils'

interface SearchHighlighterProps {
  text: string
  highlightedText?: string | null
  className?: string
  highlightClassName?: string
  fallbackToOriginal?: boolean
}

/**
 * Component that displays text with search highlighting
 * Falls back to original text if no highlighting is available
 */
export function SearchHighlighter({
  text,
  highlightedText,
  className,
  highlightClassName = "bg-yellow-200 font-semibold text-yellow-900 px-0.5 py-0 rounded-sm",
  fallbackToOriginal = true
}: SearchHighlighterProps) {
  // Use highlighted text if available, otherwise fall back to original
  const displayText = highlightedText && highlightedText !== text ? highlightedText : text

  // If we have highlighted text with <mark> tags, render as HTML
  if (highlightedText && highlightedText.includes('<mark>')) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{
          __html: highlightedText.replace(
            /<mark>/g,
            `<mark class="${highlightClassName}">`
          )
        }}
      />
    )
  }

  // Otherwise render as plain text
  return <span className={className}>{displayText}</span>
}

/**
 * Hook for highlighting text based on search query
 * Provides a simple way to highlight matches without complex search results
 */
export function useSimpleHighlighting(query: string, caseSensitive = false) {
  const highlightText = React.useCallback((text: string): string => {
    if (!query.trim() || !text) return text

    const searchQuery = caseSensitive ? query : query.toLowerCase()
    const searchText = caseSensitive ? text : text.toLowerCase()

    // Find all matches
    const matches: [number, number][] = []
    let startIndex = 0

    while (startIndex < searchText.length) {
      const index = searchText.indexOf(searchQuery, startIndex)
      if (index === -1) break

      matches.push([index, index + searchQuery.length])
      startIndex = index + 1
    }

    if (matches.length === 0) return text

    // Build highlighted text
    let result = ''
    let lastEnd = 0

    for (const [start, end] of matches) {
      // Add text before match
      result += text.slice(lastEnd, start)
      // Add highlighted match
      result += `<mark>${text.slice(start, end)}</mark>`
      lastEnd = end
    }

    // Add remaining text
    result += text.slice(lastEnd)

    return result
  }, [query, caseSensitive])

  return { highlightText }
}

/**
 * Component that automatically highlights search terms in text
 * Useful for simple highlighting without complex search infrastructure
 */
export function SimpleHighlighter({
  text,
  query,
  className,
  highlightClassName = "bg-yellow-200 font-semibold text-yellow-900 px-0.5 py-0 rounded-sm",
  caseSensitive = false
}: {
  text: string
  query: string
  className?: string
  highlightClassName?: string
  caseSensitive?: boolean
}) {
  const { highlightText } = useSimpleHighlighting(query, caseSensitive)
  const highlighted = highlightText(text)

  if (highlighted.includes('<mark>')) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{
          __html: highlighted.replace(
            /<mark>/g,
            `<mark class="${highlightClassName}">`
          )
        }}
      />
    )
  }

  return <span className={className}>{text}</span>
}

/**
 * Advanced highlighting component with multiple query support
 * Supports highlighting multiple search terms with different colors
 */
export function MultiQueryHighlighter({
  text,
  queries,
  className,
  highlightClassNames = [
    "bg-yellow-200 text-yellow-900",
    "bg-blue-200 text-blue-900",
    "bg-green-200 text-green-900",
    "bg-purple-200 text-purple-900",
    "bg-orange-200 text-orange-900"
  ],
  caseSensitive = false
}: {
  text: string
  queries: string[]
  className?: string
  highlightClassNames?: string[]
  caseSensitive?: boolean
}) {
  const highlightedText = React.useMemo(() => {
    if (!queries.length || !text) return text

    // Find all matches for all queries
    const allMatches: Array<{
      start: number
      end: number
      queryIndex: number
    }> = []

    const searchText = caseSensitive ? text : text.toLowerCase()

    queries.forEach((query, queryIndex) => {
      if (!query.trim()) return

      const searchQuery = caseSensitive ? query : query.toLowerCase()
      let startIndex = 0

      while (startIndex < searchText.length) {
        const index = searchText.indexOf(searchQuery, startIndex)
        if (index === -1) break

        allMatches.push({
          start: index,
          end: index + searchQuery.length,
          queryIndex
        })
        startIndex = index + 1
      }
    })

    if (allMatches.length === 0) return text

    // Sort matches by start position
    allMatches.sort((a, b) => a.start - b.start)

    // Merge overlapping matches
    const mergedMatches: typeof allMatches = []
    for (const match of allMatches) {
      const lastMatch = mergedMatches[mergedMatches.length - 1]

      if (lastMatch && match.start <= lastMatch.end) {
        // Overlapping - extend the last match
        lastMatch.end = Math.max(lastMatch.end, match.end)
      } else {
        // Non-overlapping - add new match
        mergedMatches.push(match)
      }
    }

    // Build highlighted text
    let result = ''
    let lastEnd = 0

    for (const match of mergedMatches) {
      // Add text before match
      result += text.slice(lastEnd, match.start)

      // Add highlighted match
      const highlightClass = highlightClassNames[match.queryIndex % highlightClassNames.length]
      result += `<mark class="${highlightClass} px-0.5 py-0 rounded-sm font-semibold">${text.slice(match.start, match.end)}</mark>`

      lastEnd = match.end
    }

    // Add remaining text
    result += text.slice(lastEnd)

    return result
  }, [text, queries, highlightClassNames, caseSensitive])

  if (highlightedText.includes('<mark>')) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: highlightedText }}
      />
    )
  }

  return <span className={className}>{text}</span>
}

/**
 * Highlighting component with truncation support
 * Highlights matches and truncates text while preserving context around matches
 */
export function TruncatedHighlighter({
  text,
  query,
  maxLength = 100,
  contextLength = 20,
  className,
  highlightClassName = "bg-yellow-200 font-semibold text-yellow-900 px-0.5 py-0 rounded-sm",
  caseSensitive = false,
  truncationIndicator = "..."
}: {
  text: string
  query: string
  maxLength?: number
  contextLength?: number
  className?: string
  highlightClassName?: string
  caseSensitive?: boolean
  truncationIndicator?: string
}) {
  const { highlightText } = useSimpleHighlighting(query, caseSensitive)

  const processedText = React.useMemo(() => {
    if (!query.trim() || text.length <= maxLength) {
      return highlightText(text)
    }

    const searchQuery = caseSensitive ? query : query.toLowerCase()
    const searchText = caseSensitive ? text : text.toLowerCase()
    const firstMatchIndex = searchText.indexOf(searchQuery)

    if (firstMatchIndex === -1) {
      // No match found, truncate normally
      return text.slice(0, maxLength) + truncationIndicator
    }

    // Calculate optimal slice to show the match with context
    const startContext = Math.max(0, firstMatchIndex - contextLength)
    const endContext = Math.min(text.length, firstMatchIndex + searchQuery.length + contextLength)

    let slicedText = text.slice(startContext, endContext)

    // Add truncation indicators if needed
    if (startContext > 0) {
      slicedText = truncationIndicator + slicedText
    }
    if (endContext < text.length) {
      slicedText = slicedText + truncationIndicator
    }

    return highlightText(slicedText)
  }, [text, query, maxLength, contextLength, highlightText, caseSensitive, truncationIndicator])

  if (processedText.includes('<mark>')) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{
          __html: processedText.replace(
            /<mark>/g,
            `<mark class="${highlightClassName}">`
          )
        }}
      />
    )
  }

  return <span className={className}>{processedText}</span>
}